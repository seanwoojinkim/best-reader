import { useEffect, useState, useRef, useCallback } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import { useSettingsStore } from '@/stores/settingsStore';
import { THEME_COLORS } from '@/lib/constants';
import type { ReaderSettings } from '@/types';

interface UseEpubReaderProps {
  bookBlob: Blob | null;
  containerRef: React.RefObject<HTMLDivElement>;
  onLocationChange?: (cfi: string, percentage: number) => void;
}

export function useEpubReader({
  bookBlob,
  containerRef,
  onLocationChange,
}: UseEpubReaderProps) {
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [totalLocations, setTotalLocations] = useState<number>(0);

  const { theme, fontSize, fontFamily, lineHeight } = useSettingsStore();

  // Initialize book
  useEffect(() => {
    if (!bookBlob) return;

    const initBook = async () => {
      try {
        const arrayBuffer = await bookBlob.arrayBuffer();
        const epubBook = ePub(arrayBuffer);
        setBook(epubBook);
        setLoading(false);
      } catch (error) {
        console.error('Error initializing book:', error);
        setLoading(false);
      }
    };

    initBook();
  }, [bookBlob]);

  // Initialize rendition
  useEffect(() => {
    if (!book || !containerRef.current) return;

    const newRendition = book.renderTo(containerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      snap: true,
    });

    setRendition(newRendition);

    return () => {
      newRendition?.destroy();
    };
  }, [book, containerRef]);

  // Apply styling
  useEffect(() => {
    if (!rendition) return;

    // Apply theme colors
    const colors = THEME_COLORS[theme];
    rendition.themes.default({
      body: {
        'background-color': `${colors.bg} !important`,
        color: `${colors.text} !important`,
        'font-size': `${fontSize}px !important`,
        'line-height': `${lineHeight} !important`,
        'font-family': fontFamily === 'serif' ? 'Georgia, serif' : '-apple-system, sans-serif',
        padding: '2rem !important',
      },
      p: {
        'margin-bottom': '1em !important',
      },
      a: {
        color: `${colors.text} !important`,
        'text-decoration': 'underline !important',
      },
    });
  }, [rendition, theme, fontSize, fontFamily, lineHeight]);

  // Generate locations for progress tracking (Phase 3)
  useEffect(() => {
    if (!book) return;

    const generateLocations = async () => {
      try {
        const locs = await book.locations.generate(1600); // Average chars per page
        setTotalLocations(locs.length || 0);
      } catch (error) {
        console.error('Error generating locations:', error);
      }
    };

    generateLocations();
  }, [book]);

  // Track location changes
  useEffect(() => {
    if (!rendition) return;

    const handleRelocated = (location: any) => {
      const cfi = location.start.cfi;
      setCurrentLocation(cfi);

      // Calculate progress percentage
      const percentage = book?.locations?.percentageFromCfi(cfi) || 0;
      setProgress(Math.round(percentage * 100));

      onLocationChange?.(cfi, percentage);
    };

    rendition.on('relocated', handleRelocated);

    return () => {
      rendition.off('relocated', handleRelocated);
    };
  }, [rendition, book, onLocationChange]);

  // Navigation functions (memoized for stable references)
  const nextPage = useCallback(async () => {
    if (rendition) {
      await rendition.next();
    }
  }, [rendition]);

  const prevPage = useCallback(async () => {
    if (rendition) {
      await rendition.prev();
    }
  }, [rendition]);

  const goToLocation = useCallback(async (cfi: string) => {
    if (rendition) {
      await rendition.display(cfi);
    }
  }, [rendition]);

  // Display initial content
  useEffect(() => {
    if (rendition && !currentLocation) {
      rendition.display();
    }
  }, [rendition, currentLocation]);

  return {
    book,
    rendition,
    loading,
    currentLocation,
    progress,
    totalLocations,
    nextPage,
    prevPage,
    goToLocation,
  };
}
