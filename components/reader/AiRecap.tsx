'use client';

import React, { useEffect, useState } from 'react';
import { generateRecap, type SessionData } from '@/lib/mockAi';

interface AiRecapProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: SessionData;
}

export default function AiRecap({ isOpen, onClose, sessionData }: AiRecapProps) {
  const [recap, setRecap] = useState<string>('');

  // Generate recap when component mounts or session data changes
  useEffect(() => {
    if (isOpen) {
      const generatedRecap = generateRecap(sessionData);
      setRecap(generatedRecap);
    }
  }, [isOpen, sessionData]);

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
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                AI Recap
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close AI recap"
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
              <span>AI Generated Content</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="ai-content bg-sky-50/50 dark:bg-sky-950/30 border-l-4 border-sky-500 p-4 rounded-lg space-y-4">
              {/* Parse and render the markdown-like content */}
              {recap.split('\n\n').map((section, index) => {
                const lines = section.split('\n');
                const isHeading = lines[0].startsWith('**') && lines[0].endsWith('**');

                if (isHeading) {
                  const heading = lines[0].replace(/\*\*/g, '');
                  const content = lines.slice(1);

                  return (
                    <div key={index}>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
                        {heading}
                      </h3>
                      {content.map((line, i) => {
                        // Check if line is a bullet point
                        if (line.startsWith('**') && line.includes(':')) {
                          const [boldPart, ...rest] = line.split(':');
                          const label = boldPart.replace(/\*\*/g, '');
                          const text = rest.join(':');
                          return (
                            <p key={i} className="text-sm text-gray-700 dark:text-gray-300 mb-1 pl-4">
                              <span className="font-semibold">{label}:</span>
                              {text}
                            </p>
                          );
                        }
                        return (
                          <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  );
                }

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
                <strong>Note:</strong> This is a demonstration of AI features using mock data.
                In the full version, this recap will be generated by analyzing your actual reading
                patterns and the book content.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded transition-colors"
            >
              Continue Reading
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
