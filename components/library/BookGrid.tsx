'use client';

import React from 'react';
import BookCard from './BookCard';
import type { Book } from '@/types';

interface BookGridProps {
  books: Book[];
  onBookDeleted?: () => void;
}

export default function BookGrid({ books, onBookDeleted }: BookGridProps) {
  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onDelete={onBookDeleted} />
      ))}
    </div>
  );
}
