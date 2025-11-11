'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getBook,
  getPosition,
  updateBookLastOpened,
  getLastSession,
  getAllHighlights,
} from '@/lib/db';
import { shouldShowRecap } from '@/lib/analytics';
import type { Book, ReadingPosition, Session, Highlight } from '@/types';
import ReaderView from '@/components/reader/ReaderView';
import RecapModal from '@/components/reader/RecapModal';

const RECAP_SHOWN_KEY = 'recap-shown-session';

export default function ReaderPage() {
  // Query parameter routing for Capacitor compatibility
  // Using useSearchParams() instead of dynamic route segments
  // to avoid URL encoding issues with Capacitor's WebView asset handler
  const searchParams = useSearchParams();
  const bookId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  const [book, setBook] = useState<Book | null>(null);
  const [position, setPosition] = useState<ReadingPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 3: Recap modal state
  const [showRecap, setShowRecap] = useState(false);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [lastHighlight, setLastHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    if (bookId === null) {
      setError('No book ID provided');
      setLoading(false);
      return;
    }

    const loadBook = async () => {
      try {
        // Get book from database
        const bookData = await getBook(bookId);
        if (!bookData) {
          setError('Book not found');
          setLoading(false);
          return;
        }

        if (!bookData.fileBlob) {
          setError('Book file not found');
          setLoading(false);
          return;
        }

        setBook(bookData);

        // Get saved reading position
        const positionData = await getPosition(bookId);
        setPosition(positionData || null);

        // Phase 3: Check if we should show recap modal
        const recapShownThisSession = sessionStorage.getItem(RECAP_SHOWN_KEY);
        if (!recapShownThisSession) {
          const previousSession = await getLastSession(bookId);
          if (previousSession && previousSession.endTime) {
            const currentSessionStart = new Date();
            if (shouldShowRecap(previousSession.endTime, currentSessionStart)) {
              setLastSession(previousSession);

              // Get last highlight for this book
              const allHighlights = await getAllHighlights();
              const bookHighlights = allHighlights.filter((h) => h.bookId === bookId);
              if (bookHighlights.length > 0) {
                setLastHighlight(bookHighlights[0]); // Most recent
              }

              setShowRecap(true);
              sessionStorage.setItem(RECAP_SHOWN_KEY, 'true');
            }
          }
        }

        // Update last opened timestamp
        await updateBookLastOpened(bookId);

        setLoading(false);
      } catch (err) {
        console.error('Error loading book:', err);
        setError('Failed to load book');
        setLoading(false);
      }
    };

    loadBook();
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-500">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error || !book || !book.fileBlob) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">
            {error || 'Book not found'}
          </h2>
          <p className="text-gray-500 mb-6">
            Unable to load the requested book.
          </p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-900 hover:bg-gray-800"
          >
            ← Back to Library
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Phase 3: Recap Modal */}
      {showRecap && lastSession && (
        <RecapModal
          lastSession={lastSession}
          lastHighlight={lastHighlight || undefined}
          bookTitle={book.title}
          onContinue={() => setShowRecap(false)}
        />
      )}

      <ReaderView
        bookId={bookId!}
        bookBlob={book.fileBlob}
        initialCfi={position?.cfi}
      />
    </>
  );
}
