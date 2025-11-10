/**
 * Sentence Synchronization Hook for TTS Audio Playback
 *
 * Tracks the current sentence being spoken during audio playback
 * using binary search for efficient lookup (O(log n) performance).
 *
 * @module useSentenceSync
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SentenceMetadata } from '@/types';

interface UseSentenceSyncProps {
  sentences: SentenceMetadata[] | null;
  currentTime: number;      // Current playback time in seconds
  playing: boolean;          // Whether audio is playing
  onSentenceChange?: (sentenceIndex: number) => void;
}

interface UseSentenceSyncResult {
  currentSentenceIndex: number;  // Index of current sentence (-1 if none)
}

/**
 * Hook to track current sentence during audio playback
 *
 * Uses binary search to find the sentence containing the current timestamp.
 * Throttles updates to every 100ms to avoid excessive re-renders.
 *
 * @example
 * const { currentSentenceIndex } = useSentenceSync({
 *   sentences: sentenceSyncData?.sentences || null,
 *   currentTime: audioPlayer.currentTime,
 *   playing: audioPlayer.playing,
 *   onSentenceChange: (index) => {
 *     highlighter.highlightSentence(index);
 *   },
 * });
 */
export function useSentenceSync({
  sentences,
  currentTime,
  playing,
  onSentenceChange,
}: UseSentenceSyncProps): UseSentenceSyncResult {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const lastUpdateTime = useRef<number>(0);

  /**
   * Find the sentence containing the current time using binary search
   *
   * Time complexity: O(log n)
   * Space complexity: O(1)
   */
  const findCurrentSentence = useCallback((time: number): number => {
    if (!sentences || sentences.length === 0) return -1;

    let left = 0;
    let right = sentences.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const sentence = sentences[mid];

      if (time >= sentence.startTime && time < sentence.endTime) {
        // Found the sentence containing this timestamp
        return mid;
      } else if (time < sentence.startTime) {
        // Current time is before this sentence, search left half
        right = mid - 1;
      } else {
        // Current time is after this sentence, search right half
        left = mid + 1;
      }
    }

    // If we get here, time is past all sentences
    // Return the last sentence index
    return sentences.length > 0 ? sentences.length - 1 : -1;
  }, [sentences]);

  /**
   * Update current sentence when playback time changes
   *
   * Throttled to 100ms to avoid excessive updates while maintaining
   * smooth visual synchronization.
   */
  useEffect(() => {
    // Only update if audio is playing and we have sentences
    if (!playing || !sentences) return;

    // Throttle updates to every 100ms
    const now = Date.now();
    if (now - lastUpdateTime.current < 100) return;
    lastUpdateTime.current = now;

    // Find the current sentence
    const newIndex = findCurrentSentence(currentTime);

    // Only trigger update if sentence changed
    if (newIndex !== currentSentenceIndex) {
      setCurrentSentenceIndex(newIndex);
      if (onSentenceChange) {
        onSentenceChange(newIndex);
      }
    }
  }, [currentTime, playing, sentences, currentSentenceIndex, findCurrentSentence, onSentenceChange]);

  /**
   * Clear highlight when audio stops
   */
  useEffect(() => {
    if (!playing) {
      setCurrentSentenceIndex(-1);
    }
  }, [playing]);

  return {
    currentSentenceIndex,
  };
}
