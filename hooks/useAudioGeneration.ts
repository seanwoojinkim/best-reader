import { useState, useCallback } from 'react';
import type { Chapter, OpenAIVoice, AudioFile } from '@/types';
import { saveAudioFile, logAudioUsage } from '@/lib/db';
import { getChapterText } from '@/lib/epub-utils';
import type { Book as EpubBook } from 'epubjs';

interface UseAudioGenerationProps {
  book: EpubBook | null;
}

interface GenerateAudioOptions {
  chapter: Chapter;
  voice: OpenAIVoice;
  speed?: number;
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
  }: GenerateAudioOptions): Promise<AudioFile | null> => {
    if (!book || !chapter.id) {
      setError('Invalid chapter or book');
      return null;
    }

    setGenerating(true);
    setProgress(10);
    setError(null);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Step 1: Extract chapter text (10% -> 30%)
      setProgress(10);
      const chapterText = await getChapterText(book, chapter.cfiStart, chapter.cfiEnd);

      if (controller.signal.aborted) {
        throw new Error('Generation cancelled');
      }

      setProgress(30);

      // Step 2: Call API (30% -> 80%)
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterText,
          voice,
          speed,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      setProgress(80);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      // Step 3: Convert base64 to Blob (80% -> 90%)
      const audioBlob = base64ToBlob(data.audioData, 'audio/mpeg');

      setProgress(90);

      // Step 4: Save to IndexedDB (90% -> 100%)
      const audioFile: Omit<AudioFile, 'id'> = {
        chapterId: chapter.id,
        blob: audioBlob,
        duration: data.duration,
        voice: data.voice,
        speed: data.speed,
        generatedAt: new Date(),
        sizeBytes: data.sizeBytes,
      };

      const audioFileId = await saveAudioFile(audioFile);

      // Log usage
      await logAudioUsage({
        chapterId: chapter.id,
        bookId: chapter.bookId,
        charCount: data.charCount,
        cost: data.cost,
        voice: data.voice,
        timestamp: new Date(),
      });

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
