import { useState, useCallback } from 'react';
import type { Chapter, OpenAIVoice, AudioFile, AudioChunk } from '@/types';
import {
  saveAudioFile,
  logAudioUsage,
  saveSentenceSyncData,
  saveChunkAndUpdateProgress,
  completeAudioFile
} from '@/lib/db';
import { getChapterText } from '@/lib/epub-utils';
import { parseChapterIntoSentences } from '@/lib/sentence-parser';
import { generateSentenceTimestamps } from '@/lib/duration-estimator';
import type { Book as EpubBook } from 'epubjs';

interface UseAudioGenerationProps {
  book: EpubBook | null;
}

interface GenerateAudioOptions {
  chapter: Chapter;
  voice: OpenAIVoice;
  speed?: number;
  onProgress?: (progress: number, message?: string) => void;
  onFirstChunkReady?: (chapterId: number, audioFileId: number) => void;
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
    onFirstChunkReady,
  }: GenerateAudioOptions): Promise<AudioFile | null> => {
    console.log('[useAudioGeneration] Starting generation for chapter:', chapter.title);

    if (!book || !chapter.id) {
      console.error('[useAudioGeneration] Invalid chapter or book', { book, chapterId: chapter.id });
      setError('Invalid chapter or book');
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

      // Step 2: Call streaming API (10% -> 90%)
      console.log('[useAudioGeneration] Calling streaming TTS API...', {
        voice,
        voiceType: typeof voice,
        speed,
        textLength: chapterText.length
      });

      const requestBody = {
        chapterText,
        voice,
        speed,
      };
      console.log('[useAudioGeneration] Request body:', JSON.stringify(requestBody).substring(0, 200));

      const response = await fetch('/api/tts/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to read streaming response');
      }

      let buffer = '';
      let audioFileId: number | null = null;
      const chunks: Array<Omit<AudioChunk, 'id'>> = [];
      let generationMetadata: any = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        if (controller.signal.aborted) {
          reader.cancel();
          throw new Error('Generation cancelled');
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventMatch = line.match(/^event: (\w+)\ndata: ([\s\S]+)$/);
          if (!eventMatch) continue;

          const [, eventType, dataStr] = eventMatch;
          const data = JSON.parse(dataStr);

          if (eventType === 'progress') {
            setProgress(data.progress);
            if (onProgress) onProgress(data.progress, data.message);
            console.log(`[useAudioGeneration] Progress: ${data.progress}% - ${data.message}`);
          } else if (eventType === 'audio_chunk') {
            // NEW: Handle individual audio chunk
            console.log(`[useAudioGeneration] Received chunk ${data.index + 1}/${data.total}`);

            // Convert chunk base64 to Blob
            const chunkBlob = base64ToBlob(data.data, 'audio/mpeg');

            // Calculate startTime for this chunk (sum of previous chunk durations)
            const startTime = chunks.reduce((sum, c) => sum + c.duration, 0);

            // Create AudioFile metadata on first chunk
            if (data.index === 0) {
              const audioFile: Omit<AudioFile, 'id'> = {
                chapterId: chapter.id,
                duration: 0, // Will update on completion
                voice: voice,
                speed: speed,
                generatedAt: new Date(),
                sizeBytes: 0, // Will update on completion
                totalChunks: data.total,
                chunksComplete: 0,
                isComplete: false,
                isProgressive: true,
              };

              audioFileId = await saveAudioFile(audioFile);
              console.log(`[useAudioGeneration] Created audio file metadata, ID: ${audioFileId}`);
            }

            // Save chunk to IndexedDB using atomic transaction
            const chunk: Omit<AudioChunk, 'id'> = {
              audioFileId: audioFileId!,
              chunkIndex: data.index,
              blob: chunkBlob,
              duration: data.estimatedDuration,
              textStart: data.textStart,
              textEnd: data.textEnd,
              startTime: startTime,
              generatedAt: new Date(),
            };

            await saveChunkAndUpdateProgress(chunk, data.index + 1);
            chunks.push(chunk);

            console.log(`[useAudioGeneration] Saved chunk ${data.index} to IndexedDB`);

            // NEW: Trigger playback after first chunk
            if (data.index === 0 && onFirstChunkReady && chapter.id && audioFileId) {
              console.log('[useAudioGeneration] First chunk ready, triggering callback');
              onFirstChunkReady(chapter.id, audioFileId);
            }
          } else if (eventType === 'generation_complete') {
            // NEW: Handle generation completion
            generationMetadata = data;
            console.log('[useAudioGeneration] Generation complete:', data);

            // Update audio file with final metadata
            if (audioFileId) {
              const totalSizeBytes = chunks.reduce((sum, c) => sum + c.blob.size, 0);
              await completeAudioFile(
                audioFileId,
                data.totalDuration,
                totalSizeBytes
              );
            }
          } else if (eventType === 'result') {
            // KEEP: For backwards compatibility (ignored in progressive mode)
            console.log('[useAudioGeneration] Received result event (backwards compatibility)');
          } else if (eventType === 'error') {
            throw new Error(data.error);
          }
        }
      }

      // Validate we got all the data
      if (!audioFileId || chunks.length === 0) {
        throw new Error('No chunks received from streaming API');
      }

      if (!generationMetadata) {
        throw new Error('No generation metadata received');
      }

      setProgress(90);

      // Log usage
      await logAudioUsage({
        chapterId: chapter.id,
        bookId: chapter.bookId,
        charCount: generationMetadata.charCount,
        cost: generationMetadata.cost,
        voice: generationMetadata.voice,
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
          generationMetadata.totalDuration
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

      // Return the completed audio file metadata
      const completedAudioFile: AudioFile = {
        id: audioFileId,
        chapterId: chapter.id,
        duration: generationMetadata.totalDuration,
        voice: voice,
        speed: speed,
        generatedAt: new Date(),
        sizeBytes: chunks.reduce((sum, c) => sum + c.blob.size, 0),
        totalChunks: generationMetadata.totalChunks,
        chunksComplete: generationMetadata.totalChunks,
        isComplete: true,
        completedAt: new Date(),
        isProgressive: true,
      };

      return completedAudioFile;
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
