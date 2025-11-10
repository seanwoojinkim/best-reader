// Anna's Archive integration types

/**
 * Search result from Anna's Archive
 */
export interface AnnaSearchResult {
  title: string;
  authors: string;
  publisher: string;
  language: string;
  format: string;    // epub, pdf, etc.
  size: string;      // "2.5 MB"
  hash: string;      // MD5 hash identifier for downloads
  url: string;       // Anna's Archive detail page URL
}

/**
 * Request payload for downloading a book
 */
export interface AnnaDownloadRequest {
  hash: string;
  title: string;
  format: string;
}

/**
 * Response from Anna's Archive fast_download API
 */
export interface AnnaDownloadResponse {
  download_url: string;
  error: string;
}

/**
 * Search API response
 */
export interface AnnaSearchAPIResponse {
  success: boolean;
  results: AnnaSearchResult[];
  count: number;
  error?: string;
}

/**
 * Download API error response
 */
export interface AnnaDownloadAPIError {
  success: false;
  error: string;
  retryAfter?: number;
}
