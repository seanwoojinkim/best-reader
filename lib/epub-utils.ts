import ePub, { Book as EpubBook } from 'epubjs';

/**
 * Helper function to wrap promises with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Extract metadata from EPUB file
 */
export async function extractEpubMetadata(file: File): Promise<{
  title: string;
  author: string;
  coverUrl?: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);

    // Wait for book to be ready with 10 second timeout
    await withTimeout(book.ready, 10000);

    // Extract metadata
    const metadata = await book.loaded.metadata;
    const title = metadata.title || file.name.replace('.epub', '');
    const author = metadata.creator || 'Unknown Author';

    // Extract cover image with timeout
    let coverUrl: string | undefined;
    try {
      const cover = await withTimeout(book.coverUrl(), 5000);
      if (cover) {
        coverUrl = cover;
      }
    } catch (e) {
      console.warn('Could not extract cover:', e);
    }

    return {
      title,
      author,
      coverUrl,
    };
  } catch (error) {
    console.error('Error extracting EPUB metadata:', error);

    // Fallback to filename
    return {
      title: file.name.replace('.epub', ''),
      author: 'Unknown Author',
    };
  }
}

/**
 * Create a blob URL from a file
 */
export function createBlobUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeBlobUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Validate EPUB file
 */
export function isValidEpubFile(file: File): boolean {
  const validExtensions = ['.epub'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
