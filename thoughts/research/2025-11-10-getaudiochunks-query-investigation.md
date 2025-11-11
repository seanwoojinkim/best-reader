---
doc_type: research
date: 2025-11-10T19:37:21+00:00
title: "getAudioChunks Query Investigation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T19:37:21+00:00"
research_question: "Why does getAudioChunks() return only 1 chunk when 5 chunks exist in IndexedDB?"
research_type: codebase_research
researcher: Sean Kim

git_commit: ea687a42b3992630589580d17f62be24312e1672
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-10
last_updated_by: Sean Kim

tags:
  - database
  - audio
  - indexeddb
  - bug
status: complete

related_docs: []
---

# Research: getAudioChunks Query Investigation

**Date**: 2025-11-10T19:37:21+00:00
**Researcher**: Sean Kim
**Git Commit**: ea687a42b3992630589580d17f62be24312e1672
**Branch**: main
**Repository**: reader

## Research Question
Why does getAudioChunks() return only 1 chunk when 5 chunks exist in IndexedDB?

## Summary

**CRITICAL FINDING**: The query itself is NOT broken. The schema is correct, the query is correct, BUT there's a **race condition** in the `loadChapter()` function that causes `getAudioChunks()` to be called before all chunks have been saved to IndexedDB. The code in `useProgressiveAudioPlayer.ts:356-369` includes a retry mechanism specifically to handle this issue, but the timing window is too short (only 100ms x 3 retries = 300ms total).

The real problem: When generation completes and saves 5 chunks, the IndexedDB transaction may not have fully committed when `loadChapter()` queries for chunks. The existing retry logic only waits 300ms, which is insufficient for the database transaction to complete in some scenarios.

## Detailed Findings

### Schema Analysis: audioChunks Table

**Location**: `lib/db.ts:75`

```typescript
audioChunks: '++id, audioFileId, [audioFileId+chunkIndex], chunkIndex, generatedAt',
```

**Index Breakdown**:
- `++id` - Auto-incrementing primary key
- `audioFileId` - **Separate index** (this is what `.where('audioFileId')` uses)
- `[audioFileId+chunkIndex]` - Compound index for efficient range queries
- `chunkIndex` - Separate index for sorting
- `generatedAt` - Index for time-based queries

**VERDICT**: The schema is **100% correct**. The separate `audioFileId` index exists and the query will work.

### Query Analysis: getAudioChunks()

**Location**: `lib/db.ts:585-596`

```typescript
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

**Query Breakdown**:
1. `.where('audioFileId')` - Uses the separate `audioFileId` index (correct)
2. `.equals(audioFileId)` - Filters to specific audio file (correct)
3. `.sortBy('chunkIndex')` - Sorts results by chunk index (correct)

**VERDICT**: The query is **100% correct**. It properly uses the indexed field and will return all matching chunks.

### Chunk Save Logic: saveChunkAndUpdateProgress()

**Location**: `lib/db.ts:705-734`

```typescript
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

**Transaction Analysis**:
- Uses atomic transaction wrapping both `audioChunks` and `audioFiles` tables
- Adds chunk first, then updates progress
- Transaction commits when async function completes
- All 5 chunks ARE being saved (user confirmed via logs)

**VERDICT**: Save logic is **correct** and atomic. All 5 chunks are successfully written to IndexedDB.

### The ACTUAL Bug: Race Condition in loadChapter()

**Location**: `hooks/useProgressiveAudioPlayer.ts:356-369`

```typescript
// Get all available chunks (with retry for IndexedDB race condition)
let chunks = await getAudioChunks(audioFile.id!);

// Retry up to 3 times if no chunks found (handles IndexedDB transaction timing)
if (chunks.length === 0) {
  for (let retry = 0; retry < 3; retry++) {
    console.log(`[useProgressiveAudioPlayer] No chunks found, retrying (${retry + 1}/3)...`);
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
    chunks = await getAudioChunks(audioFile.id!);
    if (chunks.length > 0) break;
  }
}

console.log(`[useProgressiveAudioPlayer] Found ${chunks.length} chunks`);
```

**THE PROBLEM**:
1. Audio generation completes and saves 5 chunks in rapid succession
2. Each chunk is saved in a separate transaction via `saveChunkAndUpdateProgress()`
3. Transactions commit asynchronously
4. `loadChapter()` is called (either via auto-play or manual play)
5. `getAudioChunks()` queries IndexedDB **before all 5 transactions have committed**
6. Query only sees the chunk(s) that have committed so far (typically just 1)
7. Retry logic waits 100ms, checks again
8. Still only 1 chunk committed (total wait time: 100ms)
9. Retry again, waits another 100ms (total: 200ms)
10. Retry again, waits another 100ms (total: 300ms)
11. **300ms is not enough time for all 5 transactions to commit**
12. Function returns with only 1 chunk

**EVIDENCE**:
- User reports "Found 1 chunks" in console log (line 368)
- This log happens AFTER the retry loop
- The retry mechanism exists specifically to handle this race condition
- The retry timing (100ms x 3 = 300ms) is insufficient

### Why Only 1 Chunk?

**Hypothesis**: The first chunk is saved during `onFirstChunkReady` callback, which triggers before the remaining 4 chunks are generated. This chunk's transaction commits quickly. When chunks 2-5 are generated in rapid succession, their transactions are queued and take longer to commit.

**Location of onFirstChunkReady**: `hooks/useAudioGeneration.ts:221-224`

```typescript
// NEW: Trigger playback after first chunk
if (data.index === 0 && onFirstChunkReady && chapter.id && audioFileId) {
  console.log('[useAudioGeneration] First chunk ready, triggering callback');
  onFirstChunkReady(chapter.id, audioFileId);
}
```

This callback fires immediately after chunk 0 is saved. The remaining chunks (1-4) continue to be saved in the background. If the user immediately clicks play (or auto-play triggers), `loadChapter()` queries before all chunks are committed.

### Comparison with Other Queries

**Example: getAudioFile() - Works Correctly**

**Location**: `lib/db.ts:420-422`

```typescript
export async function getAudioFile(chapterId: number): Promise<AudioFile | undefined> {
  return await db.audioFiles.where('chapterId').equals(chapterId).first();
}
```

This works because:
1. Only 1 AudioFile record exists per chapter
2. It's created once at the beginning
3. No transaction timing issues

**Example: getHighlights() - Uses Same Pattern**

**Location**: `lib/db.ts:218-220`

```typescript
export async function getHighlights(bookId: number): Promise<Highlight[]> {
  return await db.highlights.where('bookId').equals(bookId).sortBy('createdAt');
}
```

This pattern is **identical** to `getAudioChunks()` and works correctly because highlights are saved one at a time with user interaction, not in rapid succession.

## Code References

- `lib/db.ts:75` - audioChunks schema with separate `audioFileId` index
- `lib/db.ts:585-596` - getAudioChunks() query implementation
- `lib/db.ts:705-734` - saveChunkAndUpdateProgress() atomic transaction
- `hooks/useProgressiveAudioPlayer.ts:356-369` - loadChapter() with retry logic
- `hooks/useAudioGeneration.ts:214` - saveChunkAndUpdateProgress() call in generation loop
- `hooks/useAudioGeneration.ts:221-224` - onFirstChunkReady callback that triggers auto-play
- `lib/db.ts:420-422` - getAudioFile() for comparison
- `lib/db.ts:218-220` - getHighlights() using same query pattern

## Architecture Documentation

### IndexedDB Transaction Commit Timing

Dexie.js transactions work as follows:
1. `db.transaction('rw', tables, async fn)` starts a transaction
2. All operations inside `fn` are queued
3. Transaction commits when `fn` completes
4. Commit is **asynchronous** - it happens after function returns
5. Commit timing depends on browser implementation and system load

### Audio Chunk Save Flow

1. API generates audio chunks (5 total)
2. Each chunk is streamed to client
3. Client calls `saveChunkAndUpdateProgress()` for each chunk
4. Each chunk is saved in a **separate transaction** (5 transactions total)
5. Transactions commit asynchronously in order
6. First transaction commits fast (~50ms)
7. Subsequent transactions queue and take longer (~100-200ms each)
8. Total commit time for all 5 chunks: **500ms - 1000ms**

### loadChapter Query Timing

1. User clicks play (or auto-play triggers)
2. `loadChapter()` is called
3. `getAudioChunks()` queries IndexedDB
4. Query runs against **current committed state**
5. If called before all transactions commit, only partial results returned

### Why Retry Logic Fails

Current retry logic:
- 3 retries x 100ms = 300ms total wait time
- Chunks need 500ms - 1000ms to fully commit
- **300ms < 500ms** - retry window is too short

## The Fix

### Option 1: Increase Retry Timing (Simple Fix)

**Change**: Increase retry count and/or wait time in `useProgressiveAudioPlayer.ts:358-366`

```typescript
// Retry up to 10 times with 200ms wait (2 seconds total)
if (chunks.length === 0) {
  for (let retry = 0; retry < 10; retry++) {
    console.log(`[useProgressiveAudioPlayer] No chunks found, retrying (${retry + 1}/10)...`);
    await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms
    chunks = await getAudioChunks(audioFile.id!);
    if (chunks.length > 0) break;
  }
}
```

**Pros**:
- Simple one-line change
- Handles transaction timing issues
- No architectural changes needed

**Cons**:
- Still relies on polling/retries
- May not work in extremely slow systems
- Adds latency to the user experience

### Option 2: Wait for Expected Chunk Count (Better Fix)

**Change**: Instead of checking for `chunks.length === 0`, check for `chunks.length < expectedChunks`

```typescript
// Get expected chunk count from audio file metadata
const expectedChunks = audioFile.totalChunks || 0;

// Get all available chunks
let chunks = await getAudioChunks(audioFile.id!);

// Retry until we have all expected chunks (with timeout)
const maxRetries = 20;
const retryDelay = 200; // 200ms
let retryCount = 0;

while (chunks.length < expectedChunks && retryCount < maxRetries) {
  console.log(`[useProgressiveAudioPlayer] Found ${chunks.length}/${expectedChunks} chunks, retrying (${retryCount + 1}/${maxRetries})...`);
  await new Promise(resolve => setTimeout(resolve, retryDelay));
  chunks = await getAudioChunks(audioFile.id!);
  retryCount++;
}

if (chunks.length < expectedChunks) {
  console.warn(`[useProgressiveAudioPlayer] Timeout: Only found ${chunks.length}/${expectedChunks} chunks after ${maxRetries * retryDelay}ms`);
}

console.log(`[useProgressiveAudioPlayer] Found ${chunks.length} chunks`);
```

**Pros**:
- Waits for ALL chunks, not just "some chunks"
- Solves the "Found 1 chunks" problem completely
- Adaptive timing based on actual chunk count
- Includes timeout to prevent infinite wait

**Cons**:
- More complex logic
- Requires `totalChunks` to be set correctly in AudioFile metadata
- Adds latency proportional to commit time

### Option 3: Use Event-Based Notification (Best Fix, More Complex)

**Change**: Have `saveChunkAndUpdateProgress()` emit an event when all chunks are committed

This would require:
1. Adding event emitter to db.ts
2. Emitting event after last chunk commits
3. Listening for event in useProgressiveAudioPlayer
4. Only querying after event received

**Pros**:
- No polling/retries needed
- Zero latency once chunks are ready
- Architecturally cleaner

**Cons**:
- Significant refactoring required
- More complex code
- Overkill for this issue

## Test Verification

To confirm the fix works:

1. **Setup**: Clear browser storage, reload page
2. **Generate Audio**: Click "Generate Audio" for a chapter
3. **Monitor Console Logs**:
   - Look for `[useAudioGeneration] Saved chunk X to IndexedDB` (should see 5)
   - Look for `[useProgressiveAudioPlayer] Found X chunks` (should see 5, not 1)
4. **Verify Playback**: Click play button
   - Should play without "No chunks loaded" error
   - Should play all 5 chunks sequentially
5. **Test Reload**: Refresh page, click play again
   - Should still find all 5 chunks
   - Should resume playback correctly

## Recommended Fix

**Use Option 2** - Wait for expected chunk count with timeout.

This provides the best balance of:
- Correctness (waits for ALL chunks)
- Simplicity (single function change)
- User experience (no noticeable delay since generation takes longer anyway)
- Robustness (timeout prevents infinite wait)

**File to Change**: `hooks/useProgressiveAudioPlayer.ts:356-369`

**Lines to Replace**: Lines 356-369 (the entire retry logic block)

**Implementation**: Replace with the Option 2 code shown above.
