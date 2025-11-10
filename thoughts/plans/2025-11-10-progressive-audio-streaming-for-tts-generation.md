---
doc_type: plan
date: 2025-11-10T17:05:20+00:00
title: "Progressive Audio Streaming for TTS Generation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T17:05:20+00:00"
feature: "progressive-audio-streaming"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Database Schema & Chunk Storage"
    status: completed
    completed_date: 2025-11-10
  - name: "Phase 2: API Streaming & Client Reception"
    status: completed
    completed_date: 2025-11-10
  - name: "Phase 3: Progressive Audio Player"
    status: completed
    completed_date: 2025-11-10
  - name: "Phase 4: UI Integration & Polish"
    status: pending

git_commit: fa4dda98f599252e5116b5e3078582965f97393a
branch: feature/progressive-audio-streaming
repository: reader

created_by: Sean Kim
last_updated: 2025-11-10
last_updated_by: Claude Code
last_updated_note: "Phase 3 completed - Progressive audio player with Web Audio API gapless playback implemented"

tags:
  - tts
  - audio
  - streaming
  - progressive-loading
  - web-audio-api
status: draft

related_docs:
  - thoughts/research/2025-11-10-progressive-audio-streaming-for-tts-generation.md
  - thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md
---

# Implementation Plan: Progressive Audio Streaming for TTS Generation

**Date**: 2025-11-10
**Author**: Sean Kim
**Status**: Draft
**Related Research**: `thoughts/research/2025-11-10-progressive-audio-streaming-for-tts-generation.md`

---

## Executive Summary

### Problem Statement

Currently, users must wait until 100% of a chapter's TTS audio is generated (often 60+ seconds for long chapters) before they can start listening. The server generates audio in 4096-character chunks, concatenates them into a single MP3, and only then returns the complete file to the client. This creates a poor user experience, especially for longer chapters with 5-10 chunks.

### Solution Overview

Implement progressive audio streaming that allows users to start playback as soon as the first chunk is ready (typically within 5-10 seconds), then seamlessly append subsequent chunks as they arrive. This leverages the **Web Audio API** for gapless chunk scheduling and **Server-Sent Events (SSE)** for real-time chunk delivery.

### Success Criteria

- ✅ **Time to First Audio**: < 10 seconds (vs. 60+ seconds currently)
- ✅ **Gapless Playback**: No audible gaps between chunks (< 5ms)
- ✅ **Memory Efficiency**: < 50MB memory usage for 20+ chunk chapters
- ✅ **Universal Browser Support**: Works in Chrome, Firefox, Safari, Edge
- ✅ **Backwards Compatibility**: Existing single-blob playback still works
- ✅ **Progressive Status**: UI shows "Playing chunk 2/5, generating 3/5"

### Key Technical Decisions

1. **Web Audio API** chosen over MediaSource Extensions
   - Works with existing MP3 format (no conversion needed)
   - Universal browser support
   - Gapless playback via scheduled sources
   - Acceptable implementation complexity

2. **Chunk-based storage** in IndexedDB
   - New `audioChunks` table alongside existing `audioFiles`
   - Enables partial playback during generation
   - Supports cancellation and resumption
   - Backwards compatible with single-blob storage

3. **Server-Sent Events (SSE)** for streaming
   - Already implemented in API route
   - Add new `audio_chunk` event type
   - Maintain `result` event for backwards compatibility

---

## Current State Analysis

### Existing Architecture

**Server-Side Generation** (`app/api/tts/generate-stream/route.ts`):

```typescript
// Lines 156-203: Current concatenation flow
const audioBuffers: Buffer[] = [];

for (let i = 0; i < chunks.length; i++) {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: chunks[i],
    response_format: 'mp3',
    speed: validSpeed,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  audioBuffers.push(buffer);  // Collect in array

  // Progress events sent via SSE
}

// Concatenate ALL chunks before returning
const buffer = Buffer.concat(audioBuffers);

sendEvent('result', {
  success: true,
  audioData: buffer.toString('base64'),  // Single large base64
  duration: durationSeconds,
  // ...
});
```

**Key Observation**: Chunks are already generated sequentially and progress is already streamed via SSE. We're just concatenating server-side instead of streaming chunks individually.

**Client-Side Reception** (`hooks/useAudioGeneration.ts`):

```typescript
// Lines 105-148: Wait for complete audio
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Process SSE messages
  if (eventType === 'result') {
    resultData = data;  // Wait for complete audio
  }
}

// Convert complete base64 to single Blob
const audioBlob = base64ToBlob(data.audioData, 'audio/mpeg');
await saveAudioFile({ blob: audioBlob, ... });
```

**Client-Side Playback** (`hooks/useAudioPlayer.ts`):

```typescript
// Lines 98-148: HTML5 Audio with single Blob URL
const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
  const audioFile = await getAudioFile(chapterToLoad.id);

  // Create object URL from complete blob
  const audioUrl = URL.createObjectURL(audioFile.blob);
  audioRef.current.src = audioUrl;
  audioRef.current.load();
}, []);
```

**Storage** (`lib/db.ts`):

```typescript
// Lines 42-43: Single blob per chapter
audioFiles: '++id, chapterId, generatedAt',

// Lines 396-405: Single transaction
export async function saveAudioFile(audioFile: Omit<AudioFile, 'id'>): Promise<number> {
  return await db.audioFiles.add(audioFile);
}
```

### Pain Points

1. **Long Wait Time**: User sees "Generating... 80%" but can't start listening
2. **All-or-Nothing**: Generation cancellation loses all progress
3. **Memory Pressure**: Concatenating large chapters (100KB+ blobs) on server and client
4. **No Resumption**: Can't resume partial generations if interrupted

---

## Requirements Analysis

### Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-1 | Immediate playback after first chunk | MUST | User can play audio within 10 seconds of clicking "Generate" |
| FR-2 | Gapless chunk streaming | MUST | No audible gaps (< 5ms) between chunks during playback |
| FR-3 | Background generation | MUST | Remaining chunks generate while user listens to first chunk |
| FR-4 | Persistent chunk storage | MUST | Chunks saved to IndexedDB for future playback without re-generation |
| FR-5 | Progress indication | MUST | UI shows "Playing chunk 2/5, generating 3/5" |
| FR-6 | Cancellation support | SHOULD | Can cancel mid-generation, chunks generated so far are saved |
| FR-7 | Resumption support | SHOULD | Can resume incomplete generations from last saved chunk |
| FR-8 | Backwards compatibility | MUST | Existing single-blob audio files continue to work |

### Technical Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| TR-1 | Web Audio API integration | MUST | Use AudioContext for gapless chunk scheduling |
| TR-2 | SSE chunk streaming | MUST | Stream chunks individually via Server-Sent Events |
| TR-3 | Chunk-based IndexedDB storage | MUST | New `audioChunks` table with FK to `audioFiles` |
| TR-4 | Memory management | MUST | Sliding window keeps max 3-5 chunks in memory at once |
| TR-5 | Browser compatibility | MUST | Works in Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| TR-6 | Error recovery | SHOULD | Single corrupt chunk doesn't break entire playback |

### Non-Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| NFR-1 | Performance | MUST | No UI stuttering, < 100ms chunk scheduling latency |
| NFR-2 | Memory efficiency | MUST | < 50MB total memory for 20+ chunk chapters |
| NFR-3 | Storage efficiency | SHOULD | IndexedDB operations batched (< 5 transactions per chapter) |
| NFR-4 | Code maintainability | MUST | New hooks isolated, minimal changes to existing code |
| NFR-5 | Testability | SHOULD | Chunk player logic testable in isolation |

### Out of Scope

- ❌ Seeking during generation (will be disabled with message)
- ❌ Adaptive bitrate streaming (single quality MP3)
- ❌ Server-side chunk caching across users (privacy-first design)
- ❌ Real-time audio format conversion (MP3 only)
- ❌ Synchronized multi-device playback

---

## Architecture & Design

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  UI Layer (AudioPlayer.tsx)                             │   │
│  │  - Progress: "Playing chunk 2/5, generating 3/5"       │   │
│  │  - Playback controls (play/pause/speed)                 │   │
│  └──────────────────┬──────────────────────────────────────┘   │
│                     │                                            │
│  ┌─────────────────▼──────────────────────────────────────┐   │
│  │  Generation Hook (useAudioGeneration.ts)               │   │
│  │  - Fetch SSE stream                                     │   │
│  │  - On audio_chunk: saveAudioChunk()                     │   │
│  │  - On first chunk: trigger onFirstChunkReady callback  │   │
│  └──────────────────┬──────────────────────────────────────┘   │
│                     │                                            │
│  ┌─────────────────▼──────────────────────────────────────┐   │
│  │  Progressive Player (useProgressiveAudioPlayer.ts)     │   │
│  │  - Web Audio API scheduling                            │   │
│  │  - Gapless chunk queueing                              │   │
│  │  - Memory management (sliding window)                  │   │
│  └──────────────────┬──────────────────────────────────────┘   │
│                     │                                            │
│  ┌─────────────────▼──────────────────────────────────────┐   │
│  │  IndexedDB Storage (lib/db.ts)                         │   │
│  │  - audioFiles: Metadata (totalChunks, chunksComplete)  │   │
│  │  - audioChunks: Individual MP3 blobs                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ SSE (Server-Sent Events)
                          │ event: audio_chunk
                          │ data: { index, data, isFirst, ... }
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    Server (Next.js API Route)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API Route (app/api/tts/generate-stream/route.ts)      │   │
│  │  - Split chapter into 4096-char chunks                  │   │
│  │  - For each chunk:                                      │   │
│  │    1. Call OpenAI TTS API                               │   │
│  │    2. Stream chunk immediately (don't concatenate)      │   │
│  │    3. Send audio_chunk event                            │   │
│  │  - Send generation_complete when done                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   OpenAI TTS API                                 │
│  - Model: tts-1                                                  │
│  - Format: MP3                                                   │
│  - Max: 4096 chars per request                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interactions (Sequence Diagram)

```
User          AudioPlayer      useAudioGeneration    API Route    OpenAI    IndexedDB    useProgressiveAudioPlayer
 │                 │                    │                  │         │          │                │
 │ Click Generate  │                    │                  │         │          │                │
 ├────────────────►│                    │                  │         │          │                │
 │                 │ generateAudio()    │                  │         │          │                │
 │                 ├───────────────────►│                  │         │          │                │
 │                 │                    │ POST /api/tts    │         │          │                │
 │                 │                    ├─────────────────►│         │          │                │
 │                 │                    │                  │ create() │         │                │
 │                 │                    │                  ├─────────►│         │                │
 │                 │                    │                  │◄─────────┤         │                │
 │                 │                    │ SSE: audio_chunk │ (chunk 1)│         │                │
 │                 │                    │◄─────────────────┤         │          │                │
 │                 │                    │ saveAudioChunk() │         │          │                │
 │                 │                    ├─────────────────────────────►         │                │
 │                 │ onFirstChunkReady  │                  │         │          │                │
 │                 │◄───────────────────┤                  │         │          │                │
 │                 │ loadAndPlay()      │                  │         │          │                │
 │                 ├────────────────────────────────────────────────────────────►                │
 │                 │                    │                  │         │          │ getAudioChunks()│
 │                 │                    │                  │         │          │◄───────────────┤
 │                 │                    │                  │         │          │────────────────►
 │                 │                    │                  │         │          │ (chunk 1 blob)  │
 │                 │                    │                  │         │          │                 │
 │                 │                    │                  │         │          │ decodeAudioData()
 │                 │                    │                  │         │          │ schedule chunk 1│
 │ ◄───AUDIO PLAYING────────────────────────────────────────────────────────────────────────────┤
 │                 │                    │                  │         │          │                 │
 │                 │                    │ SSE: audio_chunk │         │          │                 │
 │                 │                    │◄─────────────────┤         │          │                 │
 │                 │                    │ saveAudioChunk() │         │          │                 │
 │                 │                    ├─────────────────────────────►         │                 │
 │                 │                    │ (chunk 2 saved) │         │          │                 │
 │                 │ appendChunk()      │                  │         │          │                 │
 │                 ├────────────────────────────────────────────────────────────►                 │
 │                 │                    │                  │         │          │ schedule chunk 2│
 │ ◄───SEAMLESS TRANSITION──────────────────────────────────────────────────────────────────────┤
 │                 │                    │                  │         │          │                 │
 │                 │                    │ (repeat for chunks 3-N...)│          │                 │
 │                 │                    │                  │         │          │                 │
 │                 │                    │ SSE: generation_complete   │          │                 │
 │                 │                    │◄─────────────────┤         │          │                 │
 │                 │ updateMetadata()   │                  │         │          │                 │
 │                 │◄───────────────────┤                  │         │          │                 │
```

### Data Model Changes

#### New `audioChunks` Table

```typescript
// lib/db.ts - Add to ReaderDatabase schema
export interface AudioChunk {
  id?: number;
  audioFileId: number;      // FK to audioFiles table
  chunkIndex: number;        // 0-based position in sequence
  blob: Blob;                // Individual MP3 chunk
  duration: number;          // Chunk duration in seconds
  textStart: number;         // Character offset in chapter text
  textEnd: number;           // Character end offset
  startTime: number;         // Offset in final concatenated audio (seconds)
  generatedAt: Date;
}

// Database schema
// Version 5 (new)
this.version(5).stores({
  // ... existing tables
  audioChunks: '++id, audioFileId, chunkIndex, generatedAt',
});

// Compound index for efficient range queries
db.audioChunks.where('[audioFileId+chunkIndex]').equals([audioFileId, chunkIndex])
```

#### Modified `audioFiles` Table

```typescript
// types/index.ts - Update AudioFile interface
export interface AudioFile {
  id?: number;
  chapterId: number;
  blob?: Blob;              // OPTIONAL: For backwards compatibility with single-blob storage
  duration: number;
  voice: OpenAIVoice;
  speed: number;
  generatedAt: Date;
  sizeBytes: number;

  // NEW FIELDS for progressive streaming
  totalChunks: number;      // Expected number of chunks
  chunksComplete: number;   // Chunks successfully generated
  isComplete: boolean;      // Generation finished
  completedAt?: Date;       // When all chunks finished
  isProgressive: boolean;   // Flag: true = chunk-based, false = single-blob
}
```

### API Protocol Changes

#### New SSE Event Types

**Event: `audio_chunk`** (new)

```typescript
// Sent immediately after each chunk is generated
{
  event: "audio_chunk",
  data: {
    index: 0,                          // 0-based chunk index
    total: 5,                          // Total expected chunks
    data: "base64encodedMP3...",       // Chunk audio data
    textStart: 0,                      // Character position start
    textEnd: 4096,                     // Character position end
    estimatedDuration: 36.5,           // Estimated chunk duration (seconds)
    isFirst: true,                     // Flag for first chunk (optional)
    sizeBytes: 52480                   // Chunk size in bytes
  }
}
```

**Event: `generation_complete`** (new)

```typescript
// Sent after all chunks are generated
{
  event: "generation_complete",
  data: {
    success: true,
    totalChunks: 5,
    totalDuration: 182.5,
    cost: 0.045,
    charCount: 20480,
    voice: "alloy",
    speed: 1.0
  }
}
```

**Event: `result`** (keep for backwards compatibility)

```typescript
// Still sent at end with concatenated audio for older clients
{
  event: "result",
  data: {
    success: true,
    audioData: "base64EncodedConcatenatedMP3...",  // All chunks concatenated
    duration: 182.5,
    cost: 0.045,
    charCount: 20480,
    sizeBytes: 262400,
    voice: "alloy",
    speed: 1.0
  }
}
```

### Web Audio API Playback Strategy

#### Gapless Chunk Scheduling

```typescript
// Pseudo-code for scheduling algorithm
const audioContext = new AudioContext();
let nextStartTime = 0;
const scheduledSources: AudioBufferSourceNode[] = [];

async function scheduleChunk(chunkBlob: Blob) {
  // 1. Convert Blob to ArrayBuffer
  const arrayBuffer = await chunkBlob.arrayBuffer();

  // 2. Decode MP3 to PCM AudioBuffer
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // 3. Create source node
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  // 4. Schedule at precise time (gapless)
  if (nextStartTime === 0) {
    nextStartTime = audioContext.currentTime;
  }
  source.start(nextStartTime);

  // 5. Update next start time
  nextStartTime += audioBuffer.duration;

  // 6. Track source for cleanup
  scheduledSources.push(source);

  // 7. Cleanup after playback
  source.onended = () => {
    const index = scheduledSources.indexOf(source);
    if (index > -1) scheduledSources.splice(index, 1);
  };
}
```

#### Memory Management (Sliding Window)

```typescript
// Keep only N chunks in memory at once
const CHUNK_MEMORY_WINDOW = 5;
const chunkBuffers: Map<number, AudioBuffer> = new Map();

async function loadChunkIntoMemory(chunkIndex: number) {
  // Evict old chunks
  if (chunkBuffers.size >= CHUNK_MEMORY_WINDOW) {
    const oldestIndex = Math.min(...chunkBuffers.keys());
    chunkBuffers.delete(oldestIndex);
  }

  // Load new chunk
  const chunk = await getAudioChunk(chapterId, chunkIndex);
  const arrayBuffer = await chunk.blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  chunkBuffers.set(chunkIndex, audioBuffer);
}
```

---

## Implementation Phases

### Phase 1: Database Schema & Chunk Storage (Foundation)

**Duration**: 4-6 hours
**Dependencies**: None
**Risk Level**: Low

#### Goals

- Add `audioChunks` table to IndexedDB schema
- Create chunk CRUD functions in `lib/db.ts`
- Update type definitions in `types/index.ts`
- Test chunk storage and retrieval
- Ensure backwards compatibility with existing single-blob storage

#### Detailed Tasks

##### Task 1.1: Update Database Schema (1 hour)

**File**: `lib/db.ts`

**Changes**:

```typescript
// ADD: New interface at top of file (after imports)
import type { AudioChunk } from '@/types';  // Add to existing import

// ADD: Table declaration in ReaderDatabase class (line 14)
export class ReaderDatabase extends Dexie {
  // ... existing tables
  audioChunks!: Table<AudioChunk, number>;  // ADD THIS LINE

  // ... rest of class
}

// ADD: Version 5 migration (after line 60)
// Version 5: Add progressive audio streaming support
this.version(5).stores({
  books: '++id, title, author, addedAt, lastOpenedAt, *tags',
  positions: 'bookId, updatedAt',
  sessions: '++id, bookId, startTime, endTime',
  highlights: '++id, bookId, cfiRange, color, createdAt',
  analytics: '++id, sessionId, bookId, timestamp, event',
  chapters: '++id, bookId, order, cfiStart',
  audioFiles: '++id, chapterId, generatedAt',
  audioSettings: 'bookId, updatedAt',
  audioUsage: '++id, chapterId, bookId, timestamp',
  sentenceSyncData: '++id, audioFileId, chapterId, generatedAt',
  audioChunks: '++id, audioFileId, chunkIndex, generatedAt',  // NEW TABLE
});
```

**Testing**:
```typescript
// Run in browser console after deployment
const testChunk: Omit<AudioChunk, 'id'> = {
  audioFileId: 1,
  chunkIndex: 0,
  blob: new Blob(['test'], { type: 'audio/mpeg' }),
  duration: 10,
  textStart: 0,
  textEnd: 100,
  startTime: 0,
  generatedAt: new Date()
};

await db.audioChunks.add(testChunk);
const retrieved = await db.audioChunks.get(1);
console.log('Chunk storage test:', retrieved);
```

##### Task 1.2: Add Type Definitions (30 minutes)

**File**: `types/index.ts`

**Changes**:

```typescript
// ADD: After AudioFile interface (after line 99)

// Audio chunk for progressive streaming (TTS Phase: Progressive Streaming)
export interface AudioChunk {
  id?: number;
  audioFileId: number;      // FK to audioFiles table
  chunkIndex: number;        // 0-based position in sequence
  blob: Blob;                // Individual MP3 chunk
  duration: number;          // Chunk duration in seconds
  textStart: number;         // Character offset in chapter text
  textEnd: number;           // Character end offset
  startTime: number;         // Offset in final concatenated audio (seconds)
  generatedAt: Date;
}

// MODIFY: AudioFile interface (lines 90-99)
export interface AudioFile {
  id?: number;
  chapterId: number;
  blob?: Blob;              // OPTIONAL now (for backwards compatibility)
  duration: number;
  voice: OpenAIVoice;
  speed: number;
  generatedAt: Date;
  sizeBytes: number;

  // Progressive streaming fields
  totalChunks?: number;      // Expected number of chunks
  chunksComplete?: number;   // Chunks successfully generated
  isComplete?: boolean;      // Generation finished
  completedAt?: Date;        // When all chunks finished
  isProgressive?: boolean;   // true = chunk-based, false/undefined = single-blob
}
```

##### Task 1.3: Add Chunk Storage Functions (2 hours)

**File**: `lib/db.ts`

**Add these functions at the end of the file** (after line 530):

```typescript
// ============================================================
// Audio Chunk Management Functions (TTS Phase: Progressive Streaming)
// ============================================================

/**
 * Save an audio chunk to IndexedDB
 */
export async function saveAudioChunk(
  chunk: Omit<AudioChunk, 'id'>
): Promise<number> {
  return await db.audioChunks.add(chunk);
}

/**
 * Save multiple audio chunks in a single transaction (more efficient)
 */
export async function saveAudioChunks(
  chunks: Omit<AudioChunk, 'id'>[]
): Promise<number[]> {
  return await db.audioChunks.bulkAdd(chunks, { allKeys: true });
}

/**
 * Get all audio chunks for an audio file, sorted by chunk index
 */
export async function getAudioChunks(
  audioFileId: number
): Promise<AudioChunk[]> {
  return await db.audioChunks
    .where('audioFileId')
    .equals(audioFileId)
    .sortBy('chunkIndex');
}

/**
 * Get a specific audio chunk by audio file ID and chunk index
 */
export async function getAudioChunk(
  audioFileId: number,
  chunkIndex: number
): Promise<AudioChunk | undefined> {
  return await db.audioChunks
    .where({ audioFileId, chunkIndex })
    .first();
}

/**
 * Get chunks in a specific range (for sliding window memory management)
 */
export async function getAudioChunksInRange(
  audioFileId: number,
  startIndex: number,
  endIndex: number
): Promise<AudioChunk[]> {
  const chunks = await getAudioChunks(audioFileId);
  return chunks.filter(
    c => c.chunkIndex >= startIndex && c.chunkIndex <= endIndex
  );
}

/**
 * Update audio file progress (chunksComplete count)
 */
export async function updateAudioFileProgress(
  audioFileId: number,
  chunksComplete: number
): Promise<void> {
  await db.audioFiles.update(audioFileId, { chunksComplete });
}

/**
 * Mark audio file as complete after all chunks generated
 */
export async function completeAudioFile(
  audioFileId: number,
  totalDuration: number,
  totalSizeBytes: number
): Promise<void> {
  await db.audioFiles.update(audioFileId, {
    isComplete: true,
    completedAt: new Date(),
    duration: totalDuration,
    sizeBytes: totalSizeBytes,
  });
}

/**
 * Delete all chunks for an audio file (cleanup)
 */
export async function deleteAudioChunks(
  audioFileId: number
): Promise<void> {
  await db.audioChunks.where('audioFileId').equals(audioFileId).delete();
}

/**
 * Get chunk count for an audio file
 */
export async function getAudioChunkCount(
  audioFileId: number
): Promise<number> {
  return await db.audioChunks.where('audioFileId').equals(audioFileId).count();
}
```

**MODIFY**: Existing `deleteAudioFile` function (lines 410-416):

```typescript
// BEFORE
export async function deleteAudioFile(chapterId: number): Promise<void> {
  const audioFile = await getAudioFile(chapterId);
  if (audioFile?.id) {
    await deleteSentenceSyncData(audioFile.id);
  }
  await db.audioFiles.where('chapterId').equals(chapterId).delete();
}

// AFTER
export async function deleteAudioFile(chapterId: number): Promise<void> {
  const audioFile = await getAudioFile(chapterId);
  if (audioFile?.id) {
    await deleteSentenceSyncData(audioFile.id);
    await deleteAudioChunks(audioFile.id);  // ADD: Delete chunks
  }
  await db.audioFiles.where('chapterId').equals(chapterId).delete();
}
```

**MODIFY**: Existing `clearAllData` function (line 180):

```typescript
// BEFORE
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
  await db.sentenceSyncData.clear();
}

// AFTER
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
  await db.sentenceSyncData.clear();
  await db.audioChunks.clear();  // ADD: Clear chunks
}
```

##### Task 1.4: Write Unit Tests (1.5 hours)

**Create**: `lib/__tests__/db-audio-chunks.test.ts`

```typescript
import {
  saveAudioChunk,
  saveAudioChunks,
  getAudioChunks,
  getAudioChunk,
  getAudioChunksInRange,
  deleteAudioChunks,
  getAudioChunkCount
} from '../db';
import type { AudioChunk } from '@/types';

describe('Audio Chunk Storage', () => {
  beforeEach(async () => {
    // Clear test data
    await db.audioChunks.clear();
    await db.audioFiles.clear();
  });

  test('should save and retrieve a single chunk', async () => {
    const chunk: Omit<AudioChunk, 'id'> = {
      audioFileId: 1,
      chunkIndex: 0,
      blob: new Blob(['test audio'], { type: 'audio/mpeg' }),
      duration: 10.5,
      textStart: 0,
      textEnd: 4096,
      startTime: 0,
      generatedAt: new Date(),
    };

    const id = await saveAudioChunk(chunk);
    expect(id).toBeGreaterThan(0);

    const retrieved = await getAudioChunk(1, 0);
    expect(retrieved).toBeDefined();
    expect(retrieved?.chunkIndex).toBe(0);
    expect(retrieved?.duration).toBe(10.5);
  });

  test('should save multiple chunks in bulk', async () => {
    const chunks: Omit<AudioChunk, 'id'>[] = [
      {
        audioFileId: 1,
        chunkIndex: 0,
        blob: new Blob(['chunk 0'], { type: 'audio/mpeg' }),
        duration: 10,
        textStart: 0,
        textEnd: 4096,
        startTime: 0,
        generatedAt: new Date(),
      },
      {
        audioFileId: 1,
        chunkIndex: 1,
        blob: new Blob(['chunk 1'], { type: 'audio/mpeg' }),
        duration: 10,
        textStart: 4096,
        textEnd: 8192,
        startTime: 10,
        generatedAt: new Date(),
      },
    ];

    const ids = await saveAudioChunks(chunks);
    expect(ids.length).toBe(2);

    const retrieved = await getAudioChunks(1);
    expect(retrieved.length).toBe(2);
    expect(retrieved[0].chunkIndex).toBe(0);
    expect(retrieved[1].chunkIndex).toBe(1);
  });

  test('should retrieve chunks in specific range', async () => {
    // Save 10 chunks
    const chunks: Omit<AudioChunk, 'id'>[] = Array.from({ length: 10 }, (_, i) => ({
      audioFileId: 1,
      chunkIndex: i,
      blob: new Blob([`chunk ${i}`], { type: 'audio/mpeg' }),
      duration: 10,
      textStart: i * 4096,
      textEnd: (i + 1) * 4096,
      startTime: i * 10,
      generatedAt: new Date(),
    }));
    await saveAudioChunks(chunks);

    // Get chunks 2-5
    const rangeChunks = await getAudioChunksInRange(1, 2, 5);
    expect(rangeChunks.length).toBe(4);
    expect(rangeChunks[0].chunkIndex).toBe(2);
    expect(rangeChunks[3].chunkIndex).toBe(5);
  });

  test('should delete all chunks for an audio file', async () => {
    // Save chunks for two audio files
    await saveAudioChunk({
      audioFileId: 1,
      chunkIndex: 0,
      blob: new Blob(['chunk'], { type: 'audio/mpeg' }),
      duration: 10,
      textStart: 0,
      textEnd: 100,
      startTime: 0,
      generatedAt: new Date(),
    });
    await saveAudioChunk({
      audioFileId: 2,
      chunkIndex: 0,
      blob: new Blob(['chunk'], { type: 'audio/mpeg' }),
      duration: 10,
      textStart: 0,
      textEnd: 100,
      startTime: 0,
      generatedAt: new Date(),
    });

    // Delete chunks for audio file 1
    await deleteAudioChunks(1);

    const chunks1 = await getAudioChunks(1);
    const chunks2 = await getAudioChunks(2);

    expect(chunks1.length).toBe(0);
    expect(chunks2.length).toBe(1);
  });

  test('should count chunks correctly', async () => {
    await saveAudioChunks([
      {
        audioFileId: 1,
        chunkIndex: 0,
        blob: new Blob(['chunk'], { type: 'audio/mpeg' }),
        duration: 10,
        textStart: 0,
        textEnd: 100,
        startTime: 0,
        generatedAt: new Date(),
      },
      {
        audioFileId: 1,
        chunkIndex: 1,
        blob: new Blob(['chunk'], { type: 'audio/mpeg' }),
        duration: 10,
        textStart: 100,
        textEnd: 200,
        startTime: 10,
        generatedAt: new Date(),
      },
    ]);

    const count = await getAudioChunkCount(1);
    expect(count).toBe(2);
  });
});
```

**Run tests**:
```bash
npm test -- lib/__tests__/db-audio-chunks.test.ts
```

#### Success Criteria

- ✅ IndexedDB schema includes `audioChunks` table with proper indexes
- ✅ Can save individual chunks to IndexedDB
- ✅ Can save multiple chunks in bulk (single transaction)
- ✅ Can retrieve chunks by audio file ID, sorted by chunk index
- ✅ Can retrieve specific chunk by audio file ID + chunk index
- ✅ Can retrieve chunks in range (for sliding window)
- ✅ Can delete all chunks for an audio file
- ✅ Can count chunks for an audio file
- ✅ All unit tests pass
- ✅ Existing single-blob audio files continue to work (no breaking changes)

#### Rollback Plan

If schema migration causes issues:
1. Revert `lib/db.ts` to version 4 schema
2. Clear IndexedDB in browser console: `await db.delete(); location.reload()`
3. Database will reinitialize with version 4
4. No data loss (existing audio files use `blob` field)

---

### Phase 2: API Streaming & Client Reception (Data Flow)

**Duration**: 8-10 hours
**Dependencies**: Phase 1 complete
**Risk Level**: Medium

#### Goals

- Modify API route to stream chunks individually (not concatenated)
- Update client hook to receive and save chunks
- Add `onFirstChunkReady` callback for immediate playback trigger
- Track chunk generation progress in UI
- Test chunk streaming end-to-end

#### Detailed Tasks

##### Task 2.1: Modify API Route to Stream Chunks (3 hours)

**File**: `app/api/tts/generate-stream/route.ts`

**Changes**:

```typescript
// MODIFY: Lines 156-228 (chunk generation and response)

// BEFORE: Concatenate all chunks
const audioBuffers: Buffer[] = [];

for (let i = 0; i < chunks.length; i++) {
  // ... generate chunk ...
  audioBuffers.push(buffer);
}

const buffer = Buffer.concat(audioBuffers);
sendEvent('result', { audioData: buffer.toString('base64'), ... });

// AFTER: Stream chunks individually
const audioBuffers: Buffer[] = [];
const chunkTextOffsets: { start: number; end: number }[] = [];

// Calculate text offsets for each chunk
let currentOffset = 0;
for (const chunk of chunks) {
  chunkTextOffsets.push({
    start: currentOffset,
    end: currentOffset + chunk.length,
  });
  currentOffset += chunk.length;
}

for (let i = 0; i < chunks.length; i++) {
  // Progress from 30% to 80% based on chunk completion
  const chunkProgress = 30 + Math.floor((i / totalChunks) * 50);

  sendEvent('progress', {
    type: 'chunk_start',
    progress: chunkProgress,
    message: `Generating chunk ${i + 1} of ${totalChunks}`,
    totalChunks,
    currentChunk: i + 1,
  });

  console.log(`[TTS API Stream] Generating chunk ${i + 1}/${totalChunks}`);

  const openai = getOpenAIClient();
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: chunks[i],
    response_format: 'mp3',
    speed: validSpeed,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  audioBuffers.push(buffer);

  // NEW: Stream chunk immediately (don't wait for concatenation)
  sendEvent('audio_chunk', {
    index: i,
    total: totalChunks,
    data: buffer.toString('base64'),
    textStart: chunkTextOffsets[i].start,
    textEnd: chunkTextOffsets[i].end,
    estimatedDuration: estimateChunkDuration(chunks[i], validSpeed),
    isFirst: i === 0,
    sizeBytes: buffer.length,
  });

  const completedProgress = 30 + Math.floor(((i + 1) / totalChunks) * 50);
  sendEvent('progress', {
    type: 'chunk_complete',
    progress: completedProgress,
    message: `Chunk ${i + 1} of ${totalChunks} streamed`,
    totalChunks,
    currentChunk: i + 1,
  });

  console.log(`[TTS API Stream] Chunk ${i + 1}/${totalChunks} streamed to client`);
}

// Calculate final metadata
const charCount = sanitizedText.length;
const cost = (charCount / 1000) * 0.015;
const wordCount = sanitizedText.split(/\s+/).length;
const durationSeconds = Math.ceil((wordCount / 150) * 60 / validSpeed);

// NEW: Send generation_complete event
sendEvent('generation_complete', {
  success: true,
  totalChunks: totalChunks,
  totalDuration: durationSeconds,
  cost,
  charCount,
  voice,
  speed: validSpeed,
});

// KEEP: Send result event for backwards compatibility
const buffer = Buffer.concat(audioBuffers);
sendEvent('result', {
  success: true,
  audioData: buffer.toString('base64'),
  duration: durationSeconds,
  cost,
  charCount,
  sizeBytes: buffer.length,
  voice,
  speed: validSpeed,
});

sendEvent('progress', {
  type: 'done',
  progress: 100,
  message: 'Complete',
});
```

**ADD**: Helper function for duration estimation (at end of file):

```typescript
/**
 * Estimate chunk duration based on character count and speed
 * Formula: (chars / 4.7) / (150 wpm / 60) / speed
 * 4.7 chars per word average, 150 words per minute reading speed
 */
function estimateChunkDuration(text: string, speed: number): number {
  const words = text.split(/\s+/).length;
  const durationSeconds = (words / 150) * 60 / speed;
  return Math.ceil(durationSeconds * 10) / 10; // Round to 1 decimal
}
```

##### Task 2.2: Update Client Hook to Handle Chunks (4 hours)

**File**: `hooks/useAudioGeneration.ts`

**MODIFY**: Interface to add callback (line 13):

```typescript
interface GenerateAudioOptions {
  chapter: Chapter;
  voice: OpenAIVoice;
  speed?: number;
  onProgress?: (progress: number, message?: string) => void;
  onFirstChunkReady?: (chapterId: number, audioFileId: number) => void;  // ADD
}
```

**MODIFY**: Main generation logic (lines 105-209):

```typescript
// BEFORE: Wait for complete result
let resultData: any = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Process SSE messages
  if (eventType === 'progress') {
    setProgress(data.progress);
    if (onProgress) onProgress(data.progress, data.message);
  } else if (eventType === 'result') {
    resultData = data;
  }
}

const audioBlob = base64ToBlob(resultData.audioData, 'audio/mpeg');
await saveAudioFile({ blob: audioBlob, ... });

// AFTER: Handle chunks as they arrive
let audioFileId: number | null = null;
const chunks: AudioChunk[] = [];
let generationMetadata: any = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  if (controller.signal.aborted) {
    reader.cancel();
    throw new Error('Generation cancelled');
  }

  buffer += decoder.decode(value, { stream: true });

  // Process complete SSE messages
  const lines = buffer.split('\n\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    const eventMatch = line.match(/^event: (\w+)\ndata: ([\s\S]+)$/);
    if (!eventMatch) continue;

    const [, eventType, dataStr] = eventMatch;
    const data = JSON.parse(dataStr);

    if (eventType === 'progress') {
      setProgress(data.progress);
      if (onProgress) onProgress(data.progress, data.message);
      console.log(`[useAudioGeneration] Progress: ${data.progress}% - ${data.message}`);
    } else if (eventType === 'audio_chunk') {
      // NEW: Handle individual audio chunk
      console.log(`[useAudioGeneration] Received chunk ${data.index + 1}/${data.total}`);

      // Convert chunk base64 to Blob
      const chunkBlob = base64ToBlob(data.data, 'audio/mpeg');

      // Calculate startTime for this chunk (sum of previous chunk durations)
      const startTime = chunks.reduce((sum, c) => sum + c.duration, 0);

      // Create AudioFile metadata on first chunk
      if (data.index === 0) {
        const audioFile: Omit<AudioFile, 'id'> = {
          chapterId: chapter.id,
          duration: 0, // Will update on completion
          voice: voice,
          speed: speed,
          generatedAt: new Date(),
          sizeBytes: 0, // Will update on completion
          totalChunks: data.total,
          chunksComplete: 1,
          isComplete: false,
          isProgressive: true,
        };

        audioFileId = await saveAudioFile(audioFile);
        console.log(`[useAudioGeneration] Created audio file metadata, ID: ${audioFileId}`);
      }

      // Save chunk to IndexedDB
      const chunk: Omit<AudioChunk, 'id'> = {
        audioFileId: audioFileId!,
        chunkIndex: data.index,
        blob: chunkBlob,
        duration: data.estimatedDuration,
        textStart: data.textStart,
        textEnd: data.textEnd,
        startTime: startTime,
        generatedAt: new Date(),
      };

      const chunkId = await saveAudioChunk(chunk);
      chunks.push({ ...chunk, id: chunkId });

      console.log(`[useAudioGeneration] Saved chunk ${data.index} (ID: ${chunkId})`);

      // Update progress
      if (audioFileId && data.index > 0) {
        await updateAudioFileProgress(audioFileId, data.index + 1);
      }

      // NEW: Trigger playback after first chunk
      if (data.index === 0 && onFirstChunkReady && chapter.id && audioFileId) {
        console.log('[useAudioGeneration] First chunk ready, triggering playback');
        onFirstChunkReady(chapter.id, audioFileId);
      }
    } else if (eventType === 'generation_complete') {
      // NEW: Handle generation completion
      generationMetadata = data;
      console.log('[useAudioGeneration] Generation complete:', data);

      // Update audio file with final metadata
      if (audioFileId) {
        await completeAudioFile(
          audioFileId,
          data.totalDuration,
          chunks.reduce((sum, c) => sum + c.blob.size, 0)
        );
      }
    } else if (eventType === 'result') {
      // KEEP: For backwards compatibility (ignored in progressive mode)
      console.log('[useAudioGeneration] Received result event (backwards compatibility)');
    } else if (eventType === 'error') {
      throw new Error(data.error);
    }
  }
}

// Validate we got all the data
if (!audioFileId || chunks.length === 0) {
  throw new Error('No chunks received from streaming API');
}

if (!generationMetadata) {
  throw new Error('No generation_complete event received');
}

// Log usage
await logAudioUsage({
  chapterId: chapter.id,
  bookId: chapter.bookId,
  charCount: generationMetadata.charCount,
  cost: generationMetadata.cost,
  voice: generationMetadata.voice,
  timestamp: new Date(),
});

// Step 5: Generate sentence sync data (unchanged)
// ... existing sentence sync logic ...

setProgress(100);
setGenerating(false);
setAbortController(null);

return {
  id: audioFileId,
  chapterId: chapter.id,
  duration: generationMetadata.totalDuration,
  voice: generationMetadata.voice,
  speed: generationMetadata.speed,
  generatedAt: new Date(),
  sizeBytes: chunks.reduce((sum, c) => sum + c.blob.size, 0),
  totalChunks: chunks.length,
  chunksComplete: chunks.length,
  isComplete: true,
  isProgressive: true,
};
```

**ADD**: Import new functions at top:

```typescript
import {
  saveAudioFile,
  logAudioUsage,
  saveSentenceSyncData,
  saveAudioChunk,          // ADD
  updateAudioFileProgress, // ADD
  completeAudioFile,       // ADD
} from '@/lib/db';
```

##### Task 2.3: Integration Testing (2 hours)

**Create**: `app/api/tts/__tests__/generate-stream-chunks.test.ts`

```typescript
import { POST } from '../generate-stream/route';

describe('TTS API Chunk Streaming', () => {
  test('should stream chunks individually', async () => {
    const request = new Request('http://localhost:3000/api/tts/generate-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterText: 'Test text. ' + 'Another sentence. '.repeat(200), // ~4000 chars
        voice: 'alloy',
        speed: 1.0,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const chunks: any[] = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const eventMatch = line.match(/^event: (\w+)\ndata: ([\s\S]+)$/);
        if (!eventMatch) continue;

        const [, eventType, dataStr] = eventMatch;
        const data = JSON.parse(dataStr);

        if (eventType === 'audio_chunk') {
          chunks.push(data);
        }
      }
    }

    // Assertions
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].isFirst).toBe(true);
    expect(chunks[0].data).toBeTruthy(); // Has base64 audio data

    // Verify chunk ordering
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  test('should send generation_complete event', async () => {
    const request = new Request('http://localhost:3000/api/tts/generate-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterText: 'Short test text.',
        voice: 'alloy',
        speed: 1.0,
      }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let generationComplete = false;

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const eventMatch = line.match(/^event: (\w+)\ndata: ([\s\S]+)$/);
        if (!eventMatch) continue;

        const [, eventType, dataStr] = eventMatch;
        const data = JSON.parse(dataStr);

        if (eventType === 'generation_complete') {
          generationComplete = true;
          expect(data.success).toBe(true);
          expect(data.totalChunks).toBeGreaterThan(0);
          expect(data.totalDuration).toBeGreaterThan(0);
        }
      }
    }

    expect(generationComplete).toBe(true);
  });
});
```

**Manual Testing Checklist**:

1. Open browser DevTools Network tab
2. Generate audio for a 10,000+ character chapter
3. Observe SSE events in Network tab:
   - ✅ `audio_chunk` events appear incrementally (not all at once)
   - ✅ First chunk arrives within 5-10 seconds
   - ✅ Chunks have sequential `index` values
   - ✅ `generation_complete` event arrives at end
4. Open IndexedDB inspector (Chrome DevTools > Application > IndexedDB)
   - ✅ `audioChunks` table populates as chunks arrive
   - ✅ Each chunk has correct `chunkIndex` and `audioFileId`
5. Check console logs:
   - ✅ "[useAudioGeneration] Received chunk 1/5"
   - ✅ "[useAudioGeneration] Saved chunk 0 (ID: 123)"
   - ✅ "[useAudioGeneration] First chunk ready, triggering playback"

##### Task 2.4: Error Handling & Edge Cases (1 hour)

**Handle network interruption**:

```typescript
// In useAudioGeneration.ts, wrap chunk save in try-catch
try {
  const chunkId = await saveAudioChunk(chunk);
  chunks.push({ ...chunk, id: chunkId });
} catch (err) {
  console.error(`[useAudioGeneration] Failed to save chunk ${data.index}:`, err);
  // Continue with next chunk - don't break entire generation
  // UI will show partial progress
}
```

**Handle duplicate chunks** (e.g., SSE reconnection):

```typescript
// Before saving chunk, check if already exists
const existing = await getAudioChunk(audioFileId!, data.index);
if (existing) {
  console.log(`[useAudioGeneration] Chunk ${data.index} already exists, skipping`);
  continue;
}
```

**Handle incomplete generation** (user navigates away):

```typescript
// In useAudioGeneration cleanup
useEffect(() => {
  return () => {
    if (abortController) {
      abortController.abort();

      // Mark audio file as incomplete
      if (audioFileId) {
        updateAudioFileProgress(audioFileId, chunks.length).catch(console.error);
      }
    }
  };
}, [abortController, audioFileId, chunks]);
```

#### Success Criteria

- ✅ API route streams chunks individually via SSE
- ✅ Client receives `audio_chunk` events in real-time
- ✅ Each chunk saved to IndexedDB immediately upon receipt
- ✅ `audioFileId` created on first chunk
- ✅ `onFirstChunkReady` callback fires after first chunk saved
- ✅ Progress updates reflect "Chunk X of Y streamed"
- ✅ `generation_complete` event sent after all chunks
- ✅ Audio file metadata updated with final duration and size
- ✅ Backwards compatibility: `result` event still sent (ignored in progressive mode)
- ✅ All integration tests pass
- ✅ Manual testing confirms chunks appear incrementally in IndexedDB

#### Rollback Plan

If chunk streaming breaks existing functionality:
1. Add feature flag in API route:
   ```typescript
   const useProgressiveStreaming = request.headers.get('X-Progressive-Streaming') === 'true';
   ```
2. Only stream chunks if flag is set, otherwise use old concatenation
3. Client can opt-in by setting header in fetch request
4. Deploy with flag disabled by default
5. Enable flag per-user for testing

---

### Phase 3: Progressive Audio Player (Playback Engine)

**Duration**: 8-10 hours
**Dependencies**: Phase 2 complete
**Risk Level**: High

#### Goals

- Create new `useProgressiveAudioPlayer` hook using Web Audio API
- Implement gapless chunk scheduling
- Handle chunk queueing and buffer management
- Add playback controls (play/pause/stop)
- Implement sliding window for memory management
- Test gapless playback with various chunk counts

#### Detailed Tasks

##### Task 3.1: Create Progressive Player Hook (5 hours)

**Create**: `hooks/useProgressiveAudioPlayer.ts`

```typescript
import { useRef, useState, useCallback, useEffect } from 'react';
import type { Chapter, AudioChunk } from '@/types';
import { getAudioChunks, getAudioFile } from '@/lib/db';

interface UseProgressiveAudioPlayerProps {
  chapter: Chapter | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onChunkLoad?: (chunkIndex: number, totalChunks: number) => void;
}

interface UseProgressiveAudioPlayerResult {
  playing: boolean;
  currentTime: number;
  duration: number;
  loading: boolean;
  error: string | null;
  chunksLoaded: number;
  totalChunks: number;
  isGenerating: boolean;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  loadChapter: (chapter: Chapter) => Promise<void>;
}

interface ScheduledChunk {
  chunkIndex: number;
  buffer: AudioBuffer;
  source: AudioBufferSourceNode;
  startTime: number;
  duration: number;
}

export function useProgressiveAudioPlayer({
  chapter,
  onTimeUpdate,
  onEnded,
  onChunkLoad,
}: UseProgressiveAudioPlayerProps): UseProgressiveAudioPlayerResult {
  // Audio context (persistent across chunks)
  const audioContextRef = useRef<AudioContext | null>(null);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chunk tracking
  const [chunksLoaded, setChunksLoaded] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Scheduled chunks for playback
  const scheduledChunksRef = useRef<ScheduledChunk[]>([]);
  const nextStartTimeRef = useRef(0);
  const playbackStartTimeRef = useRef(0);
  const currentTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize AudioContext once
  useEffect(() => {
    console.log('[useProgressiveAudioPlayer] Initializing AudioContext');
    audioContextRef.current = new AudioContext();

    return () => {
      console.log('[useProgressiveAudioPlayer] Cleaning up AudioContext');
      if (currentTimeIntervalRef.current) {
        clearInterval(currentTimeIntervalRef.current);
      }
      scheduledChunksRef.current.forEach(s => {
        try {
          s.source.stop();
        } catch (e) {
          // Already stopped
        }
      });
      audioContextRef.current?.close();
    };
  }, []);

  /**
   * Load chapter and schedule all available chunks
   */
  const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
    if (!chapterToLoad.id || !audioContextRef.current) {
      console.log('[useProgressiveAudioPlayer] Invalid chapter or audio context');
      return;
    }

    console.log('[useProgressiveAudioPlayer] Loading chapter:', chapterToLoad.title);
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Stop any currently playing chunks
    scheduledChunksRef.current.forEach(s => {
      try {
        s.source.stop();
      } catch (e) {
        // Already stopped
      }
    });
    scheduledChunksRef.current = [];
    nextStartTimeRef.current = 0;

    try {
      // Get audio file metadata
      const audioFile = await getAudioFile(chapterToLoad.id);

      if (!audioFile) {
        throw new Error('Audio not generated for this chapter');
      }

      // Check if progressive or single-blob
      if (!audioFile.isProgressive) {
        throw new Error('This chapter uses single-blob storage. Use standard audio player.');
      }

      setTotalChunks(audioFile.totalChunks || 0);
      setIsGenerating(!audioFile.isComplete);

      // Get all available chunks
      const chunks = await getAudioChunks(audioFile.id!);
      console.log(`[useProgressiveAudioPlayer] Found ${chunks.length} chunks`);

      if (chunks.length === 0) {
        throw new Error('No audio chunks found');
      }

      setChunksLoaded(chunks.length);

      // Schedule all available chunks
      for (const chunk of chunks) {
        await scheduleChunk(chunk);
      }

      setLoading(false);
    } catch (err) {
      console.error('[useProgressiveAudioPlayer] Error loading chapter:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setLoading(false);
    }
  }, []);

  /**
   * Schedule a single chunk for gapless playback
   */
  const scheduleChunk = async (chunk: AudioChunk) => {
    if (!audioContextRef.current) return;

    console.log(`[useProgressiveAudioPlayer] Scheduling chunk ${chunk.chunkIndex}`);

    try {
      // Convert Blob to ArrayBuffer
      const arrayBuffer = await chunk.blob.arrayBuffer();

      // Decode MP3 to PCM AudioBuffer
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Create source node
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      // Calculate start time for gapless playback
      const startTime = nextStartTimeRef.current;
      nextStartTimeRef.current += audioBuffer.duration;

      // Track scheduled chunk
      const scheduledChunk: ScheduledChunk = {
        chunkIndex: chunk.chunkIndex,
        buffer: audioBuffer,
        source,
        startTime,
        duration: audioBuffer.duration,
      };
      scheduledChunksRef.current.push(scheduledChunk);

      // Update total duration
      setDuration(nextStartTimeRef.current);

      // Handle chunk end
      source.onended = () => {
        console.log(`[useProgressiveAudioPlayer] Chunk ${chunk.chunkIndex} ended`);

        // Check if this was the last chunk
        const isLastChunk = chunk.chunkIndex === scheduledChunksRef.current.length - 1;
        if (isLastChunk) {
          console.log('[useProgressiveAudioPlayer] Playback complete');
          setPlaying(false);
          onEnded?.();
        }
      };

      console.log(`[useProgressiveAudioPlayer] Chunk ${chunk.chunkIndex} scheduled at ${startTime}s`);
      onChunkLoad?.(chunk.chunkIndex + 1, totalChunks);
    } catch (err) {
      console.error(`[useProgressiveAudioPlayer] Failed to schedule chunk ${chunk.chunkIndex}:`, err);
      // Don't throw - continue with other chunks
    }
  };

  /**
   * Start playback of all scheduled chunks
   */
  const play = useCallback(async () => {
    if (!audioContextRef.current) {
      setError('Audio context not initialized');
      return;
    }

    if (scheduledChunksRef.current.length === 0) {
      setError('No audio chunks loaded');
      return;
    }

    console.log('[useProgressiveAudioPlayer] Starting playback');

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    // Start all scheduled sources at their designated times
    const now = audioContextRef.current.currentTime;
    playbackStartTimeRef.current = now;

    scheduledChunksRef.current.forEach(scheduled => {
      try {
        scheduled.source.start(now + scheduled.startTime - currentTime);
      } catch (err) {
        // Source may already be started - that's ok
        console.warn(`[useProgressiveAudioPlayer] Could not start chunk ${scheduled.chunkIndex}:`, err);
      }
    });

    setPlaying(true);
    setError(null);

    // Start tracking current time
    if (currentTimeIntervalRef.current) {
      clearInterval(currentTimeIntervalRef.current);
    }
    currentTimeIntervalRef.current = setInterval(() => {
      if (!audioContextRef.current || !playing) return;

      const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
      const newTime = currentTime + elapsed;
      setCurrentTime(newTime);
      onTimeUpdate?.(newTime, duration);
    }, 100);
  }, [playing, currentTime, duration, onTimeUpdate]);

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    if (!audioContextRef.current) return;

    console.log('[useProgressiveAudioPlayer] Pausing playback');
    audioContextRef.current.suspend();
    setPlaying(false);

    if (currentTimeIntervalRef.current) {
      clearInterval(currentTimeIntervalRef.current);
      currentTimeIntervalRef.current = null;
    }
  }, []);

  /**
   * Seek to a specific time
   * Note: Seeking requires re-creating source nodes (not implemented in MVP)
   */
  const seek = useCallback((time: number) => {
    console.warn('[useProgressiveAudioPlayer] Seeking not yet implemented for progressive playback');

    if (isGenerating) {
      setError('Cannot seek while audio is generating. Please wait for completion.');
    } else {
      setError('Seeking is not yet supported for progressive playback. This feature is coming soon.');
    }
  }, [isGenerating]);

  /**
   * Change playback speed
   */
  const setSpeed = useCallback((speed: number) => {
    const validSpeed = Math.max(0.25, Math.min(4.0, speed));
    console.log(`[useProgressiveAudioPlayer] Setting playback speed to ${validSpeed}x`);

    scheduledChunksRef.current.forEach(scheduled => {
      scheduled.source.playbackRate.value = validSpeed;
    });
  }, []);

  // Auto-load chapter when it changes
  useEffect(() => {
    if (chapter) {
      loadChapter(chapter);
    }
  }, [chapter, loadChapter]);

  return {
    playing,
    currentTime,
    duration,
    loading,
    error,
    chunksLoaded,
    totalChunks,
    isGenerating,
    play,
    pause,
    seek,
    setSpeed,
    loadChapter,
  };
}
```

##### Task 3.2: Memory Management (Sliding Window) (2 hours)

**ADD**: Memory-efficient chunk loading to `useProgressiveAudioPlayer.ts`:

```typescript
// Add constants at top of file
const CHUNK_MEMORY_WINDOW = 5; // Keep max 5 chunks in memory
const CHUNK_PRELOAD_AHEAD = 2; // Preload 2 chunks ahead of playback

// Add to state
const [currentPlayingChunk, setCurrentPlayingChunk] = useState(0);
const chunkBufferMapRef = useRef<Map<number, AudioBuffer>>(new Map());

/**
 * Load chunk into memory (with sliding window eviction)
 */
const loadChunkIntoMemory = async (
  chunk: AudioChunk
): Promise<AudioBuffer> => {
  // Check if already in memory
  if (chunkBufferMapRef.current.has(chunk.chunkIndex)) {
    return chunkBufferMapRef.current.get(chunk.chunkIndex)!;
  }

  // Evict old chunks if window full
  if (chunkBufferMapRef.current.size >= CHUNK_MEMORY_WINDOW) {
    // Remove chunks far behind current playback position
    const chunksToEvict: number[] = [];
    chunkBufferMapRef.current.forEach((_, index) => {
      if (index < currentPlayingChunk - 1) {
        chunksToEvict.push(index);
      }
    });

    chunksToEvict.forEach(index => {
      console.log(`[useProgressiveAudioPlayer] Evicting chunk ${index} from memory`);
      chunkBufferMapRef.current.delete(index);
    });
  }

  // Decode and store
  const arrayBuffer = await chunk.blob.arrayBuffer();
  const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
  chunkBufferMapRef.current.set(chunk.chunkIndex, audioBuffer);

  return audioBuffer;
};

/**
 * Preload upcoming chunks in background
 */
const preloadUpcomingChunks = async (audioFileId: number) => {
  const startIndex = currentPlayingChunk + 1;
  const endIndex = currentPlayingChunk + CHUNK_PRELOAD_AHEAD;

  try {
    const chunks = await getAudioChunksInRange(audioFileId, startIndex, endIndex);

    for (const chunk of chunks) {
      if (!chunkBufferMapRef.current.has(chunk.chunkIndex)) {
        await loadChunkIntoMemory(chunk);
      }
    }
  } catch (err) {
    console.error('[useProgressiveAudioPlayer] Failed to preload chunks:', err);
  }
};

// MODIFY scheduleChunk to use memory-managed loading
const scheduleChunk = async (chunk: AudioChunk) => {
  if (!audioContextRef.current) return;

  try {
    // Load chunk with memory management
    const audioBuffer = await loadChunkIntoMemory(chunk);

    // ... rest of scheduling logic (unchanged)
  } catch (err) {
    console.error(`[useProgressiveAudioPlayer] Failed to schedule chunk ${chunk.chunkIndex}:`, err);
  }
};
```

##### Task 3.3: Unit Tests (2 hours)

**Create**: `hooks/__tests__/useProgressiveAudioPlayer.test.ts`

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProgressiveAudioPlayer } from '../useProgressiveAudioPlayer';
import * as db from '@/lib/db';
import type { Chapter, AudioFile, AudioChunk } from '@/types';

// Mock IndexedDB functions
jest.mock('@/lib/db');

const mockGetAudioFile = db.getAudioFile as jest.MockedFunction<typeof db.getAudioFile>;
const mockGetAudioChunks = db.getAudioChunks as jest.MockedFunction<typeof db.getAudioChunks>;

// Mock Web Audio API
global.AudioContext = jest.fn().mockImplementation(() => ({
  state: 'running',
  currentTime: 0,
  destination: {},
  resume: jest.fn().mockResolvedValue(undefined),
  suspend: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  decodeAudioData: jest.fn().mockResolvedValue({
    duration: 10.5,
    sampleRate: 44100,
  }),
  createBufferSource: jest.fn().mockReturnValue({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    playbackRate: { value: 1.0 },
    onended: null,
  }),
}));

describe('useProgressiveAudioPlayer', () => {
  const mockChapter: Chapter = {
    id: 1,
    bookId: 1,
    title: 'Test Chapter',
    cfiStart: 'epubcfi(/6/2)',
    cfiEnd: 'epubcfi(/6/4)',
    wordCount: 1000,
    charCount: 5000,
    order: 1,
    level: 1,
  };

  const mockAudioFile: AudioFile = {
    id: 1,
    chapterId: 1,
    duration: 180,
    voice: 'alloy',
    speed: 1.0,
    generatedAt: new Date(),
    sizeBytes: 100000,
    totalChunks: 3,
    chunksComplete: 3,
    isComplete: true,
    isProgressive: true,
  };

  const mockChunks: AudioChunk[] = [
    {
      id: 1,
      audioFileId: 1,
      chunkIndex: 0,
      blob: new Blob(['chunk0'], { type: 'audio/mpeg' }),
      duration: 60,
      textStart: 0,
      textEnd: 1666,
      startTime: 0,
      generatedAt: new Date(),
    },
    {
      id: 2,
      audioFileId: 1,
      chunkIndex: 1,
      blob: new Blob(['chunk1'], { type: 'audio/mpeg' }),
      duration: 60,
      textStart: 1666,
      textEnd: 3333,
      startTime: 60,
      generatedAt: new Date(),
    },
    {
      id: 3,
      audioFileId: 1,
      chunkIndex: 2,
      blob: new Blob(['chunk2'], { type: 'audio/mpeg' }),
      duration: 60,
      textStart: 3333,
      textEnd: 5000,
      startTime: 120,
      generatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAudioFile.mockResolvedValue(mockAudioFile);
    mockGetAudioChunks.mockResolvedValue(mockChunks);
  });

  test('should initialize with default state', () => {
    const { result } = renderHook(() => useProgressiveAudioPlayer({
      chapter: null,
    }));

    expect(result.current.playing).toBe(false);
    expect(result.current.currentTime).toBe(0);
    expect(result.current.duration).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  test('should load chapter and schedule chunks', async () => {
    const { result } = renderHook(() => useProgressiveAudioPlayer({
      chapter: mockChapter,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetAudioFile).toHaveBeenCalledWith(1);
    expect(mockGetAudioChunks).toHaveBeenCalledWith(1);
    expect(result.current.chunksLoaded).toBe(3);
    expect(result.current.totalChunks).toBe(3);
    expect(result.current.duration).toBe(180);
  });

  test('should handle play command', async () => {
    const { result } = renderHook(() => useProgressiveAudioPlayer({
      chapter: mockChapter,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.play();
    });

    expect(result.current.playing).toBe(true);
  });

  test('should handle pause command', async () => {
    const { result } = renderHook(() => useProgressiveAudioPlayer({
      chapter: mockChapter,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.play();
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.playing).toBe(false);
  });

  test('should reject seeking during generation', async () => {
    const incompleteAudioFile = {
      ...mockAudioFile,
      isComplete: false,
      chunksComplete: 1,
    };
    mockGetAudioFile.mockResolvedValue(incompleteAudioFile);

    const { result } = renderHook(() => useProgressiveAudioPlayer({
      chapter: mockChapter,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.seek(30);
    });

    expect(result.current.error).toContain('Cannot seek while audio is generating');
  });

  test('should update playback speed', async () => {
    const { result } = renderHook(() => useProgressiveAudioPlayer({
      chapter: mockChapter,
    }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setSpeed(1.5);
    });

    // Speed change doesn't directly update state, but sources are updated
    // (Verify via mocks in real implementation)
  });

  test('should throw error for non-progressive audio', async () => {
    const singleBlobAudioFile = {
      ...mockAudioFile,
      isProgressive: false,
      blob: new Blob(['audio'], { type: 'audio/mpeg' }),
    };
    mockGetAudioFile.mockResolvedValue(singleBlobAudioFile);

    const { result } = renderHook(() => useProgressiveAudioPlayer({
      chapter: mockChapter,
    }));

    await waitFor(() => {
      expect(result.current.error).toContain('single-blob storage');
    });
  });
});
```

#### Success Criteria

- ✅ Web Audio API context created and managed correctly
- ✅ Chunks decoded from MP3 to PCM AudioBuffer
- ✅ Chunks scheduled at precise times for gapless playback
- ✅ No audible gaps between chunks (verified manually)
- ✅ Play/pause/stop controls work correctly
- ✅ Playback speed change applies to all scheduled sources
- ✅ Seeking disabled with clear error message during generation
- ✅ Memory sliding window keeps max 5 chunks in memory
- ✅ Old chunks evicted as playback progresses
- ✅ Works with 1 chunk (short chapters) and 20+ chunks (long chapters)
- ✅ All unit tests pass

#### Rollback Plan

If Web Audio API causes issues:
1. Keep existing `useAudioPlayer` hook unchanged
2. Add prop to `AudioPlayer` component: `useProgressiveMode={false}`
3. Only use `useProgressiveAudioPlayer` if prop is true
4. Default to standard HTML5 Audio player
5. Enable progressive mode per-user for testing

---

### Phase 4: UI Integration & Polish (User Experience)

**Duration**: 6-8 hours
**Dependencies**: Phase 3 complete
**Risk Level**: Low

#### Goals

- Update `AudioPlayer` component with progressive status
- Show "Playing chunk 2/5, generating 3/5"
- Handle edge cases (seeking disabled, cancellation, errors)
- Add UI polish (loading states, animations)
- End-to-end testing
- Performance optimization

#### Detailed Tasks

##### Task 4.1: Update AudioPlayer Component (3 hours)

**File**: `components/reader/AudioPlayer.tsx`

**MODIFY**: Interface to add progressive fields (line 7):

```typescript
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
  syncEnabled?: boolean;
  onToggleSync?: () => void;

  // NEW: Progressive streaming fields
  isProgressive?: boolean;
  chunksLoaded?: number;
  totalChunks?: number;
  isGenerating?: boolean;
}
```

**ADD**: Progressive status display (after line 128):

```typescript
{/* Progressive Streaming Status */}
{isProgressive && totalChunks > 1 && (
  <p className="text-xs text-gray-400 dark:text-gray-500">
    {isGenerating ? (
      <>
        Playing chunk {Math.min(chunksLoaded, totalChunks)}/{totalChunks}
        {chunksLoaded < totalChunks && (
          <span className="ml-1 text-sky-600 dark:text-sky-400">
            • Generating {chunksLoaded + 1}/{totalChunks}
          </span>
        )}
      </>
    ) : (
      `${totalChunks} chunks loaded`
    )}
  </p>
)}
```

**MODIFY**: Seek bar to show generation progress (line 83-106):

```typescript
<div
  className="relative h-1 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer mb-3"
  onMouseDown={isGenerating ? undefined : handleSeekStart}  // CHANGE: Disable if generating
  onMouseMove={isGenerating ? undefined : handleSeekMove}
  onMouseUp={isGenerating ? undefined : handleSeekEnd}
  onMouseLeave={isGenerating ? undefined : handleSeekEnd}
  role="slider"
  aria-label="Audio progress"
  aria-valuenow={Math.round(progress)}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-disabled={isGenerating}  // ADD
>
  {/* Playback Progress */}
  <div
    className="absolute h-full bg-sky-600 dark:bg-sky-400 rounded-full transition-all"
    style={{ width: `${progress}%` }}
  />

  {/* NEW: Generation Progress (behind playback progress) */}
  {isGenerating && totalChunks > 0 && (
    <div
      className="absolute h-full bg-sky-300 dark:bg-sky-700 rounded-full transition-all"
      style={{ width: `${(chunksLoaded / totalChunks) * 100}%` }}
    />
  )}

  {/* Seek Handle */}
  {duration > 0 && !isGenerating && (  // CHANGE: Hide handle during generation
    <div
      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-sky-600 dark:bg-sky-400 rounded-full shadow-md"
      style={{ left: `${progress}%`, marginLeft: '-6px' }}
    />
  )}
</div>

{/* NEW: Seeking disabled message */}
{isGenerating && (
  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
    Seeking available after generation completes
  </div>
)}
```

##### Task 4.2: Update ReaderView Integration (2 hours)

**File**: `components/reader/ReaderView.tsx` (or wherever AudioPlayer is used)

**MODIFY**: Switch between standard and progressive player:

```typescript
// ADD: Check if audio file is progressive
const [isProgressiveAudio, setIsProgressiveAudio] = useState(false);
const [audioFileId, setAudioFileId] = useState<number | null>(null);

// On first chunk ready callback
const handleFirstChunkReady = useCallback((chapterId: number, audioFileId: number) => {
  console.log('[ReaderView] First chunk ready, starting progressive playback');
  setIsProgressiveAudio(true);
  setAudioFileId(audioFileId);

  // Switch to progressive player
  // (Implementation depends on your component structure)
}, []);

// Use appropriate player based on audio type
const {
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
  // Progressive-specific
  chunksLoaded,
  totalChunks,
  isGenerating,
} = isProgressiveAudio
  ? useProgressiveAudioPlayer({
      chapter: currentAudioChapter,
      onTimeUpdate: handleAudioTimeUpdate,
      onEnded: handleAudioEnded,
    })
  : useAudioPlayer({
      chapter: currentAudioChapter,
      onTimeUpdate: handleAudioTimeUpdate,
      onEnded: handleAudioEnded,
    });

// Pass to AudioPlayer component
<AudioPlayer
  chapter={currentAudioChapter}
  playing={playing}
  currentTime={currentTime}
  duration={duration}
  playbackSpeed={playbackSpeed}
  loading={loading}
  onPlay={play}
  onPause={pause}
  onSeek={seek}
  onSpeedChange={setSpeed}
  onClose={handleCloseAudio}
  isProgressive={isProgressiveAudio}
  chunksLoaded={chunksLoaded}
  totalChunks={totalChunks}
  isGenerating={isGenerating}
/>
```

##### Task 4.3: Error Handling & Edge Cases (2 hours)

**Add error boundaries**:

```typescript
// In AudioPlayer.tsx
{error && (
  <div className="absolute top-0 left-0 right-0 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm">
    <div className="flex items-center justify-between">
      <span>{error}</span>
      <button
        onClick={() => setError(null)}
        className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
      >
        Dismiss
      </button>
    </div>
  </div>
)}
```

**Handle generation cancellation gracefully**:

```typescript
// In useAudioGeneration.ts
const cancelGeneration = useCallback(() => {
  if (abortController) {
    abortController.abort();

    // Mark audio file as incomplete but keep chunks
    if (audioFileId) {
      updateAudioFileProgress(audioFileId, chunks.length).catch(console.error);

      // Show user-friendly message
      setError(`Generation cancelled. ${chunks.length} of ${totalChunks} chunks saved. You can resume later.`);
    }

    setAbortController(null);
    setGenerating(false);
  }
}, [abortController, audioFileId, chunks, totalChunks]);
```

**Handle playback errors**:

```typescript
// In useProgressiveAudioPlayer.ts
source.onerror = (err) => {
  console.error(`[useProgressiveAudioPlayer] Playback error on chunk ${chunk.chunkIndex}:`, err);
  setError(`Playback error on chunk ${chunk.chunkIndex + 1}. Skipping to next chunk.`);

  // Try to continue with next chunk
  const nextChunk = scheduledChunksRef.current.find(
    s => s.chunkIndex === chunk.chunkIndex + 1
  );
  if (nextChunk) {
    // Schedule next chunk immediately
  }
};
```

##### Task 4.4: Performance Optimization (1 hour)

**Batch IndexedDB writes**:

```typescript
// In useAudioGeneration.ts
const chunkBuffer: AudioChunk[] = [];
const BATCH_SIZE = 3;

// Inside audio_chunk event handler
chunkBuffer.push(chunk);

if (chunkBuffer.length >= BATCH_SIZE) {
  // Bulk save
  await saveAudioChunks(chunkBuffer.splice(0, BATCH_SIZE));
}

// On generation_complete, flush remaining
if (chunkBuffer.length > 0) {
  await saveAudioChunks(chunkBuffer);
}
```

**Optimize memory usage**:

```typescript
// In useProgressiveAudioPlayer.ts
// After chunk has played, release its buffer
source.onended = () => {
  // Free memory
  chunkBufferMapRef.current.delete(chunk.chunkIndex);

  // Trigger garbage collection hint (if available)
  if (global.gc) {
    global.gc();
  }
};
```

#### Success Criteria

- ✅ UI shows "Playing chunk 2/5, generating 3/5" during generation
- ✅ Seek bar displays both playback and generation progress
- ✅ Seeking disabled with tooltip during generation
- ✅ Error messages clear and actionable
- ✅ Cancellation saves partial progress
- ✅ No UI stuttering or lag during chunk transitions
- ✅ Performance acceptable (< 50ms chunk scheduling latency)
- ✅ Memory usage stays under 50MB for 20+ chunk chapters
- ✅ End-to-end manual testing passes all scenarios

#### End-to-End Testing Scenarios

1. **Short Chapter (1 chunk)**
   - Generate audio for < 4096 char chapter
   - ✅ Playback starts immediately after generation
   - ✅ No "chunk X/Y" status shown (only 1 chunk)

2. **Medium Chapter (3-5 chunks)**
   - Generate audio for ~15,000 char chapter
   - ✅ First chunk plays within 10 seconds
   - ✅ Status shows "Playing chunk 1/4, generating 2/4"
   - ✅ Seamless transition between chunks (no gaps)
   - ✅ Generation completes while user listens

3. **Long Chapter (10+ chunks)**
   - Generate audio for 50,000+ char chapter
   - ✅ First chunk plays quickly
   - ✅ Memory stays under 50MB (check DevTools Memory profiler)
   - ✅ Old chunks evicted from memory as playback progresses

4. **Cancellation**
   - Start generation, cancel after 2 chunks
   - ✅ Chunks 1-2 saved to IndexedDB
   - ✅ Can play partial audio
   - ✅ Can resume generation later (future enhancement)

5. **Error Recovery**
   - Simulate network error during chunk 3
   - ✅ Error message displayed
   - ✅ Chunks 1-2 still playable
   - ✅ Can retry generation

6. **Browser Compatibility**
   - Test in Chrome, Firefox, Safari, Edge
   - ✅ Web Audio API works in all browsers
   - ✅ Gapless playback verified manually (no clicks/pops)

#### Rollback Plan

If UI integration causes issues:
1. Add feature flag in environment: `NEXT_PUBLIC_ENABLE_PROGRESSIVE_AUDIO=false`
2. Conditionally render old vs new player based on flag
3. Deploy with flag disabled
4. Enable flag per-user for testing
5. Gradually roll out to all users

---

## Migration Strategy

### Database Migration (Phase 1)

**Approach**: Dexie handles schema upgrades automatically via version increments.

**Migration Path**:
1. Add version 5 schema with `audioChunks` table
2. Existing `audioFiles` data unchanged (uses optional fields)
3. New audio generations create progressive entries
4. Old audio files continue to work (single-blob mode)

**Backwards Compatibility**:
```typescript
// Check if audio file is progressive or single-blob
if (audioFile.isProgressive) {
  // Use progressive player
  const chunks = await getAudioChunks(audioFile.id);
  await playChunksProgressively(chunks);
} else {
  // Use standard player
  const blob = audioFile.blob;
  playStandardAudio(blob);
}
```

**Cleanup Strategy** (optional, for storage optimization):
```typescript
// Convert old single-blob audio to chunks (background task)
async function migrateAudioToChunks(audioFileId: number) {
  const audioFile = await getAudioFile(audioFileId);

  if (audioFile.isProgressive || !audioFile.blob) {
    return; // Already progressive or no blob
  }

  // Split blob into chunks (requires re-decoding and splitting)
  // This is complex - skip for MVP, keep dual storage
}
```

### Code Deployment Strategy

**Phase-by-Phase Deployment**:

1. **Phase 1 Deploy**: Database schema
   - Deploy schema changes
   - Monitor IndexedDB errors in Sentry/logs
   - Verify schema upgrade works across browsers
   - No UI changes yet (safe)

2. **Phase 2 Deploy**: API + Client reception
   - Deploy behind feature flag: `NEXT_PUBLIC_PROGRESSIVE_STREAMING=false`
   - Enable flag for internal testing
   - Monitor SSE performance and chunk save errors
   - Verify chunks appear in IndexedDB

3. **Phase 3 Deploy**: Progressive player
   - Deploy player hook
   - Keep disabled by default (flag)
   - Enable for 10% of users (A/B test)
   - Monitor playback errors and memory usage

4. **Phase 4 Deploy**: UI integration
   - Deploy UI changes
   - Enable for 50% of users
   - Monitor user feedback and error rates
   - Full rollout after 1 week of stability

### Feature Flag Implementation

```typescript
// lib/feature-flags.ts
export function isProgressiveStreamingEnabled(): boolean {
  // Check environment variable
  if (process.env.NEXT_PUBLIC_PROGRESSIVE_STREAMING === 'false') {
    return false;
  }

  // Check localStorage override (for testing)
  if (typeof window !== 'undefined') {
    const override = localStorage.getItem('progressive_streaming_enabled');
    if (override !== null) {
      return override === 'true';
    }
  }

  // Default: enabled
  return true;
}
```

Usage:
```typescript
// In useAudioGeneration.ts
if (isProgressiveStreamingEnabled()) {
  // Use new chunk streaming logic
} else {
  // Use old concatenation logic
}
```

---

## Testing Strategy

### Unit Tests

**Coverage Targets**:
- Database functions: 95% coverage
- Audio player hooks: 85% coverage
- Utility functions: 90% coverage

**Test Files**:
1. `lib/__tests__/db-audio-chunks.test.ts` - Chunk storage CRUD
2. `hooks/__tests__/useProgressiveAudioPlayer.test.ts` - Player logic
3. `hooks/__tests__/useAudioGeneration-progressive.test.ts` - Generation flow
4. `components/__tests__/AudioPlayer-progressive.test.tsx` - UI rendering

**Run Tests**:
```bash
npm test -- --coverage --testPathPattern="progressive"
```

### Integration Tests

**Test Scenarios**:
1. Full generation flow (API → client → storage)
2. Chunk streaming and saving
3. Progressive playback from IndexedDB
4. Cancellation and error recovery

**Test Framework**: Playwright or Cypress for E2E

**Example Test**:
```typescript
test('should play audio progressively as chunks arrive', async ({ page }) => {
  await page.goto('/reader/book/1');

  // Generate audio
  await page.click('[data-testid="generate-audio"]');

  // Wait for first chunk (< 10 seconds)
  await page.waitForSelector('[data-testid="audio-player"]', { timeout: 10000 });

  // Verify playing
  const playButton = page.locator('[aria-label="Pause"]');
  await expect(playButton).toBeVisible();

  // Verify chunk status
  const status = page.locator('[data-testid="audio-status"]');
  await expect(status).toContainText(/Playing chunk \d+\/\d+/);

  // Wait for generation to complete
  await page.waitForSelector('[data-testid="generation-complete"]', { timeout: 60000 });

  // Verify all chunks loaded
  await expect(status).toContainText(/\d+ chunks loaded/);
});
```

### Manual Testing

**Test Plan**:

**Pre-Flight Checklist**:
- [ ] Clear IndexedDB before testing
- [ ] Open DevTools (Network, Console, Application tabs)
- [ ] Test in Chrome, Firefox, Safari, Edge
- [ ] Use headphones to detect audio gaps

**Scenarios**:

1. **Basic Progressive Playback**
   - [ ] Generate audio for 15,000 char chapter
   - [ ] Verify first chunk plays within 10 seconds
   - [ ] Listen for gaps between chunks (should be silent)
   - [ ] Check IndexedDB has chunks saved
   - [ ] Verify "Playing chunk X/Y" status updates

2. **Memory Management**
   - [ ] Generate audio for 50,000+ char chapter (15+ chunks)
   - [ ] Open DevTools Memory profiler
   - [ ] Take heap snapshot before playback
   - [ ] Play through entire chapter
   - [ ] Take heap snapshot after
   - [ ] Verify memory increase < 50MB

3. **Cancellation & Resume**
   - [ ] Start generation
   - [ ] Cancel after 3 chunks
   - [ ] Verify chunks 1-3 in IndexedDB
   - [ ] Close and reopen reader
   - [ ] Verify partial audio playable
   - [ ] Resume generation (future: verify starts at chunk 4)

4. **Error Handling**
   - [ ] Simulate network error (DevTools → Network → Offline)
   - [ ] Verify error message shown
   - [ ] Reconnect network
   - [ ] Verify can retry

5. **Performance**
   - [ ] Generate audio while scrolling reader
   - [ ] Verify no UI lag or stuttering
   - [ ] Monitor CPU usage (< 30% during generation)
   - [ ] Check Network tab: chunks arrive sequentially

6. **Backwards Compatibility**
   - [ ] Load book with old single-blob audio
   - [ ] Verify standard player used
   - [ ] Playback works normally
   - [ ] Generate new audio for same chapter
   - [ ] Verify new audio uses progressive mode

**Pass Criteria**:
- All 6 scenarios pass without critical issues
- No audio gaps or clicks detected
- Memory usage acceptable
- Performance acceptable

---

## Risk Assessment & Mitigation

### Technical Risks

#### Risk 1: Audio Gaps Between Chunks (HIGH PRIORITY)

**Likelihood**: Medium
**Impact**: High (poor UX)
**Mitigation**:
- Use Web Audio API precise scheduling (tested in research)
- Schedule all chunks at exact times using `source.start(time)`
- Add 5ms overlap if gaps detected during testing
- Extensive manual testing with headphones to detect gaps
- Automated audio analysis to measure silence between chunks

**Fallback**:
- If gaps persist, add crossfade between chunks (10ms)
- If crossfade fails, fall back to single-blob concatenation

---

#### Risk 2: Memory Leaks from AudioBuffer Accumulation (MEDIUM PRIORITY)

**Likelihood**: Medium
**Impact**: Medium (browser slowdown, crashes)
**Mitigation**:
- Implement sliding window (max 5 chunks in memory)
- Evict old chunks after playback
- Monitor memory usage in DevTools during testing
- Add memory usage alerts in production (Sentry)

**Fallback**:
- Reduce window size to 3 chunks
- Force garbage collection after each chunk (if available)
- Limit progressive playback to < 20 chunks

---

#### Risk 3: IndexedDB Transaction Overhead (LOW PRIORITY)

**Likelihood**: Low
**Impact**: Low (slower generation, slight UI lag)
**Mitigation**:
- Batch chunk saves using `bulkAdd()` (3-5 chunks per transaction)
- Use in-memory buffer during generation
- Flush to IndexedDB asynchronously (non-blocking)

**Fallback**:
- Increase batch size to 10 chunks
- If still slow, fall back to single-blob storage

---

#### Risk 4: Seeking Complexity (MEDIUM PRIORITY)

**Likelihood**: High (intentionally deferred)
**Impact**: Low (feature limitation, not blocker)
**Mitigation**:
- Disable seeking during generation (clear message)
- Disable seeking for progressive playback initially (MVP)
- Plan Phase 5 for seeking implementation (re-create sources at seek time)

**Acceptance**:
- Seeking is nice-to-have, not critical for progressive streaming
- Users can still pause/play, adjust speed
- Full seeking available after generation completes (convert to single blob)

---

#### Risk 5: Browser Compatibility Issues (LOW PRIORITY)

**Likelihood**: Low
**Impact**: Medium (broken playback in specific browser)
**Mitigation**:
- Web Audio API has universal support (Chrome 33+, Firefox 25+, Safari 6+)
- Test in all major browsers during Phase 3
- Add browser detection and graceful degradation

**Fallback**:
- If Web Audio API unavailable, fall back to standard player
- Show message: "Progressive streaming not supported in this browser"

---

### Operational Risks

#### Risk 6: Production Deployment Failure (MEDIUM PRIORITY)

**Likelihood**: Low
**Impact**: High (site downtime, broken audio)
**Mitigation**:
- Deploy behind feature flag (disabled by default)
- Phase-by-phase rollout (1% → 10% → 50% → 100%)
- Monitor error rates in Sentry after each phase
- Automated rollback if error rate > 5%

**Rollback Plan**:
- Disable feature flag via environment variable (no code deploy needed)
- Hot-patch API route to revert to concatenation
- IndexedDB schema migration is non-destructive (old data works)

---

#### Risk 7: User Data Loss (LOW PRIORITY)

**Likelihood**: Very Low
**Impact**: Medium (user must re-generate audio)
**Mitigation**:
- IndexedDB is durable (persists across sessions)
- Dexie handles schema upgrades safely
- Test migration path thoroughly before production
- Keep old single-blob audio as backup

**Acceptance**:
- Audio can be re-generated (not irreplaceable data)
- Cost is time, not data loss (TTS API calls can be repeated)

---

### Business Risks

#### Risk 8: Increased API Costs (LOW PRIORITY)

**Likelihood**: Low
**Impact**: Low (negligible cost increase)
**Mitigation**:
- Progressive streaming doesn't change API calls (same chunks)
- No additional OpenAI requests
- Potential cost savings from cancellation (avoid generating unused chunks)

**Monitoring**:
- Track API usage before and after rollout
- Alert if cost increases > 10%

---

#### Risk 9: User Confusion from UI Changes (LOW PRIORITY)

**Likelihood**: Low
**Impact**: Low (support requests, confusion)
**Mitigation**:
- Add tooltip explaining "Playing chunk 2/5" status
- Show loading indicator during first chunk generation
- Provide clear error messages
- A/B test UI changes before full rollout

**Acceptance**:
- Progressive streaming is a clear UX improvement (faster playback)
- Users will adapt quickly to new status display

---

## Performance Considerations

### Client-Side Performance

**Memory Usage**:
- **Target**: < 50MB for 20+ chunk chapters
- **Monitoring**: Chrome DevTools Memory profiler
- **Optimization**: Sliding window eviction (5 chunks max)

**CPU Usage**:
- **Target**: < 30% CPU during generation and playback
- **Monitoring**: Chrome DevTools Performance profiler
- **Optimization**: Async chunk decoding, batched IndexedDB writes

**Network Usage**:
- **Target**: Same as current implementation (SSE already streaming)
- **Monitoring**: Network tab, bytes transferred
- **Optimization**: Compress chunks if > 100KB each (future)

### Server-Side Performance

**API Route Response Time**:
- **Target**: First chunk < 5 seconds, subsequent chunks < 3 seconds each
- **Monitoring**: API logs, response time metrics
- **Optimization**: Already optimized (chunks generated sequentially)

**Memory Usage**:
- **Target**: No increase from current implementation
- **Monitoring**: Server memory metrics
- **Optimization**: Stream chunks immediately (don't buffer in memory)

### Database Performance

**IndexedDB Write Performance**:
- **Target**: < 50ms per chunk save
- **Monitoring**: Performance.now() timing logs
- **Optimization**: Bulk saves (3-5 chunks per transaction)

**IndexedDB Read Performance**:
- **Target**: < 100ms to load all chunks for a chapter
- **Monitoring**: Performance.now() timing logs
- **Optimization**: Indexed queries by audioFileId

---

## Security Considerations

### Data Privacy

**Concern**: Audio chunks stored in IndexedDB are accessible to any JavaScript on the domain.

**Mitigation**:
- IndexedDB is origin-scoped (only same domain can access)
- No cross-origin sharing of audio data
- Audio data never sent to external servers (except OpenAI for generation)

**Acceptance**:
- Same security model as existing single-blob storage
- User audio data never leaves their browser after generation

### API Key Security

**Concern**: OpenAI API key exposed in client-side code.

**Mitigation**:
- API key stored in `.env.local` (server-side only)
- API route proxies requests to OpenAI (key never sent to client)
- Rate limiting on API route (prevent abuse)

**Acceptance**:
- No changes to existing security model
- Progressive streaming doesn't affect API key security

### Input Validation

**Concern**: Malicious chapter text could exploit API or cause errors.

**Mitigation**:
- Sanitize input (remove control characters) - already implemented
- Validate chunk size (max 4096 chars) - already implemented
- Validate total text length (max 100,000 chars) - already implemented

**Acceptance**:
- No new attack surface from progressive streaming
- Same validation as current implementation

---

## Documentation Requirements

### Developer Documentation

1. **Architecture Overview** (this document)
   - System architecture diagram
   - Component interaction sequence diagram
   - Data flow explanation

2. **API Documentation**
   - SSE event types and payloads
   - `audio_chunk` event schema
   - `generation_complete` event schema

3. **Hook Documentation**
   - `useProgressiveAudioPlayer` API reference
   - Props, return values, usage examples
   - Migration guide from `useAudioPlayer`

4. **Database Schema Documentation**
   - `audioChunks` table schema
   - Indexes and relationships
   - Query patterns and performance

### User Documentation

1. **Feature Announcement**
   - "Audio now starts playing sooner!"
   - Explain progressive loading
   - Show example of chunk status

2. **FAQ**
   - "Why can't I seek during generation?"
   - "What happens if I cancel generation?"
   - "Can I resume a cancelled generation?"

3. **Troubleshooting Guide**
   - "Audio playback is choppy" → Check memory usage
   - "Chunks not loading" → Check IndexedDB storage
   - "Generation stuck" → Cancel and retry

---

## Future Enhancements (Post-MVP)

### Phase 5: Seeking During Progressive Playback

**Description**: Enable seeking to any position, even during generation.

**Implementation**:
- Re-create AudioBufferSourceNodes at seek position
- Load and schedule chunks on-demand from seek point
- Preload chunks around seek position (sliding window)

**Complexity**: High (6-8 hours)

---

### Phase 6: Resume Incomplete Generations

**Description**: Resume generation from last saved chunk if interrupted.

**Implementation**:
- Track `chunksComplete` in `audioFiles` table
- On load, check if `isComplete === false`
- Show "Resume generation" button in UI
- API route accepts `startFromChunk` parameter

**Complexity**: Medium (4-6 hours)

---

### Phase 7: Chunk Compression

**Description**: Compress chunks before saving to IndexedDB to reduce storage.

**Implementation**:
- Use CompressionStream API (Gzip)
- Compress chunks before `saveAudioChunk()`
- Decompress on load before `decodeAudioData()`

**Complexity**: Low (2-3 hours)
**Storage Savings**: ~30-40% reduction

---

### Phase 8: Adaptive Chunk Size

**Description**: Dynamically adjust chunk size based on chapter length.

**Implementation**:
- For short chapters (< 8192 chars): 1 chunk (no streaming needed)
- For medium chapters (8192-20000 chars): 2048 char chunks
- For long chapters (> 20000 chars): 4096 char chunks

**Complexity**: Low (2-3 hours)
**Benefit**: Fewer chunks for short chapters, faster for long chapters

---

### Phase 9: Background Generation

**Description**: Generate audio in background while user reads, without explicit "Generate" click.

**Implementation**:
- Detect when user stays on chapter for > 30 seconds
- Auto-generate audio in background (low priority)
- Show non-intrusive notification when ready
- Respect user bandwidth settings

**Complexity**: Medium (4-6 hours)
**UX Impact**: High (truly seamless audio availability)

---

## Appendix

### Glossary

- **AudioBuffer**: Decoded PCM audio data in Web Audio API
- **AudioContext**: Web Audio API playback engine
- **CFI (Canonical Fragment Identifier)**: EPUB location reference
- **Chunk**: 4096-character segment of chapter text (OpenAI TTS limit)
- **Gapless Playback**: Seamless audio transition without silence
- **IndexedDB**: Browser-based database for large data storage
- **MP3**: Compressed audio format returned by OpenAI TTS
- **Progressive Streaming**: Playing content while it's still loading
- **SSE (Server-Sent Events)**: One-way server-to-client real-time messaging
- **Web Audio API**: Browser API for advanced audio processing

### Related Files

**Database**:
- `lib/db.ts` - IndexedDB schema and CRUD functions
- `types/index.ts` - TypeScript interfaces

**API**:
- `app/api/tts/generate-stream/route.ts` - TTS generation endpoint

**Hooks**:
- `hooks/useAudioGeneration.ts` - Audio generation logic
- `hooks/useAudioPlayer.ts` - Standard audio player (single-blob)
- `hooks/useProgressiveAudioPlayer.ts` - Progressive audio player (NEW)

**Components**:
- `components/reader/AudioPlayer.tsx` - Audio player UI
- `components/reader/ReaderView.tsx` - Main reader component

**Utils**:
- `lib/epub-utils.ts` - EPUB text extraction
- `lib/sentence-parser.ts` - Sentence synchronization

### References

- [Web Audio API Specification](https://www.w3.org/TR/webaudio/)
- [MediaSource Extensions Specification](https://www.w3.org/TR/media-source/)
- [OpenAI TTS API Documentation](https://platform.openai.com/docs/guides/text-to-speech)
- [Dexie.js Documentation](https://dexie.org/)
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)

### Research Documents

- `thoughts/research/2025-11-10-progressive-audio-streaming-for-tts-generation.md` - Technical research and feasibility study
- `thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md` - Original TTS implementation plan

---

## Summary

This implementation plan provides a comprehensive, phase-by-phase approach to implementing progressive audio streaming for TTS generation in the EPUB reader. The plan prioritizes:

1. **User Experience**: Start playback within 10 seconds (vs. 60+ seconds currently)
2. **Technical Soundness**: Web Audio API for gapless playback, proven in research
3. **Risk Management**: Feature flags, phased rollout, comprehensive testing
4. **Maintainability**: Clean architecture, isolated changes, backwards compatibility

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1: Database Schema & Chunk Storage
3. After each phase, conduct code review and testing checkpoint
4. Proceed to next phase only after previous phase passes success criteria

**Estimated Total Timeline**: 26-34 hours (3-4 weeks for one developer)

**Expected Impact**:
- **Time to First Audio**: 60+ seconds → < 10 seconds (6x improvement)
- **User Satisfaction**: Significantly improved (immediate playback)
- **Technical Debt**: None (clean, isolated implementation)
- **Risk**: Low (phased rollout, feature flags, extensive testing)
