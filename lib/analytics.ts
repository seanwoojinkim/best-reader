/**
 * Analytics Helper Functions (Phase 3)
 * Privacy-first reading analytics - all data stored locally, never sent to server
 */

import type { Session } from '@/types';

/**
 * Calculate reading speed in words per minute
 */
export function calculateReadingSpeed(wordsRead: number, durationMinutes: number): number {
  if (durationMinutes === 0) return 0;
  return Math.round(wordsRead / durationMinutes);
}

/**
 * Calculate time remaining in minutes based on current reading speed
 * @param pagesRemaining - Number of pages left in book
 * @param currentSpeed - Current reading speed in pages per minute
 * @param fallbackSpeed - Fallback speed if currentSpeed is 0 (default: 1 page per minute)
 */
export function calculateTimeRemaining(
  pagesRemaining: number,
  currentSpeed: number,
  fallbackSpeed: number = 1
): number {
  const speed = currentSpeed > 0 ? currentSpeed : fallbackSpeed;
  return Math.ceil(pagesRemaining / speed);
}

/**
 * Format time remaining as human-readable string
 * @param minutes - Time in minutes
 * @returns Formatted string like "5 minutes", "1 hour 23 minutes", etc.
 */
export function formatTimeRemaining(minutes: number): string {
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${Math.round(minutes)} minutes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`;
}

/**
 * Format session duration
 * @param startTime - Session start time
 * @param endTime - Session end time (optional, defaults to now)
 */
export function formatSessionDuration(startTime: Date, endTime?: Date): string {
  const end = endTime || new Date();
  const durationMs = end.getTime() - startTime.getTime();
  const minutes = Math.floor(durationMs / 60000);

  return formatTimeRemaining(minutes);
}

/**
 * Calculate pages per minute for current session
 */
export function calculatePagesPerMinute(pagesRead: number, durationMinutes: number): number {
  if (durationMinutes === 0) return 0;
  return pagesRead / durationMinutes;
}

/**
 * Detect if a page turn is a "slowdown" (>2x average)
 * @param turnTime - Time for this page turn in milliseconds
 * @param recentTurnTimes - Array of recent turn times (last 10)
 * @returns true if this turn is significantly slower than average
 */
export function isSlowdown(turnTime: number, recentTurnTimes: number[]): boolean {
  if (recentTurnTimes.length < 3) {
    // Need at least 3 data points to detect anomalies
    return false;
  }

  const average = recentTurnTimes.reduce((sum, t) => sum + t, 0) / recentTurnTimes.length;

  // Slowdown threshold: 2x the rolling average
  return turnTime > average * 2;
}

/**
 * Detect if a page turn is a "speed up" (<0.5x average)
 * @param turnTime - Time for this page turn in milliseconds
 * @param recentTurnTimes - Array of recent turn times (last 10)
 * @returns true if this turn is significantly faster than average
 */
export function isSpeedUp(turnTime: number, recentTurnTimes: number[]): boolean {
  if (recentTurnTimes.length < 3) {
    return false;
  }

  const average = recentTurnTimes.reduce((sum, t) => sum + t, 0) / recentTurnTimes.length;

  // Speed up threshold: less than half the rolling average
  return turnTime < average * 0.5;
}

/**
 * Calculate rolling average of last N turn times
 * @param recentTurnTimes - Array of recent turn times
 * @param windowSize - Number of recent turns to consider (default: 10)
 */
export function calculateRollingAverage(recentTurnTimes: number[], windowSize: number = 10): number {
  const window = recentTurnTimes.slice(-windowSize);
  if (window.length === 0) return 0;

  return window.reduce((sum, t) => sum + t, 0) / window.length;
}

/**
 * Check if enough time has passed since last session to show recap
 * @param lastSessionEnd - End time of previous session
 * @param currentSessionStart - Start time of current session
 * @param thresholdMinutes - Minimum gap to trigger recap (default: 15)
 */
export function shouldShowRecap(
  lastSessionEnd: Date | undefined,
  currentSessionStart: Date,
  thresholdMinutes: number = 15
): boolean {
  if (!lastSessionEnd) return false;

  const gapMs = currentSessionStart.getTime() - lastSessionEnd.getTime();
  const gapMinutes = gapMs / 60000;

  return gapMinutes > thresholdMinutes;
}

/**
 * Format recap summary for last session
 * @param session - The previous session
 */
export function formatRecapSummary(session: Session): {
  pagesRead: number;
  timeSpent: string;
  readingSpeed: string;
} {
  const startTime = new Date(session.startTime);
  const endTime = session.endTime ? new Date(session.endTime) : new Date();
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationMinutes = durationMs / 60000;

  const timeSpent = formatSessionDuration(startTime, endTime);
  const wpm = session.avgSpeed || calculateReadingSpeed(session.wordsRead, durationMinutes);
  const readingSpeed = `${Math.round(wpm)} words per minute`;

  return {
    pagesRead: session.pagesRead,
    timeSpent,
    readingSpeed,
  };
}
