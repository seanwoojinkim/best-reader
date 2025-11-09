import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'card' | 'text' | 'rect' | 'circle';
  width?: string;
  height?: string;
  className?: string;
}

/**
 * Loading skeleton component for showing placeholder content
 * Used while data is loading to improve perceived performance
 */
export default function LoadingSkeleton({
  variant = 'rect',
  width = 'w-full',
  height = 'h-4',
  className = '',
}: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700';

  if (variant === 'card') {
    return (
      <div className={`${baseClasses} rounded-lg p-4 space-y-4 ${className}`}>
        <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className={`${baseClasses} rounded ${height}`} style={{ width: '100%' }} />
        <div className={`${baseClasses} rounded ${height}`} style={{ width: '90%' }} />
        <div className={`${baseClasses} rounded ${height}`} style={{ width: '95%' }} />
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={`${baseClasses} rounded-full ${width} ${height} ${className}`}
        aria-hidden="true"
      />
    );
  }

  // Default: rect
  return (
    <div
      className={`${baseClasses} rounded ${width} ${height} ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Loading skeleton for book cards in library
 */
export function BookCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64 mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for book grid
 */
export function BookGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}
