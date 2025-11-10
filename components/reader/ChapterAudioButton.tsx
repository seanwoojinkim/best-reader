'use client';

import React, { useState, useEffect } from 'react';
import type { Chapter, OpenAIVoice } from '@/types';
import { getAudioFile } from '@/lib/db';
import { calculateTTSCost, formatCost } from '@/lib/epub-utils';

interface ChapterAudioButtonProps {
  chapter: Chapter;
  voice: OpenAIVoice;
  onGenerate: () => void;
  onPlay: () => void;
  generating: boolean;
  progress: number; // 0-100
  message?: string;
}

export default function ChapterAudioButton({
  chapter,
  voice,
  onGenerate,
  onPlay,
  generating,
  progress,
  message,
}: ChapterAudioButtonProps) {
  const [hasAudio, setHasAudio] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if audio exists for this chapter
  useEffect(() => {
    const checkAudio = async () => {
      if (!chapter.id) return;

      const audioFile = await getAudioFile(chapter.id);
      setHasAudio(!!audioFile);
      setLoading(false);
    };

    checkAudio();
  }, [chapter.id, progress]); // Re-check when generation completes

  const estimatedCost = calculateTTSCost(chapter.charCount);

  if (loading) {
    return (
      <button disabled className="px-3 py-1.5 text-sm text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
        Loading...
      </button>
    );
  }

  if (generating) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 rounded"
        title={message || `Generating audio: ${Math.round(progress)}%`}
      >
        {/* Spinner */}
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="whitespace-nowrap">
          {message ? (
            <span className="block max-w-[120px] truncate" title={message}>
              {message}
            </span>
          ) : (
            `Generating... ${Math.round(progress)}%`
          )}
        </span>
      </button>
    );
  }

  if (hasAudio) {
    return (
      <button
        onClick={onPlay}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 rounded transition-colors"
        aria-label="Play chapter audio"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        Play Audio
      </button>
    );
  }

  return (
    <button
      onClick={onGenerate}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 rounded transition-colors"
      title={`Generate audio with ${voice} voice`}
      aria-label={`Generate audio for ${chapter.title} (estimated cost: ${formatCost(estimatedCost)})`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        />
      </svg>
      Generate Audio ({formatCost(estimatedCost)})
    </button>
  );
}
