'use client';

import React, { useEffect, useState } from 'react';
import { getAllBooks } from '@/lib/db';
import type { Book } from '@/types';
import BookGrid from '@/components/library/BookGrid';
import EmptyState from '@/components/library/EmptyState';
import UploadButton from '@/components/library/UploadButton';

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBooks = async () => {
    try {
      const allBooks = await getAllBooks();
      setBooks(allBooks);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleUploadComplete = () => {
    loadBooks();
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-gray-100">Library</h1>
            <UploadButton onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
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
              <p className="text-gray-500">Loading library...</p>
            </div>
          </div>
        ) : books.length === 0 ? (
          <EmptyState />
        ) : (
          <BookGrid books={books} />
        )}
      </main>
    </div>
  );
}
