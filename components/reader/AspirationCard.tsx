'use client';

import React, { useEffect, useState } from 'react';
import type { AspirationCardContent } from '@/types';

interface AspirationCardProps {
  content: AspirationCardContent;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onDismiss?: () => void;
  position?: 'floating' | 'bottom'; // Desktop vs mobile
}

export default function AspirationCard({
  content,
  isExpanded: controlledExpanded,
  onToggleExpanded,
  onDismiss,
  position = 'floating',
}: AspirationCardProps) {
  // Internal state for uncontrolled mode
  const [internalExpanded, setInternalExpanded] = useState(true);

  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggleExpanded = () => {
    if (onToggleExpanded) {
      onToggleExpanded();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // Handle Escape key to dismiss
  useEffect(() => {
    if (!onDismiss) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onDismiss]);

  // Compass icon for badge
  const CompassIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );

  // Card type determines badge label
  const getBadgeLabel = () => {
    switch (content.type) {
      case 'context': return 'Before You Read';
      case 'comprehension': return 'Check Understanding';
      case 'reflection': return 'Reflect Deeper';
      case 'connection': return 'Make Connections';
      default: return 'Reading Suggestion';
    }
  };

  // Container classes based on position
  const containerClasses = position === 'floating'
    ? `fixed bottom-24 right-4 md:right-8 z-35 max-w-md w-[calc(100%-2rem)] md:w-full
       bg-white dark:bg-gray-900 rounded-lg shadow-2xl
       border border-violet-200 dark:border-violet-800
       transform transition-all duration-300 ease-out
       translate-y-0 opacity-100`
    : `fixed bottom-0 left-0 right-0 z-35
       bg-white dark:bg-gray-900 rounded-t-xl shadow-2xl
       border-t border-violet-200 dark:border-violet-800
       transform transition-transform duration-300 ease-out
       translate-y-0 pb-safe`;

  return (
    <div className={containerClasses}>
      {/* Header with badge and controls */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="inline-flex items-center gap-2 px-3 py-1.5
          bg-violet-50 dark:bg-violet-950
          text-violet-700 dark:text-violet-300
          text-xs font-medium rounded-full
          border border-violet-200 dark:border-violet-800">
          <CompassIcon />
          <span>{getBadgeLabel()}</span>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Dismiss card"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {content.title}
        </h3>

        {/* Body in colored box with expand/collapse animation */}
        <div
          className={`
            bg-violet-50/50 dark:bg-violet-950/30
            border-l-4 border-violet-500
            p-4 rounded-r-lg
            transition-all duration-300 ease-out
            overflow-hidden
          `}
          style={{
            maxHeight: isExpanded ? '600px' : '100px',
            opacity: isExpanded ? 1 : 0.85,
          }}
        >
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-3">
            {/* Parse markdown-style content */}
            {content.body.split('\n\n').map((paragraph, index) => {
              // Handle bold headings
              if (paragraph.startsWith('**') && paragraph.includes('**')) {
                const match = paragraph.match(/\*\*(.+?)\*\*/);
                if (match) {
                  const heading = match[1];
                  const rest = paragraph.substring(match[0].length).trim();

                  return (
                    <div key={index}>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {heading}
                      </h4>
                      {rest && (
                        <p className="whitespace-pre-line">
                          {rest}
                        </p>
                      )}
                    </div>
                  );
                }
              }

              // Handle bullet lists
              if (paragraph.includes('\n- ')) {
                const lines = paragraph.split('\n');
                return (
                  <div key={index} className="space-y-1">
                    {lines.map((line, i) => {
                      if (line.startsWith('- ')) {
                        return (
                          <p key={i} className="pl-4">
                            • {line.slice(2)}
                          </p>
                        );
                      }
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return (
                          <h4 key={i} className="font-bold text-gray-900 dark:text-gray-100 mt-2">
                            {line.replace(/\*\*/g, '')}
                          </h4>
                        );
                      }
                      return line ? <p key={i}>{line}</p> : null;
                    })}
                  </div>
                );
              }

              // Regular paragraph
              return (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              );
            })}
          </div>
        </div>

        {/* Expand/collapse toggle (show if content is long enough) */}
        {content.body.length > 200 && (
          <button
            onClick={handleToggleExpanded}
            className="mt-3 text-xs font-medium text-violet-600 dark:text-violet-400
              hover:text-violet-700 dark:hover:text-violet-300 transition-colors
              flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>Show more</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        )}

        {/* Action button (if provided) */}
        {content.action && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={content.action.href}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                text-violet-700 dark:text-violet-300
                bg-violet-50 dark:bg-violet-950
                hover:bg-violet-100 dark:hover:bg-violet-900
                border border-violet-200 dark:border-violet-800
                rounded transition-colors"
            >
              {content.action.label}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
