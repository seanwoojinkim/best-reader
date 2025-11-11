// Book metadata interface
export interface Book {
  id?: number;
  title: string;
  author: string;
  filePath: string; // Blob URL or IndexedDB reference
  coverUrl?: string;
  coverBlob?: Blob; // Store the actual cover image data (kept as Blob for compatibility)
  coverBuffer?: ArrayBuffer; // Store cover as ArrayBuffer for iOS compatibility
  isbn?: string;
  tags?: string[];
  addedAt: Date;
  lastOpenedAt?: Date;
  totalPages?: number;
  fileBlob?: Blob; // Store the actual EPUB file (deprecated - use fileBuffer)
  fileBuffer?: ArrayBuffer; // Store EPUB as ArrayBuffer for iOS compatibility
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
  listeningTime?: number;     // TTS: Minutes spent listening
  audioChapterId?: number;    // TTS: Current audio chapter
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

// ============================================================
// TTS Audio Interfaces (Phase 5: TTS)
// ============================================================

// Chapter interface
export interface Chapter {
  id?: number;
  bookId: number;
  title: string;
  cfiStart: string;
  cfiEnd: string;
  wordCount: number;
  charCount: number;
  order: number;      // 1-indexed chapter number
  level: number;      // Nesting level (1 = top-level)
}

// Audio file storage
export interface AudioFile {
  id?: number;
  chapterId: number;
  blob: Blob;         // MP3 audio data (deprecated - use buffer)
  buffer?: ArrayBuffer; // MP3 audio data as ArrayBuffer for iOS compatibility
  duration: number;   // Seconds
  voice: OpenAIVoice;
  speed: number;
  generatedAt: Date;
  sizeBytes: number;
}

// Audio settings per book
export interface AudioSettings {
  bookId: number;     // Primary key
  voice: OpenAIVoice;
  playbackSpeed: number;
  autoPlay: boolean;
  updatedAt: Date;
}

// Audio usage tracking
export interface AudioUsage {
  id?: number;
  chapterId: number;
  bookId: number;
  charCount: number;
  cost: number;       // USD
  voice: OpenAIVoice;
  timestamp: Date;
}

// OpenAI voice types
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// ============================================================
// Sentence Synchronization Interfaces (TTS Phase: Sentence Sync)
// ============================================================

// Sentence metadata for audio synchronization
export interface SentenceMetadata {
  text: string;               // Sentence text
  startChar: number;          // Character position in chapter
  endChar: number;            // Character position end
  startTime: number;          // Estimated start time (seconds)
  endTime: number;            // Estimated end time (seconds)
  charCount: number;          // Sentence character count
}

// Sentence synchronization data
export interface SentenceSyncData {
  id?: number;
  audioFileId: number;        // FK to audioFiles table
  chapterId: number;          // FK for easier querying
  sentences: SentenceMetadata[];
  generatedAt: Date;
  version: number;            // Schema version for migrations
}
