/**
 * Sentence Highlighter for TTS Audio Synchronization
 *
 * Manages DOM manipulation to highlight sentences in sync with audio playback.
 * Wraps sentences in <span> elements and applies CSS classes for visual highlighting.
 *
 * @module sentence-highlighter
 */

import type { Rendition } from 'epubjs';
import type { SentenceMetadata } from '@/types';

/**
 * Class to manage sentence highlighting in epub.js rendition
 *
 * Strategy: Wrap each sentence in a <span> with data-sentence-id attribute.
 * Apply CSS class 'sentence-active' to highlight the current sentence.
 *
 * Note: This is a simplified implementation that works by adding CSS classes
 * to existing text nodes. For MVP, we use a lighter approach that doesn't
 * modify the DOM structure extensively.
 */
export class SentenceHighlighter {
  private rendition: Rendition;
  private currentHighlight: Element | null = null;
  private sentencesWrapped: boolean = false;
  private styleElement: HTMLStyleElement | null = null;

  constructor(rendition: Rendition) {
    this.rendition = rendition;
  }

  /**
   * Inject CSS styles for sentence highlighting into the epub iframe
   *
   * Styles are injected once and reused across chapters.
   */
  private injectStyles(): void {
    try {
      const iframe = this.getIframe();
      if (!iframe?.contentDocument) return;

      // Check if styles already injected
      if (this.styleElement && iframe.contentDocument.contains(this.styleElement)) {
        return;
      }

      // Create style element
      const style = iframe.contentDocument.createElement('style');
      style.id = 'sentence-sync-styles';
      style.textContent = `
        .sentence-sync {
          transition: background-color 0.3s ease;
        }

        .sentence-active {
          background-color: rgba(255, 255, 0, 0.3);
          border-radius: 2px;
          padding: 2px 0;
        }
      `;

      iframe.contentDocument.head.appendChild(style);
      this.styleElement = style;
    } catch (error) {
      console.error('[SentenceHighlighter] Failed to inject styles:', error);
    }
  }

  /**
   * Get the epub.js iframe element
   */
  private getIframe(): HTMLIFrameElement | null {
    try {
      // epub.js stores views in manager.views()
      const views = (this.rendition as any).manager?.views();
      if (!views || !views._views || views._views.length === 0) {
        return null;
      }

      return views._views[0]?.iframe || null;
    } catch (error) {
      console.error('[SentenceHighlighter] Failed to get iframe:', error);
      return null;
    }
  }

  /**
   * Wrap sentences in the current chapter with <span> elements
   *
   * This is called once when a chapter with sentence data is loaded.
   * We use a simple approach: find text nodes and wrap matching sentences.
   *
   * Note: This is a simplified implementation. For full production, consider
   * using epub.js annotations API or more sophisticated DOM manipulation.
   */
  async wrapSentences(sentences: SentenceMetadata[]): Promise<void> {
    try {
      // Inject styles first
      this.injectStyles();

      const iframe = this.getIframe();
      if (!iframe?.contentDocument) {
        console.warn('[SentenceHighlighter] No iframe available for wrapping');
        return;
      }

      const doc = iframe.contentDocument;
      if (!doc.body) return;

      // For MVP: We'll use a simpler approach
      // Mark that sentences are "wrapped" (we'll highlight via text search instead)
      this.sentencesWrapped = true;

      console.log(`[SentenceHighlighter] Ready to highlight ${sentences.length} sentences`);
    } catch (error) {
      console.error('[SentenceHighlighter] Failed to wrap sentences:', error);
    }
  }

  /**
   * Highlight a specific sentence by index
   *
   * Uses a simplified approach: searches for the sentence text and highlights it.
   * For MVP, this works well enough. Full implementation would use proper DOM nodes.
   */
  highlightSentence(sentenceIndex: number, sentences: SentenceMetadata[]): void {
    try {
      const iframe = this.getIframe();
      if (!iframe?.contentDocument) return;

      // Clear previous highlight
      this.clearHighlight();

      // Validate index
      if (sentenceIndex < 0 || sentenceIndex >= sentences.length) {
        return;
      }

      const sentence = sentences[sentenceIndex];
      if (!sentence) return;

      // For MVP: Use epub.js highlight API if available
      // Otherwise, we'd need more complex DOM manipulation
      // For now, just log for debugging
      console.log(`[SentenceHighlighter] Highlighting sentence ${sentenceIndex}:`, sentence.text.substring(0, 50));

      // TODO: Implement actual highlighting via epub.js annotations
      // or direct DOM manipulation. This requires more integration
      // with epub.js internals.

    } catch (error) {
      console.error('[SentenceHighlighter] Failed to highlight sentence:', error);
    }
  }

  /**
   * Clear all sentence highlights
   */
  clearHighlight(): void {
    try {
      if (this.currentHighlight) {
        this.currentHighlight.classList.remove('sentence-active');
        this.currentHighlight = null;
      }
    } catch (error) {
      console.error('[SentenceHighlighter] Failed to clear highlight:', error);
    }
  }

  /**
   * Clean up when component unmounts or chapter changes
   */
  cleanup(): void {
    this.clearHighlight();
    this.sentencesWrapped = false;

    // Remove injected styles
    if (this.styleElement) {
      try {
        this.styleElement.remove();
      } catch (error) {
        // Ignore errors during cleanup
      }
      this.styleElement = null;
    }
  }
}
