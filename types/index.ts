// Book metadata interface
export interface Book {
  id?: number;
  title: string;
  author: string;
  filePath: string; // Blob URL or IndexedDB reference
  coverUrl?: string;
  isbn?: string;
  tags?: string[];
  addedAt: Date;
  lastOpenedAt?: Date;
  totalPages?: number;
  fileBlob?: Blob; // Store the actual EPUB file
}

// Reading position interface
export interface ReadingPosition {
  bookId: number; // Primary key
  cfi: string; // Current position (Canonical Fragment Identifier)
  percentage: number; // Progress 0-100
  chapter?: string; // Chapter title
  updatedAt: Date;
}

// Session tracking interface (for Phase 2)
export interface Session {
  id?: number;
  bookId: number;
  startTime: Date;
  endTime?: Date;
  pagesRead: number;
  wordsRead: number;
  avgSpeed?: number; // words per minute
  currentCFI?: string;
}

// Highlight interface (for Phase 2)
export interface Highlight {
  id?: number;
  bookId: number;
  cfiRange: string; // EPUB CFI range
  text: string; // highlighted text content
  color: 'yellow' | 'blue' | 'orange' | 'pink';
  note?: string; // user annotation
  createdAt: Date;
}

// Reader settings interface
export interface ReaderSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number; // 14-24px
  fontFamily: 'serif' | 'sans-serif';
  lineHeight: number; // 1.2-1.8
  margins: number; // 1-4rem
}

// Analytics interface (Phase 3) - Privacy-first, stored locally only
export interface Analytics {
  id?: number;
  sessionId: number; // Reference to Session
  bookId: number;
  timestamp: Date;
  event: 'page_turn' | 'slowdown' | 'speed_up' | 'pause';
  timeSinceLastTurn?: number; // milliseconds
  cfi?: string; // Current position
  metadata?: Record<string, unknown>; // Flexible data storage
}
