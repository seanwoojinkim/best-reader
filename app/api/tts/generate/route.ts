import { NextRequest, NextResponse } from 'next/server';
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
  try {
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.',
        },
        { status: 503 }
      );
    }

    const { chapterText, voice, speed } = await request.json();

    // Validate input
    if (!chapterText || typeof chapterText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid chapter text' },
        { status: 400 }
      );
    }

    if (!voice || !isValidVoice(voice)) {
      return NextResponse.json(
        { success: false, error: 'Invalid voice selection' },
        { status: 400 }
      );
    }

    const validSpeed = Math.max(0.25, Math.min(4.0, speed || 1.0));

    // OpenAI TTS has a 4096 character limit - split into chunks if needed
    const MAX_CHARS = 4096;
    const chunks: string[] = [];

    if (chapterText.length <= MAX_CHARS) {
      chunks.push(chapterText);
    } else {
      console.log(`[TTS API] Splitting chapter into chunks (${chapterText.length} chars)`);
      let remainingText = chapterText;

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
          chunkText = chunkText.substring(0, lastSentenceEnd + 2); // Include punctuation and space
        }

        chunks.push(chunkText);
        remainingText = remainingText.substring(chunkText.length).trim();
      }

      console.log(`[TTS API] Split into ${chunks.length} chunks`);
    }

    // Generate audio for each chunk and concatenate
    const audioBuffers: Buffer[] = [];
    const totalChunks = chunks.length;

    const openai = getOpenAIClient();

    for (let i = 0; i < chunks.length; i++) {
      console.log(`[TTS API] Generating chunk ${i + 1}/${totalChunks} (${chunks[i].length} chars)`);

      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice,
        input: chunks[i],
        response_format: 'mp3',
        speed: validSpeed,
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      audioBuffers.push(buffer);

      console.log(`[TTS API] Chunk ${i + 1}/${totalChunks} complete`);
    }

    // Concatenate all audio buffers
    const buffer = Buffer.concat(audioBuffers);

    // Calculate metadata based on full text
    const charCount = chapterText.length;
    const cost = (charCount / 1000) * 0.015; // $0.015 per 1K chars
    const sizeBytes = buffer.length;

    // Estimate duration (150 words/min average, adjusted by speed)
    const wordCount = chapterText.split(/\s+/).length;
    const durationSeconds = Math.ceil((wordCount / 150) * 60 / validSpeed);

    // Return audio data as base64 (to be converted to Blob on client)
    return NextResponse.json({
      success: true,
      audioData: buffer.toString('base64'),
      duration: durationSeconds,
      cost,
      charCount,
      sizeBytes,
      voice,
      speed: validSpeed,
    });
  } catch (error: any) {
    console.error('TTS generation error:', error);

    // Handle rate limits
    if (error?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error?.headers?.['retry-after'] || 60,
        },
        { status: 429 }
      );
    }

    // Handle other API errors
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to generate audio',
      },
      { status: 500 }
    );
  }
}

function isValidVoice(voice: string): voice is OpenAIVoice {
  const validVoices: OpenAIVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  return validVoices.includes(voice as OpenAIVoice);
}
