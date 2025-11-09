'use client';

import React, { useEffect, useState } from 'react';
import { generateExplanation } from '@/lib/mockAi';

interface AiExplanationProps {
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
  onSaveToNote?: (explanation: string) => void;
}

export default function AiExplanation({
  selectedText,
  position,
  onClose,
  onSaveToNote,
}: AiExplanationProps) {
  const [explanation, setExplanation] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(true);

  // Generate explanation when component mounts
  useEffect(() => {
    // Simulate API delay for realistic UX
    const timer = setTimeout(() => {
      const generated = generateExplanation(selectedText);
      setExplanation(generated);
      setIsGenerating(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [selectedText]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSaveToNote = () => {
    if (onSaveToNote) {
      onSaveToNote(explanation);
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-label="Close explanation" />

      {/* Popover */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-sky-200 dark:border-sky-800 max-w-md"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -100%) translateY(-16px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-sky-50 dark:bg-sky-950 rounded-t-lg">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-sky-600 dark:text-sky-400"
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
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI Explanation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="px-4 pt-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300 text-xs font-medium rounded">
            AI Generated
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {/* Selected text preview */}
          <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-900 rounded border-l-2 border-gray-300 dark:border-gray-600">
            <p className="text-xs text-gray-600 dark:text-gray-400 italic">
              &ldquo;{selectedText.length > 100 ? `${selectedText.slice(0, 100)}...` : selectedText}&rdquo;
            </p>
          </div>

          {/* Explanation */}
          <div className="ai-content bg-sky-50/50 dark:bg-sky-950/30 border-l-3 border-sky-500 p-3 rounded space-y-2">
            {isGenerating ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg
                  className="animate-spin h-4 w-4"
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
                <span>Generating explanation...</span>
              </div>
            ) : (
              <>
                {explanation.split('\n\n').map((paragraph, index) => {
                  // Handle headings (markdown-style **bold**)
                  if (paragraph.startsWith('**') && paragraph.includes('**:')) {
                    const [boldPart, ...rest] = paragraph.split(':');
                    const heading = boldPart.replace(/\*\*/g, '');
                    const content = rest.join(':').trim();
                    return (
                      <div key={index}>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                          {heading}
                        </h4>
                        {content && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {content}
                          </p>
                        )}
                      </div>
                    );
                  }

                  // Handle bullet points
                  if (paragraph.includes('\n- ')) {
                    const lines = paragraph.split('\n');
                    return (
                      <div key={index} className="space-y-1">
                        {lines.map((line, i) => {
                          if (line.startsWith('- ')) {
                            return (
                              <p key={i} className="text-sm text-gray-700 dark:text-gray-300 pl-4">
                                • {line.slice(2)}
                              </p>
                            );
                          }
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return (
                              <h4 key={i} className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-2">
                                {line.replace(/\*\*/g, '')}
                              </h4>
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

                  // Regular paragraph
                  return (
                    <p key={index} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {paragraph}
                    </p>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isGenerating && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            {onSaveToNote && (
              <button
                onClick={handleSaveToNote}
                className="flex-1 px-3 py-2 text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 rounded transition-colors border border-sky-200 dark:border-sky-800"
              >
                Save to Note
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">
            Mock AI demonstration. Real version will use GPT-4 or Claude.
          </p>
        </div>
      </div>
    </>
  );
}
