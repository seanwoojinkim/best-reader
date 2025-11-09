'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSettingsStore } from '@/stores/settingsStore';
import { savePosition } from '@/lib/db';
import { useEpubReader } from '@/hooks/useEpubReader';
import { useHighlights } from '@/hooks/useHighlights';
import { useSession } from '@/hooks/useSession';
import { useReadingStats } from '@/hooks/useReadingStats';
import { UI_CONSTANTS } from '@/lib/constants';
import type { HighlightColor } from '@/lib/constants';
import TapZones from './TapZones';
import SettingsDrawer from './SettingsDrawer';
import HighlightMenu from './HighlightMenu';
import NoteEditor from './NoteEditor';
import ProgressIndicators from './ProgressIndicators';
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

  // Session tracking (Phase 3: now includes analytics)
  const { sessionId, pagesRead, sessionStartTime, trackPageTurn } = useSession({
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
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Controls Bar */}
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

            <div className="flex items-center gap-4">
              {/* AI Recap Button */}
              <button
                onClick={() => setShowAiRecap(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 rounded transition-colors border border-sky-200 dark:border-sky-800"
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
                AI Recap
              </button>

              {/* AI Chapter Summary Button */}
              <button
                onClick={() => setShowAiChapterSummary(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 rounded transition-colors border border-sky-200 dark:border-sky-800"
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
                Summarize
              </button>

              <a
                href="/highlights"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Highlights
              </a>
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
      <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} />

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
  );
}

export default function ReaderView(props: ReaderViewProps) {
  return <ReaderViewContent {...props} />;
}
