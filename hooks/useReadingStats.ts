import { useState, useEffect, useCallback } from 'react';
import { calculateTimeRemaining, calculatePagesPerMinute, formatTimeRemaining } from '@/lib/analytics';

interface UseReadingStatsProps {
  totalLocations: number;
  currentLocation: number;
  pagesRead: number;
  sessionStartTime: Date;
}

interface ReadingStats {
  progress: number; // 0-100
  pagesRemaining: number;
  timeRemaining: string;
  timeRemainingMinutes: number;
  pagesPerMinute: number;
}

/**
 * Hook to calculate reading statistics and progress
 * Used by ProgressIndicators component
 */
export function useReadingStats({
  totalLocations,
  currentLocation,
  pagesRead,
  sessionStartTime,
}: UseReadingStatsProps): ReadingStats {
  const [stats, setStats] = useState<ReadingStats>({
    progress: 0,
    pagesRemaining: 0,
    timeRemaining: 'Calculating...',
    timeRemainingMinutes: 0,
    pagesPerMinute: 0,
  });

  const calculateStats = useCallback(() => {
    // Calculate progress percentage
    const progress = totalLocations > 0 ? (currentLocation / totalLocations) * 100 : 0;

    // Calculate pages remaining (estimate based on current position)
    const estimatedTotalPages = totalLocations; // Simplified: 1 location = 1 page
    const pagesRemaining = Math.max(0, estimatedTotalPages - pagesRead);

    // Calculate reading speed (pages per minute)
    const now = new Date();
    const sessionDurationMs = now.getTime() - sessionStartTime.getTime();
    const sessionDurationMinutes = Math.max(1, sessionDurationMs / 60000); // Minimum 1 minute
    const pagesPerMinute = calculatePagesPerMinute(pagesRead, sessionDurationMinutes);

    // Calculate time remaining
    const timeRemainingMinutes = calculateTimeRemaining(
      pagesRemaining,
      pagesPerMinute,
      1 // Fallback: 1 page per minute if speed is unknown
    );
    const timeRemaining = formatTimeRemaining(timeRemainingMinutes);

    setStats({
      progress,
      pagesRemaining,
      timeRemaining,
      timeRemainingMinutes,
      pagesPerMinute,
    });
  }, [totalLocations, currentLocation, pagesRead, sessionStartTime]);

  // Recalculate stats whenever inputs change
  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  return stats;
}
