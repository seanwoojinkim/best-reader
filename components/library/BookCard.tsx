'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Book } from '@/types';
import { deleteBook } from '@/lib/db';

interface BookCardProps {
  book: Book;
  onDelete?: () => void;
}

export default function BookCard({ book, onDelete }: BookCardProps) {
  const [coverUrl, setCoverUrl] = useState<string | undefined>(book.coverUrl);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Prefer coverBuffer (iOS compatible), fallback to coverBlob
    const coverData = book.coverBuffer
      ? new Blob([book.coverBuffer], { type: 'image/jpeg' })
      : book.coverBlob;

    // If we have cover data but no valid coverUrl (or it's a stale blob URL), create a new one
    if (coverData && (!book.coverUrl || book.coverUrl.startsWith('blob:'))) {
      const url = URL.createObjectURL(coverData);
      setCoverUrl(url);

      // Cleanup on unmount
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (book.coverUrl && !book.coverUrl.startsWith('blob:')) {
      // If coverUrl is a regular URL (not a blob URL), use it directly
      setCoverUrl(book.coverUrl);
    }
  }, [book.coverBlob, book.coverBuffer, book.coverUrl]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!book.id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${book.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await deleteBook(book.id);
      onDelete?.();
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('Failed to delete book. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="group relative transition-transform duration-200 hover:scale-105">
      <Link href={`/reader?id=${book.id}`} className="block">
        <div className="relative aspect-[2/3] bg-gray-100 rounded-lg overflow-hidden shadow-md mb-3">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`Cover of ${book.title}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <svg
              className="h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        )}

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 disabled:opacity-50 z-10"
          aria-label="Delete book"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
      </Link>

      <div className="space-y-1">
        <h3 className="font-serif text-lg font-medium text-gray-900 line-clamp-2 group-hover:text-gray-700 transition-colors">
          {book.title}
        </h3>
        <p className="text-sm text-gray-600 line-clamp-1">{book.author}</p>
        {book.lastOpenedAt && (
          <p className="text-xs text-gray-400">
            Last read {formatRelativeTime(book.lastOpenedAt)}
          </p>
        )}
      </div>
    </div>
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
