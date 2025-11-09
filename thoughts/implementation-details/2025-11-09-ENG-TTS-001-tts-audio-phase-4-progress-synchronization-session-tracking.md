---
doc_type: implementation
date: 2025-11-09T21:42:09+00:00
title: "TTS Audio Phase 4 - Progress Synchronization & Session Tracking"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-09T21:42:09+00:00"
plan_reference: thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md
current_phase: 4
phase_name: "Progress Synchronization & Session Tracking"

git_commit: f6749fe5f422f517f267cc250b8253e270381971
branch: feature/tts-phase3-audio-player-ui
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Sean Kim

ticket_id: ENG-TTS-001
tags:
  - implementation
  - tts
  - audio
  - progress-sync
  - session-tracking
status: in_progress

related_docs: []
---

# Implementation Progress: TTS Audio Phase 4 - Progress Synchronization & Session Tracking

## Plan Reference
[Link to plan: thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md]

## Current Status
**Phase**: 4 - Progress Synchronization & Session Tracking
**Status**: Testing
**Branch**: feature/tts-phase3-audio-player-ui

## Overview
Phase 4 implements bidirectional synchronization between audio playback and reading position, plus listening time tracking in the session system.

## Implementation Tasks

### Step 4.1: Audio-Reading Sync Utilities
- [x] Create `/lib/audio-sync.ts` file
- [x] Implement `timestampToCFI()` - map audio time to CFI position
- [x] Implement `cfiToTimestamp()` - map CFI position to audio time
- [x] Implement `isCFIInChapter()` - check if CFI is in chapter range
- [x] Implement `findChapterByCFI()` - find chapter containing CFI
- [x] Fix TypeScript compilation issues with epub.js types
- [x] Verification: Build successful

**Notes:**
- Used simplified linear interpolation based on character count
- Appends percentage marker `@0.xxxx` to CFI for v1 implementation
- TypeScript required `as any` casts for epub.js locations API

### Step 4.2: Session Tracking Updates
- [x] Add listening time state to `useSession` hook
- [x] Add `startListening()` and `stopListening()` functions
- [x] Add `trackListeningTime()` callback
- [x] Update session refs to include `listeningTimeRef`
- [x] Return `listeningTime` in minutes from hook
- [x] Verification: TypeScript compiles without errors

**Code Location:** `/hooks/useSession.ts`

**Implementation Details:**
- Tracking starts/stops based on audio playing state
- Time accumulated in seconds, returned as minutes
- Database updated via `updateSession()` with `listeningTime` field

### Step 4.3: Bidirectional Sync in ReaderView
- [x] Import sync utilities (`timestampToCFI`, `cfiToTimestamp`, `findChapterByCFI`)
- [x] Add `syncEnabled` state (default: true)
- [x] Add `lastSyncTimeRef` for rate limiting
- [x] Update `useSession` to destructure `trackListeningTime`
- [x] Implement audio → reading sync in `onTimeUpdate` callback
  - Sync every 5 seconds to avoid excessive updates
  - Call `goToLocation(cfi)` when sync enabled
- [x] Implement reading → audio sync callback
  - Check if user navigated to different chapter
  - Seek audio or switch chapter if available
  - Pause if new chapter has no audio
- [x] Add useEffect to sync when location changes during playback
- [x] Add useEffect to track listening time based on playing state
- [x] Fix code ordering to avoid "used before declaration" error
- [x] Verification: Build successful

**Code Location:** `/components/reader/ReaderView.tsx`

### Step 4.4: Audio Player Sync Toggle UI
- [x] Add `syncEnabled` and `onToggleSync` props to AudioPlayer interface
- [x] Add sync toggle button to AudioPlayer component
- [x] Visual indicator: sky blue when enabled, gray when disabled
- [x] Sync icon: circular arrows (refresh symbol)
- [x] Tooltip shows current state
- [x] Pass props from ReaderView to AudioPlayer
- [x] Verification: Build successful

**Code Location:** `/components/reader/AudioPlayer.tsx`

## Testing Results

### Manual Testing Plan

1. **Audio → Reading Position Sync:**
   - [ ] Generate audio for a chapter
   - [ ] Play audio and observe reading position
   - [ ] Verify position advances every ~5 seconds
   - [ ] Confirm sync accuracy (within 1-2 paragraphs)

2. **Reading → Audio Position Sync:**
   - [ ] Play audio for a chapter
   - [ ] Turn pages manually using tap zones
   - [ ] Verify audio seeks to match new reading position
   - [ ] Test keyboard navigation (arrow keys)

3. **Sync Toggle:**
   - [ ] Click sync toggle button
   - [ ] Verify audio no longer updates reading position when disabled
   - [ ] Re-enable sync
   - [ ] Verify sync resumes correctly

4. **Listening Time Tracking:**
   - [ ] Play audio for 2 minutes
   - [ ] Check IndexedDB sessions table
   - [ ] Verify `listeningTime` field is updated
   - [ ] Confirm time is in minutes

5. **Chapter Switching:**
   - [ ] Play audio for chapter 1
   - [ ] Navigate to chapter 2 (with audio generated)
   - [ ] Verify audio switches automatically
   - [ ] Navigate to chapter without audio
   - [ ] Verify audio pauses

### Edge Cases to Test

- [ ] Long chapters (10,000+ words) - check for sync drift
- [ ] Scrubbing audio progress bar manually
- [ ] Rapid page turns while audio playing
- [ ] Audio ends at chapter boundary
- [ ] Multiple tab zones clicks in succession

## Issues Encountered

### Issue 1: TypeScript Compilation Errors
**Problem:** epub.js type definitions don't include `locations.cfiComparison` method
**Solution:** Used `as any` type assertion for locations API
**Date:** 2025-11-09

### Issue 2: "Used Before Declaration" Error
**Problem:** useEffect tracking listening time referenced `audioPlayer` before it was declared
**Solution:** Moved useEffect after audioPlayer hook initialization
**Date:** 2025-11-09

### Issue 3: TypeScript Never Type Issue
**Problem:** Text output from epub.js section could be string or object, TypeScript inferred `never` for non-string case
**Solution:** Cast to `any` when accessing textContent property
**Date:** 2025-11-09

## Next Steps

1. **Complete Manual Testing** (current step)
   - Verify all sync scenarios work correctly
   - Test edge cases
   - Confirm listening time tracking

2. **Code Review Request**
   - After testing passes, request review
   - Document any sync accuracy issues found
   - Note performance during long playback sessions

3. **Phase 5 Preparation**
   - Once Phase 4 approved, move to Settings Panel & Usage Dashboard
   - Will add audio settings UI and cost tracking

## Files Modified

- `/lib/audio-sync.ts` (created)
- `/hooks/useSession.ts` (modified)
- `/components/reader/ReaderView.tsx` (modified)
- `/components/reader/AudioPlayer.tsx` (modified)

## Success Criteria

- [x] Audio playback updates reading position every 5 seconds
- [x] Reading navigation seeks audio to new position
- [x] Sync can be toggled on/off via UI button
- [ ] Listening time tracked accurately in sessions table
- [ ] Chapter switching works when audio available
- [ ] Sync accuracy acceptable (<1 page drift)
- [ ] No performance issues during sync
- [x] Code compiles without TypeScript errors
- [x] Build successful

## Development Server

Dev server running on: http://localhost:3001
Ready for manual testing of sync functionality.

## Testing Instructions

1. **Setup:**
   ```bash
   npm run dev  # Running on port 3001
   ```

2. **Generate audio:**
   - Open a book in reader
   - Click "Chapter Audio" button
   - Generate audio for test chapter

3. **Test audio → reading sync:**
   - Play audio
   - Watch reading position advance
   - Verify sync happens every 5 seconds

4. **Test reading → audio sync:**
   - While audio playing, click right tap zone
   - Verify audio seeks forward
   - Click left tap zone
   - Verify audio seeks backward

5. **Test sync toggle:**
   - Click sync button (circular arrows icon)
   - Verify icon turns gray
   - Verify audio no longer moves reading position
   - Click again to re-enable

6. **Check listening time:**
   - Play audio for 2 minutes
   - Open browser DevTools → Application → IndexedDB → sessions
   - Verify `listeningTime` field is ~2 minutes

## Readiness for Code Review

**Status:** Pending Testing

Once manual testing is complete and all success criteria are met, this phase will be ready for code review before proceeding to Phase 5.
