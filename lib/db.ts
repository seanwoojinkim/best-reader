import Dexie, { Table } from 'dexie';
import type { Book, ReadingPosition, Session, Highlight, Analytics } from '@/types';

export class ReaderDatabase extends Dexie {
  books!: Table<Book, number>;
  positions!: Table<ReadingPosition, number>;
  sessions!: Table<Session, number>;
  highlights!: Table<Highlight, number>;
  analytics!: Table<Analytics, number>;

  constructor() {
    super('AdaptiveReaderDB');

    this.version(1).stores({
      books: '++id, title, author, addedAt, lastOpenedAt, *tags',
      positions: 'bookId, updatedAt',
      sessions: '++id, bookId, startTime, endTime',
      highlights: '++id, bookId, cfiRange, color, createdAt',
    });

    // Version 2: Add analytics table (Phase 3)
    this.version(2).stores({
      books: '++id, title, author, addedAt, lastOpenedAt, *tags',
      positions: 'bookId, updatedAt',
      sessions: '++id, bookId, startTime, endTime',
      highlights: '++id, bookId, cfiRange, color, createdAt',
      analytics: '++id, sessionId, bookId, timestamp, event',
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

// ============================================================
// Highlight Management Functions
// ============================================================

/**
 * Add a new highlight
 */
export async function addHighlight(highlight: Omit<Highlight, 'id' | 'createdAt'>): Promise<number> {
  const highlightWithDate: Highlight = {
    ...highlight,
    createdAt: new Date(),
  };
  return await db.highlights.add(highlightWithDate);
}

/**
 * Get all highlights for a book
 */
export async function getHighlights(bookId: number): Promise<Highlight[]> {
  return await db.highlights.where('bookId').equals(bookId).sortBy('createdAt');
}

/**
 * Get all highlights across all books
 */
export async function getAllHighlights(): Promise<Highlight[]> {
  return await db.highlights.orderBy('createdAt').reverse().toArray();
}

/**
 * Get highlights filtered by color
 */
export async function getHighlightsByColor(bookId: number, color: Highlight['color']): Promise<Highlight[]> {
  return await db.highlights.where({ bookId, color }).sortBy('createdAt');
}

/**
 * Update a highlight (for editing notes or changing color)
 */
export async function updateHighlight(id: number, updates: Partial<Highlight>): Promise<void> {
  await db.highlights.update(id, updates);
}

/**
 * Delete a highlight
 */
export async function deleteHighlight(id: number): Promise<void> {
  await db.highlights.delete(id);
}

// ============================================================
// Session Management Functions
// ============================================================

/**
 * Start a new reading session
 */
export async function startSession(bookId: number): Promise<number> {
  const session: Session = {
    bookId,
    startTime: new Date(),
    pagesRead: 0,
    wordsRead: 0,
  };
  return await db.sessions.add(session);
}

/**
 * Update session with reading progress
 */
export async function updateSession(id: number, updates: Partial<Session>): Promise<void> {
  await db.sessions.update(id, updates);
}

/**
 * End a reading session
 */
export async function endSession(id: number, pagesRead: number, wordsRead: number): Promise<void> {
  const session = await db.sessions.get(id);
  if (!session) return;

  const endTime = new Date();
  const durationMinutes = (endTime.getTime() - session.startTime.getTime()) / 60000;
  const avgSpeed = durationMinutes > 0 ? wordsRead / durationMinutes : 0;

  await db.sessions.update(id, {
    endTime,
    pagesRead,
    wordsRead,
    avgSpeed,
  });
}

/**
 * Get all sessions for a book
 */
export async function getSessions(bookId: number): Promise<Session[]> {
  return await db.sessions.where('bookId').equals(bookId).reverse().sortBy('startTime');
}

/**
 * Get the most recent session for a book
 */
export async function getLastSession(bookId: number): Promise<Session | undefined> {
  const sessions = await getSessions(bookId);
  return sessions[0];
}

// ============================================================
// Analytics Management Functions (Phase 3)
// ============================================================

/**
 * Track an analytics event (page turn, slowdown, etc.)
 */
export async function trackAnalyticsEvent(event: Omit<Analytics, 'id' | 'timestamp'>): Promise<number> {
  const analyticsEvent: Analytics = {
    ...event,
    timestamp: new Date(),
  };
  return await db.analytics.add(analyticsEvent);
}

/**
 * Get analytics for a specific session
 */
export async function getSessionAnalytics(sessionId: number): Promise<Analytics[]> {
  return await db.analytics.where('sessionId').equals(sessionId).sortBy('timestamp');
}

/**
 * Get analytics for a book (all sessions)
 */
export async function getBookAnalytics(bookId: number): Promise<Analytics[]> {
  return await db.analytics.where('bookId').equals(bookId).sortBy('timestamp');
}

/**
 * Calculate reading insights from analytics
 * Returns: { avgTurnTime, slowdownCount, totalPageTurns }
 */
export async function getReadingInsights(sessionId: number): Promise<{
  avgTurnTime: number;
  slowdownCount: number;
  totalPageTurns: number;
}> {
  const analytics = await getSessionAnalytics(sessionId);

  const pageTurns = analytics.filter((a) => a.event === 'page_turn');
  const slowdowns = analytics.filter((a) => a.event === 'slowdown');

  const turnTimes = pageTurns
    .map((a) => a.timeSinceLastTurn)
    .filter((t): t is number => t !== undefined);

  const avgTurnTime = turnTimes.length > 0
    ? turnTimes.reduce((sum, t) => sum + t, 0) / turnTimes.length
    : 0;

  return {
    avgTurnTime,
    slowdownCount: slowdowns.length,
    totalPageTurns: pageTurns.length,
  };
}

/**
 * Clean up old analytics (optional, for performance)
 * Deletes analytics older than specified days
 */
export async function cleanupOldAnalytics(daysToKeep: number = 90): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  await db.analytics.where('timestamp').below(cutoffDate).delete();
}
