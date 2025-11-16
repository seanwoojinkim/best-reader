import type { Book as EpubBook } from 'epubjs';
import type { Chapter } from '@/types';
import { getEpubSpine, type EpubSpine } from '@/types/epubjs-extensions';

/**
 * Find spine index for a given href using flexible matching
 *
 * Handles different href formats:
 * - Full path: "OEBPS/Text/chapter01.xhtml"
 * - Relative path: "Text/chapter01.xhtml"
 * - With fragment: "chapter01.xhtml#section1"
 * - File name only: "chapter01.xhtml"
 *
 * @param spine - Book spine with items array
 * @param targetHref - Href to find
 * @returns Spine index (0-based), or -1 if not found
 */
function findSpineIndex(spine: EpubSpine, targetHref: string): number {
  // Remove fragment if present (e.g., "chapter01.html#section1" → "chapter01.html")
  const cleanHref = targetHref.split('#')[0];

  const index = spine.items.findIndex((item) => {
    const itemHref = item.href || '';
    // Try multiple matching strategies to handle path variations
    // This matches the proven pattern from getChapterText() in epub-utils.ts
    return itemHref === cleanHref ||
           itemHref.endsWith(cleanHref) ||
           itemHref.includes(cleanHref) ||
           cleanHref.endsWith(itemHref) ||
           cleanHref.includes(itemHref);
  });

  if (index === -1) {
    console.warn('[findSpineIndex] Href not found in spine:', targetHref, {
      cleanHref,
      totalSpineItems: spine.items.length,
      firstItem: spine.items[0]?.href,
      lastItem: spine.items[spine.items.length - 1]?.href,
    });
  }

  return index;
}

/**
 * Check if a location (href) is within a chapter
 *
 * Uses spine index range comparison to handle multi-file chapters.
 * Falls back to string comparison if spine is unavailable.
 *
 * @param book - The epub.js book instance
 * @param chapter - The chapter to check against
 * @param href - The current location href (e.g., "chapter03.xhtml")
 * @returns true if the href is within the chapter's spine range
 */
export function isHrefInChapter(
  book: EpubBook,
  chapter: Chapter,
  href: string
): boolean {
  try {
    // Get book spine (ordered list of files)
    const spine = getEpubSpine(book);
    if (!spine) {
      console.warn('[isHrefInChapter] Spine not available, falling back to string comparison');
      // Fallback to original behavior for robustness
      const canonicalCurrent = (book as any).canonical?.(href) || href;
      const canonicalChapter = (book as any).canonical?.(chapter.cfiStart) || chapter.cfiStart;
      return canonicalCurrent === canonicalChapter;
    }

    // Find spine indices using flexible matching
    const currentIndex = findSpineIndex(spine, href);
    const startIndex = findSpineIndex(spine, chapter.cfiStart);
    let endIndex = findSpineIndex(spine, chapter.cfiEnd);

    // Handle missing current href
    if (currentIndex === -1) {
      console.warn('[isHrefInChapter] Current href not found in spine:', href, {
        chapter: chapter.title,
        chapterStart: chapter.cfiStart,
        chapterEnd: chapter.cfiEnd,
      });
      return false;
    }

    // Handle missing chapter start (should never happen, but be defensive)
    if (startIndex === -1) {
      console.error('[isHrefInChapter] Chapter start not found in spine:', chapter.cfiStart, {
        chapter: chapter.title,
        chapterId: chapter.id,
      });
      return false;
    }

    // Handle last chapter (no explicit end or end not found)
    if (endIndex === -1 || chapter.cfiEnd === '') {
      // Last chapter: anything from startIndex onwards is in chapter
      const result = currentIndex >= startIndex;
      console.log('[isHrefInChapter] Last chapter check:', {
        chapter: chapter.title,
        currentHref: href.substring(href.lastIndexOf('/') + 1),
        currentIndex,
        startIndex,
        isInChapter: result,
      });
      return result;
    }

    // Normal case: check if current is in range [startIndex, endIndex)
    // Note: endIndex is EXCLUSIVE (it's the start of the next chapter)
    const result = currentIndex >= startIndex && currentIndex < endIndex;

    console.log('[isHrefInChapter] Range check:', {
      chapter: chapter.title,
      currentHref: href.substring(href.lastIndexOf('/') + 1),
      currentIndex,
      startIndex,
      endIndex,
      range: `[${startIndex}, ${endIndex})`,
      isInChapter: result,
    });

    return result;

  } catch (error) {
    console.error('[isHrefInChapter] Unexpected error:', error, {
      chapter: chapter.title,
      href,
    });
    // Last resort fallback to simple string comparison
    return href === chapter.cfiStart;
  }
}

/**
 * Find the chapter that contains the current reading position
 *
 * @param book - The epub.js book instance
 * @param chapters - Array of chapters to search
 * @param href - The current location href from location.start.href
 * @returns The chapter containing the location, or null if not found
 */
export function findChapterByHref(
  book: EpubBook,
  chapters: Chapter[],
  href: string | undefined
): Chapter | null {
  if (!href) return null;

  for (const chapter of chapters) {
    if (isHrefInChapter(book, chapter, href)) {
      return chapter;
    }
  }
  return null;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use findChapterByHref instead
 */
export function findChapterByCFI(
  book: EpubBook,
  chapters: Chapter[],
  cfi: string,
  href?: string
): Chapter | null {
  // If href is provided, use the new href-based matching
  if (href) {
    return findChapterByHref(book, chapters, href);
  }

  // Legacy fallback: This doesn't work reliably because cfiStart contains href, not CFI
  console.warn('[findChapterByCFI] Called without href - chapter detection may fail');
  return null;
}
