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

  // Initialize audio element - only create once, never recreate
  useEffect(() => {
    console.log('[useAudioPlayer] Initializing audio element');
    const audio = new Audio();
    audioRef.current = audio;

    // Event listeners
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime, audio.duration);
    };

    const handleLoadedMetadata = () => {
      console.log('[useAudioPlayer] loadedmetadata event fired, duration:', audio.duration, 'src:', audio.src);
      setDuration(audio.duration);
      setLoading(false);
    };

    const handleEnded = () => {
      setPlaying(false);
      onEnded?.();
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

      console.log('[useAudioPlayer] Audio blob size:', audioFile.blob.size, 'type:', audioFile.blob.type);

      // Revoke previous object URL to prevent memory leak
      if (currentObjectUrlRef.current) {
        console.log('[useAudioPlayer] Revoking previous object URL:', currentObjectUrlRef.current);
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
      }

      // Create object URL from blob
      const audioUrl = URL.createObjectURL(audioFile.blob);
      currentObjectUrlRef.current = audioUrl; // Store for later cleanup
      console.log('[useAudioPlayer] Object URL created:', audioUrl);

      // Pause current playback before loading new audio
      audioRef.current.pause();
      audioRef.current.src = audioUrl;
      audioRef.current.playbackRate = playbackSpeed;

      console.log('[useAudioPlayer] Audio src set, calling load()');

      // Wait for audio to load before marking as ready
      audioRef.current.load();

      // Don't revoke the object URL immediately - the audio element needs it!
      // It will be cleaned up when the component unmounts or a new chapter loads
    } catch (err) {
      console.error('[useAudioPlayer] Error loading chapter audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setLoading(false);
    }
  }, [playbackSpeed]);

  // Auto-load chapter when it changes
  useEffect(() => {
    if (chapter) {
      loadChapter(chapter);
    }
  }, [chapter, loadChapter]);

  const play = useCallback(() => {
    console.log('[useAudioPlayer] Play called', { hasAudio: !!audioRef.current, loading, src: audioRef.current?.src });

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
          if (err.name !== 'AbortError') {
            console.error('[useAudioPlayer] Audio play error:', err);
            setError('Failed to play audio');
          }
          setPlaying(false);
        });
    }
  }, [loading]);

  const pause = useCallback(() => {
    if (audioRef.current) {
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
  };
}
