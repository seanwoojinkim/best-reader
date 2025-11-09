import { useState, useEffect, useCallback } from 'react';
import type { Rendition } from 'epubjs';
import type { Highlight } from '@/types';
import type { HighlightColor } from '@/lib/constants';
import { HIGHLIGHT_COLORS } from '@/lib/constants';
import {
  addHighlight,
  getHighlights,
  updateHighlight,
  deleteHighlight,
} from '@/lib/db';

interface UseHighlightsProps {
  bookId: number;
  rendition: Rendition | null;
}

interface Selection {
  text: string;
  cfiRange: string;
  position: { x: number; y: number };
}

export function useHighlights({ bookId, rendition }: UseHighlightsProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [currentSelection, setCurrentSelection] = useState<Selection | null>(null);
  const [editingNote, setEditingNote] = useState<Highlight | null>(null);

  // Load existing highlights
  useEffect(() => {
    const loadHighlights = async () => {
      const existingHighlights = await getHighlights(bookId);
      setHighlights(existingHighlights);
    };

    loadHighlights();
  }, [bookId]);

  // Render highlights in epub.js
  useEffect(() => {
    if (!rendition || highlights.length === 0) return;

    // Clear existing annotations
    rendition.annotations.remove('*', 'highlight');

    // Add all highlights
    highlights.forEach((highlight) => {
      const color = HIGHLIGHT_COLORS[highlight.color];

      rendition.annotations.add(
        'highlight',
        highlight.cfiRange,
        {},
        (e: MouseEvent) => {
          // Only show note editor on Shift+click to allow normal page turns
          if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            setEditingNote(highlight);
          }
          // Normal clicks pass through to allow TapZones to handle page turns
        },
        'hl',
        {
          fill: color,
          'fill-opacity': '0.4',
          'mix-blend-mode': 'multiply',
        }
      );
    });
  }, [rendition, highlights]);

  // Listen for text selection
  useEffect(() => {
    if (!rendition) return;

    const handleSelected = (cfiRange: string, contents: any) => {
      if (!cfiRange) {
        setCurrentSelection(null);
        return;
      }

      const selection = contents.window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setCurrentSelection(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setCurrentSelection(null);
        return;
      }

      // Get position for menu
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const position = {
        x: rect.left + rect.width / 2,
        y: rect.top,
      };

      setCurrentSelection({
        text,
        cfiRange,
        position,
      });
    };

    rendition.on('selected', handleSelected);

    return () => {
      rendition.off('selected', handleSelected);
    };
  }, [rendition]);

  // Create a new highlight
  const createHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!currentSelection) return;

      try {
        const newHighlight = await addHighlight({
          bookId,
          cfiRange: currentSelection.cfiRange,
          text: currentSelection.text,
          color,
        });

        // Reload highlights to show the new one
        const updatedHighlights = await getHighlights(bookId);
        setHighlights(updatedHighlights);

        return newHighlight;
      } catch (error) {
        console.error('Failed to save highlight:', error);
        // TODO Phase 3: Show toast notification to user
      } finally {
        // Always clear selection to reset UI
        if (rendition) {
          rendition.annotations.remove(currentSelection.cfiRange, 'highlight');
        }
        setCurrentSelection(null);
      }
    },
    [bookId, currentSelection, rendition]
  );

  // Update highlight note
  const updateNote = useCallback(
    async (highlightId: number, note: string) => {
      try {
        await updateHighlight(highlightId, { note });

        // Reload highlights
        const updatedHighlights = await getHighlights(bookId);
        setHighlights(updatedHighlights);
        setEditingNote(null);
      } catch (error) {
        console.error('Failed to update highlight note:', error);
        // TODO Phase 3: Show toast notification to user
      }
    },
    [bookId]
  );

  // Remove a highlight
  const removeHighlight = useCallback(
    async (highlightId: number) => {
      try {
        await deleteHighlight(highlightId);

        // Reload highlights
        const updatedHighlights = await getHighlights(bookId);
        setHighlights(updatedHighlights);
        setEditingNote(null);
      } catch (error) {
        console.error('Failed to delete highlight:', error);
        // TODO Phase 3: Show toast notification to user
      }
    },
    [bookId]
  );

  // Change highlight color
  const changeColor = useCallback(
    async (highlightId: number, color: HighlightColor) => {
      try {
        await updateHighlight(highlightId, { color });

        // Reload highlights
        const updatedHighlights = await getHighlights(bookId);
        setHighlights(updatedHighlights);
      } catch (error) {
        console.error('Failed to change highlight color:', error);
        // TODO Phase 3: Show toast notification to user
      }
    },
    [bookId]
  );

  return {
    highlights,
    currentSelection,
    editingNote,
    createHighlight,
    updateNote,
    removeHighlight,
    changeColor,
    setCurrentSelection,
    setEditingNote,
  };
}
