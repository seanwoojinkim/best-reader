---
doc_type: plan
date: 2025-11-10T04:02:26+00:00
title: "Anna's Archive Search and Download Integration"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T04:02:26+00:00"
feature: "annas-archive-integration"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: API Routes and Core Infrastructure"
    status: complete
  - name: "Phase 2: Search UI Component"
    status: complete
  - name: "Phase 3: Download and Library Integration"
    status: complete
  - name: "Phase 4: Error Handling and Polish"
    status: complete

git_commit: c3bbf68160f00a0b879a8469048bec3ea44b899b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-10
last_updated_by: Claude (AI Assistant)
last_updated_note: "Completed Phase 4 implementation - all phases complete with rate limiting, error handling, and EPUB-only filtering"

tags:
  - annas-archive
  - api
  - integration
  - search
  - download
status: draft

related_docs:
  - thoughts/research/2025-11-09-anna-s-archive-mcp-integration-analysis.md
---

# Implementation Plan: Anna's Archive Search and Download Integration

## Executive Summary

**Problem**: Users currently must manually obtain EPUB files from external sources before uploading them to the reader app. This creates friction in the user experience and limits book discovery.

**Solution**: Integrate Anna's Archive search and download functionality directly into the epub reader app, allowing users to search for books and add them to their library with a single click.

**Approach**: Build Next.js API routes that replicate the search (web scraping) and download (authenticated API) functionality from the anna's-mcp repository. Create a search UI component that integrates with the existing library page, and handle downloaded books the same way as uploaded books.

**Success Definition**: Users can search Anna's Archive by title/author, see results with metadata, download books directly to their library, and read them immediately without leaving the app.

**Estimated Timeline**: 12-16 hours across 4 phases

## Current State Analysis

### Existing Architecture

**Location**: `/Users/seankim/dev/reader`

**Tech Stack**:
- Next.js 14 with App Router
- TypeScript for type safety
- Dexie for IndexedDB storage
- epubjs for EPUB rendering
- Tailwind CSS for styling
- Zustand for state management

**Current Book Flow**:
1. User clicks "Upload EPUB" button (`/Users/seankim/dev/reader/components/library/UploadButton.tsx`)
2. File is read as Blob
3. Metadata extracted using epub.js
4. Book stored in IndexedDB via Dexie (`/Users/seankim/dev/reader/lib/db.ts`)
5. Library page refreshed to show new book (`/Users/seankim/dev/reader/app/page.tsx`)

**Database Schema** (`/Users/seankim/dev/reader/lib/db.ts`):
```typescript
interface Book {
  id?: number;
  title: string;
  author: string;
  filePath: string;      // Blob URL or IndexedDB reference
  coverUrl?: string;
  isbn?: string;
  tags?: string[];
  addedAt: Date;
  lastOpenedAt?: Date;
  totalPages?: number;
  fileBlob?: Blob;       // Store the actual EPUB file
}
```

**API Routes Structure**:
- Currently has `/app/api/tts/` for text-to-speech functionality
- No existing book search or external API integration

### Available Research

**Research Document**: `/Users/seankim/dev/reader/thoughts/research/2025-11-09-anna-s-archive-mcp-integration-analysis.md`

**Key Technical Findings**:
1. **Search Implementation**:
   - Endpoint: `https://annas-archive.org/search?q={query}`
   - Method: Web scraping (not JSON API)
   - CSS selectors needed to parse HTML response
   - No authentication required for search

2. **Download Implementation**:
   - API Endpoint: `https://annas-archive.org/dyn/api/fast_download.json?md5={hash}&key={apiKey}`
   - Two-step process: Get temp URL → Download file
   - Requires `ANNAS_SECRET_KEY` environment variable
   - MD5 hash is the key identifier

3. **Data Model** (from Go source):
```go
type Book struct {
    Language  string `json:"language"`
    Format    string `json:"format"`
    Size      string `json:"size"`
    Title     string `json:"title"`
    Publisher string `json:"publisher"`
    Authors   string `json:"authors"`
    URL       string `json:"url"`
    Hash      string `json:"hash"`  // MD5 identifier
}
```

### Integration Points

1. **Library Page** (`/Users/seankim/dev/reader/app/page.tsx`):
   - Currently shows BookGrid and UploadButton
   - Need to add SearchButton/SearchModal
   - Already has `loadBooks()` function that can be reused

2. **Database** (`/Users/seankim/dev/reader/lib/db.ts`):
   - `addBook()` function accepts Omit<Book, 'id' | 'addedAt'>
   - Can reuse existing function for downloaded books
   - No schema changes needed

3. **Types** (`/Users/seankim/dev/reader/types/index.ts`):
   - Current Book interface compatible with Anna's Archive metadata
   - May need additional interfaces for search results

## Requirements Analysis

### Functional Requirements

1. **Search Functionality**:
   - User can enter search query (title, author, keywords)
   - System fetches and displays search results from Anna's Archive
   - Results show: title, author, format, size, language, publisher
   - User can filter by format (epub, pdf, etc.)

2. **Download Functionality**:
   - User clicks download button on search result
   - System authenticates with Anna's Archive API
   - File downloads and saves to IndexedDB
   - Book appears in library immediately

3. **Library Integration**:
   - Downloaded books treated identically to uploaded books
   - Same metadata extraction and cover image handling
   - Reading position, highlights, etc. work the same

4. **User Feedback**:
   - Loading states during search and download
   - Progress indicator for downloads
   - Error messages for failed operations
   - Success confirmation when book added to library

### Technical Requirements

1. **API Routes**:
   - `/api/books/search` - Server-side search endpoint
   - `/api/books/download` - Server-side download endpoint
   - Both must run server-side to avoid CORS issues

2. **Dependencies**:
   - `cheerio` for HTML parsing (web scraping)
   - No additional dependencies for HTTP (use native fetch)

3. **Environment Variables**:
   - `ANNAS_SECRET_KEY` - API key for downloads
   - Must be server-side only (not exposed to client)

4. **Error Handling**:
   - Network failures (timeout, connectivity)
   - API key missing or invalid
   - Rate limiting from Anna's Archive
   - Invalid book formats
   - Download failures

5. **Security**:
   - API key never exposed to client
   - Server-side validation of all requests
   - Rate limiting to prevent abuse
   - Sanitize user input for search queries

### Out of Scope (Future Enhancements)

These features are explicitly NOT part of this initial implementation:

1. **Advanced Search Filters**:
   - Publication date range
   - Publisher filtering
   - File size limits
   - Rating/review filtering

2. **Batch Downloads**:
   - Download multiple books at once
   - Bulk import functionality

3. **Search Result Caching**:
   - Cache search results to reduce API calls
   - Implement cache invalidation strategy

4. **Pagination**:
   - Load more results beyond first page
   - Infinite scroll

5. **Book Recommendations**:
   - Related books
   - Similar authors
   - Genre-based suggestions

6. **Search History**:
   - Save previous searches
   - Quick access to recent queries

## Architecture and Design

### Design Options Considered

#### Option 1: Direct API Implementation (RECOMMENDED)

**Approach**: Reimplement search and download logic in TypeScript using Next.js API routes.

**Pros**:
- Full control over implementation
- No external dependencies (Go binary, MCP protocol)
- Native TypeScript patterns
- Easy to customize and extend
- Simple deployment

**Cons**:
- Must maintain scraping logic if Anna's Archive HTML changes
- Duplicate implementation effort

**Files to Create/Modify**:
- Create: `/app/api/books/search/route.ts`
- Create: `/app/api/books/download/route.ts`
- Create: `/lib/annas-archive.ts` (shared utilities)
- Create: `/types/annas-archive.ts` (type definitions)
- Create: `/components/library/SearchModal.tsx`
- Create: `/components/library/SearchButton.tsx`
- Modify: `/app/page.tsx` (add search UI)
- Modify: `.env.example` (document ANNAS_SECRET_KEY)

#### Option 2: MCP Server as Subprocess

**Approach**: Run the Go anna's-mcp binary and communicate via Model Context Protocol.

**Pros**:
- No reimplementation needed
- Automatic updates if anna's-mcp maintained

**Cons**:
- Additional binary dependency
- MCP protocol overhead
- Harder to deploy
- Subprocess management complexity
- Less control over errors

**NOT RECOMMENDED** for web application.

### Recommended Architecture

**Component Diagram**:
```
┌─────────────────────────────────────────────────────────────┐
│                     Library Page UI                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ UploadButton │  │ SearchButton │  │   BookGrid   │      │
│  └──────────────┘  └──────┬───────┘  └──────────────┘      │
└─────────────────────────────┼───────────────────────────────┘
                              │ opens
                    ┌─────────▼──────────┐
                    │   SearchModal      │
                    │  ┌──────────────┐  │
                    │  │ Search Input │  │
                    │  │ Results List │  │
                    │  │ Download Btn │  │
                    │  └──────┬───────┘  │
                    └─────────┼──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼─────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ /api/books/     │  │ /api/books/     │  │    lib/db.ts    │
│    search       │  │   download      │  │   addBook()     │
│                 │  │                 │  │                 │
│ - Scrape HTML   │  │ - Call API      │  │ - Save to       │
│ - Parse books   │  │ - Get temp URL  │  │   IndexedDB     │
│ - Return JSON   │  │ - Fetch file    │  │                 │
└─────────────────┘  │ - Return blob   │  └─────────────────┘
                     └─────────────────┘
                              │
                     ┌────────▼──────────────┐
                     │  Anna's Archive API   │
                     │  - Search (scraping)  │
                     │  - Download (JSON)    │
                     └───────────────────────┘
```

**Data Flow**:

**Search Flow**:
1. User enters query in SearchModal
2. Client calls `/api/books/search?q={query}`
3. API route fetches HTML from `annas-archive.org/search`
4. Server parses HTML with cheerio
5. Returns JSON array of books
6. Client displays results in modal

**Download Flow**:
1. User clicks download on search result
2. Client calls `/api/books/download` with POST body `{hash, title, format}`
3. API route calls Anna's Archive fast_download API with `ANNAS_SECRET_KEY`
4. Gets temporary download URL from JSON response
5. Fetches actual file from temp URL
6. Returns file as blob to client
7. Client extracts metadata with epub.js
8. Client calls `addBook()` to save to IndexedDB
9. Library page refreshed to show new book

### Component Details

**API Route: `/app/api/books/search/route.ts`**
```typescript
// GET /api/books/search?q={query}&format={format}
// Returns: AnnaSearchResult[]

interface AnnaSearchResult {
  title: string;
  authors: string;
  publisher: string;
  language: string;
  format: string;  // epub, pdf, etc.
  size: string;    // "2.5 MB"
  hash: string;    // MD5 for downloads
  url: string;     // Anna's Archive detail page
}
```

**API Route: `/app/api/books/download/route.ts`**
```typescript
// POST /api/books/download
// Body: { hash: string, title: string, format: string }
// Returns: Blob (epub file)

// Two-step process:
// 1. Call fast_download API to get temp URL
// 2. Fetch file from temp URL and stream to client
```

**Component: `SearchModal.tsx`**
```typescript
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookDownloaded: () => void;  // Refresh library
}

// Features:
// - Search input with debouncing
// - Results list with book cards
// - Format filter dropdown
// - Download button per result
// - Loading states
// - Error handling
```

### Security Considerations

1. **API Key Protection**:
   - Store in `.env.local` (server-side only)
   - Never send to client
   - Validate presence at API route startup

2. **Input Validation**:
   - Sanitize search queries (prevent injection)
   - Validate format parameter (whitelist)
   - Validate hash format (MD5 pattern)

3. **Rate Limiting**:
   - Implement simple in-memory rate limiter
   - Limit: 10 searches per minute per IP
   - Limit: 3 downloads per minute per IP
   - Return 429 status with retry-after header

4. **Error Handling**:
   - Never expose API key in error messages
   - Sanitize Anna's Archive errors before returning
   - Log server-side errors for debugging

5. **CORS**:
   - API routes automatically handle CORS
   - Restrict to same-origin requests

## Implementation Phases

### Phase 1: API Routes and Core Infrastructure

**Goal**: Set up server-side API routes for search and download functionality.

**Prerequisites**: None (starting from existing codebase)

**Files to Create**:
1. `/app/api/books/search/route.ts` - Search API route
2. `/app/api/books/download/route.ts` - Download API route
3. `/lib/annas-archive.ts` - Shared utilities (HTML parsing, API calls)
4. `/types/annas-archive.ts` - Type definitions

**Files to Modify**:
1. `.env.local` - Add `ANNAS_SECRET_KEY`
2. `.env.example` - Document new environment variable
3. `package.json` - Add cheerio dependency

**Implementation Steps**:

1. **Install Dependencies**:
```bash
npm install cheerio
npm install --save-dev @types/cheerio
```

2. **Create Type Definitions** (`/types/annas-archive.ts`):
```typescript
export interface AnnaSearchResult {
  title: string;
  authors: string;
  publisher: string;
  language: string;
  format: string;
  size: string;
  hash: string;
  url: string;
}

export interface AnnaDownloadRequest {
  hash: string;
  title: string;
  format: string;
}

export interface AnnaDownloadResponse {
  download_url: string;
  error: string;
}
```

3. **Create Search Utility** (`/lib/annas-archive.ts`):
```typescript
import * as cheerio from 'cheerio';

export async function searchAnnasArchive(
  query: string,
  format?: string
): Promise<AnnaSearchResult[]> {
  // URL encode query
  const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(query)}`;

  // Fetch HTML
  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Parse books using CSS selectors from research
  const books: AnnaSearchResult[] = [];

  $('a[href^="/md5/"]').each((i, elem) => {
    const $elem = $(elem);
    const href = $elem.attr('href');
    if (!href) return;

    // Extract hash from URL: /md5/{hash}
    const hash = href.replace('/md5/', '');

    // Find parent container
    const $container = $elem.closest('.relative');

    // Extract metadata (adjust selectors based on actual HTML)
    const metaText = $container.find('div.relative.top-\\[-1\\].pl-4.grow.overflow-hidden > div').eq(0).text().trim();
    const title = $container.find('h3').text().trim();
    const publisher = $container.find('div.relative.top-\\[-1\\].pl-4.grow.overflow-hidden > div').eq(1).text().trim();
    const authors = $container.find('div.relative.top-\\[-1\\].pl-4.grow.overflow-hidden > div').eq(2).text().trim();

    // Parse meta: "English, [pdf, 3rd Edition, 2.5 MB, 2020"
    const metaParts = metaText.split(',').map(s => s.trim());
    const language = metaParts[0] || '';
    const bookFormat = metaParts[1]?.replace('[', '') || '';
    const size = metaParts[3] || '';

    // Filter by format if specified
    if (format && bookFormat.toLowerCase() !== format.toLowerCase()) {
      return; // Skip this result
    }

    books.push({
      title,
      authors,
      publisher,
      language,
      format: bookFormat,
      size,
      hash,
      url: `https://annas-archive.org${href}`,
    });
  });

  return books;
}

export async function downloadFromAnnasArchive(
  hash: string,
  apiKey: string
): Promise<Blob> {
  // Step 1: Get temporary download URL
  const apiUrl = `https://annas-archive.org/dyn/api/fast_download.json?md5=${hash}&key=${apiKey}`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data: AnnaDownloadResponse = await response.json();

  if (data.error || !data.download_url) {
    throw new Error(data.error || 'Failed to get download URL');
  }

  // Step 2: Download actual file
  const fileResponse = await fetch(data.download_url);
  if (!fileResponse.ok) {
    throw new Error(`Download failed: ${fileResponse.status}`);
  }

  return await fileResponse.blob();
}
```

4. **Create Search API Route** (`/app/api/books/search/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { searchAnnasArchive } from '@/lib/annas-archive';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const format = searchParams.get('format') || undefined;

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Basic input validation
    if (query.length > 200) {
      return NextResponse.json(
        { error: 'Query too long' },
        { status: 400 }
      );
    }

    // TODO: Implement rate limiting here

    const results = await searchAnnasArchive(query, format);

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Search error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
```

5. **Create Download API Route** (`/app/api/books/download/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { downloadFromAnnasArchive } from '@/lib/annas-archive';

export async function POST(request: NextRequest) {
  try {
    // Check API key
    const apiKey = process.env.ANNAS_SECRET_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Anna\'s Archive API key not configured',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { hash, title, format } = body;

    // Validate input
    if (!hash || typeof hash !== 'string') {
      return NextResponse.json(
        { error: 'Invalid hash' },
        { status: 400 }
      );
    }

    // Validate MD5 format (32 hex characters)
    if (!/^[a-f0-9]{32}$/i.test(hash)) {
      return NextResponse.json(
        { error: 'Invalid hash format' },
        { status: 400 }
      );
    }

    // TODO: Implement rate limiting here

    console.log(`[Download] Starting download for ${title} (${hash})`);

    const blob = await downloadFromAnnasArchive(hash, apiKey);

    console.log(`[Download] Complete: ${blob.size} bytes`);

    // Convert blob to buffer and return
    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/epub+zip',
        'Content-Disposition': `attachment; filename="${title}.${format}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Download error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Download failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
```

6. **Update Environment Variables**:
```bash
# .env.local
ANNAS_SECRET_KEY=your_key_here_from_donation
```

```bash
# .env.example
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Anna's Archive API Key (get from donation page)
ANNAS_SECRET_KEY=your_key_here
```

**Success Criteria**:
- [ ] cheerio dependency installed successfully
- [ ] Type definitions created with all required interfaces
- [ ] Search utility function parses HTML correctly
- [ ] Download utility function handles 2-step API flow
- [ ] GET `/api/books/search?q=test` returns JSON with results
- [ ] POST `/api/books/download` with valid hash returns epub file
- [ ] API routes handle errors gracefully (network, parsing, API key)
- [ ] Environment variables documented in `.env.example`
- [ ] No TypeScript errors in new files

**Testing**:
```bash
# Test search endpoint
curl "http://localhost:3000/api/books/search?q=lord%20of%20the%20rings"

# Test download endpoint (requires valid hash)
curl -X POST "http://localhost:3000/api/books/download" \
  -H "Content-Type: application/json" \
  -d '{"hash":"abc123...","title":"test","format":"epub"}'
```

**Time Estimate**: 4-5 hours

---

### Phase 2: Search UI Component

**Goal**: Create user interface for searching Anna's Archive from the library page.

**Prerequisites**: Phase 1 complete (API routes working)

**Files to Create**:
1. `/components/library/SearchModal.tsx` - Main search interface
2. `/components/library/SearchButton.tsx` - Button to open modal
3. `/components/library/SearchResultCard.tsx` - Individual result display

**Files to Modify**:
1. `/app/page.tsx` - Add SearchButton next to UploadButton

**Implementation Steps**:

1. **Create SearchButton Component** (`/components/library/SearchButton.tsx`):
```typescript
'use client';

import React from 'react';

interface SearchButtonProps {
  onClick: () => void;
}

export default function SearchButton({ onClick }: SearchButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      Search Books
    </button>
  );
}
```

2. **Create SearchResultCard Component** (`/components/library/SearchResultCard.tsx`):
```typescript
'use client';

import React from 'react';
import type { AnnaSearchResult } from '@/types/annas-archive';

interface SearchResultCardProps {
  book: AnnaSearchResult;
  onDownload: (book: AnnaSearchResult) => void;
  isDownloading: boolean;
}

export default function SearchResultCard({
  book,
  onDownload,
  isDownloading,
}: SearchResultCardProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
        {book.title}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {book.authors}
      </p>

      {book.publisher && (
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          {book.publisher}
        </p>
      )}

      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
          {book.format.toUpperCase()}
        </span>
        <span>{book.size}</span>
        <span>{book.language}</span>
      </div>

      <button
        onClick={() => onDownload(book)}
        disabled={isDownloading}
        className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isDownloading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Downloading...
          </span>
        ) : (
          'Download to Library'
        )}
      </button>
    </div>
  );
}
```

3. **Create SearchModal Component** (`/components/library/SearchModal.tsx`):
```typescript
'use client';

import React, { useState, useEffect } from 'react';
import SearchResultCard from './SearchResultCard';
import type { AnnaSearchResult } from '@/types/annas-archive';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookDownloaded: () => void;
}

export default function SearchModal({
  isOpen,
  onClose,
  onBookDownloaded,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<string>('');
  const [results, setResults] = useState<AnnaSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingHash, setDownloadingHash] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [query, format]);

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: query });
      if (format) {
        params.append('format', format);
      }

      const response = await fetch(`/api/books/search?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data.results);
    } catch (err: any) {
      setError(err.message || 'Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (book: AnnaSearchResult) => {
    setDownloadingHash(book.hash);
    setError(null);

    try {
      // Call download API
      const response = await fetch('/api/books/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hash: book.hash,
          title: book.title,
          format: book.format,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Download failed');
      }

      // Get blob from response
      const blob = await response.blob();

      // TODO: Extract metadata and save to library (Phase 3)
      console.log('Downloaded:', blob.size, 'bytes');

      // Success - close modal and refresh library
      alert('Book downloaded successfully!');
      onBookDownloaded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Download failed. Please try again.');
    } finally {
      setDownloadingHash(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Search Books
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, ISBN..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />

            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">All Formats</option>
              <option value="epub">EPUB</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg
                  className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-gray-500">Searching...</p>
              </div>
            </div>
          )}

          {!isSearching && query.length >= 3 && results.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No results found. Try a different search term.</p>
            </div>
          )}

          {!isSearching && query.length < 3 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Enter at least 3 characters to search.</p>
            </div>
          )}

          <div className="space-y-4">
            {results.map((book) => (
              <SearchResultCard
                key={book.hash}
                book={book}
                onDownload={handleDownload}
                isDownloading={downloadingHash === book.hash}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

4. **Update Library Page** (`/app/page.tsx`):
```typescript
// Add state for search modal
const [showSearchModal, setShowSearchModal] = useState(false);

// Update header to include SearchButton
<div className="flex items-center justify-between">
  <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-gray-100">
    Library
  </h1>
  <div className="flex gap-3">
    <SearchButton onClick={() => setShowSearchModal(true)} />
    <UploadButton onUploadComplete={handleUploadComplete} />
  </div>
</div>

// Add SearchModal before closing tag
<SearchModal
  isOpen={showSearchModal}
  onClose={() => setShowSearchModal(false)}
  onBookDownloaded={loadBooks}
/>
```

**Success Criteria**:
- [ ] SearchButton appears next to UploadButton on library page
- [ ] Clicking SearchButton opens SearchModal
- [ ] Search input has debouncing (waits 500ms after typing)
- [ ] Entering 3+ characters triggers search
- [ ] Results display with all metadata (title, author, format, size)
- [ ] Format filter dropdown works (All/EPUB/PDF)
- [ ] Loading spinner shows during search
- [ ] Error messages display when search fails
- [ ] Empty state shows when no results found
- [ ] Modal closes on X button or outside click
- [ ] Download button appears on each result
- [ ] Clicking download shows loading state

**Testing**:
1. Open library page
2. Click "Search Books" button
3. Type "lord of the rings" and verify debouncing
4. Verify results appear with metadata
5. Test format filter (EPUB only)
6. Test error handling (disconnect network)
7. Verify modal closes properly

**Time Estimate**: 3-4 hours

---

### Phase 3: Download and Library Integration

**Goal**: Complete download flow and integrate downloaded books into the library.

**Prerequisites**: Phase 2 complete (search UI working)

**Files to Modify**:
1. `/components/library/SearchModal.tsx` - Complete download handler
2. `/lib/epub-utils.ts` - May need utility functions for metadata extraction

**Implementation Steps**:

1. **Complete Download Handler in SearchModal**:

Update the `handleDownload` function in `SearchModal.tsx`:

```typescript
const handleDownload = async (book: AnnaSearchResult) => {
  setDownloadingHash(book.hash);
  setError(null);

  try {
    // Step 1: Download file from API
    const response = await fetch('/api/books/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hash: book.hash,
        title: book.title,
        format: book.format,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Download failed');
    }

    const blob = await response.blob();

    // Step 2: Load EPUB and extract metadata
    const ePub = await import('epubjs');
    const epubBook = ePub.default(blob);

    await epubBook.ready;

    // Extract metadata
    const metadata = await epubBook.loaded.metadata;
    const cover = await epubBook.coverUrl();

    // Step 3: Save to library database
    const bookData = {
      title: metadata.title || book.title,
      author: metadata.creator || book.authors,
      filePath: '', // Will be set by addBook
      fileBlob: blob,
      coverUrl: cover || undefined,
      isbn: metadata.identifier || undefined,
      tags: ['downloaded'], // Tag for tracking source
    };

    const bookId = await addBook(bookData);

    console.log(`Book added to library with ID: ${bookId}`);

    // Step 4: Success feedback and refresh
    // Show success message
    setError(null);

    // Close modal and refresh library
    setTimeout(() => {
      onBookDownloaded(); // Calls loadBooks() in parent
      onClose();
    }, 500);

  } catch (err: any) {
    console.error('Download error:', err);
    setError(err.message || 'Download failed. Please try again.');
  } finally {
    setDownloadingHash(null);
  }
};
```

2. **Add Success Toast/Notification**:

Create a simple toast notification system or use browser alert temporarily:

```typescript
// In SearchModal.tsx, after successful download:
const [successMessage, setSuccessMessage] = useState<string | null>(null);

// After download success:
setSuccessMessage(`"${book.title}" added to library!`);
setTimeout(() => {
  setSuccessMessage(null);
  onClose();
}, 2000);

// In modal render:
{successMessage && (
  <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[100]">
    {successMessage}
  </div>
)}
```

3. **Handle Non-EPUB Formats**:

Since the app only supports EPUB, add validation:

```typescript
// In SearchResultCard.tsx, disable download for non-EPUB:
<button
  onClick={() => onDownload(book)}
  disabled={isDownloading || book.format.toLowerCase() !== 'epub'}
  className={`mt-4 w-full px-4 py-2 rounded-lg transition-colors ${
    book.format.toLowerCase() !== 'epub'
      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
      : 'bg-green-600 text-white hover:bg-green-700'
  } disabled:bg-gray-400 disabled:cursor-not-allowed`}
>
  {book.format.toLowerCase() !== 'epub'
    ? 'EPUB Only'
    : isDownloading
      ? 'Downloading...'
      : 'Download to Library'
  }
</button>
```

4. **Add Download Progress** (Optional Enhancement):

For large files, add progress indicator:

```typescript
// In SearchModal.tsx:
const [downloadProgress, setDownloadProgress] = useState<number>(0);

// During download:
const response = await fetch('/api/books/download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hash: book.hash, title: book.title, format: book.format }),
});

const reader = response.body?.getReader();
const contentLength = +(response.headers.get('Content-Length') ?? '0');

let receivedLength = 0;
const chunks = [];

if (reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    setDownloadProgress(Math.round((receivedLength / contentLength) * 100));
  }
}

const blob = new Blob(chunks);
```

5. **Add Error Recovery**:

Allow retry on failed downloads:

```typescript
// In SearchModal.tsx:
const [failedDownloadBook, setFailedDownloadBook] = useState<AnnaSearchResult | null>(null);

// On error:
setFailedDownloadBook(book);

// Show retry button:
{failedDownloadBook && (
  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
    <p className="text-yellow-800 dark:text-yellow-200 mb-2">
      Download failed. Would you like to try again?
    </p>
    <button
      onClick={() => {
        setFailedDownloadBook(null);
        handleDownload(failedDownloadBook);
      }}
      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
    >
      Retry Download
    </button>
  </div>
)}
```

**Success Criteria**:
- [ ] Download button fetches file from API
- [ ] EPUB blob loaded with epubjs
- [ ] Metadata extracted (title, author, cover)
- [ ] Book saved to IndexedDB via `addBook()`
- [ ] Downloaded book appears in library grid immediately
- [ ] Success message shows after download
- [ ] Modal closes automatically after success
- [ ] Non-EPUB formats show disabled button with "EPUB Only" text
- [ ] Error messages clear on successful retry
- [ ] Network errors handled gracefully
- [ ] Large file downloads show progress (optional)
- [ ] Downloaded books have "downloaded" tag for tracking

**Testing**:
1. Search for "test book"
2. Click download on EPUB result
3. Verify progress indicator shows
4. Verify success message appears
5. Verify book appears in library
6. Open book and verify it reads correctly
7. Test with PDF result (should be disabled)
8. Test network failure (disconnect and retry)
9. Test API key error (remove key temporarily)
10. Verify cover image displays in library

**Time Estimate**: 3-4 hours

---

### Phase 4: Error Handling and Polish

**Goal**: Add comprehensive error handling, rate limiting, and UI polish.

**Prerequisites**: Phase 3 complete (download flow working)

**Files to Modify**:
1. `/app/api/books/search/route.ts` - Add rate limiting
2. `/app/api/books/download/route.ts` - Add rate limiting
3. `/components/library/SearchModal.tsx` - Improve error messages
4. `/lib/annas-archive.ts` - Add timeout handling

**Implementation Steps**:

1. **Add Rate Limiting Utility** (`/lib/rate-limiter.ts`):

```typescript
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // Clean up old entries
  if (entry && entry.resetAt < now) {
    rateLimitMap.delete(identifier);
  }

  if (!entry || entry.resetAt < now) {
    // First request or window expired
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  entry.count++;
  return { allowed: true };
}

// Helper to get client identifier
export function getClientIdentifier(request: Request): string {
  // In production, use IP address or user ID
  // For now, use a simple approach
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return ip;
}
```

2. **Update Search API with Rate Limiting**:

```typescript
// In /app/api/books/search/route.ts

import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 10 searches per minute
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 10, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests. Please try again later.',
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

    // ... rest of search logic
  } catch (error: any) {
    // ... error handling
  }
}
```

3. **Update Download API with Rate Limiting**:

```typescript
// In /app/api/books/download/route.ts

import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3 downloads per minute
    const clientId = getClientIdentifier(request);
    const rateLimit = checkRateLimit(clientId, 3, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Download limit reached. Please wait before trying again.',
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

    // ... rest of download logic
  } catch (error: any) {
    // ... error handling
  }
}
```

4. **Add Timeout Handling to API Calls**:

```typescript
// In /lib/annas-archive.ts

const TIMEOUT_MS = 30000; // 30 seconds

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}

// Update searchAnnasArchive to use fetchWithTimeout:
export async function searchAnnasArchive(query: string, format?: string): Promise<AnnaSearchResult[]> {
  const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(query)}`;

  const response = await fetchWithTimeout(searchUrl);
  // ... rest of logic
}

// Update downloadFromAnnasArchive to use fetchWithTimeout:
export async function downloadFromAnnasArchive(hash: string, apiKey: string): Promise<Blob> {
  const apiUrl = `https://annas-archive.org/dyn/api/fast_download.json?md5=${hash}&key=${apiKey}`;

  const response = await fetchWithTimeout(apiUrl);
  // ... rest of logic
}
```

5. **Improve Error Messages in SearchModal**:

```typescript
// In /components/library/SearchModal.tsx

// Add error type enum
enum ErrorType {
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  API_KEY = 'api_key',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

interface ErrorState {
  message: string;
  type: ErrorType;
  retryAfter?: number;
}

// Update error state
const [error, setError] = useState<ErrorState | null>(null);

// Better error handling in handleSearch:
try {
  // ... fetch logic
} catch (err: any) {
  let errorState: ErrorState;

  if (err.message.includes('timeout')) {
    errorState = {
      message: 'Request timed out. The server may be busy. Please try again.',
      type: ErrorType.TIMEOUT,
    };
  } else if (err.message.includes('rate limit')) {
    errorState = {
      message: 'Too many searches. Please wait a moment before searching again.',
      type: ErrorType.RATE_LIMIT,
      retryAfter: err.retryAfter,
    };
  } else if (err.message.includes('Failed to fetch')) {
    errorState = {
      message: 'Network error. Please check your connection and try again.',
      type: ErrorType.NETWORK,
    };
  } else {
    errorState = {
      message: err.message || 'An error occurred. Please try again.',
      type: ErrorType.UNKNOWN,
    };
  }

  setError(errorState);
  setResults([]);
}

// Display error with appropriate styling:
{error && (
  <div className={`rounded-lg p-4 mb-4 ${
    error.type === ErrorType.RATE_LIMIT
      ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
  }`}>
    <p className={`${
      error.type === ErrorType.RATE_LIMIT
        ? 'text-yellow-800 dark:text-yellow-200'
        : 'text-red-800 dark:text-red-200'
    }`}>
      {error.message}
    </p>
    {error.retryAfter && (
      <p className="text-sm mt-1 text-yellow-700 dark:text-yellow-300">
        Try again in {error.retryAfter} seconds
      </p>
    )}
  </div>
)}
```

6. **Add Loading Skeleton for Better UX**:

```typescript
// In /components/library/SearchModal.tsx

// Add skeleton component
function SearchResultSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
      <div className="flex gap-3 mb-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
      </div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  );
}

// Show skeletons while searching:
{isSearching && (
  <div className="space-y-4">
    <SearchResultSkeleton />
    <SearchResultSkeleton />
    <SearchResultSkeleton />
  </div>
)}
```

7. **Add Keyboard Shortcuts**:

```typescript
// In SearchModal.tsx

useEffect(() => {
  if (!isOpen) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Close on Escape
    if (e.key === 'Escape') {
      onClose();
    }

    // Focus search input on "/"
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isOpen, onClose]);

// Add id to input:
<input
  id="search-input"
  type="text"
  // ... rest of props
/>
```

8. **Add Analytics/Logging**:

```typescript
// In SearchModal.tsx and API routes

// Log search queries (for debugging)
console.log('[Search] Query:', query, 'Format:', format, 'Results:', results.length);

// Log download attempts
console.log('[Download] Starting:', book.title, 'Hash:', book.hash);
console.log('[Download] Complete:', book.title, 'Size:', blob.size);

// Log errors
console.error('[Search] Error:', error);
console.error('[Download] Error:', error);
```

**Success Criteria**:
- [ ] Rate limiting works (10 searches/min, 3 downloads/min)
- [ ] Rate limit errors show with retry-after time
- [ ] Network timeout after 30 seconds with clear message
- [ ] Error messages categorized by type (network, rate limit, API key, timeout)
- [ ] Loading skeletons show during search
- [ ] Escape key closes modal
- [ ] "/" key focuses search input
- [ ] API errors logged to console for debugging
- [ ] All errors display user-friendly messages
- [ ] Download progress shows for large files (if implemented in Phase 3)
- [ ] Multiple failed downloads show retry buttons

**Testing**:
1. Test rate limiting:
   - Perform 11 searches rapidly
   - Verify 11th shows rate limit error
   - Wait 60 seconds and verify search works again

2. Test network errors:
   - Disconnect network
   - Try search and verify error message
   - Reconnect and verify retry works

3. Test timeout:
   - Use network throttling to slow connection
   - Verify timeout after 30 seconds
   - Verify timeout message displays

4. Test API key error:
   - Temporarily remove ANNAS_SECRET_KEY
   - Try download and verify error message
   - Add key back and verify works

5. Test keyboard shortcuts:
   - Press Escape to close modal
   - Press "/" to focus search input

6. Test error recovery:
   - Trigger each error type
   - Verify retry button works
   - Verify error clears on success

**Time Estimate**: 2-3 hours

---

## Testing Strategy

### Unit Testing

**Search Utility** (`/lib/annas-archive.ts`):
```typescript
describe('searchAnnasArchive', () => {
  it('should parse search results correctly', async () => {
    // Mock fetch to return sample HTML
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(sampleHTML),
    }));

    const results = await searchAnnasArchive('test query');

    expect(results).toHaveLength(3);
    expect(results[0]).toHaveProperty('title');
    expect(results[0]).toHaveProperty('hash');
  });

  it('should filter by format', async () => {
    const results = await searchAnnasArchive('test', 'epub');

    results.forEach(book => {
      expect(book.format.toLowerCase()).toBe('epub');
    });
  });

  it('should handle network errors', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

    await expect(searchAnnasArchive('test')).rejects.toThrow('Network error');
  });
});
```

**Download Utility**:
```typescript
describe('downloadFromAnnasArchive', () => {
  it('should complete 2-step download process', async () => {
    const mockApiResponse = {
      download_url: 'https://example.com/file.epub',
      error: '',
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'])),
      });

    const blob = await downloadFromAnnasArchive('abc123', 'test-key');

    expect(blob).toBeInstanceOf(Blob);
  });

  it('should handle API errors', async () => {
    const mockApiResponse = {
      download_url: '',
      error: 'Invalid hash',
    };

    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    }));

    await expect(downloadFromAnnasArchive('invalid', 'key')).rejects.toThrow('Invalid hash');
  });
});
```

### Integration Testing

**API Routes**:
```bash
# Test search endpoint
curl "http://localhost:3000/api/books/search?q=tolkien&format=epub"

# Expected response:
{
  "success": true,
  "results": [
    {
      "title": "The Lord of the Rings",
      "authors": "J.R.R. Tolkien",
      "format": "epub",
      "hash": "abc123...",
      ...
    }
  ],
  "count": 5
}

# Test download endpoint
curl -X POST "http://localhost:3000/api/books/download" \
  -H "Content-Type: application/json" \
  -d '{"hash":"abc123","title":"Test Book","format":"epub"}' \
  --output test.epub

# Verify file downloaded
ls -lh test.epub
```

**Rate Limiting**:
```bash
# Test rate limit (should succeed)
for i in {1..10}; do
  curl "http://localhost:3000/api/books/search?q=test$i"
done

# Test rate limit exceeded (should return 429)
curl "http://localhost:3000/api/books/search?q=test11"
```

### Manual Testing Checklist

**Search Flow**:
- [ ] Open library page
- [ ] Click "Search Books" button
- [ ] Modal opens with focus on search input
- [ ] Type "lord of the rings"
- [ ] Wait for debounce (500ms)
- [ ] Results appear with metadata
- [ ] Select "EPUB" from format filter
- [ ] Results update to show only EPUB
- [ ] Clear format filter
- [ ] Results show all formats again

**Download Flow**:
- [ ] Click download on EPUB result
- [ ] Progress indicator shows
- [ ] Success message appears
- [ ] Book appears in library grid
- [ ] Book has cover image
- [ ] Click book to open reader
- [ ] Book displays correctly

**Error Handling**:
- [ ] Disconnect network and search - shows network error
- [ ] Reconnect and retry - works
- [ ] Remove API key and download - shows API key error
- [ ] Add key back and retry - works
- [ ] Perform 11 searches rapidly - shows rate limit error
- [ ] Wait 60 seconds - search works again

**UI/UX**:
- [ ] Modal centers on screen
- [ ] Modal scrolls when many results
- [ ] Loading states show for search and download
- [ ] Error messages clear when retrying
- [ ] Escape key closes modal
- [ ] "/" key focuses search input
- [ ] Dark mode styling looks correct
- [ ] Mobile responsive (test on small screen)

**Edge Cases**:
- [ ] Search with special characters: `C++`, `O'Reilly`
- [ ] Search with very long query (200 chars)
- [ ] Download very large file (>10MB) - progress shows
- [ ] Download with slow network - timeout works
- [ ] Open book immediately after download
- [ ] Download same book twice - no duplicate in library
- [ ] Search returns 0 results - empty state shows
- [ ] Search with <3 characters - shows minimum length message

### Performance Testing

**Search Response Time**:
- Target: <2 seconds for search results
- Test with various query lengths
- Monitor Anna's Archive response time

**Download Speed**:
- Target: Stream downloads without blocking UI
- Test with files of various sizes (1MB, 5MB, 10MB+)
- Verify progress updates smoothly

**Database Operations**:
- Target: <100ms to save book to IndexedDB
- Test with library of 100+ books
- Verify no performance degradation

## Deployment Considerations

### Environment Variables

**Required**:
```bash
# .env.local (local development)
OPENAI_API_KEY=sk-...
ANNAS_SECRET_KEY=your_key_from_donation

# .env.production (production)
OPENAI_API_KEY=sk-...
ANNAS_SECRET_KEY=your_key_from_donation
```

**Vercel Deployment**:
1. Add environment variables in Vercel dashboard
2. Set `ANNAS_SECRET_KEY` as secret
3. Ensure server-side only (not exposed to client)

### Dependencies

**Production**:
```json
{
  "dependencies": {
    "cheerio": "^1.0.0-rc.12"
  }
}
```

### Build Configuration

No changes needed to `next.config.js` - API routes work automatically.

### CORS and Security

- API routes run server-side (no CORS issues)
- API key never exposed to client
- Rate limiting prevents abuse
- Input validation prevents injection attacks

## Risk Assessment

### Technical Risks

**Risk 1: Anna's Archive HTML Structure Changes**
- **Impact**: High - search will break
- **Probability**: Medium - websites change layouts
- **Mitigation**:
  - Add comprehensive error handling
  - Log parsing failures for quick detection
  - Document CSS selectors clearly for easy updates
  - Consider adding fallback parsing strategies
- **Recovery Plan**: Update CSS selectors in `/lib/annas-archive.ts` when changes detected

**Risk 2: API Key Rate Limiting**
- **Impact**: Medium - downloads temporarily blocked
- **Probability**: Low - depends on usage
- **Mitigation**:
  - Implement client-side rate limiting (Phase 4)
  - Show clear error messages with retry times
  - Cache downloaded books to avoid re-downloads
- **Recovery Plan**: User waits for rate limit to reset (typically 1-60 minutes)

**Risk 3: Large File Downloads Timeout**
- **Impact**: Medium - user can't download large books
- **Probability**: Low - most EPUBs are <10MB
- **Mitigation**:
  - Set generous timeout (30 seconds)
  - Add progress indicator to show activity
  - Allow retry on timeout
- **Recovery Plan**: User retries download or uses upload instead

**Risk 4: EPUB Metadata Extraction Fails**
- **Impact**: Low - book still works, just missing metadata
- **Probability**: Low - epubjs is mature
- **Mitigation**:
  - Fallback to Anna's Archive metadata
  - Handle missing cover gracefully
  - Log extraction errors for debugging
- **Recovery Plan**: User can manually edit book metadata (future feature)

**Risk 5: Network Failures During Download**
- **Impact**: Medium - download fails
- **Probability**: Medium - depends on network stability
- **Mitigation**:
  - Add retry mechanism
  - Show clear error messages
  - Allow user to retry manually
- **Recovery Plan**: User retries download when network stable

### Legal and Compliance Risks

**Risk 6: Terms of Service Violation**
- **Impact**: High - could be blocked by Anna's Archive
- **Probability**: Unknown - ToS unclear on automated access
- **Mitigation**:
  - Implement rate limiting to avoid abuse
  - Use official API for downloads (not scraping)
  - Respect robots.txt for search
  - Personal use only (not commercial)
- **Recovery Plan**: Switch to manual upload if blocked

**Risk 7: Copyright Issues**
- **Impact**: High - legal liability
- **Probability**: Low - Anna's Archive handles legality
- **Mitigation**:
  - Clear disclaimer that app uses Anna's Archive
  - No hosting of content (only IndexedDB storage)
  - User responsible for legal compliance
  - Personal use only
- **Recovery Plan**: Remove feature if legal issues arise

### User Experience Risks

**Risk 8: Confusing Error Messages**
- **Impact**: Low - user frustration
- **Probability**: Medium - many error scenarios
- **Mitigation**:
  - Clear, actionable error messages
  - Retry buttons for recoverable errors
  - Help text for common issues
- **Recovery Plan**: Improve messaging based on user feedback

**Risk 9: Search Results Irrelevant**
- **Impact**: Low - user searches again
- **Probability**: Medium - search quality depends on Anna's Archive
- **Mitigation**:
  - Format filter to narrow results
  - Show clear metadata to help user choose
  - Consider adding more filters (future)
- **Recovery Plan**: User refines search query

## Performance Considerations

### Search Performance

**Expected Latency**:
- Anna's Archive response: 500-2000ms
- HTML parsing: 50-200ms
- Total: 1-3 seconds

**Optimization Strategies**:
- Debounce search input (500ms)
- Show loading skeletons during search
- Cancel in-flight requests on new search
- Consider caching results (future enhancement)

### Download Performance

**Expected Latency**:
- API call for temp URL: 200-500ms
- File download: 1-10 seconds (depends on size)
- Metadata extraction: 100-500ms
- Database save: 50-100ms
- Total: 2-15 seconds

**Optimization Strategies**:
- Stream downloads to avoid memory issues
- Show progress indicator for large files
- Process metadata in background
- Update UI optimistically

### Database Performance

**Current Performance**:
- Dexie operations: <100ms
- No performance issues with 100s of books

**Monitoring**:
- Log slow operations (>500ms)
- Track IndexedDB size
- Alert if approaching browser limits (typically 50-100MB)

## Security Considerations

### API Key Protection

**Critical**: `ANNAS_SECRET_KEY` must NEVER be exposed to client.

**Implementation**:
- Stored in `.env.local` (server-side only)
- Used only in API routes (server-side)
- Never sent to browser
- Never logged in console

**Verification**:
```typescript
// ❌ WRONG - exposes key to client
const apiKey = process.env.ANNAS_SECRET_KEY; // In client component

// ✅ CORRECT - server-side only
export async function POST(request: NextRequest) {
  const apiKey = process.env.ANNAS_SECRET_KEY; // In API route
}
```

### Input Validation

**Search Query**:
- Max length: 200 characters
- URL encode before sending to Anna's Archive
- Sanitize HTML in results

**Download Hash**:
- Must match MD5 format: `/^[a-f0-9]{32}$/i`
- Validate before API call

**Format Filter**:
- Whitelist: "epub", "pdf", "mobi", etc.
- Reject unexpected values

### Rate Limiting

**Implementation** (Phase 4):
- Search: 10 requests per minute per IP
- Download: 3 requests per minute per IP
- In-memory tracking (simple approach)
- Return 429 status with Retry-After header

**Future Enhancement**:
- Redis for distributed rate limiting
- Per-user limits (with authentication)
- Dynamic limits based on API key quota

### CORS Protection

**Next.js API routes handle CORS automatically**:
- Same-origin requests allowed
- Cross-origin blocked by default
- No additional configuration needed

### Error Message Sanitization

**Never expose**:
- API keys in error messages
- Internal file paths
- Stack traces (in production)
- Database connection strings

**Always return generic messages**:
```typescript
// ❌ WRONG
throw new Error(`API key ${apiKey} invalid`);

// ✅ CORRECT
throw new Error('API key invalid');
```

## Documentation

### Code Documentation

**API Routes**:
- Document request/response formats
- List possible error codes
- Provide example requests

**Utilities**:
- Document function parameters and return types
- Explain complex parsing logic
- Link to Anna's Archive documentation

**Components**:
- Document props with TypeScript interfaces
- Explain state management
- Provide usage examples

### User Documentation

**README.md Updates**:
```markdown
## Searching for Books

1. Click "Search Books" on the library page
2. Enter a book title, author, or ISBN
3. Filter by format (EPUB recommended)
4. Click "Download to Library" on any result
5. The book will appear in your library automatically

### Requirements

- Anna's Archive API key (get via donation)
- Set `ANNAS_SECRET_KEY` in `.env.local`

### Rate Limits

- Search: 10 per minute
- Download: 3 per minute
```

**Environment Variable Guide** (`.env.example`):
```bash
# Anna's Archive API Key
# Get your key by donating at: https://annas-archive.org/donate
# Used for downloading books from Anna's Archive
# Keep this secret - never commit to git
ANNAS_SECRET_KEY=your_key_here
```

### Troubleshooting Guide

**Common Issues**:

1. **"API key not configured"**
   - Add `ANNAS_SECRET_KEY` to `.env.local`
   - Restart dev server

2. **"Search failed"**
   - Check network connection
   - Try simpler search query
   - Wait if rate limited

3. **"Download failed"**
   - Check network connection
   - Verify API key is valid
   - Try again in a few minutes (rate limit)

4. **"Book appears in library but won't open"**
   - Delete and re-download
   - Try uploading EPUB manually instead
   - Check browser console for errors

## Future Enhancements

These features are explicitly out of scope for this implementation but documented for future reference:

### Phase 5: Advanced Search (Future)

**Features**:
- Publication date range filter
- Language filter
- Publisher filter
- File size limits
- Sort options (relevance, date, title)

**Estimated Effort**: 6-8 hours

### Phase 6: Search Result Caching (Future)

**Features**:
- Cache search results for 1 hour
- Invalidate on format change
- Reduce API calls
- Faster perceived performance

**Implementation**:
- Use IndexedDB for cache storage
- Add timestamp to cache entries
- Clean up expired entries

**Estimated Effort**: 3-4 hours

### Phase 7: Batch Downloads (Future)

**Features**:
- Select multiple books
- Download queue
- Progress for multiple downloads
- Pause/resume functionality

**Challenges**:
- Rate limiting (3 per minute)
- UI for queue management
- Error handling per download

**Estimated Effort**: 8-10 hours

### Phase 8: Search History (Future)

**Features**:
- Save recent searches
- Quick access to previous queries
- Clear history option
- Sync across devices (if auth added)

**Estimated Effort**: 2-3 hours

### Phase 9: Recommendations (Future)

**Features**:
- "Related books" section
- "More by this author"
- "Readers also downloaded"

**Challenges**:
- Requires more API endpoints or scraping
- May not be supported by Anna's Archive
- Alternative: Use metadata to generate locally

**Estimated Effort**: 12-16 hours

### Phase 10: Pagination (Future)

**Features**:
- Load more results beyond first page
- Infinite scroll or "Load More" button
- Track current page

**Challenges**:
- Anna's Archive pagination structure
- State management for loaded pages

**Estimated Effort**: 4-6 hours

## Summary

This implementation plan provides a comprehensive, phase-by-phase approach to integrating Anna's Archive search and download functionality into the epub reader app. The plan is designed to be:

**Incremental**: Each phase builds on the previous, with clear dependencies and testable milestones.

**Practical**: Uses existing patterns from the codebase (API routes like TTS, database operations, component structure).

**Secure**: Protects API key, validates input, implements rate limiting, handles errors gracefully.

**Maintainable**: Clear code organization, comprehensive error handling, detailed documentation.

**Total Estimated Time**: 12-16 hours across 4 phases

**Key Deliverables**:
1. Working search API that scrapes Anna's Archive
2. Working download API that uses authenticated fast_download endpoint
3. Search UI modal integrated into library page
4. Downloaded books appearing in library alongside uploaded books
5. Comprehensive error handling and rate limiting
6. Full test coverage and documentation

**Success Metrics**:
- User can search Anna's Archive without leaving app
- User can download EPUBs directly to library
- Downloaded books work identically to uploaded books
- All error scenarios handled gracefully
- No security vulnerabilities (API key protected)
- Performance acceptable (<3s search, <15s download)

The implementation follows Next.js best practices, maintains type safety with TypeScript, and integrates seamlessly with the existing Dexie/IndexedDB storage and epubjs rendering pipeline.
