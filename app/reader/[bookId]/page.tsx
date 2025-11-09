'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getBook, getPosition, updateBookLastOpened } from '@/lib/db';
import type { Book, ReadingPosition } from '@/types';
import ReaderView from '@/components/reader/ReaderView';

export default function ReaderPage() {
  const params = useParams();
  const bookId = Number(params.bookId);

  const [book, setBook] = useState<Book | null>(null);
  const [position, setPosition] = useState<ReadingPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    <ReaderView
      bookId={bookId}
      bookBlob={book.fileBlob}
      initialCfi={position?.cfi}
    />
  );
}
