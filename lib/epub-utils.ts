import ePub, { Book as EpubBook, NavItem } from 'epubjs';
import type { Chapter } from '@/types';
import { getEpubSpine } from '@/types/epubjs-extensions';

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
    console.log('[extractChapters] Processing TOC item:', item.label, 'href:', item.href);

    // Try multiple ways to find the spine section
    // TOC hrefs might have fragments (e.g., "ch01.xhtml#section1") or different paths
    let section = book.spine.get(item.href);

    if (!section && item.href.includes('#')) {
      // Try without the fragment
      const hrefWithoutFragment = item.href.split('#')[0];
      console.log('[extractChapters] Trying without fragment:', hrefWithoutFragment);
      section = book.spine.get(hrefWithoutFragment);
    }

    if (!section) {
      // Try to find by matching the end of the href
      const spine = getEpubSpine(book);
      if (spine?.items) {
        const tocFile = item.href.split('#')[0]; // Remove fragment if present
        const foundItem = spine.items.find((spineItem: any) => {
          const spineHref = spineItem.href || spineItem.url || '';
          // Match if the spine href ends with the TOC href or vice versa
          return spineHref.endsWith(tocFile) || tocFile.endsWith(spineHref);
        });

        if (foundItem) {
          const matchedHref = (foundItem as any).href || (foundItem as any).url;
          console.log('[extractChapters] Found spine item by matching:', matchedHref);
          // Now get the actual Section object using the matched href
          section = book.spine.get(matchedHref);
          if (!section) {
            console.warn('[extractChapters] Found spine item but could not get Section:', matchedHref);
          }
        }
      }
    }

    let wordCount = 0;
    let charCount = 0;
    let cfiStart = item.href; // fallback

    if (section) {
      try {
        const contents = await section.load(book.load.bind(book));
        const text = contents.textContent || '';
        charCount = text.length;
        wordCount = estimateWordCount(text);

        // Generate proper CFI for this section
        // This ensures navigation will work reliably with rendition.display()
        let extractedCfi = null;

        if ((section as any).cfiBase) {
          extractedCfi = (section as any).cfiBase;
          console.log('[extractChapters] Found cfiBase:', extractedCfi);
        } else if ((section as any).href) {
          extractedCfi = (section as any).href;
          console.log('[extractChapters] Found href:', extractedCfi);
        } else if ((section as any).url) {
          extractedCfi = (section as any).url;
          console.log('[extractChapters] Found url:', extractedCfi);
        }

        if (extractedCfi) {
          // Ensure it's a complete CFI or href, not a partial CFI
          if (extractedCfi.startsWith('epubcfi(')) {
            // Already a complete CFI
            cfiStart = extractedCfi;
          } else if (extractedCfi.startsWith('/')) {
            // Partial CFI like "/6/10" - wrap it with epubcfi()
            cfiStart = `epubcfi(${extractedCfi})`;
            console.log('[extractChapters] Wrapped partial CFI:', cfiStart);
          } else {
            // It's an href like "ch01.xhtml" or "OEBPS/Text/ch01.xhtml"
            cfiStart = extractedCfi;
          }
          console.log('[extractChapters] Using for:', item.label, '→', cfiStart);
        } else {
          console.warn('[extractChapters] No cfiBase/href/url found, using TOC href:', item.href);
        }
      } catch (error) {
        console.error('[extractChapters] Error loading chapter:', error);
      }
    } else {
      console.warn('[extractChapters] Could not find spine section for TOC item:', item.href, '- Chapter navigation may not work');
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
  // Note: epub.js Spine type doesn't expose 'items', but it exists at runtime
  const spine = getEpubSpine(book);
  if (!spine) {
    throw new Error('Book spine not available');
  }

  const startIndex = spine.items.findIndex((item) => {
    return item.href === cfiStart ||
           item.href.endsWith(cfiStart) ||
           item.href.includes(cfiStart);
  });

  const endIndex = spine.items.findIndex((item) => {
    return item.href === cfiEnd ||
           item.href.endsWith(cfiEnd) ||
           item.href.includes(cfiEnd);
  });

  if (startIndex === -1) {
    console.error('[getChapterText] Start chapter not found:', cfiStart);
    console.error('Available spine items:', spine.items.map((item) => item.href));
    throw new Error(`Chapter not found: ${cfiStart}`);
  }

  // If endIndex not found, just get one section
  // If endIndex is found, extract up to but NOT including the end section
  // (since cfiEnd is the start of the NEXT chapter)
  const actualEndIndex = endIndex === -1 ? startIndex : endIndex - 1;

  console.log(`[getChapterText] Extracting from spine index ${startIndex} to ${actualEndIndex} (exclusive of ${endIndex})`);

  // Extract text from all sections in the range (inclusive of start, exclusive of next chapter)
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
