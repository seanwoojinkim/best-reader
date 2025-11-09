'use client';

import React from 'react';
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/lib/constants';

interface HighlightMenuProps {
  selectedText: string;
  position: { x: number; y: number };
  onHighlight: (color: HighlightColor) => void;
  onAddNote: () => void;
  onExplain?: () => void;
  onClose: () => void;
}

export default function HighlightMenu({
  selectedText,
  position,
  onHighlight,
  onAddNote,
  onExplain,
  onClose,
}: HighlightMenuProps) {
  const handleHighlight = (color: HighlightColor) => {
    onHighlight(color);
    onClose();
  };

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-label="Close highlight menu"
      />

      {/* Menu */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -100%) translateY(-8px)',
        }}
      >
        <div className="flex flex-col gap-2">
          {/* Color buttons */}
          <div className="flex gap-2">
            {Object.entries(HIGHLIGHT_COLORS).map(([color, hex]) => (
              <button
                key={color}
                onClick={() => handleHighlight(color as HighlightColor)}
                className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                style={{ backgroundColor: hex }}
                aria-label={`Highlight in ${color}`}
                title={`Highlight in ${color}`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                onAddNote();
                onClose();
              }}
              className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Add Note
            </button>
            {onExplain && (
              <button
                onClick={() => {
                  onExplain();
                  onClose();
                }}
                className="flex-1 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 rounded transition-colors border border-sky-200 dark:border-sky-800"
                title="AI Explanation"
              >
                <span className="flex items-center justify-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                  Explain
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Selected text preview */}
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic max-w-xs truncate">
            &ldquo;{selectedText}&rdquo;
          </p>
        </div>
      </div>
    </>
  );
}
