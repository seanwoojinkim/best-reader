import { NextRequest, NextResponse } from 'next/server';
import { searchAnnasArchive } from '@/lib/annas-archive';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';
import type { AnnaSearchAPIResponse } from '@/types/annas-archive';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 10 searches per minute
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 10, 60000); // 10 requests per 60 seconds

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many search requests. Please wait before searching again.',
          errorType: 'rate_limit',
          retryAfter: rateLimit.retryAfter,
          results: [],
          count: 0,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter?.toString() || '60',
          }
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    // EPUB-only filtering: Always filter to EPUB format
    const format = 'epub'; // Force EPUB-only results

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Search query is required', errorType: 'validation' },
        { status: 400 }
      );
    }

    // Basic input validation
    if (query.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Query too long (max 200 characters)', errorType: 'validation' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Query too short (min 2 characters)', errorType: 'validation' },
        { status: 400 }
      );
    }

    console.log(`[Search API] Query: "${query}", Format: ${format} (EPUB-only filtering enabled)`);

    const results = await searchAnnasArchive(query, format);

    console.log(`[Search API] Found ${results.length} EPUB results`);

    const response: AnnaSearchAPIResponse = {
      success: true,
      results,
      count: results.length,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Search API] Error:', error);

    // Categorize error types
    let errorType = 'unknown';
    let errorMessage = error.message || 'Search failed. Please try again.';

    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      errorType = 'timeout';
      errorMessage = 'Search request timed out. The server may be busy. Please try again.';
    } else if (error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
      errorType = 'network';
      errorMessage = 'Network error. Please check your internet connection and try again.';
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorType,
        results: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
