import Dexie, { Table } from 'dexie';
import type { Book, ReadingPosition, Session, Highlight, Analytics, Chapter, AudioFile, AudioSettings, AudioUsage } from '@/types';

export class ReaderDatabase extends Dexie {
  books!: Table<Book, number>;
  positions!: Table<ReadingPosition, number>;
  sessions!: Table<Session, number>;
  highlights!: Table<Highlight, number>;
  analytics!: Table<Analytics, number>;
  chapters!: Table<Chapter, number>;
  audioFiles!: Table<AudioFile, number>;
  audioSettings!: Table<AudioSettings, number>;
  audioUsage!: Table<AudioUsage, number>;

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

    // Version 3: Add audio functionality (TTS Phase 1)
    this.version(3).stores({
      books: '++id, title, author, addedAt, lastOpenedAt, *tags',
      positions: 'bookId, updatedAt',
      sessions: '++id, bookId, startTime, endTime',
      highlights: '++id, bookId, cfiRange, color, createdAt',
      analytics: '++id, sessionId, bookId, timestamp, event',
      chapters: '++id, bookId, order, cfiStart',
      audioFiles: '++id, chapterId, generatedAt',
      audioSettings: 'bookId, updatedAt',
      audioUsage: '++id, chapterId, bookId, timestamp',
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
 * Orders by lastOpenedAt if available, otherwise by addedAt (newest first)
 */
export async function getAllBooks(): Promise<Book[]> {
  const books = await db.books.toArray();
  return books.sort((a, b) => {
    const aTime = a.lastOpenedAt || a.addedAt;
    const bTime = b.lastOpenedAt || b.addedAt;
    return bTime.getTime() - aTime.getTime();
  });
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
  // Get all chapters for this book first (needed to delete audio files)
  const chapters = await db.chapters.where('bookId').equals(id).toArray();
  const chapterIds = chapters.map(c => c.id).filter((id): id is number => id !== undefined);

  // Delete all audio files for these chapters in one batch operation
  if (chapterIds.length > 0) {
    await db.audioFiles.where('chapterId').anyOf(chapterIds).delete();
  }

  // Delete all book-related data
  await db.books.delete(id);
  await db.positions.where('bookId').equals(id).delete();
  await db.sessions.where('bookId').equals(id).delete();
  await db.highlights.where('bookId').equals(id).delete();
  await db.analytics.where('bookId').equals(id).delete();
  await db.chapters.where('bookId').equals(id).delete();
  await db.audioSettings.where('bookId').equals(id).delete();
  await db.audioUsage.where('bookId').equals(id).delete();
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
  await db.books.clear();
  await db.positions.clear();
  await db.sessions.clear();
  await db.highlights.clear();
  await db.analytics.clear();
  await db.chapters.clear();
  await db.audioFiles.clear();
  await db.audioSettings.clear();
  await db.audioUsage.clear();
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

// ============================================================
// Chapter Management Functions (TTS Phase 1)
// ============================================================

/**
 * Save chapters for a book
 */
export async function saveChapters(chapters: Omit<Chapter, 'id'>[]): Promise<void> {
  await db.chapters.bulkAdd(chapters);
}

/**
 * Get chapters for a book
 */
export async function getChapters(bookId: number): Promise<Chapter[]> {
  return await db.chapters.where('bookId').equals(bookId).sortBy('order');
}

/**
 * Delete chapters when book is deleted
 */
export async function deleteChapters(bookId: number): Promise<void> {
  await db.chapters.where('bookId').equals(bookId).delete();
}

// ============================================================
// Audio File Management Functions (TTS Phase 2)
// ============================================================

/**
 * Save generated audio file
 */
export async function saveAudioFile(audioFile: Omit<AudioFile, 'id'>): Promise<number> {
  return await db.audioFiles.add(audioFile);
}

/**
 * Get audio file for a chapter
 */
export async function getAudioFile(chapterId: number): Promise<AudioFile | undefined> {
  return await db.audioFiles.where('chapterId').equals(chapterId).first();
}

/**
 * Delete audio file for a chapter
 */
export async function deleteAudioFile(chapterId: number): Promise<void> {
  await db.audioFiles.where('chapterId').equals(chapterId).delete();
}

/**
 * Get all audio files for a book (via chapters)
 */
export async function getBookAudioFiles(bookId: number): Promise<AudioFile[]> {
  const chapters = await getChapters(bookId);
  const chapterIds = chapters.map(c => c.id!);
  return await db.audioFiles.where('chapterId').anyOf(chapterIds).toArray();
}

/**
 * Calculate total audio storage for a book
 */
export async function getBookAudioStorageSize(bookId: number): Promise<number> {
  const audioFiles = await getBookAudioFiles(bookId);
  return audioFiles.reduce((total, file) => total + file.sizeBytes, 0);
}

/**
 * Log audio generation usage
 */
export async function logAudioUsage(usage: Omit<AudioUsage, 'id'>): Promise<number> {
  return await db.audioUsage.add(usage);
}

/**
 * Get audio usage for a book
 */
export async function getAudioUsage(bookId: number): Promise<AudioUsage[]> {
  return await db.audioUsage.where('bookId').equals(bookId).sortBy('timestamp');
}

/**
 * Calculate total cost for a book
 */
export async function getTotalAudioCost(bookId: number): Promise<number> {
  const usage = await getAudioUsage(bookId);
  return usage.reduce((total, u) => total + u.cost, 0);
}

/**
 * Get audio settings for a book
 */
export async function getAudioSettings(bookId: number): Promise<AudioSettings | undefined> {
  return await db.audioSettings.get(bookId);
}

/**
 * Save audio settings for a book
 */
export async function saveAudioSettings(settings: AudioSettings): Promise<void> {
  const existing = await db.audioSettings.get(settings.bookId);
  if (existing) {
    await db.audioSettings.update(settings.bookId, {
      ...settings,
      updatedAt: new Date(),
    });
  } else {
    await db.audioSettings.add({
      ...settings,
      updatedAt: new Date(),
    });
  }
}

/**
 * Get default audio settings
 */
export function getDefaultAudioSettings(bookId: number): AudioSettings {
  return {
    bookId,
    voice: 'alloy',
    playbackSpeed: 1.0,
    autoPlay: false,
    updatedAt: new Date(),
  };
}
