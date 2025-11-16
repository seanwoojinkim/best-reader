'use client';

import React, { useState } from 'react';
import type { Chapter } from '@/types';
import { formatDuration } from '@/lib/epub-utils';

interface AudioPlayerProps {
  chapter: Chapter | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  loading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
  syncEnabled?: boolean;
  onToggleSync?: () => void;
  // Reading progress (hybrid feature)
  readingProgress?: number; // 0-100
  pagesRemaining?: number;
  timeRemaining?: string;
  showControls?: boolean; // Visibility control
}

const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

export default function AudioPlayer({
  chapter,
  playing,
  currentTime,
  duration,
  playbackSpeed,
  loading,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  onClose,
  syncEnabled = true,
  onToggleSync,
  readingProgress,
  pagesRemaining,
  timeRemaining,
  showControls = true,
}: AudioPlayerProps) {
  const [seeking, setSeeking] = useState(false);
  const [tempSeekTime, setTempSeekTime] = useState(0);

  if (!chapter) return null;

  const displayTime = seeking ? tempSeekTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setSeeking(true);
    updateSeekTime(e);
  };

  const handleSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (seeking) {
      updateSeekTime(e);
    }
  };

  const handleSeekEnd = () => {
    if (seeking) {
      onSeek(tempSeekTime);
      setSeeking(false);
    }
  };

  const updateSeekTime = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, percent * duration));
    setTempSeekTime(time);
  };

  const cycleSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    onSpeedChange(PLAYBACK_SPEEDS[nextIndex]);
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg safe-area-bottom transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Progress Bar */}
        <div
          className="relative h-1 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer mb-3"
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseUp={handleSeekEnd}
          onMouseLeave={handleSeekEnd}
          role="slider"
          aria-label="Audio progress"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="absolute h-full bg-sky-600 dark:bg-sky-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
          {/* Seek Handle */}
          {duration > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-sky-600 dark:bg-sky-400 rounded-full shadow-md"
              style={{ left: `${progress}%`, marginLeft: '-6px' }}
            />
          )}
        </div>

        {/* Reading Progress Details (Hybrid Feature) */}
        {readingProgress !== undefined && pagesRemaining !== undefined && timeRemaining && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2 px-2">
            <span className="font-medium">{Math.round(readingProgress)}%</span>
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <span>{pagesRemaining === 1 ? '1 page left' : `${pagesRemaining} pages left`}</span>
            {pagesRemaining > 0 && (
              <>
                <span className="text-gray-400 dark:text-gray-600">•</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ~{timeRemaining}
                </span>
              </>
            )}
          </div>
        )}

        {/* Chapter Info - Full Width */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close audio player"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {chapter.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDuration(displayTime)} / {formatDuration(duration)}
            </p>
          </div>
        </div>

        {/* Playback Controls - Centered */}
        <div className="flex items-center justify-center gap-4">
            {/* Speed Control */}
            <button
              onClick={cycleSpeed}
              className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={`Playback speed: ${playbackSpeed}x`}
            >
              {playbackSpeed}x
            </button>

            {/* Sync Toggle (TTS Phase 4) */}
            {onToggleSync && (
              <button
                onClick={onToggleSync}
                className={`p-2 rounded transition-colors ${
                  syncEnabled
                    ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950'
                    : 'text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800'
                }`}
                title={syncEnabled ? 'Sync enabled: audio updates reading position' : 'Sync disabled'}
                aria-label={syncEnabled ? 'Disable sync' : 'Enable sync'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}

            {/* Skip Backward 10s */}
            <button
              onClick={() => onSeek(Math.max(0, currentTime - 10))}
              className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              aria-label="Skip backward 10 seconds"
              title="Skip backward 10 seconds"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/>
              </svg>
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={playing ? onPause : onPlay}
              disabled={loading}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {loading ? (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : playing ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip Forward 30s */}
            <button
              onClick={() => onSeek(Math.min(duration, currentTime + 30))}
              className="p-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              aria-label="Skip forward 30 seconds"
              title="Skip forward 30 seconds"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8zm-.86 10.77c0 .2.01.37.04.52s.08.27.15.37.17.18.27.23.24.08.39.08c.11 0 .21-.01.3-.03s.17-.06.24-.11.13-.12.18-.2.09-.18.11-.29l.23.05c-.02.21-.06.39-.13.55s-.16.3-.27.41-.24.19-.38.25-.3.08-.46.08c-.26 0-.49-.05-.68-.14s-.34-.23-.46-.42-.21-.42-.26-.7-.08-.61-.08-.99c0-.38.03-.71.08-.99s.14-.51.26-.7.28-.33.47-.42.42-.14.68-.14c.23 0 .44.04.64.12s.37.2.52.36.26.36.34.61.12.54.12.88h-.85c0-.23-.02-.43-.06-.59s-.1-.29-.17-.39-.16-.18-.26-.23-.21-.07-.33-.07c-.25 0-.45.09-.59.26s-.22.45-.24.84l.01.07h.02c.06-.17.18-.3.34-.4s.37-.15.61-.15c.2 0 .38.04.53.11s.28.18.38.32.18.29.23.48.08.39.08.61c0 .24-.03.46-.09.66s-.15.37-.27.52-.27.26-.45.34-.39.12-.64.12c-.18 0-.35-.03-.5-.08s-.29-.14-.4-.25-.2-.25-.27-.42-.1-.37-.1-.61c0-.12.01-.23.03-.33s.05-.2.09-.29.09-.16.15-.23.13-.12.21-.16v.86zm2.68-5.25h.02l.01-.04c.01-.04.02-.09.03-.13s.02-.09.03-.14.02-.09.02-.14v-.34c0-.14-.02-.25-.05-.34s-.08-.17-.14-.23-.13-.1-.21-.13-.17-.04-.27-.04c-.11 0-.21.02-.3.05s-.16.08-.22.15-.11.15-.14.25-.05.22-.05.36h-.85c0-.2.04-.39.11-.55s.17-.31.3-.43.28-.22.46-.29.37-.1.59-.10c.22 0 .42.03.6.1s.33.17.46.29.23.27.3.45.11.38.11.61c0 .16-.02.31-.05.45s-.08.27-.14.39-.13.23-.21.32-.17.18-.27.25c.15.12.27.28.37.48s.14.43.14.69c0 .24-.04.46-.12.65s-.19.36-.33.49-.31.24-.5.31-.40.11-.63.11c-.23 0-.44-.04-.63-.11s-.35-.18-.49-.32-.25-.31-.32-.51-.11-.43-.11-.69h.85c0 .15.02.28.05.39s.08.2.14.27.13.13.22.17.18.06.29.06c.12 0 .23-.02.32-.06s.17-.09.23-.17.11-.17.14-.28.05-.24.05-.38c0-.27-.06-.47-.18-.61s-.3-.2-.53-.2h-.35v-.68h.35c.09 0 .18-.01.25-.04s.14-.07.19-.12.09-.12.12-.2.04-.17.04-.28c0-.09-.01-.18-.04-.26s-.06-.15-.11-.21-.11-.1-.18-.13-.15-.05-.25-.05c-.09 0-.17.01-.25.04s-.14.07-.2.13-.1.13-.13.22-.05.19-.05.31h-.84c0-.21.04-.39.11-.56s.17-.31.29-.43.27-.21.44-.27.36-.09.57-.09z"/>
              </svg>
            </button>
        </div>
      </div>
    </div>
  );
}
