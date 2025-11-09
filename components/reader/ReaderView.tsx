'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSettingsStore } from '@/stores/settingsStore';
import { savePosition } from '@/lib/db';
import { useEpubReader } from '@/hooks/useEpubReader';
import { UI_CONSTANTS } from '@/lib/constants';
import TapZones from './TapZones';
import ThemeToggle from '../shared/ThemeToggle';
import TypographySettings from '../shared/TypographySettings';

// Dynamically import to avoid SSR issues with epub.js
const ReaderViewContent = dynamic(() => Promise.resolve(ReaderViewContentComponent), {
  ssr: false,
});

interface ReaderViewProps {
  bookId: number;
  bookBlob: Blob;
  initialCfi?: string;
}

function ReaderViewContentComponent({ bookId, bookBlob, initialCfi }: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { showControls, toggleControls, setShowControls } = useSettingsStore();

  const { book, rendition, loading, currentLocation, progress, nextPage, prevPage, goToLocation } =
    useEpubReader({
      bookBlob,
      containerRef,
      onLocationChange: async (cfi, percentage) => {
        // Save position to database with error handling
        try {
          await savePosition({
            bookId,
            cfi,
            percentage,
            updatedAt: new Date(),
          });
        } catch (error) {
          console.error('Failed to save reading position:', error);
          // Position save failed but user can continue reading
          // Future: could show a toast notification
        }
      },
    });

  // Load initial position
  useEffect(() => {
    if (initialCfi && goToLocation) {
      goToLocation(initialCfi);
    }
  }, [initialCfi, goToLocation]);

  // Auto-hide controls after configured delay
  useEffect(() => {
    if (!showControls) return;

    const timeout = setTimeout(() => {
      setShowControls(false);
    }, UI_CONSTANTS.controlsAutoHideDelay);

    return () => clearTimeout(timeout);
  }, [showControls, setShowControls]);

  // Handle Escape key to close settings panel
  useEffect(() => {
    if (!showSettings) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4"
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
          <p className="text-gray-500">Loading book...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Controls Bar */}
      <div
        className={`
          absolute top-0 left-0 right-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700
          transition-transform duration-300
          ${showControls ? 'translate-y-0' : '-translate-y-full'}
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              ← Library
            </a>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Typography settings"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div
          className={`
            absolute top-16 right-4 z-20 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-6
            transition-opacity duration-200
            ${showSettings ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Typography</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close settings"
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
          <TypographySettings />
        </div>
      )}

      {/* Progress Bar */}
      <div
        className={`
          absolute bottom-0 left-0 right-0 z-10 h-1 bg-gray-200 dark:bg-gray-700
          transition-opacity duration-300
          ${showControls ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <div
          className="h-full bg-gray-900 dark:bg-gray-100 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Reader Container */}
      <TapZones onPrevPage={prevPage} onNextPage={nextPage} onToggleControls={toggleControls}>
        <div ref={containerRef} className="epub-container h-full w-full" />
      </TapZones>
    </div>
  );
}

export default function ReaderView(props: ReaderViewProps) {
  return <ReaderViewContent {...props} />;
}
