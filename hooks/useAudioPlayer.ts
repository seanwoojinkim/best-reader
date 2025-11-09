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

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    // Event listeners
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime, audio.duration);
    };

    const handleLoadedMetadata = () => {
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
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError as any);
      audio.pause();
      audio.src = '';
    };
  }, [onTimeUpdate, onEnded]);

  // Load chapter audio
  const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
    if (!chapterToLoad.id || !audioRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const audioFile = await getAudioFile(chapterToLoad.id);

      if (!audioFile) {
        throw new Error('Audio not generated for this chapter');
      }

      // Create object URL from blob
      const audioUrl = URL.createObjectURL(audioFile.blob);
      audioRef.current.src = audioUrl;
      audioRef.current.playbackRate = playbackSpeed;

      // Clean up old object URL when new one is created
      audioRef.current.addEventListener('loadstart', () => {
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
      }, { once: true });
    } catch (err) {
      console.error('Error loading chapter audio:', err);
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
    if (audioRef.current && !loading) {
      audioRef.current.play();
      setPlaying(true);
      setError(null);
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
