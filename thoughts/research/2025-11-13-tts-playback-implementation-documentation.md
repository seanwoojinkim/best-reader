---
doc_type: research
date: 2025-11-13T15:48:52+00:00
title: "TTS Playback Implementation Documentation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T15:48:52+00:00"
research_question: "Research and document the current Text-to-Speech (TTS) playback implementation in this codebase"
research_type: codebase_research
researcher: Sean Kim

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - tts
  - audio
  - playback
  - state-management
  - component-architecture
status: complete

related_docs:
  - thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md
  - thoughts/research/2025-11-09-tts-implementation-analysis-and-industry-best-practices-comparison.md
  - thoughts/research/2025-11-11-parallel-tts-batching-research.md
---

# Research: TTS Playback Implementation Documentation

**Date**: 2025-11-13T15:48:52+00:00
**Researcher**: Sean Kim
**Git Commit**: f043ea027c72c71df95873aeac6edad6d812395b
**Branch**: main
**Repository**: reader

## Research Question

Research and document the current Text-to-Speech (TTS) playback implementation in this codebase, focusing on:
1. Playback state management and persistence
2. Audio player controls and affordances
3. Chapter/section navigation integration
4. Component architecture and state patterns
5. Known issues and implementation gaps

## Summary

The Adaptive Reader implements a **comprehensive client-side TTS system** with OpenAI TTS-1 API integration. The implementation includes parallel chunk processing, IndexedDB storage, full playback controls, bidirectional audio-reading synchronization, and sentence-level sync infrastructure (partially implemented). The system uses React hooks for state management, stores audio as ArrayBuffer for iOS compatibility, and tracks listening time in user sessions.

**Key Capabilities:**
- ✅ Chapter-level audio generation with parallel processing (5 concurrent requests)
- ✅ Retry logic with exponential backoff for failed chunks
- ✅ IndexedDB persistence using Dexie with ArrayBuffer storage (iOS-compatible)
- ✅ Playback controls: play/pause, seek, speed (0.75x-2.0x), sync toggle
- ✅ Bidirectional synchronization: audio → reading position (every 5s), reading → audio timestamp
- ✅ Listening time tracking in session analytics
- ✅ Sentence-level sync data generation and storage
- ⚠️ **Partially Implemented**: Sentence highlighting during playback (infrastructure exists, DOM manipulation incomplete)

**State Persistence:**
- Audio files stored in IndexedDB (`audioFiles` table) with ArrayBuffer for iOS compatibility
- Session listening time tracked and persisted to database
- **No playback position persistence** - playback state resets on app close/reopen

**Architecture Quality:**
- Clean separation of concerns with custom React hooks
- Type-safe TypeScript throughout
- iOS-specific optimizations (ArrayBuffer vs Blob storage)
- Error handling and retry logic for network failures

---

## Detailed Findings

### 1. Playback State Management and Persistence

#### 1.1 Current Playback State (In-Memory)

**Location**: `hooks/useAudioPlayer.ts:30-36`

The audio player maintains the following state in React hooks:

```typescript
const [playing, setPlaying] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);
const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Key Implementation Details:**
- `audioRef.current` - Reference to HTML5 `<Audio>` element ([useAudioPlayer.ts:30](lib:hooks/useAudioPlayer.ts:30))
- `currentObjectUrlRef.current` - Blob URL for loaded audio ([useAudioPlayer.ts:37](lib:hooks/useAudioPlayer.ts:37))
- `loadedChapterIdRef.current` - Tracks which chapter is loaded to avoid reloads ([useAudioPlayer.ts:38](lib:hooks/useAudioPlayer.ts:38))

#### 1.2 Chapter Tracking

**Location**: `components/reader/ReaderView.tsx:53`

```typescript
const [currentAudioChapter, setCurrentAudioChapter] = useState<Chapter | null>(null);
```

This state tracks which chapter is currently playing. When a user clicks "Play Audio" on a chapter button, this state is set, which triggers the `useAudioPlayer` hook to load and play that chapter's audio.

#### 1.3 Persistence Mechanisms

**Database Schema** ([lib/db.ts:42-45](lib:lib/db.ts:42-45)):

```typescript
chapters: '++id, bookId, order, cfiStart',
audioFiles: '++id, chapterId, generatedAt',
audioSettings: 'bookId, updatedAt',
audioUsage: '++id, chapterId, bookId, timestamp',
sentenceSyncData: '++id, audioFileId, chapterId, generatedAt', // Version 4
```

**What IS Persisted:**

1. **Audio Files** ([lib/db.ts:396-398](lib:lib/db.ts:396-398)):
   - Stored in IndexedDB `audioFiles` table
   - Includes `chapterId`, `buffer` (ArrayBuffer), `duration`, `voice`, `speed`, `sizeBytes`, `generatedAt`
   - Retrieved via `getAudioFile(chapterId)` ([useAudioPlayer.ts:113](lib:hooks/useAudioPlayer.ts:113))

2. **Audio Settings per Book** ([lib/db.ts:460-479](lib:lib/db.ts:460-479)):
   - Voice selection (6 OpenAI voices: alloy, echo, fable, onyx, nova, shimmer)
   - Playback speed (0.75x - 2.0x)
   - Auto-play preference
   - Stored in `audioSettings` table with `bookId` as primary key

3. **Listening Time** ([hooks/useSession.ts:130-149](lib:hooks/useSession.ts:130-149)):
   - Tracked in session via `listeningTime` state (seconds)
   - Persisted to `sessions` table as minutes when audio stops
   - Updated via `trackListeningTime(isPlaying)` in `useSession` hook

4. **Sentence Sync Data** ([lib/db.ts:502-506](lib:lib/db.ts:502-506)):
   - Sentence metadata with timestamps stored per audio file
   - Includes `startTime`, `endTime`, `startChar`, `endChar` for each sentence
   - Retrieved via `getSentenceSyncData(audioFileId)`

**What IS NOT Persisted:**

1. **Current Playback Position** - No localStorage or database entry for:
   - Which chapter was playing
   - Timestamp within that chapter
   - Playing/paused state

2. **Playback Queue** - No concept of:
   - Next/previous chapter queue
   - Auto-advance settings (except per-book `autoPlay` flag)

**Impact**: When the app is closed and reopened, users must manually navigate back to the chapter they were listening to and restart playback from the beginning. The reading position (CFI) is restored, but audio playback position is not.

#### 1.4 Session Lifecycle Handling

**Location**: `hooks/useSession.ts:36-52`

```typescript
// Start session on mount
useEffect(() => {
  const initSession = async () => {
    const id = await startSession(bookId);
    setSessionId(id);
    sessionIdRef.current = id;
  };

  initSession();

  // End session on unmount (uses refs to get latest values)
  return () => {
    if (sessionIdRef.current !== null) {
      endSession(sessionIdRef.current, pagesReadRef.current, wordsReadRef.current);
      onSessionEnd?.(sessionIdRef.current);
    }
  };
}, [bookId, onSessionEnd]);
```

**Listening Time Tracking** ([useSession.ts:130-149](lib:hooks/useSession.ts:130-149)):

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
```

**Integration** ([ReaderView.tsx:203-206](lib:components/reader/ReaderView.tsx:203-206)):

```typescript
// Track listening time when audio plays/pauses (TTS Phase 4)
useEffect(() => {
  trackListeningTime(audioPlayer.playing);
}, [audioPlayer.playing, trackListeningTime]);
```

### 2. Audio Player Controls and Affordances

#### 2.1 Play/Pause Control

**Location**: `components/reader/AudioPlayer.tsx:193-214`

```typescript
<button
  onClick={playing ? onPause : onPlay}
  disabled={loading}
  className="w-10 h-10 flex items-center justify-center rounded-full bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  aria-label={playing ? 'Pause' : 'Play'}
>
  {loading ? (
    // Spinner SVG
  ) : playing ? (
    // Pause icon (two vertical bars)
  ) : (
    // Play icon (triangle)
  )}
</button>
```

**Handler Implementation** ([hooks/useAudioPlayer.ts:184-237](lib:hooks/useAudioPlayer.ts:184-237)):

The `play()` function:
- Checks for audio element and source availability
- Calls `audioRef.current.play()` which returns a Promise
- Updates `playing` state on success
- Handles errors gracefully (especially `AbortError` when user rapidly clicks)

The `pause()` function ([useAudioPlayer.ts:239-244](lib:hooks/useAudioPlayer.ts:239-244)):
- Simply calls `audioRef.current.pause()`
- Updates `playing` state to `false`

#### 2.2 Progress Bar and Seeking

**Location**: `components/reader/AudioPlayer.tsx:92-115`

```typescript
<div
  className="relative h-1 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer mb-3"
  onMouseDown={handleSeekStart}
  onMouseMove={handleSeekMove}
  onMouseUp={handleSeekEnd}
  onMouseLeave={handleSeekEnd}
  role="slider"
  aria-label="Audio progress"
  aria-valuenow={Math.round(progress)}
  aria-valuemin={0}
  aria-valuemax={100}
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
```

**Seek Implementation** ([AudioPlayer.tsx:49-80](lib:components/reader/AudioPlayer.tsx:49-80)):

Uses local state for smooth seeking:
```typescript
const [seeking, setSeeking] = useState(false);
const [tempSeekTime, setTempSeekTime] = useState(0);

const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
  setSeeking(true);
  updateSeekTime(e);
};

const handleSeekEnd = () => {
  if (seeking) {
    onSeek(tempSeekTime); // Calls audioPlayer.seek()
    setSeeking(false);
  }
};
```

**Seek Handler** ([useAudioPlayer.ts:246-250](lib:hooks/useAudioPlayer.ts:246-250)):
```typescript
const seek = useCallback((time: number) => {
  if (audioRef.current) {
    audioRef.current.currentTime = Math.max(0, Math.min(time, duration));
  }
}, [duration]);
```

**Time Display** ([AudioPlayer.tsx:153-156](lib:components/reader/AudioPlayer.tsx:153-156)):
```typescript
<p className="text-xs text-gray-500 dark:text-gray-400">
  {formatDuration(displayTime)} / {formatDuration(duration)}
</p>
```

#### 2.3 Playback Speed Control

**Location**: `components/reader/AudioPlayer.tsx:161-168`

```typescript
<button
  onClick={cycleSpeed}
  className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
  aria-label={`Playback speed: ${playbackSpeed}x`}
>
  {playbackSpeed}x
</button>
```

**Available Speeds** ([AudioPlayer.tsx:28](lib:components/reader/AudioPlayer.tsx:28)):
```typescript
const PLAYBACK_SPEEDS = [0.75, 1.0, 1.25, 1.5, 2.0];
```

**Cycle Implementation** ([AudioPlayer.tsx:82-86](lib:components/reader/AudioPlayer.tsx:82-86)):
```typescript
const cycleSpeed = () => {
  const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
  const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
  onSpeedChange(PLAYBACK_SPEEDS[nextIndex]);
};
```

**Speed Application** ([useAudioPlayer.ts:252-258](lib:hooks/useAudioPlayer.ts:252-258)):
```typescript
const setSpeed = useCallback((speed: number) => {
  const validSpeed = Math.max(0.25, Math.min(4.0, speed));
  setPlaybackSpeed(validSpeed);
  if (audioRef.current) {
    audioRef.current.playbackRate = validSpeed;
  }
}, []);
```

#### 2.4 Chapter Navigation Controls

**Current Implementation**: No previous/next chapter buttons in the audio player UI.

**Chapter Selection**: Users select chapters via:
1. **Chapter List UI** - Shows all chapters with "Generate Audio" or "Play Audio" buttons
2. **ChapterAudioButton** ([components/reader/ChapterAudioButton.tsx:104-116](lib:components/reader/ChapterAudioButton.tsx:104-116)):
   - Green "Play Audio" button if audio exists
   - Blue "Generate Audio" button with cost estimate if no audio

**Auto-Advance**: Not currently implemented. When audio ends, the player simply closes ([useAudioPlayer.ts:60-63](lib:hooks/useAudioPlayer.ts:60-63)):
```typescript
const handleEnded = () => {
  setPlaying(false);
  onEnded?.();
};
```

Which triggers ([ReaderView.tsx:193-196](lib:components/reader/ReaderView.tsx:193-196)):
```typescript
onEnded: () => {
  setCurrentAudioChapter(null);
  trackListeningTime(false); // Stop tracking listening time
},
```

#### 2.5 Sync Toggle Control

**Location**: `components/reader/AudioPlayer.tsx:170-191`

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
    aria-label={syncEnabled ? 'Disable sync' : 'Enable sync'}
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {/* Circular arrows icon */}
    </svg>
  </button>
)}
```

**State Management** ([ReaderView.tsx:55](lib:components/reader/ReaderView.tsx:55)):
```typescript
const [syncEnabled, setSyncEnabled] = useState(true); // TTS Phase 4: Audio-reading sync toggle
```

**Effect**: When enabled, audio playback updates reading position every 5 seconds (see section 3.3 below).

#### 2.6 Reading Progress Display (Hybrid Feature)

**Location**: `components/reader/AudioPlayer.tsx:117-135`

```typescript
{readingProgress !== undefined && pagesRemaining !== undefined && timeRemaining && (
  <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2 px-2">
    <span className="font-medium">{Math.round(readingProgress)}%</span>
    <span className="text-gray-400 dark:text-gray-600">•</span>
    <span>{pagesRemaining === 1 ? '1 page left' : `${pagesRemaining} pages left`}</span>
    {pagesRemaining > 0 && (
      <>
        <span className="text-gray-400 dark:text-gray-600">•</span>
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          ~{timeRemaining}
        </span>
      </>
    )}
  </div>
)}
```

This displays reading progress (not audio progress) in the audio player bottom bar, creating a "hybrid" control that shows both reading and listening progress.

#### 2.7 Close Button

**Location**: `components/reader/AudioPlayer.tsx:139-147`

```typescript
<button
  onClick={onClose}
  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
  aria-label="Close audio player"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

Closes the audio player and stops playback.

### 3. Chapter/Section Navigation and TTS Integration

#### 3.1 Chapter Selection for TTS

**Chapter List UI**: Users open the chapter list via the table of contents icon in the reader controls. Each chapter displays a `ChapterAudioButton`.

**ChapterAudioButton States** ([components/reader/ChapterAudioButton.tsx](lib:components/reader/ChapterAudioButton.tsx)):

1. **Loading** (checking if audio exists) - Shows "Loading..." button
2. **Generating** (audio being generated) - Shows progress bar with percentage
3. **Has Audio** (audio exists) - Green "Play Audio" button
4. **No Audio** (needs generation) - Blue "Generate Audio" button with cost estimate

**Play Action** ([ChapterAudioButton.tsx:106-116](lib:components/reader/ChapterAudioButton.tsx:106-116)):
```typescript
if (hasAudio) {
  return (
    <button
      onClick={onPlay}
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 rounded transition-colors"
      aria-label="Play chapter audio"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
      Play Audio
    </button>
  );
}
```

This calls the `onPlay` handler which sets `currentAudioChapter` state, triggering audio loading and playback.

#### 3.2 TTS Generation Triggers

**Generate Button** ([ChapterAudioButton.tsx:119-136](lib:components/reader/ChapterAudioButton.tsx:119-136)):

Clicking "Generate Audio" calls `onGenerate()`, which is wired to:

**ReaderView Handler** (passed down to ChapterList → ChapterAudioButton):

```typescript
// In ReaderView, generation is handled per-chapter
// Multiple chapters can generate concurrently
const [generatingChapters, setGeneratingChapters] = useState<Map<number, { progress: number; message?: string }>>(new Map());
```

**Generation Flow** ([hooks/useAudioGeneration.ts:35-186](lib:hooks/useAudioGeneration.ts:35-186)):

1. **Check API Key** ([useAudioGeneration.ts:50-54](lib:hooks/useAudioGeneration.ts:50-54))
2. **Extract Chapter Text** (10% progress) - Uses `getChapterText()` from epub-utils
3. **Generate TTS Client-Side** (10% → 90%) - Calls `generateTTS()` in `lib/tts-client.ts`
4. **Convert to ArrayBuffer** (90%) - iOS compatibility
5. **Save to IndexedDB** (90% → 95%) - Stores audio file
6. **Generate Sentence Sync Data** (95% → 100%) - Parses sentences and generates timestamps

**Client-Side TTS** ([lib/tts-client.ts:132-358](lib:lib/tts-client.ts:132-358)):

The generation happens entirely in the browser using OpenAI SDK with `dangerouslyAllowBrowser: true`:

- Splits text into 4096-character chunks at sentence boundaries
- Processes chunks in parallel with concurrency limit (default: 5 concurrent requests)
- Implements retry logic with exponential backoff (max 3 retries per chunk)
- Concatenates audio buffers and converts to base64
- Estimates duration based on word count and speed

#### 3.3 Navigation Between Chapters During Playback

**Auto-Advance**: Not implemented. Audio ends and player closes.

**Manual Chapter Switch**: User can:
1. Close current audio player
2. Open chapter list
3. Click "Play Audio" on different chapter
4. New chapter loads and plays

**Bidirectional Sync** - Two-way synchronization exists:

**1. Audio → Reading Position** ([ReaderView.tsx:180-197](lib:components/reader/ReaderView.tsx:180-197)):

```typescript
onTimeUpdate: async (currentTime, duration) => {
  // TTS Phase 4: Sync audio → reading position (every 5 seconds to avoid excessive updates)
  const now = Date.now();
  if (syncEnabled && currentAudioChapter && book && now - lastSyncTimeRef.current > 5000) {
    const cfi = await timestampToCFI(book, currentAudioChapter, currentTime, duration);
    if (cfi && goToLocation) {
      goToLocation(cfi);
      lastSyncTimeRef.current = now;
    }
  }
},
```

Uses `timestampToCFI()` ([lib/audio-sync.ts:19-56](lib:lib/audio-sync.ts:19-56)) to convert audio timestamp to approximate EPUB CFI (Canonical Fragment Identifier) position.

**2. Reading → Audio Position** ([ReaderView.tsx:228-265](lib:components/reader/ReaderView.tsx:228-265)):

```typescript
const syncReadingToAudio = useCallback(async () => {
  if (!syncEnabled || !currentAudioChapter || !book || !currentLocation) return;

  // Prevent concurrent sync operations - CRITICAL FIX
  if (syncInProgressRef.current) {
    console.log('[ReaderView] Sync already in progress, skipping');
    return;
  }

  syncInProgressRef.current = true;

  try {
    // Check if current reading position is in current audio chapter
    const currentChapter = findChapterByCFI(book, chapters, currentLocation);

    if (currentChapter?.id === currentAudioChapter.id) {
      // Same chapter - sync timestamp
      const timestamp = await cfiToTimestamp(book, currentAudioChapter, currentLocation, audioPlayer.duration);
      if (timestamp !== null) {
        audioPlayer.seek(timestamp);
      }
    } else if (currentChapter?.id) {
      // Different chapter - check if it has audio and switch if available
      const audioFile = await getAudioFile(currentChapter.id);
      if (audioFile) {
        setCurrentAudioChapter(currentChapter);
      } else {
        // Chapter has no audio, pause playback
        audioPlayer.pause();
      }
    }
  } finally {
    syncInProgressRef.current = false;
  }
}, [syncEnabled, currentAudioChapter, book, currentLocation, chapters, audioPlayer]);
```

This syncs whenever the user navigates pages while audio is playing.

#### 3.4 Audio Chunk Management

**Chunking Strategy** ([lib/tts-client.ts:154-194](lib:lib/tts-client.ts:154-194)):

Text is split into chunks if longer than 4096 characters (OpenAI limit):

```typescript
const MAX_CHARS = 4096;
const chunks: string[] = [];

if (text.length <= MAX_CHARS) {
  chunks.push(text);
} else {
  // Find sentence boundaries for natural breaks
  const lastPeriod = chunkText.lastIndexOf('. ');
  const lastQuestion = chunkText.lastIndexOf('? ');
  const lastExclamation = chunkText.lastIndexOf('! ');
  const lastParagraph = chunkText.lastIndexOf('\n\n');

  const lastSentenceEnd = Math.max(
    lastPeriod,
    lastQuestion,
    lastExclamation,
    lastParagraph
  );

  if (lastSentenceEnd > MAX_CHARS * 0.7) {
    // Use sentence boundary if it's in the last 30%
    chunkText = chunkText.substring(0, lastSentenceEnd + 2);
  }
}
```

**Parallel Processing** ([lib/tts-client.ts:196-271](lib:lib/tts-client.ts:196-271)):

Chunks are processed in parallel with concurrency control:

```typescript
const MAX_CONCURRENT_REQUESTS = 5;
const limit = pLimit(MAX_CONCURRENT_REQUESTS);

const chunkPromises = chunks.map((chunk, index) =>
  limit(async (): Promise<ChunkResult> => {
    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await openai.audio.speech.create({
          model: 'tts-1',
          voice: voice,
          input: chunk,
          response_format: 'mp3',
          speed: validSpeed,
        });

        const chunkAudioBuffer = await response.arrayBuffer();
        completedChunks++;

        return { index, audioBuffer: chunkAudioBuffer, success: true };
      } catch (error: any) {
        // Retry logic with exponential backoff
        if (attempt < MAX_RETRIES && (error?.status === 429 || error?.status >= 500)) {
          const retryAfterMs = error?.headers?.['retry-after']
            ? parseInt(error.headers['retry-after']) * 1000
            : INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
          await sleep(retryAfterMs);
          continue;
        }
        throw error;
      }
    }
  })
);

const results = await Promise.allSettled(chunkPromises);
```

**Storage** ([lib/db.ts:396-398](lib:lib/db.ts:396-398)):

Audio is stored as a single concatenated ArrayBuffer per chapter:

```typescript
export async function saveAudioFile(audioFile: Omit<AudioFile, 'id'>): Promise<number> {
  return await db.audioFiles.add(audioFile);
}
```

Where `audioFile.buffer` contains the full MP3 data for the entire chapter.

### 4. Component Architecture and State Management

#### 4.1 Component Hierarchy

```
ReaderView (main container)
├── AudioPlayer (bottom bar)
│   ├── Progress bar (seeking)
│   ├── Play/Pause button
│   ├── Speed control
│   ├── Sync toggle
│   └── Close button
├── ChapterList (modal/drawer)
│   └── ChapterAudioButton (per chapter)
│       ├── Generate Audio button
│       └── Play Audio button
└── useAudioPlayer hook (playback logic)
    └── useAudioGeneration hook (generation logic)
        └── lib/tts-client.ts (OpenAI API)
```

#### 4.2 Custom Hooks

**1. useAudioPlayer** ([hooks/useAudioPlayer.ts](lib:hooks/useAudioPlayer.ts))

Purpose: Manages HTML5 Audio element and playback state

Key Functions:
- `play()` - Start playback
- `pause()` - Stop playback
- `seek(time)` - Jump to timestamp
- `setSpeed(speed)` - Adjust playback rate
- `loadChapter(chapter)` - Load audio from IndexedDB

State:
- `playing`, `currentTime`, `duration`, `playbackSpeed`, `loading`, `error`

Event Listeners:
- `timeupdate` - Fires continuously during playback, updates `currentTime` and calls `onTimeUpdate` callback
- `loadedmetadata` - Fires when audio metadata loads, sets `duration`
- `ended` - Fires when audio finishes, calls `onEnded` callback
- `error` - Handles audio playback errors

**2. useAudioGeneration** ([hooks/useAudioGeneration.ts](lib:hooks/useAudioGeneration.ts))

Purpose: Handles TTS generation from OpenAI API

Key Functions:
- `generateAudio(options)` - Main generation function
- `cancelGeneration()` - Abort ongoing generation

State:
- `generating`, `progress`, `error`

Generation Steps:
1. Extract chapter text from EPUB
2. Call `generateTTS()` client-side
3. Convert to ArrayBuffer for iOS
4. Save to IndexedDB
5. Generate sentence sync data
6. Log usage and cost

**3. useSession** ([hooks/useSession.ts](lib:hooks/useSession.ts))

Purpose: Track reading session and listening time

Key Functions:
- `trackPageTurn()` - Log page turns
- `trackListeningTime(isPlaying)` - Start/stop listening timer
- `endCurrentSession()` - Manually end session

State:
- `sessionId`, `pagesRead`, `wordsRead`, `listeningTime`

Listening Time Tracking:
- `startListening()` - Records `Date.now()` in ref
- `stopListening()` - Calculates elapsed time, updates state and database

**4. useSentenceSync** ([hooks/useSentenceSync.ts](lib:hooks/useSentenceSync.ts))

Purpose: Track current sentence during audio playback

Key Functions:
- `findCurrentSentence(time)` - Binary search to find sentence at timestamp (O(log n))

State:
- `currentSentenceIndex` - Index of currently playing sentence

Throttling: Updates every 100ms to avoid excessive re-renders

Callback: Calls `onSentenceChange(index)` when sentence changes

#### 4.3 State Flow Diagrams

**Audio Generation Flow:**

```
User clicks "Generate Audio" on ChapterAudioButton
  ↓
ReaderView calls audioGeneration.generateAudio()
  ↓
useAudioGeneration hook:
  1. Check API key
  2. Extract chapter text via getChapterText()
  3. Call lib/tts-client.ts → generateTTS()
     - Split into chunks
     - Parallel processing with retry logic
     - Concatenate buffers
  4. Save to IndexedDB
  5. Generate sentence sync data
  6. Update progress state (triggers UI re-render)
  ↓
ChapterAudioButton re-checks audio availability
  ↓
Button changes from "Generate" to "Play Audio"
```

**Audio Playback Flow:**

```
User clicks "Play Audio" on ChapterAudioButton
  ↓
ReaderView sets currentAudioChapter state
  ↓
useAudioPlayer hook useEffect triggers:
  1. loadChapter(chapter) called
  2. getAudioFile(chapterId) from IndexedDB
  3. Create Blob from ArrayBuffer
  4. Create object URL
  5. Set audioRef.current.src
  6. Call audioRef.current.load()
  ↓
User clicks Play button in AudioPlayer
  ↓
audioPlayer.play() called
  ↓
HTML5 Audio element starts playback
  ↓
timeupdate events fire (continuously)
  ↓
onTimeUpdate callback in ReaderView
  ↓
If syncEnabled: timestampToCFI() → goToLocation(cfi)
  ↓
Reading position updates in sync with audio
```

**Bidirectional Sync Flow:**

```
[Audio → Reading]
timeupdate event (every ~100ms)
  ↓
Throttled to 5s via lastSyncTimeRef
  ↓
timestampToCFI(currentTime) calculates approximate CFI
  ↓
goToLocation(cfi) updates epub.js rendition
  ↓
User sees page turn automatically

[Reading → Audio]
User manually turns page
  ↓
onLocationChange in useEpubReader fires
  ↓
syncReadingToAudio() triggered via useEffect
  ↓
findChapterByCFI() checks if still in same chapter
  ↓
If same chapter: cfiToTimestamp() → audioPlayer.seek()
If different chapter: load new chapter or pause
```

#### 4.4 Props Flow

**ReaderView → AudioPlayer:**

```typescript
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
  syncEnabled={syncEnabled}
  onToggleSync={() => setSyncEnabled(!syncEnabled)}
  readingProgress={stats.readingProgress}
  pagesRemaining={stats.pagesRemaining}
  timeRemaining={stats.estimatedTimeRemaining}
  showControls={showControls}
/>
```

All control handlers come from the `useAudioPlayer` hook. The `AudioPlayer` component is purely presentational - it receives state and handlers as props.

**ReaderView → ChapterList → ChapterAudioButton:**

```typescript
// In ChapterList
<ChapterAudioButton
  key={chapter.id}
  chapter={chapter}
  voice={audioSettings?.voice || 'alloy'}
  onGenerate={() => handleGenerateAudio(chapter)}
  onPlay={() => handlePlayAudio(chapter)}
  generating={generatingChapters.has(chapter.id!)}
  progress={generatingChapters.get(chapter.id!)?.progress || 0}
  message={generatingChapters.get(chapter.id!)?.message}
/>
```

#### 4.5 Data Flow: UI → Hooks → API

**Example: Generate Audio Flow**

```
ChapterAudioButton (UI)
  ↓ onClick={onGenerate}
ChapterList
  ↓ handleGenerateAudio(chapter)
ReaderView
  ↓ audioGeneration.generateAudio({ chapter, voice, speed, onProgress })
useAudioGeneration hook
  ↓ await generateTTS({ text, voice, speed, onProgress })
lib/tts-client.ts
  ↓ const openai = await createOpenAIClient()
  ↓ await openai.audio.speech.create({ model: 'tts-1', voice, input: chunk })
OpenAI API (external)
  ↓ Returns ArrayBuffer (MP3 audio)
lib/tts-client.ts
  ↓ Concatenate chunks, convert to base64
useAudioGeneration hook
  ↓ await saveAudioFile({ chapterId, buffer, duration, ... })
lib/db.ts
  ↓ await db.audioFiles.add(audioFile)
IndexedDB (browser storage)
```

**Example: Playback Flow**

```
AudioPlayer (UI)
  ↓ onClick={onPlay}
useAudioPlayer hook
  ↓ play()
  ↓ const audioFile = await getAudioFile(chapterId)
lib/db.ts
  ↓ await db.audioFiles.where('chapterId').equals(chapterId).first()
IndexedDB (browser storage)
  ↓ Returns { buffer: ArrayBuffer, duration, ... }
useAudioPlayer hook
  ↓ const blob = new Blob([buffer], { type: 'audio/mpeg' })
  ↓ const url = URL.createObjectURL(blob)
  ↓ audioRef.current.src = url
  ↓ audioRef.current.play()
HTML5 Audio element (browser)
  ↓ Playback starts
  ↓ 'timeupdate' events fire
useAudioPlayer hook
  ↓ handleTimeUpdate() → onTimeUpdate?.(currentTime, duration)
ReaderView
  ↓ timestampToCFI() → goToLocation(cfi)
epub.js rendition
  ↓ Page updates to match audio position
```

### 5. Known Issues, TODOs, and Implementation Gaps

#### 5.1 TODOs in Code

**1. Sentence Highlighting** ([lib/sentence-highlighter.ts:148](lib:lib/sentence-highlighter.ts:148))

```typescript
// For now, just log for debugging
console.log(`[SentenceHighlighter] Highlighting sentence ${sentenceIndex}:`, sentence.text.substring(0, 50));

// TODO: Implement actual highlighting via epub.js annotations
// or direct DOM manipulation. This requires more integration
// with epub.js internals.
```

**Status**: Sentence sync data is generated and stored, `useSentenceSync` hook tracks current sentence, but visual highlighting in the epub iframe is not implemented.

**Infrastructure Exists**:
- Sentence parser ([lib/sentence-parser.ts](lib:lib/sentence-parser.ts)) - Splits chapter into sentences
- Duration estimator ([lib/duration-estimator.ts](lib:lib/duration-estimator.ts)) - Estimates timestamps per sentence
- Database storage ([lib/db.ts:502-530](lib:lib/db.ts:502-530)) - Persists sentence metadata
- Sync hook ([hooks/useSentenceSync.ts](lib:hooks/useSentenceSync.ts)) - Tracks current sentence with binary search

**Gap**: DOM manipulation to apply CSS class to current sentence in epub.js iframe.

**2. Toast Notifications** ([hooks/useHighlights.ts:137, 161, 179, 196](lib:hooks/useHighlights.ts))

```typescript
// TODO Phase 3: Show toast notification to user
```

These TODOs are for highlight operations (create, update, delete), not directly related to TTS.

**3. Actual Words Per Page** ([hooks/useSession.ts:68](lib:hooks/useSession.ts:68))

```typescript
// Estimate words per page (average ~250 words per typical fiction book)
// NOTE: Known limitation - this is a rough estimate. Actual words per page varies:
//   - Children's books: ~100 words/page
//   - Fiction novels: 200-300 words/page
//   - Academic textbooks: ~400 words/page
//   - Poetry: ~50 words/page
// TODO Phase 3: Calculate actual words from rendition.getContents().content.textContent
```

Not TTS-specific, but affects session analytics accuracy.

#### 5.2 Implementation Gaps

**1. Playback Position Persistence**

**Gap**: No localStorage or database storage for:
- Current audio chapter ID
- Timestamp within chapter
- Playing/paused state

**Impact**: Users lose playback position on app close/reopen.

**Current Workaround**: Reading position (CFI) is restored, so users can see where they were reading, but must manually restart audio.

**2. Chapter Auto-Advance**

**Gap**: No automatic progression to next chapter when current chapter audio ends.

**Current Behavior**: Audio player closes when chapter ends ([ReaderView.tsx:193-196](lib:components/reader/ReaderView.tsx:193-196)).

**User Experience**: Users must manually:
1. Open chapter list
2. Find next chapter
3. Click "Play Audio"

**3. Previous/Next Chapter Controls**

**Gap**: No UI buttons in audio player for:
- Skip to next chapter
- Skip to previous chapter
- View chapter queue

**Current Workaround**: Users must close player and use chapter list.

**4. Sentence Highlighting Visual Implementation**

**Gap**: `SentenceHighlighter` class exists but `highlightSentence()` only logs to console.

**Infrastructure Complete**:
- ✅ Sentence parsing
- ✅ Timestamp generation
- ✅ Binary search for current sentence
- ✅ Database storage
- ✅ Hook integration

**Missing**: DOM manipulation to:
- Wrap sentences in `<span class="sentence-sync">` elements
- Apply `sentence-active` class to current sentence
- Handle epub.js iframe navigation

**Complexity**: epub.js uses iframes for rendering, requiring:
- Access to iframe's contentDocument
- Preservation of wrapping across page turns
- Coordination with epub.js annotation system

**5. Skip Forward/Backward Controls**

**Gap**: No ±10s or ±30s skip buttons in audio player UI.

**Current Workaround**: Users can drag the progress bar seek handle, but no keyboard shortcuts or dedicated buttons for quick skips.

**6. Audio Playback Error Recovery**

**Observation**: Error handling exists for:
- ✅ API key validation ([useAudioGeneration.ts:50-54](lib:hooks/useAudioGeneration.ts:50-54))
- ✅ Chunk generation failures with retry ([tts-client.ts:206-265](lib:lib/tts-client.ts:206-265))
- ✅ Rate limiting with exponential backoff ([tts-client.ts:251-258](lib:lib/tts-client.ts:251-258))
- ✅ Audio loading errors ([useAudioPlayer.ts:65-70](lib:hooks/useAudioPlayer.ts:65-70))

**No handling for**:
- Audio file corruption (IndexedDB data integrity)
- Network errors during playback (unlikely for local files)
- Browser codec incompatibility (MP3 should be universal)

#### 5.3 iOS-Specific Considerations

**ArrayBuffer Storage** ([useAudioGeneration.ts:105-124](lib:hooks/useAudioGeneration.ts:105-124)):

```typescript
// Convert base64 to ArrayBuffer only (90%)
console.log('[useAudioGeneration] Converting audio to ArrayBuffer for iOS compatibility...');
const audioBlob = base64ToBlob(audioData, 'audio/mpeg');
const audioBuffer = await audioBlob.arrayBuffer(); // Store ArrayBuffer for iOS persistence

// Step 4: Save to IndexedDB with only ArrayBuffer (90% -> 100%)
// Note: We create a temporary Blob just for type compatibility, but only store the buffer
const tempBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
const audioFile: Omit<AudioFile, 'id'> = {
  chapterId: chapter.id,
  blob: tempBlob, // Temporary Blob for compatibility (not persisted properly on iOS)
  buffer: audioBuffer, // ONLY this persists on iOS - 37MB instead of 74MB
  duration: duration!,
  voice: resultVoice!,
  speed: resultSpeed!,
  generatedAt: new Date(),
  sizeBytes: sizeBytes!,
};
```

**Reason**: iOS WebView has issues persisting Blobs to IndexedDB. ArrayBuffer is used as the primary storage format.

**Loading** ([useAudioPlayer.ts:136-143](lib:hooks/useAudioPlayer.ts:136-143)):

```typescript
// Prefer ArrayBuffer (iOS compatible) over Blob (may be invalid on iOS)
let audioBlob: Blob;
if (audioFile.buffer) {
  console.log('[useAudioPlayer] Using ArrayBuffer to create fresh Blob for iOS compatibility');
  audioBlob = new Blob([audioFile.buffer], { type: 'audio/mpeg' });
} else {
  console.log('[useAudioPlayer] No ArrayBuffer, falling back to stored Blob (may fail on iOS)');
  audioBlob = audioFile.blob;
}
```

This ensures audio plays correctly on iOS devices by creating a fresh Blob from the persisted ArrayBuffer.

#### 5.4 Performance Considerations

**Memory Management**:

**Object URL Cleanup** ([useAudioPlayer.ts:89-98](lib:hooks/useAudioPlayer.ts:89-98)):

```typescript
// Cleanup object URL on unmount
useEffect(() => {
  return () => {
    console.log('[useAudioPlayer] Component unmounting, cleaning up object URL');
    if (currentObjectUrlRef.current) {
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
    }
  };
}, []);
```

**Also on chapter change** ([useAudioPlayer.ts:128-133](lib:hooks/useAudioPlayer.ts:128-133)):

```typescript
// Revoke previous object URL to prevent memory leak
if (currentObjectUrlRef.current) {
  console.log('[useAudioPlayer] Revoking previous object URL:', currentObjectUrlRef.current);
  URL.revokeObjectURL(currentObjectUrlRef.current);
  currentObjectUrlRef.current = null;
}
```

**Good**: Proper cleanup prevents memory leaks from blob URLs.

**Sync Throttling**:

**Audio → Reading Sync** ([ReaderView.tsx:184-191](lib:components/reader/ReaderView.tsx:184-191)):

```typescript
// TTS Phase 4: Sync audio → reading position (every 5 seconds to avoid excessive updates)
const now = Date.now();
if (syncEnabled && currentAudioChapter && book && now - lastSyncTimeRef.current > 5000) {
  const cfi = await timestampToCFI(book, currentAudioChapter, currentTime, duration);
  if (cfi && goToLocation) {
    goToLocation(cfi);
    lastSyncTimeRef.current = now;
  }
}
```

**Good**: 5-second throttle prevents excessive CFI calculations and page updates.

**Reading → Audio Sync Protection** ([ReaderView.tsx:232-236](lib:components/reader/ReaderView.tsx:232-236)):

```typescript
// Prevent concurrent sync operations - CRITICAL FIX
if (syncInProgressRef.current) {
  console.log('[ReaderView] Sync already in progress, skipping');
  return;
}

syncInProgressRef.current = true;
```

**Good**: Prevents race conditions when user rapidly turns pages.

**Sentence Sync Throttling** ([hooks/useSentenceSync.ts:92-95](lib:hooks/useSentenceSync.ts:92-95)):

```typescript
// Throttle updates to every 100ms
const now = Date.now();
if (now - lastUpdateTime.current < 100) return;
lastUpdateTime.current = now;
```

**Good**: Prevents excessive re-renders during playback while maintaining smooth 10 FPS update rate.

#### 5.5 User Experience Observations

**Strengths**:
- ✅ Clear visual feedback during generation (progress bar with percentage and message)
- ✅ Cost transparency (shows estimated cost before generation)
- ✅ Multiple playback speeds with single-click cycling
- ✅ Sync toggle allows users to control automatic page turning
- ✅ Hybrid progress display (reading + audio context)

**Weaknesses**:
- ⚠️ No visual indication of which chapters have audio (must open chapter list to see)
- ⚠️ No playback queue or chapter navigation within player
- ⚠️ Lost playback position on app restart
- ⚠️ No keyboard shortcuts for audio controls
- ⚠️ No sentence highlighting during narration

### 6. Related Research Documents

**1. TTS Implementation Analysis** ([thoughts/research/2025-11-09-tts-implementation-analysis-and-industry-best-practices-comparison.md](lib:thoughts/research/2025-11-09-tts-implementation-analysis-and-industry-best-practices-comparison.md))

Compares current implementation to industry best practices. Key findings:
- ✅ Current implementation has strong architecture
- ⚠️ Missing word-level/sentence-level highlighting (industry standard)
- 📊 OpenAI TTS-1 lacks speech marks (Amazon Polly, Google TTS provide this)
- 📊 EPUB 3 Media Overlays use SMIL for pre-recorded narration sync

**2. Parallel TTS Batching** ([thoughts/research/2025-11-11-parallel-tts-batching-research.md](lib:thoughts/research/2025-11-11-parallel-tts-batching-research.md))

Research on current parallel processing implementation:
- ✅ Implements `pLimit` for concurrency control (5 concurrent requests)
- ✅ Retry logic with exponential backoff
- ✅ Proper error handling and chunk failure detection

**3. Background Audio and Media Controls** ([thoughts/research/2025-11-10-ENG-SYNC-001-background-audio-and-media-controls-in-capacitor-tts-apps.md](lib:thoughts/research/2025-11-10-ENG-SYNC-001-background-audio-and-media-controls-in-capacitor-tts-apps.md))

Research on implementing system media controls (lock screen, notification controls). Relevant for future mobile implementation.

---

## Code References Summary

### Core Files

| File | Purpose | Key Exports/Components |
|------|---------|----------------------|
| `hooks/useAudioPlayer.ts` | Audio playback logic | `useAudioPlayer` - play, pause, seek, speed control |
| `hooks/useAudioGeneration.ts` | TTS generation orchestration | `useAudioGeneration` - generateAudio, progress tracking |
| `hooks/useSession.ts` | Session and listening time tracking | `useSession` - trackListeningTime, session management |
| `hooks/useSentenceSync.ts` | Sentence tracking during playback | `useSentenceSync` - binary search for current sentence |
| `components/reader/AudioPlayer.tsx` | Audio player UI | AudioPlayer component - controls, progress bar |
| `components/reader/ChapterAudioButton.tsx` | Chapter audio button | ChapterAudioButton - generate/play UI |
| `lib/tts-client.ts` | OpenAI TTS client | `generateTTS` - chunk processing, parallel generation |
| `lib/db.ts` | IndexedDB operations | Audio CRUD, settings, usage tracking |
| `lib/audio-sync.ts` | CFI ↔ timestamp conversion | `timestampToCFI`, `cfiToTimestamp` |
| `lib/sentence-highlighter.ts` | Sentence highlighting (partial) | `SentenceHighlighter` class - DOM manipulation |
| `lib/sentence-parser.ts` | Sentence parsing | `parseChapterIntoSentences` |
| `lib/duration-estimator.ts` | Timestamp estimation | `generateSentenceTimestamps` |

### Database Schema

| Table | Primary Key | Purpose | Key Fields |
|-------|-------------|---------|-----------|
| `chapters` | `id` (auto-increment) | Chapter metadata | `bookId`, `title`, `cfiStart`, `cfiEnd`, `charCount`, `order` |
| `audioFiles` | `id` (auto-increment) | Generated audio storage | `chapterId`, `buffer`, `duration`, `voice`, `speed`, `sizeBytes` |
| `audioSettings` | `bookId` | Per-book preferences | `voice`, `playbackSpeed`, `autoPlay` |
| `audioUsage` | `id` (auto-increment) | Cost tracking | `chapterId`, `bookId`, `charCount`, `cost`, `timestamp` |
| `sentenceSyncData` | `id` (auto-increment) | Sentence timestamps | `audioFileId`, `chapterId`, `sentences[]`, `version` |
| `sessions` | `id` (auto-increment) | Reading sessions | `bookId`, `startTime`, `endTime`, `listeningTime` |

### State Management Patterns

**React Hooks Used**:
- `useState` - Component-level state (playing, currentTime, etc.)
- `useEffect` - Side effects (load audio, sync position, cleanup)
- `useRef` - Persistent references (audioRef, lastSyncTimeRef, syncInProgressRef)
- `useCallback` - Memoized callbacks (play, pause, seek)

**Custom Hook Pattern**:
- Pure logic in hooks (`useAudioPlayer`, `useAudioGeneration`)
- Presentational components receive state + handlers as props
- No Redux/Zustand - all state is local or in IndexedDB

**Refs for Performance**:
- `audioRef` - Persistent reference to Audio element (never recreate)
- `lastSyncTimeRef` - Throttle sync without triggering re-renders
- `syncInProgressRef` - Prevent concurrent operations
- `listeningStartRef` - Track listening time without state updates

---

## Architecture Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          ReaderView                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ State:                                                    │   │
│  │  - currentAudioChapter                                    │   │
│  │  - syncEnabled                                            │   │
│  │  - sentenceSyncData                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ useAudioPlayer  │  │ useAudio     │  │ useSentenceSync │   │
│  │                 │  │ Generation   │  │                 │   │
│  │ - play()        │  │              │  │ - current       │   │
│  │ - pause()       │  │ - generate   │  │   SentenceIndex │   │
│  │ - seek()        │  │   Audio()    │  │                 │   │
│  │ - setSpeed()    │  │              │  │                 │   │
│  │ - loadChapter() │  │              │  │                 │   │
│  └────────┬────────┘  └──────┬───────┘  └────────┬────────┘   │
│           │                  │                    │            │
│           ▼                  ▼                    ▼            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     lib/db.ts                             │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │           IndexedDB (Dexie)                       │    │  │
│  │  │  - audioFiles (ArrayBuffer storage)               │    │  │
│  │  │  - audioSettings (voice, speed, autoPlay)         │    │  │
│  │  │  - sentenceSyncData (sentence timestamps)         │    │  │
│  │  │  - audioUsage (cost tracking)                     │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  lib/tts-client.ts                        │  │
│  │  - generateTTS()                                          │  │
│  │  - Chunk text into 4096-char segments                     │  │
│  │  - Parallel processing (5 concurrent requests)            │  │
│  │  - Retry logic with exponential backoff                   │  │
│  │  - Concatenate audio buffers                              │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 OpenAI TTS-1 API                          │  │
│  │  POST /audio/speech                                       │  │
│  │  { model: 'tts-1', voice, input, speed }                  │  │
│  │  Returns: ArrayBuffer (MP3)                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      UI Components                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              AudioPlayer (Bottom Bar)                     │   │
│  │  - Progress bar (seeking)                                 │   │
│  │  - Play/Pause button                                      │   │
│  │  - Speed control (0.75x - 2.0x)                           │   │
│  │  - Sync toggle (audio ↔ reading)                          │   │
│  │  - Reading progress display (hybrid)                      │   │
│  │  - Close button                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            ChapterList → ChapterAudioButton               │   │
│  │  States:                                                  │   │
│  │  - "Generate Audio ($0.XX)" - No audio exists             │   │
│  │  - "Generating... 45%" - Generation in progress           │   │
│  │  - "Play Audio" - Audio ready                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Open Questions

1. **Playback Position Persistence Strategy**: Should playback position be stored in:
   - localStorage (fast, simple)
   - IndexedDB (consistent with other state)
   - Separate table or add fields to `sessions`?

2. **Auto-Advance Design**: Should next chapter auto-play or require confirmation?
   - Option 1: Auto-play with toast notification ("Playing: Chapter 5")
   - Option 2: Show "Play Next Chapter" button at end of current chapter
   - Option 3: User preference in audio settings

3. **Sentence Highlighting Approach**:
   - Option 1: epub.js annotations API (proper integration)
   - Option 2: Direct iframe DOM manipulation (fragile but simpler)
   - Option 3: Custom overlay layer outside iframe (more control)

4. **Chapter Queue Implementation**: Should there be:
   - Up Next queue (user selects multiple chapters)
   - Auto-queue (all chapters in order)
   - Smart queue (continue from current + next N chapters)

5. **Keyboard Shortcuts**: What keybindings make sense?
   - Space: Play/Pause
   - Left/Right arrows: Skip ±10s or ±30s?
   - Up/Down arrows: Speed up/down?
   - N: Next chapter?
   - P: Previous chapter?

---

## Conclusion

The Adaptive Reader TTS implementation is a **well-architected, production-ready system** with comprehensive audio generation, storage, and playback capabilities. The use of parallel chunk processing, retry logic, and iOS-compatible storage demonstrates attention to performance and cross-platform compatibility.

**Strengths**:
- Clean separation of concerns (hooks, components, services)
- Type-safe TypeScript throughout
- Robust error handling and retry mechanisms
- Bidirectional audio-reading synchronization
- Listening time analytics integration
- Sentence-level sync infrastructure (data generation complete)

**Primary Gaps**:
1. No playback position persistence (user loses place on app restart)
2. No chapter auto-advance or queue management
3. No previous/next chapter controls in player
4. Incomplete sentence highlighting (infrastructure exists, DOM manipulation missing)
5. No skip forward/backward buttons (±10s, ±30s)

**Next Steps** (based on findings, not recommendations):
- Playback position persistence would require adding fields to store current audio chapter ID and timestamp
- Auto-advance would require modifying the `onEnded` handler in useAudioPlayer
- Sentence highlighting completion would require implementing DOM manipulation in SentenceHighlighter class
- Chapter navigation controls would require adding previous/next handlers and checking for adjacent chapters with audio

All infrastructure for sentence-level synchronization exists and is functional. The only missing piece is the visual highlighting in the epub.js iframe, which is a DOM manipulation challenge rather than a data or logic gap.
