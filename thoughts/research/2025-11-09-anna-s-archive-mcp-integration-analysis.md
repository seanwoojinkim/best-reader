---
doc_type: research
date: 2025-11-10T03:56:28+00:00
title: "Anna's Archive MCP Integration Analysis"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T03:56:28+00:00"
research_question: "How to integrate anna's-mcp search and download functionality into our Next.js/TypeScript epub reader app"
research_type: codebase_research
researcher: Sean Kim

git_commit: c3bbf68160f00a0b879a8469048bec3ea44b899b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Sean Kim

tags:
  - annas-archive
  - integration
  - api
  - typescript
  - nextjs
status: complete

related_docs: []
---

# Research: Anna's Archive MCP Integration Analysis

**Date**: 2025-11-10T03:56:28+00:00
**Researcher**: Sean Kim
**Git Commit**: c3bbf68160f00a0b879a8469048bec3ea44b899b
**Branch**: main
**Repository**: reader
**External Codebase Analyzed**: `/tmp/annas-mcp` (anna's-mcp)

## Research Question

How to integrate anna's-mcp search and download functionality into our Next.js/TypeScript epub reader app?

## Summary

The anna's-mcp codebase is a Go-based MCP (Model Context Protocol) server and CLI tool that provides search and download functionality for Anna's Archive. The implementation uses **web scraping for search** (not a JSON API) and a **fast_download JSON API for downloads** (requires API key). The architecture is simple with two core functions: search via HTML parsing and download via authenticated API calls.

**Key findings for TypeScript integration:**
- Search uses web scraping (CSS selectors on HTML), not an API endpoint
- Download uses Anna's Archive fast_download JSON API: `https://annas-archive.org/dyn/api/fast_download.json?md5={hash}&key={apiKey}`
- API key is required only for downloads (obtained through donation)
- Download is a two-step process: get temporary download URL from API, then fetch the actual file
- No complex authentication beyond the API key parameter
- The MCP server wrapper is unnecessary for direct integration

## Detailed Findings

### 1. Core Architecture

#### Search Function (`anna.FindBook`)
**Location**: [`/tmp/annas-mcp/internal/anna/anna.go:39-89`](file:///tmp/annas-mcp/internal/anna/anna.go#L39-L89)

The search function performs web scraping on Anna's Archive search results:

```go
const AnnasSearchEndpoint = "https://annas-archive.org/search?q=%s"
```

**How it works:**
1. Constructs search URL with URL-encoded query parameter
2. Uses Colly web scraper to visit the search page asynchronously
3. Extracts book data by parsing HTML with CSS selectors:
   - Finds all `<a>` tags with href starting with `/md5/`
   - Extracts metadata from parent element's child divs
   - Parses meta information (language, format, size) from comma-separated string
4. Returns array of `Book` structs

**CSS Selectors used** (line 64-67):
- Meta info: `div.relative.top-\[-1\].pl-4.grow.overflow-hidden > div` (eq 0)
- Title: `div.relative.top-\[-1\].pl-4.grow.overflow-hidden > h3`
- Publisher: `div.relative.top-\[-1\].pl-4.grow.overflow-hidden > div` (eq 1)
- Authors: `div.relative.top-\[-1\].pl-4.grow.overflow-hidden > div` (eq 2)

**Note**: This is fragile - depends on Anna's Archive HTML structure remaining constant.

#### Download Function (`Book.Download`)
**Location**: [`/tmp/annas-mcp/internal/anna/anna.go:91-133`](file:///tmp/annas-mcp/internal/anna/anna.go#L91-L133)

The download function is a two-step authenticated process:

**Step 1: Get temporary download URL** (lines 92-109)
```go
apiURL := fmt.Sprintf(AnnasDownloadEndpoint, b.Hash, secretKey)
// GET https://annas-archive.org/dyn/api/fast_download.json?md5={hash}&key={secretKey}
```

Response structure [`/tmp/annas-mcp/internal/anna/structs.go:14-17`](file:///tmp/annas-mcp/internal/anna/structs.go#L14-L17):
```go
type fastDownloadResponse struct {
    DownloadURL string `json:"download_url"`
    Error       string `json:"error"`
}
```

**Step 2: Download actual file** (lines 111-132)
- Fetches file from `download_url` returned in step 1
- Saves to filesystem with sanitized filename: `{title}.{format}`
- Replaces `/` characters in title with `_`

### 2. API Integration Details

#### Anna's Archive API Endpoints

**Search Endpoint** (web scraping):
- URL: `https://annas-archive.org/search?q={query}`
- Method: GET (web scraping, no JSON API)
- Authentication: None required
- Response: HTML page (not JSON)

**Download API Endpoint**:
- URL: `https://annas-archive.org/dyn/api/fast_download.json?md5={hash}&key={apiKey}`
- Method: GET
- Authentication: API key in `key` query parameter
- Request format: URL query parameters only
- Response format: JSON

**Download API Response:**
```json
{
  "download_url": "https://...",  // Temporary download URL
  "error": ""                      // Error message if failed
}
```

**Authentication Details:**
- API key obtained through donation to Anna's Archive
- Set via environment variable: `ANNAS_SECRET_KEY`
- Used only in download requests as URL query parameter
- No headers, tokens, or complex auth schemes

#### Complete Flow from Search to Download

**Search Flow:**
1. User provides search term
2. URL-encode term and construct search URL
3. Scrape HTML from search results page
4. Parse book elements using CSS selectors
5. Extract: title, authors, publisher, language, format, size, URL, MD5 hash
6. Return array of books

**Download Flow:**
1. User selects book (provides hash, title, format from search results)
2. Call fast_download API with MD5 hash and API key
3. Parse JSON response to get temporary `download_url`
4. HTTP GET the temporary URL to fetch actual file bytes
5. Stream file to disk with sanitized filename
6. Return success/error

### 3. Data Models

#### Book Structure
**Location**: [`/tmp/annas-mcp/internal/anna/structs.go:3-12`](file:///tmp/annas-mcp/internal/anna/structs.go#L3-L12)

```go
type Book struct {
    Language  string `json:"language"`   // e.g., "English"
    Format    string `json:"format"`     // e.g., "pdf", "epub"
    Size      string `json:"size"`       // e.g., "2.5 MB"
    Title     string `json:"title"`      // Book title
    Publisher string `json:"publisher"`  // Publisher name
    Authors   string `json:"authors"`    // Author names (comma-separated if multiple)
    URL       string `json:"url"`        // Anna's Archive book detail page URL
    Hash      string `json:"hash"`       // MD5 hash identifier
}
```

**Hash Usage:**
- The MD5 hash is the primary identifier for downloads
- Extracted from URL path: `/md5/{hash}` → hash
- Used in download API endpoint
- Must be passed from search results to download function

**Metadata Parsing:**
- Meta string format: `"{language}, {format}, {unknown}, {size}, {unknown}"`
- Example: `"English, pdf, 3rd Edition, 2.5 MB, 2020"`
- Parser extracts indices 0 (language), 1 (format), 3 (size)
- Format string has leading bracket removed: `"[pdf"` → `"pdf"`

### 4. Dependencies & Requirements

#### Critical Dependencies (from `go.mod`)
**Location**: [`/tmp/annas-mcp/go.mod:5-10`](file:///tmp/annas-mcp/go.mod#L5-L10)

**Essential for functionality:**
1. `github.com/gocolly/colly/v2` - Web scraping library for search
2. Standard Go libraries: `net/http`, `encoding/json`, `io`, `os`

**Not essential (MCP/CLI specific):**
- `github.com/modelcontextprotocol/go-sdk` - MCP server protocol (only if using MCP)
- `github.com/charmbracelet/fang` - CLI framework
- `github.com/spf13/cobra` - CLI commands
- `go.uber.org/zap` - Logging

#### Can Core Logic Be Extracted?

**Yes**, the core logic is in two functions that are independent of MCP/CLI:
- `anna.FindBook()` - Only depends on Colly for web scraping
- `Book.Download()` - Only uses standard library HTTP client

**TypeScript extraction strategy:**
- Search: Use any HTML parser (cheerio, jsdom) to replicate CSS selector logic
- Download: Standard fetch/axios calls - no special dependencies
- No need to interact with Go code at runtime

### 5. Minimal Functionality Set

**For TypeScript/Next.js integration, you need:**

1. **HTML Scraper** (for search):
   - Fetch HTML from search URL
   - Parse with CSS selectors to extract book data
   - Handle async scraping

2. **HTTP Client** (for download):
   - GET request to fast_download API with hash and key
   - Parse JSON response
   - Stream download from temporary URL
   - Save file or return blob

3. **Environment Configuration**:
   - Store API key securely (environment variable or secure storage)
   - Configure download path

**No authentication library needed** - just URL parameters.

### 6. MCP Server Implementation

**Location**: [`/tmp/annas-mcp/internal/modes/mcpserver.go:13-120`](file:///tmp/annas-mcp/internal/modes/mcpserver.go#L13-L120)

The MCP server is a thin wrapper around the core functions:

**Search Tool** (lines 13-43):
- Takes `SearchParams` with `term` field
- Calls `anna.FindBook(term)`
- Returns formatted text and structured book array

**Download Tool** (lines 45-90):
- Takes `DownloadParams`: `hash`, `title`, `format`
- Reads environment variables for API key and download path
- Constructs `Book` struct from parameters
- Calls `Book.Download()`
- Returns success message

**MCP Protocol Details:**
- Uses stdio transport for communication
- Tools exposed: `search` and `download`
- Input parameters defined with descriptions
- Standard MCP request/response format

**For integration**: The MCP server adds protocol overhead. Direct API calls are simpler for Next.js backend.

### 7. Environment Variables

**Location**: [`/tmp/annas-mcp/internal/modes/env.go:16-37`](file:///tmp/annas-mcp/internal/modes/env.go#L16-L37)

**Required environment variables:**
- `ANNAS_SECRET_KEY` - API key from Anna's Archive donation
- `ANNAS_DOWNLOAD_PATH` - Directory path for downloaded files

**Validation:**
- Both must be set or error is returned
- Checked at download time (not at startup for search-only usage)

## Integration Strategy for Next.js/TypeScript

### Option 1: Direct API Implementation (Recommended)

**Approach**: Reimplement the core logic in TypeScript

**Pros:**
- No external dependencies (Go binary, MCP protocol)
- Full control over implementation
- Native TypeScript/Node.js patterns
- Easier to customize and extend
- Better error handling for web context

**Cons:**
- Need to maintain scraping logic if Anna's Archive HTML changes
- Duplicate implementation work

**Implementation outline:**

```typescript
// Search function
async function searchBooks(query: string): Promise<Book[]> {
  const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(query)}`;
  const html = await fetch(searchUrl).then(r => r.text());
  const $ = cheerio.load(html);

  const books: Book[] = [];
  $('a[href^="/md5/"]').each((i, elem) => {
    // Parse book data from HTML structure
    // Extract: title, authors, publisher, meta info, hash
  });

  return books;
}

// Download function
async function downloadBook(hash: string, apiKey: string): Promise<Blob> {
  // Step 1: Get download URL
  const apiUrl = `https://annas-archive.org/dyn/api/fast_download.json?md5=${hash}&key=${apiKey}`;
  const { download_url, error } = await fetch(apiUrl).then(r => r.json());

  if (error || !download_url) {
    throw new Error(error || 'Failed to get download URL');
  }

  // Step 2: Download file
  const fileBlob = await fetch(download_url).then(r => r.blob());
  return fileBlob;
}
```

**Next.js API routes:**
- `/api/books/search?q={query}` - Server-side search to avoid CORS
- `/api/books/download?hash={hash}` - Server-side download with API key

### Option 2: Use MCP Server as Subprocess

**Approach**: Run the Go binary as MCP server and communicate via stdio

**Pros:**
- No reimplementation needed
- Automatic updates if anna's-mcp is maintained

**Cons:**
- Additional binary dependency
- MCP protocol overhead
- Harder to deploy (need Go binary in production)
- Less control over errors and responses
- Subprocess management complexity

**Not recommended** for web application - better suited for desktop MCP clients.

### Option 3: Extract and Vendor Go Code

**Approach**: Run Go code via WebAssembly or subprocess calls

**Pros:**
- Use existing tested code

**Cons:**
- Complexity of Go/Node.js bridge
- Deployment overhead
- Overkill for simple HTTP/scraping operations

**Not recommended** - TypeScript reimplementation is simpler.

## Recommended Implementation Plan

### For Next.js/TypeScript epub reader at `/Users/seankim/dev/reader`:

1. **Create Next.js API routes**:
   - `app/api/books/search/route.ts` - Search endpoint
   - `app/api/books/download/route.ts` - Download endpoint

2. **Dependencies to install**:
   ```bash
   npm install cheerio  # For HTML parsing
   ```

3. **Environment variables** (`.env.local`):
   ```
   ANNAS_SECRET_KEY=your_api_key_here
   ```

4. **Search implementation**:
   - Use `cheerio` to replicate CSS selector logic from Go code
   - Parse HTML structure matching the selectors in `anna.go:64-67`
   - Return JSON array of books

5. **Download implementation**:
   - Call fast_download API with hash and API key
   - Stream response to client or save to storage
   - For epub reader: directly pass blob to epub.js viewer

6. **Frontend integration**:
   - Search UI to call `/api/books/search`
   - Display results with metadata
   - Download button calls `/api/books/download`
   - Open downloaded epub in existing reader

### Security Considerations

- **Never expose API key to frontend** - keep in server-side environment variables
- **Rate limiting** - Anna's Archive may rate limit scraping
- **CORS** - Use Next.js API routes to proxy requests
- **Download limits** - Consider caching or user quotas

### Testing Strategy

1. Test search with sample queries
2. Verify HTML parsing matches current Anna's Archive structure
3. Test download flow with valid API key
4. Handle errors: invalid hash, API key issues, network failures
5. Test epub file opening in your reader

## Code References

- **Main search logic**: `/tmp/annas-mcp/internal/anna/anna.go:39-89`
- **Download logic**: `/tmp/annas-mcp/internal/anna/anna.go:91-133`
- **Data structures**: `/tmp/annas-mcp/internal/anna/structs.go:3-17`
- **API endpoints**: `/tmp/annas-mcp/internal/anna/anna.go:22-24`
- **MCP server**: `/tmp/annas-mcp/internal/modes/mcpserver.go:13-120`
- **Environment config**: `/tmp/annas-mcp/internal/modes/env.go:16-37`

## Open Questions

1. **Rate limiting**: What are Anna's Archive rate limits for scraping and API?
2. **HTML stability**: How frequently does Anna's Archive change their HTML structure?
3. **API key limits**: Are there download quotas or restrictions with the API key?
4. **Legal considerations**: What are the terms of service for programmatic access?
5. **Caching strategy**: Should search results be cached? For how long?

## Next Steps

1. Set up Anna's Archive API key (requires donation)
2. Create proof-of-concept search implementation in TypeScript
3. Test HTML parsing against current Anna's Archive structure
4. Implement download API call and test with API key
5. Integrate into epub reader UI
6. Add error handling and rate limiting
7. Consider caching strategy for search results
