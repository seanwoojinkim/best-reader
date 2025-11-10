---
doc_type: plan
date: 2025-11-09T20:53:53+00:00
title: "Text-to-Speech Chapter Audio Implementation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-09T20:53:53+00:00"
feature: "chapter-audio"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Database Schema & Chapter Extraction"
    status: complete
    estimated_hours: 6-8
  - name: "Phase 2: OpenAI TTS Integration & Audio Storage"
    status: complete
    estimated_hours: 8-10
  - name: "Phase 3: Audio Player UI & Playback Controls"
    status: complete
    estimated_hours: 8-10
  - name: "Phase 4: Progress Synchronization & Session Tracking"
    status: complete
    estimated_hours: 6-8
  - name: "Phase 5: Settings Panel & Usage Dashboard"
    status: complete
    estimated_hours: 4-6

git_commit: a09955c857aa4b4b93e6e8518129d4d863b0f0b8
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Claude Code
last_updated_note: "Phase 5 completed - all phases now complete, feature ready for review"

ticket_id: ENG-TTS-001
tags:
  - audio
  - tts
  - openai
  - infrastructure
status: complete

related_docs:
  - thoughts/implementation-details/2025-11-09-ENG-001-phase-4-mock-ai-features-pwa-implementation.md
  - lib/db.ts
  - hooks/useEpubReader.ts
  - hooks/useSession.ts
---

# Text-to-Speech Chapter Audio Implementation Plan

## Executive Summary

This plan details the implementation of text-to-speech (TTS) chapter audio functionality for the Adaptive Reader application. The feature will allow users to convert book chapters to high-quality audio using OpenAI's TTS-1 API, play audio with standard controls, and synchronize audio playback with reading position.

**Problem:** Users want to consume their ebooks through audio when reading is impractical (commuting, exercising, multitasking), but generating and managing chapter audio requires careful cost management and seamless integration with the existing reading experience.

**Solution:** A phased implementation that:
1. Extracts chapter metadata from EPUB files
2. Integrates OpenAI TTS-1 API with cost controls
3. Stores generated audio efficiently in IndexedDB
4. Provides an intuitive audio player with sync capabilities
5. Tracks usage and costs transparently

**Success Criteria:**
- Users can generate audio for any chapter with clear cost previews
- Audio playback syncs bidirectionally with reading position (CFI-based)
- Session tracking includes both reading and listening time
- Audio storage doesn't degrade app performance
- Monthly usage and costs are visible in settings

**Total Estimated Time:** 32-42 hours (4-5 weeks at 8-10 hours/week)

---

## Current State Analysis

### Existing Architecture

**Database (Dexie v2):**
```typescript
// lib/db.ts - Current schema
version(2).stores({
  books: '++id, title, author, addedAt, lastOpenedAt, *tags',
  positions: 'bookId, updatedAt',
  sessions: '++id, bookId, startTime, endTime',
  highlights: '++id, bookId, cfiRange, color, createdAt',
  analytics: '++id, sessionId, bookId, timestamp, event',
});
```

**EPUB Integration:**
- `/hooks/useEpubReader.ts`: Manages epub.js rendering, location tracking
- epub.js provides `book.navigation.toc` for chapter metadata
- CFI (Canonical Fragment Identifier) system for precise positioning
- Location generation at 1600 chars/page for progress tracking

**Session Tracking:**
- `/hooks/useSession.ts`: Tracks pages read, words read, time spent
- Integrates with analytics for page turn events
- Currently only tracks visual reading, not audio listening

**UI Components:**
- `/components/reader/ProgressIndicators.tsx`: Bottom progress bar
- `/components/reader/SettingsDrawer.tsx`: Right-side settings panel
- `/components/reader/ReaderView.tsx`: Main reader orchestration

**Constraints:**
- No API routes exist yet (`app/api` directory doesn't exist)
- No environment variable infrastructure
- No audio/media capabilities
- No explicit chapter extraction (chapters implicit in epub.js)
- All data stored locally (IndexedDB only)

---

## Requirements Analysis

### Functional Requirements

1. **Chapter Extraction**
   - Extract chapter list from EPUB table of contents
   - Calculate word count and character count per chapter
   - Store chapter metadata with CFI ranges
   - Handle books with nested chapter structures

2. **Audio Generation**
   - Convert chapter text to audio via OpenAI TTS-1 API
   - Display cost estimate before generation (~$0.015/1K chars)
   - Support 6 voice options (alloy, echo, fable, onyx, nova, shimmer)
   - Provide generation progress feedback
   - Handle API errors gracefully with retry logic

3. **Audio Storage**
   - Store generated MP3 files in IndexedDB (Blob storage)
   - Average ~1-2MB per chapter (3500 words)
   - Implement cache eviction for storage limits
   - Provide manual delete for audio files

4. **Audio Playback**
   - Standard controls: play/pause, scrubber, playback speed (0.75x, 1x, 1.25x, 1.5x, 2x)
   - Display current time / total duration
   - Remember playback position per chapter
   - Background playback support (MediaSession API)

5. **Progress Synchronization**
   - Map audio timestamp to reading CFI
   - Update reading position as audio plays
   - Resume audio from current reading position
   - Track which mode is active (reading vs listening)

6. **Session Tracking**
   - Add `listeningTime` to Session model
   - Track audio listening separately from reading
   - Include in analytics dashboard

7. **Cost Tracking**
   - Log each API call with character count and cost
   - Calculate daily/monthly spend
   - Display in settings dashboard
   - Warn when approaching thresholds (optional)

### Technical Requirements

1. **API Route:** `/app/api/tts/generate/route.ts` for OpenAI integration
2. **Environment Variables:** `OPENAI_API_KEY` with secure handling
3. **Database Version 3:** New tables for chapters, audioSettings, audioUsage
4. **TypeScript Interfaces:** Chapter, AudioFile, AudioSettings, AudioUsage
5. **Error Handling:** Network failures, API rate limits, storage quota
6. **Performance:** Generate audio in background, don't block UI
7. **Browser Compatibility:** Audio playback in Chrome, Safari, Firefox

### Out of Scope

- Multi-chapter audio queue (play chapters sequentially)
- Offline audio download to device storage (beyond IndexedDB)
- Custom voice training or voice cloning
- Real-time audio generation (all generation is on-demand)
- Cloud storage for audio (stick to IndexedDB for v1)
- Sharing audio files with other users
- Auto-generate audio on book upload

---

## Architecture & Design

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       ReaderView.tsx                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ChapterNavigator                         │   │
│  │  - Display chapter list                              │   │
│  │  - Show audio status (generated/not generated)       │   │
│  │  - ChapterAudioButton per chapter                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              AudioPlayer (bottom bar)                 │   │
│  │  - Play/Pause, Scrubber, Speed controls              │   │
│  │  - Current time / Total duration                     │   │
│  │  - Sync reading position as audio plays              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        SettingsDrawer (audio section)                 │   │
│  │  - Voice selection (6 voices)                        │   │
│  │  - Default playback speed                            │   │
│  │  - Usage dashboard (costs, API calls)                │   │
│  │  - Manage audio storage                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Backend (API Routes)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       /api/tts/generate (POST)                        │   │
│  │  - Extract chapter text from EPUB                    │   │
│  │  - Call OpenAI TTS-1 API                             │   │
│  │  - Return audio blob + metadata                      │   │
│  │  - Log usage to audioUsage table                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Database (Dexie v3)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  chapters: ++id, bookId, title, cfiStart, cfiEnd,    │   │
│  │            wordCount, charCount, order               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  audioFiles: ++id, chapterId, blob, duration,        │   │
│  │              voice, speed, generatedAt, sizeBytes    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  audioSettings: bookId (primary), voice, speed,      │   │
│  │                 autoPlay, updatedAt                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  audioUsage: ++id, chapterId, charCount, cost,       │   │
│  │              voice, timestamp                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  sessions: (modified) add listeningTime, audioTime   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         Hooks                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useChapters(bookId, book)                           │   │
│  │  - Extract chapters from epub.js                     │   │
│  │  - Store chapter metadata in DB                      │   │
│  │  - Return chapter list with audio status             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useAudioPlayer(chapterId)                           │   │
│  │  - Manage audio playback state                       │   │
│  │  - Handle play/pause, seek, speed                    │   │
│  │  - Sync audio position with CFI                      │   │
│  │  - Track listening time in session                   │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useAudioGeneration(chapterId)                       │   │
│  │  - Call /api/tts/generate                            │   │
│  │  - Show progress, handle errors                      │   │
│  │  - Store audio blob in DB                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Models

```typescript
// types/index.ts additions

export interface Chapter {
  id?: number;
  bookId: number;
  title: string;
  cfiStart: string;     // CFI for chapter start
  cfiEnd: string;       // CFI for chapter end (or next chapter start)
  wordCount: number;    // Estimated words in chapter
  charCount: number;    // Exact character count
  order: number;        // Chapter order (1, 2, 3...)
  level: number;        // Nesting level (1 = top-level, 2 = subsection)
}

export interface AudioFile {
  id?: number;
  chapterId: number;
  blob: Blob;           // MP3 audio data
  duration: number;     // Duration in seconds
  voice: OpenAIVoice;   // Voice used for generation
  speed: number;        // Speed used (usually 1.0)
  generatedAt: Date;
  sizeBytes: number;    // File size for storage management
}

export interface AudioSettings {
  bookId: number;       // Primary key
  voice: OpenAIVoice;   // Default: 'alloy'
  playbackSpeed: number; // Default: 1.0
  autoPlay: boolean;    // Auto-play next chapter
  updatedAt: Date;
}

export interface AudioUsage {
  id?: number;
  chapterId: number;
  bookId: number;       // Denormalized for easier queries
  charCount: number;
  cost: number;         // USD cost (charCount / 1000 * 0.015)
  voice: OpenAIVoice;
  timestamp: Date;
}

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Extend existing Session interface
export interface Session {
  // ... existing fields
  listeningTime?: number; // Minutes spent listening to audio
  audioChapterId?: number; // Current audio chapter (if listening)
}
```

### API Integration

**OpenAI TTS-1 API Specification:**
```typescript
// app/api/tts/generate/route.ts

// Request
POST /api/tts/generate
{
  chapterId: number,
  voice: OpenAIVoice,
  speed: number (0.25-4.0, default 1.0)
}

// Response
{
  success: true,
  audio: Blob (MP3),
  duration: number,
  cost: number,
  charCount: number
}

// Error Response
{
  success: false,
  error: string,
  retryAfter?: number (for rate limits)
}
```

**OpenAI API Call:**
```typescript
const response = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'tts-1',
    input: chapterText,
    voice: voice,
    response_format: 'mp3',
    speed: speed,
  }),
});
```

### Audio Storage Strategy

**IndexedDB Storage (Chosen for v1):**

**Pros:**
- No additional infrastructure needed
- Fast access (local)
- Automatic cleanup when user clears browser data
- Works offline
- No recurring costs

**Cons:**
- Limited storage quota (varies by browser: 50MB-unlimited)
- Not synced across devices
- Lost if user clears browser data

**Implementation:**
- Store audio blobs in `audioFiles` table
- Implement quota monitoring
- Provide manual delete for individual chapters
- Future: Migrate to cloud storage (R2/S3) with sync in Phase 6

**Cache Eviction Strategy:**
- LRU (Least Recently Used): Delete oldest audio when quota reached
- Manual: User can delete audio per chapter
- Automatic warning at 80% quota utilization

---

## Phase-by-Phase Implementation

---

## Phase 1: Database Schema & Chapter Extraction

**Goal:** Establish database infrastructure and extract chapter metadata from EPUB files.

**Prerequisites:** None (foundational phase)

**Files to Create:**
- None (modifying existing files)

**Files to Modify:**
- `/lib/db.ts` - Add database version 3 with new tables
- `/types/index.ts` - Add Chapter, AudioFile, AudioSettings, AudioUsage interfaces
- `/hooks/useChapters.ts` - Create new hook for chapter extraction
- `/lib/epub-utils.ts` - Add chapter extraction helper functions

---

### Step 1.1: Update Database Schema

**File: `/lib/db.ts`**

Add database version 3 with new tables:

```typescript
// After version 2 in constructor:

// Version 3: Add audio functionality (Phase 5)
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
```

Add table type definitions after class declaration:

```typescript
export class ReaderDatabase extends Dexie {
  // ... existing tables
  chapters!: Table<Chapter, number>;
  audioFiles!: Table<AudioFile, number>;
  audioSettings!: Table<AudioSettings, number>;
  audioUsage!: Table<AudioUsage, number>;
}
```

Add helper functions at end of file:

```typescript
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
```

**Success Criteria:**
- Database version increments to 3 without errors
- Open DevTools → Application → IndexedDB → AdaptiveReaderDB shows new tables
- No TypeScript errors in db.ts

---

### Step 1.2: Add TypeScript Interfaces

**File: `/types/index.ts`**

Add at end of file:

```typescript
// Chapter interface (Phase 5: Audio)
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

// Audio file storage (Phase 5: Audio)
export interface AudioFile {
  id?: number;
  chapterId: number;
  blob: Blob;         // MP3 audio data
  duration: number;   // Seconds
  voice: OpenAIVoice;
  speed: number;
  generatedAt: Date;
  sizeBytes: number;
}

// Audio settings per book (Phase 5: Audio)
export interface AudioSettings {
  bookId: number;     // Primary key
  voice: OpenAIVoice;
  playbackSpeed: number;
  autoPlay: boolean;
  updatedAt: Date;
}

// Audio usage tracking (Phase 5: Audio)
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

// Extend Session interface to include audio listening
export interface Session {
  id?: number;
  bookId: number;
  startTime: Date;
  endTime?: Date;
  pagesRead: number;
  wordsRead: number;
  avgSpeed?: number;
  currentCFI?: string;
  listeningTime?: number;     // NEW: Minutes spent listening
  audioChapterId?: number;    // NEW: Current audio chapter
}
```

**Success Criteria:**
- No TypeScript errors across project
- Interfaces exported and importable
- Session interface extends correctly without breaking existing code

---

### Step 1.3: Create Chapter Extraction Utilities

**File: `/lib/epub-utils.ts`** (create new file)

```typescript
import type { Book as EpubBook, NavItem } from 'epubjs';
import type { Chapter } from '@/types';

/**
 * Extract chapters from epub.js book
 * Handles nested TOC structures by flattening
 */
export async function extractChapters(
  book: EpubBook,
  bookId: number
): Promise<Omit<Chapter, 'id'>[]> {
  const toc = book.navigation.toc;
  const chapters: Omit<Chapter, 'id'>[] = [];

  // Recursive function to flatten TOC
  const processNavItem = async (
    item: NavItem,
    order: number,
    level: number
  ): Promise<number> => {
    const cfiStart = item.href;

    // Get chapter text to calculate word/char counts
    const section = book.spine.get(item.href);
    let wordCount = 0;
    let charCount = 0;

    if (section) {
      try {
        const contents = await section.load(book.load.bind(book));
        const text = contents.textContent || '';
        charCount = text.length;
        wordCount = estimateWordCount(text);
      } catch (error) {
        console.error('Error loading chapter:', error);
      }
    }

    chapters.push({
      bookId,
      title: item.label,
      cfiStart,
      cfiEnd: '', // Will be filled in next step
      wordCount,
      charCount,
      order,
      level,
    });

    let currentOrder = order + 1;

    // Process subitems recursively
    if (item.subitems && item.subitems.length > 0) {
      for (const subitem of item.subitems) {
        currentOrder = await processNavItem(subitem, currentOrder, level + 1);
      }
    }

    return currentOrder;
  };

  let order = 1;
  for (const item of toc) {
    order = await processNavItem(item, order, 1);
  }

  // Fill in cfiEnd for each chapter (next chapter's start)
  for (let i = 0; i < chapters.length - 1; i++) {
    chapters[i].cfiEnd = chapters[i + 1].cfiStart;
  }

  // Last chapter ends at book end
  if (chapters.length > 0) {
    const lastSection = book.spine.last();
    chapters[chapters.length - 1].cfiEnd = lastSection?.cfiBase || '';
  }

  return chapters;
}

/**
 * Estimate word count from text
 */
export function estimateWordCount(text: string): number {
  // Remove extra whitespace, split on word boundaries
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  return words.length;
}

/**
 * Extract text content from a chapter CFI range
 */
export async function getChapterText(
  book: EpubBook,
  cfiStart: string,
  cfiEnd: string
): Promise<string> {
  const section = book.spine.get(cfiStart);

  if (!section) {
    throw new Error('Chapter not found');
  }

  const contents = await section.load(book.load.bind(book));
  return contents.textContent || '';
}

/**
 * Calculate estimated cost for TTS generation
 */
export function calculateTTSCost(charCount: number): number {
  // OpenAI TTS-1: $0.015 per 1K characters
  return (charCount / 1000) * 0.015;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(3)}`;
}

/**
 * Estimate audio duration (150 words per minute average)
 */
export function estimateAudioDuration(wordCount: number): number {
  const wordsPerMinute = 150;
  return Math.ceil((wordCount / wordsPerMinute) * 60); // Return seconds
}

/**
 * Format duration for display (e.g., "5:23" or "1:02:45")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
```

**Success Criteria:**
- No TypeScript errors
- Functions export correctly
- Helper functions can be imported in other modules

---

### Step 1.4: Create useChapters Hook

**File: `/hooks/useChapters.ts`** (create new file)

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { Book as EpubBook } from 'epubjs';
import type { Chapter } from '@/types';
import { extractChapters } from '@/lib/epub-utils';
import { getChapters, saveChapters, deleteChapters } from '@/lib/db';

interface UseChaptersProps {
  bookId: number;
  book: EpubBook | null;
}

interface UseChaptersResult {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  refreshChapters: () => Promise<void>;
}

/**
 * Hook to extract and manage book chapters
 * Extracts chapters from epub.js on first load, caches in IndexedDB
 */
export function useChapters({ bookId, book }: UseChaptersProps): UseChaptersResult {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChapters = useCallback(async () => {
    if (!book) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check if chapters already exist in DB
      let existingChapters = await getChapters(bookId);

      if (existingChapters.length === 0) {
        // Extract chapters from EPUB
        const extractedChapters = await extractChapters(book, bookId);
        await saveChapters(extractedChapters);
        existingChapters = await getChapters(bookId);
      }

      setChapters(existingChapters);
    } catch (err) {
      console.error('Error loading chapters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chapters');
    } finally {
      setLoading(false);
    }
  }, [bookId, book]);

  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  const refreshChapters = useCallback(async () => {
    if (!book) return;

    try {
      // Delete existing chapters
      await deleteChapters(bookId);

      // Re-extract
      const extractedChapters = await extractChapters(book, bookId);
      await saveChapters(extractedChapters);

      // Reload
      const newChapters = await getChapters(bookId);
      setChapters(newChapters);
    } catch (err) {
      console.error('Error refreshing chapters:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh chapters');
    }
  }, [bookId, book]);

  return {
    chapters,
    loading,
    error,
    refreshChapters,
  };
}
```

**Success Criteria:**
- Hook compiles without errors
- Can be imported and used in components
- Returns expected shape: { chapters, loading, error, refreshChapters }

---

### Step 1.5: Integrate Chapter Extraction in ReaderView

**File: `/components/reader/ReaderView.tsx`**

Add import at top:
```typescript
import { useChapters } from '@/hooks/useChapters';
```

Add hook call after existing hooks (around line 66):
```typescript
// Chapter extraction (Phase 5: Audio)
const { chapters, loading: chaptersLoading } = useChapters({
  bookId,
  book,
});
```

Add debug log in a useEffect to verify extraction:
```typescript
useEffect(() => {
  if (chapters.length > 0) {
    console.log(`Extracted ${chapters.length} chapters:`, chapters);
  }
}, [chapters]);
```

**Success Criteria:**
- No TypeScript errors
- Open reader, check browser console logs
- Should see "Extracted N chapters" with chapter data
- IndexedDB → chapters table should be populated

---

### Phase 1 Testing & Verification

**Manual Testing:**

1. **Database Migration:**
   ```
   - Open DevTools → Application → IndexedDB
   - Verify AdaptiveReaderDB version is 3
   - Verify new tables exist: chapters, audioFiles, audioSettings, audioUsage
   ```

2. **Chapter Extraction:**
   ```
   - Upload an EPUB file
   - Open the book in reader
   - Check console for "Extracted N chapters" log
   - Open IndexedDB → chapters table
   - Verify chapters are stored with correct metadata:
     - bookId matches
     - titles are correct
     - wordCount > 0
     - charCount > 0
     - order is sequential (1, 2, 3...)
   ```

3. **Re-opening Book:**
   ```
   - Close reader, re-open same book
   - Chapters should load from DB (no re-extraction)
   - Verify console log shows cached chapters
   ```

**Automated Testing (Optional):**

Create `/hooks/__tests__/useChapters.test.ts`:
```typescript
// Basic test structure (expand as needed)
describe('useChapters', () => {
  it('extracts chapters from epub.js book', async () => {
    // Mock book with navigation.toc
    // Call hook
    // Verify chapters extracted
  });

  it('caches chapters in IndexedDB', async () => {
    // Call hook twice
    // Verify DB only called once for extraction
  });
});
```

**Success Criteria for Phase 1:**
- [ ] Database schema upgraded to v3 without errors
- [ ] All 4 new tables exist in IndexedDB
- [ ] TypeScript compiles without errors
- [ ] Chapter extraction works for test EPUBs
- [ ] Chapters stored in DB with accurate metadata
- [ ] Re-opening book loads cached chapters (no re-extraction)
- [ ] No console errors or warnings

**Estimated Time:** 6-8 hours
- Schema design: 1 hour
- Database migration: 1 hour
- epub-utils implementation: 2-3 hours
- useChapters hook: 1-2 hours
- Testing and debugging: 1-2 hours

---

## Phase 2: OpenAI TTS Integration & Audio Storage

**Goal:** Integrate OpenAI TTS-1 API, generate audio for chapters, and store in IndexedDB.

**Prerequisites:** Phase 1 complete (chapters extracted and stored)

**Files to Create:**
- `/app/api/tts/generate/route.ts` - API route for TTS generation
- `/hooks/useAudioGeneration.ts` - Hook for managing audio generation state
- `/.env.local` - Environment variables (not committed)
- `/.env.example` - Example environment file

**Files to Modify:**
- `/lib/db.ts` - Add audioFiles and audioUsage helper functions
- `/package.json` - Add `openai` package
- `/.gitignore` - Ensure .env.local is ignored

---

### Step 2.1: Environment Setup

**File: `/.env.example`** (create new file)

```bash
# OpenAI API Key
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-...
```

**File: `/.env.local`** (create, add to .gitignore)

```bash
OPENAI_API_KEY=your_actual_api_key_here
```

**File: `/.gitignore`** (verify .env.local is ignored)

Ensure this line exists:
```
.env*.local
```

**Install OpenAI SDK:**

```bash
npm install openai
```

**Success Criteria:**
- `/.env.example` committed to repo
- `/.env.local` NOT committed (in .gitignore)
- `openai` package in package.json dependencies
- `process.env.OPENAI_API_KEY` accessible in API routes

---

### Step 2.2: Create TTS API Route

**File: `/app/api/tts/generate/route.ts`** (create new directory and file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { OpenAIVoice } from '@/types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { chapterText, voice, speed } = await request.json();

    // Validate input
    if (!chapterText || typeof chapterText !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid chapter text' },
        { status: 400 }
      );
    }

    if (!voice || !isValidVoice(voice)) {
      return NextResponse.json(
        { success: false, error: 'Invalid voice selection' },
        { status: 400 }
      );
    }

    const validSpeed = Math.max(0.25, Math.min(4.0, speed || 1.0));

    // Call OpenAI TTS API
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: chapterText,
      response_format: 'mp3',
      speed: validSpeed,
    });

    // Convert response to buffer
    const buffer = Buffer.from(await response.arrayBuffer());

    // Calculate metadata
    const charCount = chapterText.length;
    const cost = (charCount / 1000) * 0.015; // $0.015 per 1K chars
    const sizeBytes = buffer.length;

    // Estimate duration (150 words/min average, adjusted by speed)
    const wordCount = chapterText.split(/\s+/).length;
    const durationSeconds = Math.ceil((wordCount / 150) * 60 / validSpeed);

    // Return audio data as base64 (to be converted to Blob on client)
    return NextResponse.json({
      success: true,
      audioData: buffer.toString('base64'),
      duration: durationSeconds,
      cost,
      charCount,
      sizeBytes,
      voice,
      speed: validSpeed,
    });

  } catch (error: any) {
    console.error('TTS generation error:', error);

    // Handle rate limits
    if (error?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: error?.headers?.['retry-after'] || 60,
        },
        { status: 429 }
      );
    }

    // Handle other API errors
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to generate audio',
      },
      { status: 500 }
    );
  }
}

function isValidVoice(voice: string): voice is OpenAIVoice {
  const validVoices: OpenAIVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  return validVoices.includes(voice as OpenAIVoice);
}
```

**Success Criteria:**
- API route compiles without errors
- Can be called from client (test with curl or Postman)
- Returns audio data as base64
- Handles errors gracefully (invalid input, rate limits, API errors)

---

### Step 2.3: Add Audio Database Helpers

**File: `/lib/db.ts`** (add at end)

```typescript
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
```

**Success Criteria:**
- Functions compile without TypeScript errors
- Can be imported in other modules
- Database operations work correctly (test with manual calls in console)

---

### Step 2.4: Create Audio Generation Hook

**File: `/hooks/useAudioGeneration.ts`** (create new file)

```typescript
import { useState, useCallback } from 'react';
import type { Chapter, OpenAIVoice, AudioFile } from '@/types';
import { saveAudioFile, logAudioUsage, getChapterText } from '@/lib/db';
import type { Book as EpubBook } from 'epubjs';

interface UseAudioGenerationProps {
  book: EpubBook | null;
}

interface GenerateAudioOptions {
  chapter: Chapter;
  voice: OpenAIVoice;
  speed?: number;
}

interface UseAudioGenerationResult {
  generating: boolean;
  progress: number; // 0-100
  error: string | null;
  generateAudio: (options: GenerateAudioOptions) => Promise<AudioFile | null>;
  cancelGeneration: () => void;
}

export function useAudioGeneration({ book }: UseAudioGenerationProps): UseAudioGenerationResult {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const generateAudio = useCallback(async ({
    chapter,
    voice,
    speed = 1.0,
  }: GenerateAudioOptions): Promise<AudioFile | null> => {
    if (!book || !chapter.id) {
      setError('Invalid chapter or book');
      return null;
    }

    setGenerating(true);
    setProgress(10);
    setError(null);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Step 1: Extract chapter text (10% -> 30%)
      setProgress(10);
      const chapterText = await getChapterText(book, chapter.cfiStart, chapter.cfiEnd);

      if (controller.signal.aborted) {
        throw new Error('Generation cancelled');
      }

      setProgress(30);

      // Step 2: Call API (30% -> 80%)
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapterText,
          voice,
          speed,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      setProgress(80);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      // Step 3: Convert base64 to Blob (80% -> 90%)
      const audioBlob = base64ToBlob(data.audioData, 'audio/mpeg');

      setProgress(90);

      // Step 4: Save to IndexedDB (90% -> 100%)
      const audioFile: Omit<AudioFile, 'id'> = {
        chapterId: chapter.id,
        blob: audioBlob,
        duration: data.duration,
        voice: data.voice,
        speed: data.speed,
        generatedAt: new Date(),
        sizeBytes: data.sizeBytes,
      };

      const audioFileId = await saveAudioFile(audioFile);

      // Log usage
      await logAudioUsage({
        chapterId: chapter.id,
        bookId: chapter.bookId,
        charCount: data.charCount,
        cost: data.cost,
        voice: data.voice,
        timestamp: new Date(),
      });

      setProgress(100);
      setGenerating(false);
      setAbortController(null);

      return { ...audioFile, id: audioFileId };

    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'Generation cancelled') {
        setError('Generation cancelled');
      } else {
        console.error('Audio generation error:', err);
        setError(err.message || 'Failed to generate audio');
      }

      setGenerating(false);
      setProgress(0);
      setAbortController(null);
      return null;
    }
  }, [book]);

  const cancelGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setGenerating(false);
      setProgress(0);
      setError('Generation cancelled');
    }
  }, [abortController]);

  return {
    generating,
    progress,
    error,
    generateAudio,
    cancelGeneration,
  };
}

// Helper function to convert base64 to Blob
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}
```

**Missing helper function - add to `/lib/epub-utils.ts`:**

```typescript
// Already exists in Phase 1, but add this if missing:
export async function getChapterText(
  book: EpubBook,
  cfiStart: string,
  cfiEnd: string
): Promise<string> {
  const section = book.spine.get(cfiStart);

  if (!section) {
    throw new Error('Chapter not found');
  }

  const contents = await section.load(book.load.bind(book));
  return contents.textContent || '';
}
```

**Success Criteria:**
- Hook compiles without errors
- Can be imported in components
- Provides generateAudio function with progress tracking
- Handles cancellation via abortController

---

### Step 2.5: Create Chapter Audio Button Component

**File: `/components/reader/ChapterAudioButton.tsx`** (create new file)

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import type { Chapter, OpenAIVoice } from '@/types';
import { getAudioFile } from '@/lib/db';
import { calculateTTSCost, formatCost } from '@/lib/epub-utils';

interface ChapterAudioButtonProps {
  chapter: Chapter;
  voice: OpenAIVoice;
  onGenerate: () => void;
  onPlay: () => void;
  generating: boolean;
  progress: number; // 0-100
}

export default function ChapterAudioButton({
  chapter,
  voice,
  onGenerate,
  onPlay,
  generating,
  progress,
}: ChapterAudioButtonProps) {
  const [hasAudio, setHasAudio] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if audio exists for this chapter
  useEffect(() => {
    const checkAudio = async () => {
      if (!chapter.id) return;

      const audioFile = await getAudioFile(chapter.id);
      setHasAudio(!!audioFile);
      setLoading(false);
    };

    checkAudio();
  }, [chapter.id, progress]); // Re-check when generation completes

  const estimatedCost = calculateTTSCost(chapter.charCount);

  if (loading) {
    return (
      <button disabled className="px-3 py-1.5 text-sm text-gray-400 bg-gray-100 rounded">
        Loading...
      </button>
    );
  }

  if (generating) {
    return (
      <button disabled className="px-3 py-1.5 text-sm text-sky-700 bg-sky-50 rounded">
        Generating... {Math.round(progress)}%
      </button>
    );
  }

  if (hasAudio) {
    return (
      <button
        onClick={onPlay}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Play Audio
      </button>
    );
  }

  return (
    <button
      onClick={onGenerate}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded transition-colors"
      title={`Generate audio with ${voice} voice`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        />
      </svg>
      Generate Audio ({formatCost(estimatedCost)})
    </button>
  );
}
```

**Success Criteria:**
- Component compiles without errors
- Displays "Generate Audio" button for chapters without audio
- Shows cost estimate
- Displays "Play Audio" button for chapters with audio
- Shows progress during generation

---

### Phase 2 Testing & Verification

**Manual Testing:**

1. **API Route Test (via curl):**
   ```bash
   curl -X POST http://localhost:3000/api/tts/generate \
     -H "Content-Type: application/json" \
     -d '{"chapterText":"Hello world, this is a test.", "voice":"alloy", "speed":1.0}'
   ```

   Expected: JSON response with `success: true` and `audioData` (base64)

2. **Generate Audio via UI:**
   ```
   - Create ChapterList component (temporary for testing)
   - Display chapters with ChapterAudioButton
   - Click "Generate Audio" button
   - Verify:
     - Progress indicator shows 0% → 100%
     - No errors in console
     - IndexedDB → audioFiles table has new entry
     - IndexedDB → audioUsage table has new entry
   ```

3. **Verify Audio Blob:**
   ```
   - Open IndexedDB → audioFiles
   - Inspect blob field (should show Blob type)
   - Copy blob URL to browser to verify playback
   ```

4. **Cost Tracking:**
   ```
   - Generate audio for 2-3 chapters
   - Check IndexedDB → audioUsage table
   - Verify costs calculated correctly (~$0.015 per 1K chars)
   ```

**Error Scenarios:**

1. **Invalid API Key:**
   ```
   - Set OPENAI_API_KEY to invalid value
   - Attempt generation
   - Verify error message displayed
   ```

2. **Rate Limit:**
   ```
   - (Hard to test without hitting actual limits)
   - Verify 429 response handling in code
   ```

3. **Network Failure:**
   ```
   - Disconnect internet during generation
   - Verify error handling and cleanup
   ```

**Success Criteria for Phase 2:**
- [ ] API route works and returns audio data
- [ ] Audio generated successfully for test chapters
- [ ] Audio stored in IndexedDB as Blob
- [ ] Usage logged correctly with accurate costs
- [ ] Progress indicator shows during generation
- [ ] Errors handled gracefully
- [ ] No memory leaks (check DevTools Performance)

**Estimated Time:** 8-10 hours
- Environment setup: 0.5 hours
- API route implementation: 2-3 hours
- Database helpers: 1 hour
- useAudioGeneration hook: 2-3 hours
- ChapterAudioButton component: 1-2 hours
- Testing and debugging: 2-3 hours

---

## Phase 3: Audio Player UI & Playback Controls

**Goal:** Create audio player component with play/pause, scrubber, and playback speed controls.

**Prerequisites:** Phase 2 complete (audio files generated and stored)

**Files to Create:**
- `/components/reader/AudioPlayer.tsx` - Main audio player component
- `/hooks/useAudioPlayer.ts` - Audio playback state management
- `/components/reader/ChapterList.tsx` - Chapter navigation with audio buttons

**Files to Modify:**
- `/components/reader/ReaderView.tsx` - Integrate AudioPlayer
- `/components/reader/ProgressIndicators.tsx` - Make room for audio player

---

### Step 3.1: Create Audio Player Hook

**File: `/hooks/useAudioPlayer.ts`** (create new file)

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Chapter, AudioFile } from '@/types';
import { getAudioFile } from '@/lib/db';

interface UseAudioPlayerProps {
  chapter: Chapter | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

interface UseAudioPlayerResult {
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  loading: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  loadChapter: (chapter: Chapter) => Promise<void>;
}

export function useAudioPlayer({
  chapter,
  onTimeUpdate,
  onEnded,
}: UseAudioPlayerProps): UseAudioPlayerResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    // Event listeners
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime, audio.duration);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };

    const handleEnded = () => {
      setPlaying(false);
      onEnded?.();
    };

    const handleError = (e: ErrorEvent) => {
      console.error('Audio playback error:', e);
      setError('Failed to play audio');
      setLoading(false);
      setPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError as any);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError as any);
      audio.pause();
      audio.src = '';
    };
  }, [onTimeUpdate, onEnded]);

  // Load chapter audio
  const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
    if (!chapterToLoad.id || !audioRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const audioFile = await getAudioFile(chapterToLoad.id);

      if (!audioFile) {
        throw new Error('Audio not generated for this chapter');
      }

      // Create object URL from blob
      const audioUrl = URL.createObjectURL(audioFile.blob);
      audioRef.current.src = audioUrl;
      audioRef.current.playbackRate = playbackSpeed;

      // Clean up old object URL when new one is created
      audioRef.current.addEventListener('loadstart', () => {
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
      }, { once: true });

    } catch (err) {
      console.error('Error loading chapter audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setLoading(false);
    }
  }, [playbackSpeed]);

  // Auto-load chapter when it changes
  useEffect(() => {
    if (chapter) {
      loadChapter(chapter);
    }
  }, [chapter, loadChapter]);

  const play = useCallback(() => {
    if (audioRef.current && !loading) {
      audioRef.current.play();
      setPlaying(true);
      setError(null);
    }
  }, [loading]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  }, [duration]);

  const setSpeed = useCallback((speed: number) => {
    const validSpeed = Math.max(0.25, Math.min(4.0, speed));
    setPlaybackSpeed(validSpeed);

    if (audioRef.current) {
      audioRef.current.playbackRate = validSpeed;
    }
  }, []);

  return {
    playing,
    currentTime,
    duration,
    playbackSpeed,
    loading,
    error,
    play,
    pause,
    seek,
    setSpeed,
    loadChapter,
  };
}
```

**Success Criteria:**
- Hook compiles without errors
- Manages audio playback state correctly
- Loads audio from IndexedDB blob
- Provides play/pause/seek/speed controls

---

### Step 3.2: Create Audio Player Component

**File: `/components/reader/AudioPlayer.tsx`** (create new file)

```typescript
'use client';

import React, { useState } from 'react';
import type { Chapter } from '@/types';
import { formatDuration } from '@/lib/epub-utils';

interface AudioPlayerProps {
  chapter: Chapter | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  loading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onClose: () => void;
}

const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];

export default function AudioPlayer({
  chapter,
  playing,
  currentTime,
  duration,
  playbackSpeed,
  loading,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  onClose,
}: AudioPlayerProps) {
  const [seeking, setSeeking] = useState(false);
  const [tempSeekTime, setTempSeekTime] = useState(0);

  if (!chapter) return null;

  const displayTime = seeking ? tempSeekTime : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setSeeking(true);
    updateSeekTime(e);
  };

  const handleSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (seeking) {
      updateSeekTime(e);
    }
  };

  const handleSeekEnd = () => {
    if (seeking) {
      onSeek(tempSeekTime);
      setSeeking(false);
    }
  };

  const updateSeekTime = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, percent * duration));
    setTempSeekTime(time);
  };

  const cycleSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    onSpeedChange(PLAYBACK_SPEEDS[nextIndex]);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Progress Bar */}
        <div
          className="relative h-1 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer mb-3"
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseUp={handleSeekEnd}
          onMouseLeave={handleSeekEnd}
        >
          <div
            className="absolute h-full bg-sky-600 dark:bg-sky-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />

          {/* Seek Handle */}
          {duration > 0 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-sky-600 dark:bg-sky-400 rounded-full shadow-md"
              style={{ left: `${progress}%`, marginLeft: '-6px' }}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          {/* Left: Chapter Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close audio player"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {chapter.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDuration(displayTime)} / {formatDuration(duration)}
              </p>
            </div>
          </div>

          {/* Center: Playback Controls */}
          <div className="flex items-center gap-4">
            {/* Speed Control */}
            <button
              onClick={cycleSpeed}
              className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={`Playback speed: ${playbackSpeed}x`}
            >
              {playbackSpeed}x
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={playing ? onPause : onPlay}
              disabled={loading}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {loading ? (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : playing ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Right: Spacer for symmetry */}
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}
```

**Success Criteria:**
- Component renders without errors
- Play/pause button works
- Scrubber allows seeking through audio
- Playback speed cycles through 0.75x → 1x → 1.25x → 1.5x → 2x
- Time display updates in real-time
- Close button dismisses player

---

### Step 3.3: Create Chapter List Component

**File: `/components/reader/ChapterList.tsx`** (create new file)

```typescript
'use client';

import React from 'react';
import type { Chapter, OpenAIVoice } from '@/types';
import ChapterAudioButton from './ChapterAudioButton';

interface ChapterListProps {
  chapters: Chapter[];
  currentChapter: Chapter | null;
  voice: OpenAIVoice;
  onChapterSelect: (chapter: Chapter) => void;
  onGenerateAudio: (chapter: Chapter) => void;
  onPlayAudio: (chapter: Chapter) => void;
  generatingChapterId: number | null;
  generationProgress: number;
}

export default function ChapterList({
  chapters,
  currentChapter,
  voice,
  onChapterSelect,
  onGenerateAudio,
  onPlayAudio,
  generatingChapterId,
  generationProgress,
}: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No chapters found
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {chapters.map((chapter) => (
        <div
          key={chapter.id}
          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
            currentChapter?.id === chapter.id ? 'bg-sky-50 dark:bg-sky-950' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Chapter Info */}
            <button
              onClick={() => onChapterSelect(chapter)}
              className="flex-1 text-left"
            >
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                {chapter.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {chapter.wordCount.toLocaleString()} words • ~
                {Math.ceil(chapter.wordCount / 150)} min audio
              </p>
            </button>

            {/* Audio Button */}
            <ChapterAudioButton
              chapter={chapter}
              voice={voice}
              onGenerate={() => onGenerateAudio(chapter)}
              onPlay={() => onPlayAudio(chapter)}
              generating={generatingChapterId === chapter.id}
              progress={generatingChapterId === chapter.id ? generationProgress : 0}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Success Criteria:**
- Component renders chapter list
- Displays word count and estimated audio duration
- Shows correct audio button state per chapter
- Highlights currently playing chapter

---

### Step 3.4: Integrate AudioPlayer in ReaderView

**File: `/components/reader/ReaderView.tsx`**

Add imports:
```typescript
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useAudioGeneration } from '@/hooks/useAudioGeneration';
import AudioPlayer from './AudioPlayer';
import ChapterList from './ChapterList';
import { getAudioSettings, getDefaultAudioSettings } from '@/lib/db';
```

Add state after existing state declarations:
```typescript
const [showChapterList, setShowChapterList] = useState(false);
const [currentAudioChapter, setCurrentAudioChapter] = useState<Chapter | null>(null);
const [audioSettings, setAudioSettings] = useState<AudioSettings | null>(null);
```

Load audio settings on mount:
```typescript
useEffect(() => {
  const loadAudioSettings = async () => {
    const settings = await getAudioSettings(bookId) || getDefaultAudioSettings(bookId);
    setAudioSettings(settings);
  };

  loadAudioSettings();
}, [bookId]);
```

Add audio hooks:
```typescript
const audioPlayer = useAudioPlayer({
  chapter: currentAudioChapter,
  onTimeUpdate: (currentTime, duration) => {
    // TODO Phase 4: Sync reading position
  },
  onEnded: () => {
    setCurrentAudioChapter(null);
  },
});

const audioGeneration = useAudioGeneration({ book });
```

Add chapter list button to controls bar (after Highlights link):
```typescript
<button
  onClick={() => setShowChapterList(!showChapterList)}
  className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
>
  Chapters
</button>
```

Add ChapterList modal after SettingsDrawer:
```typescript
{/* Chapter List */}
{showChapterList && (
  <>
    <div
      className="fixed inset-0 bg-black/50 z-40"
      onClick={() => setShowChapterList(false)}
    />
    <div className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Chapters</h2>
        <button
          onClick={() => setShowChapterList(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <ChapterList
        chapters={chapters}
        currentChapter={currentAudioChapter}
        voice={audioSettings?.voice || 'alloy'}
        onChapterSelect={(chapter) => {
          goToLocation(chapter.cfiStart);
          setShowChapterList(false);
        }}
        onGenerateAudio={async (chapter) => {
          await audioGeneration.generateAudio({
            chapter,
            voice: audioSettings?.voice || 'alloy',
          });
        }}
        onPlayAudio={(chapter) => {
          setCurrentAudioChapter(chapter);
          setShowChapterList(false);
        }}
        generatingChapterId={audioGeneration.generating ? currentAudioChapter?.id || null : null}
        generationProgress={audioGeneration.progress}
      />
    </div>
  </>
)}
```

Add AudioPlayer at bottom (before closing div):
```typescript
{/* Audio Player */}
{currentAudioChapter && (
  <AudioPlayer
    chapter={currentAudioChapter}
    playing={audioPlayer.playing}
    currentTime={audioPlayer.currentTime}
    duration={audioPlayer.duration}
    playbackSpeed={audioPlayer.playbackSpeed}
    loading={audioPlayer.loading}
    onPlay={audioPlayer.play}
    onPause={audioPlayer.pause}
    onSeek={audioPlayer.seek}
    onSpeedChange={audioPlayer.setSpeed}
    onClose={() => setCurrentAudioChapter(null)}
  />
)}
```

**Success Criteria:**
- "Chapters" button appears in top bar
- Clicking opens chapter list drawer
- Chapter list shows all chapters with audio buttons
- "Generate Audio" button triggers generation
- "Play Audio" button opens audio player
- Audio player appears at bottom when playing
- All controls work (play/pause, seek, speed)

---

### Phase 3 Testing & Verification

**Manual Testing:**

1. **Chapter List:**
   ```
   - Open reader
   - Click "Chapters" button
   - Verify all chapters listed with correct info
   - Verify word counts and estimated durations shown
   ```

2. **Audio Generation:**
   ```
   - Click "Generate Audio" for a chapter
   - Verify progress indicator updates (0% → 100%)
   - Verify button changes to "Play Audio" when complete
   ```

3. **Audio Playback:**
   ```
   - Click "Play Audio" for generated chapter
   - Verify audio player appears at bottom
   - Verify play button starts audio
   - Verify pause button pauses audio
   - Verify scrubber allows seeking
   - Verify playback speed cycles through 0.75x → 2x
   - Verify time displays update correctly
   ```

4. **Close Player:**
   ```
   - Click X button on audio player
   - Verify player disappears
   - Verify audio stops playing
   ```

**Success Criteria for Phase 3:**
- [ ] Chapter list displays correctly
- [ ] Audio generation works with progress tracking
- [ ] Audio player renders at bottom when playing
- [ ] Play/pause controls work
- [ ] Scrubber allows seeking through audio
- [ ] Playback speed adjustment works
- [ ] Time displays update in real-time
- [ ] Close button stops playback and hides player
- [ ] No console errors

**Estimated Time:** 8-10 hours
- useAudioPlayer hook: 2-3 hours
- AudioPlayer component: 3-4 hours
- ChapterList component: 1-2 hours
- ReaderView integration: 1-2 hours
- Testing and polish: 2-3 hours

---

## Phase 4: Progress Synchronization & Session Tracking

**Goal:** Sync audio playback position with reading CFI, track listening time in sessions.

**Prerequisites:** Phase 3 complete (audio player functional)

**Files to Create:**
- `/lib/audio-sync.ts` - CFI ↔ timestamp mapping utilities

**Files to Modify:**
- `/hooks/useSession.ts` - Add listening time tracking
- `/hooks/useAudioPlayer.ts` - Track listening time
- `/components/reader/ReaderView.tsx` - Implement bidirectional sync
- `/types/index.ts` - Update Session interface (already done in Phase 1)

---

### Step 4.1: Create Audio-Reading Sync Utilities

**File: `/lib/audio-sync.ts`** (create new file)

```typescript
import type { Book as EpubBook } from 'epubjs';
import type { Chapter } from '@/types';

/**
 * Map audio timestamp to approximate CFI position within chapter
 *
 * Strategy: Linear interpolation based on character position
 * - Audio duration / chapter character count = chars per second
 * - Current time * chars per second = current character position
 * - Map character position to CFI using epub.js
 */
export async function timestampToCFI(
  book: EpubBook,
  chapter: Chapter,
  timestamp: number,
  audioDuration: number
): Promise<string | null> {
  if (!chapter.charCount || audioDuration === 0) return null;

  // Calculate approximate character position
  const charsPerSecond = chapter.charCount / audioDuration;
  const currentCharPosition = Math.floor(timestamp * charsPerSecond);

  // Get section from chapter start CFI
  const section = book.spine.get(chapter.cfiStart);
  if (!section) return null;

  try {
    // Load section content
    const contents = await section.load(book.load.bind(book));
    const text = contents.textContent || '';

    // Clamp position to valid range
    const safePosition = Math.min(currentCharPosition, text.length - 1);

    // Find DOM node at character position
    // This is a simplified approach - epub.js uses more complex CFI generation
    // For v1, we'll use chapter start CFI + percentage
    const percentage = safePosition / text.length;

    // Generate approximate CFI (simplified)
    // Real implementation would walk DOM tree to find exact node
    return `${chapter.cfiStart}#${percentage.toFixed(4)}`;

  } catch (error) {
    console.error('Error mapping timestamp to CFI:', error);
    return null;
  }
}

/**
 * Map CFI position to approximate audio timestamp
 *
 * Strategy: Reverse of timestampToCFI
 * - Get character position from CFI
 * - Calculate timestamp from character position
 */
export async function cfiToTimestamp(
  book: EpubBook,
  chapter: Chapter,
  cfi: string,
  audioDuration: number
): Promise<number | null> {
  if (!chapter.charCount || audioDuration === 0) return null;

  try {
    // Check if CFI is within chapter range
    const comparison = book.locations.cfiComparison(cfi, chapter.cfiStart);
    if (comparison < 0) return 0; // Before chapter start

    const section = book.spine.get(chapter.cfiStart);
    if (!section) return null;

    const contents = await section.load(book.load.bind(book));
    const text = contents.textContent || '';

    // Extract percentage from simplified CFI format
    // In real implementation, would calculate from DOM position
    const match = cfi.match(/#([\d.]+)$/);
    const percentage = match ? parseFloat(match[1]) : 0;

    const charPosition = Math.floor(percentage * text.length);
    const charsPerSecond = chapter.charCount / audioDuration;
    const timestamp = charPosition / charsPerSecond;

    return Math.max(0, Math.min(timestamp, audioDuration));

  } catch (error) {
    console.error('Error mapping CFI to timestamp:', error);
    return null;
  }
}

/**
 * Check if CFI is within chapter range
 */
export function isCFIInChapter(
  book: EpubBook,
  chapter: Chapter,
  cfi: string
): boolean {
  try {
    const startComparison = book.locations.cfiComparison(cfi, chapter.cfiStart);
    const endComparison = book.locations.cfiComparison(cfi, chapter.cfiEnd);

    return startComparison >= 0 && endComparison <= 0;
  } catch {
    return false;
  }
}

/**
 * Find chapter containing given CFI
 */
export function findChapterByCFI(
  book: EpubBook,
  chapters: Chapter[],
  cfi: string
): Chapter | null {
  for (const chapter of chapters) {
    if (isCFIInChapter(book, chapter, cfi)) {
      return chapter;
    }
  }
  return null;
}
```

**Note:** This is a **simplified implementation** for v1. Full CFI mapping requires walking the DOM tree and accounting for EPUB structure. For production, consider:
- Using epub.js built-in CFI utilities
- Storing paragraph-level CFI markers during chapter extraction
- Building a character position → CFI lookup table

**Success Criteria:**
- Functions compile without errors
- Timestamp → CFI conversion returns plausible CFI strings
- CFI → timestamp conversion returns timestamps within audio duration
- Chapter detection works for test cases

---

### Step 4.2: Update Session Tracking for Audio

**File: `/hooks/useSession.ts`**

Add listening time tracking after existing state:
```typescript
const [listeningTime, setListeningTime] = useState(0); // seconds
const listeningTimeRef = useRef(0);
const listeningStartRef = useRef<number | null>(null);
```

Add function to start/stop listening tracking:
```typescript
const startListening = useCallback(() => {
  listeningStartRef.current = Date.now();
}, []);

const stopListening = useCallback(() => {
  if (listeningStartRef.current !== null) {
    const elapsed = (Date.now() - listeningStartRef.current) / 1000; // Convert to seconds
    const newListeningTime = listeningTime + elapsed;
    setListeningTime(newListeningTime);
    listeningTimeRef.current = newListeningTime;
    listeningStartRef.current = null;

    // Update session in database
    if (sessionIdRef.current !== null) {
      updateSession(sessionIdRef.current, {
        listeningTime: Math.floor(newListeningTime / 60), // Convert to minutes
      });
    }
  }
}, [listeningTime]);

const trackListeningTime = useCallback((audioChapterId: number | null) => {
  if (audioChapterId !== null) {
    startListening();
  } else {
    stopListening();
  }
}, [startListening, stopListening]);
```

Update return to include listening tracking:
```typescript
return {
  sessionId,
  pagesRead,
  wordsRead,
  listeningTime: Math.floor(listeningTime / 60), // Return as minutes
  sessionStartTime,
  trackPageTurn,
  trackListeningTime,
  endCurrentSession,
};
```

**Success Criteria:**
- Listening time tracked separately from reading time
- Session database updates with listeningTime field
- No TypeScript errors

---

### Step 4.3: Implement Bidirectional Sync in ReaderView

**File: `/components/reader/ReaderView.tsx`**

Add imports:
```typescript
import { timestampToCFI, cfiToTimestamp, findChapterByCFI } from '@/lib/audio-sync';
```

Add sync state:
```typescript
const [syncEnabled, setSyncEnabled] = useState(true); // User toggle for sync
const lastSyncTimeRef = useRef<number>(0);
```

Update audioPlayer hook to include sync logic:
```typescript
const audioPlayer = useAudioPlayer({
  chapter: currentAudioChapter,
  onTimeUpdate: async (currentTime, duration) => {
    // Sync audio → reading position (every 5 seconds to avoid excessive updates)
    const now = Date.now();
    if (syncEnabled && currentAudioChapter && book && now - lastSyncTimeRef.current > 5000) {
      const cfi = await timestampToCFI(book, currentAudioChapter, currentTime, duration);
      if (cfi) {
        goToLocation(cfi);
        lastSyncTimeRef.current = now;
      }
    }

    // Track listening time
    if (audioPlayer.playing) {
      trackListeningTime(currentAudioChapter?.id || null);
    }
  },
  onEnded: () => {
    setCurrentAudioChapter(null);
    trackListeningTime(null); // Stop tracking
  },
});
```

Add function to sync reading → audio position:
```typescript
const syncReadingToAudio = useCallback(async () => {
  if (!syncEnabled || !currentAudioChapter || !book || !currentLocation) return;

  // Check if current reading position is in current audio chapter
  const currentChapter = findChapterByCFI(book, chapters, currentLocation);

  if (currentChapter?.id === currentAudioChapter.id) {
    // Same chapter - sync timestamp
    const timestamp = await cfiToTimestamp(book, currentAudioChapter, currentLocation, audioPlayer.duration);
    if (timestamp !== null) {
      audioPlayer.seek(timestamp);
    }
  } else if (currentChapter) {
    // Different chapter - switch audio chapter if it has audio
    const audioFile = await getAudioFile(currentChapter.id!);
    if (audioFile) {
      setCurrentAudioChapter(currentChapter);
    }
  }
}, [syncEnabled, currentAudioChapter, book, currentLocation, chapters, audioPlayer]);

// Sync when user navigates pages while audio is playing
useEffect(() => {
  if (audioPlayer.playing && currentLocation) {
    syncReadingToAudio();
  }
}, [currentLocation, syncReadingToAudio, audioPlayer.playing]);
```

Add sync toggle to AudioPlayer component props:
```typescript
<AudioPlayer
  // ... existing props
  syncEnabled={syncEnabled}
  onToggleSync={() => setSyncEnabled(!syncEnabled)}
/>
```

Update AudioPlayer component to show sync toggle:

**File: `/components/reader/AudioPlayer.tsx`**

Add to props:
```typescript
interface AudioPlayerProps {
  // ... existing props
  syncEnabled?: boolean;
  onToggleSync?: () => void;
}
```

Add sync toggle button in controls (after speed button):
```typescript
{onToggleSync && (
  <button
    onClick={onToggleSync}
    className={`p-2 rounded transition-colors ${
      syncEnabled
        ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950'
        : 'text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800'
    }`}
    title={syncEnabled ? 'Sync enabled: audio updates reading position' : 'Sync disabled'}
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  </button>
)}
```

**Success Criteria:**
- Audio playback updates reading position every 5 seconds
- Turning pages while audio plays seeks audio to new position
- Sync toggle button shows current state
- Listening time tracked in session

---

### Phase 4 Testing & Verification

**Manual Testing:**

1. **Audio → Reading Sync:**
   ```
   - Generate audio for a chapter
   - Play audio
   - Verify reading position advances as audio plays
   - Check updates occur every ~5 seconds
   ```

2. **Reading → Audio Sync:**
   ```
   - Play audio for a chapter
   - Turn pages manually while audio plays
   - Verify audio seeks to match new reading position
   ```

3. **Sync Toggle:**
   ```
   - Disable sync via toggle button
   - Verify audio no longer updates reading position
   - Re-enable sync
   - Verify sync resumes
   ```

4. **Listening Time Tracking:**
   ```
   - Play audio for 2 minutes
   - Check IndexedDB → sessions table
   - Verify listeningTime field updated correctly
   ```

5. **Chapter Switching:**
   ```
   - Play audio for chapter 1
   - Navigate to chapter 2
   - Verify audio switches to chapter 2 (if generated)
   - Or stops if chapter 2 has no audio
   ```

**Edge Cases:**

1. **Sync accuracy:**
   ```
   - Compare audio timestamp with reading position
   - Should be within ~1-2 paragraphs (acceptable for v1)
   ```

2. **Long chapters:**
   ```
   - Test with 10,000+ word chapters
   - Verify sync doesn't drift over time
   ```

**Success Criteria for Phase 4:**
- [ ] Audio playback updates reading position
- [ ] Reading navigation seeks audio
- [ ] Sync can be toggled on/off
- [ ] Listening time tracked in sessions
- [ ] Chapter switching works when audio available
- [ ] Sync accuracy acceptable (<1 page drift)
- [ ] No performance issues during sync

**Estimated Time:** 6-8 hours
- Audio-sync utilities: 2-3 hours
- Session tracking updates: 1 hour
- Bidirectional sync implementation: 2-3 hours
- Testing and calibration: 2-3 hours

---

## Phase 5: Settings Panel & Usage Dashboard

**Goal:** Add audio settings UI, usage dashboard with cost tracking.

**Prerequisites:** Phase 4 complete (all audio functionality working)

**Files to Create:**
- `/components/reader/AudioSettingsPanel.tsx` - Audio settings in drawer
- `/components/reader/UsageDashboard.tsx` - Cost and usage stats

**Files to Modify:**
- `/components/reader/SettingsDrawer.tsx` - Add audio settings section
- `/hooks/useAudioUsage.ts` - Create hook for usage stats

---

### Step 5.1: Create Audio Usage Hook

**File: `/hooks/useAudioUsage.ts`** (create new file)

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { AudioUsage } from '@/types';
import { getAudioUsage, getBookAudioStorageSize } from '@/lib/db';

interface UseAudioUsageProps {
  bookId: number;
}

interface AudioUsageStats {
  totalCost: number;
  totalGenerations: number;
  storageBytes: number;
  usageByVoice: Record<string, { count: number; cost: number }>;
  recentUsage: AudioUsage[];
}

export function useAudioUsage({ bookId }: UseAudioUsageProps) {
  const [stats, setStats] = useState<AudioUsageStats>({
    totalCost: 0,
    totalGenerations: 0,
    storageBytes: 0,
    usageByVoice: {},
    recentUsage: [],
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);

    try {
      const usage = await getAudioUsage(bookId);
      const storageBytes = await getBookAudioStorageSize(bookId);

      // Calculate total cost
      const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);

      // Group by voice
      const usageByVoice: Record<string, { count: number; cost: number }> = {};

      usage.forEach((u) => {
        if (!usageByVoice[u.voice]) {
          usageByVoice[u.voice] = { count: 0, cost: 0 };
        }
        usageByVoice[u.voice].count += 1;
        usageByVoice[u.voice].cost += u.cost;
      });

      setStats({
        totalCost,
        totalGenerations: usage.length,
        storageBytes,
        usageByVoice,
        recentUsage: usage.slice(-10).reverse(), // Last 10, newest first
      });
    } catch (error) {
      console.error('Error loading audio usage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    refresh: loadStats,
  };
}
```

**Success Criteria:**
- Hook compiles without errors
- Returns usage statistics correctly
- Calculates costs accurately
- Groups usage by voice

---

### Step 5.2: Create Audio Settings Panel Component

**File: `/components/reader/AudioSettingsPanel.tsx`** (create new file)

```typescript
'use client';

import React from 'react';
import type { OpenAIVoice, AudioSettings } from '@/types';

interface AudioSettingsPanelProps {
  settings: AudioSettings;
  onChange: (settings: Partial<AudioSettings>) => void;
}

const VOICES: { value: OpenAIVoice; label: string; description: string }[] = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral, versatile voice' },
  { value: 'echo', label: 'Echo', description: 'Warm, engaging voice' },
  { value: 'fable', label: 'Fable', description: 'Clear, storytelling voice' },
  { value: 'onyx', label: 'Onyx', description: 'Deep, authoritative voice' },
  { value: 'nova', label: 'Nova', description: 'Energetic, youthful voice' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft, gentle voice' },
];

const PLAYBACK_SPEEDS = [
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1x (Normal)' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2.0, label: '2x' },
];

export default function AudioSettingsPanel({ settings, onChange }: AudioSettingsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Voice Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Default Voice
        </label>
        <div className="grid grid-cols-2 gap-2">
          {VOICES.map((voice) => (
            <button
              key={voice.value}
              onClick={() => onChange({ voice: voice.value })}
              className={`p-3 text-left rounded-lg border transition-colors ${
                settings.voice === voice.value
                  ? 'bg-sky-50 dark:bg-sky-950 border-sky-600 dark:border-sky-400'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {voice.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {voice.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Playback Speed */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Default Playback Speed
        </label>
        <div className="flex gap-2">
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              key={speed.value}
              onClick={() => onChange({ playbackSpeed: speed.value })}
              className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                settings.playbackSpeed === speed.value
                  ? 'bg-sky-50 dark:bg-sky-950 border-sky-600 dark:border-sky-400 text-sky-700 dark:text-sky-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {speed.label}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-play */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Auto-play Next Chapter
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Automatically play next chapter when current finishes
          </p>
        </div>
        <button
          onClick={() => onChange({ autoPlay: !settings.autoPlay })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.autoPlay
              ? 'bg-sky-600 dark:bg-sky-500'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.autoPlay}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.autoPlay ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
```

**Success Criteria:**
- Component renders without errors
- Voice selection shows all 6 OpenAI voices
- Playback speed selector works
- Auto-play toggle works
- Settings persist when changed

---

### Step 5.3: Create Usage Dashboard Component

**File: `/components/reader/UsageDashboard.tsx`** (create new file)

```typescript
'use client';

import React from 'react';
import type { AudioUsageStats } from '@/hooks/useAudioUsage';
import { formatCost } from '@/lib/epub-utils';

interface UsageDashboardProps {
  stats: AudioUsageStats;
  loading: boolean;
}

export default function UsageDashboard({ stats, loading }: UsageDashboardProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Loading usage statistics...
      </div>
    );
  }

  const storageMB = (stats.storageBytes / 1024 / 1024).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Total Cost
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatCost(stats.totalCost)}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Generations
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {stats.totalGenerations}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Storage
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {storageMB} MB
          </div>
        </div>
      </div>

      {/* Usage by Voice */}
      {Object.keys(stats.usageByVoice).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Usage by Voice
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.usageByVoice).map(([voice, data]) => (
              <div
                key={voice}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {voice}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {data.count} generation{data.count !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatCost(data.cost)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Usage */}
      {stats.recentUsage.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Generations
          </h3>
          <div className="space-y-2">
            {stats.recentUsage.slice(0, 5).map((usage) => (
              <div
                key={usage.id}
                className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded-lg p-2"
              >
                <div className="text-gray-700 dark:text-gray-300">
                  {new Date(usage.timestamp).toLocaleDateString()} •{' '}
                  <span className="capitalize">{usage.voice}</span> •{' '}
                  {usage.charCount.toLocaleString()} chars
                </div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {formatCost(usage.cost)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.totalGenerations === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No audio generated yet
        </div>
      )}
    </div>
  );
}
```

**Success Criteria:**
- Component displays usage stats correctly
- Shows total cost, generations, storage
- Breaks down usage by voice
- Displays recent generations
- Formats costs consistently

---

### Step 5.4: Integrate into Settings Drawer

**File: `/components/reader/SettingsDrawer.tsx`**

Add imports:
```typescript
import AudioSettingsPanel from './AudioSettingsPanel';
import UsageDashboard from './UsageDashboard';
import { useAudioUsage } from '@/hooks/useAudioUsage';
import { getAudioSettings, saveAudioSettings, getDefaultAudioSettings } from '@/lib/db';
import type { AudioSettings } from '@/types';
```

Add props to component:
```typescript
interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: number; // NEW: Need bookId for audio settings
}

export default function SettingsDrawer({ isOpen, onClose, bookId }: SettingsDrawerProps) {
```

Add state for audio settings:
```typescript
const [activeTab, setActiveTab] = useState<'typography' | 'audio' | 'usage'>('typography');
const [audioSettings, setAudioSettings] = useState<AudioSettings | null>(null);
const audioUsage = useAudioUsage({ bookId });
```

Load audio settings on mount:
```typescript
useEffect(() => {
  const loadAudioSettings = async () => {
    const settings = await getAudioSettings(bookId) || getDefaultAudioSettings(bookId);
    setAudioSettings(settings);
  };

  if (isOpen) {
    loadAudioSettings();
  }
}, [bookId, isOpen]);
```

Handle audio settings changes:
```typescript
const handleAudioSettingsChange = async (updates: Partial<AudioSettings>) => {
  if (!audioSettings) return;

  const newSettings = { ...audioSettings, ...updates };
  setAudioSettings(newSettings);
  await saveAudioSettings(newSettings);
};
```

Replace content section with tabbed interface:
```typescript
{/* Content */}
<div className="flex-1 overflow-y-auto">
  {/* Tabs */}
  <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
    <button
      onClick={() => setActiveTab('typography')}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        activeTab === 'typography'
          ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      Typography
    </button>
    <button
      onClick={() => setActiveTab('audio')}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        activeTab === 'audio'
          ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      Audio
    </button>
    <button
      onClick={() => setActiveTab('usage')}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        activeTab === 'usage'
          ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
    >
      Usage
    </button>
  </div>

  {/* Tab Content */}
  <div className="p-6">
    {activeTab === 'typography' && (
      <div className="space-y-6">
        {/* Existing typography controls */}
        {/* Theme, Font Size, Font Family, Line Height, Margins */}
      </div>
    )}

    {activeTab === 'audio' && audioSettings && (
      <AudioSettingsPanel
        settings={audioSettings}
        onChange={handleAudioSettingsChange}
      />
    )}

    {activeTab === 'usage' && (
      <UsageDashboard
        stats={audioUsage.stats}
        loading={audioUsage.loading}
      />
    )}
  </div>
</div>
```

Update ReaderView to pass bookId:
```typescript
<SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} bookId={bookId} />
```

**Success Criteria:**
- Settings drawer has 3 tabs: Typography, Audio, Usage
- Audio tab shows voice and speed settings
- Usage tab shows cost statistics
- Settings persist when changed
- No TypeScript errors

---

### Phase 5 Testing & Verification

**Manual Testing:**

1. **Audio Settings:**
   ```
   - Open Settings drawer
   - Click "Audio" tab
   - Change voice selection
   - Verify setting saved (check IndexedDB)
   - Generate new audio
   - Verify new voice used
   ```

2. **Playback Speed:**
   ```
   - Set default playback speed to 1.5x
   - Play audio
   - Verify plays at 1.5x by default
   ```

3. **Usage Dashboard:**
   ```
   - Generate audio for 3 chapters
   - Open Settings → Usage tab
   - Verify total cost correct (~$0.045 for 3x 1000 words)
   - Verify generation count = 3
   - Verify storage size shown
   ```

4. **Voice Breakdown:**
   ```
   - Generate audio with different voices
   - Check usage by voice section
   - Verify each voice shows correct count and cost
   ```

**Success Criteria for Phase 5:**
- [ ] Settings drawer has tabbed interface
- [ ] Audio settings panel allows voice and speed selection
- [ ] Settings persist across sessions
- [ ] Usage dashboard displays accurate statistics
- [ ] Cost calculations match actual API charges
- [ ] No console errors

**Estimated Time:** 4-6 hours
- useAudioUsage hook: 1 hour
- AudioSettingsPanel component: 1-2 hours
- UsageDashboard component: 1-2 hours
- Settings drawer integration: 1 hour
- Testing: 1-2 hours

---

## Risk Assessment

### Technical Risks

**1. OpenAI API Rate Limits**
- **Risk:** Users generate many chapters quickly, hit rate limits
- **Impact:** Audio generation fails, poor UX
- **Mitigation:**
  - Implement exponential backoff retry logic
  - Queue generation requests (max 3 concurrent)
  - Display clear error messages with retry-after time
  - Consider batch generation with user confirmation

**2. IndexedDB Storage Quota**
- **Risk:** Browser storage quota exceeded, can't store more audio
- **Impact:** Audio generation succeeds but fails to save
- **Mitigation:**
  - Monitor quota usage (navigator.storage.estimate())
  - Warn users at 80% quota
  - Implement LRU cache eviction
  - Provide manual delete for old audio
  - Future: Migrate to cloud storage

**3. CFI Sync Accuracy**
- **Risk:** Audio-reading sync drifts over time or is inaccurate
- **Impact:** Poor UX, users lose place when switching modes
- **Mitigation:**
  - Use simplified linear interpolation for v1 (acceptable accuracy)
  - Test with various book structures (poetry, prose, textbooks)
  - Allow users to disable sync
  - Future: Implement paragraph-level CFI markers

**4. Audio Playback Performance**
- **Risk:** Large audio files cause memory issues or slow playback
- **Impact:** Browser crashes, audio stutters
- **Mitigation:**
  - Use streaming playback via Object URLs
  - Revoke old Object URLs to prevent memory leaks
  - Test with long chapters (10,000+ words)
  - Monitor memory usage in DevTools

**5. API Key Security**
- **Risk:** API key exposed in client-side code or network requests
- **Impact:** Unauthorized usage, high costs
- **Mitigation:**
  - Keep API key in .env.local (never commit)
  - API routes run server-side only
  - Consider rate limiting per user (future: auth)
  - Monitor usage in OpenAI dashboard

### Timeline Risks

**1. Phase Dependencies**
- **Risk:** Delays in early phases cascade to later phases
- **Impact:** Project timeline extends significantly
- **Mitigation:**
  - Phase 1-2 are most critical (foundational)
  - Phase 3-5 can be partially parallelized
  - Build MVP first (Phase 1-3), enhance later

**2. Scope Creep**
- **Risk:** Users request additional features during implementation
- **Impact:** Timeline extends, quality suffers
- **Mitigation:**
  - Stick to defined scope in this plan
  - Document feature requests for v2
  - Phase 5 (settings) is most prone to creep - keep minimal

**3. Testing and Debugging**
- **Risk:** Complex sync logic requires extensive debugging
- **Impact:** Phase 4 takes longer than estimated
- **Mitigation:**
  - Allocate 30% buffer for Phase 4 (sync is complex)
  - Start with simplified sync (linear interpolation)
  - Accept some inaccuracy for v1

### Data Risks

**1. Database Migration Issues**
- **Risk:** Dexie schema upgrade fails, user data lost
- **Impact:** Users lose reading progress, highlights
- **Mitigation:**
  - Test migration thoroughly in dev environment
  - Dexie handles migrations automatically
  - Version upgrade is additive (no data deletion)
  - Consider export/backup before migration

**2. Audio Data Loss**
- **Risk:** Browser clears IndexedDB, generated audio lost
- **Impact:** Users must regenerate (costs money again)
- **Mitigation:**
  - Warn users that audio is not synced (local only)
  - Future: Cloud storage with sync
  - Track usage to prevent duplicate charges

---

## Performance Considerations

### Audio Generation
- **Expected:** 5-15 seconds per chapter (3500 words)
- **Optimization:** Run in background, don't block UI
- **Monitoring:** Show progress percentage

### Audio Playback
- **Expected:** Instant playback start from IndexedDB
- **Optimization:** Use Object URLs, not base64 strings
- **Memory:** Revoke old URLs to prevent leaks

### Database Queries
- **Expected:** <50ms for chapter/audio lookups
- **Optimization:** Index on bookId, chapterId
- **Monitoring:** No performance impact on reading

### Sync Updates
- **Expected:** CFI calculation every 5 seconds
- **Optimization:** Throttle to prevent excessive updates
- **Impact:** Minimal (calculations are fast)

---

## Security Considerations

### API Key Protection
- Store in `.env.local` (never commit)
- API routes run server-side only (Next.js API routes)
- No client-side exposure

### User Data Privacy
- All data stored locally (IndexedDB)
- No analytics sent to external servers
- Audio files never leave user's device (v1)

### Content Security
- EPUB files user-uploaded only
- No DRM handling (out of scope)
- Text extraction for TTS is fair use for personal audio

---

## Documentation Requirements

### User-Facing Documentation

**README.md Updates:**
```markdown
## Audio Features (v0.2)

### Text-to-Speech
- Generate high-quality audio for any chapter using OpenAI voices
- 6 voice options: Alloy, Echo, Fable, Onyx, Nova, Shimmer
- Cost: ~$0.26 per 3,500-word chapter

### Audio Playback
- Standard controls: play/pause, scrubber, playback speed (0.75x-2x)
- Syncs with reading position (optional)
- Tracks listening time separately from reading time

### Usage Dashboard
- View total costs, generation count, storage usage
- Break down by voice and date
- Manage audio storage
```

**Settings Guide:**
- Explain voice characteristics
- Show cost estimates
- Describe sync behavior

### Developer Documentation

**API Documentation:**
- Document `/api/tts/generate` endpoint
- Request/response schemas
- Error codes and handling

**Database Schema:**
- Document new tables in `lib/db.ts` comments
- Migration guide for Dexie v2 → v3

**Architecture Decision Records:**
- Why IndexedDB over cloud storage (v1)
- Why linear interpolation for CFI sync (simplicity)
- Why OpenAI TTS-1 over alternatives (quality/cost)

---

## Future Enhancements (Out of Scope for v1)

### Phase 6: Cloud Storage & Sync
- Store audio in R2/S3
- Sync across devices
- Reduce local storage pressure

### Phase 7: Multi-Chapter Queue
- Play chapters sequentially
- Shuffle/repeat modes
- Playlist management

### Phase 8: Advanced Sync
- Paragraph-level CFI markers
- Precise word-by-word sync
- Highlight active sentence during audio

### Phase 9: Offline Support
- Download audio to device storage (PWA)
- Background audio playback
- MediaSession API full integration

### Phase 10: Cost Optimization
- Batch generation discounts
- Alternative TTS providers (Eleven Labs, Azure)
- Voice caching across users (if legal)

---

## Conclusion

This implementation plan provides a comprehensive roadmap for adding text-to-speech chapter audio functionality to the Adaptive Reader. The phased approach ensures:

1. **Incremental Value:** Each phase delivers working functionality
2. **Testability:** Clear success criteria per phase
3. **Risk Management:** Dependencies identified, mitigations in place
4. **Realistic Estimates:** 32-42 hours total (4-5 weeks)

**Next Steps:**
1. Review and approve this plan
2. Set up OpenAI API account and get API key
3. Begin Phase 1: Database schema and chapter extraction
4. Iterate and refine as implementation progresses

**Success will be measured by:**
- Users can generate and play chapter audio seamlessly
- Sync between audio and reading works reliably
- Costs are transparent and tracked accurately
- No degradation to existing reading experience
- All functionality works offline (IndexedDB-only)
