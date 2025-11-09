import React, { useEffect } from 'react';
import type { Session, Highlight } from '@/types';
import { formatRecapSummary } from '@/lib/analytics';

interface RecapModalProps {
  lastSession: Session;
  lastHighlight?: Highlight;
  bookTitle: string;
  onContinue: () => void;
}

/**
 * Recap modal shown when user returns after >15 minutes
 * Shows summary of last session and option to continue reading
 */
export default function RecapModal({ lastSession, lastHighlight, bookTitle, onContinue }: RecapModalProps) {
  const recap = formatRecapSummary(lastSession);

  // Handle Escape key to continue
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onContinue();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onContinue]);

  // Focus on continue button when modal opens
  useEffect(() => {
    const continueButton = document.getElementById('recap-continue-button');
    continueButton?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recap-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full p-6 animate-slideUp">
        {/* Header */}
        <div className="mb-6">
          <h2
            id="recap-title"
            className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-2"
          >
            Welcome back!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Here&apos;s where you left off in <span className="font-medium">{bookTitle}</span>
          </p>
        </div>

        {/* Session Summary */}
        <div className="space-y-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Last Session Summary
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Pages Read */}
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {recap.pagesRead}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {recap.pagesRead === 1 ? 'page read' : 'pages read'}
                </div>
              </div>

              {/* Time Spent */}
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {recap.timeSpent}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">time spent</div>
              </div>
            </div>

            {/* Reading Speed */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>{recap.readingSpeed}</span>
              </div>
            </div>
          </div>

          {/* Last Highlight (if any) */}
          {lastHighlight && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Your last highlight
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic line-clamp-3">
                &ldquo;{lastHighlight.text}&rdquo;
              </p>
              {lastHighlight.note && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  Note: {lastHighlight.note}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Continue Button */}
        <button
          id="recap-continue-button"
          onClick={onContinue}
          className="w-full py-3 px-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 dark:focus:ring-gray-100"
          autoFocus
        >
          Continue Reading
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-3">
          Press Enter or Escape to continue
        </p>
      </div>
    </div>
  );
}
