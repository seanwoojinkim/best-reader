import { NextRequest, NextResponse } from 'next/server';
import { downloadFromAnnasArchive, isValidMD5Hash, sanitizeFilename } from '@/lib/annas-archive';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3 downloads per minute
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 3, 60000); // 3 requests per 60 seconds

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Download limit reached. Please wait before downloading again.',
          errorType: 'rate_limit',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter?.toString() || '60',
          }
        }
      );
    }

    // Check API key
    const apiKey = process.env.ANNAS_SECRET_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Anna's Archive API key not configured. Please add ANNAS_SECRET_KEY to your .env.local file.",
          errorType: 'api_key',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { hash, title, format } = body;

    // Validate input
    if (!hash || typeof hash !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid hash', errorType: 'validation' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid title', errorType: 'validation' },
        { status: 400 }
      );
    }

    if (!format || typeof format !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid format', errorType: 'validation' },
        { status: 400 }
      );
    }

    // Validate MD5 format (32 hex characters)
    if (!isValidMD5Hash(hash)) {
      return NextResponse.json(
        { success: false, error: 'Invalid hash format (expected MD5)', errorType: 'validation' },
        { status: 400 }
      );
    }

    console.log(`[Download API] Starting download for "${title}" (${hash})`);

    const blob = await downloadFromAnnasArchive(hash, apiKey);

    console.log(`[Download API] Complete: ${blob.size} bytes`);

    // Convert blob to buffer and return with appropriate headers
    const buffer = Buffer.from(await blob.arrayBuffer());

    const sanitizedTitle = sanitizeFilename(title);
    const filename = `${sanitizedTitle}.${format}`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': format === 'epub' ? 'application/epub+zip' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('[Download API] Error:', error);

    // Categorize error types
    let errorType = 'unknown';
    let errorMessage = error.message || 'Download failed. Please try again.';
    let statusCode = 500;

    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      errorType = 'timeout';
      errorMessage = 'Download timed out. The server may be busy. Please try again.';
      statusCode = 504;
    } else if (error.message?.includes('API request failed')) {
      errorType = 'api_key';
      errorMessage = "Anna's Archive API request failed. Please check your API key configuration.";
      statusCode = 503;
    } else if (error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
      errorType = 'network';
      errorMessage = 'Network error during download. Please check your internet connection and try again.';
      statusCode = 503;
    } else if (error.message?.includes('Failed to get download URL')) {
      errorType = 'api_key';
      errorMessage = 'Could not get download URL. This may be due to an invalid API key or book not available.';
      statusCode = 503;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorType,
      },
      { status: statusCode }
    );
  }
}
