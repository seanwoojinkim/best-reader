'use client';

import React from 'react';
import type { AnnaSearchResult } from '@/types/annas-archive';

interface SearchResultCardProps {
  book: AnnaSearchResult;
  onDownload: (book: AnnaSearchResult) => void;
  isDownloading: boolean;
  downloadStatus?: string;
}

export default function SearchResultCard({
  book,
  onDownload,
  isDownloading,
  downloadStatus,
}: SearchResultCardProps) {
  const isEpub = book.format.toLowerCase() === 'epub';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 line-clamp-2">
        {book.title}
      </h3>

      {book.authors && book.authors !== 'Unknown Author' && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
          {book.authors}
        </p>
      )}

      {book.publisher && book.publisher !== 'Unknown Publisher' && (
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-1">
          {book.publisher}
        </p>
      )}

      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className={`px-2 py-1 rounded font-semibold ${
          isEpub
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}>
          {book.format.toUpperCase()}
        </span>
        <span>{book.size}</span>
        <span>{book.language}</span>
      </div>

      <button
        onClick={() => onDownload(book)}
        disabled={isDownloading || !isEpub}
        className={`mt-4 w-full px-4 py-2 rounded-lg transition-colors ${
          !isEpub
            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : isDownloading
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {!isEpub ? (
          'EPUB Only'
        ) : isDownloading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {downloadStatus || 'Downloading...'}
          </span>
        ) : (
          'Download to Library'
        )}
      </button>
    </div>
  );
}
