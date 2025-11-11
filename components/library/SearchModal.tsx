'use client';

import React, { useState, useEffect } from 'react';
import SearchResultCard from './SearchResultCard';
import type { AnnaSearchResult } from '@/types/annas-archive';
import { searchAnnasArchive, downloadFromAnnasArchive } from '@/lib/annas-archive';
import { getAnnasArchiveApiKey } from '@/lib/api-keys';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookDownloaded: () => void;
}

// Error types for better error categorization
enum ErrorType {
  NETWORK = 'network',
  RATE_LIMIT = 'rate_limit',
  API_KEY = 'api_key',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown',
}

interface ErrorState {
  message: string;
  type: ErrorType;
  retryAfter?: number;
}

export default function SearchModal({
  isOpen,
  onClose,
  onBookDownloaded,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnnaSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [downloadingHash, setDownloadingHash] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]); // handleSearch is stable and doesn't need to be in deps

  // Keyboard shortcuts
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

  const handleSearch = async () => {
    setIsSearching(true);
    setError(null);

    try {
      // Call Anna's Archive directly from client
      const results = await searchAnnasArchive(query, 'epub');
      setResults(results);
    } catch (err: any) {
      console.error('[Search] Error:', err);

      // Categorize error
      let errorState: ErrorState;

      if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
        errorState = {
          message: 'Search request timed out. Please try again.',
          type: ErrorType.TIMEOUT,
        };
      } else if (err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        errorState = {
          message: 'Network error. Please check your internet connection and try again.',
          type: ErrorType.NETWORK,
        };
      } else {
        errorState = {
          message: err.message || 'Search failed. Please try again.',
          type: ErrorType.UNKNOWN,
        };
      }

      setError(errorState);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (book: AnnaSearchResult) => {
    setDownloadingHash(book.hash);
    setError(null);

    try {
      // Check if Anna's Archive API key is configured
      const annasApiKey = await getAnnasArchiveApiKey();
      if (!annasApiKey) {
        throw new Error('Anna\'s Archive API key not configured. Please add your API key in settings.');
      }

      // Step 1: Download file directly from Anna's Archive
      console.log('[Download] Downloading from Anna\'s Archive:', book.title);
      const blob = await downloadFromAnnasArchive(book.hash, annasApiKey);
      console.log('[Download] Received blob:', blob.size, 'bytes');

      // Step 2: Load EPUB and extract metadata
      const ePub = (await import('epubjs')).default;
      const arrayBuffer = await blob.arrayBuffer();
      const epubBook = ePub(arrayBuffer);

      console.log('[Download] Loading EPUB metadata...');
      await epubBook.ready;

      // Extract metadata
      const metadata = await epubBook.loaded.metadata;
      console.log('[Download] Metadata:', metadata);

      // Extract cover
      let coverUrl: string | undefined;
      let coverBlob: Blob | undefined;
      try {
        const cover = await epubBook.coverUrl();
        coverUrl = cover || undefined;
        console.log('[Download] Cover URL:', coverUrl);

        // Fetch the cover blob for persistent storage
        if (coverUrl) {
          try {
            const coverResponse = await fetch(coverUrl);
            coverBlob = await coverResponse.blob();
            console.log('[Download] Cover blob fetched:', coverBlob.size, 'bytes');
          } catch (fetchError) {
            console.warn('[Download] Could not fetch cover blob:', fetchError);
          }
        }
      } catch (coverError) {
        console.warn('[Download] Could not extract cover:', coverError);
      }

      // Step 3: Save to library database
      const { addBook } = await import('@/lib/db');

      const bookData = {
        title: metadata.title || book.title,
        author: metadata.creator || book.authors || 'Unknown Author',
        filePath: '', // Will be set by addBook
        fileBlob: blob,
        coverUrl: coverUrl || undefined,
        coverBlob: coverBlob || undefined,
        isbn: metadata.identifier || undefined,
        tags: ['downloaded'] as string[], // Tag for tracking source
      };

      console.log('[Download] Saving to library:', bookData.title);
      const bookId = await addBook(bookData);
      console.log('[Download] Book added to library with ID:', bookId);

      // Step 4: Success feedback and refresh
      setSuccessMessage(`"${book.title}" added to library!`);

      // Close modal and refresh library after a brief delay
      setTimeout(() => {
        setSuccessMessage(null);
        onBookDownloaded(); // Calls loadBooks() in parent
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('[Download] Error:', err);

      // Categorize download errors
      let errorState: ErrorState;

      if (err.message?.includes('rate limit') || err.message?.includes('Download limit')) {
        errorState = {
          message: 'Download limit reached. Please wait before downloading again.',
          type: ErrorType.RATE_LIMIT,
        };
      } else if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
        errorState = {
          message: 'Download timed out. The file may be too large or the server is busy. Please try again.',
          type: ErrorType.TIMEOUT,
        };
      } else if (err.message?.includes('API key') || err.message?.includes('not configured')) {
        errorState = {
          message: "Anna's Archive API key not configured or invalid. Please check your configuration.",
          type: ErrorType.API_KEY,
        };
      } else if (err.message?.includes('network') || err.message?.includes('Failed to fetch')) {
        errorState = {
          message: 'Network error during download. Please check your connection and try again.',
          type: ErrorType.NETWORK,
        };
      } else {
        errorState = {
          message: err.message || 'Download failed. Please try again.',
          type: ErrorType.UNKNOWN,
        };
      }

      setError(errorState);
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
          <div className="space-y-2">
            <input
              id="search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, ISBN..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-100"
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Searching EPUB books only (compatible with this reader)
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={`rounded-lg p-4 mb-4 ${
              error.type === ErrorType.RATE_LIMIT
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                : error.type === ErrorType.API_KEY
                ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-2">
                {/* Icon based on error type */}
                {error.type === ErrorType.RATE_LIMIT && (
                  <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {error.type === ErrorType.API_KEY && (
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                )}
                {(error.type === ErrorType.NETWORK || error.type === ErrorType.TIMEOUT) && (
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {error.type === ErrorType.UNKNOWN && (
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <div className="flex-1">
                  <p className={`font-medium ${
                    error.type === ErrorType.RATE_LIMIT
                      ? 'text-yellow-800 dark:text-yellow-200'
                      : error.type === ErrorType.API_KEY
                      ? 'text-orange-800 dark:text-orange-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {error.message}
                  </p>
                  {error.retryAfter && (
                    <p className="text-sm mt-1 text-yellow-700 dark:text-yellow-300">
                      Please try again in {error.retryAfter} seconds
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading State with Skeletons */}
          {isSearching && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
                  {/* Title skeleton */}
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                  {/* Author skeleton */}
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                  {/* Publisher skeleton */}
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                  {/* Metadata badges skeleton */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                  {/* Button skeleton */}
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              ))}
            </div>
          )}

          {/* No Results State */}
          {!isSearching && query.length >= 3 && results.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No results found. Try a different search term.</p>
            </div>
          )}

          {/* Minimum Length State */}
          {!isSearching && query.length < 3 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Enter at least 3 characters to search.</p>
            </div>
          )}

          {/* Results Grid */}
          {!isSearching && results.length > 0 && (
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
          )}
        </div>
      </div>
    </div>
  );
}
