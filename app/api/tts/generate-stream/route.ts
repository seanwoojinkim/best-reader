import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import type { OpenAIVoice } from '@/types';

// Initialize OpenAI client lazily to avoid build-time errors
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured in environment variables');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { chapterText, voice, speed } = await request.json();

    console.log('[TTS API Stream] Received request:', {
      textLength: chapterText?.length,
      voice,
      speed,
      voiceType: typeof voice
    });

    // Validate input
    if (!chapterText || typeof chapterText !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid chapter text' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate text length to prevent excessive API costs
    const MAX_CHAPTER_LENGTH = 100000; // ~25,000 words, ~$1.50 TTS cost
    if (chapterText.length > MAX_CHAPTER_LENGTH) {
      console.warn('[TTS API Stream] Chapter text exceeds maximum length:', {
        length: chapterText.length,
        maxLength: MAX_CHAPTER_LENGTH,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Chapter text is too long (${chapterText.length} characters). Maximum allowed is ${MAX_CHAPTER_LENGTH} characters. Please split this chapter into smaller sections.`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Sanitize input - remove control characters and null bytes
    const sanitizedText = chapterText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (sanitizedText !== chapterText) {
      console.warn('[TTS API Stream] Removed control characters from input');
    }

    if (!voice || !isValidVoice(voice)) {
      console.error('[TTS API Stream] Invalid voice:', { voice, isValid: isValidVoice(voice) });
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid voice selection: ${voice}. Valid voices: alloy, echo, fable, onyx, nova, shimmer`
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const validSpeed = Math.max(0.25, Math.min(4.0, speed || 1.0));

    // OpenAI TTS has a 4096 character limit - split into chunks if needed
    const MAX_CHARS = 4096;
    const chunks: string[] = [];

    if (sanitizedText.length <= MAX_CHARS) {
      chunks.push(sanitizedText);
    } else {
      console.log(`[TTS API Stream] Splitting chapter into chunks (${sanitizedText.length} chars)`);
      let remainingText = sanitizedText;

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

        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation, lastParagraph);

        if (lastSentenceEnd > MAX_CHARS * 0.7) {
          // Use sentence boundary if it's in the last 30%
          chunkText = chunkText.substring(0, lastSentenceEnd + 2);
        }

        chunks.push(chunkText);
        remainingText = remainingText.substring(chunkText.length).trim();
      }

      console.log(`[TTS API Stream] Split into ${chunks.length} chunks`);
    }

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          const totalChunks = chunks.length;
          sendEvent('progress', {
            type: 'init',
            progress: 10,
            message: 'Starting TTS generation',
            totalChunks
          });

          sendEvent('progress', {
            type: 'chunks',
            progress: 30,
            message: `Processing ${totalChunks} chunk${totalChunks > 1 ? 's' : ''}`,
            totalChunks,
            currentChunk: 0
          });

          const audioBuffers: Buffer[] = [];
          const chunkTextOffsets: { start: number; end: number }[] = [];

          // Calculate text offsets for each chunk
          let currentOffset = 0;
          for (const chunk of chunks) {
            chunkTextOffsets.push({
              start: currentOffset,
              end: currentOffset + chunk.length,
            });
            currentOffset += chunk.length;
          }

          for (let i = 0; i < chunks.length; i++) {
            // Progress from 30% to 80% based on chunk completion
            const chunkProgress = 30 + Math.floor((i / totalChunks) * 50);

            sendEvent('progress', {
              type: 'chunk_start',
              progress: chunkProgress,
              message: `Generating chunk ${i + 1} of ${totalChunks}`,
              totalChunks,
              currentChunk: i + 1
            });

            console.log(`[TTS API Stream] Generating chunk ${i + 1}/${totalChunks} (${chunks[i].length} chars)`);

            const openai = getOpenAIClient();
            const response = await openai.audio.speech.create({
              model: 'tts-1',
              voice: voice,
              input: chunks[i],
              response_format: 'mp3',
              speed: validSpeed,
            });

            const buffer = Buffer.from(await response.arrayBuffer());
            audioBuffers.push(buffer);

            // NEW: Stream chunk immediately (don't wait for concatenation)
            const estimatedDuration = estimateChunkDuration(chunks[i], validSpeed);
            sendEvent('audio_chunk', {
              index: i,
              total: totalChunks,
              data: buffer.toString('base64'),
              textStart: chunkTextOffsets[i].start,
              textEnd: chunkTextOffsets[i].end,
              estimatedDuration: estimatedDuration,
              isFirst: i === 0,
              sizeBytes: buffer.length,
            });

            const completedProgress = 30 + Math.floor(((i + 1) / totalChunks) * 50);
            sendEvent('progress', {
              type: 'chunk_complete',
              progress: completedProgress,
              message: `Chunk ${i + 1} of ${totalChunks} streamed`,
              totalChunks,
              currentChunk: i + 1
            });

            console.log(`[TTS API Stream] Chunk ${i + 1}/${totalChunks} streamed to client`);
          }

          sendEvent('progress', {
            type: 'concat',
            progress: 80,
            message: 'Combining audio chunks'
          });

          // Concatenate all audio buffers
          const buffer = Buffer.concat(audioBuffers);

          // Calculate metadata
          const charCount = sanitizedText.length;
          const cost = (charCount / 1000) * 0.015;
          const sizeBytes = buffer.length;
          const wordCount = sanitizedText.split(/\s+/).length;
          const durationSeconds = Math.ceil((wordCount / 150) * 60 / validSpeed);

          sendEvent('progress', {
            type: 'complete',
            progress: 90,
            message: 'Audio generation complete'
          });

          // NEW: Send generation_complete event for progressive streaming
          sendEvent('generation_complete', {
            success: true,
            totalChunks: totalChunks,
            totalDuration: durationSeconds,
            cost,
            charCount,
            voice,
            speed: validSpeed,
          });

          // Send final result (for backwards compatibility with single-blob mode)
          sendEvent('result', {
            success: true,
            audioData: buffer.toString('base64'),
            duration: durationSeconds,
            cost,
            charCount,
            sizeBytes,
            voice,
            speed: validSpeed,
          });

          sendEvent('progress', {
            type: 'done',
            progress: 100,
            message: 'Complete'
          });

          controller.close();
        } catch (error: any) {
          console.error('[TTS API Stream] Error:', error);

          sendEvent('error', {
            success: false,
            error: error?.message || 'Failed to generate audio',
          });

          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('[TTS API Stream] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to generate audio',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

function isValidVoice(voice: string): voice is OpenAIVoice {
  const validVoices: OpenAIVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  return validVoices.includes(voice as OpenAIVoice);
}

/**
 * Estimate chunk duration based on text length and speed
 * Uses average reading speed of 150 words per minute
 */
function estimateChunkDuration(text: string, speed: number): number {
  const wordCount = text.split(/\s+/).length;
  const durationSeconds = Math.ceil((wordCount / 150) * 60 / speed);
  return durationSeconds;
}
