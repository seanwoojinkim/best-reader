import { useState, useEffect, useRef, useCallback } from 'react';
import type { Chapter, AudioFile } from '@/types';
import { getAudioFile } from '@/lib/db';

interface UseAudioPlayerProps {
  chapter: Chapter | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

interface UseAudioPlayerResult {
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  loading: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  loadChapter: (chapter: Chapter) => Promise<void>;
  prepareAutoPlay: (chapterId: number) => void;
}

export function useAudioPlayer({
  chapter,
  onTimeUpdate,
  onEnded,
}: UseAudioPlayerProps): UseAudioPlayerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const loadedChapterIdRef = useRef<number | undefined>(undefined);

  // Store latest callbacks in refs to avoid stale closures in event listeners
  const onEndedRef = useRef(onEnded);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const autoPlayChapterIdRef = useRef<number | undefined>(undefined); // Chapter ID for auto-advance playback

  // Update refs when callbacks change
  useEffect(() => {
    onEndedRef.current = onEnded;
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onEnded, onTimeUpdate]);

  // Initialize audio element - only create once, never recreate
  useEffect(() => {
    console.log('[useAudioPlayer] Initializing audio element');
    const audio = new Audio();
    audioRef.current = audio;

    // Event listeners
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdateRef.current?.(audio.currentTime, audio.duration);
    };

    const handleLoadedMetadata = () => {
      console.log('[useAudioPlayer] loadedmetadata event fired, duration:', audio.duration, 'src:', audio.src);
      console.log('[useAudioPlayer] Audio readyState:', audio.readyState);
      console.log('[useAudioPlayer] Audio networkState:', audio.networkState);
      setDuration(audio.duration);
      setLoading(false);
    };

    const handleEnded = () => {
      console.log('[useAudioPlayer] Audio ended, setting playing to false');
      setPlaying(false);
      onEndedRef.current?.();
    };

    const handleError = (e: ErrorEvent) => {
      console.error('Audio playback error:', e);
      setError('Failed to play audio');
      setLoading(false);
      setPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError as any);

    return () => {
      console.log('[useAudioPlayer] Cleaning up audio element');
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError as any);
      audio.pause();
      // Don't clear src here - keep it for potential reuse
      // audio.src = '';
    };
  }, []);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      console.log('[useAudioPlayer] Component unmounting, cleaning up object URL');
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }
    };
  }, []);

  // Load chapter audio
  const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
    if (!chapterToLoad.id || !audioRef.current) {
      console.log('[useAudioPlayer] loadChapter: Invalid chapter or audio ref');
      return;
    }

    console.log('[useAudioPlayer] Loading chapter audio:', chapterToLoad.title, chapterToLoad.id);
    setLoading(true);
    setError(null);
    setPlaying(false);

    try {
      const audioFile = await getAudioFile(chapterToLoad.id);
      console.log('[useAudioPlayer] Audio file from DB:', audioFile ? 'found' : 'not found');

      if (!audioFile) {
        throw new Error('Audio not generated for this chapter');
      }

      console.log('[useAudioPlayer] Audio file data:', {
        hasBuffer: !!audioFile.buffer,
        bufferSize: audioFile.buffer?.byteLength,
        hasBlob: !!audioFile.blob,
        blobSize: audioFile.blob?.size,
        blobType: audioFile.blob?.type
      });

      // Store reference to old URL for delayed cleanup (prevent premature revocation)
      const oldObjectUrl = currentObjectUrlRef.current;

      // Prefer ArrayBuffer (iOS compatible) over Blob (may be invalid on iOS)
      let audioBlob: Blob;
      if (audioFile.buffer) {
        console.log('[useAudioPlayer] Using ArrayBuffer to create fresh Blob for iOS compatibility');
        audioBlob = new Blob([audioFile.buffer], { type: 'audio/mpeg' });
      } else {
        console.log('[useAudioPlayer] No ArrayBuffer, falling back to stored Blob (may fail on iOS)');
        audioBlob = audioFile.blob;
      }

      // Create object URL from blob
      const audioUrl = URL.createObjectURL(audioBlob);
      currentObjectUrlRef.current = audioUrl; // Store for later cleanup
      console.log('[useAudioPlayer] Object URL created:', audioUrl);

      // Pause current playback before loading new audio
      audioRef.current.pause();
      audioRef.current.src = audioUrl;
      audioRef.current.playbackRate = playbackSpeed;

      console.log('[useAudioPlayer] Audio src set, calling load()');
      console.log('[useAudioPlayer] Audio element state before load:', {
        src: audioRef.current.src,
        readyState: audioRef.current.readyState,
        networkState: audioRef.current.networkState
      });

      // Wait for audio to load before marking as ready
      audioRef.current.load();

      console.log('[useAudioPlayer] load() called, waiting for loadedmetadata event...');

      // Revoke old URL after new one is set - delay to ensure audio element fully loads
      if (oldObjectUrl) {
        setTimeout(() => {
          console.log('[useAudioPlayer] Revoking old object URL after new chapter loaded:', oldObjectUrl);
          URL.revokeObjectURL(oldObjectUrl);
        }, 1000);
      }
    } catch (err) {
      console.error('[useAudioPlayer] Error loading chapter audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setLoading(false);
    }
  }, []); // Speed changes handled by setSpeed() directly, no reload needed

  // Auto-load chapter when it changes (compare by ID to avoid reloading on reference changes)
  useEffect(() => {
    if (chapter && chapter.id !== loadedChapterIdRef.current) {
      const expectedChapterId = autoPlayChapterIdRef.current;
      console.log('[useAudioPlayer] Chapter changing, expectedChapterId for auto-play:', expectedChapterId, 'new chapter ID:', chapter.id);
      loadedChapterIdRef.current = chapter.id;

      loadChapter(chapter).then(() => {
        // Auto-resume only if this is the expected chapter (prevents race condition)
        console.log('[useAudioPlayer] Chapter loaded, checking auto-resume. expectedChapterId:', expectedChapterId, 'loaded chapter ID:', chapter.id, 'hasAudio:', !!audioRef.current);
        if (expectedChapterId === chapter.id && audioRef.current) {
          console.log('[useAudioPlayer] Auto-resuming playback after chapter change');
          autoPlayChapterIdRef.current = undefined; // Reset flag after use
          audioRef.current.play()
            .then(() => {
              console.log('[useAudioPlayer] Auto-resume successful');
              setPlaying(true); // Ensure state syncs
            })
            .catch(err => {
              console.error('[useAudioPlayer] Auto-resume failed (iOS may block):', err);
              setPlaying(false); // Ensure state syncs on error
            });
        } else {
          console.log('[useAudioPlayer] Not auto-resuming:', { expectedChapterId, loadedChapterId: chapter.id, hasAudio: !!audioRef.current });
          if (expectedChapterId !== undefined) {
            autoPlayChapterIdRef.current = undefined; // Reset flag even if chapter doesn't match
          }
        }
      });
    }
  }, [chapter, loadChapter]);

  const play = useCallback(() => {
    console.log('[useAudioPlayer] Play called', {
      hasAudio: !!audioRef.current,
      loading,
      src: audioRef.current?.src,
      readyState: audioRef.current?.readyState,
      networkState: audioRef.current?.networkState,
      paused: audioRef.current?.paused,
      duration: audioRef.current?.duration
    });

    if (!audioRef.current) {
      console.error('[useAudioPlayer] No audio element');
      return;
    }

    if (loading) {
      console.log('[useAudioPlayer] Still loading, cannot play yet');
      return;
    }

    if (!audioRef.current.src) {
      console.error('[useAudioPlayer] No audio source loaded');
      setError('No audio loaded');
      return;
    }

    console.log('[useAudioPlayer] Calling play() on audio element...');
    const playPromise = audioRef.current.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[useAudioPlayer] Playback started successfully');
          setPlaying(true);
          setError(null);
        })
        .catch((err) => {
          // Handle play() errors gracefully
          console.error('[useAudioPlayer] Audio play error:', {
            name: err.name,
            message: err.message,
            code: err.code,
            stack: err.stack
          });
          if (err.name !== 'AbortError') {
            setError('Failed to play audio: ' + err.message);
          }
          setPlaying(false);
        });
    } else {
      console.log('[useAudioPlayer] play() returned undefined (old browsers)');
    }
  }, [loading]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      console.log('[useAudioPlayer] Pause called, setting playing to false');
      audioRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  }, [duration]);

  const setSpeed = useCallback((speed: number) => {
    const validSpeed = Math.max(0.25, Math.min(4.0, speed));
    setPlaybackSpeed(validSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = validSpeed;
    }
  }, []);

  const prepareAutoPlay = useCallback((chapterId: number) => {
    console.log('[useAudioPlayer] prepareAutoPlay called for chapter ID:', chapterId);
    autoPlayChapterIdRef.current = chapterId;
  }, []);

  return {
    playing,
    currentTime,
    duration,
    playbackSpeed,
    loading,
    error,
    play,
    pause,
    seek,
    setSpeed,
    loadChapter,
    prepareAutoPlay,
  };
}
