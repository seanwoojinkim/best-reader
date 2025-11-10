'use client';

import React from 'react';
import type { Chapter, OpenAIVoice } from '@/types';
import ChapterAudioButton from './ChapterAudioButton';

interface ChapterListProps {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  voice: OpenAIVoice;
  onChapterSelect: (chapter: Chapter) => void;
  onGenerateAudio: (chapter: Chapter) => void;
  onPlayAudio: (chapter: Chapter) => void;
  generatingChapters: Map<number, { progress: number; message?: string }>;
}

export default function ChapterList({
  chapters,
  currentChapter,
  voice,
  onChapterSelect,
  onGenerateAudio,
  onPlayAudio,
  generatingChapters,
}: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No chapters found
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {chapters.map((chapter) => (
        <div
          key={chapter.id}
          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
            currentChapter?.id === chapter.id ? 'bg-sky-50 dark:bg-sky-950' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Chapter Info */}
            <button
              onClick={() => onChapterSelect(chapter)}
              className="flex-1 text-left"
            >
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                {chapter.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {chapter.wordCount.toLocaleString()} words • ~
                {Math.ceil(chapter.wordCount / 150)} min audio
              </p>
            </button>

            {/* Audio Button */}
            <ChapterAudioButton
              chapter={chapter}
              voice={voice}
              onGenerate={() => onGenerateAudio(chapter)}
              onPlay={() => onPlayAudio(chapter)}
              generating={chapter.id ? generatingChapters.has(chapter.id) : false}
              progress={chapter.id ? generatingChapters.get(chapter.id)?.progress || 0 : 0}
              message={chapter.id ? generatingChapters.get(chapter.id)?.message : undefined}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
