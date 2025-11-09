'use client';

import React, { useEffect, useState } from 'react';
import { generateChapterSummary, type ChapterData } from '@/lib/mockAi';

interface AiChapterSummaryProps {
  isOpen: boolean;
  onClose: () => void;
  chapterData: ChapterData;
}

export default function AiChapterSummary({ isOpen, onClose, chapterData }: AiChapterSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate summary when component opens
  useEffect(() => {
    if (isOpen) {
      setIsGenerating(true);
      // Simulate API delay for realistic UX
      const timer = setTimeout(() => {
        const generated = generateChapterSummary(chapterData);
        setSummary(generated);
        setIsGenerating(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, chapterData]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={`
          fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 shadow-xl
          transform transition-transform duration-300 ease-out z-50
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-sky-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Chapter Summary
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close chapter summary"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* AI Badge */}
          <div className="px-6 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 text-xs font-medium rounded-full border border-sky-200 dark:border-sky-800">
              <svg
                className="w-4 h-4"
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
              <span>AI Generated Summary</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <svg
                  className="animate-spin h-12 w-12 text-sky-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Analyzing chapter content...
                </p>
              </div>
            ) : (
              <>
                <div className="ai-content bg-sky-50/50 dark:bg-sky-950/30 border-l-4 border-sky-500 p-4 rounded-lg space-y-4">
                  {/* Parse and render the markdown-like content */}
                  {summary.split('\n\n').map((section, index) => {
                    const lines = section.split('\n');

                    // Check if first line is a heading
                    if (lines[0].startsWith('**') && lines[0].endsWith('**')) {
                      const heading = lines[0].replace(/\*\*/g, '');
                      const content = lines.slice(1);

                      return (
                        <div key={index}>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {heading}
                          </h3>
                          {content.map((line, i) => {
                            // Handle bullet points with bold labels
                            if (line.startsWith('**') && line.includes(':')) {
                              const [boldPart, ...rest] = line.split(':');
                              const label = boldPart.replace(/\*\*/g, '');
                              const text = rest.join(':');
                              return (
                                <p key={i} className="text-sm text-gray-700 dark:text-gray-300 mb-2 pl-4">
                                  <span className="font-semibold">{label}:</span>
                                  {text}
                                </p>
                              );
                            }
                            // Regular line
                            if (line.trim()) {
                              return (
                                <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-1">
                                  {line}
                                </p>
                              );
                            }
                            return null;
                          })}
                        </div>
                      );
                    }

                    // Regular paragraph
                    return (
                      <p key={index} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {section}
                      </p>
                    );
                  })}
                </div>

                {/* Disclaimer */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                    <strong>Note:</strong> This is a demonstration using mock data.
                    The production version will analyze the actual chapter content using AI
                    to provide accurate, context-aware summaries.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded transition-colors"
              disabled={isGenerating}
            >
              Continue Reading
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
