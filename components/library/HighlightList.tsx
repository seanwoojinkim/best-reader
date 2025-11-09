'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllHighlights, getBook, deleteHighlight } from '@/lib/db';
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/lib/constants';
import type { Highlight, Book } from '@/types';

interface HighlightWithBook extends Highlight {
  bookTitle?: string;
}

export default function HighlightList() {
  const router = useRouter();
  const [highlights, setHighlights] = useState<HighlightWithBook[]>([]);
  const [filteredHighlights, setFilteredHighlights] = useState<HighlightWithBook[]>([]);
  const [selectedColor, setSelectedColor] = useState<HighlightColor | 'all'>('all');
  const [loading, setLoading] = useState(true);

  // Load all highlights with book titles
  useEffect(() => {
    const loadHighlights = async () => {
      setLoading(true);
      const allHighlights = await getAllHighlights();

      // Fetch book titles for each highlight
      const highlightsWithBooks = await Promise.all(
        allHighlights.map(async (highlight) => {
          const book = await getBook(highlight.bookId);
          return {
            ...highlight,
            bookTitle: book?.title,
          };
        })
      );

      setHighlights(highlightsWithBooks);
      setFilteredHighlights(highlightsWithBooks);
      setLoading(false);
    };

    loadHighlights();
  }, []);

  // Filter highlights by color
  useEffect(() => {
    if (selectedColor === 'all') {
      setFilteredHighlights(highlights);
    } else {
      setFilteredHighlights(highlights.filter((h) => h.color === selectedColor));
    }
  }, [selectedColor, highlights]);

  const handleDelete = async (id: number) => {
    if (confirm('Delete this highlight?')) {
      await deleteHighlight(id);
      const updated = highlights.filter((h) => h.id !== id);
      setHighlights(updated);
    }
  };

  const handleJumpTo = (highlight: Highlight) => {
    // Navigate to book at highlight location using Next.js router
    router.push(`/reader/${highlight.bookId}?cfi=${encodeURIComponent(highlight.cfiRange)}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading highlights...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-serif font-bold mb-4">Your Highlights</h2>

        {/* Color filter */}
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
          <button
            onClick={() => setSelectedColor('all')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedColor === 'all'
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {Object.entries(HIGHLIGHT_COLORS).map(([color, hex]) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color as HighlightColor)}
              className={`px-3 py-1 rounded text-sm font-medium border-2 transition-all ${
                selectedColor === color
                  ? 'border-gray-900 dark:border-gray-100 scale-110'
                  : 'border-gray-300 dark:border-gray-600 hover:scale-105'
              }`}
              style={{ backgroundColor: hex }}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      {/* Highlights list */}
      {filteredHighlights.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            {selectedColor === 'all' ? 'No highlights yet' : `No ${selectedColor} highlights`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHighlights.map((highlight) => (
            <div
              key={highlight.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: HIGHLIGHT_COLORS[highlight.color],
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {highlight.bookTitle || 'Unknown Book'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(highlight.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: HIGHLIGHT_COLORS[highlight.color] }}
                />
              </div>

              <blockquote className="text-gray-700 dark:text-gray-300 italic my-3 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                &ldquo;{highlight.text}&rdquo;
              </blockquote>

              {highlight.note && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400">
                  <strong className="text-gray-900 dark:text-gray-100">Note: </strong>
                  {highlight.note}
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleJumpTo(highlight)}
                  className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  Jump to location
                </button>
                <button
                  onClick={() => handleDelete(highlight.id!)}
                  className="px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
