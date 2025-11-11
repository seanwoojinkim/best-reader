'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Book } from '@/types';

interface BookCardProps {
  book: Book;
}

export default function BookCard({ book }: BookCardProps) {
  const [coverUrl, setCoverUrl] = useState<string | undefined>(book.coverUrl);

  useEffect(() => {
    // If we have a coverBlob but no valid coverUrl (or it's a stale blob URL), create a new one
    if (book.coverBlob && (!book.coverUrl || book.coverUrl.startsWith('blob:'))) {
      const url = URL.createObjectURL(book.coverBlob);
      setCoverUrl(url);

      // Cleanup on unmount
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (book.coverUrl && !book.coverUrl.startsWith('blob:')) {
      // If coverUrl is a regular URL (not a blob URL), use it directly
      setCoverUrl(book.coverUrl);
    }
  }, [book.coverBlob, book.coverUrl]);

  return (
    <Link
      href={`/reader?id=${book.id}`}
      className="group block transition-transform duration-200 hover:scale-105"
    >
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
      </div>

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
