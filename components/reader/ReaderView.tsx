'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import dynamic from 'next/dynamic';
import { useSettingsStore } from '@/stores/settingsStore';
import { savePosition, getAudioFile, getSentenceSyncData } from '@/lib/db';
import { useEpubReader } from '@/hooks/useEpubReader';
import { useHighlights } from '@/hooks/useHighlights';
import { useSession } from '@/hooks/useSession';
import { useReadingStats } from '@/hooks/useReadingStats';
import { useChapters } from '@/hooks/useChapters';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useProgressiveAudioPlayer } from '@/hooks/useProgressiveAudioPlayer';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import { useSentenceSync } from '@/hooks/useSentenceSync';
import { getAudioSettings, getDefaultAudioSettings } from '@/lib/db';
import { timestampToCFI, cfiToTimestamp, findChapterByCFI } from '@/lib/audio-sync';
import { SentenceHighlighter } from '@/lib/sentence-highlighter';
import type { Chapter, AudioSettings, SentenceSyncData } from '@/types';
import { UI_CONSTANTS } from '@/lib/constants';
import type { HighlightColor } from '@/lib/constants';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import TapZones from './TapZones';
import SettingsDrawer from './SettingsDrawer';
import HighlightMenu from './HighlightMenu';
import NoteEditor from './NoteEditor';
import ProgressIndicators from './ProgressIndicators';
import AudioPlayer from './AudioPlayer';
import ChapterList from './ChapterList';
import AiRecap from './AiRecap';
import AiExplanation from './AiExplanation';
import AiChapterSummary from './AiChapterSummary';

// Dynamically import to avoid SSR issues with epub.js
const ReaderViewContent = dynamic(() => Promise.resolve(ReaderViewContentComponent), {
  ssr: false,
});

interface ReaderViewProps {
  bookId: number;
  bookBlob: Blob;
  initialCfi?: string;
}

function ReaderViewContentComponent({ bookId, bookBlob, initialCfi }: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showAiRecap, setShowAiRecap] = useState(false);
  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [showAiChapterSummary, setShowAiChapterSummary] = useState(false);
  const [aiExplanationData, setAiExplanationData] = useState<{ text: string; position: { x: number; y: number } } | null>(null);
  const [showChapterList, setShowChapterList] = useState(false);
  const [currentAudioChapter, setCurrentAudioChapter] = useState<Chapter | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true); // TTS Phase 4: Audio-reading sync toggle
  const lastSyncTimeRef = useRef<number>(0); // TTS Phase 4: Rate limit sync updates
  const syncInProgressRef = useRef<boolean>(false); // Prevent concurrent sync operations
  const [sentenceSyncData, setSentenceSyncData] = useState<SentenceSyncData | null>(null); // TTS Phase: Sentence Sync
  const highlighterRef = useRef<SentenceHighlighter | null>(null); // TTS Phase: Sentence Sync
  const { showControls, toggleControls, setShowControls } = useSettingsStore();

  const { book, rendition, loading, currentLocation, progress, totalLocations, nextPage, prevPage, goToLocation } =
    useEpubReader({
      bookBlob,
      containerRef,
      onLocationChange: async (cfi, percentage) => {
        // Save position to database with error handling
        try {
          await savePosition({
            bookId,
            cfi,
            percentage,
            updatedAt: new Date(),
          });
        } catch (error) {
          console.error('Failed to save reading position:', error);
        }

        // Track page turn for session
        trackPageTurn();
      },
    });

  // Session tracking (Phase 3: now includes analytics, Phase 4: listening time)
  const { sessionId, pagesRead, sessionStartTime, trackPageTurn, trackListeningTime } = useSession({
    bookId,
    currentCfi: currentLocation,
  });

  // Reading stats for progress indicators (Phase 3)
  const stats = useReadingStats({
    totalLocations: totalLocations || 0,
    currentLocation: currentLocation ? 1 : 0, // Simplified for now
    pagesRead,
    sessionStartTime,
  });

  // Chapter extraction (TTS Phase 1)
  const { chapters, loading: chaptersLoading } = useChapters({
    bookId,
    book,
  });

  // Highlighting
  const {
    currentSelection,
    editingNote,
    createHighlight,
    updateNote,
    setCurrentSelection,
    setEditingNote,
  } = useHighlights({
    bookId,
    rendition,
  });

  // Load initial position
  useEffect(() => {
    if (initialCfi && goToLocation) {
      goToLocation(initialCfi);
    }
  }, [initialCfi, goToLocation]);

  // Debug log for chapter extraction (TTS Phase 1)
  useEffect(() => {
    if (chapters.length > 0) {
      console.log(`[TTS Phase 1] Extracted ${chapters.length} chapters:`, chapters);
    }
  }, [chapters]);

  // Load audio settings (TTS Phase 3)
  useEffect(() => {
    const loadAudioSettings = async () => {
      const settings = await getAudioSettings(bookId) || getDefaultAudioSettings(bookId);
      setAudioSettings(settings);
    };
    loadAudioSettings();
  }, [bookId]);

  // Load sentence sync data when audio chapter changes (TTS Phase: Sentence Sync)
  useEffect(() => {
    const loadSentenceData = async () => {
      if (!currentAudioChapter?.id) {
        setSentenceSyncData(null);
        return;
      }

      try {
        const audioFile = await getAudioFile(currentAudioChapter.id);
        if (audioFile?.id) {
          const data = await getSentenceSyncData(audioFile.id);
          setSentenceSyncData(data || null);
          console.log(`[TTS Sentence Sync] Loaded ${data?.sentences.length || 0} sentences for chapter`);
        }
      } catch (error) {
        console.error('[TTS Sentence Sync] Failed to load sentence data:', error);
        setSentenceSyncData(null);
      }
    };

    loadSentenceData();
  }, [currentAudioChapter]);

  // Initialize highlighter when rendition is ready (TTS Phase: Sentence Sync)
  useEffect(() => {
    if (rendition && !highlighterRef.current) {
      highlighterRef.current = new SentenceHighlighter(rendition);
      console.log('[TTS Sentence Sync] Highlighter initialized');
    }
  }, [rendition]);

  // Wrap sentences when data is loaded (TTS Phase: Sentence Sync)
  useEffect(() => {
    if (highlighterRef.current && sentenceSyncData && currentAudioChapter) {
      highlighterRef.current.wrapSentences(sentenceSyncData.sentences);
    }
  }, [sentenceSyncData, currentAudioChapter]);

  // Progressive audio state (Phase 4)
  const [isProgressiveAudio, setIsProgressiveAudio] = useState(false);

  // Common audio callbacks
  const handleAudioTimeUpdate = useCallback(async (currentTime: number, duration: number) => {
    // TTS Phase 4: Sync audio → reading position (every 5 seconds to avoid excessive updates)
    const now = Date.now();
    if (syncEnabled && currentAudioChapter && book && now - lastSyncTimeRef.current > 5000) {
      const cfi = await timestampToCFI(book, currentAudioChapter, currentTime, duration);
      if (cfi && goToLocation) {
        goToLocation(cfi);
        lastSyncTimeRef.current = now;
      }
    }
  }, [syncEnabled, currentAudioChapter, book, goToLocation]);

  const handleAudioEnded = useCallback(() => {
    setCurrentAudioChapter(null);
    trackListeningTime(false); // Stop tracking listening time
  }, [trackListeningTime]);

  // Smart player selection: use progressive player for chunk-based audio, standard for single-blob
  const standardAudioPlayer = useAudioPlayer({
    chapter: !isProgressiveAudio ? currentAudioChapter : null,
    onTimeUpdate: handleAudioTimeUpdate,
    onEnded: handleAudioEnded,
  });

  const progressiveAudioPlayer = useProgressiveAudioPlayer({
    chapter: isProgressiveAudio ? currentAudioChapter : null,
    onTimeUpdate: handleAudioTimeUpdate,
    onEnded: handleAudioEnded,
  });

  // Use the appropriate player based on audio type
  const audioPlayer = isProgressiveAudio ? progressiveAudioPlayer : standardAudioPlayer;

  // Phase 4: Auto-play progressive audio after first chunk loads
  useEffect(() => {
    if (isProgressiveAudio && progressiveAudioPlayer.chunksLoaded === 1 && !progressiveAudioPlayer.playing && !progressiveAudioPlayer.loading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ReaderView Phase 4] Auto-playing progressive audio after first chunk loaded');
      }
      progressiveAudioPlayer.play();
    }
  }, [isProgressiveAudio, progressiveAudioPlayer.chunksLoaded, progressiveAudioPlayer.playing, progressiveAudioPlayer.loading]);

  // Audio generation (TTS Phase 3) - Support multiple concurrent generations
  const audioGeneration = useAudioGeneration({ book });
  const [generatingChapters, setGeneratingChapters] = useState<Map<number, { progress: number; message?: string }>>(new Map());

  // Track listening time when audio plays/pauses (TTS Phase 4)
  useEffect(() => {
    trackListeningTime(audioPlayer.playing);
  }, [audioPlayer.playing, trackListeningTime]);

  // Use sentence sync hook to track current sentence (TTS Phase: Sentence Sync)
  const { currentSentenceIndex } = useSentenceSync({
    sentences: sentenceSyncData?.sentences || null,
    currentTime: audioPlayer.currentTime,
    playing: audioPlayer.playing,
    onSentenceChange: (index) => {
      if (highlighterRef.current && sentenceSyncData) {
        highlighterRef.current.highlightSentence(index, sentenceSyncData.sentences);
      }
    },
  });

  // Clear highlight when audio stops (TTS Phase: Sentence Sync)
  useEffect(() => {
    if (!audioPlayer.playing && highlighterRef.current) {
      highlighterRef.current.clearHighlight();
    }
  }, [audioPlayer.playing]);

  // TTS Phase 4: Sync reading → audio position when user navigates
  const syncReadingToAudio = useCallback(async () => {
    if (!syncEnabled || !currentAudioChapter || !book || !currentLocation) return;

    // Prevent concurrent sync operations - CRITICAL FIX
    if (syncInProgressRef.current) {
      console.log('[ReaderView] Sync already in progress, skipping');
      return;
    }

    syncInProgressRef.current = true;

    try {
      // Check if current reading position is in current audio chapter
      const currentChapter = findChapterByCFI(book, chapters, currentLocation);

      if (currentChapter?.id === currentAudioChapter.id) {
        // Same chapter - sync timestamp
        const timestamp = await cfiToTimestamp(book, currentAudioChapter, currentLocation, audioPlayer.duration);
        if (timestamp !== null) {
          audioPlayer.seek(timestamp);
        }
      } else if (currentChapter?.id) {
        // Different chapter - check if it has audio and switch if available
        const audioFile = await getAudioFile(currentChapter.id);
        if (audioFile) {
          setCurrentAudioChapter(currentChapter);
        } else {
          // Chapter has no audio, pause playback
          audioPlayer.pause();
        }
      }
    } catch (error) {
      console.error('[ReaderView] Error during audio sync:', error);
    } finally {
      // Always reset the flag, even if error occurs
      syncInProgressRef.current = false;
    }
  }, [syncEnabled, currentAudioChapter, book, currentLocation, chapters, audioPlayer]);

  // Sync when user navigates pages while audio is playing
  useEffect(() => {
    // Only sync if audio is actually playing AND sync is enabled AND there's an audio chapter
    if (audioPlayer.playing && syncEnabled && currentAudioChapter && currentLocation) {
      syncReadingToAudio();
    }
  }, [currentLocation, syncReadingToAudio, audioPlayer.playing, syncEnabled, currentAudioChapter]);

  // Auto-hide controls after configured delay
  useEffect(() => {
    if (!showControls) return;

    const timeout = setTimeout(() => {
      setShowControls(false);
    }, UI_CONSTANTS.controlsAutoHideDelay);

    return () => clearTimeout(timeout);
  }, [showControls, setShowControls]);

  // Show controls on mouse movement near top of screen (desktop UX)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Show controls when mouse moves to top 15% of screen
      const topThreshold = window.innerHeight * 0.15;
      if (e.clientY < topThreshold && !showControls) {
        setShowControls(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [showControls, setShowControls]);

  // Handle Escape key to close settings panel
  useEffect(() => {
    if (!showSettings) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-500">Loading book...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary level="feature">
      <div className="relative h-screen w-screen overflow-hidden">
        {/* Controls Bar - Toggleable on all devices */}
      <div
        className={`
          absolute top-0 left-0 right-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700
          transition-transform duration-300
          ${showControls ? 'translate-y-0' : '-translate-y-full'}
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              ← Library
            </a>

            <div className="flex items-center gap-2 md:gap-4">
              {/* AI Recap Button - Icon only on mobile */}
              <button
                onClick={() => setShowAiRecap(true)}
                className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 rounded transition-colors border border-sky-200 dark:border-sky-800"
                title="AI Recap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                <span className="hidden md:inline">AI Recap</span>
              </button>

              {/* AI Chapter Summary Button - Icon only on mobile */}
              <button
                onClick={() => setShowAiChapterSummary(true)}
                className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 rounded transition-colors border border-sky-200 dark:border-sky-800"
                title="Summarize Chapter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <span className="hidden md:inline">Summarize</span>
              </button>

              {/* Hide on mobile - access via menu */}
              <a
                href="/highlights"
                className="hidden md:inline text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Highlights
              </a>

              {/* Chapters Button (TTS Phase 3) */}
              <button
                onClick={() => setShowChapterList(!showChapterList)}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <span className="hidden md:inline">Chapters</span>
                <span className="md:hidden">📑</span>
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Settings"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Drawer */}
      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} bookId={bookId} />

      {/* Chapter List Modal (TTS Phase 3) */}
      {showChapterList && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowChapterList(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-full md:w-80 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Chapters</h2>
              <button
                onClick={() => setShowChapterList(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Close chapters list"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ChapterList
              chapters={chapters}
              currentChapter={currentAudioChapter}
              voice={audioSettings?.voice || 'alloy'}
              onChapterSelect={(chapter) => {
                // Navigate to chapter in reader
                console.log('[ReaderView] Chapter select clicked:', {
                  title: chapter.title,
                  cfiStart: chapter.cfiStart,
                  cfiEnd: chapter.cfiEnd
                });
                if (goToLocation && chapter.cfiStart) {
                  try {
                    goToLocation(chapter.cfiStart);
                    setShowChapterList(false);
                  } catch (error) {
                    console.error('[ReaderView] Navigation error:', error);
                  }
                }
              }}
              onGenerateAudio={async (chapter) => {
                if (!chapter.id) return;

                try {
                  // Add chapter to generating map
                  setGeneratingChapters(prev => new Map(prev).set(chapter.id!, { progress: 0 }));

                  const result = await audioGeneration.generateAudio({
                    chapter,
                    voice: audioSettings?.voice || 'alloy',
                    speed: audioSettings?.playbackSpeed || 1.0,
                    onProgress: (progress, message) => {
                      setGeneratingChapters(prev => {
                        const next = new Map(prev);
                        next.set(chapter.id!, { progress, message });
                        return next;
                      });
                    },
                    // Phase 4: Auto-play after first chunk ready
                    onFirstChunkReady: async (chapterId, audioFileId) => {
                      if (process.env.NODE_ENV === 'development') {
                        console.log('[ReaderView Phase 4] First chunk ready, starting progressive playback', {
                          chapterId,
                          audioFileId,
                        });
                      }

                      // Switch to progressive player
                      setIsProgressiveAudio(true);

                      // Set current audio chapter to trigger progressive player load
                      setCurrentAudioChapter(chapter);

                      // Navigate to chapter if not already there
                      if (goToLocation && chapter.cfiStart) {
                        goToLocation(chapter.cfiStart);
                      }
                    },
                  });

                  if (result) {
                    console.log('[TTS Phase 3] Audio generated successfully:', result);
                  }
                } catch (error) {
                  console.error('[TTS Phase 3] Audio generation error:', error);
                  // Reset progressive flag on error to prevent wrong player selection on retry
                  setIsProgressiveAudio(false);
                } finally {
                  // Always cleanup, even on error - CRITICAL FIX
                  setGeneratingChapters(prev => {
                    const next = new Map(prev);
                    next.delete(chapter.id!);
                    return next;
                  });
                }
              }}
              onPlayAudio={async (chapter) => {
                console.log('[ReaderView] Play audio clicked for chapter:', {
                  title: chapter.title,
                  cfiStart: chapter.cfiStart,
                  hasGoToLocation: !!goToLocation,
                  hasBook: !!book
                });

                // Phase 4: Detect if audio is progressive or single-blob
                if (chapter.id) {
                  const audioFile = await getAudioFile(chapter.id);
                  if (audioFile) {
                    // Use flushSync to ensure state update happens before setCurrentAudioChapter
                    flushSync(() => {
                      setIsProgressiveAudio(audioFile.isProgressive || false);
                    });
                    if (process.env.NODE_ENV === 'development') {
                      console.log('[ReaderView Phase 4] Audio type:', audioFile.isProgressive ? 'progressive' : 'single-blob');
                    }
                  }
                }

                setCurrentAudioChapter(chapter);

                // Navigate to the chapter when playing audio (same as onChapterSelect)
                if (goToLocation && chapter.cfiStart) {
                  console.log('[ReaderView] Calling goToLocation with:', chapter.cfiStart);
                  goToLocation(chapter.cfiStart);
                }

                setShowChapterList(false);
              }}
              generatingChapters={generatingChapters}
            />
          </div>
        </>
      )}

      {/* Highlight Menu */}
      {currentSelection && (
        <HighlightMenu
          selectedText={currentSelection.text}
          position={currentSelection.position}
          onHighlight={(color: HighlightColor) => createHighlight(color)}
          onAddNote={() => setShowNoteEditor(true)}
          onExplain={() => {
            setAiExplanationData({
              text: currentSelection.text,
              position: currentSelection.position,
            });
            setShowAiExplanation(true);
          }}
          onClose={() => setCurrentSelection(null)}
        />
      )}

      {/* Note Editor */}
      {showNoteEditor && currentSelection && (
        <NoteEditor
          highlightText={currentSelection.text}
          onSave={async (note) => {
            // Create highlight with note
            const highlightId = await createHighlight('yellow');
            if (highlightId) {
              await updateNote(highlightId, note);
            }
            setShowNoteEditor(false);
            setCurrentSelection(null);
          }}
          onCancel={() => {
            setShowNoteEditor(false);
          }}
        />
      )}

      {/* Edit existing highlight note */}
      {editingNote && !showNoteEditor && (
        <NoteEditor
          initialNote={editingNote.note}
          highlightText={editingNote.text}
          onSave={(note) => updateNote(editingNote.id!, note)}
          onCancel={() => setEditingNote(null)}
        />
      )}

      {/* Audio Player (TTS Phase 3, Phase 4: Progressive Streaming) */}
      {currentAudioChapter && (
        <AudioPlayer
          chapter={currentAudioChapter}
          playing={audioPlayer.playing}
          currentTime={audioPlayer.currentTime}
          duration={audioPlayer.duration}
          playbackSpeed={audioPlayer.playbackSpeed}
          loading={audioPlayer.loading}
          onPlay={audioPlayer.play}
          onPause={audioPlayer.pause}
          onSeek={audioPlayer.seek}
          onSpeedChange={audioPlayer.setSpeed}
          onClose={() => {
            setCurrentAudioChapter(null);
            setIsProgressiveAudio(false); // Reset progressive state on close
          }}
          syncEnabled={syncEnabled}
          onToggleSync={() => setSyncEnabled(!syncEnabled)}
          isProgressive={isProgressiveAudio}
          chunksLoaded={isProgressiveAudio ? progressiveAudioPlayer.chunksLoaded : 0}
          totalChunks={isProgressiveAudio ? progressiveAudioPlayer.totalChunks : 0}
          currentPlayingChunk={isProgressiveAudio ? progressiveAudioPlayer.currentPlayingChunk : 0}
          isGenerating={isProgressiveAudio ? progressiveAudioPlayer.isGenerating : false}
          error={audioPlayer.error || null}
        />
      )}

      {/* Progress Indicators (Phase 3) */}
      <ProgressIndicators
        progress={progress}
        pagesRemaining={stats.pagesRemaining}
        timeRemaining={stats.timeRemaining}
        showControls={showControls}
      />

      {/* AI Recap (Phase 4) */}
      <AiRecap
        isOpen={showAiRecap}
        onClose={() => setShowAiRecap(false)}
        sessionData={{
          pagesRead,
          timeReadMinutes: Math.floor((Date.now() - sessionStartTime.getTime()) / 60000),
          bookGenre: 'fiction', // Mock - would be inferred from book metadata
        }}
      />

      {/* AI Explanation (Phase 4) */}
      {showAiExplanation && aiExplanationData && (
        <AiExplanation
          selectedText={aiExplanationData.text}
          position={aiExplanationData.position}
          onClose={() => {
            setShowAiExplanation(false);
            setAiExplanationData(null);
            setCurrentSelection(null);
          }}
          onSaveToNote={async (explanation) => {
            // Create highlight with explanation as note
            const highlightId = await createHighlight('yellow');
            if (highlightId) {
              await updateNote(highlightId, explanation);
            }
          }}
        />
      )}

      {/* AI Chapter Summary (Phase 4) */}
      <AiChapterSummary
        isOpen={showAiChapterSummary}
        onClose={() => setShowAiChapterSummary(false)}
        chapterData={{
          title: 'Current Chapter', // Mock - would come from EPUB metadata
          number: 1,
          wordCount: 3000,
        }}
      />

        {/* Reader Container */}
        <TapZones onPrevPage={prevPage} onNextPage={nextPage} onToggleControls={toggleControls}>
          <div ref={containerRef} className="epub-container h-full w-full" />
        </TapZones>
      </div>
    </ErrorBoundary>
  );
}

export default function ReaderView(props: ReaderViewProps) {
  return <ReaderViewContent {...props} />;
}
