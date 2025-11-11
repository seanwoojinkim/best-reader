import React from 'react';

interface ProgressIndicatorsProps {
  progress: number; // 0-100
  pagesRemaining: number;
  timeRemaining: string;
  showControls: boolean;
}

/**
 * Progress indicators shown at bottom of reader
 * Displays: progress bar, percentage, pages remaining, time estimate
 */
export default function ProgressIndicators({
  progress,
  pagesRemaining,
  timeRemaining,
  showControls,
}: ProgressIndicatorsProps) {
  return (
    <>
      {/* Progress Bar */}
      <div
        className={`
          absolute bottom-0 left-0 right-0 z-10 h-1 bg-gray-200 dark:bg-gray-700
          transition-opacity duration-300 safe-area-bottom
          ${showControls ? 'opacity-100' : 'opacity-0'}
        `}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Reading progress: ${Math.round(progress)}%`}
      >
        <div
          className="h-full bg-gray-900 dark:bg-gray-100 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Progress Details */}
      <div
        className={`
          absolute bottom-4 z-20
          bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm
          shadow-lg
          transition-all duration-300
          ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
          left-4 right-4 rounded-lg md:left-1/2 md:transform md:-translate-x-1/2 md:rounded-full md:left-auto md:right-auto
          px-3 md:px-4 py-1.5 md:py-2
        `}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between md:justify-center gap-2 md:gap-4 text-xs md:text-sm text-gray-700 dark:text-gray-300">
          {/* Progress Percentage */}
          <span className="font-medium" aria-label={`${Math.round(progress)} percent complete`}>
            {Math.round(progress)}%
          </span>

          {/* Divider */}
          <span className="text-gray-400 dark:text-gray-600">•</span>

          {/* Pages Remaining */}
          <span aria-label={`${pagesRemaining} pages remaining`}>
            {pagesRemaining === 1 ? '1 page left' : `${pagesRemaining} pages left`}
          </span>

          {/* Divider */}
          {pagesRemaining > 0 && (
            <>
              <span className="text-gray-400 dark:text-gray-600">•</span>

              {/* Time Remaining */}
              <span className="flex items-center gap-1" aria-label={`About ${timeRemaining} remaining`}>
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>~{timeRemaining}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
