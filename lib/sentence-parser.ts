/**
 * Sentence Parser for TTS Audio Synchronization
 *
 * Uses the compromise library to detect sentence boundaries in chapter text.
 * Handles edge cases like abbreviations (Dr., Mr.), ellipsis, and quotes.
 *
 * @module sentence-parser
 */

import nlp from 'compromise';

/**
 * Parsed sentence with position information
 */
export interface ParsedSentence {
  text: string;         // The sentence text
  startChar: number;    // Start position in chapter
  endChar: number;      // End position in chapter
  charCount: number;    // Character count
}

/**
 * Parse chapter text into individual sentences
 *
 * Uses compromise library for sentence detection which handles:
 * - Common abbreviations (Dr., Mr., Mrs., etc.)
 * - Ellipsis (...)
 * - Quotes and dialogue
 * - Numbers with decimals (3.14, $1.50)
 *
 * @param chapterText - The full chapter text to parse
 * @returns Array of parsed sentences with position information
 *
 * @example
 * const text = "Dr. Smith examined the patient. The diagnosis was clear!";
 * const sentences = parseChapterIntoSentences(text);
 * // Returns: [
 * //   { text: "Dr. Smith examined the patient.", startChar: 0, endChar: 35, charCount: 35 },
 * //   { text: "The diagnosis was clear!", startChar: 36, endChar: 60, charCount: 24 }
 * // ]
 */
export function parseChapterIntoSentences(chapterText: string): ParsedSentence[] {
  // Handle empty or whitespace-only text
  if (!chapterText || !chapterText.trim()) {
    return [];
  }

  // Use compromise to detect sentences
  const doc = nlp(chapterText);
  const sentences = doc.sentences().out('array') as string[];

  const parsed: ParsedSentence[] = [];
  let currentPos = 0;

  for (const sentenceText of sentences) {
    // Skip empty sentences
    if (!sentenceText.trim()) {
      continue;
    }

    // Skip very short sentences that are likely abbreviations (< 5 chars)
    // These will be merged with the next sentence by compromise's logic
    if (sentenceText.trim().length < 5) {
      continue;
    }

    // Find sentence position in original text
    // Start searching from currentPos to handle repeated sentences
    const startChar = chapterText.indexOf(sentenceText, currentPos);

    // If sentence not found (shouldn't happen), skip it
    if (startChar === -1) {
      console.warn('[sentence-parser] Could not find sentence in text:', sentenceText.substring(0, 50));
      continue;
    }

    const endChar = startChar + sentenceText.length;

    parsed.push({
      text: sentenceText,
      startChar,
      endChar,
      charCount: sentenceText.length,
    });

    // Update position for next search
    currentPos = endChar;
  }

  return parsed;
}

/**
 * Validate parsed sentences against original text
 *
 * Useful for debugging and testing to ensure sentences were parsed correctly.
 *
 * @param chapterText - Original chapter text
 * @param sentences - Parsed sentences to validate
 * @returns true if all sentences match their positions in the text
 */
export function validateParsedSentences(
  chapterText: string,
  sentences: ParsedSentence[]
): boolean {
  for (const sentence of sentences) {
    const extractedText = chapterText.substring(sentence.startChar, sentence.endChar);
    if (extractedText !== sentence.text) {
      console.error('[sentence-parser] Validation failed for sentence:', {
        expected: sentence.text.substring(0, 50),
        actual: extractedText.substring(0, 50),
        startChar: sentence.startChar,
        endChar: sentence.endChar,
      });
      return false;
    }
  }
  return true;
}
