import ePub, { Book as EpubBook, NavItem } from 'epubjs';
import type { Chapter } from '@/types';

/**
 * Helper function to wrap promises with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Extract metadata from EPUB file
 */
export async function extractEpubMetadata(file: File): Promise<{
  title: string;
  author: string;
  coverUrl?: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);

    // Wait for book to be ready with 10 second timeout
    await withTimeout(book.ready, 10000);

    // Extract metadata
    const metadata = await book.loaded.metadata;
    const title = metadata.title || file.name.replace('.epub', '');
    const author = metadata.creator || 'Unknown Author';

    // Extract cover image with timeout
    let coverUrl: string | undefined;
    try {
      const cover = await withTimeout(book.coverUrl(), 5000);
      if (cover) {
        coverUrl = cover;
      }
    } catch (e) {
      console.warn('Could not extract cover:', e);
    }

    return {
      title,
      author,
      coverUrl,
    };
  } catch (error) {
    console.error('Error extracting EPUB metadata:', error);

    // Fallback to filename
    return {
      title: file.name.replace('.epub', ''),
      author: 'Unknown Author',
    };
  }
}

/**
 * Create a blob URL from a file
 */
export function createBlobUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Validate EPUB file
 */
export function isValidEpubFile(file: File): boolean {
  const validExtensions = ['.epub'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================================
// TTS Chapter Extraction Functions (Phase 1)
// ============================================================

/**
 * Extract chapters from epub.js book
 * Handles nested TOC structures by flattening
 */
export async function extractChapters(
  book: EpubBook,
  bookId: number
): Promise<Omit<Chapter, 'id'>[]> {
  // Wait for book to be ready and navigation loaded
  await book.ready;
  await book.loaded.navigation;

  const toc = book.navigation.toc;
  const chapters: Omit<Chapter, 'id'>[] = [];

  // Recursive function to flatten TOC
  const processNavItem = async (
    item: NavItem,
    order: number,
    level: number
  ): Promise<number> => {
    const cfiStart = item.href;

    // Get chapter text to calculate word/char counts
    const section = book.spine.get(item.href);
    let wordCount = 0;
    let charCount = 0;

    if (section) {
      try {
        const contents = await section.load(book.load.bind(book));
        const text = contents.textContent || '';
        charCount = text.length;
        wordCount = estimateWordCount(text);
      } catch (error) {
        console.error('Error loading chapter:', error);
      }
    }

    chapters.push({
      bookId,
      title: item.label,
      cfiStart,
      cfiEnd: '', // Will be filled in next step
      wordCount,
      charCount,
      order,
      level,
    });

    let currentOrder = order + 1;

    // Process subitems recursively
    if (item.subitems && item.subitems.length > 0) {
      for (const subitem of item.subitems) {
        currentOrder = await processNavItem(subitem, currentOrder, level + 1);
      }
    }

    return currentOrder;
  };

  let order = 1;
  for (const item of toc) {
    order = await processNavItem(item, order, 1);
  }

  // Fill in cfiEnd for each chapter (next chapter's start)
  for (let i = 0; i < chapters.length - 1; i++) {
    chapters[i].cfiEnd = chapters[i + 1].cfiStart;
  }

  // Last chapter ends at book end
  if (chapters.length > 0) {
    const lastSection = book.spine.last();
    chapters[chapters.length - 1].cfiEnd = lastSection?.cfiBase || '';
  }

  return chapters;
}

/**
 * Estimate word count from text
 */
export function estimateWordCount(text: string): number {
  // Remove extra whitespace, split on word boundaries
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Extract text content from a chapter CFI range
 * This extracts ALL content from cfiStart to cfiEnd (can span multiple spine items)
 */
export async function getChapterText(
  book: EpubBook,
  cfiStart: string,
  cfiEnd: string
): Promise<string> {
  // Find the start and end spine indices
  const startIndex = book.spine.items.findIndex((item: any) => {
    return item.href === cfiStart ||
           item.href.endsWith(cfiStart) ||
           item.href.includes(cfiStart);
  });

  const endIndex = book.spine.items.findIndex((item: any) => {
    return item.href === cfiEnd ||
           item.href.endsWith(cfiEnd) ||
           item.href.includes(cfiEnd);
  });

  if (startIndex === -1) {
    console.error('[getChapterText] Start chapter not found:', cfiStart);
    console.error('Available spine items:', book.spine.items.map((item: any) => item.href));
    throw new Error(`Chapter not found: ${cfiStart}`);
  }

  // If endIndex not found or same as start, just get one section
  const actualEndIndex = endIndex === -1 ? startIndex : endIndex;

  console.log(`[getChapterText] Extracting from spine index ${startIndex} to ${actualEndIndex}`);

  // Extract text from all sections in the range (inclusive)
  let fullText = '';
  for (let i = startIndex; i <= actualEndIndex; i++) {
    const section = book.spine.get(i);
    if (section) {
      try {
        const contents = await section.load(book.load.bind(book));
        const text = contents.textContent || '';
        fullText += text + '\n\n';
        console.log(`[getChapterText] Section ${i}: ${text.length} characters`);
      } catch (error) {
        console.error(`[getChapterText] Error loading section ${i}:`, error);
      }
    }
  }

  console.log(`[getChapterText] Total extracted: ${fullText.length} characters`);
  return fullText.trim();
}

/**
 * Calculate estimated cost for TTS generation
 */
export function calculateTTSCost(charCount: number): number {
  // OpenAI TTS-1: $0.015 per 1K characters
  return (charCount / 1000) * 0.015;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(3)}`;
}

/**
 * Estimate audio duration (150 words per minute average)
 */
export function estimateAudioDuration(wordCount: number): number {
  const wordsPerMinute = 150;
  return Math.ceil((wordCount / wordsPerMinute) * 60); // Return seconds
}

/**
 * Format duration for display (e.g., "5:23" or "1:02:45")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
