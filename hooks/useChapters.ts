import { useState, useEffect, useCallback } from 'react';
import type { Book as EpubBook } from 'epubjs';
import type { Chapter } from '@/types';
import { extractChapters } from '@/lib/epub-utils';
import { getChapters, saveChapters, deleteChapters } from '@/lib/db';

interface UseChaptersProps {
  bookId: number;
  book: EpubBook | null;
}

interface UseChaptersResult {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  refreshChapters: () => Promise<void>;
}

/**
 * Hook to extract and manage book chapters
 * Extracts chapters from epub.js on first load, caches in IndexedDB
 */
export function useChapters({ bookId, book }: UseChaptersProps): UseChaptersResult {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChapters = useCallback(async () => {
    console.log('[useChapters.loadChapters] CALLED for bookId:', bookId);
    console.trace('[useChapters.loadChapters] Call stack');

    if (!book) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if chapters already exist in DB
      let existingChapters = await getChapters(bookId);
      console.log('[useChapters.loadChapters] Found', existingChapters.length, 'existing chapters in DB');

      if (existingChapters.length === 0) {
        // Extract chapters from EPUB
        console.log('[useChapters] No chapters found, extracting...');
        const extractedChapters = await extractChapters(book, bookId);
        console.log('[useChapters] Extracted', extractedChapters.length, 'chapters');
        console.log('[useChapters] Extracted chapter titles:', extractedChapters.map(ch => ch.title));
        await saveChapters(extractedChapters);
        existingChapters = await getChapters(bookId);
        console.log('[useChapters] After save, DB has', existingChapters.length, 'chapters');
      } else {
        // Check if existing chapters have valid navigation references
        // Old chapters might have invalid hrefs that don't work with rendition.display()
        const hasInvalidRefs = existingChapters.some(ch => {
          // Check for incomplete CFIs (partial CFIs like "/6/10" without epubcfi wrapper)
          // or obviously wrong hrefs
          return !ch.cfiStart ||
                 ch.cfiStart.length < 5 ||
                 (ch.cfiStart.startsWith('/') && !ch.cfiStart.startsWith('epubcfi('));
        });

        if (hasInvalidRefs) {
          console.log('[useChapters] Found invalid chapter references, re-extracting...');
          // Re-extract with improved logic
          await deleteChapters(bookId);
          const extractedChapters = await extractChapters(book, bookId);
          console.log('[useChapters] Re-extracted', extractedChapters.length, 'chapters');
          console.log('[useChapters] Re-extracted chapter titles:', extractedChapters.map(ch => ch.title));
          await saveChapters(extractedChapters);
          existingChapters = await getChapters(bookId);
          console.log('[useChapters] After re-save, DB has', existingChapters.length, 'chapters');
        }
      }

      setChapters(existingChapters);
    } catch (err) {
      console.error('Error loading chapters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chapters');
    } finally {
      setLoading(false);
    }
  }, [bookId, book]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  const refreshChapters = useCallback(async () => {
    if (!book) return;

    try {
      // Delete existing chapters
      await deleteChapters(bookId);

      // Re-extract
      const extractedChapters = await extractChapters(book, bookId);
      await saveChapters(extractedChapters);

      // Reload
      const newChapters = await getChapters(bookId);
      setChapters(newChapters);
    } catch (err) {
      console.error('Error refreshing chapters:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh chapters');
    }
  }, [bookId, book]);

  return {
    chapters,
    loading,
    error,
    refreshChapters,
  };
}
