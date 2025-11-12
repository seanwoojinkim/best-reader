/**
 * Client-Side TTS Service
 *
 * Handles TTS generation directly from the browser using OpenAI SDK.
 * API key is stored securely using Capacitor Preferences.
 *
 * IMPORTANT: This runs in the browser, not on a server.
 * The dangerouslyAllowBrowser flag is intentional for this use case.
 */

import OpenAI from 'openai';
import { Preferences } from '@capacitor/preferences';
import pLimit from 'p-limit';
import type { OpenAIVoice } from '@/types';

const API_KEY_STORAGE_KEY = 'openai_api_key';

// Concurrency configuration for parallel chunk processing
// Adjust based on your OpenAI API tier:
// - Free tier: 3 (rate limit: 3 RPM)
// - Tier 1: 5-10 (rate limit: ~10-20 RPM)
// - Tier 2+: 10-20 (rate limit: 50+ RPM)
const MAX_CONCURRENT_REQUESTS = 5;

// Retry configuration for failed chunks
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second base delay

/**
 * Get stored OpenAI API key from secure storage
 */
export async function getApiKey(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: API_KEY_STORAGE_KEY });
    return value;
  } catch (error) {
    console.error('[TTS Client] Error retrieving API key:', error);
    return null;
  }
}

/**
 * Store OpenAI API key in secure storage
 */
export async function setApiKey(apiKey: string): Promise<void> {
  try {
    await Preferences.set({ key: API_KEY_STORAGE_KEY, value: apiKey });
  } catch (error) {
    console.error('[TTS Client] Error storing API key:', error);
    throw new Error('Failed to store API key');
  }
}

/**
 * Remove stored API key
 */
export async function clearApiKey(): Promise<void> {
  try {
    await Preferences.remove({ key: API_KEY_STORAGE_KEY });
  } catch (error) {
    console.error('[TTS Client] Error removing API key:', error);
    throw new Error('Failed to remove API key');
  }
}

/**
 * Check if API key is configured
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return !!key && key.length > 0;
}

/**
 * Create OpenAI client instance with stored API key
 */
async function createOpenAIClient(): Promise<OpenAI> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please add your API key in settings.');
  }

  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage
  });
}

interface GenerateTTSOptions {
  text: string;
  voice: OpenAIVoice;
  speed?: number;
  onProgress?: (progress: number, message: string) => void;
}

interface GenerateTTSResult {
  success: boolean;
  audioData?: string; // base64 encoded audio
  duration?: number;
  cost?: number;
  charCount?: number;
  sizeBytes?: number;
  voice?: OpenAIVoice;
  speed?: number;
  error?: string;
}

interface ChunkResult {
  index: number;
  audioBuffer: ArrayBuffer;
  success: boolean;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate TTS audio client-side using OpenAI API
 *
 * This function handles:
 * - Text chunking (OpenAI has a 4096 character limit)
 * - Audio generation per chunk
 * - Concatenation of audio chunks
 * - Progress reporting
 * - Cost calculation
 */
export async function generateTTS({
  text,
  voice,
  speed = 1.0,
  onProgress,
}: GenerateTTSOptions): Promise<GenerateTTSResult> {
  try {
    // Validate input
    if (!text || typeof text !== 'string') {
      return { success: false, error: 'Invalid text provided' };
    }

    if (!voice) {
      return { success: false, error: 'Voice selection required' };
    }

    const validSpeed = Math.max(0.25, Math.min(4.0, speed));

    // Create OpenAI client
    if (onProgress) onProgress(5, 'Initializing...');
    const openai = await createOpenAIClient();

    // Split text into chunks if needed (OpenAI limit: 4096 chars)
    const MAX_CHARS = 4096;
    const chunks: string[] = [];

    if (text.length <= MAX_CHARS) {
      chunks.push(text);
    } else {
      console.log(`[TTS Client] Splitting text into chunks (${text.length} chars)`);
      let remainingText = text;

      while (remainingText.length > 0) {
        if (remainingText.length <= MAX_CHARS) {
          chunks.push(remainingText);
          break;
        }

        // Find a good breaking point (sentence boundary)
        let chunkText = remainingText.substring(0, MAX_CHARS);
        const lastPeriod = chunkText.lastIndexOf('. ');
        const lastQuestion = chunkText.lastIndexOf('? ');
        const lastExclamation = chunkText.lastIndexOf('! ');
        const lastParagraph = chunkText.lastIndexOf('\n\n');

        const lastSentenceEnd = Math.max(
          lastPeriod,
          lastQuestion,
          lastExclamation,
          lastParagraph
        );

        if (lastSentenceEnd > MAX_CHARS * 0.7) {
          // Use sentence boundary if it's in the last 30%
          chunkText = chunkText.substring(0, lastSentenceEnd + 2); // Include punctuation and space
        }

        chunks.push(chunkText);
        remainingText = remainingText.substring(chunkText.length).trim();
      }

      console.log(`[TTS Client] Split into ${chunks.length} chunks`);
    }

    // Generate audio for each chunk in parallel with controlled concurrency
    const totalChunks = chunks.length;
    const limit = pLimit(MAX_CONCURRENT_REQUESTS);
    let completedChunks = 0;

    console.log(`[TTS Client] Starting parallel generation of ${totalChunks} chunks with ${MAX_CONCURRENT_REQUESTS} concurrent requests`);

    // Create parallel chunk generation tasks with retry logic
    const chunkPromises = chunks.map((chunk, index) =>
      limit(async (): Promise<ChunkResult> => {
        let lastError: any;

        // Retry loop with exponential backoff
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const attemptLabel = attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : '';
            console.log(`[TTS Client] Generating chunk ${index + 1}/${totalChunks}${attemptLabel} (${chunk.length} chars)`);

            const response = await openai.audio.speech.create({
              model: 'tts-1',
              voice: voice,
              input: chunk,
              response_format: 'mp3',
              speed: validSpeed,
            });

            const chunkAudioBuffer = await response.arrayBuffer();
            completedChunks++;

            // Update progress
            const progressPercent = 10 + ((completedChunks / totalChunks) * 70);
            if (onProgress) {
              onProgress(
                progressPercent,
                `Generated ${completedChunks}/${totalChunks} chunks`
              );
            }

            console.log(`[TTS Client] Chunk ${index + 1}/${totalChunks} complete`);

            return {
              index,
              audioBuffer: chunkAudioBuffer,
              success: true,
            };
          } catch (error: any) {
            lastError = error;

            // Don't retry auth errors
            if (error?.status === 401) {
              console.error(`[TTS Client] Chunk ${index + 1} auth error - not retrying`);
              throw error;
            }

            // Retry rate limits and server errors
            if (attempt < MAX_RETRIES && (error?.status === 429 || error?.status >= 500)) {
              // Calculate delay: exponential backoff or use retry-after header
              const retryAfterMs = error?.headers?.['retry-after']
                ? parseInt(error.headers['retry-after']) * 1000
                : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);

              console.warn(`[TTS Client] Chunk ${index + 1} failed (${error?.status}), retrying in ${retryAfterMs}ms...`);
              await sleep(retryAfterMs);
              continue;
            }

            // Out of retries or non-retryable error
            console.error(`[TTS Client] Chunk ${index + 1} failed after ${attempt + 1} attempts:`, error);
            throw error;
          }
        }

        // Should never reach here, but TypeScript requires it
        throw lastError;
      })
    );

    // Wait for all chunks to complete
    const results = await Promise.allSettled(chunkPromises);

    // Separate successful and failed chunks
    const successfulChunks = results
      .filter((r): r is PromiseFulfilledResult<ChunkResult> => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => a.index - b.index);

    const failedChunks = results
      .map((r, index) => ({ result: r, index }))
      .filter(({ result }) => result.status === 'rejected');

    // Handle failures
    if (failedChunks.length > 0) {
      const failedIndices = failedChunks.map(({ index }) => index + 1).join(', ');
      console.error(`[TTS Client] Failed chunks: ${failedIndices}`);

      // If any chunk failed, return error
      const firstError = failedChunks[0].result as PromiseRejectedResult;
      throw firstError.reason;
    }

    // Extract audio buffers in order
    const audioBuffers = successfulChunks.map(chunk => chunk.audioBuffer);

    // Concatenate audio buffers
    if (onProgress) onProgress(85, 'Combining audio chunks...');
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of audioBuffers) {
      combinedBuffer.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    // Convert to base64
    if (onProgress) onProgress(90, 'Finalizing...');
    const base64Audio = arrayBufferToBase64(combinedBuffer.buffer);

    // Calculate metadata
    const charCount = text.length;
    const cost = (charCount / 1000) * 0.015; // $0.015 per 1K chars
    const sizeBytes = combinedBuffer.byteLength;

    // Estimate duration (150 words/min average, adjusted by speed)
    const wordCount = text.split(/\s+/).length;
    const durationSeconds = Math.ceil((wordCount / 150) * 60 / validSpeed);

    if (onProgress) onProgress(100, 'Complete!');

    return {
      success: true,
      audioData: base64Audio,
      duration: durationSeconds,
      cost,
      charCount,
      sizeBytes,
      voice,
      speed: validSpeed,
    };
  } catch (error: any) {
    console.error('[TTS Client] Generation error:', error);

    // Handle rate limits
    if (error?.status === 429) {
      return {
        success: false,
        error: 'Rate limit exceeded. Please wait a moment and try again.',
      };
    }

    // Handle authentication errors
    if (error?.status === 401) {
      return {
        success: false,
        error: 'Invalid API key. Please check your OpenAI API key in settings.',
      };
    }

    return {
      success: false,
      error: error?.message || 'Failed to generate audio. Please try again.',
    };
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
