import Dexie, { Table } from 'dexie';
import type { Book, ReadingPosition, Session, Highlight } from '@/types';

export class ReaderDatabase extends Dexie {
  books!: Table<Book, number>;
  positions!: Table<ReadingPosition, number>;
  sessions!: Table<Session, number>;
  highlights!: Table<Highlight, number>;

  constructor() {
    super('AdaptiveReaderDB');

    this.version(1).stores({
      books: '++id, title, author, addedAt, lastOpenedAt, *tags',
      positions: 'bookId, updatedAt',
      sessions: '++id, bookId, startTime, endTime',
      highlights: '++id, bookId, cfiRange, color, createdAt',
    });
  }
}

// Create database instance
export const db = new ReaderDatabase();

// Helper functions for common operations

/**
 * Add a new book to the library
 */
export async function addBook(book: Omit<Book, 'id' | 'addedAt'>): Promise<number> {
  const bookWithDate: Book = {
    ...book,
    addedAt: new Date(),
  };
  return await db.books.add(bookWithDate);
}

/**
 * Get all books from library
 */
export async function getAllBooks(): Promise<Book[]> {
  return await db.books.orderBy('lastOpenedAt').reverse().toArray();
}

/**
 * Get a single book by ID
 */
export async function getBook(id: number): Promise<Book | undefined> {
  return await db.books.get(id);
}

/**
 * Update book's last opened timestamp
 */
export async function updateBookLastOpened(id: number): Promise<void> {
  await db.books.update(id, { lastOpenedAt: new Date() });
}

/**
 * Delete a book and its associated data
 */
export async function deleteBook(id: number): Promise<void> {
  await db.transaction('rw', db.books, db.positions, db.sessions, db.highlights, async () => {
    await db.books.delete(id);
    await db.positions.where('bookId').equals(id).delete();
    await db.sessions.where('bookId').equals(id).delete();
    await db.highlights.where('bookId').equals(id).delete();
  });
}

/**
 * Save reading position for a book
 */
export async function savePosition(position: ReadingPosition): Promise<void> {
  const existing = await db.positions.get(position.bookId);

  if (existing) {
    await db.positions.update(position.bookId, {
      ...position,
      updatedAt: new Date(),
    });
  } else {
    await db.positions.add({
      ...position,
      updatedAt: new Date(),
    });
  }
}

/**
 * Get reading position for a book
 */
export async function getPosition(bookId: number): Promise<ReadingPosition | undefined> {
  return await db.positions.get(bookId);
}

/**
 * Clear all data (for testing or reset)
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.books, db.positions, db.sessions, db.highlights, async () => {
    await db.books.clear();
    await db.positions.clear();
    await db.sessions.clear();
    await db.highlights.clear();
  });
}
