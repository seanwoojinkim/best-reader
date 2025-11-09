import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { OpenAIVoice } from '@/types';

// Validate API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not configured in environment variables');
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    // Call OpenAI TTS API
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: chapterText,
      response_format: 'mp3',
      speed: validSpeed,
    });

    // Convert response to buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Calculate metadata
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
