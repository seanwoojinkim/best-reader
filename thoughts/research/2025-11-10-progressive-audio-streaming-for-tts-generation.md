---
doc_type: research
date: 2025-11-10T16:56:41+00:00
title: "Progressive Audio Streaming for TTS Generation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T16:56:41+00:00"
research_question: "How can we implement progressive audio streaming for TTS generation, allowing users to start playback as soon as the first chunk finishes, then appending subsequent chunks as they're generated?"
research_type: codebase_research
researcher: Sean Kim

git_commit: 8410593d108287609c9647fecac99fa1418454ae
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-10
last_updated_by: Sean Kim

tags:
  - tts
  - audio
  - streaming
  - progressive-loading
  - web-audio-api
  - mediasource-extensions
status: complete

related_docs:
  - thoughts/research/2025-11-09-tts-implementation-analysis-and-industry-best-practices-comparison.md
  - thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md
---

# Research: Progressive Audio Streaming for TTS Generation

**Date**: 2025-11-10T16:56:41+00:00
**Researcher**: Sean Kim
**Git Commit**: 8410593d
**Branch**: main
**Repository**: reader

## Research Question

How can we implement progressive audio streaming for TTS generation, allowing users to start playback as soon as the first chunk finishes, then appending subsequent chunks as they're generated?

## Summary

The current implementation generates TTS audio in 4096-character chunks, concatenates them server-side into a single MP3, and only allows playback after all chunks are complete. Progressive streaming is **technically feasible** but requires significant architectural changes. The most pragmatic approach is **MediaSource Extensions (MSE) with MP4 audio** for cross-browser compatibility, though **Web Audio API scheduling** is simpler if we accept MP3 limitations in Firefox.

**Key Findings:**

- ✅ **Current Flow**: Server-side concatenation at `app/api/tts/generate-stream/route.ts:156-203`
- ✅ **Chunks Available**: OpenAI returns individual MP3 chunks at `route.ts:156-194`
- ⚠️ **MSE Limitation**: MP3 not supported in Firefox, requires MP4/AAC conversion
- ✅ **Web Audio API**: Can schedule MP3 chunks sequentially, but complex buffer management
- ⚠️ **Storage Trade-off**: Chunk-based storage increases IndexedDB operations but enables partial playback
- 📊 **Browser Support**: MSE with MP4 has universal support; Web Audio API with MP3 works everywhere

**Recommended Approach**: **Web Audio API with scheduled chunks** - simpler implementation, works with current MP3 format, acceptable complexity for the use case.

**Implementation Complexity**: **Medium** (20-30 hours)
- API streaming changes (8-10 hours)
- Client-side chunk player (8-10 hours)
- Storage strategy (4-6 hours)
- Testing and edge cases (4-6 hours)

---

## Detailed Findings

### 1. Current Audio Generation and Playback Flow

#### 1.1 Current Server-Side Generation

**File**: `app/api/tts/generate-stream/route.ts`

The current implementation already generates audio in chunks but concatenates them before returning:

**Text Chunking** (lines 94-129):
```typescript
// OpenAI TTS has a 4096 character limit - split into chunks if needed
const MAX_CHARS = 4096;
const chunks: string[] = [];

if (sanitizedText.length <= MAX_CHARS) {
  chunks.push(sanitizedText);
} else {
  // Smart splitting at sentence boundaries (lines 104-127)
  // Finds periods, questions, exclamations, paragraph breaks
  // Uses 70% threshold for optimal breaking points
}
```

**Chunk Generation** (lines 158-194):
```typescript
const audioBuffers: Buffer[] = [];

for (let i = 0; i < chunks.length; i++) {
  // Generate each chunk via OpenAI API (lines 173-179)
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: chunks[i],
    response_format: 'mp3',
    speed: validSpeed,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  audioBuffers.push(buffer);  // Collect in array

  // Progress events sent via SSE (lines 184-191)
}
```

**Server-Side Concatenation** (lines 196-203):
```typescript
sendEvent('progress', {
  type: 'concat',
  progress: 80,
  message: 'Combining audio chunks'
});

// Concatenate all audio buffers
const buffer = Buffer.concat(audioBuffers);
```

**Key Observation**: The chunks are **already generated sequentially**, and progress events are **already streamed via Server-Sent Events (SSE)**. We're just concatenating server-side instead of streaming the chunks individually.

#### 1.2 Current Client-Side Playback

**File**: `hooks/useAudioPlayer.ts`

The player uses a standard HTML5 `<audio>` element with Blob URLs:

**Audio Element** (lines 39-84):
```typescript
useEffect(() => {
  const audio = new Audio();
  audioRef.current = audio;

  // Event listeners for timeupdate, loadedmetadata, ended, error

  return () => {
    audio.removeEventListener(/* cleanup */);
    audio.pause();
  };
}, []);
```

**Loading from IndexedDB** (lines 98-148):
```typescript
const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
  const audioFile = await getAudioFile(chapterToLoad.id);  // Single blob

  // Create object URL from complete blob
  const audioUrl = URL.createObjectURL(audioFile.blob);
  currentObjectUrlRef.current = audioUrl;

  audioRef.current.src = audioUrl;
  audioRef.current.load();
}, [playbackSpeed]);
```

**Limitation**: The `<audio>` element expects a complete audio file. We can't append to it dynamically.

#### 1.3 Current Storage Strategy

**File**: `lib/db.ts`

Audio is stored as a single blob per chapter:

**Schema** (lines 42-43):
```typescript
audioFiles: '++id, chapterId, generatedAt',
```

**Interface** (`types/index.ts:90-99`):
```typescript
export interface AudioFile {
  id?: number;
  chapterId: number;
  blob: Blob;         // Single MP3 blob
  duration: number;
  voice: OpenAIVoice;
  speed: number;
  generatedAt: Date;
  sizeBytes: number;
}
```

**Storage** (`hooks/useAudioGeneration.ts:147-163`):
```typescript
// Convert base64 to single Blob
const audioBlob = base64ToBlob(data.audioData, 'audio/mpeg');

const audioFile: Omit<AudioFile, 'id'> = {
  chapterId: chapter.id,
  blob: audioBlob,  // Complete concatenated audio
  duration: data.duration,
  // ...
};

await saveAudioFile(audioFile);
```

---

### 2. Technical Approaches for Progressive Streaming

#### 2.1 MediaSource Extensions (MSE)

**Overview**: MSE allows appending media segments dynamically to a `<video>` or `<audio>` element via a `SourceBuffer`.

**Browser Support**:
- ✅ **Chrome 38+**: Full MSE support with MP3 (`audio/mpeg`)
- ❌ **Firefox 42+**: Only supports fMP4 (`audio/mp4; codecs="mp4a.40.2"`), not MP3
- ✅ **Safari 8+**: Supports MSE with MP4
- ✅ **Edge**: Full support

**Key Limitation**: **MP3 is not supported in Firefox**. Would require converting OpenAI MP3 chunks to MP4/AAC.

**Implementation Pattern**:

```typescript
// Client-side MSE setup
const audio = new Audio();
const mediaSource = new MediaSource();
audio.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener('sourceopen', () => {
  // For MP4/AAC (cross-browser)
  const sourceBuffer = mediaSource.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');

  // For MP3 (Chrome only)
  // const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

  sourceBuffer.addEventListener('updateend', () => {
    // Ready for next chunk
  });

  // Append chunk as ArrayBuffer
  sourceBuffer.appendBuffer(chunkArrayBuffer);
});
```

**Server Changes Required**:

```typescript
// app/api/tts/generate-stream/route.ts
// Instead of concatenating, stream individual chunks

for (let i = 0; i < chunks.length; i++) {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: chunks[i],
    response_format: 'mp3',  // Would need to convert to MP4 for Firefox
    speed: validSpeed,
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  // Send chunk via SSE
  sendEvent('audio_chunk', {
    index: i,
    total: chunks.length,
    data: buffer.toString('base64'),
    duration: estimatedChunkDuration
  });
}
```

**Pros**:
- ✅ True streaming with automatic buffering
- ✅ Seamless playback across chunks
- ✅ Browser handles timing and synchronization
- ✅ Standard web API

**Cons**:
- ❌ MP3 not supported in Firefox (requires MP4 conversion)
- ❌ Format conversion adds complexity
- ❌ fMP4 fragmentation is non-trivial
- ❌ More complex error handling

**Verdict**: **Good for production apps** but requires audio format conversion for Firefox support.

---

#### 2.2 Web Audio API with Scheduled Chunks

**Overview**: Decode each MP3 chunk to PCM audio buffers and schedule them sequentially using `AudioContext`.

**Browser Support**:
- ✅ **All modern browsers** support Web Audio API
- ✅ **MP3 decoding** supported universally via `decodeAudioData()`

**Implementation Pattern**:

```typescript
// Client-side Web Audio API setup
const audioContext = new AudioContext();
const chunkQueue: AudioBuffer[] = [];
let nextStartTime = 0;

async function playChunk(chunkArrayBuffer: ArrayBuffer, isFirstChunk: boolean) {
  // Decode MP3 to PCM AudioBuffer
  const audioBuffer = await audioContext.decodeAudioData(chunkArrayBuffer);

  // Create source node
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  // Schedule playback
  if (isFirstChunk) {
    nextStartTime = audioContext.currentTime;
  }

  source.start(nextStartTime);
  nextStartTime += audioBuffer.duration;

  // Track for seeking
  chunkQueue.push(audioBuffer);
}

// Receive chunks via SSE
eventSource.addEventListener('audio_chunk', (event) => {
  const chunk = JSON.parse(event.data);
  const arrayBuffer = base64ToArrayBuffer(chunk.data);

  playChunk(arrayBuffer, chunk.index === 0);
});
```

**Pros**:
- ✅ Works with current MP3 format (no conversion needed)
- ✅ Precise scheduling eliminates gaps
- ✅ Lower-level control over playback
- ✅ Can implement custom seek/pause logic

**Cons**:
- ⚠️ Manual buffer management required
- ⚠️ More complex pause/resume logic
- ⚠️ Seeking across chunks requires chunk metadata
- ⚠️ Need to track playback position manually

**Verdict**: **Simpler than MSE** for our use case, works with existing MP3 format, acceptable complexity.

---

#### 2.3 Sequential HTML5 Audio Elements

**Overview**: Create separate `<audio>` elements for each chunk and play them sequentially using the `ended` event.

**Implementation Pattern**:

```typescript
let currentAudio: HTMLAudioElement | null = null;
const chunkQueue: Blob[] = [];
let currentChunkIndex = 0;

function playNextChunk() {
  if (currentChunkIndex >= chunkQueue.length) return;

  const chunkBlob = chunkQueue[currentChunkIndex];
  const audioUrl = URL.createObjectURL(chunkBlob);

  currentAudio = new Audio(audioUrl);
  currentAudio.addEventListener('ended', () => {
    URL.revokeObjectURL(audioUrl);
    currentChunkIndex++;
    playNextChunk();
  });

  currentAudio.play();
}

// Receive chunks via SSE
eventSource.addEventListener('audio_chunk', (event) => {
  const chunk = JSON.parse(event.data);
  const blob = base64ToBlob(chunk.data, 'audio/mpeg');

  chunkQueue.push(blob);

  if (chunkQueue.length === 1) {
    playNextChunk();  // Start playback on first chunk
  }
});
```

**Pros**:
- ✅ Simplest implementation
- ✅ Works with current MP3 format
- ✅ Uses familiar `<audio>` element API

**Cons**:
- ❌ Audible gaps between chunks (50-200ms)
- ❌ Poor user experience during transitions
- ❌ Difficult to implement seek across chunks
- ❌ No gapless playback guarantee

**Verdict**: **Not recommended** due to audible gaps between chunks. Poor UX for continuous narration.

---

### 3. Storage Strategy Analysis

#### 3.1 Single Blob (Current Approach)

**Current Implementation** (`lib/db.ts:396-405`):

```typescript
export async function saveAudioFile(audioFile: Omit<AudioFile, 'id'>): Promise<number> {
  return await db.audioFiles.add(audioFile);
}

export async function getAudioFile(chapterId: number): Promise<AudioFile | undefined> {
  return await db.audioFiles.where('chapterId').equals(chapterId).first();
}
```

**Pros**:
- ✅ Simple schema
- ✅ Single transaction per chapter
- ✅ Easy to manage
- ✅ Works well with complete audio

**Cons**:
- ❌ Can't play until all chunks complete
- ❌ All-or-nothing generation
- ❌ Large memory allocation for concatenation

---

#### 3.2 Chunk-Based Storage (Progressive Approach)

**Proposed Schema**:

```typescript
// New table in db.ts version 5
audioChunks: '++id, chapterId, chunkIndex, generatedAt'

// New interface in types/index.ts
export interface AudioChunk {
  id?: number;
  chapterId: number;
  chunkIndex: number;      // 0-based chunk order
  blob: Blob;              // Individual MP3 chunk
  duration: number;        // Chunk duration in seconds
  textStart: number;       // Character offset in chapter text
  textEnd: number;         // Character end offset
  generatedAt: Date;
}

// Modified AudioFile interface
export interface AudioFile {
  id?: number;
  chapterId: number;
  totalChunks: number;     // Expected chunk count
  chunksComplete: number;  // Chunks successfully generated
  totalDuration: number;   // Combined duration
  voice: OpenAIVoice;
  speed: number;
  generatedAt: Date;
  completedAt?: Date;      // When all chunks finished
  sizeBytes: number;
}
```

**Storage Functions**:

```typescript
// lib/db.ts additions
export async function saveAudioChunk(chunk: Omit<AudioChunk, 'id'>): Promise<number> {
  return await db.audioChunks.add(chunk);
}

export async function getAudioChunks(chapterId: number): Promise<AudioChunk[]> {
  return await db.audioChunks
    .where('chapterId')
    .equals(chapterId)
    .sortBy('chunkIndex');
}

export async function getAudioChunksInRange(
  chapterId: number,
  startIndex: number,
  endIndex: number
): Promise<AudioChunk[]> {
  const chunks = await getAudioChunks(chapterId);
  return chunks.filter(c => c.chunkIndex >= startIndex && c.chunkIndex <= endIndex);
}

export async function updateAudioFileProgress(
  chapterId: number,
  chunksComplete: number
): Promise<void> {
  const audioFile = await db.audioFiles.where('chapterId').equals(chapterId).first();
  if (audioFile?.id) {
    await db.audioFiles.update(audioFile.id, { chunksComplete });
  }
}
```

**Pros**:
- ✅ Play while generating remaining chunks
- ✅ Resume generation if interrupted
- ✅ Partial caching for slow connections
- ✅ Better memory management (no large concatenation)

**Cons**:
- ⚠️ More complex schema (2 tables instead of 1)
- ⚠️ Multiple IndexedDB transactions per chapter
- ⚠️ Chunk lifecycle management required
- ⚠️ Need garbage collection for incomplete generations

**Verdict**: **Worth the complexity** for progressive playback, but requires careful transaction management.

---

### 4. Recommended Approach: Web Audio API with Scheduled Chunks

Based on the analysis, **Web Audio API with scheduled chunks** is the most pragmatic approach:

#### 4.1 Why Web Audio API?

1. ✅ **Works with existing MP3 format** - no need to convert to MP4
2. ✅ **Universal browser support** - no Firefox compatibility issues
3. ✅ **Gapless playback** - precise scheduling eliminates gaps
4. ✅ **Moderate complexity** - simpler than MSE, better UX than sequential `<audio>`
5. ✅ **Compatible with existing API** - OpenAI returns MP3, no server changes for format

#### 4.2 Architecture Changes Required

**Server-Side Changes** (`app/api/tts/generate-stream/route.ts`):

**Current** (lines 196-228):
```typescript
// Concatenate all audio buffers
const buffer = Buffer.concat(audioBuffers);

// Send final result
sendEvent('result', {
  success: true,
  audioData: buffer.toString('base64'),  // Single large base64
  duration: durationSeconds,
  // ...
});
```

**Proposed**:
```typescript
// Don't concatenate - stream chunks individually
for (let i = 0; i < audioBuffers.length; i++) {
  sendEvent('audio_chunk', {
    index: i,
    total: audioBuffers.length,
    data: audioBuffers[i].toString('base64'),
    textStart: chunkTextOffsets[i].start,
    textEnd: chunkTextOffsets[i].end,
    estimatedDuration: estimateChunkDuration(chunks[i], validSpeed)
  });

  sendEvent('progress', {
    type: 'chunk_complete',
    progress: 30 + Math.floor(((i + 1) / audioBuffers.length) * 50),
    message: `Chunk ${i + 1} of ${audioBuffers.length} ready`,
    chunksComplete: i + 1,
    totalChunks: audioBuffers.length
  });
}

// Send completion event
sendEvent('generation_complete', {
  success: true,
  totalChunks: audioBuffers.length,
  totalDuration: durationSeconds,
  cost,
  charCount,
  voice,
  speed: validSpeed
});
```

**Client-Side Changes** (`hooks/useAudioGeneration.ts`):

**Current** (lines 94-148):
```typescript
// Read entire streaming response, wait for final result
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Process SSE messages
  // Update progress only

  if (eventType === 'result') {
    resultData = data;  // Store final complete audio
  }
}

// Convert complete base64 to single Blob
const audioBlob = base64ToBlob(data.audioData, 'audio/mpeg');
await saveAudioFile({ blob: audioBlob, ... });
```

**Proposed**:
```typescript
const chunks: AudioChunk[] = [];
let audioFileId: number | null = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  if (eventType === 'audio_chunk') {
    // Convert chunk to Blob
    const chunkBlob = base64ToBlob(data.data, 'audio/mpeg');

    // Save chunk to IndexedDB
    const chunkId = await saveAudioChunk({
      chapterId: chapter.id,
      chunkIndex: data.index,
      blob: chunkBlob,
      duration: data.estimatedDuration,
      textStart: data.textStart,
      textEnd: data.textEnd,
      generatedAt: new Date()
    });

    chunks.push({ id: chunkId, ...chunkData });

    // Create AudioFile metadata on first chunk
    if (data.index === 0) {
      audioFileId = await saveAudioFile({
        chapterId: chapter.id,
        totalChunks: data.total,
        chunksComplete: 1,
        totalDuration: 0,  // Will update on completion
        voice,
        speed,
        generatedAt: new Date(),
        sizeBytes: 0
      });
    } else {
      // Update progress
      await updateAudioFileProgress(chapter.id, data.index + 1);
    }

    // Trigger playback after first chunk if autoPlay enabled
    if (data.index === 0 && onFirstChunkReady) {
      onFirstChunkReady(chapter.id);
    }
  } else if (eventType === 'generation_complete') {
    // Update AudioFile with final metadata
    await db.audioFiles.update(audioFileId!, {
      chunksComplete: data.totalChunks,
      totalDuration: data.totalDuration,
      completedAt: new Date(),
      sizeBytes: chunks.reduce((sum, c) => sum + c.blob.size, 0)
    });
  }
}
```

**New Hook** (`hooks/useProgressiveAudioPlayer.ts`):

```typescript
import { useRef, useState, useCallback, useEffect } from 'react';
import type { Chapter, AudioChunk } from '@/types';
import { getAudioChunks } from '@/lib/db';

interface UseProgressiveAudioPlayerProps {
  chapter: Chapter | null;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export function useProgressiveAudioPlayer({
  chapter,
  onTimeUpdate,
  onEnded
}: UseProgressiveAudioPlayerProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track scheduled chunks for seeking
  const scheduledChunksRef = useRef<{
    buffer: AudioBuffer;
    source: AudioBufferSourceNode;
    startTime: number;
    duration: number;
  }[]>([]);

  const nextStartTimeRef = useRef(0);
  const playbackStartTimeRef = useRef(0);

  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new AudioContext();

    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Load and schedule chunks
  const loadChapter = useCallback(async (chapterToLoad: Chapter) => {
    if (!chapterToLoad.id || !audioContextRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const chunks = await getAudioChunks(chapterToLoad.id);

      if (chunks.length === 0) {
        throw new Error('No audio chunks found for this chapter');
      }

      // Clear previous schedule
      scheduledChunksRef.current.forEach(s => s.source.stop());
      scheduledChunksRef.current = [];
      nextStartTimeRef.current = 0;

      // Decode and schedule all available chunks
      for (const chunk of chunks) {
        await scheduleChunk(chunk, audioContextRef.current);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading progressive audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audio');
      setLoading(false);
    }
  }, []);

  // Schedule individual chunk
  const scheduleChunk = async (
    chunk: AudioChunk,
    audioContext: AudioContext
  ) => {
    // Convert Blob to ArrayBuffer
    const arrayBuffer = await chunk.blob.arrayBuffer();

    // Decode MP3 to PCM AudioBuffer
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Create source node
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    // Schedule at next available time
    const startTime = nextStartTimeRef.current;
    nextStartTimeRef.current += audioBuffer.duration;

    // Track for seeking/pausing
    scheduledChunksRef.current.push({
      buffer: audioBuffer,
      source,
      startTime,
      duration: audioBuffer.duration
    });

    // Update total duration
    setDuration(nextStartTimeRef.current);

    // Handle chunk end
    source.onended = () => {
      if (chunk.chunkIndex === scheduledChunksRef.current.length - 1) {
        setPlaying(false);
        onEnded?.();
      }
    };
  };

  // Play control
  const play = useCallback(() => {
    if (!audioContextRef.current || scheduledChunksRef.current.length === 0) {
      setError('No audio loaded');
      return;
    }

    // Resume AudioContext if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    // Start all scheduled sources at their designated times
    const now = audioContextRef.current.currentTime;
    playbackStartTimeRef.current = now;

    scheduledChunksRef.current.forEach(scheduled => {
      scheduled.source.start(now + scheduled.startTime);
    });

    setPlaying(true);

    // Track current time
    const interval = setInterval(() => {
      if (!audioContextRef.current || !playing) {
        clearInterval(interval);
        return;
      }

      const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current;
      setCurrentTime(elapsed);
      onTimeUpdate?.(elapsed, duration);
    }, 100);
  }, [playing, duration, onTimeUpdate]);

  // Pause control
  const pause = useCallback(() => {
    if (!audioContextRef.current) return;

    audioContextRef.current.suspend();
    setPlaying(false);
  }, []);

  // Seek control
  const seek = useCallback((time: number) => {
    // Seeking with Web Audio API requires re-creating sources
    // This is complex - for MVP, we can disable seeking during generation
    console.warn('Seeking not yet implemented for progressive playback');
  }, []);

  // Speed control
  const setSpeed = useCallback((speed: number) => {
    scheduledChunksRef.current.forEach(scheduled => {
      scheduled.source.playbackRate.value = speed;
    });
  }, []);

  // Auto-load chapter
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
    play,
    pause,
    seek,
    setSpeed,
    loadChapter
  };
}
```

#### 4.3 Migration Strategy

**Phase 1: Add Chunk Storage Schema** (4-6 hours)
- Add `audioChunks` table to `lib/db.ts`
- Add `AudioChunk` interface to `types/index.ts`
- Implement chunk storage functions
- Keep existing single-blob storage for backward compatibility

**Phase 2: Modify API to Stream Chunks** (8-10 hours)
- Update `app/api/tts/generate-stream/route.ts` to send chunks individually
- Add `audio_chunk` SSE event type
- Keep `result` event for backward compatibility (concatenated version)
- Add feature flag to toggle streaming mode

**Phase 3: Implement Progressive Player Hook** (8-10 hours)
- Create `hooks/useProgressiveAudioPlayer.ts` with Web Audio API
- Implement chunk decoding and scheduling
- Add buffer management logic
- Handle playback state (play/pause/ended)

**Phase 4: Update UI Components** (4-6 hours)
- Add "Play while generating" UI state
- Show "Playing chunk 1/5, generating 2/5" status
- Update `AudioPlayer.tsx` to use progressive hook
- Add loading indicator for chunk buffering

**Phase 5: Testing and Edge Cases** (4-6 hours)
- Test with various chapter lengths (1-10 chunks)
- Handle generation cancellation mid-stream
- Test pause/resume during generation
- Verify IndexedDB transaction performance
- Test memory usage with large chapters

**Total Estimated Effort**: 20-30 hours (Medium complexity)

---

### 5. Alternative Approaches Considered

#### 5.1 MediaSource Extensions with MP4 Conversion

**Why Not Chosen**:
- Requires server-side MP3 → MP4 conversion (ffmpeg dependency)
- Adds latency for format conversion (1-2 seconds per chunk)
- Increases server resource usage
- More complex error handling for conversion failures

**When It Makes Sense**:
- Large-scale production app with dedicated media team
- Need for adaptive bitrate streaming
- Working with video content (MSE designed for video)

#### 5.2 Hybrid Approach: MP3 Concatenation with Checkpointing

**Concept**: Generate and concatenate chunks incrementally, allowing playback of "completed segments" while generation continues.

**Why Not Chosen**:
- Still requires waiting for multiple chunks before playback
- Doesn't achieve true "play first chunk immediately"
- Complex state management for partial concatenations
- Offers limited improvement over current approach

#### 5.3 WebRTC Data Channels

**Concept**: Use WebRTC peer connection to stream audio chunks with lower latency.

**Why Not Chosen**:
- Massive overkill for server → client streaming
- Requires WebRTC signaling infrastructure
- Much more complex than SSE
- No real benefit over SSE for this use case

---

### 6. Risks and Edge Cases

#### 6.1 Generation Cancellation

**Scenario**: User cancels generation after 2 chunks are saved.

**Risk**: Incomplete chunks in IndexedDB with no way to resume.

**Mitigation**:
- Add `chunksComplete` field to `AudioFile` to track progress
- Allow re-generating missing chunks only
- UI shows "Generation incomplete - resume?" option

#### 6.2 User Seeks While Generating

**Scenario**: User seeks to position corresponding to chunk 4, but only chunks 1-2 are available.

**Risk**: Playback fails or jumps unexpectedly.

**Mitigation**:
- Disable seeking until all chunks complete
- Show "Seeking available after generation completes" message
- Or: Implement partial seeking (only within loaded chunks)

#### 6.3 Memory Pressure

**Scenario**: Large chapter (100+ chunks) scheduled simultaneously.

**Risk**: Browser crashes or slows down from too many AudioBuffers in memory.

**Mitigation**:
- Implement sliding window (keep only 3-5 chunks in memory at a time)
- Load and schedule chunks on-demand as playback progresses
- Release completed chunk buffers from memory

#### 6.4 IndexedDB Transaction Overhead

**Scenario**: Saving 20 chunks individually causes slow writes.

**Risk**: Generation appears slow, UI feels sluggish.

**Mitigation**:
- Batch chunk saves using `bulkAdd()` instead of individual `add()`
- Use in-memory buffer and flush to IndexedDB every 3-5 chunks
- Show "Buffering..." indicator during writes

#### 6.5 Chunk Decoding Failures

**Scenario**: One chunk has corrupted MP3 data, `decodeAudioData()` throws error.

**Risk**: Playback stops, remaining chunks can't play.

**Mitigation**:
- Wrap `decodeAudioData()` in try-catch per chunk
- Skip corrupted chunks and continue with next available chunk
- Show warning "Audio quality may be degraded"

#### 6.6 AudioContext State Management

**Scenario**: Multiple chapters loaded/unloaded rapidly, sources not cleaned up.

**Risk**: Memory leaks, browser audio glitches.

**Mitigation**:
- Call `source.stop()` on all scheduled sources before loading new chapter
- Close and recreate `AudioContext` on chapter change
- Use cleanup effect in React hook

---

### 7. Code Examples

#### 7.1 Current Concatenation Flow

**Server** (`app/api/tts/generate-stream/route.ts:156-203`):
```typescript
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
  audioBuffers.push(buffer);
}

// Concatenate all chunks
const buffer = Buffer.concat(audioBuffers);

// Return complete audio
sendEvent('result', {
  success: true,
  audioData: buffer.toString('base64'),
  // ...
});
```

**Client** (`hooks/useAudioGeneration.ts:82-148`):
```typescript
const response = await fetch('/api/tts/generate-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chapterText, voice, speed }),
});

const reader = response.body?.getReader();
let resultData: any = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Parse SSE events
  if (eventType === 'result') {
    resultData = data;  // Wait for complete audio
  }
}

// Convert to single blob
const audioBlob = base64ToBlob(resultData.audioData, 'audio/mpeg');
await saveAudioFile({ blob: audioBlob, ... });
```

#### 7.2 Progressive Streaming Flow (Proposed)

**Server** (`app/api/tts/generate-stream/route.ts` - modified):
```typescript
const audioBuffers: Buffer[] = [];
let chunkTextOffsets: { start: number; end: number }[] = [];

// Track text offsets for each chunk
let currentOffset = 0;
for (const chunk of chunks) {
  chunkTextOffsets.push({
    start: currentOffset,
    end: currentOffset + chunk.length
  });
  currentOffset += chunk.length;
}

for (let i = 0; i < chunks.length; i++) {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice,
    input: chunks[i],
    response_format: 'mp3',
    speed: validSpeed,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  audioBuffers.push(buffer);

  // Stream chunk immediately (don't wait for concatenation)
  sendEvent('audio_chunk', {
    index: i,
    total: chunks.length,
    data: buffer.toString('base64'),
    textStart: chunkTextOffsets[i].start,
    textEnd: chunkTextOffsets[i].end,
    estimatedDuration: estimateChunkDuration(chunks[i], validSpeed)
  });

  console.log(`[TTS API Stream] Chunk ${i + 1}/${chunks.length} streamed to client`);
}

// Send completion event
sendEvent('generation_complete', {
  success: true,
  totalChunks: chunks.length,
  totalDuration: durationSeconds,
  cost,
  charCount
});
```

**Client** (`hooks/useAudioGeneration.ts` - modified):
```typescript
const response = await fetch('/api/tts/generate-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chapterText, voice, speed }),
});

const reader = response.body?.getReader();
const chunks: AudioChunk[] = [];
let audioFileId: number | null = null;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  if (eventType === 'audio_chunk') {
    const chunkBlob = base64ToBlob(data.data, 'audio/mpeg');

    // Save chunk immediately to IndexedDB
    const chunkId = await saveAudioChunk({
      chapterId: chapter.id,
      chunkIndex: data.index,
      blob: chunkBlob,
      duration: data.estimatedDuration,
      textStart: data.textStart,
      textEnd: data.textEnd,
      generatedAt: new Date()
    });

    // Initialize AudioFile metadata on first chunk
    if (data.index === 0) {
      audioFileId = await saveAudioFile({
        chapterId: chapter.id,
        totalChunks: data.total,
        chunksComplete: 1,
        totalDuration: 0,
        voice,
        speed,
        generatedAt: new Date(),
        sizeBytes: chunkBlob.size
      });

      // Trigger playback immediately
      if (onFirstChunkReady) {
        onFirstChunkReady(chapter);
      }
    } else {
      // Update progress
      await updateAudioFileProgress(chapter.id, data.index + 1);
    }

    console.log(`[useAudioGeneration] Chunk ${data.index + 1}/${data.total} saved and ready`);
  } else if (eventType === 'generation_complete') {
    // Finalize metadata
    await db.audioFiles.update(audioFileId!, {
      chunksComplete: data.totalChunks,
      totalDuration: data.totalDuration,
      completedAt: new Date()
    });
  }
}
```

**Playback** (`hooks/useProgressiveAudioPlayer.ts` - new):
```typescript
const audioContextRef = useRef<AudioContext | null>(null);
const scheduledChunksRef = useRef<ScheduledChunk[]>([]);
const nextStartTimeRef = useRef(0);

// Initialize
useEffect(() => {
  audioContextRef.current = new AudioContext();
  return () => audioContextRef.current?.close();
}, []);

// Load and schedule chunks
const loadChapter = useCallback(async (chapter: Chapter) => {
  const chunks = await getAudioChunks(chapter.id);

  for (const chunk of chunks) {
    await scheduleChunk(chunk, audioContextRef.current!);
  }

  setLoading(false);
}, []);

// Schedule individual chunk
const scheduleChunk = async (chunk: AudioChunk, audioContext: AudioContext) => {
  const arrayBuffer = await chunk.blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  scheduledChunksRef.current.push({
    source,
    startTime: nextStartTimeRef.current,
    duration: audioBuffer.duration
  });

  nextStartTimeRef.current += audioBuffer.duration;
  setDuration(nextStartTimeRef.current);
};

// Play all scheduled chunks
const play = useCallback(() => {
  const now = audioContextRef.current!.currentTime;

  scheduledChunksRef.current.forEach(scheduled => {
    scheduled.source.start(now + scheduled.startTime);
  });

  setPlaying(true);
}, []);
```

---

### 8. Browser Compatibility Summary

| Approach | Chrome | Firefox | Safari | Edge | Notes |
|----------|--------|---------|--------|------|-------|
| **Web Audio API (MP3)** | ✅ 33+ | ✅ 25+ | ✅ 6+ | ✅ 12+ | Universal support |
| **MSE with MP3** | ✅ 38+ | ❌ Not supported | ⚠️ Limited | ✅ 12+ | Firefox requires MP4 |
| **MSE with MP4/AAC** | ✅ 38+ | ✅ 42+ | ✅ 8+ | ✅ 12+ | Requires conversion |
| **Sequential `<audio>`** | ✅ All | ✅ All | ✅ All | ✅ All | Audible gaps |

**Recommendation**: **Web Audio API** has best compatibility with our current MP3 format.

---

### 9. Related Research

**Historical Context**:
- `thoughts/research/2025-11-09-tts-implementation-analysis-and-industry-best-practices-comparison.md` - Current TTS architecture analysis
- `thoughts/research/2025-11-09-tts-generation-progress-tracking-and-ux-analysis.md` - Progress tracking issues
- `thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md` - Original TTS plan

**Industry Patterns**:
- Amazon Audible: Uses MSE for audiobook streaming
- Spotify Web: Web Audio API for track transitions
- YouTube: MSE with adaptive bitrate for video/audio
- SoundCloud: Progressive MP3 loading with range requests

---

## Conclusion

Progressive audio streaming is **feasible and valuable** for improving TTS UX. The recommended approach is **Web Audio API with scheduled chunks** because it:

1. ✅ Works with existing MP3 format (no conversion needed)
2. ✅ Has universal browser support
3. ✅ Provides gapless playback
4. ✅ Moderate implementation complexity (20-30 hours)
5. ✅ Enables "play first chunk immediately" experience

**Key Implementation Changes**:
- Modify API route to stream chunks via SSE instead of concatenating
- Add chunk-based storage schema to IndexedDB
- Create new `useProgressiveAudioPlayer` hook with Web Audio API
- Update UI to show "Playing chunk 1/5, generating 2/5" status

**Trade-offs**:
- More complex state management (chunks vs single blob)
- Increased IndexedDB transaction overhead (mitigated with batching)
- Seeking requires re-implementation (acceptable limitation for MVP)

**Alternative**: If seeking is critical, consider MSE with server-side MP3 → MP4 conversion, but adds 10-15 hours of complexity.

The progressive approach provides a **significantly better user experience** with acceptable engineering effort.

---

## Files Referenced

**Current Implementation**:
- `app/api/tts/generate-stream/route.ts:156-203` - Server-side concatenation
- `hooks/useAudioGeneration.ts:82-148` - Client-side generation flow
- `hooks/useAudioPlayer.ts:39-148` - Current HTML5 Audio player
- `lib/db.ts:396-405` - Audio storage functions
- `types/index.ts:90-99` - AudioFile interface

**Related Research**:
- `thoughts/research/2025-11-09-tts-implementation-analysis-and-industry-best-practices-comparison.md` - TTS architecture
- `thoughts/research/2025-11-09-tts-generation-progress-tracking-and-ux-analysis.md` - Progress tracking
- `thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md` - Original plan
