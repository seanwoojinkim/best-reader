/**
 * Duration Estimator for TTS Audio Synchronization
 *
 * Estimates sentence durations based on character count and punctuation.
 * Uses a character-per-second rate (~13 chars/sec for 150 WPM speaking rate)
 * and adds pauses for punctuation.
 *
 * The estimations are then scaled to match the actual audio duration from OpenAI TTS.
 *
 * @module duration-estimator
 */

import type { SentenceMetadata } from '@/types';
import type { ParsedSentence } from './sentence-parser';

/**
 * Constants for duration estimation
 */
const CHARS_PER_SECOND = 13;  // 150 WPM average speaking rate
const COMMA_PAUSE = 0.2;       // 200ms pause for comma
const PERIOD_PAUSE = 0.4;      // 400ms pause for period/exclamation/question

/**
 * Estimate the duration of a single sentence
 *
 * Formula: (charCount / CHARS_PER_SECOND) + punctuation pauses
 *
 * @param sentence - The sentence text to estimate
 * @returns Estimated duration in seconds
 *
 * @example
 * const duration = estimateSentenceDuration("Hello, world!");
 * // Returns: ~1.6 seconds (13 chars / 13 + 0.2 + 0.4)
 */
export function estimateSentenceDuration(sentence: string): number {
  const charCount = sentence.length;

  // Base duration from character count
  let duration = charCount / CHARS_PER_SECOND;

  // Add pauses for punctuation
  const commaCount = (sentence.match(/,/g) || []).length;
  const periodCount = (sentence.match(/[.!?]/g) || []).length;

  duration += (commaCount * COMMA_PAUSE);
  duration += (periodCount * PERIOD_PAUSE);

  return duration;
}

/**
 * Generate sentence timestamps with scaling to match actual audio duration
 *
 * Steps:
 * 1. Estimate duration for each sentence
 * 2. Calculate total estimated duration
 * 3. Scale all durations to match actual audio duration
 * 4. Generate cumulative timestamps
 *
 * This scaling accounts for TTS variations in speaking rate and ensures
 * that the last sentence ends exactly at the audio duration.
 *
 * @param sentences - Parsed sentences from sentence-parser
 * @param totalDuration - Actual audio duration in seconds from OpenAI TTS
 * @returns Array of sentence metadata with timestamps
 *
 * @example
 * const sentences = parseChapterIntoSentences(chapterText);
 * const metadata = generateSentenceTimestamps(sentences, 120.5);
 * // Returns array with startTime/endTime for each sentence
 */
export function generateSentenceTimestamps(
  sentences: ParsedSentence[],
  totalDuration: number
): SentenceMetadata[] {
  // Handle edge case: no sentences
  if (sentences.length === 0) {
    return [];
  }

  // Handle edge case: single sentence
  if (sentences.length === 1) {
    return [{
      text: sentences[0].text,
      startChar: sentences[0].startChar,
      endChar: sentences[0].endChar,
      charCount: sentences[0].charCount,
      startTime: 0,
      endTime: totalDuration,
    }];
  }

  // Step 1: Calculate estimated duration for each sentence
  let totalEstimated = 0;
  const durations: number[] = [];

  for (const sentence of sentences) {
    const duration = estimateSentenceDuration(sentence.text);
    durations.push(duration);
    totalEstimated += duration;
  }

  // Step 2: Calculate scale factor to match actual duration
  // This accounts for TTS speaking rate variations
  const scaleFactor = totalDuration / totalEstimated;

  // Step 3: Generate timestamps with scaling
  const metadata: SentenceMetadata[] = [];
  let currentTime = 0;

  for (let i = 0; i < sentences.length; i++) {
    const duration = durations[i] * scaleFactor;

    metadata.push({
      text: sentences[i].text,
      startChar: sentences[i].startChar,
      endChar: sentences[i].endChar,
      charCount: sentences[i].charCount,
      startTime: currentTime,
      endTime: currentTime + duration,
    });

    currentTime += duration;
  }

  return metadata;
}

/**
 * Validate that sentence timestamps sum to total duration
 *
 * Useful for debugging to ensure timestamps were generated correctly.
 *
 * @param metadata - Sentence metadata with timestamps
 * @param expectedDuration - Expected total duration
 * @param tolerance - Acceptable difference in seconds (default: 0.1)
 * @returns true if timestamps are valid
 */
export function validateSentenceTimestamps(
  metadata: SentenceMetadata[],
  expectedDuration: number,
  tolerance: number = 0.1
): boolean {
  if (metadata.length === 0) {
    return expectedDuration === 0;
  }

  const lastSentence = metadata[metadata.length - 1];
  const actualDuration = lastSentence.endTime;
  const diff = Math.abs(actualDuration - expectedDuration);

  if (diff > tolerance) {
    console.error('[duration-estimator] Validation failed:', {
      expected: expectedDuration,
      actual: actualDuration,
      difference: diff,
      tolerance,
    });
    return false;
  }

  // Check for overlapping or gaps
  for (let i = 1; i < metadata.length; i++) {
    const prevEnd = metadata[i - 1].endTime;
    const currStart = metadata[i].startTime;

    if (Math.abs(prevEnd - currStart) > 0.01) {
      console.error('[duration-estimator] Gap or overlap detected:', {
        sentence1: metadata[i - 1].text.substring(0, 30),
        sentence2: metadata[i].text.substring(0, 30),
        prevEnd,
        currStart,
        gap: currStart - prevEnd,
      });
      return false;
    }
  }

  return true;
}
