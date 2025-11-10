import type { Book as EpubBook } from 'epubjs';
import type { Chapter } from '@/types';
import { getEpubLocations } from '@/types/epubjs-extensions';

/**
 * Map audio timestamp to approximate CFI position within chapter
 *
 * Strategy: Linear interpolation based on character position
 * - Audio duration / chapter character count = chars per second
 * - Current time * chars per second = current character position
 * - Map character position to CFI using simplified percentage method
 *
 * NOTE: This is a simplified implementation for v1. Full CFI mapping requires
 * walking the DOM tree and accounting for EPUB structure. For production, consider:
 * - Using epub.js built-in CFI utilities
 * - Storing paragraph-level CFI markers during chapter extraction
 * - Building a character position → CFI lookup table
 */
export async function timestampToCFI(
  book: EpubBook,
  chapter: Chapter,
  timestamp: number,
  audioDuration: number
): Promise<string | null> {
  if (!chapter.charCount || audioDuration === 0) return null;

  try {
    // Calculate approximate character position
    const charsPerSecond = chapter.charCount / audioDuration;
    const currentCharPosition = Math.floor(timestamp * charsPerSecond);

    // Get section from chapter start CFI
    const section = book.spine.get(chapter.cfiStart);
    if (!section) return null;

    // Load section content
    await section.load(book.load.bind(book));
    const text = section.output || '';
    const textLength = typeof text === 'string' ? text.length : (text as any).textContent?.length || 0;

    // Clamp position to valid range
    const safePosition = Math.min(currentCharPosition, textLength - 1);

    // Calculate percentage through chapter
    const percentage = textLength > 0 ? safePosition / textLength : 0;

    // Generate approximate CFI (simplified)
    // Real implementation would walk DOM tree to find exact node
    // For v1, we append a percentage marker to the start CFI
    return `${chapter.cfiStart}@${percentage.toFixed(4)}`;

  } catch (error) {
    console.error('Error mapping timestamp to CFI:', error);
    return null;
  }
}

/**
 * Map CFI position to approximate audio timestamp
 *
 * Strategy: Reverse of timestampToCFI
 * - Get character position from CFI
 * - Calculate timestamp from character position
 */
export async function cfiToTimestamp(
  book: EpubBook,
  chapter: Chapter,
  cfi: string,
  audioDuration: number
): Promise<number | null> {
  if (!chapter.charCount || audioDuration === 0) return null;

  try {
    // Check if CFI is within chapter range
    // Use epub.js compare method to check if cfi is before chapter start
    const locations = getEpubLocations(book);
    const comparison = locations?.cfiComparison(cfi, chapter.cfiStart);
    if (comparison !== undefined && comparison < 0) return 0; // Before chapter start

    const section = book.spine.get(chapter.cfiStart);
    if (!section) return null;

    await section.load(book.load.bind(book));
    const text = section.output || '';
    const textLength = typeof text === 'string' ? text.length : (text as any).textContent?.length || 0;

    // Extract percentage from simplified CFI format
    // In real implementation, would calculate from DOM position
    const match = cfi.match(/@([\d.]+)$/);
    const percentage = match ? parseFloat(match[1]) : 0;

    const charPosition = Math.floor(percentage * textLength);
    const charsPerSecond = chapter.charCount / audioDuration;
    const timestamp = charPosition / charsPerSecond;

    return Math.max(0, Math.min(timestamp, audioDuration));

  } catch (error) {
    console.error('Error mapping CFI to timestamp:', error);
    return null;
  }
}

/**
 * Check if CFI is within chapter range
 */
export function isCFIInChapter(
  book: EpubBook,
  chapter: Chapter,
  cfi: string
): boolean {
  try {
    const locations = getEpubLocations(book);
    if (!locations?.cfiComparison) return false;

    const startComparison = locations.cfiComparison(cfi, chapter.cfiStart);
    const endComparison = locations.cfiComparison(cfi, chapter.cfiEnd);

    return startComparison >= 0 && endComparison <= 0;
  } catch {
    return false;
  }
}

/**
 * Find chapter containing given CFI
 */
export function findChapterByCFI(
  book: EpubBook,
  chapters: Chapter[],
  cfi: string
): Chapter | null {
  for (const chapter of chapters) {
    if (isCFIInChapter(book, chapter, cfi)) {
      return chapter;
    }
  }
  return null;
}
