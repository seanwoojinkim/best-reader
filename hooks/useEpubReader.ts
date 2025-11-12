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
        console.log('[useEpubReader.initBook] Starting book initialization');
        console.log('[useEpubReader.initBook] bookBlob type:', bookBlob?.constructor.name);
        console.log('[useEpubReader.initBook] bookBlob size:', bookBlob?.size);

        console.log('[useEpubReader.initBook] Calling arrayBuffer()...');
        const arrayBuffer = await bookBlob.arrayBuffer();
        console.log('[useEpubReader.initBook] arrayBuffer() succeeded! size:', arrayBuffer.byteLength);

        const epubBook = ePub(arrayBuffer);
        console.log('[useEpubReader.initBook] ePub book created successfully');

        setBook(epubBook);
        setLoading(false);
      } catch (error) {
        console.error('[useEpubReader.initBook] Error initializing book:', error);
        console.error('[useEpubReader.initBook] Error type:', error?.constructor?.name);
        console.error('[useEpubReader.initBook] Error message:', (error as Error)?.message);
        console.error('[useEpubReader.initBook] Error stack:', (error as Error)?.stack);
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
      allowScriptedContent: true, // Allow scripts in iframe to enable click forwarding
    });

    // Register swipe handlers via epub.js hooks API (runs before render)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    newRendition.hooks.content.register((contents: any) => {
      const doc = contents.document;

      const handleTouchStart = (e: TouchEvent) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      };

      const handleTouchEnd = (e: TouchEvent) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const duration = Date.now() - touchStartTime;

        // Only process as swipe if significant horizontal movement
        if (Math.abs(deltaX) > 50 && duration < 500 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
          // Valid swipe - prevent click and navigate
          e.preventDefault();
          e.stopPropagation();
          if (deltaX > 0) {
            newRendition.prev();
          } else {
            newRendition.next();
          }
        }
        // Otherwise let the event propagate for tap zone handling
      };

      doc.addEventListener('touchstart', handleTouchStart, { passive: true });
      doc.addEventListener('touchend', handleTouchEnd, { passive: false });
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

  // Forward iframe clicks to parent for TapZones to work
  useEffect(() => {
    if (!rendition || !containerRef.current) return;

    const handleIframeClick = (event: MouseEvent) => {
      // Get the iframe element
      const iframe = containerRef.current?.querySelector('iframe');
      if (!iframe) return;

      // Get click coordinates relative to viewport
      const iframeRect = iframe.getBoundingClientRect();
      const viewportX = iframeRect.left + event.clientX;
      const viewportY = iframeRect.top + event.clientY;

      // Create synthetic click event on parent document
      const syntheticEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: viewportX,
        clientY: viewportY,
      });

      // Dispatch to the container element (TapZones wrapper)
      containerRef.current?.dispatchEvent(syntheticEvent);
    };

    // Listen for clicks from epub.js
    rendition.on('click', handleIframeClick);

    return () => {
      rendition.off('click', handleIframeClick);
    };
  }, [rendition, containerRef]);


  // Generate locations for progress tracking (Phase 3)
  useEffect(() => {
    if (!book) return;

    const generateLocations = async () => {
      try {
        console.log('[useEpubReader] Waiting for book to be ready...');
        // Wait for book to be ready before generating locations
        await book.ready;

        console.log('[useEpubReader] Book ready, generating locations...');
        const locs = await book.locations.generate(1600); // Average chars per page
        console.log('[useEpubReader] Locations generated:', locs.length, locs);
        setTotalLocations(locs.length || 0);
      } catch (error) {
        console.error('[useEpubReader] Error generating locations:', error);
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
      const progressPercent = Math.round(percentage * 100);

      console.log('[useEpubReader] Location changed:', {
        cfi: cfi.substring(0, 50) + '...',
        percentage,
        progressPercent,
        hasLocations: !!book?.locations,
        totalLocations: book?.locations?.length()
      });

      setProgress(progressPercent);

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
    console.log('[useEpubReader] goToLocation called with:', cfi);
    console.trace('[useEpubReader] goToLocation call stack');
    if (rendition) {
      try {
        await rendition.display(cfi);
        console.log('[useEpubReader] goToLocation completed successfully');
      } catch (error) {
        console.error('[useEpubReader] goToLocation failed:', error);
        throw error;
      }
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
