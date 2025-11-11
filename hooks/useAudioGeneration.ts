import { useState, useCallback } from 'react';
import type { Chapter, OpenAIVoice, AudioFile } from '@/types';
import { saveAudioFile, logAudioUsage, saveSentenceSyncData } from '@/lib/db';
import { getChapterText } from '@/lib/epub-utils';
import { parseChapterIntoSentences } from '@/lib/sentence-parser';
import { generateSentenceTimestamps } from '@/lib/duration-estimator';
import { generateTTS, hasApiKey } from '@/lib/tts-client';
import type { Book as EpubBook } from 'epubjs';

interface UseAudioGenerationProps {
  book: EpubBook | null;
}

interface GenerateAudioOptions {
  chapter: Chapter;
  voice: OpenAIVoice;
  speed?: number;
  onProgress?: (progress: number, message?: string) => void;
}

interface UseAudioGenerationResult {
  generating: boolean;
  progress: number; // 0-100
  error: string | null;
  generateAudio: (options: GenerateAudioOptions) => Promise<AudioFile | null>;
  cancelGeneration: () => void;
}

export function useAudioGeneration({ book }: UseAudioGenerationProps): UseAudioGenerationResult {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const generateAudio = useCallback(async ({
    chapter,
    voice,
    speed = 1.0,
    onProgress,
  }: GenerateAudioOptions): Promise<AudioFile | null> => {
    console.log('[useAudioGeneration] Starting generation for chapter:', chapter.title);

    if (!book || !chapter.id) {
      console.error('[useAudioGeneration] Invalid chapter or book', { book, chapterId: chapter.id });
      setError('Invalid chapter or book');
      return null;
    }

    // Check if API key is configured
    const keyConfigured = await hasApiKey();
    if (!keyConfigured) {
      setError('OpenAI API key not configured. Please add your API key in settings.');
      return null;
    }

    setGenerating(true);
    setProgress(10);
    setError(null);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Step 1: Extract chapter text (10%)
      setProgress(10);
      if (onProgress) onProgress(10, 'Extracting chapter text');
      console.log('[useAudioGeneration] Extracting chapter text...', { cfiStart: chapter.cfiStart, cfiEnd: chapter.cfiEnd });
      const chapterText = await getChapterText(book, chapter.cfiStart, chapter.cfiEnd);
      console.log('[useAudioGeneration] Extracted text length:', chapterText.length);

      if (controller.signal.aborted) {
        throw new Error('Generation cancelled');
      }

      // Step 2: Generate TTS audio client-side (10% -> 90%)
      console.log('[useAudioGeneration] Generating TTS audio client-side...', {
        voice,
        speed,
        textLength: chapterText.length
      });

      const result = await generateTTS({
        text: chapterText,
        voice,
        speed,
        onProgress: (progress, message) => {
          // Map client progress (0-100) to our progress range (10-90)
          const mappedProgress = 10 + (progress * 0.8);
          setProgress(mappedProgress);
          if (onProgress) onProgress(mappedProgress, message);
        },
      });

      if (!result.success || !result.audioData) {
        throw new Error(result.error || 'Failed to generate audio');
      }

      if (controller.signal.aborted) {
        throw new Error('Generation cancelled');
      }

      // Destructure after validation - TypeScript can narrow these types
      const { audioData, duration, cost, charCount, sizeBytes, voice: resultVoice, speed: resultSpeed } = result;

      // Step 3: Convert base64 to ArrayBuffer only (90%)
      console.log('[useAudioGeneration] Converting audio to ArrayBuffer for iOS compatibility...');
      const audioBlob = base64ToBlob(audioData, 'audio/mpeg');
      const audioBuffer = await audioBlob.arrayBuffer(); // Store ArrayBuffer for iOS persistence
      console.log('[useAudioGeneration] Audio buffer size:', audioBuffer.byteLength);
      setProgress(90);

      // Step 4: Save to IndexedDB with only ArrayBuffer (90% -> 100%)
      // Note: We create a temporary Blob just for type compatibility, but only store the buffer
      const tempBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioFile: Omit<AudioFile, 'id'> = {
        chapterId: chapter.id,
        blob: tempBlob, // Temporary Blob for compatibility (not persisted properly on iOS)
        buffer: audioBuffer, // ONLY this persists on iOS - 37MB instead of 74MB
        duration: duration!,
        voice: resultVoice!,
        speed: resultSpeed!,
        generatedAt: new Date(),
        sizeBytes: sizeBytes!,
      };

      console.log('[useAudioGeneration] Saving audio file to IndexedDB (ArrayBuffer only for iOS)...');
      const audioFileId = await saveAudioFile(audioFile);

      // Log usage
      await logAudioUsage({
        chapterId: chapter.id,
        bookId: chapter.bookId,
        charCount: charCount!,
        cost: cost!,
        voice: resultVoice!,
        timestamp: new Date(),
      });

      // Step 5: Generate sentence sync data (90% -> 95%)
      try {
        setProgress(92);
        if (onProgress) onProgress(92, 'Generating sentence synchronization data');
        console.log('[useAudioGeneration] Parsing sentences for synchronization...');

        const parsedSentences = parseChapterIntoSentences(chapterText);
        console.log(`[useAudioGeneration] Parsed ${parsedSentences.length} sentences`);

        const sentenceMetadata = generateSentenceTimestamps(
          parsedSentences,
          duration!
        );

        await saveSentenceSyncData({
          audioFileId: audioFileId,
          chapterId: chapter.id,
          sentences: sentenceMetadata,
          generatedAt: new Date(),
          version: 1,
        });

        console.log(`[useAudioGeneration] Saved ${sentenceMetadata.length} sentences for sync`);
        setProgress(95);
      } catch (sentenceError) {
        // Don't fail audio generation if sentence parsing fails
        console.error('[useAudioGeneration] Failed to generate sentence sync data:', sentenceError);
        // Continue anyway - audio will work without sentence sync
      }

      setProgress(100);
      setGenerating(false);
      setAbortController(null);

      return { ...audioFile, id: audioFileId };
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Generation cancelled') {
        setError('Generation cancelled');
      } else {
        console.error('Audio generation error:', err);
        setError(err.message || 'Failed to generate audio');
      }

      setGenerating(false);
      setProgress(0);
      setAbortController(null);
      return null;
    }
  }, [book]);

  const cancelGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setGenerating(false);
      setProgress(0);
      setError('Generation cancelled');
    }
  }, [abortController]);

  return {
    generating,
    progress,
    error,
    generateAudio,
    cancelGeneration,
  };
}

// Helper function to convert base64 to Blob
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}
