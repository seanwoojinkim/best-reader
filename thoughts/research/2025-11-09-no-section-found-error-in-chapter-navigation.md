---
doc_type: research
date: 2025-11-10T02:09:58+00:00
title: "No Section Found Error in Chapter Navigation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T02:09:58+00:00"
research_question: "Why does the location change event fire TWICE with the same CFI when navigating to chapters, and what causes the 'No Section Found' error?"
research_type: codebase_research
researcher: Sean Kim

git_commit: fa7529195772b91729d6017d7089baea45f312ee
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Sean Kim

tags:
  - epub-reader
  - navigation
  - audio-sync
  - bug-analysis
status: complete

related_docs: []
---

# Research: No Section Found Error in Chapter Navigation

**Date**: 2025-11-10T02:09:58+00:00
**Researcher**: Sean Kim
**Git Commit**: fa752919
**Branch**: main
**Repository**: reader

## Research Question
Why does the location change event fire TWICE with the same CFI when navigating to chapters, and what causes the "No Section Found" error?

## Summary
The "No Section Found" error occurs due to a **double navigation issue** caused by the audio-reading synchronization feature (TTS Phase 4). When a chapter is clicked in the chapter list, the navigation fires twice:

1. **First navigation**: Direct call to `goToLocation(chapter.cfiStart)` from the chapter click handler
2. **Second navigation**: Triggered by the `syncReadingToAudio` useEffect that responds to the location change from the first navigation

The second navigation attempts to call `goToLocation()` with a malformed CFI string that includes the `.xhtml` filename directly instead of a proper CFI format, which causes epub.js to throw the "No Section Found" error.

## Detailed Findings

### Root Cause: useEffect Double Trigger

The double navigation is caused by a useEffect hook in [`ReaderView.tsx:189-193`](components/reader/ReaderView.tsx#L189-L193):

```typescript
// Sync when user navigates pages while audio is playing
useEffect(() => {
  if (audioPlayer.playing && currentLocation) {
    syncReadingToAudio();
  }
}, [currentLocation, syncReadingToAudio, audioPlayer.playing]);
```

**Problem**: This useEffect has a logical flaw. The condition checks `audioPlayer.playing`, but the condition should be:
- The effect fires whenever `currentLocation` changes
- It calls `syncReadingToAudio()` even when audio is NOT playing initially
- The condition `audioPlayer.playing` is checked INSIDE the effect, but by that time the effect has already been scheduled

### Call Chain for Chapter Navigation

When clicking a chapter in the chapter list, here's the exact call chain:

#### 1. Initial Chapter Click - First Navigation
- [`ReaderView.tsx:393-408`](components/reader/ReaderView.tsx#L393-L408) - `onChapterSelect` handler fires
- [`ReaderView.tsx:400-403`](components/reader/ReaderView.tsx#L400-L403) - Calls `goToLocation(chapter.cfiStart)`
  - Example: `chapter.cfiStart = "ch01.xhtml"`
- [`useEpubReader.ts:192-204`](hooks/useEpubReader.ts#L192-L204) - `goToLocation()` function executes
- [`useEpubReader.ts:197`](hooks/useEpubReader.ts#L197) - Calls `rendition.display(cfi)` with `"ch01.xhtml"`
- epub.js successfully navigates and fires `relocated` event
- [`useEpubReader.ts:151-176`](hooks/useEpubReader.ts#L151-L176) - `handleRelocated` handler fires
- [`useEpubReader.ts:153`](hooks/useEpubReader.ts#L153) - Sets `currentLocation` to the new CFI
- [`ReaderView.tsx:60-76`](components/reader/ReaderView.tsx#L60-L76) - `onLocationChange` callback fires
- [`ReaderView.tsx:63-71`](components/reader/ReaderView.tsx#L63-L71) - Saves position to database

**First location change logged**: ✅ Success

#### 2. Sync Effect Triggers - Second Navigation
- [`ReaderView.tsx:189-193`](components/reader/ReaderView.tsx#L189-L193) - `useEffect` detects `currentLocation` changed
- Effect dependencies: `[currentLocation, syncReadingToAudio, audioPlayer.playing]`
- Effect condition: `if (audioPlayer.playing && currentLocation)`
- **BUG**: Even though `audioPlayer.playing` is `false`, the effect still fires because React has already scheduled it when `currentLocation` changed
- [`ReaderView.tsx:192`](components/reader/ReaderView.tsx#L192) - Calls `syncReadingToAudio()`
- [`ReaderView.tsx:164-186`](components/reader/ReaderView.tsx#L164-L186) - `syncReadingToAudio` function executes
- [`ReaderView.tsx:168`](components/reader/ReaderView.tsx#L168) - Calls `findChapterByCFI(book, chapters, currentLocation)`
- [`audio-sync.ts:126-137`](lib/audio-sync.ts#L126-L137) - `findChapterByCFI` searches for matching chapter
- [`audio-sync.ts:132`](lib/audio-sync.ts#L132) - Calls `isCFIInChapter(book, chapter, cfi)` for each chapter
- [`audio-sync.ts:105-121`](lib/audio-sync.ts#L105-L121) - `isCFIInChapter` compares CFIs
- Returns a chapter match (even though no audio is playing)
- [`ReaderView.tsx:176-180`](components/reader/ReaderView.tsx#L176-L180) - Different chapter detected, checks for audio
- [`ReaderView.tsx:178`](components/reader/ReaderView.tsx#L178) - Calls `getAudioFile(currentChapter.id)`
- No audio file exists, so condition fails
- **Expected**: Should pause playback at line 183
- **Actual**: The condition at line 178-180 might not execute, or there's a race condition

**Second location change logged**: ❌ "No Section Found" error

### Why "No Section Found" Error Occurs

The error occurs because `chapter.cfiStart` in the Chapter objects contains simplified spine identifiers like `"ch01.xhtml"`, not full CFI strings.

Looking at the chapter structure used in the codebase:
- [`ReaderView.tsx:395-399`](components/reader/ReaderView.tsx#L395-L399) - Logs show `cfiStart: 'ch01.xhtml'`
- This is a **spine href**, not a CFI

When epub.js receives `"ch01.xhtml"`:
- First call: epub.js is lenient and successfully resolves it to the proper section
- Second call: epub.js may have internal state issues or the spine item is not found in the current context
- Result: `Error: No Section Found at tU._display`

### Audio Playback Flow - Different Path

When playing audio (not just navigating), there's an additional navigation call:

- [`ReaderView.tsx:439-456`](components/reader/ReaderView.tsx#L439-L456) - `onPlayAudio` handler
- [`ReaderView.tsx:447`](components/reader/ReaderView.tsx#L447) - Sets `currentAudioChapter`
- [`ReaderView.tsx:450-453`](components/reader/ReaderView.tsx#L450-L453) - Also calls `goToLocation(chapter.cfiStart)`

This creates a **triple navigation scenario** when playing audio:
1. Direct call from `onPlayAudio`
2. `syncReadingToAudio` fires from location change
3. `timestampToCFI` sync may fire from audio time updates

### Audio Time Update Sync

There's also a potential source of additional navigation calls:

- [`ReaderView.tsx:135-152`](components/reader/ReaderView.tsx#L135-L152) - `useAudioPlayer` with `onTimeUpdate` callback
- [`ReaderView.tsx:140`](components/reader/ReaderView.tsx#L140) - Condition: `if (syncEnabled && currentAudioChapter && book && now - lastSyncTimeRef.current > 5000)`
- [`ReaderView.tsx:141`](components/reader/ReaderView.tsx#L141) - Calls `timestampToCFI(book, currentAudioChapter, currentTime, duration)`
- [`audio-sync.ts:18-55`](lib/audio-sync.ts#L18-L55) - Generates a CFI with percentage marker
- [`ReaderView.tsx:142-145`](components/reader/ReaderView.tsx#L142-L145) - If CFI is generated, calls `goToLocation(cfi)`

**Rate limiting**: This sync only fires every 5 seconds due to `lastSyncTimeRef` check, so it's not the immediate cause of the double navigation.

## Code References

### Navigation Entry Points
- `components/reader/ReaderView.tsx:400-403` - Chapter click navigation
- `components/reader/ReaderView.tsx:450-453` - Audio play navigation
- `components/reader/ReaderView.tsx:113-114` - Initial CFI navigation
- `components/reader/ReaderView.tsx:142-145` - Audio timestamp sync navigation

### The Problematic useEffect
- `components/reader/ReaderView.tsx:189-193` - useEffect that triggers `syncReadingToAudio`
- `components/reader/ReaderView.tsx:164-186` - `syncReadingToAudio` callback implementation

### Core Navigation Functions
- `hooks/useEpubReader.ts:192-204` - `goToLocation` implementation
- `hooks/useEpubReader.ts:197` - `rendition.display(cfi)` call
- `hooks/useEpubReader.ts:151-176` - `handleRelocated` event handler
- `hooks/useEpubReader.ts:207-211` - Initial display call

### Audio Sync Functions
- `lib/audio-sync.ts:126-137` - `findChapterByCFI` function
- `lib/audio-sync.ts:105-121` - `isCFIInChapter` function
- `lib/audio-sync.ts:18-55` - `timestampToCFI` function
- `lib/audio-sync.ts:64-100` - `cfiToTimestamp` function

## Architecture Documentation

### Current Navigation Pattern

The reader uses a **callback-based navigation system**:

1. **Single source of truth**: `useEpubReader.ts` manages the rendition and location state
2. **Navigation function**: `goToLocation(cfi)` is exposed and memoized with `useCallback`
3. **Event-driven updates**: epub.js `relocated` event updates React state
4. **Callback propagation**: `onLocationChange` prop allows parent components to react

### Audio Synchronization Design (TTS Phase 4)

The audio-reading sync feature has **two directions**:

1. **Audio → Reading**: [`ReaderView.tsx:137-146`](components/reader/ReaderView.tsx#L137-L146)
   - `onTimeUpdate` callback from audio player
   - Calls `timestampToCFI` to convert audio position to CFI
   - Calls `goToLocation(cfi)` to move reading position
   - Rate limited to every 5 seconds

2. **Reading → Audio**: [`ReaderView.tsx:189-193`](components/reader/ReaderView.tsx#L189-L193)
   - useEffect watches `currentLocation` changes
   - Calls `syncReadingToAudio()` when location changes
   - Checks if new location is in current audio chapter
   - Seeks audio to matching timestamp OR switches chapters OR pauses

### Dependency Chain

The sync feature creates a **circular dependency**:
```
currentLocation change → useEffect fires → syncReadingToAudio()
  → finds chapter → goToLocation() → currentLocation changes → ...
```

The circular dependency is intended to be broken by:
- Checking `audioPlayer.playing` condition
- Checking `syncEnabled` flag
- Rate limiting with `lastSyncTimeRef`

However, the useEffect condition check is **not effective** because React schedules the effect based on dependency changes, not the condition inside the effect body.

## Current Implementation State

### What Works
- Single navigation calls (direct `goToLocation` calls) work successfully
- Audio playback and audio player UI functions correctly
- Saving reading position to database works
- Chapter list displays and generates audio correctly

### What Doesn't Work
- Chapter click navigation triggers double navigation
- Second navigation fails with "No Section Found" error
- useEffect-based sync fires even when audio is not playing
- Error prevents successful chapter navigation

### Why Double Navigation Happens
The double navigation occurs because:
1. The click handler explicitly calls `goToLocation()`
2. The location change triggers the sync useEffect
3. The sync useEffect runs its logic even though audio isn't playing
4. The effect's condition is evaluated too late to prevent execution

### Why Error Occurs
The "No Section Found" error occurs because:
1. `chapter.cfiStart` contains spine hrefs like `"ch01.xhtml"`, not full CFIs
2. First navigation succeeds (epub.js resolves the href)
3. Second navigation fails (epub.js internal state or context issue)
4. epub.js throws error from `_display` method

## Open Questions

1. **Why does the first navigation succeed?** If `"ch01.xhtml"` is not a valid CFI, why does epub.js accept it on the first call but not the second?

2. **What is the correct CFI format?** Should `chapter.cfiStart` contain proper CFI strings like `epubcfi(/6/4!/4)` instead of spine hrefs?

3. **Where are chapters extracted?** The research shows chapters are used in `ReaderView.tsx` but doesn't document where the `Chapter` objects with `cfiStart` are created.

4. **Is the sync logic even needed for non-audio navigation?** Should the sync useEffect simply not run at all when no audio is playing?

5. **Why does `isCFIInChapter` return true?** If the CFI formats are incompatible, how does the sync logic match the chapter?
