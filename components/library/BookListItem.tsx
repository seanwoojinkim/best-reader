'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Book } from '@/types';
import { deleteBook } from '@/lib/db';

interface BookListItemProps {
  book: Book;
  onDelete?: () => void;
}

export default function BookListItem({ book, onDelete }: BookListItemProps) {
  const [coverUrl, setCoverUrl] = useState<string | undefined>(book.coverUrl);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const coverData = book.coverBuffer
      ? new Blob([book.coverBuffer], { type: 'image/jpeg' })
      : book.coverBlob;

    if (coverData && (!book.coverUrl || book.coverUrl.startsWith('blob:'))) {
      const url = URL.createObjectURL(coverData);
      setCoverUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (book.coverUrl && !book.coverUrl.startsWith('blob:')) {
      setCoverUrl(book.coverUrl);
    }
  }, [book.coverBlob, book.coverBuffer, book.coverUrl]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!book.id || !window.confirm(`Delete "${book.title}"?`)) return;

    try {
      setIsDeleting(true);
      await deleteBook(book.id);
      onDelete?.();
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('Failed to delete book.');
      setIsDeleting(false);
    }
  };

  return (
    <Link href={`/reader?id=${book.id}`}>
      <div className="group flex items-center gap-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        {/* Cover */}
        <div className="relative w-16 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          )}
        </div>

        {/* Book Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-base font-medium text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-gray-700 dark:group-hover:text-gray-300">
            {book.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{book.author}</p>
          {book.lastOpenedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Last read {formatRelativeTime(book.lastOpenedAt)}
            </p>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          aria-label="Delete book"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </Link>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
