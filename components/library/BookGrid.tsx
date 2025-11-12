'use client';

import React from 'react';
import BookCard from './BookCard';
import BookListItem from './BookListItem';
import type { Book } from '@/types';

interface BookGridProps {
  books: Book[];
  onBookDeleted?: () => void;
  viewMode?: 'grid' | 'list';
}

export default function BookGrid({ books, onBookDeleted, viewMode = 'grid' }: BookGridProps) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-3">
        {books.map((book) => (
          <BookListItem key={book.id} book={book} onDelete={onBookDeleted} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onDelete={onBookDeleted} />
      ))}
    </div>
  );
}
