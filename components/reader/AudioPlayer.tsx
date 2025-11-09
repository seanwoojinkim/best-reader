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
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
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

        <div className="flex items-center justify-between">
          {/* Left: Chapter Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
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

          {/* Center: Playback Controls */}
          <div className="flex items-center gap-4">
            {/* Speed Control */}
            <button
              onClick={cycleSpeed}
              className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={`Playback speed: ${playbackSpeed}x`}
            >
              {playbackSpeed}x
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
          </div>

          {/* Right: Spacer for symmetry */}
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
