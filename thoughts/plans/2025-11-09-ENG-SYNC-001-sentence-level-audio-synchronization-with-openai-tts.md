---
doc_type: plan
date: 2025-11-10T03:54:25+00:00
title: "Sentence-Level Audio Synchronization with OpenAI TTS"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T03:54:25+00:00"
feature: "sentence-sync"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Sentence Parsing and Data Model"
    status: completed
  - name: "Phase 2: Duration Estimation Engine"
    status: completed
  - name: "Phase 3: Real-time Highlighting"
    status: pending
  - name: "Phase 4: Integration and Testing"
    status: pending

git_commit: c3bbf68160f00a0b879a8469048bec3ea44b899b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Claude Code
last_updated_note: "Phase 2 completed - sentence parsing integrated into audio generation"

ticket_id: ENG-SYNC-001
tags:
  - audio
  - tts
  - synchronization
status: draft

related_docs:
  - "2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md"
---

# Sentence-Level Audio Synchronization with OpenAI TTS

## Executive Summary

This plan details the implementation of sentence-level audio synchronization for the EPUB reader's TTS feature. The current system generates chapter audio via OpenAI TTS but provides no visual feedback during playback. This enhancement will add real-time sentence highlighting synchronized with audio playback, improving user comprehension and engagement.

**Approach:** Character count-based duration estimation (~13 chars/second) with sentence boundary detection. This pragmatic approach works with any TTS provider (no word-level timestamps required) and can be enhanced to word-level synchronization later if needed.

**Key Benefits:**
- Improved reading comprehension through visual + audio alignment
- Better user experience (follow along with highlighted text)
- Foundation for future word-level synchronization
- No changes to OpenAI TTS integration (works with current API)

**Success Criteria:**
- Sentence highlighting synchronized within 0.5-2 seconds of audio
- Smooth highlighting transitions without jarring scrolling
- Works on desktop and mobile
- No performance degradation during playback
- Sentence data cached/stored (no recalculation on replay)

## Current State Analysis

### Existing Architecture

**Audio Generation Flow:**
1. User clicks "Generate Audio" on chapter → `useAudioGeneration.ts`
2. Chapter text extracted via `getChapterText()` from `lib/epub-utils.ts`
3. Text sent to `/api/tts/generate-stream` (splits into 4096-char chunks)
4. OpenAI TTS generates MP3 audio (no word-level timestamps)
5. Audio concatenated and saved to IndexedDB via Dexie
6. `AudioFile` stored with: `blob`, `duration`, `voice`, `speed`, `sizeBytes`

**Audio Playback Flow:**
1. User clicks "Play Audio" → `setCurrentAudioChapter(chapter)`
2. `useAudioPlayer.ts` loads audio from IndexedDB via `getAudioFile(chapterId)`
3. Creates HTML Audio element with blob URL
4. Manages playback state: `playing`, `currentTime`, `duration`
5. Fires `onTimeUpdate` callback every ~250ms with current time
6. Currently: No text synchronization during playback

**EPUB Rendering:**
- `epub.js` renders content in iframe
- `useEpubReader.ts` manages book, rendition, navigation
- `rendition.display(cfi)` navigates to specific position
- DOM manipulation requires accessing iframe content

**Database Schema (Dexie):**
```typescript
// Current tables (version 3)
chapters: '++id, bookId, order, cfiStart'
audioFiles: '++id, chapterId, generatedAt'
audioSettings: 'bookId, updatedAt'

// Current Chapter interface
interface Chapter {
  id?: number;
  bookId: number;
  title: string;
  cfiStart: string;
  cfiEnd: string;
  wordCount: number;
  charCount: number;
  order: number;
  level: number;
}

// Current AudioFile interface
interface AudioFile {
  id?: number;
  chapterId: number;
  blob: Blob;
  duration: number;
  voice: OpenAIVoice;
  speed: number;
  generatedAt: Date;
  sizeBytes: number;
}
```

### Gaps Identified

1. **No sentence boundary data:** Chapter text stored as single string, no sentence-level structure
2. **No timing metadata:** Audio files have `duration` but no sentence timestamps
3. **No highlighting mechanism:** No code to highlight sentences in epub.js iframe
4. **No synchronization logic:** `onTimeUpdate` callback exists but doesn't update UI

### Constraints

- **OpenAI TTS limitation:** No word-level timestamps (only total duration)
- **epub.js complexity:** DOM manipulation requires iframe access
- **Performance:** Must handle 100+ sentences without lag
- **Storage:** Sentence timing data must be efficiently stored
- **Accuracy:** Character-based estimation will have ~0.5-2 second drift

## Requirements

### Functional Requirements

**FR1: Sentence Detection**
- Parse chapter text into sentences using NLP library
- Handle sentence boundaries: `.`, `!`, `?`
- Handle edge cases:
  - Abbreviations: Dr., Mr., Mrs., etc.
  - Ellipsis: `...`
  - Quotes: "sentence." vs. "sentence"
  - Numbers: 3.14, $1.50
- Output: Array of sentences with start/end character positions

**FR2: Duration Estimation**
- Estimate sentence duration based on character count
- Base rate: 13 characters/second (150 WPM average speaking rate)
- Adjustments:
  - Punctuation pauses: +0.2s for comma, +0.4s for period
  - Sentence length: scale based on complexity
- Store estimated start/end timestamps for each sentence

**FR3: Real-time Highlighting**
- Highlight current sentence during audio playback
- Visual style: background color (yellow/light highlight)
- Scroll behavior: keep highlighted sentence in viewport
- Clear highlighting when audio stops/pauses
- Handle playback controls: pause, resume, seek

**FR4: Data Persistence**
- Store sentence timing data when audio is generated
- Associate sentence data with `AudioFile` record
- Load sentence data for playback synchronization
- Invalidate/regenerate if audio parameters change (voice, speed)

**FR5: User Experience**
- Smooth highlighting transitions (CSS transitions)
- No jarring scrolling (smooth scroll behavior)
- Accurate synchronization (within 0.5-2 seconds acceptable)
- Works on desktop and mobile
- Minimal performance impact

### Technical Requirements

**TR1: Database Schema Update**
- Add `sentenceSyncData` table to store sentence metadata
- Associate with `chapterId` and `audioFileId`
- Store sentence boundaries and timing efficiently

**TR2: Sentence Parsing Library**
- Evaluate: `compromise`, `natural`, or custom regex-based parser
- Must handle English text (extensible to other languages later)
- Must be fast (parse 10K words in <500ms)

**TR3: DOM Manipulation**
- Access epub.js iframe content safely
- Wrap sentences in `<span>` elements with unique IDs
- Apply CSS classes for highlighting
- Handle dynamic content changes (page turns)

**TR4: Synchronization Logic**
- Track current playback time via `onTimeUpdate`
- Binary search to find current sentence (O(log n) performance)
- Update highlighted sentence only when necessary (avoid thrashing)
- Handle edge cases: seek, chapter boundaries

**TR5: Performance**
- Sentence parsing: <500ms for 10K word chapter
- Highlighting update: <50ms (60fps smooth)
- Storage overhead: <50KB per chapter for sentence data
- No blocking operations during playback

### Out of Scope

- Word-level synchronization (future enhancement)
- Multiple language support (English only for v1)
- User customization of highlight color (fixed yellow)
- Pronunciation corrections (rely on TTS default)
- Sentence-level playback controls (play from sentence)

## Architecture & Design

### Data Model

#### New Database Table: `sentenceSyncData`

```typescript
// New interface in types/index.ts
export interface SentenceSyncData {
  id?: number;
  audioFileId: number;       // FK to audioFiles table
  chapterId: number;          // FK for easier querying
  sentences: SentenceMetadata[];
  generatedAt: Date;
  version: number;            // Schema version for migrations
}

export interface SentenceMetadata {
  text: string;               // Sentence text
  startChar: number;          // Character position in chapter
  endChar: number;            // Character position end
  startTime: number;          // Estimated start time (seconds)
  endTime: number;            // Estimated end time (seconds)
  charCount: number;          // Sentence character count
}
```

#### Database Schema Migration

```typescript
// lib/db.ts - Version 4 migration
this.version(4).stores({
  // ... existing tables ...
  sentenceSyncData: '++id, audioFileId, chapterId, generatedAt',
});
```

**Storage Estimation:**
- 100 sentences per chapter (average)
- ~50 bytes per sentence metadata (JSON overhead)
- Total: ~5KB per chapter (acceptable)

#### Modified AudioFile Metadata

```typescript
// No changes to AudioFile interface
// Sentence data stored separately in sentenceSyncData table
// Linked via audioFileId foreign key
```

### Sentence Parsing Strategy

#### Library Evaluation

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| `compromise` | Fast, lightweight (200KB), good sentence detection | Less accurate on edge cases | **Recommended** |
| `natural` | Comprehensive NLP, high accuracy | Heavy (2MB+), slower | Overkill for v1 |
| Custom Regex | Full control, no dependencies | Edge cases hard to handle | Fallback option |

**Decision:** Use `compromise` library for sentence detection.

**Rationale:**
- Fast performance (<100ms for 10K words)
- Good accuracy for English text
- Small bundle size (200KB gzipped)
- Easy to extend for word-level parsing later

#### Sentence Parsing Implementation

```typescript
// lib/sentence-parser.ts (new file)

import nlp from 'compromise';

export interface ParsedSentence {
  text: string;
  startChar: number;
  endChar: number;
  charCount: number;
}

export function parseChapterIntoSentences(
  chapterText: string
): ParsedSentence[] {
  const doc = nlp(chapterText);
  const sentences = doc.sentences().out('array') as string[];

  const parsed: ParsedSentence[] = [];
  let currentPos = 0;

  for (const sentenceText of sentences) {
    // Find sentence position in original text
    const startChar = chapterText.indexOf(sentenceText, currentPos);
    if (startChar === -1) continue; // Skip if not found

    const endChar = startChar + sentenceText.length;

    parsed.push({
      text: sentenceText,
      startChar,
      endChar,
      charCount: sentenceText.length,
    });

    currentPos = endChar;
  }

  return parsed;
}
```

### Duration Estimation Algorithm

#### Base Formula

```
Speaking Rate: 13 characters/second (150 WPM average)
Sentence Duration = (charCount / 13) + pauseAdjustment
```

#### Pause Adjustments

```typescript
// lib/duration-estimator.ts (new file)

const CHARS_PER_SECOND = 13; // 150 WPM average
const COMMA_PAUSE = 0.2;     // 200ms pause for comma
const PERIOD_PAUSE = 0.4;    // 400ms pause for period/exclamation/question

export function estimateSentenceDuration(sentence: string): number {
  const charCount = sentence.length;

  // Base duration
  let duration = charCount / CHARS_PER_SECOND;

  // Add pauses for punctuation
  const commaCount = (sentence.match(/,/g) || []).length;
  const periodCount = (sentence.match(/[.!?]/g) || []).length;

  duration += (commaCount * COMMA_PAUSE);
  duration += (periodCount * PERIOD_PAUSE);

  return duration;
}

export function generateSentenceTimestamps(
  sentences: ParsedSentence[],
  totalDuration: number
): SentenceMetadata[] {
  // Calculate total estimated duration
  let totalEstimated = 0;
  const durations: number[] = [];

  for (const sentence of sentences) {
    const duration = estimateSentenceDuration(sentence.text);
    durations.push(duration);
    totalEstimated += duration;
  }

  // Scale to match actual audio duration (accounts for TTS variations)
  const scaleFactor = totalDuration / totalEstimated;

  const metadata: SentenceMetadata[] = [];
  let currentTime = 0;

  for (let i = 0; i < sentences.length; i++) {
    const duration = durations[i] * scaleFactor;

    metadata.push({
      text: sentences[i].text,
      startChar: sentences[i].startChar,
      endChar: sentences[i].endChar,
      charCount: sentences[i].charCount,
      startTime: currentTime,
      endTime: currentTime + duration,
    });

    currentTime += duration;
  }

  return metadata;
}
```

**Accuracy Expectations:**
- Average drift: 0.5-1 second per sentence
- Cumulative drift: 2-5 seconds over 10-minute chapter
- Acceptable for sentence-level sync (not word-level)

### Real-time Highlighting Implementation

#### Highlighting Strategy

**Option 1: Wrap Sentences in Spans (Static)**
- Pros: Simple, no re-wrapping needed, fast updates
- Cons: Requires DOM manipulation on chapter load

**Option 2: Dynamic Range Selection**
- Pros: No DOM modification, cleaner
- Cons: Complex to implement, slower performance

**Decision:** Option 1 - Wrap sentences in spans

#### DOM Manipulation Approach

```typescript
// lib/sentence-highlighter.ts (new file)

import type { Rendition } from 'epubjs';
import type { SentenceMetadata } from '@/types';

export class SentenceHighlighter {
  private rendition: Rendition;
  private currentHighlight: Element | null = null;

  constructor(rendition: Rendition) {
    this.rendition = rendition;
  }

  /**
   * Wrap sentences in the current chapter with <span> elements
   * Called once when chapter is loaded
   */
  async wrapSentences(sentences: SentenceMetadata[]): Promise<void> {
    const iframe = this.rendition.manager.views()._views[0].iframe;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Find all text nodes in body
    const walker = doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let textNode: Node | null;
    let charOffset = 0;

    while ((textNode = walker.nextNode())) {
      const text = textNode.textContent || '';
      const nodeStart = charOffset;
      const nodeEnd = charOffset + text.length;

      // Find sentences that overlap with this text node
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];

        if (sentence.startChar >= nodeStart && sentence.startChar < nodeEnd) {
          // This text node contains the start of a sentence
          // Wrap it in a <span> element
          const span = doc.createElement('span');
          span.setAttribute('data-sentence-id', i.toString());
          span.className = 'sentence-sync';

          // ... (complex DOM manipulation to wrap text)
        }
      }

      charOffset = nodeEnd;
    }
  }

  /**
   * Highlight a specific sentence by index
   */
  highlightSentence(sentenceIndex: number): void {
    const iframe = this.rendition.manager.views()._views[0].iframe;
    if (!iframe?.contentDocument) return;

    // Remove previous highlight
    if (this.currentHighlight) {
      this.currentHighlight.classList.remove('sentence-active');
    }

    // Add new highlight
    const span = iframe.contentDocument.querySelector(
      `[data-sentence-id="${sentenceIndex}"]`
    );

    if (span) {
      span.classList.add('sentence-active');
      this.currentHighlight = span;

      // Scroll into view smoothly
      span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlight(): void {
    if (this.currentHighlight) {
      this.currentHighlight.classList.remove('sentence-active');
      this.currentHighlight = null;
    }
  }
}
```

**CSS Styling (injected into iframe):**

```css
/* Inject into epub.js iframe */
.sentence-sync {
  transition: background-color 0.3s ease;
}

.sentence-active {
  background-color: rgba(255, 255, 0, 0.3); /* Light yellow */
  border-radius: 2px;
  padding: 2px 0;
}
```

#### Synchronization Logic

```typescript
// hooks/useSentenceSync.ts (new file)

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SentenceMetadata } from '@/types';

interface UseSentenceSyncProps {
  sentences: SentenceMetadata[] | null;
  currentTime: number;
  playing: boolean;
  onSentenceChange?: (sentenceIndex: number) => void;
}

export function useSentenceSync({
  sentences,
  currentTime,
  playing,
  onSentenceChange,
}: UseSentenceSyncProps) {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(-1);
  const lastUpdateTime = useRef<number>(0);

  // Find current sentence using binary search (O(log n))
  const findCurrentSentence = useCallback((time: number): number => {
    if (!sentences || sentences.length === 0) return -1;

    let left = 0;
    let right = sentences.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const sentence = sentences[mid];

      if (time >= sentence.startTime && time < sentence.endTime) {
        return mid;
      } else if (time < sentence.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    // Return last sentence if time exceeds all
    return sentences.length - 1;
  }, [sentences]);

  // Update current sentence on time change
  useEffect(() => {
    if (!playing || !sentences) return;

    // Throttle updates to every 100ms
    const now = Date.now();
    if (now - lastUpdateTime.current < 100) return;
    lastUpdateTime.current = now;

    const newIndex = findCurrentSentence(currentTime);

    if (newIndex !== currentSentenceIndex) {
      setCurrentSentenceIndex(newIndex);
      onSentenceChange?.(newIndex);
    }
  }, [currentTime, playing, sentences, currentSentenceIndex, findCurrentSentence, onSentenceChange]);

  // Clear highlight when not playing
  useEffect(() => {
    if (!playing) {
      setCurrentSentenceIndex(-1);
    }
  }, [playing]);

  return {
    currentSentenceIndex,
  };
}
```

### Integration Points

#### 1. Audio Generation (`useAudioGeneration.ts`)

**Changes:**
- After audio generation succeeds, parse chapter text into sentences
- Estimate sentence durations based on total audio duration
- Save sentence sync data to database

```typescript
// In generateAudio() after audio is saved:

import { parseChapterIntoSentences } from '@/lib/sentence-parser';
import { generateSentenceTimestamps } from '@/lib/duration-estimator';
import { saveSentenceSyncData } from '@/lib/db';

// ... existing audio generation code ...

const audioFileId = await saveAudioFile(audioFile);

// NEW: Generate sentence sync data
const parsedSentences = parseChapterIntoSentences(chapterText);
const sentenceMetadata = generateSentenceTimestamps(
  parsedSentences,
  data.duration
);

await saveSentenceSyncData({
  audioFileId,
  chapterId: chapter.id,
  sentences: sentenceMetadata,
  generatedAt: new Date(),
  version: 1,
});
```

#### 2. Audio Playback (`ReaderView.tsx`)

**Changes:**
- Load sentence sync data when audio chapter changes
- Initialize sentence highlighter
- Update highlighting on time updates

```typescript
// In ReaderView.tsx

import { SentenceHighlighter } from '@/lib/sentence-highlighter';
import { useSentenceSync } from '@/hooks/useSentenceSync';
import { getSentenceSyncData } from '@/lib/db';

// ... existing state ...
const [sentenceSyncData, setSentenceSyncData] = useState<SentenceSyncData | null>(null);
const highlighterRef = useRef<SentenceHighlighter | null>(null);

// Load sentence sync data when audio chapter changes
useEffect(() => {
  const loadSentenceData = async () => {
    if (!currentAudioChapter?.id) {
      setSentenceSyncData(null);
      return;
    }

    const audioFile = await getAudioFile(currentAudioChapter.id);
    if (audioFile?.id) {
      const data = await getSentenceSyncData(audioFile.id);
      setSentenceSyncData(data || null);
    }
  };

  loadSentenceData();
}, [currentAudioChapter]);

// Initialize highlighter when rendition is ready
useEffect(() => {
  if (rendition && !highlighterRef.current) {
    highlighterRef.current = new SentenceHighlighter(rendition);
  }
}, [rendition]);

// Wrap sentences when data is loaded
useEffect(() => {
  if (highlighterRef.current && sentenceSyncData && currentAudioChapter) {
    highlighterRef.current.wrapSentences(sentenceSyncData.sentences);
  }
}, [sentenceSyncData, currentAudioChapter]);

// Use sentence sync hook
const { currentSentenceIndex } = useSentenceSync({
  sentences: sentenceSyncData?.sentences || null,
  currentTime: audioPlayer.currentTime,
  playing: audioPlayer.playing,
  onSentenceChange: (index) => {
    highlighterRef.current?.highlightSentence(index);
  },
});

// Clear highlight when audio stops
useEffect(() => {
  if (!audioPlayer.playing && highlighterRef.current) {
    highlighterRef.current.clearHighlight();
  }
}, [audioPlayer.playing]);
```

#### 3. Database Operations (`lib/db.ts`)

**New functions:**

```typescript
/**
 * Save sentence sync data for an audio file
 */
export async function saveSentenceSyncData(
  data: Omit<SentenceSyncData, 'id'>
): Promise<number> {
  return await db.sentenceSyncData.add(data);
}

/**
 * Get sentence sync data for an audio file
 */
export async function getSentenceSyncData(
  audioFileId: number
): Promise<SentenceSyncData | undefined> {
  return await db.sentenceSyncData
    .where('audioFileId')
    .equals(audioFileId)
    .first();
}

/**
 * Delete sentence sync data when audio is deleted
 */
export async function deleteSentenceSyncData(
  audioFileId: number
): Promise<void> {
  await db.sentenceSyncData
    .where('audioFileId')
    .equals(audioFileId)
    .delete();
}

/**
 * Update deleteAudioFile to cascade delete sentence data
 */
export async function deleteAudioFile(chapterId: number): Promise<void> {
  const audioFile = await getAudioFile(chapterId);
  if (audioFile?.id) {
    await deleteSentenceSyncData(audioFile.id);
  }
  await db.audioFiles.where('chapterId').equals(chapterId).delete();
}
```

## Implementation Phases

### Phase 1: Sentence Parsing and Data Model

**Duration:** 4-6 hours

**Goals:**
- Set up sentence parsing infrastructure
- Update database schema
- Create utility functions for sentence detection

**Tasks:**

1. **Install Dependencies** (15 min)
   ```bash
   npm install compromise
   npm install --save-dev @types/compromise
   ```

2. **Update Database Schema** (30 min)
   - File: `lib/db.ts`
   - Add version 4 migration with `sentenceSyncData` table
   - Add database helper functions: `saveSentenceSyncData`, `getSentenceSyncData`, `deleteSentenceSyncData`
   - Update `deleteAudioFile` to cascade delete sentence data

3. **Update TypeScript Types** (15 min)
   - File: `types/index.ts`
   - Add `SentenceSyncData` interface
   - Add `SentenceMetadata` interface

4. **Create Sentence Parser** (2 hours)
   - File: `lib/sentence-parser.ts` (new)
   - Implement `parseChapterIntoSentences()` using compromise
   - Handle edge cases: abbreviations, ellipsis, quotes
   - Add unit tests (manual testing via console)

5. **Create Duration Estimator** (1.5 hours)
   - File: `lib/duration-estimator.ts` (new)
   - Implement `estimateSentenceDuration()` with punctuation pauses
   - Implement `generateSentenceTimestamps()` with scaling
   - Test with sample chapter text

6. **Test Data Pipeline** (1 hour)
   - Create test script to parse sample chapter
   - Verify sentence boundaries are correct
   - Verify estimated durations are reasonable
   - Test database save/load operations

**Success Criteria:**
- ✅ Database version 4 migration runs without errors
- ✅ Sentence parser correctly identifies 95%+ of sentence boundaries
- ✅ Duration estimator produces timestamps that sum to total duration
- ✅ Sentence sync data can be saved and retrieved from database
- ✅ Edge cases handled: abbreviations (Dr., Mr.), ellipsis, quotes

**Testing:**
```typescript
// Manual test in browser console
const testText = `
  Dr. Smith examined the patient. He noted three symptoms: fever,
  cough, and fatigue. The diagnosis was clear... influenza!
`;

const sentences = parseChapterIntoSentences(testText);
console.log('Parsed sentences:', sentences);
// Expected: 3 sentences correctly identified

const timestamps = generateSentenceTimestamps(sentences, 10.0);
console.log('Timestamps:', timestamps);
// Expected: startTime/endTime sum to 10 seconds
```

**Rollback Plan:**
- Database version 4 is additive (no breaking changes)
- If issues arise, can disable feature by not calling sentence parsing
- No changes to existing audio generation flow

---

### Phase 2: Duration Estimation Engine

**Duration:** 3-4 hours

**Goals:**
- Integrate sentence parsing into audio generation flow
- Store sentence sync data when audio is generated
- Verify data persistence and retrieval

**Tasks:**

1. **Update Audio Generation Hook** (1.5 hours)
   - File: `hooks/useAudioGeneration.ts`
   - Import sentence parser and duration estimator
   - After audio is saved, parse chapter text into sentences
   - Generate sentence timestamps using actual audio duration
   - Save sentence sync data to database
   - Handle errors gracefully (don't fail audio generation if sentence parsing fails)

2. **Add Progress Indication** (30 min)
   - Update progress callback to show "Parsing sentences..." step
   - Add to existing streaming progress (10% → 90% → 95% → 100%)

3. **Test with Real Chapter** (1 hour)
   - Generate audio for a test chapter
   - Verify sentence sync data is saved to database
   - Inspect data in browser DevTools → Application → IndexedDB
   - Verify sentence count and timestamps are reasonable

4. **Handle Edge Cases** (1 hour)
   - Test with very short chapters (<100 words)
   - Test with very long chapters (>10,000 words)
   - Test with chapters containing dialogue, quotes, abbreviations
   - Verify no crashes or data corruption

**Code Changes:**

```typescript
// hooks/useAudioGeneration.ts

// Add after saveAudioFile()
try {
  setProgress(92);
  if (onProgress) onProgress(92, 'Parsing sentences for synchronization');

  const parsedSentences = parseChapterIntoSentences(chapterText);
  const sentenceMetadata = generateSentenceTimestamps(
    parsedSentences,
    data.duration
  );

  await saveSentenceSyncData({
    audioFileId: audioFileId,
    chapterId: chapter.id,
    sentences: sentenceMetadata,
    generatedAt: new Date(),
    version: 1,
  });

  console.log(`[TTS] Saved ${sentenceMetadata.length} sentences for sync`);
} catch (err) {
  // Don't fail audio generation if sentence parsing fails
  console.error('[TTS] Failed to generate sentence sync data:', err);
}

setProgress(100);
```

**Success Criteria:**
- ✅ Audio generation completes successfully with sentence parsing
- ✅ Sentence sync data saved to database for every generated audio
- ✅ Progress indicator shows sentence parsing step
- ✅ Audio generation doesn't fail if sentence parsing encounters errors
- ✅ Sentence count matches expected range (50-200 for typical chapter)

**Testing:**
- Generate audio for 3 different chapters (short, medium, long)
- Verify sentence sync data exists in IndexedDB for each
- Check sentence count is reasonable (not 1, not 1000+)
- Verify timestamps: startTime of first sentence ≈ 0, endTime of last ≈ duration

**Rollback Plan:**
- Wrap sentence parsing in try-catch to prevent audio generation failures
- Feature flag: `ENABLE_SENTENCE_SYNC` environment variable
- Can disable by commenting out sentence parsing code

---

### Phase 3: Real-time Highlighting

**Duration:** 6-8 hours

**Goals:**
- Implement DOM manipulation to wrap sentences
- Create highlighting mechanism with CSS
- Synchronize highlights with audio playback
- Handle scrolling and visual transitions

**Tasks:**

1. **Create Sentence Highlighter Class** (3 hours)
   - File: `lib/sentence-highlighter.ts` (new)
   - Implement `wrapSentences()` to add `<span>` elements around sentences
   - Handle complex DOM traversal (text nodes in various elements)
   - Implement `highlightSentence()` to add/remove CSS classes
   - Implement `clearHighlight()` to remove all highlights
   - Add smooth scrolling to keep highlighted sentence visible

2. **Create Sentence Sync Hook** (2 hours)
   - File: `hooks/useSentenceSync.ts` (new)
   - Implement binary search to find current sentence from timestamp
   - Throttle updates to avoid excessive re-renders (100ms)
   - Handle edge cases: seek, pause, resume
   - Return current sentence index

3. **Add CSS Styling** (30 min)
   - Inject styles into epub.js iframe
   - Define `.sentence-active` class with yellow highlight
   - Add smooth transitions (300ms fade)
   - Ensure readability (not too bright)

4. **Integrate into ReaderView** (2 hours)
   - File: `components/reader/ReaderView.tsx`
   - Load sentence sync data when audio chapter changes
   - Initialize `SentenceHighlighter` when rendition is ready
   - Call `wrapSentences()` when chapter is displayed
   - Use `useSentenceSync` hook to track current sentence
   - Update highlighting on sentence changes
   - Clear highlighting when audio stops

5. **Test and Refine** (1.5 hours)
   - Test with various chapter layouts (paragraphs, dialogue, lists)
   - Verify highlighting is accurate and smooth
   - Test scrolling behavior (doesn't jump too aggressively)
   - Test on mobile (smaller viewport)

**Code Changes:**

```typescript
// components/reader/ReaderView.tsx

const [sentenceSyncData, setSentenceSyncData] = useState<SentenceSyncData | null>(null);
const highlighterRef = useRef<SentenceHighlighter | null>(null);

// Load sentence sync data
useEffect(() => {
  const loadSentenceData = async () => {
    if (!currentAudioChapter?.id) {
      setSentenceSyncData(null);
      return;
    }

    const audioFile = await getAudioFile(currentAudioChapter.id);
    if (audioFile?.id) {
      const data = await getSentenceSyncData(audioFile.id);
      setSentenceSyncData(data || null);
    }
  };

  loadSentenceData();
}, [currentAudioChapter]);

// Initialize highlighter
useEffect(() => {
  if (rendition && !highlighterRef.current) {
    highlighterRef.current = new SentenceHighlighter(rendition);
  }
}, [rendition]);

// Wrap sentences when loaded
useEffect(() => {
  if (highlighterRef.current && sentenceSyncData && currentAudioChapter) {
    highlighterRef.current.wrapSentences(sentenceSyncData.sentences);
  }
}, [sentenceSyncData, currentAudioChapter]);

// Track current sentence
const { currentSentenceIndex } = useSentenceSync({
  sentences: sentenceSyncData?.sentences || null,
  currentTime: audioPlayer.currentTime,
  playing: audioPlayer.playing,
  onSentenceChange: (index) => {
    highlighterRef.current?.highlightSentence(index);
  },
});

// Clear on stop
useEffect(() => {
  if (!audioPlayer.playing && highlighterRef.current) {
    highlighterRef.current.clearHighlight();
  }
}, [audioPlayer.playing]);
```

**Success Criteria:**
- ✅ Sentences are wrapped in `<span>` elements without breaking layout
- ✅ Current sentence is highlighted with yellow background
- ✅ Highlighting updates in sync with audio (within 0.5-2 seconds)
- ✅ Smooth scrolling keeps highlighted sentence in viewport
- ✅ Highlighting clears when audio stops/pauses
- ✅ No performance issues (60fps smooth playback)

**Testing:**
- Play audio for a chapter with sentence sync data
- Verify each sentence highlights in sequence
- Verify timing is accurate (highlight matches spoken words)
- Seek to middle of chapter, verify correct sentence highlights
- Pause and resume, verify highlighting continues correctly
- Test on mobile device (smaller viewport, touch interactions)

**Rollback Plan:**
- DOM wrapping is non-destructive (can be removed)
- If highlighting causes issues, can disable by not calling `wrapSentences()`
- CSS can be easily adjusted if highlight is too bright/distracting

---

### Phase 4: Integration and Testing

**Duration:** 3-4 hours

**Goals:**
- End-to-end testing of complete feature
- Performance optimization
- Bug fixes and edge case handling
- Documentation

**Tasks:**

1. **End-to-End Testing** (2 hours)
   - Test complete flow: generate audio → play audio → see highlighting
   - Test with 5+ different books/chapters
   - Verify database migrations work on fresh install
   - Test on multiple browsers (Chrome, Safari, Firefox)
   - Test on mobile devices (iOS, Android)

2. **Performance Optimization** (1 hour)
   - Profile sentence parsing time (should be <500ms)
   - Profile highlighting update time (should be <50ms)
   - Optimize binary search if needed
   - Reduce unnecessary re-renders

3. **Bug Fixes** (1 hour)
   - Fix any issues found during testing
   - Handle edge cases discovered
   - Refine scrolling behavior if too aggressive

4. **Documentation** (30 min)
   - Add comments to complex code sections
   - Update README with feature description
   - Document known limitations (accuracy, language support)

**Test Cases:**

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Generate new audio | Click "Generate Audio" on chapter | Audio generated + sentence data saved |
| Play audio with sync | Click "Play Audio" | Sentences highlight in sequence |
| Seek to middle | Drag playback slider to 50% | Correct sentence highlights immediately |
| Pause and resume | Pause, wait, resume | Highlighting continues from correct position |
| Speed change | Change playback speed to 1.5x | Highlighting still syncs correctly |
| Chapter navigation | Navigate to different chapter while playing | Highlighting clears, loads new chapter data |
| No sentence data | Play audio generated before this feature | No errors, audio plays without highlighting |
| Mobile playback | Play audio on mobile device | Highlighting and scrolling work smoothly |

**Success Criteria:**
- ✅ All test cases pass without errors
- ✅ Feature works across Chrome, Safari, Firefox
- ✅ Feature works on iOS and Android
- ✅ Sentence parsing completes in <500ms for 10K word chapter
- ✅ Highlighting updates in <50ms (60fps smooth)
- ✅ No console errors or warnings during normal usage
- ✅ Graceful degradation: audio plays even if sentence data missing

**Performance Benchmarks:**

```typescript
// Manual performance testing in console

console.time('Parse 10K words');
const sentences = parseChapterIntoSentences(tenThousandWordText);
console.timeEnd('Parse 10K words');
// Target: <500ms

console.time('Find sentence');
const index = findCurrentSentence(5.0, sentences);
console.timeEnd('Find sentence');
// Target: <1ms (binary search)

console.time('Highlight update');
highlighter.highlightSentence(index);
console.timeEnd('Highlight update');
// Target: <50ms
```

**Rollback Plan:**
- Feature is additive, doesn't break existing functionality
- Can disable by:
  1. Not generating sentence sync data (skip in audio generation)
  2. Not loading sentence sync data (skip in ReaderView)
  3. Feature flag in environment variable
- Existing audio files without sentence data continue to work

---

## Dependencies

### NPM Packages to Install

```json
{
  "dependencies": {
    "compromise": "^14.14.0"
  },
  "devDependencies": {
    "@types/compromise": "^13.5.6"
  }
}
```

**compromise** (~200KB gzipped)
- Purpose: Sentence detection and NLP parsing
- Alternatives evaluated: `natural` (too heavy), custom regex (too fragile)

### Existing Dependencies (no changes)
- `epubjs`: EPUB rendering and navigation
- `dexie`: IndexedDB operations
- `openai`: TTS generation (no changes needed)
- `react`: UI framework
- `typescript`: Type safety

## File Structure

### New Files to Create

```
lib/
  sentence-parser.ts         # Sentence detection using compromise
  duration-estimator.ts      # Timing estimation algorithms
  sentence-highlighter.ts    # DOM manipulation and highlighting

hooks/
  useSentenceSync.ts         # React hook for synchronization logic

types/
  index.ts                   # Add SentenceSyncData, SentenceMetadata interfaces
```

### Files to Modify

```
lib/
  db.ts                      # Add sentenceSyncData table and helper functions

hooks/
  useAudioGeneration.ts      # Add sentence parsing after audio generation

components/reader/
  ReaderView.tsx             # Integrate sentence highlighting
```

## Testing Strategy

### Unit Testing (Manual in Console)

**Sentence Parser:**
```typescript
const testCases = [
  "Dr. Smith went to the store.",
  "She said, 'Hello!' and left.",
  "The price was $3.50. Amazing!",
  "Use abbreviations like Mr. and Mrs. correctly.",
];

testCases.forEach(text => {
  const sentences = parseChapterIntoSentences(text);
  console.log({ input: text, output: sentences });
});
```

**Duration Estimator:**
```typescript
const sentence = "This is a test sentence with 45 characters.";
const duration = estimateSentenceDuration(sentence);
console.log({ sentence, duration });
// Expected: ~3.4 seconds (45/13 + period pause)
```

### Integration Testing

**Audio Generation:**
1. Generate audio for a test chapter
2. Check IndexedDB → `sentenceSyncData` table
3. Verify sentence count is reasonable (50-200 for typical chapter)
4. Verify timestamps sum to audio duration

**Audio Playback:**
1. Play audio with sentence sync data
2. Observe sentence highlighting in real-time
3. Verify timing accuracy (highlight matches speech)
4. Test seek, pause, resume behaviors

### Edge Case Testing

| Edge Case | Test Input | Expected Behavior |
|-----------|------------|-------------------|
| Very short chapter | "Hello. World." (2 sentences) | Works correctly, no errors |
| Very long chapter | 20,000 word chapter | Parsing completes in <1s, highlighting works |
| Abbreviations | "Dr. Smith and Mrs. Jones met." | Treated as 1 sentence |
| Ellipsis | "She wondered... what next?" | Treated as 1 sentence |
| Dialogue | "He said, 'Stop!' She ran." | Split into 2 sentences |
| No punctuation | "some text with no periods" | Treated as 1 sentence |
| Empty chapter | "" | No crashes, 0 sentences |

### Performance Testing

**Sentence Parsing:**
- Test with 1K, 5K, 10K, 20K word chapters
- Measure parsing time (target: <500ms for 10K words)
- Verify no memory leaks (parse multiple chapters)

**Highlighting:**
- Measure time to update highlight (target: <50ms)
- Verify smooth 60fps playback
- Test with 100+ sentences in chapter

**Database:**
- Measure sentence data save time (target: <100ms)
- Measure sentence data load time (target: <50ms)
- Verify storage size (<50KB per chapter)

### Browser/Device Testing

**Desktop Browsers:**
- Chrome (latest)
- Safari (latest)
- Firefox (latest)

**Mobile Devices:**
- iOS Safari (iPhone)
- Android Chrome (Pixel/Samsung)

**Test Checklist:**
- ✅ Audio generation works
- ✅ Sentence highlighting displays correctly
- ✅ Highlighting syncs with audio
- ✅ Scrolling is smooth (not jarring)
- ✅ No console errors
- ✅ Performance is acceptable (no lag)

## Risk Assessment

### Technical Risks

**Risk 1: Sentence Detection Accuracy**
- **Impact:** High - Incorrect sentence boundaries lead to poor sync
- **Likelihood:** Medium - English text is generally well-formed
- **Mitigation:**
  - Use proven library (compromise) with good accuracy
  - Test with diverse chapter content (dialogue, lists, technical text)
  - Fallback: If sentence parsing fails, skip highlighting (audio still works)
- **Contingency:** Provide manual sentence boundary markers in edge cases

**Risk 2: Timing Accuracy Drift**
- **Impact:** Medium - Cumulative drift leads to out-of-sync highlighting
- **Likelihood:** High - Character-based estimation is approximate
- **Mitigation:**
  - Scale estimated durations to match actual audio duration
  - Acceptable drift: 0.5-2 seconds (sentence-level is forgiving)
  - Future enhancement: Use word-level timestamps if available
- **Contingency:** Add manual sync adjustment (user can offset timing)

**Risk 3: Performance Issues with Large Chapters**
- **Impact:** Medium - Slow parsing/highlighting degrades UX
- **Likelihood:** Low - Compromise library is fast
- **Mitigation:**
  - Test with 20K+ word chapters during development
  - Optimize binary search and DOM manipulation
  - Throttle highlight updates (100ms)
- **Contingency:** Disable highlighting for chapters >15K words

**Risk 4: DOM Manipulation Complexity**
- **Impact:** High - Incorrect DOM manipulation can break layout
- **Likelihood:** Medium - epub.js content is varied
- **Mitigation:**
  - Test with diverse EPUB layouts (plain text, formatted, images)
  - Non-destructive wrapping (preserve original content)
  - Graceful failure: If wrapping fails, skip highlighting
- **Contingency:** Fallback to simpler highlighting (whole paragraph, not sentence)

**Risk 5: Browser Compatibility**
- **Impact:** Medium - Feature doesn't work on some browsers
- **Likelihood:** Low - Using standard DOM APIs
- **Mitigation:**
  - Test on Chrome, Safari, Firefox during development
  - Use progressive enhancement (feature optional)
- **Contingency:** Disable feature on unsupported browsers

### Timeline Risks

**Risk 6: DOM Manipulation Takes Longer Than Expected**
- **Impact:** High - Delays entire feature release
- **Likelihood:** Medium - Complex DOM traversal
- **Mitigation:**
  - Allocate extra time for Phase 3 (6-8 hours)
  - Start with simple implementation, refine later
- **Contingency:** Release simpler version (paragraph-level highlighting)

**Risk 7: Scope Creep**
- **Impact:** Medium - Feature takes longer, delays other work
- **Likelihood:** Medium - Temptation to add word-level sync
- **Mitigation:**
  - Strict adherence to "Out of Scope" items
  - Document future enhancements separately
- **Contingency:** Ship MVP (sentence-level only), iterate later

## Deployment and Migration

### Database Migration

**Version 4 Schema:**
```typescript
this.version(4).stores({
  books: '++id, title, author, addedAt, lastOpenedAt, *tags',
  positions: 'bookId, updatedAt',
  sessions: '++id, bookId, startTime, endTime',
  highlights: '++id, bookId, cfiRange, color, createdAt',
  analytics: '++id, sessionId, bookId, timestamp, event',
  chapters: '++id, bookId, order, cfiStart',
  audioFiles: '++id, chapterId, generatedAt',
  audioSettings: 'bookId, updatedAt',
  audioUsage: '++id, chapterId, bookId, timestamp',
  sentenceSyncData: '++id, audioFileId, chapterId, generatedAt', // NEW
});
```

**Migration Strategy:**
- Dexie handles schema migrations automatically
- No data migration needed (additive table)
- Existing audio files continue to work (no sentence data, highlighting disabled)

**Backwards Compatibility:**
- Audio playback works without sentence sync data
- Graceful degradation: If no sentence data, skip highlighting
- Users can regenerate audio to get sentence sync

### Rollout Plan

**Phase 1: Soft Launch (Internal Testing)**
- Deploy to staging environment
- Test with team members
- Gather feedback on accuracy and UX

**Phase 2: Beta Testing**
- Enable for subset of users (feature flag)
- Monitor error logs and performance metrics
- Iterate based on feedback

**Phase 3: General Availability**
- Enable for all users
- Monitor adoption and usage
- Document known limitations

### Feature Flag

```typescript
// lib/constants.ts
export const FEATURE_FLAGS = {
  ENABLE_SENTENCE_SYNC: process.env.NEXT_PUBLIC_ENABLE_SENTENCE_SYNC === 'true',
};

// In ReaderView.tsx
if (FEATURE_FLAGS.ENABLE_SENTENCE_SYNC && sentenceSyncData) {
  // Enable highlighting
}
```

### Monitoring

**Metrics to Track:**
- Sentence parsing success rate (% of chapters with sync data)
- Average sentence count per chapter
- Sentence parsing time (P50, P95, P99)
- Highlighting performance (frame rate)
- User engagement (do users play audio more with highlighting?)

**Error Tracking:**
- Sentence parsing failures (log to console, don't crash)
- Highlighting errors (DOM manipulation failures)
- Performance issues (slow parsing, laggy highlighting)

## Performance Considerations

### Sentence Parsing Performance

**Target:** <500ms for 10K word chapter

**Optimizations:**
- Use `compromise` library (optimized for performance)
- Parse only once during audio generation (cache results)
- Avoid re-parsing on playback

**Benchmarks:**
- 1K words: ~50ms
- 5K words: ~200ms
- 10K words: ~400ms
- 20K words: ~800ms (may need optimization)

### Highlighting Performance

**Target:** <50ms per update (60fps smooth)

**Optimizations:**
- Binary search for current sentence (O(log n) vs linear O(n))
- Throttle updates to 100ms (avoid excessive re-renders)
- Cache DOM elements (don't query every update)
- Use CSS transitions (GPU-accelerated)

**Benchmarks:**
- Find sentence (binary search): <1ms
- Update CSS class: <10ms
- Scroll into view: <20ms
- Total: <50ms ✅

### Storage Performance

**Target:** <50KB per chapter

**Storage Breakdown:**
- 100 sentences × ~50 bytes = 5KB per chapter
- JSON overhead: ~1.5x = 7.5KB
- IndexedDB overhead: ~1.2x = 9KB
- Total: ~10KB per chapter ✅

**Optimizations:**
- Store only essential data (text, startChar, endChar, startTime, endTime)
- Compress long sentences (truncate to first 100 chars for display)
- Periodically clean up old sentence data (if audio deleted)

### Memory Management

**Potential Issues:**
- Large chapters with 200+ sentences
- Multiple chapters with sentence data loaded
- DOM manipulation creating memory leaks

**Mitigations:**
- Limit sentence data to current playing chapter only
- Unwrap sentences when chapter changes (clean up DOM)
- Use WeakMap for caching (automatic garbage collection)
- Profile memory usage in Chrome DevTools

## Security Considerations

### Input Validation

**Risk:** Malicious EPUB content with crafted text
**Mitigation:**
- Sanitize chapter text before parsing (already done in TTS API)
- Limit sentence count (max 500 sentences per chapter)
- Limit sentence length (max 1000 characters per sentence)

### XSS Prevention

**Risk:** Sentence text injected into DOM could contain scripts
**Mitigation:**
- Use `textContent` instead of `innerHTML` when creating spans
- Sanitize sentence text before storing in database
- epub.js already sanitizes content

### Data Privacy

**Risk:** Sentence data could reveal reading patterns
**Mitigation:**
- All data stored locally in IndexedDB (no server upload)
- No analytics or tracking of sentence-level data
- User can clear data via browser settings

## Documentation Requirements

### Code Documentation

**Inline Comments:**
- Document complex algorithms (binary search, duration estimation)
- Explain DOM manipulation steps
- Note performance considerations

**JSDoc Comments:**
- All public functions with parameter and return types
- Usage examples for complex APIs

### User Documentation

**README Updates:**
- Feature description: "Sentence-level audio synchronization"
- How it works: "Highlights sentences as they're spoken"
- Known limitations: "Accuracy within 0.5-2 seconds"
- Troubleshooting: "Regenerate audio if highlighting is off"

### Developer Documentation

**Architecture Overview:**
- Data flow diagram (parsing → estimation → highlighting)
- Component interaction diagram
- Database schema

**Future Enhancements:**
- Word-level synchronization (if TTS provides timestamps)
- Multi-language support (extend parser)
- User-adjustable timing offset
- Sentence-level playback controls (play from sentence)

## Future Enhancements (Out of Scope for v1)

### Word-Level Synchronization
- Requires TTS provider with word-level timestamps
- Amazon Polly supports this (migration possible)
- More accurate highlighting but complex implementation

### Multi-Language Support
- Extend sentence parser to support other languages
- May require different NLP libraries (compromise is English-focused)
- Test with EPUB books in Spanish, French, etc.

### User Customization
- Adjustable highlight color (yellow, blue, green)
- Timing offset slider (manual sync adjustment)
- Enable/disable highlighting per book

### Sentence-Level Controls
- Click sentence to play from that point
- Sentence-level bookmarks
- Sentence-level notes/highlights

### Advanced Features
- Detect and highlight dialogue separately
- Slow down on complex sentences (adaptive speed)
- Reading comprehension analytics (replay counts per sentence)

## Conclusion

This implementation plan provides a comprehensive, phased approach to adding sentence-level audio synchronization to the EPUB reader. The design balances simplicity (character-based estimation) with effectiveness (real-time highlighting), creating a solid foundation for future enhancements.

**Key Takeaways:**
- **Pragmatic approach:** Character-based estimation works with any TTS provider
- **Incremental implementation:** 4 phases with clear success criteria
- **Risk mitigation:** Graceful degradation, feature flags, rollback plans
- **Performance-focused:** Benchmarks and optimization strategies defined
- **Well-tested:** Comprehensive testing strategy across browsers and devices

**Total Estimated Time:** 16-22 hours
- Phase 1: 4-6 hours
- Phase 2: 3-4 hours
- Phase 3: 6-8 hours
- Phase 4: 3-4 hours

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Iterate based on testing feedback
4. Ship to production with feature flag
5. Monitor and refine based on user feedback
