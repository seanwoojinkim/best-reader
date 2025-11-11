---
doc_type: research
date: 2025-11-10T19:48:25+00:00
title: "Single Chunk Bug Investigation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T19:48:25+00:00"
research_question: "Why does getAudioChunks() return only 1 chunk even when user waits 30+ seconds after generation?"
research_type: codebase_research
researcher: Sean Kim

git_commit: ea687a42b3992630589580d17f62be24312e1672
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-10
last_updated_by: Sean Kim

tags:
  - audio
  - progressive-streaming
  - indexeddb
  - bug-investigation
status: complete

related_docs: []
---

# Research: Single Chunk Bug Investigation

**Date**: 2025-11-10T19:48:25+00:00
**Researcher**: Sean Kim
**Git Commit**: ea687a42b3992630589580d17f62be24312e1672
**Branch**: main
**Repository**: reader

## Research Question

Why does `getAudioChunks()` return only 1 chunk even when the user waits 30+ seconds after generation completes before clicking play?

**Critical Context**: The user reports that waiting eliminates transaction timing as a possible cause. If only 1 chunk is found, either:
1. Only 1 chunk is actually being saved to the database, OR
2. The other 4 chunks are being saved with the wrong audioFileId

## Summary

After comprehensive code analysis, the root cause has been identified: **The database schema allows multiple AudioFile records for the same chapter, and `getAudioFile()` returns `.first()` instead of the most recent record.**

When chunks are saved during generation, they use the NEW audioFileId. But when the player loads audio with `getAudioFile(chapterId)`, it may return an OLD AudioFile record from a previous generation attempt. This causes `getAudioChunks(oldAudioFileId)` to return chunks from the old generation (possibly just 1 chunk if that generation was cancelled or failed).

**This is NOT a race condition** - it's a data consistency issue caused by:
1. No unique constraint on `audioFiles.chapterId`
2. Using `.first()` instead of `.orderBy('generatedAt').last()` in getAudioFile()
3. Not cleaning up incomplete/cancelled AudioFile records

## Detailed Findings

### 1. Chunk Save Flow Analysis

**File**: `hooks/useAudioGeneration.ts:146-224`

The SSE event processing loop is **sequential and correctly blocks** on each async operation:

```typescript
for (const line of lines) {  // ← Sequential, NOT parallel
  if (eventType === 'audio_chunk') {
    if (data.index === 0) {
      // Line 198: Blocks until AudioFile is saved
      audioFileId = await saveAudioFile(audioFile);
      console.log(`[useAudioGeneration] Created audio file metadata, ID: ${audioFileId}`);
    }

    // Lines 203-214: Save chunk with correct audioFileId
    const chunk: Omit<AudioChunk, 'id'> = {
      audioFileId: audioFileId!,  // ← Set correctly for all chunks
      chunkIndex: data.index,
      blob: chunkBlob,
      duration: data.estimatedDuration,
      textStart: data.textStart,
      textEnd: data.textEnd,
      startTime: startTime,
      generatedAt: new Date(),
    };

    // Line 214: Atomic transaction to save chunk and update progress
    await saveChunkAndUpdateProgress(chunk, data.index + 1);
    console.log(`[useAudioGeneration] Saved chunk ${data.index} to IndexedDB`);
  }
}
```

**Key Observations**:
- `audioFileId` is declared at function scope (line 75), persisting across buffer reads
- Each `await` blocks the loop, ensuring sequential processing
- Chunk 0 creates AudioFile and sets `audioFileId` before processing chunk 1
- All chunks 1-4 use the same `audioFileId` from the function scope
- Console logging confirms each chunk save operation

**Conclusion**: All 5 chunks ARE being saved with the SAME audioFileId. The chunk save flow is correct.

### 2. AudioFileId Initialization and Propagation

**File**: `hooks/useAudioGeneration.ts:75,184-200`

```typescript
// Line 75: Function scope ensures persistence
let audioFileId: number | null = null;

// Lines 184-200: First chunk creates AudioFile
if (data.index === 0) {
  const audioFile: Omit<AudioFile, 'id'> = {
    chapterId: chapter.id,
    duration: 0,
    voice: voice,
    speed: speed,
    generatedAt: new Date(),
    sizeBytes: 0,
    totalChunks: data.total,
    chunksComplete: 0,
    isComplete: false,
    isProgressive: true,
  };

  // This returns the new auto-incremented ID
  audioFileId = await saveAudioFile(audioFile);
  console.log(`[useAudioGeneration] Created audio file metadata, ID: ${audioFileId}`);
}
```

The audioFileId is correctly:
1. Initialized to null at function scope
2. Set when chunk 0 creates the AudioFile
3. Reused for all subsequent chunks in the same generation
4. Logged for debugging

**Conclusion**: audioFileId propagation is correct. No race condition exists.

### 3. IndexedDB Schema Analysis

**File**: `lib/db.ts:64-76`

```typescript
// Version 5: Add progressive audio streaming support
this.version(5).stores({
  books: '++id, title, author, addedAt, lastOpenedAt, *tags',
  positions: 'bookId, updatedAt',
  sessions: '++id, bookId, startTime, endTime',
  highlights: '++id, bookId, cfiRange, color, createdAt',
  analytics: '++id, sessionId, bookId, timestamp, event',
  chapters: '++id, bookId, order, cfiStart',
  audioFiles: '++id, chapterId, generatedAt',  // ← NO UNIQUE CONSTRAINT
  audioSettings: 'bookId, updatedAt',
  audioUsage: '++id, chapterId, bookId, timestamp',
  sentenceSyncData: '++id, audioFileId, chapterId, generatedAt',
  audioChunks: '++id, audioFileId, [audioFileId+chunkIndex], chunkIndex, generatedAt',
});
```

**CRITICAL ISSUE FOUND**:

The `audioFiles` table has NO unique constraint on `chapterId`. This means:
- Multiple AudioFile records can exist for the same chapter
- Previous generation attempts (cancelled, failed, or completed) remain in the database
- Each AudioFile has its own set of chunks

**Type Definition**:

**File**: `types/index.ts:160-170`

```typescript
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
```

The `audioFileId` is a **required field** (not nullable), so all chunks MUST have a valid audioFileId to be saved.

**Compound Index**: `[audioFileId+chunkIndex]` creates an efficient compound index for querying chunks by audioFileId and ensuring uniqueness within an audioFile.

### 4. The getAudioFile() Bug

**File**: `lib/db.ts:418-422`

```typescript
/**
 * Get audio file for a chapter
 */
export async function getAudioFile(chapterId: number): Promise<AudioFile | undefined> {
  return await db.audioFiles.where('chapterId').equals(chapterId).first();
  // ↑ BUG: Returns FIRST record, not most recent
}
```

**THE ROOT CAUSE**:

`.first()` returns the **oldest** AudioFile record for the chapter (lowest auto-increment ID), NOT the most recent one!

**Example Scenario**:
1. User generates audio → creates `audioFiles[id=1, chapterId=5]` with 5 chunks
2. User cancels and regenerates → creates `audioFiles[id=2, chapterId=5]` with 5 NEW chunks
3. User cancels again and regenerates → creates `audioFiles[id=3, chapterId=5]` with 5 NEW chunks
4. When user clicks play, `getAudioFile(5)` returns `audioFiles[id=1]` (the FIRST/oldest)
5. `getAudioChunks(1)` returns chunks from the FIRST generation (which was cancelled, so only 1 chunk exists)

### 5. The getAudioChunks() Function

**File**: `lib/db.ts:585-597`

```typescript
/**
 * Get all audio chunks for an audio file, sorted by chunk index
 */
export async function getAudioChunks(
  audioFileId: number
): Promise<AudioChunk[]> {
  try {
    return await db.audioChunks
      .where('audioFileId')
      .equals(audioFileId)
      .sortBy('chunkIndex');
  } catch (error) {
    console.error(`[getAudioChunks] Failed to get chunks for audio ${audioFileId}:`, error);
    throw new Error(`Failed to retrieve audio chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

This function is **correct** - it properly queries by audioFileId and sorts by chunkIndex.

**The problem**: It's being called with the WRONG audioFileId (from an old generation).

### 6. When and Where getAudioChunks() Is Called

**File**: `hooks/useProgressiveAudioPlayer.ts:338-374`

```typescript
const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
  // ...

  try {
    // Line 340: Get audio file metadata
    const audioFile = await getAudioFile(chapterToLoad.id);
    // ↑ BUG: This returns the OLDEST AudioFile, not the most recent

    if (!audioFile) {
      throw new Error('Audio not generated for this chapter');
    }

    audioFileIdRef.current = audioFile.id!;  // ← Wrong ID stored
    setTotalChunks(audioFile.totalChunks || 0);
    setIsGenerating(!audioFile.isComplete);

    // Line 356: Get all available chunks
    let chunks = await getAudioChunks(audioFile.id!);
    // ↑ Queries with WRONG audioFileId (from old generation)

    // Lines 359-366: Retry logic (won't help if querying wrong audioFileId)
    if (chunks.length === 0) {
      for (let retry = 0; retry < 3; retry++) {
        console.log(`[useProgressiveAudioPlayer] No chunks found, retrying (${retry + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        chunks = await getAudioChunks(audioFile.id!);
        // ↑ Still querying wrong audioFileId
        if (chunks.length > 0) break;
      }
    }

    console.log(`[useProgressiveAudioPlayer] Found ${chunks.length} chunks`);
    // ↑ This logs "Found 1 chunks" because it's querying the OLD audioFile
  } catch (err) {
    console.error('[useProgressiveAudioPlayer] Error loading chapter:', err);
  }
}, [scheduleChunk]);
```

**The Flow**:
1. User generates audio → NEW AudioFile (id=3) created with 5 chunks
2. User waits 30 seconds (generation completes)
3. User clicks play
4. `loadChapter()` calls `getAudioFile(chapterId)` → returns OLDEST AudioFile (id=1)
5. `getAudioChunks(1)` returns chunks from OLD generation (only 1 chunk if cancelled early)
6. Player loads only 1 chunk

### 7. Transaction Behavior in saveChunkAndUpdateProgress

**File**: `lib/db.ts:705-734`

```typescript
/**
 * Save a chunk and update audio file progress atomically
 * This prevents inconsistent state if one operation fails
 */
export async function saveChunkAndUpdateProgress(
  chunk: Omit<AudioChunk, 'id'>,
  chunksComplete: number
): Promise<number> {
  try {
    return await db.transaction('rw', db.audioChunks, db.audioFiles, async () => {
      // Save the chunk
      let chunkId: number;
      try {
        chunkId = await db.audioChunks.add(chunk);
      } catch (error) {
        console.error(`[saveChunkAndUpdateProgress] Failed to add chunk ${chunk.chunkIndex}:`, error);
        throw new Error(`Failed to save chunk ${chunk.chunkIndex} to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Update the progress
      try {
        await db.audioFiles.update(chunk.audioFileId, { chunksComplete });
      } catch (error) {
        console.error(`[saveChunkAndUpdateProgress] Failed to update progress for audio ${chunk.audioFileId}:`, error);
        throw new Error(`Failed to update audio file progress (audioFileId: ${chunk.audioFileId}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return chunkId;
    });
  } catch (error) {
    // Transaction already rolled back by Dexie
    throw error; // Re-throw with context from inner catch blocks
  }
}
```

**Analysis**:
- Transaction is correctly scoped to both tables
- Errors are properly logged and re-thrown
- If chunk save fails, transaction rolls back (progress not updated)
- If progress update fails, transaction rolls back (chunk not saved)

**Error Handling in useAudioGeneration**:

If `saveChunkAndUpdateProgress()` throws an error, it propagates to the catch block at `useAudioGeneration.ts:320`, which logs the error and sets the error state. The user would see an error message.

**Conclusion**: Transaction behavior is correct. Errors would be visible in console logs.

## Code References

### Critical Bug Locations

- `lib/db.ts:420` - **BUG**: `getAudioFile()` uses `.first()` instead of ordering by generatedAt
- `lib/db.ts:44` - **SCHEMA ISSUE**: No unique constraint on `audioFiles.chapterId`
- `hooks/useProgressiveAudioPlayer.ts:340` - Calls buggy `getAudioFile()` which returns wrong AudioFile
- `hooks/useProgressiveAudioPlayer.ts:356` - Queries chunks with wrong audioFileId

### Correct Implementation References

- `hooks/useAudioGeneration.ts:146-224` - Chunk save flow (CORRECT)
- `hooks/useAudioGeneration.ts:75` - audioFileId function scope (CORRECT)
- `lib/db.ts:585-597` - `getAudioChunks()` query logic (CORRECT)
- `lib/db.ts:705-734` - `saveChunkAndUpdateProgress()` transaction (CORRECT)

## Architecture Documentation

### Current Data Model

```
audioFiles (multiple records per chapter)
├── id (PK, auto-increment)
├── chapterId (FK, NOT UNIQUE)  ← PROBLEM
├── generatedAt (Date)
├── isComplete (boolean)
└── totalChunks (number)

audioChunks (multiple per audioFile)
├── id (PK, auto-increment)
├── audioFileId (FK, required)  ← Links to specific AudioFile
├── chunkIndex (0-based)
├── blob (Blob)
└── ... (metadata)
```

**Current Behavior**:
- Each generation creates a NEW AudioFile record
- Old AudioFile records are NEVER cleaned up
- `.first()` returns the OLDEST record (lowest ID)
- Chunks from different generations are isolated by audioFileId

### Why Multiple AudioFile Records Exist

**Scenarios**:
1. User cancels generation midway → incomplete AudioFile remains
2. User regenerates same chapter with different voice → new AudioFile created
3. User regenerates same chapter with different speed → new AudioFile created
4. Generation fails → incomplete AudioFile remains

**Current Cleanup**:

**File**: `hooks/useAudioGeneration.ts:324-334`

```typescript
if (err.name === 'AbortError' || err.message === 'Generation cancelled') {
  setError('Generation cancelled');

  // Clean up partial generation
  if (audioFileId) {
    console.log(`[useAudioGeneration] Cleaning up cancelled generation, audioFileId: ${audioFileId}`);
    try {
      await deleteAudioChunks(audioFileId);
      await db.audioFiles.delete(audioFileId);
    } catch (cleanupError) {
      console.error('[useAudioGeneration] Failed to clean up cancelled generation:', cleanupError);
    }
  }
}
```

Cleanup only happens:
- When generation is explicitly cancelled (AbortError)
- If audioFileId was successfully set before cancellation
- If cleanup itself doesn't throw an error

**Cleanup Failures**:
- If user closes browser during generation → no cleanup
- If user navigates away → no cleanup
- If cleanup throws error → cleanup fails silently

## Diagnostic Logging Code

Add this code to verify the hypothesis and see the actual database state:

### In useProgressiveAudioPlayer.ts (after line 356)

```typescript
// DEBUG: Show what's actually in the database
console.log('[DEBUG] ==== DATABASE DIAGNOSTIC START ====');

// Show the audioFile we're using
console.log('[DEBUG] Current audioFile:', {
  id: audioFile.id,
  chapterId: audioFile.chapterId,
  generatedAt: audioFile.generatedAt,
  isComplete: audioFile.isComplete,
  totalChunks: audioFile.totalChunks,
});

// Get ALL AudioFiles for this chapter
const allAudioFilesForChapter = await db.audioFiles
  .where('chapterId')
  .equals(chapterToLoad.id)
  .toArray();
console.log('[DEBUG] All AudioFile records for this chapter:', allAudioFilesForChapter.map(af => ({
  id: af.id,
  generatedAt: af.generatedAt,
  isComplete: af.isComplete,
  totalChunks: af.totalChunks,
  chunksComplete: af.chunksComplete,
})));

// Get ALL chunks in the database
const allChunksInDB = await db.audioChunks.toArray();
console.log('[DEBUG] All AudioChunk records in database:', allChunksInDB.map(chunk => ({
  id: chunk.id,
  audioFileId: chunk.audioFileId,
  chunkIndex: chunk.chunkIndex,
})));

// Show chunks for EACH AudioFile
for (const af of allAudioFilesForChapter) {
  const chunksForAudioFile = allChunksInDB.filter(c => c.audioFileId === af.id);
  console.log(`[DEBUG] Chunks for AudioFile ${af.id}:`, chunksForAudioFile.length, 'chunks');
}

console.log('[DEBUG] ==== DATABASE DIAGNOSTIC END ====');
```

### In useAudioGeneration.ts (after line 199)

```typescript
// DEBUG: Verify audioFileId is set correctly
console.log('[DEBUG] AudioFile created:', {
  audioFileId,
  chapterId: chapter.id,
  expectedTotalChunks: data.total,
});

// Verify it was actually saved
const verifyAudioFile = await db.audioFiles.get(audioFileId);
console.log('[DEBUG] Verified AudioFile in DB:', verifyAudioFile ? 'EXISTS' : 'NOT FOUND');
```

### Expected Output (Confirming the Bug)

If the hypothesis is correct, you'll see:

```
[DEBUG] ==== DATABASE DIAGNOSTIC START ====
[DEBUG] Current audioFile: { id: 1, chapterId: 5, generatedAt: "2025-11-10T10:00:00", isComplete: false, totalChunks: 5 }
[DEBUG] All AudioFile records for this chapter: [
  { id: 1, generatedAt: "2025-11-10T10:00:00", isComplete: false, totalChunks: 5, chunksComplete: 1 },
  { id: 2, generatedAt: "2025-11-10T10:05:00", isComplete: false, totalChunks: 5, chunksComplete: 3 },
  { id: 3, generatedAt: "2025-11-10T10:10:00", isComplete: true, totalChunks: 5, chunksComplete: 5 }
]
[DEBUG] All AudioChunk records in database: [
  { id: 1, audioFileId: 1, chunkIndex: 0 },
  { id: 2, audioFileId: 2, chunkIndex: 0 },
  { id: 3, audioFileId: 2, chunkIndex: 1 },
  { id: 4, audioFileId: 2, chunkIndex: 2 },
  { id: 5, audioFileId: 3, chunkIndex: 0 },
  { id: 6, audioFileId: 3, chunkIndex: 1 },
  { id: 7, audioFileId: 3, chunkIndex: 2 },
  { id: 8, audioFileId: 3, chunkIndex: 3 },
  { id: 9, audioFileId: 3, chunkIndex: 4 }
]
[DEBUG] Chunks for AudioFile 1: 1 chunks  ← OLD generation (cancelled)
[DEBUG] Chunks for AudioFile 2: 3 chunks  ← OLD generation (cancelled)
[DEBUG] Chunks for AudioFile 3: 5 chunks  ← LATEST generation (complete)
[DEBUG] ==== DATABASE DIAGNOSTIC END ====
```

This shows:
- `getAudioFile(5)` returned AudioFile id=1 (the oldest)
- AudioFile id=1 only has 1 chunk (from cancelled generation)
- AudioFile id=3 has all 5 chunks (from latest complete generation)
- Player loaded wrong AudioFile

## Fix Strategy

### Option 1: Change getAudioFile() to Return Most Recent (Recommended)

**File**: `lib/db.ts:418-422`

```typescript
/**
 * Get audio file for a chapter (returns most recent)
 */
export async function getAudioFile(chapterId: number): Promise<AudioFile | undefined> {
  return await db.audioFiles
    .where('chapterId')
    .equals(chapterId)
    .reverse()  // Sort by ID descending (newest first)
    .first();   // Get the first (most recent)
}
```

**Better Alternative**:

```typescript
/**
 * Get most recent audio file for a chapter
 */
export async function getAudioFile(chapterId: number): Promise<AudioFile | undefined> {
  const audioFiles = await db.audioFiles
    .where('chapterId')
    .equals(chapterId)
    .sortBy('generatedAt');  // Sort by timestamp ascending

  return audioFiles[audioFiles.length - 1];  // Return last (most recent)
}
```

**Pros**:
- Minimal code change
- Fixes immediate issue
- No schema migration needed

**Cons**:
- Old AudioFile records still accumulate
- Wastes IndexedDB storage
- May have stale chunks in database

### Option 2: Add Unique Constraint + Cleanup (Best Long-term)

**File**: `lib/db.ts:64-76`

```typescript
// Version 6: Fix AudioFile uniqueness per chapter
this.version(6).stores({
  // ... same as version 5 ...
  audioFiles: '++id, &chapterId, generatedAt',  // ← & prefix = unique constraint
  // ... rest same ...
}).upgrade(async tx => {
  // Cleanup: Delete old AudioFiles, keep most recent per chapter
  const allAudioFiles = await tx.table('audioFiles').toArray();
  const filesByChapter = new Map<number, AudioFile[]>();

  // Group by chapterId
  for (const file of allAudioFiles) {
    if (!filesByChapter.has(file.chapterId)) {
      filesByChapter.set(file.chapterId, []);
    }
    filesByChapter.get(file.chapterId)!.push(file);
  }

  // Delete all but most recent for each chapter
  for (const [chapterId, files] of filesByChapter) {
    files.sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime());
    const toDelete = files.slice(0, -1);  // Keep last, delete rest

    for (const file of toDelete) {
      await tx.table('audioChunks').where('audioFileId').equals(file.id!).delete();
      await tx.table('sentenceSyncData').where('audioFileId').equals(file.id!).delete();
      await tx.table('audioFiles').delete(file.id!);
    }
  }
});
```

**File**: `hooks/useAudioGeneration.ts:184-200`

Before creating new AudioFile, delete old one:

```typescript
if (data.index === 0) {
  // Delete existing audio file for this chapter
  const existingAudioFile = await getAudioFile(chapter.id);
  if (existingAudioFile?.id) {
    console.log(`[useAudioGeneration] Cleaning up existing AudioFile ${existingAudioFile.id}`);
    await deleteAudioChunks(existingAudioFile.id);
    await deleteSentenceSyncData(existingAudioFile.id);
    await db.audioFiles.delete(existingAudioFile.id);
  }

  // Create new AudioFile
  const audioFile: Omit<AudioFile, 'id'> = { ... };
  audioFileId = await saveAudioFile(audioFile);
}
```

**Pros**:
- Prevents duplicate AudioFiles
- Cleans up old data automatically
- Saves storage space
- Clear data model

**Cons**:
- Requires schema migration
- More complex implementation
- Need to handle migration errors

### Option 3: Add Cleanup on App Init (Interim Solution)

Add a cleanup function that runs on app initialization to remove stale AudioFiles:

**File**: `lib/db.ts` (new function)

```typescript
/**
 * Cleanup orphaned and duplicate audio files
 * Keeps only the most recent complete AudioFile per chapter
 */
export async function cleanupAudioFiles(): Promise<void> {
  try {
    const allAudioFiles = await db.audioFiles.toArray();
    const filesByChapter = new Map<number, AudioFile[]>();

    // Group by chapterId
    for (const file of allAudioFiles) {
      if (!filesByChapter.has(file.chapterId)) {
        filesByChapter.set(file.chapterId, []);
      }
      filesByChapter.get(file.chapterId)!.push(file);
    }

    // For each chapter, keep only most recent complete AudioFile
    for (const [chapterId, files] of filesByChapter) {
      // Sort by generatedAt descending
      files.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());

      // Find most recent complete file
      const completeFile = files.find(f => f.isComplete);
      const filesToKeep = new Set<number>();

      if (completeFile) {
        filesToKeep.add(completeFile.id!);
      } else {
        // No complete file, keep the most recent one
        if (files.length > 0) {
          filesToKeep.add(files[0].id!);
        }
      }

      // Delete all others
      for (const file of files) {
        if (!filesToKeep.has(file.id!)) {
          console.log(`[cleanupAudioFiles] Deleting old AudioFile ${file.id} for chapter ${chapterId}`);
          await deleteAudioChunks(file.id!);
          await deleteSentenceSyncData(file.id!);
          await db.audioFiles.delete(file.id!);
        }
      }
    }

    console.log('[cleanupAudioFiles] Cleanup complete');
  } catch (error) {
    console.error('[cleanupAudioFiles] Cleanup failed:', error);
    // Don't throw - cleanup failure shouldn't break app
  }
}
```

Call this on app init:

**File**: `app/layout.tsx` or wherever DB is initialized

```typescript
useEffect(() => {
  // Run cleanup once on app init
  cleanupAudioFiles();
}, []);
```

**Pros**:
- No schema changes required
- Can deploy immediately
- Runs automatically
- Non-blocking (doesn't throw)

**Cons**:
- Doesn't prevent new duplicates
- Cleanup runs on every app init (slight overhead)
- Race condition if user starts generation during cleanup

## Recommendation

**Immediate Fix** (deploy today):
1. Implement Option 1 (change getAudioFile to return most recent)
2. Implement Option 3 (cleanup on app init)

**Long-term Fix** (next sprint):
1. Implement Option 2 (unique constraint + migration)
2. Add cleanup before creating new AudioFile
3. Remove Option 3 cleanup (no longer needed)

## Verification Steps

After implementing fix:

1. **Clear IndexedDB** to start fresh
2. **Generate audio** for a chapter (5 chunks)
3. **Cancel** midway (2-3 chunks generated)
4. **Regenerate** same chapter (5 chunks)
5. **Click play** immediately
6. **Verify**: Player should find 5 chunks (from most recent generation)

Expected console output:
```
[useProgressiveAudioPlayer] Found 5 chunks
[useProgressiveAudioPlayer] Chunk 0 scheduled at 0s
[useProgressiveAudioPlayer] Chunk 1 scheduled at 3.2s
[useProgressiveAudioPlayer] Chunk 2 scheduled at 6.4s
[useProgressiveAudioPlayer] Chunk 3 scheduled at 9.6s
[useProgressiveAudioPlayer] Chunk 4 scheduled at 12.8s
```

## Related Issues

This bug also affects:
- **Sentence sync data**: Old sentence sync data for previous AudioFiles may be orphaned
- **Storage usage**: Accumulating old AudioFiles and chunks wastes IndexedDB quota
- **Audio playback**: Users may hear old/incomplete audio from cancelled generations

## Related Research

- `thoughts/plans/2025-11-10-progressive-audio-streaming-for-tts-generation.md` - Original progressive streaming plan
- `thoughts/reviews/2025-11-10-progressive-audio-streaming-phase-1-review.md` - Phase 1 code review

## Conclusion

The "only 1 chunk found" bug is NOT caused by:
- ❌ Race condition in SSE processing
- ❌ Transaction timing issues
- ❌ Incorrect audioFileId propagation
- ❌ Faulty getAudioChunks() query

The bug IS caused by:
- ✅ Multiple AudioFile records existing for the same chapter
- ✅ getAudioFile() returning the OLDEST record instead of most recent
- ✅ Player querying chunks with wrong audioFileId from old generation
- ✅ Lack of cleanup for incomplete/cancelled AudioFiles

**Fix**: Change `getAudioFile()` to return the most recent AudioFile (by generatedAt or ID), and add cleanup logic to prevent accumulation of old AudioFile records.
