import { useEffect, useState, useRef, useCallback } from 'react';
import ePub, { Book, Rendition } from 'epubjs';
import FontFaceObserver from 'fontfaceobserver';
import { useSettingsStore } from '@/stores/settingsStore';
import { THEME_COLORS, SYSTEM_FONTS, FONT_CONSTANTS } from '@/lib/constants';
import type { ReaderSettings, EpubContents, EpubLocation } from '@/types';
import { getFont } from '@/lib/db';
import {
  FontLoadError,
  FontApplicationError,
  handleFontError,
  ErrorSeverity,
} from '@/lib/fontErrors';

interface UseEpubReaderProps {
  bookBlob: Blob | null;
  containerRef: React.RefObject<HTMLDivElement>;
  onLocationChange?: (cfi: string, percentage: number, href?: string) => void;
}

/**
 * Module-level font cache to avoid redundant base64 conversions
 * Maps fontId -> { family, dataURL }
 * LRU eviction when cache exceeds MAX_CACHE_SIZE
 */
interface CachedFont {
  family: string;
  dataURL: string;
  lastAccessed: number; // Timestamp for LRU
}

const fontCache = new Map<number, CachedFont>();
const MAX_CACHE_SIZE = FONT_CONSTANTS.CACHE_SIZE_LIMIT;

/**
 * Gets a font from cache, updating last accessed time
 */
function getCachedFont(fontId: number): CachedFont | undefined {
  const cached = fontCache.get(fontId);
  if (cached) {
    cached.lastAccessed = Date.now();
    fontCache.set(fontId, cached); // Update in map
  }
  return cached;
}

/**
 * Adds a font to cache with LRU eviction
 */
function setCachedFont(fontId: number, family: string, dataURL: string): void {
  // Evict oldest entry if cache is full
  if (fontCache.size >= MAX_CACHE_SIZE) {
    let oldestId: number | null = null;
    let oldestTime = Infinity;

    // Convert to array to avoid iterator issues
    const entries = Array.from(fontCache.entries());
    for (const [id, cached] of entries) {
      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
        oldestId = id;
      }
    }

    if (oldestId !== null && oldestId !== fontId) {
      fontCache.delete(oldestId);
      console.log(`[fontCache] Evicted font ${oldestId} (LRU)`);
    }
  }

  fontCache.set(fontId, {
    family,
    dataURL,
    lastAccessed: Date.now(),
  });

  console.log(`[fontCache] Cached font ${fontId}, cache size: ${fontCache.size}`);
}

/**
 * Invalidates cache entry for a font (e.g., on delete)
 */
export function invalidateFontCache(fontId: number): void {
  fontCache.delete(fontId);
  console.log(`[fontCache] Invalidated font ${fontId}`);
}

/**
 * Builds CSS for font injection into EPUB iframes
 * Handles both custom fonts (with @font-face) and system fonts
 *
 * @param fontFamilyCSS - CSS font-family value to apply
 * @param customFontDataURL - Data URL for custom font (optional)
 * @param customFontFamily - Font family name for @font-face (optional)
 * @returns CSS string to inject into iframe
 */
function buildFontCSS(
  fontFamilyCSS: string,
  customFontDataURL: string | null,
  customFontFamily: string | null
): string {
  let css = '';

  // Add @font-face declaration for custom fonts
  if (customFontDataURL && customFontFamily) {
    // Sanitize font family name to prevent CSS injection
    const safeFontFamily = customFontFamily.replace(/["';{}]/g, '').trim();

    css = `
      @font-face {
        font-family: "${safeFontFamily}";
        src: url(${customFontDataURL});
        font-style: normal;
        font-weight: normal;
      }
    `;
  }

  // Add CSS variable and global font-family rule
  css += `
    :root {
      --user-font-family: ${fontFamilyCSS};
    }
    body, body * {
      font-family: var(--user-font-family) !important;
    }
  `;

  return css;
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

  const { theme, fontSize, fontFamily, systemFontId, customFontId, lineHeight } = useSettingsStore();
  const [customFontFamily, setCustomFontFamily] = useState<string | null>(null);
  const [customFontDataURL, setCustomFontDataURL] = useState<string | null>(null);

  // Refs to store current font settings for content hooks
  const fontSettingsRef = useRef<{
    fontFamilyCSS: string;
    customFontDataURL: string | null;
    customFontFamily: string | null;
  }>({
    fontFamilyCSS: 'Georgia, serif',
    customFontDataURL: null,
    customFontFamily: null,
  });

  // Ref to store loaded FontFace for cleanup
  const loadedFontFaceRef = useRef<FontFace | null>(null);

  // Load custom font when customFontId changes (Phase 2)
  useEffect(() => {
    if (!customFontId) {
      setCustomFontFamily(null);
      setCustomFontDataURL(null);
      return;
    }

    const loadCustomFont = async () => {
      try {
        // Check cache first to avoid redundant base64 conversion
        const cached = getCachedFont(customFontId);
        if (cached) {
          console.log('[useEpubReader] Custom font loaded from cache:', cached.family);

          // Still need to load with FontFace API for document.fonts
          try {
            const fontFace = new FontFace(cached.family, `url(${cached.dataURL})`, {
              style: 'normal',
              weight: 'normal',
            });

            await fontFace.load();
            document.fonts.add(fontFace);
            loadedFontFaceRef.current = fontFace;

            setCustomFontFamily(cached.family);
            setCustomFontDataURL(cached.dataURL);
            return;
          } catch (fontFaceError) {
            throw new FontLoadError(
              `Failed to load cached font: ${fontFaceError instanceof Error ? fontFaceError.message : 'Unknown error'}`,
              'FONTFACE_LOAD_FAILED',
              ErrorSeverity.FALLBACK
            );
          }
        }

        // Cache miss - load from DB and convert
        const font = await getFont(customFontId);
        if (!font) {
          throw new FontLoadError(
            `Font with ID ${customFontId} not found in database`,
            'FONT_NOT_FOUND',
            ErrorSeverity.FALLBACK
          );
        }

        // Convert ArrayBuffer to base64 data URL
        let dataURL: string;
        try {
          const base64 = btoa(
            new Uint8Array(font.buffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ''
            )
          );
          const mimeType = font.format === 'woff2' ? 'font/woff2' :
                          font.format === 'woff' ? 'font/woff' :
                          font.format === 'truetype' ? 'font/ttf' : 'font/otf';
          dataURL = `data:${mimeType};base64,${base64}`;
        } catch (conversionError) {
          throw new FontLoadError(
            `Failed to convert font to base64: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`,
            'CONVERSION_FAILED',
            ErrorSeverity.FALLBACK
          );
        }

        // Cache the converted font
        setCachedFont(customFontId, font.family, dataURL);

        // Load font using FontFace API for validation
        try {
          const fontFace = new FontFace(font.family, `url(${dataURL})`, {
            style: 'normal',
            weight: 'normal',
          });

          await fontFace.load();
          document.fonts.add(fontFace);

          // Store FontFace for cleanup
          loadedFontFaceRef.current = fontFace;

          console.log('[useEpubReader] Custom font loaded from DB:', font.family);
          setCustomFontFamily(font.family);
          setCustomFontDataURL(dataURL);
        } catch (fontFaceError) {
          throw new FontLoadError(
            `Failed to load font with FontFace API: ${fontFaceError instanceof Error ? fontFaceError.message : 'Unknown error'}`,
            'FONTFACE_LOAD_FAILED',
            ErrorSeverity.FALLBACK
          );
        }
      } catch (error) {
        // Use centralized error handler with fallback to default font
        handleFontError(error, '[useEpubReader]', {
          fallbackToDefault: () => {
            setCustomFontFamily(null);
            setCustomFontDataURL(null);
          },
        });
      }
    };

    loadCustomFont();

    // Cleanup: remove FontFace from document.fonts on unmount or font change
    return () => {
      if (loadedFontFaceRef.current) {
        document.fonts.delete(loadedFontFaceRef.current);
        console.log('[useEpubReader] Cleaned up FontFace from document.fonts');
        loadedFontFaceRef.current = null;
      }
    };
  }, [customFontId]);

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
      contained: true,  // FIX: Forces explicit container dimensions (epub.js #862)
      spread: 'none',   // FIX: Disables 2-page spread to prevent pagination bugs
      allowScriptedContent: true, // Allow scripts in iframe to enable click forwarding
    } as any);

    // Register content hooks for swipe handlers
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    newRendition.hooks.content.register((contents: EpubContents) => {
      const doc = contents.document;

      // Swipe handlers
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

    // Register render hook for font injection with blocking wait
    // This hook blocks pagination calculation until fonts are loaded,
    // preventing the "last page skip" bug on Boox Palma 2
    newRendition.hooks.render.register(async (view: any) => {
      const doc = view.document;

      // Font injection - apply fonts to new pages
      const fontStyleTag = doc.createElement('style');
      fontStyleTag.id = 'user-font-style';

      // Build CSS from current font settings using shared function
      const settings = fontSettingsRef.current;
      const css = buildFontCSS(
        settings.fontFamilyCSS,
        settings.customFontDataURL,
        settings.customFontFamily
      );

      fontStyleTag.textContent = css;
      doc.head.appendChild(fontStyleTag);

      // Wait for custom font to load before allowing pagination calculation
      // This prevents FOUC and pagination miscalculation on E-ink devices
      if (settings.customFontFamily && settings.customFontDataURL) {
        try {
          const fontObserver = new FontFaceObserver(settings.customFontFamily);
          await fontObserver.load(null, 5000); // 5 second timeout
          console.log('[useEpubReader] Custom font loaded, pagination will use correct metrics');

          // Force layout recalculation after font loads
          // This ensures pagination uses actual rendered font metrics
          if (doc.body) {
            const height = doc.body.offsetHeight; // Force reflow
            console.log('[useEpubReader] Forced layout recalculation, body height:', height);
          }
        } catch (error) {
          console.warn('[useEpubReader] Font load timeout or error, proceeding with fallback:', error);
          // Continue anyway - better to render with fallback font than hang
        }
      }
    });

    setRendition(newRendition);

    return () => {
      newRendition?.destroy();
    };
  }, [book, containerRef]);

  // Apply styling using content hooks (proven pattern)
  useEffect(() => {
    if (!rendition) return;

    const colors = THEME_COLORS[theme];

    // Determine the font-family CSS value
    let fontFamilyCSS: string;

    if (customFontId && customFontFamily && customFontDataURL) {
      // Phase 2: Custom font with data URL ready
      // Sanitize font family name to prevent CSS injection
      const safeFontFamily = customFontFamily.replace(/["';{}]/g, '').trim();
      fontFamilyCSS = `"${safeFontFamily}", Georgia, serif`;
    } else if (systemFontId) {
      // Phase 1: System font
      const systemFont = SYSTEM_FONTS.find(f => f.id === systemFontId);
      fontFamilyCSS = systemFont?.family || 'Georgia, serif';
    } else {
      // Fallback to legacy fontFamily
      fontFamilyCSS = fontFamily === 'serif' ? 'Georgia, serif' : '-apple-system, sans-serif';
    }

    // Update ref for content hooks
    fontSettingsRef.current = {
      fontFamilyCSS,
      customFontDataURL,
      customFontFamily,
    };

    console.log('[useEpubReader] Applying styles:', {
      theme,
      fontSize,
      fontFamilyCSS,
      lineHeight,
      systemFontId,
      customFontId,
      customFontFamily,
    });

    // Apply base theme styles (non-font)
    rendition.themes.default({
      body: {
        'background-color': `${colors.bg} !important`,
        color: `${colors.text} !important`,
        'font-size': `${fontSize}px !important`,
        'line-height': `${lineHeight} !important`,
        padding: '2rem !important',
      },
      // Force all elements to inherit font-size to override epub's class-based sizes
      'body *': {
        'font-size': 'inherit !important',
      },
      // Force text-align on all elements (nuclear option, but needed for embedded CSS like .tx)
      'body, body *': {
        'text-align': 'justify !important',
      },
      p: {
        'margin-bottom': '1em !important',
      },
      // Preserve semantic formatting
      'code, pre, kbd, samp': {
        'text-align': 'left !important',
        'font-family': 'monospace !important',
      },
      'h1, h2, h3, h4, h5, h6': {
        'text-align': 'left !important', // Keep headings left-aligned
      },
      a: {
        color: `${colors.text} !important`,
        'text-decoration': 'underline !important',
      },
    });

    // Apply font using content hooks
    const applyFont = () => {
      try {
        const contents = rendition.getContents() as unknown as EpubContents[];
        contents.forEach((content: EpubContents) => {
          const doc = content.document;
          if (!doc) return;

          // Inject or update style tag
          let styleTag = doc.getElementById('user-font-style');
          if (!styleTag) {
            styleTag = doc.createElement('style');
            styleTag.id = 'user-font-style';
            doc.head.appendChild(styleTag);
          }

          // Build CSS using shared function
          const css = buildFontCSS(fontFamilyCSS, customFontDataURL, customFontFamily);
          styleTag.textContent = css;
        });
        console.log('[useEpubReader] Font applied via content hooks', customFontDataURL ? '(with @font-face)' : '');
      } catch (error) {
        // Use centralized error handler (silent for non-critical font application errors)
        const fontError = new FontApplicationError(
          `Failed to apply font to existing content: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'FONT_APPLICATION_FAILED'
        );
        handleFontError(fontError, '[useEpubReader]');
      }
    };

    // Apply immediately to existing content
    applyFont();

    // For custom fonts, re-display to ensure proper rendering
    if (customFontId && customFontFamily && customFontDataURL) {
      // Add a small delay to ensure @font-face is loaded and parsed by browser
      setTimeout(() => {
        try {
          if (rendition.currentLocation && typeof rendition.currentLocation === 'function') {
            const currentLoc = rendition.currentLocation() as unknown as EpubLocation;
            if (currentLoc?.start?.cfi) {
              rendition.display(currentLoc.start.cfi).then(() => {
                console.log('[useEpubReader] Re-displayed for custom font');
              }).catch((error) => {
                console.warn('[useEpubReader] Could not re-display for custom font:', error);
              });
            }
          }
        } catch (error) {
          console.warn('[useEpubReader] Could not get current location for re-display:', error);
        }
      }, FONT_CONSTANTS.FONT_LOAD_TIMEOUT_MS);
    }
  }, [rendition, theme, fontSize, fontFamily, systemFontId, customFontId, customFontFamily, customFontDataURL, lineHeight]);

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

    const handleRelocated = (location: EpubLocation) => {
      const cfi = location.start.cfi;
      const href = location.start.href;
      setCurrentLocation(cfi);

      // Calculate progress percentage (keep decimal precision for accurate calculations)
      const percentage = book?.locations?.percentageFromCfi(cfi) || 0;
      const progressPercent = percentage * 100;

      console.log('[useEpubReader] Location changed:', {
        cfi: cfi.substring(0, 50) + '...',
        href,
        percentage,
        progressPercent,
        hasLocations: !!book?.locations,
        totalLocations: book?.locations?.length()
      });

      setProgress(progressPercent);

      onLocationChange?.(cfi, percentage, href);
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
