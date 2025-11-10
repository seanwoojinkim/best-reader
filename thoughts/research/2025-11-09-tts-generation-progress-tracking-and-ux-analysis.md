---
doc_type: research
date: 2025-11-10T01:47:41+00:00
title: "TTS Generation Progress Tracking and UX Analysis"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T01:47:41+00:00"
research_question: "How is TTS generation triggered, tracked, and displayed in the UI? Why does progress show as 30% until completion and why do multiple TTS generations interfere with each other?"
research_type: codebase_research
researcher: Sean Kim

git_commit: e74a3b024a908db237ac8e87389af1eec736d6c1
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Sean Kim

tags:
  - tts
  - progress-tracking
  - state-management
  - ui-ux
status: complete

related_docs:
  - thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md
  - thoughts/implementation-details/2025-11-09-ENG-TTS-001-tts-audio-phase-4-progress-synchronization-session-tracking.md
---

# Research: TTS Generation Progress Tracking and UX Analysis

**Date**: 2025-11-10T01:47:41+00:00
**Researcher**: Sean Kim
**Git Commit**: e74a3b024a908db237ac8e87389af1eec736d6c1
**Branch**: main
**Repository**: reader

## Research Question

How is TTS generation triggered, tracked, and displayed in the UI? Why does progress show as 30% until completion and why do multiple TTS generations interfere with each other?

## Summary

The TTS generation system in this codebase integrates OpenAI's Text-to-Speech API with a custom React hook-based architecture. The system uses a single-instance state management pattern where only one chapter can be tracked as "generating" at a time. Progress tracking is implemented with hardcoded milestones (10%, 30%, 80%, 90%, 100%) that do not reflect real-time API progress. The progress appears stuck at 30% because the OpenAI API call (lines 66-75 in `hooks/useAudioGeneration.ts`) is a single blocking operation with no progress reporting. When multiple TTS generations are triggered, the state management in `ReaderView.tsx` only tracks one `generatingChapterId`, causing previous generation states to be overwritten.

## Detailed Findings

### 1. TTS Generation API Integration

**Location**: [`app/api/tts/generate/route.ts`](file:///Users/seankim/dev/reader/app/api/tts/generate/route.ts)

The OpenAI TTS integration is implemented as a Next.js API route:

- **Lines 10-13**: OpenAI client initialization with API key from environment variables
- **Lines 15-149**: POST endpoint that handles TTS generation requests
- **Lines 28-36**: Input validation for chapter text
- **Lines 38-43**: Voice validation using the `isValidVoice` function
- **Lines 45**: Speed normalization (0.25 to 4.0 range)
- **Lines 47-82**: Text chunking logic for OpenAI's 4096 character limit
  - Splits text at sentence boundaries (periods, questions, exclamations, paragraph breaks)
  - Uses 70% threshold for finding good breaking points (line 72)
  - Ensures chunks end at natural sentence boundaries
- **Lines 87-100**: Sequential chunk processing
  - Each chunk generates separate audio via OpenAI API (lines 90-96)
  - Model: `tts-1`
  - Response format: `mp3`
  - Buffers are collected in array
- **Lines 103**: All audio buffers concatenated into single buffer
- **Lines 106-113**: Metadata calculation
  - Cost: $0.015 per 1K characters (line 107)
  - Duration estimation: 150 words/min adjusted by speed (line 112)
- **Lines 115-124**: Response returns base64-encoded audio data with metadata
- **Lines 128-138**: Error handling for rate limits and API errors

**Key observation**: The API endpoint is a **synchronous, blocking operation** with no progress streaming. The entire generation (including all chunks) completes before returning a response.

### 2. Audio Generation Hook State Management

**Location**: [`hooks/useAudioGeneration.ts`](file:///Users/seankim/dev/reader/hooks/useAudioGeneration.ts)

The `useAudioGeneration` hook manages the client-side TTS generation flow:

- **Lines 26-29**: State variables
  - `generating`: boolean flag for generation status
  - `progress`: number from 0-100
  - `error`: error message string
  - `abortController`: for cancellation support
- **Lines 31-137**: `generateAudio` function with hardcoded progress milestones
  - **Line 44**: Sets `generating = true`
  - **Line 45**: Progress → 10% (initial state)
  - **Lines 52-56**: Chapter text extraction
  - **Line 62**: Progress → **30%** (text extracted, **before API call**)
  - **Lines 64-75**: OpenAI API fetch call (**blocking operation, no progress updates**)
  - **Line 83**: Progress → 80% (API call completed)
  - **Lines 91-94**: Base64 to Blob conversion, Progress → 90%
  - **Lines 96-107**: Save to IndexedDB
  - **Lines 109-117**: Log usage metadata
  - **Line 119**: Progress → 100%
  - **Line 120**: Sets `generating = false`
- **Lines 124-136**: Error handling
  - Catches abort errors and general errors
  - Resets progress to 0
  - Sets `generating = false`
- **Lines 139-147**: `cancelGeneration` function
  - Aborts the fetch request via AbortController
  - Resets all state

**Why progress shows 30% until completion**:
- Line 62 sets progress to 30% immediately after text extraction
- Lines 66-75 make the OpenAI API fetch call, which is a **single synchronous operation**
- During the API call (which can take 10-60+ seconds for long chapters), there are **no progress updates**
- Progress only advances to 80% after the API call completes (line 83)
- The long blocking period between lines 62 and 83 is why users see progress stuck at 30%

### 3. UI Components for TTS Status Display

#### ChapterAudioButton Component

**Location**: [`components/reader/ChapterAudioButton.tsx`](file:///Users/seankim/dev/reader/components/reader/ChapterAudioButton.tsx)

This component displays per-chapter audio generation status:

- **Lines 13-14**: Props include `generating` boolean and `progress` number (0-100)
- **Lines 25-26**: Local state for `hasAudio` and `loading`
- **Lines 29-39**: useEffect checks if audio exists in IndexedDB
  - Re-checks when `progress` changes (line 39), detecting generation completion
- **Lines 43-49**: Loading state renders disabled button with "Loading..." text
- **Lines 51-57**: **Generating state** (when `generating === true`)
  - Renders disabled button with sky blue styling
  - Displays text: `"Generating... {Math.round(progress)}%"` (line 54)
  - This is where users see "Generating... 30%" during the API call
- **Lines 59-72**: Audio exists state - shows "Play Audio" button with green styling
- **Lines 74-91**: No audio state - shows "Generate Audio" button with cost estimate

#### ChapterList Component

**Location**: [`components/reader/ChapterList.tsx`](file:///Users/seankim/dev/reader/components/reader/ChapterList.tsx)

This component manages the list of chapters in the side panel:

- **Lines 14-15**: Props include:
  - `generatingChapterId: number | null` (single chapter ID being generated)
  - `generationProgress: number` (0-100 progress value)
- **Lines 61-68**: Renders `ChapterAudioButton` for each chapter
  - **Line 66**: `generating={generatingChapterId === chapter.id}`
    - Only the chapter matching `generatingChapterId` shows as generating
    - Other chapters show as not generating, even if they were previously triggered
  - **Line 67**: `progress={generatingChapterId === chapter.id ? generationProgress : 0}`
    - Progress only shown for the current `generatingChapterId`
    - All other chapters get progress of 0

**This reveals the state interference issue**: The component only supports tracking **one** generating chapter at a time via a single `generatingChapterId` state variable.

### 4. State Management in ReaderView

**Location**: [`components/reader/ReaderView.tsx`](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx)

The parent component manages global TTS generation state:

- **Line 155**: Instantiates `useAudioGeneration` hook (single instance)
- **Line 156**: Declares `generatingChapterId` state
  ```typescript
  const [generatingChapterId, setGeneratingChapterId] = useState<number | null>(null);
  ```
  - This is a **single value**, not an array or set
  - Can only track ONE chapter ID at a time

- **Lines 400-411**: `onGenerateAudio` callback
  - **Line 401**: `setGeneratingChapterId(chapter.id || null)` - **overwrites previous value**
  - **Line 402**: Calls `audioGeneration.generateAudio()` (async operation)
  - **Line 407**: `setGeneratingChapterId(null)` - clears the ID when complete

- **Lines 416-417**: Props passed to `ChapterList`
  ```typescript
  generatingChapterId={generatingChapterId}
  generationProgress={audioGeneration.progress}
  ```
  - Single `generatingChapterId` shared across all chapters
  - Single `progress` value from the hook shared across all chapters

**Why multiple TTS generations interfere with each other**:

1. When user clicks "Generate Audio" for Chapter 1:
   - `generatingChapterId` is set to Chapter 1's ID (line 401)
   - Chapter 1's button shows "Generating... 30%"
   - API call begins (async)

2. If user clicks "Generate Audio" for Chapter 2 before Chapter 1 completes:
   - `generatingChapterId` is **overwritten** with Chapter 2's ID (line 401)
   - Chapter 1's button **immediately loses** its generating state (line 66 in ChapterAudioButton)
   - Chapter 2's button now shows "Generating... 10%" (or whatever the new hook's progress is)
   - Chapter 1 continues generating in the background, but its UI no longer reflects this

3. The `useAudioGeneration` hook (line 155) is a **single instance**:
   - Only ONE `generateAudio` call can be tracked at a time
   - If a second call is made, the hook's state (`generating`, `progress`) reflects the second call
   - The first call continues in the background but its progress is no longer tracked

### 5. Audio Player Component

**Location**: [`components/reader/AudioPlayer.tsx`](file:///Users/seankim/dev/reader/components/reader/AudioPlayer.tsx)

This component displays the audio playback UI (separate from generation):

- **Lines 7-21**: Props for playback state (playing, currentTime, duration, etc.)
- **Lines 19-20**: Optional sync props (`syncEnabled`, `onToggleSync`)
- **Lines 83-106**: Progress bar for playback position (not generation progress)
- **Lines 165-186**: Play/Pause button with loading spinner
  - Loading state (line 172-176) shows spinner during audio file loading
  - This is distinct from the generation progress

**Note**: This component does NOT display generation progress. It only shows playback progress for already-generated audio.

### 6. Progress Tracking Flow Diagram

Current implementation flow from trigger to completion:

```
User clicks "Generate Audio" for Chapter X
          ↓
ReaderView.onGenerateAudio (line 400-411)
          ↓
setGeneratingChapterId(X)  ← [SINGLE STATE VARIABLE]
          ↓
audioGeneration.generateAudio() called
          ↓
useAudioGeneration hook (hooks/useAudioGeneration.ts)
          ↓
Progress: 10% - Initial state
          ↓
Progress: 30% - Text extraction complete
          ↓
[API CALL STARTS - NO PROGRESS UPDATES] ← [BLOCKING OPERATION]
  - fetch('/api/tts/generate') called
  - OpenAI processes text chunks sequentially
  - Can take 10-60+ seconds
  - NO callbacks or streaming updates
          ↓
[API CALL COMPLETES]
          ↓
Progress: 80% - API response received
          ↓
Progress: 90% - Audio blob created
          ↓
Progress: 100% - Saved to IndexedDB
          ↓
setGeneratingChapterId(null)
          ↓
ChapterAudioButton re-checks audio existence
          ↓
Button changes to "Play Audio"
```

If a second chapter is triggered during the blocking API call:
```
Chapter 1: [10% → 30% → BLOCKING API CALL...]
                            ↓
User clicks Chapter 2:     setGeneratingChapterId(2)  ← [OVERWRITES 1]
                            ↓
Chapter 1 button:          generating = false (generatingChapterId !== 1)
Chapter 2 button:          generating = true (generatingChapterId === 2)
                            ↓
Chapter 1:                 Still generating in background, no UI indication
Chapter 2:                 Shows progress UI, new API call starts
```

### 7. Database Schema for Audio Files

**Location**: Referenced in `hooks/useAudioGeneration.ts`

- **Lines 3**: Import `saveAudioFile` and `logAudioUsage` from `@/lib/db`
- **Lines 97-105**: `AudioFile` structure saved to IndexedDB
  - `chapterId`: Foreign key to chapter
  - `blob`: Audio data as Blob
  - `duration`: Estimated duration in seconds
  - `voice`: OpenAI voice used
  - `speed`: Playback speed
  - `generatedAt`: Timestamp
  - `sizeBytes`: File size
- **Line 107**: Returns saved audio file ID
- **Lines 109-117**: Usage logging
  - `chapterId`, `bookId`, `charCount`, `cost`, `voice`, `timestamp`

The database stores completed audio files but does **not** store generation progress or in-progress generation state.

## Code References

- [`app/api/tts/generate/route.ts:66-75`](file:///Users/seankim/dev/reader/app/api/tts/generate/route.ts#L66-L75) - OpenAI API fetch call (blocking operation)
- [`app/api/tts/generate/route.ts:87-100`](file:///Users/seankim/dev/reader/app/api/tts/generate/route.ts#L87-L100) - Sequential chunk processing loop
- [`hooks/useAudioGeneration.ts:26-29`](file:///Users/seankim/dev/reader/hooks/useAudioGeneration.ts#L26-L29) - State variables for generation
- [`hooks/useAudioGeneration.ts:45`](file:///Users/seankim/dev/reader/hooks/useAudioGeneration.ts#L45) - Progress set to 10%
- [`hooks/useAudioGeneration.ts:62`](file:///Users/seankim/dev/reader/hooks/useAudioGeneration.ts#L62) - Progress set to 30% (before API call)
- [`hooks/useAudioGeneration.ts:66-75`](file:///Users/seankim/dev/reader/hooks/useAudioGeneration.ts#L66-L75) - API fetch call (no progress updates during this time)
- [`hooks/useAudioGeneration.ts:83`](file:///Users/seankim/dev/reader/hooks/useAudioGeneration.ts#L83) - Progress set to 80% (after API completes)
- [`components/reader/ChapterAudioButton.tsx:51-57`](file:///Users/seankim/dev/reader/components/reader/ChapterAudioButton.tsx#L51-L57) - Generating state UI display
- [`components/reader/ChapterAudioButton.tsx:54`](file:///Users/seankim/dev/reader/components/reader/ChapterAudioButton.tsx#L54) - Progress percentage display
- [`components/reader/ChapterList.tsx:66`](file:///Users/seankim/dev/reader/components/reader/ChapterList.tsx#L66) - Generation state conditional (single chapter check)
- [`components/reader/ChapterList.tsx:67`](file:///Users/seankim/dev/reader/components/reader/ChapterList.tsx#L67) - Progress value conditional (single chapter check)
- [`components/reader/ReaderView.tsx:156`](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L156) - `generatingChapterId` state declaration (single value)
- [`components/reader/ReaderView.tsx:401`](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L401) - State update that overwrites previous chapter ID
- [`components/reader/ReaderView.tsx:416-417`](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L416-L417) - Props passed to ChapterList

## Architecture Documentation

### Current Architecture Pattern: Single-Instance Generation Tracking

The TTS generation system uses a **singleton state pattern**:

1. **Single Hook Instance**: One `useAudioGeneration` hook instance in `ReaderView.tsx` (line 155)
2. **Single State Variable**: One `generatingChapterId` state variable (line 156)
3. **Single Progress Value**: One `progress` value from the hook shared across UI
4. **No Concurrent Generation Tracking**: No data structure to track multiple in-progress generations

### Design Decisions (Implicit)

Based on code analysis, the architecture makes these implicit design decisions:

1. **Synchronous API Design**: The OpenAI API endpoint (`/api/tts/generate`) is a blocking operation
   - No streaming responses
   - No progress callbacks
   - Returns only after complete generation

2. **Milestone-Based Progress**: Progress is tracked by hardcoded milestones, not actual API progress
   - 10%: Generation started
   - 30%: Text extracted
   - 80%: API completed
   - 90%: Blob created
   - 100%: Saved to database

3. **No Concurrent Generation Support**: The state management only supports tracking one generation at a time
   - No queue system
   - No array of generating chapters
   - No per-chapter progress tracking

4. **Fire-and-Forget Backend**: Once the API call starts, there's no way to query its progress
   - No job queue
   - No progress polling endpoint
   - No WebSocket updates

### Technology Stack for TTS

- **TTS Provider**: OpenAI Text-to-Speech API (`tts-1` model)
- **HTTP Client**: Next.js fetch API (client-side)
- **State Management**: React hooks (useState, useCallback)
- **Storage**: IndexedDB (via `@/lib/db` utilities)
- **Chunking**: Custom text chunking logic for 4096 character OpenAI limit

## Historical Context (from thoughts/)

Reviewed related implementation documents:

### Phase 4 Implementation Document

**Location**: [`thoughts/implementation-details/2025-11-09-ENG-TTS-001-tts-audio-phase-4-progress-synchronization-session-tracking.md`](file:///Users/seankim/dev/reader/thoughts/implementation-details/2025-11-09-ENG-TTS-001-tts-audio-phase-4-progress-synchronization-session-tracking.md)

This document describes Phase 4 implementation which focused on **playback synchronization**, not generation progress:

- Audio-to-reading position sync (lines 77-92)
- Reading-to-audio position sync (callback described)
- Listening time tracking (lines 62-75)
- Sync toggle UI (lines 96-104)

**Note**: Phase 4 did NOT address generation progress tracking or multi-generation state management. Those are separate concerns not yet covered in the implementation phases.

### TTS Implementation Plan

**Location**: [`thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md`](file:///Users/seankim/dev/reader/thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md)

The original plan document would contain the phased implementation approach. The current research reveals:
- Phases 1-4 have been implemented (database, API integration, UI, sync)
- Phase 5 may include settings and usage dashboard
- Generation progress tracking improvements were not explicitly scoped in the phases

## Related Research

- No existing research documents directly addressing TTS generation progress tracking issues
- Phase implementation documents focus on feature development, not progress tracking UX

## Open Questions

1. **Is concurrent multi-chapter generation a desired feature?**
   - Current architecture only supports one generation at a time
   - Would require state refactoring to support concurrent tracking

2. **Can OpenAI API provide real-time progress?**
   - Current implementation uses no streaming or progress callbacks
   - May not be supported by OpenAI TTS API

3. **Should there be a backend job queue?**
   - Would enable better progress tracking
   - Would support concurrent generations
   - Would require additional infrastructure

4. **Is the 30% "stuck" progress acceptable UX?**
   - Users may perceive the system as frozen
   - Could add "Generating audio..." spinner instead of percentage
   - Could show chunk progress (e.g., "Chunk 2/5")

5. **Should the UI prevent multi-generation attempts?**
   - Could disable all "Generate" buttons while one is in progress
   - Could show queue position
   - Could allow concurrent but with accurate state tracking

## Technical Constraints

1. **OpenAI API Constraints**:
   - 4096 character limit per request (line 48 in route.ts)
   - Sequential chunk processing required (no parallel chunk generation)
   - No built-in progress reporting from OpenAI SDK
   - Rate limits may apply (handled on line 129-137 in route.ts)

2. **Frontend State Constraints**:
   - React state updates are synchronous within a single render cycle
   - Cannot track progress during a blocking fetch call without polling or streaming
   - useState hook in ReaderView can only hold one chapter ID

3. **Architecture Constraints**:
   - Next.js API routes are stateless (no persistent job tracking)
   - No WebSocket or Server-Sent Events infrastructure
   - IndexedDB only stores completed audio files, not in-progress state

## Answers to Research Questions

### 1. How is TTS generation triggered and processed?

- **Triggered**: User clicks "Generate Audio" button in `ChapterList` (line 64 in ChapterList.tsx)
- **Handler**: `onGenerateAudio` callback in `ReaderView` (lines 400-411)
- **Processing**:
  1. Extract chapter text via `getChapterText` (line 55 in useAudioGeneration.ts)
  2. Call `/api/tts/generate` API endpoint (line 66-75 in useAudioGeneration.ts)
  3. Backend chunks text, calls OpenAI for each chunk (lines 87-100 in route.ts)
  4. Concatenate audio buffers (line 103 in route.ts)
  5. Return base64 audio data (lines 115-124 in route.ts)
  6. Client converts to Blob and saves to IndexedDB (lines 92-107 in useAudioGeneration.ts)

### 2. How is progress tracked and displayed?

- **Tracked**: Via `progress` state in `useAudioGeneration` hook (line 27)
- **Updated**: At hardcoded milestones (10%, 30%, 80%, 90%, 100%)
- **Displayed**: In `ChapterAudioButton` component (line 54) as "Generating... X%"
- **Propagation**: `ReaderView` passes `audioGeneration.progress` to `ChapterList` (line 417), which passes to `ChapterAudioButton` (line 67)

### 3. Why does progress show as 30% until completion?

**Root cause**: The OpenAI API fetch call (lines 66-75 in useAudioGeneration.ts) is a **blocking synchronous operation** with no intermediate updates.

**Timeline**:
1. Progress set to 30% on line 62 (text extraction complete)
2. fetch() called on line 66 - **blocks until complete** (10-60+ seconds)
3. No code between lines 62 and 83 updates progress
4. Progress jumps to 80% on line 83 (after fetch completes)

**Why no intermediate updates**: JavaScript's fetch API returns a Promise that resolves only when the entire response is received. There are no progress events for the response body download in this implementation.

### 4. State management for multiple TTS generations

**Current state**: Does NOT support tracking multiple generations simultaneously.

**Evidence**:
- Single `generatingChapterId` state variable (line 156 in ReaderView.tsx)
- Setting new chapter ID overwrites the previous one (line 401)
- UI only shows generating state for the chapter matching the current ID (line 66 in ChapterList.tsx)

**What happens**:
- Only the most recently triggered generation is tracked
- Previous generations continue in background but show no UI indication
- When background generations complete, their state updates are ignored (generatingChapterId is already different)

### 5. How UI indicates TTS generation status

**Component**: `ChapterAudioButton.tsx`

**States displayed**:
1. **Loading** (lines 43-49): "Loading..." - checking if audio exists
2. **Generating** (lines 51-57): "Generating... X%" - sky blue button, disabled
3. **Has Audio** (lines 59-72): "Play Audio" - green button, clickable
4. **No Audio** (lines 74-91): "Generate Audio ($X.XX)" - sky blue button, clickable

**Visual indicators**:
- Color coding: Sky blue (generating/generate), Green (playable), Gray (loading)
- Percentage display: `Math.round(progress)%` on line 54
- Button disabled state during generation (line 53)

### 6. Why generating more TTS removes progress state on currently generating TTS

**Root cause**: Single state variable pattern in `ReaderView.tsx`.

**Mechanism**:
1. Chapter A starts generating → `setGeneratingChapterId(A.id)` on line 401
2. Chapter A's button shows "Generating... 30%"
3. User triggers Chapter B → `setGeneratingChapterId(B.id)` on line 401 **[OVERWRITES A.id]**
4. Chapter A's button checks `generatingChapterId === chapter.id` on line 66 in ChapterList.tsx
5. Condition evaluates to `false` for Chapter A (generatingChapterId is now B.id)
6. Chapter A's button stops showing generating state
7. Chapter B's button starts showing generating state

**State loss**: Chapter A's generation continues in the background, but its UI state is lost because the shared state variable now tracks Chapter B.

## Conclusion

The TTS generation progress tracking system uses a simple, single-instance state management pattern that does not support concurrent generation tracking. Progress appears stuck at 30% due to the blocking nature of the OpenAI API fetch call, which provides no intermediate progress updates during the 10-60+ second processing time. Multiple TTS generations interfere with each other because the `generatingChapterId` state variable can only track one chapter at a time, and triggering a new generation overwrites the previous chapter's tracked state. The architecture is suitable for sequential generation workflows but requires refactoring to support concurrent generation tracking or real-time progress updates.
