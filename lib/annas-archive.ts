import * as cheerio from 'cheerio';
import type { AnnaSearchResult, AnnaDownloadResponse } from '@/types/annas-archive';

const ANNAS_SEARCH_ENDPOINT = 'https://annas-archive.org/search?q=';
const ANNAS_DOWNLOAD_ENDPOINT = 'https://annas-archive.org/dyn/api/fast_download.json';
const TIMEOUT_MS = 30000; // 30 seconds

/**
 * Fetch with timeout support
 */
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

/**
 * Search Anna's Archive for books
 *
 * @param query - Search term (title, author, ISBN, etc.)
 * @param format - Optional format filter (epub, pdf, etc.)
 * @returns Array of search results
 */
export async function searchAnnasArchive(
  query: string,
  format?: string
): Promise<AnnaSearchResult[]> {
  // URL encode query
  const searchUrl = `${ANNAS_SEARCH_ENDPOINT}${encodeURIComponent(query)}`;

  // Fetch HTML
  const response = await fetchWithTimeout(searchUrl);
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

    // Check if this is a title link (has specific classes indicating it's the main book link)
    const isTitleLink = $elem.hasClass('js-vim-focus') && $elem.hasClass('custom-a');
    if (!isTitleLink) return;

    // Get the title from this link
    const title = $elem.text().trim();
    if (!title) return;

    // Find parent container
    const $container = $elem.closest('.max-w-full');
    if ($container.length === 0) return;

    // Find author link (has icon-[mdi--user-edit])
    const $authorLink = $container.find('a:has(.icon-\\[mdi--user-edit\\])');
    const authors = $authorLink.text().trim() || 'Unknown Author';

    // Find publisher link (has icon-[mdi--company])
    const $publisherLink = $container.find('a:has(.icon-\\[mdi--company\\])');
    const publisher = $publisherLink.text().trim() || 'Unknown Publisher';

    // Find metadata line (contains format, size, etc.)
    // Example: "✅ English [en] · PDF · 30.2MB · 2022 · 📘 Book (non-fiction) · 🚀/lgli/lgrs/nexusstc/zlib"
    const metaLines = $container.find('div.text-gray-800, div.dark\\:text-slate-400');
    let metaText = '';
    metaLines.each((i, el) => {
      const text = $(el).clone().children('script').remove().end().text().trim();
      if (text.includes('·') && (text.includes('MB') || text.includes('KB') || text.includes('GB'))) {
        metaText = text;
        return false; // Break
      }
    });

    // Parse metadata: "✅ English [en] · PDF · 30.2MB · 2022 · ..."
    const metaParts = metaText.split('·').map(s => s.trim());

    // Extract language (first part, remove emoji and extract text in brackets)
    const languagePart = metaParts[0] || '';
    const languageMatch = languagePart.match(/(\w+)\s*\[(\w+)\]/);
    const language = languageMatch ? languageMatch[1] : 'Unknown';

    // Extract format (usually second part after first ·)
    const bookFormat = metaParts[1]?.trim() || 'Unknown';

    // Extract size (usually third part, contains MB/KB/GB)
    const sizePart = metaParts.find(p => /\d+\.\d+\s?(MB|KB|GB)/i.test(p)) || 'Unknown';
    const size = sizePart.trim();

    // Filter by format if specified
    if (format && bookFormat.toLowerCase() !== format.toLowerCase()) {
      return; // Skip this result
    }

    // Only add if we have at least title and hash
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

/**
 * Download a book from Anna's Archive using the fast_download API
 *
 * @param hash - MD5 hash of the book
 * @param apiKey - Anna's Archive API key
 * @returns Blob containing the book file
 */
export async function downloadFromAnnasArchive(
  hash: string,
  apiKey: string
): Promise<Blob> {
  // Step 1: Get temporary download URL from fast_download API
  const apiUrl = `${ANNAS_DOWNLOAD_ENDPOINT}?md5=${hash}&key=${apiKey}`;

  const response = await fetchWithTimeout(apiUrl);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data: AnnaDownloadResponse = await response.json();

  if (data.error || !data.download_url) {
    throw new Error(data.error || 'Failed to get download URL');
  }

  // Step 2: Download actual file from temporary URL
  const fileResponse = await fetchWithTimeout(data.download_url);
  if (!fileResponse.ok) {
    throw new Error(`Download failed: ${fileResponse.status}`);
  }

  return await fileResponse.blob();
}

/**
 * Validate MD5 hash format
 */
export function isValidMD5Hash(hash: string): boolean {
  return /^[a-f0-9]{32}$/i.test(hash);
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\?%*:|"<>]/g, '_');
}
