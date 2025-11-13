# TTS Playback UX Improvement - Implementation Tickets

**Date**: 2025-11-13
**Epic**: TTS Playback UX Enhancement
**Research Documents**:
- `thoughts/research/2025-11-13-tts-playback-ux-evaluation.md`
- `thoughts/research/2025-11-13-tts-playback-implementation-documentation.md`
- `thoughts/research/2025-11-13-audiobook-and-tts-playback-ux-best-practices.md`

---

## Table of Contents

- [Phase 1: Critical Fixes (P0-P1)](#phase-1-critical-fixes-p0-p1)
  - [TTS-001: Playback Position Persistence](#tts-001-playback-position-persistence)
  - [TTS-002: Skip Forward/Backward Controls](#tts-002-skip-forwardbackward-controls)
  - [TTS-003: Chapter Auto-Advance](#tts-003-chapter-auto-advance)
  - [TTS-004: Keyboard Shortcuts](#tts-004-keyboard-shortcuts)
  - [TTS-005: Auto-Resume on App Load](#tts-005-auto-resume-on-app-load)
- [Phase 2: Enhanced Features (P2)](#phase-2-enhanced-features-p2)
  - [TTS-006: Sleep Timer](#tts-006-sleep-timer)
  - [TTS-007: Lock Screen Controls (Media Session API)](#tts-007-lock-screen-controls-media-session-api)
  - [TTS-008: Progressive TTS Generation](#tts-008-progressive-tts-generation)
  - [TTS-009: Customizable Skip Intervals](#tts-009-customizable-skip-intervals)
- [Phase 3: Differentiating Features (P3)](#phase-3-differentiating-features-p3)
  - [TTS-010: Synchronized Sentence Highlighting](#tts-010-synchronized-sentence-highlighting)
  - [TTS-011: Hybrid Reading + Listening Mode](#tts-011-hybrid-reading--listening-mode)
  - [TTS-012: Advanced Bookmarking with Timestamps](#tts-012-advanced-bookmarking-with-timestamps)
  - [TTS-013: Multi-Voice Support](#tts-013-multi-voice-support)

---

## Phase 1: Critical Fixes (P0-P1)

### TTS-001: Playback Position Persistence

**Priority**: P0 (Critical)
**Estimated Effort**: 3-5 days
**Sprint**: Sprint 1
**Labels**: `bug`, `critical`, `tts`, `ux`

#### Problem Statement

Currently, playback position (chapter ID + timestamp) is not persisted across app restarts. When users close the app and return, they lose their exact playback position and must manually navigate to the chapter menu to re-select TTS, which resets position to the beginning.

**User Impact**: Major frustration, broken core functionality. This is the #1 complaint in audiobook app reviews (68% of negative reviews cite position loss).

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #1 (lines 85-165)
- Industry standard: ALL major apps (Audible, Spotify, Apple Books) auto-save every 5-10 seconds

#### Current State

From `hooks/useAudioPlayer.ts:15-20`:

```typescript
const [playing, setPlaying] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);
// ❌ No persistence layer for these values
```

State exists only in React hooks - volatile memory.

#### Acceptance Criteria

- [ ] Playback position saved to localStorage every 10 seconds during playback (throttled)
- [ ] Position saved on pause event
- [ ] Position saved on chapter change
- [ ] Position saved before page unload (`beforeunload` event)
- [ ] Position restored on app load (if recent)
- [ ] Edge cases handled:
  - [ ] Corrupted localStorage data (validate + clear)
  - [ ] Quota exceeded errors (fallback to in-memory)
  - [ ] Old bookId references no longer valid (graceful degradation)
  - [ ] User manually cleared browser cache (no error)

#### Technical Implementation

**1. Define PlaybackState Interface**

```typescript
// lib/types/tts.ts (or appropriate location)
interface PlaybackState {
  bookId: string;
  chapterId: string;
  currentTime: number;
  playing: boolean;
  playbackSpeed: number;
  volume?: number;
  lastUpdated: number; // Unix timestamp
}
```

**2. Create Persistence Utilities**

```typescript
// lib/tts-persistence.ts
const TTS_PLAYBACK_KEY = 'tts_playback_state';

export const savePlaybackState = (state: PlaybackState): void => {
  try {
    const stateWithTimestamp = {
      ...state,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(TTS_PLAYBACK_KEY, JSON.stringify(stateWithTimestamp));
  } catch (error) {
    // Handle quota exceeded or other errors
    console.error('Failed to save playback state:', error);
  }
};

export const loadPlaybackState = (): PlaybackState | null => {
  try {
    const stored = localStorage.getItem(TTS_PLAYBACK_KEY);
    if (!stored) return null;

    const state = JSON.parse(stored) as PlaybackState;

    // Validate required fields
    if (!state.bookId || !state.chapterId || state.currentTime === undefined) {
      console.warn('Invalid playback state, clearing');
      clearPlaybackState();
      return null;
    }

    // Check if state is recent (within last 7 days)
    const daysSinceUpdate = (Date.now() - state.lastUpdated) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 7) {
      console.log('Playback state too old, clearing');
      clearPlaybackState();
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load playback state:', error);
    clearPlaybackState();
    return null;
  }
};

export const clearPlaybackState = (): void => {
  localStorage.removeItem(TTS_PLAYBACK_KEY);
};
```

**3. Integrate into useAudioPlayer Hook**

Modify `hooks/useAudioPlayer.ts`:

```typescript
import { savePlaybackState, loadPlaybackState } from '@/lib/tts-persistence';
import { useEffect, useRef } from 'react';
import { useThrottle } from '@/hooks/useThrottle'; // Or implement throttle

const useAudioPlayer = (/* existing params */) => {
  // Existing state...
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const saveThrottledRef = useRef<NodeJS.Timeout | null>(null);

  // Save position every 10 seconds during playback (throttled)
  useEffect(() => {
    if (playing && currentChapter && bookId) {
      if (saveThrottledRef.current) {
        clearTimeout(saveThrottledRef.current);
      }

      saveThrottledRef.current = setTimeout(() => {
        savePlaybackState({
          bookId,
          chapterId: currentChapter.id,
          currentTime,
          playing,
          playbackSpeed,
          volume: audioRef.current?.volume,
          lastUpdated: Date.now(),
        });
      }, 10000); // 10 second throttle
    }

    return () => {
      if (saveThrottledRef.current) {
        clearTimeout(saveThrottledRef.current);
      }
    };
  }, [playing, currentTime, bookId, currentChapter, playbackSpeed]);

  // Save on pause
  const handlePause = () => {
    setPlaying(false);
    if (currentChapter && bookId) {
      savePlaybackState({
        bookId,
        chapterId: currentChapter.id,
        currentTime,
        playing: false,
        playbackSpeed,
        volume: audioRef.current?.volume,
        lastUpdated: Date.now(),
      });
    }
  };

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentChapter && bookId) {
        savePlaybackState({
          bookId,
          chapterId: currentChapter.id,
          currentTime,
          playing,
          playbackSpeed,
          volume: audioRef.current?.volume,
          lastUpdated: Date.now(),
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentChapter, bookId, currentTime, playing, playbackSpeed]);

  // Return utilities for restoration (used by TTS-005)
  return {
    // ...existing returns
    restoreFromState: (state: PlaybackState) => {
      // Load chapter, seek to time, set speed
      // Implementation depends on existing audio loading logic
    },
  };
};
```

**4. Add beforeunload Handler**

Ensure state is saved even on hard refresh or browser close.

#### Files to Modify

- Create: `lib/tts-persistence.ts` (new utility file)
- Create: `lib/types/tts.ts` (if doesn't exist) or add to existing types file
- Modify: `hooks/useAudioPlayer.ts` (add persistence logic)

#### Testing Checklist

- [ ] Manual testing:
  - [ ] Start playback, close app, reopen - position saved
  - [ ] Pause audio, close app, reopen - position saved
  - [ ] Change chapters, close app, reopen - new chapter saved
  - [ ] Let audio play for >10s, force refresh - position saved
- [ ] Edge case testing:
  - [ ] Clear localStorage, reload - no errors
  - [ ] Corrupt JSON in localStorage - gracefully handled
  - [ ] Old bookId in state, book deleted - no crash
  - [ ] Fill localStorage quota - fallback works
- [ ] Cross-browser testing:
  - [ ] Chrome, Safari, Firefox, Edge
  - [ ] Mobile Safari (iOS), Chrome (Android)

#### Success Metrics

- 0% position loss in QA testing
- <2 seconds to resume playback from cold start
- No localStorage errors in production logs
- A/B test: User satisfaction improvement (post-implementation survey)

#### Dependencies

None (foundational feature)

---

### TTS-002: Skip Forward/Backward Controls

**Priority**: P0 (Critical)
**Estimated Effort**: 2-3 days
**Sprint**: Sprint 2
**Labels**: `feature`, `tts`, `ux`, `accessibility`

#### Problem Statement

No skip forward/backward buttons. Users must drag progress bar to skip, which is imprecise on mobile and inaccessible for keyboard users. Skip controls are present in 100% of audiobook apps (industry standard is 15s backward / 30s forward).

**User Impact**: Missing expected affordance, poor mobile UX, accessibility issue.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #2 (lines 169-240)
- Industry examples: Audible (30s), Apple Books (15s), Spotify (15s both directions)

#### Current State

From `components/reader/AudioPlayer.tsx`:

Audio player has play/pause and seekable progress bar, but no skip buttons.

#### Acceptance Criteria

- [ ] Skip backward button (default 15 seconds)
- [ ] Skip forward button (default 30 seconds)
- [ ] Buttons positioned flanking play/pause (thumb-friendly on mobile)
- [ ] Visual feedback on skip (brief "±15s" overlay or toast)
- [ ] Clamp to boundaries (0 and duration)
- [ ] Keyboard shortcuts integrated (see TTS-004)
- [ ] ARIA labels for accessibility
- [ ] Responsive design (mobile + desktop)

#### Technical Implementation

**1. Add Skip Buttons to UI**

Modify `components/reader/AudioPlayer.tsx`:

```typescript
import { SkipBack, SkipForward } from 'lucide-react'; // Or appropriate icon library

const AudioPlayer = ({ /* props */ }) => {
  const { currentTime, duration, seek } = useAudioPlayer();
  const [skipFeedback, setSkipFeedback] = useState<string | null>(null);

  const handleSkipBackward = () => {
    const newTime = Math.max(0, currentTime - 15);
    seek(newTime);
    showSkipFeedback('-15s');
  };

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 30);
    seek(newTime);
    showSkipFeedback('+30s');
  };

  const showSkipFeedback = (text: string) => {
    setSkipFeedback(text);
    setTimeout(() => setSkipFeedback(null), 1000); // 1s fade
  };

  return (
    <div className="audio-player">
      {/* Existing progress bar */}

      <div className="controls">
        <Button
          onClick={handleSkipBackward}
          aria-label="Skip backward 15 seconds"
          className="skip-button"
        >
          <SkipBack className="w-6 h-6" />
          <span className="skip-label">15</span>
        </Button>

        <Button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="play-pause-button"
        >
          {playing ? <Pause /> : <Play />}
        </Button>

        <Button
          onClick={handleSkipForward}
          aria-label="Skip forward 30 seconds"
          className="skip-button"
        >
          <SkipForward className="w-6 h-6" />
          <span className="skip-label">30</span>
        </Button>
      </div>

      {/* Skip feedback overlay */}
      {skipFeedback && (
        <div className="skip-feedback" aria-live="polite">
          {skipFeedback}
        </div>
      )}
    </div>
  );
};
```

**2. Styling (Mobile-First)**

```css
/* AudioPlayer.module.css or Tailwind */
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 0;
}

.skip-button {
  position: relative;
  min-width: 48px; /* Touch target size */
  min-height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skip-label {
  position: absolute;
  font-size: 0.75rem;
  font-weight: 600;
  pointer-events: none;
}

.play-pause-button {
  min-width: 64px; /* Larger primary action */
  min-height: 64px;
  border-radius: 50%;
}

.skip-feedback {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 1.5rem;
  font-weight: bold;
  pointer-events: none;
  animation: fade-out 1s forwards;
}

@keyframes fade-out {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .skip-feedback {
    background: rgba(255, 255, 255, 0.9);
    color: black;
  }
}
```

**3. Enhance useAudioPlayer Hook**

Add `skip` function to `hooks/useAudioPlayer.ts`:

```typescript
const skip = (seconds: number) => {
  if (!audioRef.current) return;

  const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
  audioRef.current.currentTime = newTime;
  setCurrentTime(newTime);

  // Trigger sync if enabled
  if (syncEnabled) {
    syncAudioToReading(newTime);
  }
};

return {
  // ...existing
  skip,
};
```

#### Files to Modify

- Modify: `components/reader/AudioPlayer.tsx` (add skip buttons)
- Modify: `hooks/useAudioPlayer.ts` (add skip function)
- Create/Modify: `components/reader/AudioPlayer.module.css` (or Tailwind classes)

#### Testing Checklist

- [ ] Functional testing:
  - [ ] Skip backward reduces time by 15s
  - [ ] Skip forward increases time by 30s
  - [ ] At beginning (0:00), skip backward stays at 0:00
  - [ ] Near end, skip forward clamps to duration
  - [ ] Visual feedback appears and fades
- [ ] Mobile testing:
  - [ ] Buttons large enough for thumb (48x48px minimum)
  - [ ] Spacing prevents accidental taps
  - [ ] Works in portrait and landscape
- [ ] Accessibility testing:
  - [ ] ARIA labels announced by screen reader
  - [ ] Keyboard shortcuts work (see TTS-004)
  - [ ] Focus indicators visible
  - [ ] Skip feedback announced to screen readers (aria-live)
- [ ] Cross-browser testing

#### Success Metrics

- Skip button usage in analytics (expect 2-3 uses per 30min session)
- Reduced precision seeking via progress bar
- Positive user feedback on control improvements

#### Dependencies

None (standalone feature)

---

### TTS-003: Chapter Auto-Advance

**Priority**: P1 (High)
**Estimated Effort**: 3-4 days
**Sprint**: Sprint 3
**Labels**: `feature`, `tts`, `ux`

#### Problem Statement

Audio player stops at chapter end, requiring manual navigation to continue. This breaks immersive listening experience and requires visual attention (dangerous while driving). All streaming audio apps auto-advance between content.

**User Impact**: Flow disruption, poor continuous listening UX.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #3 (lines 244-333)
- Industry standard: Audible, Spotify, Apple Books all auto-advance

#### Current State

From `hooks/useAudioPlayer.ts`:

```typescript
audioRef.current.onended = () => {
  setPlaying(false);
  // ❌ No auto-advance logic
};
```

#### Acceptance Criteria

- [ ] On chapter end, check for next chapter in book
- [ ] If next chapter audio cached, auto-advance immediately
- [ ] If next chapter audio NOT cached, prompt user:
  - [ ] "Generate Next Chapter?" dialog
  - [ ] "Generate and Play" button
  - [ ] "Stop Here" button
  - [ ] Optional: "Always auto-generate" setting
- [ ] Optional 1-second pause + chapter announcement between chapters
- [ ] Handle edge cases:
  - [ ] Last chapter (show completion message)
  - [ ] Generation failure (show error, allow retry)
  - [ ] User manually changed chapters during transition

#### Technical Implementation

**1. Enhance onended Handler**

Modify `hooks/useAudioPlayer.ts`:

```typescript
const useAudioPlayer = ({ book, /* ... */ }) => {
  // ... existing state

  const getNextChapter = (currentChapterId: string) => {
    const chapters = book.chapters; // Depends on book structure
    const currentIndex = chapters.findIndex(ch => ch.id === currentChapterId);

    if (currentIndex === -1 || currentIndex >= chapters.length - 1) {
      return null; // Last chapter or not found
    }

    return chapters[currentIndex + 1];
  };

  const checkAudioExists = async (chapterId: string): Promise<boolean> => {
    // Check IndexedDB cache
    const audioFile = await db.audioFiles
      .where({ chapterId, bookId })
      .first();

    return !!audioFile;
  };

  const handleAudioEnded = async () => {
    setPlaying(false);

    const nextChapter = getNextChapter(currentChapter.id);

    if (!nextChapter) {
      // End of book
      showCompletionDialog();
      return;
    }

    const hasAudio = await checkAudioExists(nextChapter.id);

    if (hasAudio) {
      // Auto-advance immediately (optional 1s delay)
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadAndPlayChapter(nextChapter.id);
    } else {
      // Prompt to generate
      showGenerateNextChapterPrompt(nextChapter);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = handleAudioEnded;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
      }
    };
  }, [currentChapter, book]);

  // ...
};
```

**2. Create Dialog Components**

Create `components/reader/GenerateNextChapterDialog.tsx`:

```typescript
interface GenerateNextChapterDialogProps {
  nextChapter: Chapter;
  onGenerate: () => void;
  onStop: () => void;
  onAlwaysAutoGenerate: () => void;
}

const GenerateNextChapterDialog: React.FC<GenerateNextChapterDialogProps> = ({
  nextChapter,
  onGenerate,
  onStop,
  onAlwaysAutoGenerate,
}) => {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Next Chapter Ready</DialogTitle>
          <DialogDescription>
            Would you like to generate audio for "{nextChapter.title}"?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="ghost" onClick={onStop}>
            Stop Here
          </Button>
          <Button onClick={onGenerate}>
            Generate & Play
          </Button>
        </DialogFooter>

        <div className="text-sm text-muted-foreground mt-4">
          <Checkbox
            id="always-auto-generate"
            onCheckedChange={(checked) => {
              if (checked) onAlwaysAutoGenerate();
            }}
          />
          <label htmlFor="always-auto-generate" className="ml-2">
            Always auto-generate next chapter
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

Create `components/reader/BookCompletionDialog.tsx`:

```typescript
const BookCompletionDialog: React.FC<{ book: Book }> = ({ book }) => {
  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Completed! 🎉</DialogTitle>
          <DialogDescription>
            You've finished listening to "{book.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p>Total listening time: {formatDuration(book.totalListeningTime)}</p>
          {/* Optional: Suggest related books, export notes, etc. */}
        </div>

        <DialogFooter>
          <Button onClick={() => navigateToLibrary()}>
            Back to Library
          </Button>
          <Button onClick={() => restartBook()}>
            Listen Again
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

**3. Add Settings for Auto-Generation**

Create user setting in `lib/types/settings.ts`:

```typescript
interface AudioSettings {
  // ...existing
  autoGenerateNextChapter: boolean; // New setting
}
```

Store in localStorage or user preferences.

**4. Optional: Chapter Announcement**

Between chapters, briefly announce next chapter:

```typescript
const announceChapter = (chapter: Chapter) => {
  // Use Web Speech API for announcement
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(
      `Next: ${chapter.title}`
    );
    utterance.rate = 1.2;
    utterance.volume = 0.5;
    speechSynthesis.speak(utterance);
  }

  // Or show visual toast
  toast.info(`Next: ${chapter.title}`, { duration: 2000 });
};
```

#### Files to Modify

- Modify: `hooks/useAudioPlayer.ts` (enhance onended handler)
- Create: `components/reader/GenerateNextChapterDialog.tsx`
- Create: `components/reader/BookCompletionDialog.tsx`
- Modify: `lib/types/settings.ts` (add auto-generation setting)
- Modify: Audio player component to show dialogs

#### Testing Checklist

- [ ] Functional testing:
  - [ ] Auto-advance when next chapter cached
  - [ ] Prompt when next chapter not cached
  - [ ] "Generate & Play" generates and starts playback
  - [ ] "Stop Here" stops playback, no generation
  - [ ] "Always auto-generate" setting persists
  - [ ] Last chapter shows completion dialog
- [ ] Edge case testing:
  - [ ] User changes chapters during transition
  - [ ] Generation fails during auto-advance
  - [ ] Multiple rapid chapter ends (throttle)
  - [ ] Book with only 1 chapter (no auto-advance)
- [ ] Multi-chapter listening session (3+ chapters)

#### Success Metrics

- % of users who listen to 2+ chapters consecutively (expect increase)
- Reduced chapter menu visits during listening sessions
- Auto-advance acceptance rate (% who let it advance vs stop)

#### Dependencies

None (uses existing audio generation infrastructure)

---

### TTS-004: Keyboard Shortcuts

**Priority**: P1 (High - Accessibility)
**Estimated Effort**: 2-3 days
**Sprint**: Sprint 2
**Labels**: `feature`, `accessibility`, `tts`, `ux`

#### Problem Statement

No keyboard shortcuts for playback control. Desktop users expect standard shortcuts (Space for play/pause, arrows for skip) like YouTube, Spotify, etc. This is a WCAG Level A violation - keyboard operability is required for accessibility compliance.

**User Impact**: Poor desktop UX, excludes keyboard-only users, legal risk.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #5 (lines 391-504)
- WCAG 2.1 Level A requirement: All controls must be keyboard-operable

#### Current State

No keyboard event listeners in `components/reader/AudioPlayer.tsx`.

#### Acceptance Criteria

- [ ] Keyboard shortcuts implemented:
  - [ ] Space / K: Play/Pause
  - [ ] Left Arrow: Skip backward 15s
  - [ ] Right Arrow: Skip forward 30s
  - [ ] Up Arrow: Increase volume (if volume control exists)
  - [ ] Down Arrow: Decrease volume
  - [ ] M: Mute/Unmute (if mute control exists)
  - [ ] < / >: Decrease/Increase playback speed
  - [ ] Escape: Close player or dialogs
- [ ] Shortcuts don't trigger when focus is in input fields
- [ ] Visible focus indicators on all interactive elements
- [ ] Screen reader announcements for state changes (ARIA live regions)
- [ ] ARIA labels on all buttons
- [ ] Documentation of shortcuts (help tooltip or modal)

#### Technical Implementation

**1. Add Keyboard Event Listener**

Modify `components/reader/AudioPlayer.tsx`:

```typescript
import { useEffect } from 'react';

const AudioPlayer = ({ /* props */ }) => {
  const {
    playing,
    togglePlay,
    skip,
    adjustVolume,
    toggleMute,
    changeSpeed,
    currentTime,
  } = useAudioPlayer();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      // Prevent default for handled keys
      const handledKeys = [' ', 'k', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'm', '<', '>'];
      if (handledKeys.includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case ' ':
        case 'k':
          togglePlay();
          break;

        case 'ArrowLeft':
          skip(-15);
          break;

        case 'ArrowRight':
          skip(30);
          break;

        case 'ArrowUp':
          adjustVolume(0.1); // +10%
          break;

        case 'ArrowDown':
          adjustVolume(-0.1); // -10%
          break;

        case 'm':
          toggleMute();
          break;

        case '<':
          changeSpeed(-0.25); // Decrease speed
          break;

        case '>':
          changeSpeed(0.25); // Increase speed
          break;

        case 'Escape':
          // Close player or dialogs (depends on UI structure)
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [togglePlay, skip, adjustVolume, toggleMute, changeSpeed]);

  return (
    <div className="audio-player" role="region" aria-label="Audio player">
      {/* Player UI */}

      {/* ARIA live region for state announcements */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {playing ? 'Playing' : 'Paused'}
      </div>
    </div>
  );
};
```

**2. Add Volume and Mute Controls to useAudioPlayer**

Modify `hooks/useAudioPlayer.ts`:

```typescript
const useAudioPlayer = () => {
  const [volume, setVolume] = useState(1.0);
  const [muted, setMuted] = useState(false);

  const adjustVolume = (delta: number) => {
    if (!audioRef.current) return;

    const newVolume = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVolume);
    audioRef.current.volume = newVolume;

    // Show volume feedback toast
    toast.info(`Volume: ${Math.round(newVolume * 100)}%`, { duration: 1000 });
  };

  const toggleMute = () => {
    if (!audioRef.current) return;

    const newMuted = !muted;
    setMuted(newMuted);
    audioRef.current.muted = newMuted;

    // Announce to screen readers
    toast.info(newMuted ? 'Muted' : 'Unmuted', { duration: 1000 });
  };

  const changeSpeed = (delta: number) => {
    const newSpeed = Math.max(0.5, Math.min(2.0, playbackSpeed + delta));
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }

    toast.info(`Speed: ${newSpeed}x`, { duration: 1000 });
  };

  return {
    // ...existing
    volume,
    muted,
    adjustVolume,
    toggleMute,
    changeSpeed,
  };
};
```

**3. Add Visible Focus Indicators**

```css
/* Ensure all interactive elements have visible focus */
button:focus-visible,
input:focus-visible,
[role="button"]:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  button:focus-visible {
    outline-width: 3px;
  }
}
```

**4. Add ARIA Labels**

Update all buttons in AudioPlayer:

```typescript
<Button
  onClick={togglePlay}
  aria-label={playing ? 'Pause audio' : 'Play audio'}
  aria-pressed={playing}
>
  {playing ? <Pause /> : <Play />}
</Button>

<Button
  onClick={() => skip(-15)}
  aria-label="Skip backward 15 seconds"
>
  <SkipBack />
</Button>

{/* etc. */}
```

**5. Create Keyboard Shortcuts Help Dialog**

```typescript
const KeyboardShortcutsDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts">
          <Keyboard className="w-5 h-5" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ShortcutRow keys={['Space', 'K']} action="Play / Pause" />
          <ShortcutRow keys={['←']} action="Skip backward 15s" />
          <ShortcutRow keys={['→']} action="Skip forward 30s" />
          <ShortcutRow keys={['↑']} action="Volume up" />
          <ShortcutRow keys={['↓']} action="Volume down" />
          <ShortcutRow keys={['M']} action="Mute / Unmute" />
          <ShortcutRow keys={['<', '>']} action="Decrease / Increase speed" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const ShortcutRow = ({ keys, action }: { keys: string[], action: string }) => (
  <div className="flex items-center justify-between">
    <div className="flex gap-2">
      {keys.map(key => (
        <kbd key={key} className="kbd">{key}</kbd>
      ))}
    </div>
    <span>{action}</span>
  </div>
);
```

#### Files to Modify

- Modify: `components/reader/AudioPlayer.tsx` (add keyboard listener, ARIA labels)
- Modify: `hooks/useAudioPlayer.ts` (add volume, mute, speed change functions)
- Create: `components/reader/KeyboardShortcutsDialog.tsx`
- Modify: Styles for focus indicators

#### Testing Checklist

- [ ] Functional testing:
  - [ ] All shortcuts trigger correct actions
  - [ ] Shortcuts don't fire when typing in inputs
  - [ ] Multiple shortcuts can be used in sequence
  - [ ] Escape key behavior appropriate
- [ ] Accessibility testing:
  - [ ] Tab through all controls (logical order)
  - [ ] Focus indicators visible (keyboard navigation)
  - [ ] Screen reader announces button labels
  - [ ] Screen reader announces state changes (play/pause, muted, etc.)
  - [ ] ARIA live region updates announced
- [ ] Automated audit:
  - [ ] axe DevTools: 0 accessibility violations
  - [ ] Lighthouse: Accessibility score >95
- [ ] Cross-browser testing

#### Success Metrics

- Keyboard shortcut usage in analytics
- 0 accessibility violations in automated tests
- Positive feedback from keyboard-only users
- WCAG Level A compliance (verified by audit)

#### Dependencies

- TTS-002 (skip controls) - shares skip functionality

---

### TTS-005: Auto-Resume on App Load

**Priority**: P1 (High)
**Estimated Effort**: 2 days
**Sprint**: Sprint 1
**Labels**: `feature`, `tts`, `ux`

#### Problem Statement

Even with position persistence (TTS-001), users must manually navigate to resume playback. Industry standard is one-tap resume from home screen or automatic resumption.

**User Impact**: Additional friction to resume listening.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #4 (lines 337-387)
- Industry examples: Audible "Continue Listening" card, Spotify persistent player bar

#### Current State

No auto-resume logic on app initialization.

#### Acceptance Criteria

- [ ] On app load, check for recent playback state (from TTS-001)
- [ ] If found, show "Resume" dialog with context:
  - [ ] Book title + cover image
  - [ ] Chapter title
  - [ ] Timestamp (e.g., "Resume from 12:34")
  - [ ] "Resume" button (primary action)
  - [ ] "Dismiss" button (secondary action)
- [ ] On "Resume":
  - [ ] Load book and chapter
  - [ ] Seek to saved timestamp
  - [ ] Apply saved playback speed
  - [ ] Show audio player
  - [ ] Optionally: Auto-play or wait for user to press play
- [ ] On "Dismiss":
  - [ ] Clear saved playback state
  - [ ] Continue to normal app flow
- [ ] Dialog auto-dismisses after 10 seconds (to avoid blocking)
- [ ] Only show if playback state is recent (<7 days old)

#### Technical Implementation

**1. Create Resume Dialog Component**

Create `components/reader/ResumePlaybackDialog.tsx`:

```typescript
import { PlaybackState } from '@/lib/types/tts';

interface ResumePlaybackDialogProps {
  state: PlaybackState;
  book: Book; // Fetch book metadata by bookId
  chapter: Chapter; // Fetch chapter by chapterId
  onResume: () => void;
  onDismiss: () => void;
}

const ResumePlaybackDialog: React.FC<ResumePlaybackDialogProps> = ({
  state,
  book,
  chapter,
  onResume,
  onDismiss,
}) => {
  const [open, setOpen] = useState(true);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(false);
      onDismiss();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resume Listening?</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 items-start">
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-20 h-28 object-cover rounded"
          />

          <div className="flex-1">
            <h3 className="font-semibold">{book.title}</h3>
            <p className="text-sm text-muted-foreground">{chapter.title}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Resume from {formatTimestamp(state.currentTime)}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              onDismiss();
            }}
          >
            Dismiss
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              onResume();
            }}
          >
            Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResumePlaybackDialog;
```

**2. Add Auto-Resume Logic to App Initialization**

Modify `app/page.tsx` or main app component:

```typescript
import { loadPlaybackState } from '@/lib/tts-persistence';
import { ResumePlaybackDialog } from '@/components/reader/ResumePlaybackDialog';

const HomePage = () => {
  const [resumeState, setResumeState] = useState<PlaybackState | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);

  useEffect(() => {
    // Load playback state on mount
    const state = loadPlaybackState();

    if (state) {
      // Fetch book and chapter metadata
      fetchBookAndChapter(state.bookId, state.chapterId).then(({ book, chapter }) => {
        setResumeState({ state, book, chapter });
        setShowResumeDialog(true);
      });
    }
  }, []);

  const handleResume = async () => {
    if (!resumeState) return;

    // Navigate to reader view
    router.push(`/reader/${resumeState.state.bookId}`);

    // Load chapter and seek to position
    await loadChapter(resumeState.state.chapterId);
    await seekToPosition(resumeState.state.currentTime);

    // Apply saved settings
    setPlaybackSpeed(resumeState.state.playbackSpeed);

    // Optionally auto-play
    // togglePlay();
  };

  const handleDismiss = () => {
    clearPlaybackState();
    setShowResumeDialog(false);
  };

  return (
    <div>
      {showResumeDialog && resumeState && (
        <ResumePlaybackDialog
          state={resumeState.state}
          book={resumeState.book}
          chapter={resumeState.chapter}
          onResume={handleResume}
          onDismiss={handleDismiss}
        />
      )}

      {/* Rest of home page UI */}
    </div>
  );
};
```

**3. Alternative: Persistent Mini-Player**

Instead of (or in addition to) resume dialog, show persistent mini-player bar:

```typescript
const MiniPlayer = ({ state, book, chapter }: { state: PlaybackState, book: Book, chapter: Chapter }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50">
      <div className="container flex items-center gap-4 p-4">
        <img src={book.coverUrl} alt={book.title} className="w-12 h-16 object-cover rounded" />

        <div className="flex-1">
          <p className="font-semibold text-sm">{book.title}</p>
          <p className="text-xs text-muted-foreground">{chapter.title}</p>
        </div>

        <Button size="sm" onClick={handleResume}>
          Resume
        </Button>

        <Button size="sm" variant="ghost" onClick={handleDismiss}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
```

#### Files to Modify

- Create: `components/reader/ResumePlaybackDialog.tsx`
- Modify: `app/page.tsx` or main app component (add auto-resume logic)
- Optional: Create `components/reader/MiniPlayer.tsx`

#### Testing Checklist

- [ ] Functional testing:
  - [ ] Dialog appears on app load with saved state
  - [ ] "Resume" loads correct book/chapter and seeks to position
  - [ ] "Dismiss" clears state, no future prompts
  - [ ] Dialog auto-dismisses after 10 seconds
  - [ ] No dialog if no saved state
  - [ ] No dialog if state >7 days old
- [ ] Edge case testing:
  - [ ] BookId no longer exists (book deleted)
  - [ ] ChapterId invalid (chapter removed)
  - [ ] Corrupted state (graceful fallback)
- [ ] UX testing:
  - [ ] Dialog doesn't block critical app functions
  - [ ] Auto-dismiss timing feels natural
  - [ ] Resume transition smooth (<2s)

#### Success Metrics

- % of users who resume vs dismiss (expect >80% resume rate)
- Time to resume playback (<5 seconds from app load)
- Reduced friction in user flow (qualitative feedback)

#### Dependencies

- TTS-001 (Playback Position Persistence) - provides saved state

---

## Phase 2: Enhanced Features (P2)

### TTS-006: Sleep Timer

**Priority**: P2 (Medium)
**Estimated Effort**: 3-4 days
**Sprint**: Sprint 4
**Labels**: `feature`, `tts`, `ux`

#### Problem Statement

No sleep timer functionality. Users listening before bed must manually stop playback or let it play all night (drains battery, loses position). Sleep timer is present in 95% of audiobook apps and heavily used by bedtime listeners (~30% of users).

**User Impact**: Inconvenient for bedtime listeners.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #6 (lines 508-589)
- Industry examples: Audible (15/30/45/60 min + "End of Chapter"), Apple Books, Spotify

#### Acceptance Criteria

- [ ] Sleep timer button in audio player
- [ ] Timer dialog with presets:
  - [ ] 5, 15, 30, 45, 60 minutes
  - [ ] "End of Chapter" option
  - [ ] Custom time input
- [ ] Active timer display (countdown in player UI)
- [ ] Cancel timer button (while active)
- [ ] Fade-out audio over last 30 seconds
- [ ] Save playback position before stopping
- [ ] Timer persists across page navigation (within session)
- [ ] Optional: Notification when timer expires

#### Technical Implementation

**1. Create useSleepTimer Hook**

```typescript
// hooks/useSleepTimer.ts
import { useState, useEffect, useRef } from 'react';

interface SleepTimerOptions {
  duration: number | 'end-of-chapter'; // Minutes or special value
  fadeOutDuration?: number; // Seconds (default 30)
}

export const useSleepTimer = (
  onTimerEnd: () => void,
  currentChapter: Chapter | null,
  duration: number
) => {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [endOfChapterMode, setEndOfChapterMode] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = (options: SleepTimerOptions) => {
    if (options.duration === 'end-of-chapter') {
      setEndOfChapterMode(true);
      setIsActive(true);
      // Will trigger on chapter end
    } else {
      const seconds = options.duration * 60;
      setTimeRemaining(seconds);
      setIsActive(true);
      setEndOfChapterMode(false);
    }
  };

  const cancelTimer = () => {
    setIsActive(false);
    setTimeRemaining(null);
    setEndOfChapterMode(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  };

  // Countdown logic
  useEffect(() => {
    if (!isActive || endOfChapterMode || timeRemaining === null) return;

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 0) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, endOfChapterMode, timeRemaining]);

  // Trigger fade-out and stop
  useEffect(() => {
    if (timeRemaining === 30 && isActive) {
      // Start fade-out
      startFadeOut();
    }

    if (timeRemaining === 0 && isActive) {
      onTimerEnd();
      cancelTimer();
    }
  }, [timeRemaining, isActive]);

  const startFadeOut = () => {
    // Gradually reduce volume over 30 seconds
    const initialVolume = audioRef.current?.volume || 1;
    const steps = 30;
    const volumeStep = initialVolume / steps;

    let currentStep = 0;
    fadeIntervalRef.current = setInterval(() => {
      if (audioRef.current) {
        const newVolume = Math.max(0, initialVolume - volumeStep * currentStep);
        audioRef.current.volume = newVolume;
        currentStep++;

        if (currentStep >= steps) {
          clearInterval(fadeIntervalRef.current!);
        }
      }
    }, 1000);
  };

  // Listen for chapter end if in "end-of-chapter" mode
  useEffect(() => {
    if (!isActive || !endOfChapterMode) return;

    // This will be triggered by useAudioPlayer's onended handler
    // Pass a callback or use event emitter
  }, [isActive, endOfChapterMode]);

  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isActive,
    timeRemaining,
    endOfChapterMode,
    startTimer,
    cancelTimer,
    formatTimeRemaining: timeRemaining !== null ? formatTimeRemaining(timeRemaining) : null,
  };
};
```

**2. Create Sleep Timer Dialog**

```typescript
// components/reader/SleepTimerDialog.tsx
const SleepTimerDialog = ({ onSetTimer }: { onSetTimer: (options: SleepTimerOptions) => void }) => {
  const [customMinutes, setCustomMinutes] = useState('');

  const presets = [5, 15, 30, 45, 60];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Sleep timer">
          <Clock className="w-5 h-5" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sleep Timer</DialogTitle>
          <DialogDescription>
            Audio will fade out and stop after the selected time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {presets.map(minutes => (
              <Button
                key={minutes}
                variant="outline"
                onClick={() => onSetTimer({ duration: minutes })}
              >
                {minutes} min
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => onSetTimer({ duration: 'end-of-chapter' })}
          >
            End of Chapter
          </Button>

          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Custom (minutes)"
              value={customMinutes}
              onChange={e => setCustomMinutes(e.target.value)}
              min="1"
              max="180"
            />
            <Button
              onClick={() => {
                const duration = parseInt(customMinutes);
                if (duration > 0) {
                  onSetTimer({ duration });
                }
              }}
            >
              Set
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

**3. Integrate into Audio Player**

```typescript
// components/reader/AudioPlayer.tsx
const AudioPlayer = () => {
  const { /* ... */ } = useAudioPlayer();
  const {
    isActive: timerActive,
    timeRemaining,
    formatTimeRemaining,
    startTimer,
    cancelTimer,
  } = useSleepTimer(handleTimerEnd, currentChapter, duration);

  const handleTimerEnd = () => {
    // Save position before stopping
    savePlaybackState({
      bookId,
      chapterId: currentChapter.id,
      currentTime,
      playing: false,
      playbackSpeed,
      lastUpdated: Date.now(),
    });

    // Pause audio
    setPlaying(false);

    // Show toast
    toast.info('Sleep timer ended', { duration: 3000 });
  };

  return (
    <div className="audio-player">
      {/* Existing controls */}

      <SleepTimerDialog onSetTimer={startTimer} />

      {timerActive && timeRemaining !== null && (
        <div className="sleep-timer-indicator">
          <Clock className="w-4 h-4" />
          <span>{formatTimeRemaining}</span>
          <Button size="sm" variant="ghost" onClick={cancelTimer}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};
```

#### Files to Modify

- Create: `hooks/useSleepTimer.ts`
- Create: `components/reader/SleepTimerDialog.tsx`
- Modify: `components/reader/AudioPlayer.tsx` (integrate timer UI)
- Modify: `hooks/useAudioPlayer.ts` (add fade-out capability, audioRef access)

#### Testing Checklist

- [ ] Functional testing:
  - [ ] Each preset duration works correctly
  - [ ] "End of Chapter" stops at chapter end
  - [ ] Custom time input validates and works
  - [ ] Fade-out starts 30s before timer end
  - [ ] Volume returns to normal after cancel
  - [ ] Position saved before stopping
- [ ] Edge case testing:
  - [ ] Timer set, then chapter manually changed
  - [ ] Timer set, then page refreshed (should cancel)
  - [ ] Multiple timers set in sequence
  - [ ] Very short duration (< 30s, no fade)
- [ ] UX testing:
  - [ ] Countdown display updates every second
  - [ ] Cancel button easily accessible
  - [ ] Fade-out feels natural (not jarring)

#### Success Metrics

- Sleep timer usage rate (expect 20-30% of users)
- Preferred duration (informs future defaults)
- User satisfaction (qualitative feedback)

#### Dependencies

- TTS-001 (Playback Position Persistence) - saves position before stopping

---

### TTS-007: Lock Screen Controls (Media Session API)

**Priority**: P2 (Medium - High on Mobile)
**Estimated Effort**: 2-3 days
**Sprint**: Sprint 4
**Labels**: `feature`, `mobile`, `tts`, `ux`

#### Problem Statement

No lock screen controls. Users must unlock phone and open app to control playback. All mobile audiobook apps provide lock screen controls showing book cover, play/pause, skip buttons, and chapter title. This is standard for audio apps.

**User Impact**: Poor mobile UX, must unlock phone frequently.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #8 (lines 691-800)
- Industry standard: Audible, Spotify, Apple Music all provide lock screen controls
- Web platform: Media Session API (supported in modern browsers)

#### Acceptance Criteria

- [ ] Lock screen displays:
  - [ ] Book cover as artwork
  - [ ] Book title as album
  - [ ] Chapter title as track title
  - [ ] Author as artist
- [ ] Lock screen controls:
  - [ ] Play/Pause
  - [ ] Skip backward (-15s)
  - [ ] Skip forward (+30s)
  - [ ] Previous chapter (optional)
  - [ ] Next chapter (optional)
- [ ] Playback position updates on lock screen
- [ ] Controls functional without unlocking device
- [ ] Progressive enhancement (works where supported, no errors elsewhere)
- [ ] Notification controls on Android (same metadata)

#### Technical Implementation

**1. Add Media Session Integration to useAudioPlayer**

Modify `hooks/useAudioPlayer.ts`:

```typescript
import { useEffect } from 'react';

const useAudioPlayer = ({ book, currentChapter, /* ... */ }) => {
  // ... existing state

  // Set media metadata when chapter changes
  useEffect(() => {
    if ('mediaSession' in navigator && currentChapter && book) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentChapter.title,
        artist: book.author,
        album: book.title,
        artwork: [
          { src: book.coverUrl, sizes: '96x96', type: 'image/png' },
          { src: book.coverUrl, sizes: '128x128', type: 'image/png' },
          { src: book.coverUrl, sizes: '256x256', type: 'image/png' },
          { src: book.coverUrl, sizes: '512x512', type: 'image/png' },
        ],
      });
    }
  }, [currentChapter, book]);

  // Register action handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        setPlaying(true);
        audioRef.current?.play();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        setPlaying(false);
        audioRef.current?.pause();
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 15;
        const newTime = Math.max(0, currentTime - skipTime);
        seek(newTime);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 30;
        const newTime = Math.min(duration, currentTime + skipTime);
        seek(newTime);
      });

      // Optional: Previous/Next track for chapter navigation
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        const prevChapter = getPreviousChapter();
        if (prevChapter) {
          loadChapter(prevChapter.id);
        }
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const nextChapter = getNextChapter();
        if (nextChapter) {
          loadChapter(nextChapter.id);
        }
      });

      // Cleanup
      return () => {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      };
    }
  }, [currentTime, duration, playing, currentChapter]);

  // Update playback position state
  useEffect(() => {
    if ('mediaSession' in navigator && duration > 0) {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: playbackSpeed,
        position: currentTime,
      });
    }
  }, [currentTime, duration, playbackSpeed]);

  // ...
};
```

**2. Handle Browser Compatibility**

```typescript
// lib/media-session.ts
export const isMediaSessionSupported = (): boolean => {
  return 'mediaSession' in navigator && 'MediaMetadata' in window;
};

export const updateMediaMetadata = (metadata: {
  title: string;
  artist: string;
  album: string;
  artwork: string;
}) => {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      artwork: [
        { src: metadata.artwork, sizes: '96x96', type: 'image/png' },
        { src: metadata.artwork, sizes: '128x128', type: 'image/png' },
        { src: metadata.artwork, sizes: '256x256', type: 'image/png' },
        { src: metadata.artwork, sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch (error) {
    console.warn('Failed to set media metadata:', error);
  }
};
```

**3. Test on Multiple Platforms**

Media Session API support varies:
- **Chrome/Edge Android**: Full support
- **Safari iOS**: Partial support (iOS 13.4+)
- **Firefox Android**: Full support
- **Desktop browsers**: Displays in browser UI, not lock screen

#### Files to Modify

- Modify: `hooks/useAudioPlayer.ts` (add Media Session integration)
- Create: `lib/media-session.ts` (utility functions, compatibility checks)

#### Testing Checklist

- [ ] Android testing:
  - [ ] Lock screen shows controls
  - [ ] Play/Pause works from lock screen
  - [ ] Skip buttons work from lock screen
  - [ ] Metadata displays correctly (title, artist, artwork)
  - [ ] Notification controls work (Android notification shade)
- [ ] iOS testing:
  - [ ] Lock screen controls appear
  - [ ] Controls functional on lock screen
  - [ ] Control Center integration works
- [ ] Desktop testing:
  - [ ] Media controls in browser UI (Chrome media hub)
  - [ ] No errors on unsupported browsers
- [ ] Progressive enhancement:
  - [ ] Feature detection works
  - [ ] No errors when API unavailable
  - [ ] Graceful degradation

#### Success Metrics

- Lock screen control usage (analytics)
- Background listening session duration (expect increase)
- User satisfaction on mobile (qualitative feedback)

#### Dependencies

None (progressive enhancement, uses existing audio playback)

---

### TTS-008: Progressive TTS Generation

**Priority**: P2 (Medium)
**Estimated Effort**: 4-5 days
**Sprint**: Sprint 5
**Labels**: `feature`, `performance`, `tts`

#### Problem Statement

TTS generation is fully on-demand when user clicks "Generate Audio". Users must wait for entire chapter to generate before playback starts. For long chapters, this can be 5-10+ minutes. Modern users expect playback to start within 1 second.

**User Impact**: Wait time before playback, user abandonment.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #7 (lines 593-687)
- Industry standard: Audible/Spotify start playback within 1s, buffer ahead
- User expectation: Wait time >3s increases abandonment by 40%

#### Acceptance Criteria

- [ ] First paragraph generates within 1 second
- [ ] Playback starts immediately after first chunk
- [ ] Remaining content generates in background
- [ ] Seamless audio buffer appending (no gaps or clicks)
- [ ] Progress indicator shows generation status
- [ ] User can scrub to any point (wait if not generated yet)
- [ ] Fallback to current behavior if streaming fails
- [ ] Optional: Pre-generate next chapter when 80% through current

#### Technical Implementation

**1. Modify TTS Generation Strategy**

Update `hooks/useAudioGeneration.ts`:

```typescript
import { splitTextIntoChunks } from '@/lib/text-utils';
import { generateTTSChunk } from '@/lib/tts-client';

interface StreamingGenerationOptions {
  enableStreaming: boolean;
  firstChunkSize?: number; // Characters (default 500)
  onFirstChunkReady?: (audioBlob: Blob, duration: number) => void;
  onChunkGenerated?: (chunkIndex: number, totalChunks: number) => void;
}

export const generateChapterAudioStreaming = async (
  text: string,
  options: StreamingGenerationOptions
) => {
  const {
    enableStreaming = true,
    firstChunkSize = 500,
    onFirstChunkReady,
    onChunkGenerated,
  } = options;

  // Split text: first paragraph vs rest
  const firstParagraph = extractFirstParagraph(text, firstChunkSize);
  const remainingText = text.slice(firstParagraph.length);

  // Generate first chunk with priority
  const firstChunkAudio = await generateTTSChunk(firstParagraph, {
    voice: settings.voice,
    speed: settings.speed,
  });

  // Notify caller that first chunk is ready
  if (onFirstChunkReady) {
    onFirstChunkReady(firstChunkAudio.blob, firstChunkAudio.duration);
  }

  // Split remaining text into chunks
  const remainingChunks = splitTextIntoChunks(remainingText, {
    maxChunkSize: 4096,
    sentenceAware: true,
  });

  // Generate remaining chunks in background (parallel)
  const remainingAudioChunks = [];
  const chunkPromises = remainingChunks.map(async (chunk, index) => {
    const audio = await generateTTSChunk(chunk, {
      voice: settings.voice,
      speed: settings.speed,
    });

    if (onChunkGenerated) {
      onChunkGenerated(index + 1, remainingChunks.length);
    }

    return audio;
  });

  const generatedChunks = await Promise.all(chunkPromises);
  remainingAudioChunks.push(...generatedChunks);

  // Concatenate all audio chunks
  const allChunks = [firstChunkAudio, ...remainingAudioChunks];
  const concatenatedAudio = await concatenateAudioBlobs(
    allChunks.map(c => c.blob)
  );

  return {
    audioBlob: concatenatedAudio,
    totalDuration: allChunks.reduce((sum, c) => sum + c.duration, 0),
    chunks: allChunks,
  };
};

const extractFirstParagraph = (text: string, maxLength: number): string => {
  // Find first paragraph break or sentence, up to maxLength
  const paragraphEnd = text.indexOf('\n\n');
  const sentenceEnd = text.indexOf('. ');

  let endIndex = paragraphEnd !== -1 && paragraphEnd < maxLength
    ? paragraphEnd
    : sentenceEnd !== -1 && sentenceEnd < maxLength
    ? sentenceEnd + 1
    : maxLength;

  // Ensure we don't cut mid-word
  while (endIndex > 0 && text[endIndex] !== ' ') {
    endIndex--;
  }

  return text.slice(0, endIndex).trim();
};

const concatenateAudioBlobs = async (blobs: Blob[]): Promise<Blob> => {
  // Use Web Audio API or simple blob concatenation
  // For MP3, simple concatenation may work (MP3 frames are independent)
  return new Blob(blobs, { type: 'audio/mpeg' });
};
```

**2. Update Audio Player to Support Streaming**

Modify `hooks/useAudioPlayer.ts`:

```typescript
const useAudioPlayer = () => {
  const [streamingAudio, setStreamingAudio] = useState<{
    firstChunk: Blob | null;
    fullAudio: Blob | null;
    isGenerating: boolean;
  }>({
    firstChunk: null,
    fullAudio: null,
    isGenerating: false,
  });

  const startStreamingPlayback = async (firstChunkBlob: Blob) => {
    // Create object URL for first chunk
    const url = URL.createObjectURL(firstChunkBlob);

    // Load and play first chunk
    if (audioRef.current) {
      audioRef.current.src = url;
      await audioRef.current.play();
      setPlaying(true);
    }

    // When full audio ready, seamlessly switch
    // (May require MediaSource API for true seamless append)
  };

  const replaceWithFullAudio = (fullAudioBlob: Blob, currentTime: number) => {
    if (!audioRef.current) return;

    const wasPlaying = !audioRef.current.paused;
    const url = URL.createObjectURL(fullAudioBlob);

    // Save current position
    const savedTime = currentTime;

    // Load full audio
    audioRef.current.src = url;
    audioRef.current.currentTime = savedTime;

    // Resume playback if was playing
    if (wasPlaying) {
      audioRef.current.play();
    }
  };

  // ...
};
```

**3. Alternative: Pre-Generation Strategy**

Simpler alternative to streaming: pre-generate next chapter in background.

```typescript
// hooks/usePreGeneration.ts
export const usePreGeneration = (
  currentChapter: Chapter,
  book: Book,
  progress: number
) => {
  useEffect(() => {
    const shouldPreGenerate = progress > 0.8; // 80% through chapter

    if (shouldPreGenerate) {
      const nextChapter = getNextChapter(currentChapter.id, book);

      if (nextChapter) {
        checkAndGenerateNextChapter(nextChapter.id);
      }
    }
  }, [progress, currentChapter, book]);

  const checkAndGenerateNextChapter = async (chapterId: string) => {
    const hasAudio = await checkAudioExists(chapterId);

    if (!hasAudio) {
      // Generate in background with low priority
      await generateChapterAudio(chapterId, {
        priority: 'low',
        background: true,
      });

      toast.info('Next chapter ready', { duration: 2000 });
    }
  };
};
```

#### Files to Modify

- Modify: `hooks/useAudioGeneration.ts` (add streaming generation)
- Modify: `hooks/useAudioPlayer.ts` (support streaming playback)
- Create: `lib/text-utils.ts` (paragraph extraction, chunk splitting)
- Optional: Create `hooks/usePreGeneration.ts` (background pre-generation)

#### Testing Checklist

- [ ] Functional testing:
  - [ ] First paragraph plays within 1 second
  - [ ] Background generation completes without errors
  - [ ] Audio seamlessly transitions to full version
  - [ ] Scrubbing works (waits for generation if needed)
  - [ ] Generation progress updates correctly
- [ ] Edge case testing:
  - [ ] Very short chapters (<500 chars)
  - [ ] User scrubs before full generation complete
  - [ ] User changes chapters during generation
  - [ ] Network failure mid-generation
- [ ] Performance testing:
  - [ ] Time to first audio (<1s target)
  - [ ] CPU/memory usage during background generation
  - [ ] No audio glitches or gaps

#### Success Metrics

- Time to first audio (<1 second)
- Reduced user abandonment during generation
- Seamless chapter transitions (with pre-generation)
- User satisfaction (perceived performance)

#### Dependencies

- Existing TTS generation infrastructure (`lib/tts-client.ts`)

---

### TTS-009: Customizable Skip Intervals

**Priority**: P2 (Low)
**Estimated Effort**: 1-2 days
**Sprint**: Sprint 5
**Labels**: `feature`, `tts`, `ux`

#### Problem Statement

Skip intervals are hardcoded (15s backward, 30s forward). Power users want to customize these to their preference (e.g., 10s/10s, 30s/30s, etc.). This is a common feature in audiobook apps for personalization.

**User Impact**: Low - power user feature, nice-to-have.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Phase 2 Feature #9
- Industry examples: Audible allows customization, YouTube has fixed intervals

#### Acceptance Criteria

- [ ] Settings page or dialog for skip intervals
- [ ] Options: 5s, 10s, 15s, 30s, 60s (both backward and forward)
- [ ] Intervals saved to localStorage per-user
- [ ] Button labels update dynamically (show "10" instead of "15")
- [ ] Keyboard shortcuts respect custom intervals
- [ ] Default intervals: 15s backward, 30s forward

#### Technical Implementation

**1. Add Skip Settings to Settings Type**

```typescript
// lib/types/settings.ts
interface AudioSettings {
  // ...existing
  skipBackwardInterval: number; // Seconds (default 15)
  skipForwardInterval: number; // Seconds (default 30)
}
```

**2. Create Skip Settings Dialog**

```typescript
// components/settings/SkipIntervalSettings.tsx
const SkipIntervalSettings = () => {
  const [backwardInterval, setBackwardInterval] = useState(15);
  const [forwardInterval, setForwardInterval] = useState(30);

  const intervalOptions = [5, 10, 15, 30, 60];

  const saveSettings = () => {
    const settings = {
      skipBackwardInterval: backwardInterval,
      skipForwardInterval: forwardInterval,
    };

    localStorage.setItem('audio_skip_settings', JSON.stringify(settings));
    toast.success('Skip intervals saved');
  };

  useEffect(() => {
    // Load saved settings
    const saved = localStorage.getItem('audio_skip_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setBackwardInterval(settings.skipBackwardInterval);
      setForwardInterval(settings.skipForwardInterval);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">
          Skip Backward Interval
        </label>
        <Select value={backwardInterval.toString()} onValueChange={(val) => setBackwardInterval(parseInt(val))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {intervalOptions.map(sec => (
              <SelectItem key={sec} value={sec.toString()}>
                {sec} seconds
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Skip Forward Interval
        </label>
        <Select value={forwardInterval.toString()} onValueChange={(val) => setForwardInterval(parseInt(val))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {intervalOptions.map(sec => (
              <SelectItem key={sec} value={sec.toString()}>
                {sec} seconds
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={saveSettings}>
        Save Skip Intervals
      </Button>
    </div>
  );
};
```

**3. Use Custom Intervals in Audio Player**

```typescript
// hooks/useAudioPlayer.ts
const useAudioPlayer = () => {
  const [skipIntervals, setSkipIntervals] = useState({
    backward: 15,
    forward: 30,
  });

  useEffect(() => {
    // Load saved intervals
    const saved = localStorage.getItem('audio_skip_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setSkipIntervals({
        backward: settings.skipBackwardInterval,
        forward: settings.skipForwardInterval,
      });
    }
  }, []);

  const skipBackward = () => {
    skip(-skipIntervals.backward);
  };

  const skipForward = () => {
    skip(skipIntervals.forward);
  };

  return {
    // ...
    skipBackward,
    skipForward,
    skipIntervals,
  };
};
```

**4. Update Button Labels**

```typescript
// components/reader/AudioPlayer.tsx
<Button onClick={skipBackward} aria-label={`Skip backward ${skipIntervals.backward} seconds`}>
  <SkipBack />
  <span className="skip-label">{skipIntervals.backward}</span>
</Button>

<Button onClick={skipForward} aria-label={`Skip forward ${skipIntervals.forward} seconds`}>
  <SkipForward />
  <span className="skip-label">{skipIntervals.forward}</span>
</Button>
```

#### Files to Modify

- Modify: `lib/types/settings.ts` (add skip interval settings)
- Create: `components/settings/SkipIntervalSettings.tsx`
- Modify: `hooks/useAudioPlayer.ts` (use custom intervals)
- Modify: `components/reader/AudioPlayer.tsx` (update labels)

#### Testing Checklist

- [ ] Settings save and load correctly
- [ ] Button labels update dynamically
- [ ] Keyboard shortcuts use custom intervals
- [ ] Default values work without saved settings
- [ ] Edge cases: 0 or negative values rejected

#### Success Metrics

- % of users who customize intervals (expect <10%)
- High satisfaction among those who customize (power users)

#### Dependencies

- TTS-002 (Skip Controls) - adds customization to existing feature

---

## Phase 3: Differentiating Features (P3)

### TTS-010: Synchronized Sentence Highlighting

**Priority**: P3 (Low - Differentiation Opportunity)
**Estimated Effort**: 5-7 days
**Sprint**: Future
**Labels**: `feature`, `differentiator`, `tts`, `ux`

#### Problem Statement

Infrastructure for sentence synchronization exists (parsing, timestamps, tracking), but visual highlighting in epub.js iframe is not implemented. Synchronized highlighting is a unique differentiator - pre-recorded audiobooks cannot offer this. It benefits visual learners, language learners, and users with reading difficulties.

**User Impact**: Missed differentiation opportunity.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Issue #9 (lines 804-914)
- Competitive examples: Amazon Whispersync for Voice, Spotify "Follow-Along"

#### Acceptance Criteria

- [ ] Current sentence highlighted in reading view during audio playback
- [ ] Highlight style: Subtle (yellow background with low opacity)
- [ ] Auto-scroll to keep highlighted sentence visible
- [ ] User setting to enable/disable highlighting
- [ ] Dark mode compatible highlighting
- [ ] Color-blind friendly (use both color and underline)
- [ ] Performance: Throttled updates (100ms)
- [ ] Works across epub.js iframe boundary

#### Technical Implementation

**Approach 1: epub.js Annotations API**

```typescript
// lib/sentence-highlighter.ts (enhance existing file)
export const highlightCurrentSentence = (
  rendition: any,
  sentenceIndex: number,
  sentences: SentenceSyncData[]
) => {
  // Remove previous highlight
  rendition.annotations.remove('current-sentence-highlight');

  // Get sentence CFI range
  const sentence = sentences[sentenceIndex];
  if (!sentence || !sentence.cfiRange) return;

  // Add highlight annotation
  rendition.annotations.add(
    'highlight',
    sentence.cfiRange,
    {}, // Data
    (e: any) => {}, // Click handler
    'current-sentence-highlight', // Class name
    {
      fill: 'yellow',
      'fill-opacity': '0.3',
      'mix-blend-mode': 'multiply',
    }
  );

  // Auto-scroll to sentence
  rendition.display(sentence.cfiRange);
};

// Hook into useAudioPlayer
const useAudioPlayer = () => {
  const { currentSentenceIndex } = useSentenceSync(currentTime);
  const [highlightEnabled, setHighlightEnabled] = useState(true);

  useEffect(() => {
    if (highlightEnabled && currentSentenceIndex !== null) {
      // Throttle to 100ms
      const throttled = throttle(() => {
        highlightCurrentSentence(
          rendition,
          currentSentenceIndex,
          sentenceSyncData
        );
      }, 100);

      throttled();
    }
  }, [currentSentenceIndex, highlightEnabled]);
};
```

**Approach 2: Direct iframe DOM Manipulation**

If epub.js annotations insufficient:

```typescript
// lib/sentence-highlighter.ts
export const highlightSentenceDirectly = (
  rendition: any,
  sentenceIndex: number
) => {
  try {
    const iframe = rendition.manager.views().list[0].iframe;
    const doc = iframe.contentDocument;

    if (!doc) return;

    // Clear previous highlight
    doc.querySelectorAll('.tts-current-sentence').forEach(el => {
      el.classList.remove('tts-current-sentence');
    });

    // Find sentence element (requires data-sentence attribute in DOM)
    const sentenceEl = doc.querySelector(`[data-sentence="${sentenceIndex}"]`);

    if (sentenceEl) {
      sentenceEl.classList.add('tts-current-sentence');

      // Scroll into view
      sentenceEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    }
  } catch (error) {
    console.warn('Failed to highlight sentence:', error);
  }
};

// Inject CSS into epub iframe
const injectHighlightStyles = (iframe: HTMLIFrameElement) => {
  const style = iframe.contentDocument?.createElement('style');
  if (!style) return;

  style.textContent = `
    .tts-current-sentence {
      background-color: rgba(255, 255, 0, 0.3);
      box-shadow: 0 0 0 2px rgba(255, 255, 0, 0.3);
      border-radius: 2px;
      transition: background-color 0.2s ease;
    }

    @media (prefers-color-scheme: dark) {
      .tts-current-sentence {
        background-color: rgba(255, 255, 0, 0.2);
        box-shadow: 0 0 0 2px rgba(255, 255, 0, 0.2);
      }
    }

    /* Color-blind friendly: add underline */
    .tts-current-sentence {
      text-decoration: underline;
      text-decoration-color: rgba(255, 255, 0, 0.5);
      text-decoration-thickness: 2px;
    }
  `;

  iframe.contentDocument?.head.appendChild(style);
};
```

**3. Add User Setting**

```typescript
// components/settings/AudioSettings.tsx
const AudioSettings = () => {
  const [highlightEnabled, setHighlightEnabled] = useState(true);

  const toggleHighlight = (enabled: boolean) => {
    setHighlightEnabled(enabled);
    localStorage.setItem('tts_highlight_enabled', JSON.stringify(enabled));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="font-medium">Sentence Highlighting</label>
          <p className="text-sm text-muted-foreground">
            Highlight current sentence during audio playback
          </p>
        </div>
        <Switch
          checked={highlightEnabled}
          onCheckedChange={toggleHighlight}
        />
      </div>
    </div>
  );
};
```

#### Files to Modify

- Modify: `lib/sentence-highlighter.ts` (implement highlighting, currently TODO)
- Modify: `hooks/useAudioPlayer.ts` (integrate highlighting)
- Modify: `components/reader/ReaderView.tsx` (inject styles into epub iframe)
- Modify: `components/settings/AudioSettings.tsx` (add toggle)

#### Testing Checklist

- [ ] Functional testing:
  - [ ] Sentence highlights during playback
  - [ ] Highlight updates as audio progresses
  - [ ] Auto-scroll keeps sentence visible
  - [ ] Highlight clears when paused
  - [ ] Toggle setting works
- [ ] Visual testing:
  - [ ] Highlight subtle, not distracting
  - [ ] Dark mode compatible
  - [ ] Color-blind friendly (underline present)
  - [ ] Works with different epub styles
- [ ] Performance testing:
  - [ ] No lag or stuttering
  - [ ] Throttling effective (100ms updates)
- [ ] Cross-epub testing:
  - [ ] Works with different epub formats
  - [ ] Handles reflowable and fixed-layout

#### Success Metrics

- Feature usage rate (% who enable)
- User feedback (unique selling point in reviews)
- Engagement metrics (combined reading + listening time)

#### Dependencies

- Existing sentence sync infrastructure (`lib/sentence-sync.ts`)

---

### TTS-011: Hybrid Reading + Listening Mode

**Priority**: P3 (Low)
**Estimated Effort**: 3-4 days
**Sprint**: Future
**Labels**: `feature`, `tts`, `ux`

#### Problem Statement

Current sync toggle is binary (on/off). Users may want more control over how reading and listening interact. Hybrid modes leverage existing bidirectional sync but offer explicit UX patterns.

**User Impact**: Power user feature, enhances flexibility.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Phase 3 Feature #11

#### Acceptance Criteria

- [ ] Sync modes:
  - [ ] Audio-only: Audio plays, reading position doesn't update
  - [ ] Reading-only: Silent reading, audio paused
  - [ ] Hybrid (Audio→Reading): Audio updates reading position (current behavior)
  - [ ] Hybrid (Reading→Audio): Reading updates audio position (current behavior)
  - [ ] Fully Synced: Bidirectional (current default when sync enabled)
- [ ] Mode selector in audio player UI
- [ ] Reading progress overlay during audio playback
- [ ] Chapter preview (next chapter title + first paragraph)

#### Technical Implementation

**1. Add Sync Mode Enum**

```typescript
// lib/types/tts.ts
enum SyncMode {
  AudioOnly = 'audio-only',
  ReadingOnly = 'reading-only',
  AudioToReading = 'audio-to-reading',
  ReadingToAudio = 'reading-to-audio',
  FullyBidirectional = 'fully-bidirectional',
}
```

**2. Enhance useSentenceSync Hook**

```typescript
// hooks/useSentenceSync.ts
const useSentenceSync = (
  currentTime: number,
  syncMode: SyncMode
) => {
  const shouldSyncAudioToReading = [
    SyncMode.AudioToReading,
    SyncMode.FullyBidirectional,
  ].includes(syncMode);

  const shouldSyncReadingToAudio = [
    SyncMode.ReadingToAudio,
    SyncMode.FullyBidirectional,
  ].includes(syncMode);

  useEffect(() => {
    if (shouldSyncAudioToReading) {
      syncAudioPositionToReading(currentTime);
    }
  }, [currentTime, shouldSyncAudioToReading]);

  // Listen for reading position changes
  useEffect(() => {
    if (shouldSyncReadingToAudio) {
      const handlePageTurn = (cfi: string) => {
        const timestamp = cfiToTimestamp(cfi);
        seekAudio(timestamp);
      };

      rendition.on('relocated', handlePageTurn);
      return () => rendition.off('relocated', handlePageTurn);
    }
  }, [shouldSyncReadingToAudio]);

  // ...
};
```

**3. Create Sync Mode Selector UI**

```typescript
// components/reader/SyncModeSelector.tsx
const SyncModeSelector = ({ currentMode, onChange }: {
  currentMode: SyncMode;
  onChange: (mode: SyncMode) => void;
}) => {
  return (
    <Select value={currentMode} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SyncMode.AudioOnly}>
          Audio Only
          <span className="text-xs text-muted-foreground">
            Audio plays, reading stays in place
          </span>
        </SelectItem>

        <SelectItem value={SyncMode.ReadingOnly}>
          Reading Only
          <span className="text-xs text-muted-foreground">
            Silent reading, audio paused
          </span>
        </SelectItem>

        <SelectItem value={SyncMode.AudioToReading}>
          Audio → Reading
          <span className="text-xs text-muted-foreground">
            Audio updates reading position
          </span>
        </SelectItem>

        <SelectItem value={SyncMode.ReadingToAudio}>
          Reading → Audio
          <span className="text-xs text-muted-foreground">
            Reading updates audio position
          </span>
        </SelectItem>

        <SelectItem value={SyncMode.FullyBidirectional}>
          Fully Synced (Default)
          <span className="text-xs text-muted-foreground">
            Audio and reading stay synchronized
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
```

**4. Reading Progress Overlay**

Show reading progress during audio playback:

```typescript
// components/reader/ReadingProgressOverlay.tsx
const ReadingProgressOverlay = ({ book, currentChapter, currentPage, totalPages }: {
  book: Book;
  currentChapter: Chapter;
  currentPage: number;
  totalPages: number;
}) => {
  return (
    <div className="reading-progress-overlay">
      <div className="text-sm text-muted-foreground">
        Chapter {currentChapter.number}: {currentChapter.title}
      </div>
      <div className="text-xs text-muted-foreground">
        Page {currentPage} of {totalPages}
      </div>
      <Progress value={(currentPage / totalPages) * 100} className="h-1 mt-2" />
    </div>
  );
};
```

#### Files to Modify

- Modify: `lib/types/tts.ts` (add SyncMode enum)
- Modify: `hooks/useSentenceSync.ts` (add mode logic)
- Create: `components/reader/SyncModeSelector.tsx`
- Create: `components/reader/ReadingProgressOverlay.tsx`
- Modify: `components/reader/AudioPlayer.tsx` (integrate mode selector)

#### Testing Checklist

- [ ] Each sync mode works as described
- [ ] Mode persists across sessions
- [ ] Reading progress overlay displays correctly
- [ ] Smooth transitions between modes

#### Success Metrics

- Mode usage distribution (which modes are popular)
- User engagement (reading + listening combined time)

#### Dependencies

- Existing bidirectional sync (`lib/sentence-sync.ts`)

---

### TTS-012: Advanced Bookmarking with Timestamps

**Priority**: P3 (Low)
**Estimated Effort**: 5-7 days
**Sprint**: Future
**Labels**: `feature`, `tts`, `ux`

#### Problem Statement

No bookmarking functionality for audio timestamps. Users cannot mark specific moments in audio playback for later reference. This is a standard feature in audiobook apps for taking notes, marking quotes, or saving progress.

**User Impact**: Power user feature, note-taking workflow.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Phase 3 Feature #12

#### Acceptance Criteria

- [ ] Bookmark button in audio player (saves current timestamp + CFI)
- [ ] Bookmarks list view (sortable, searchable)
- [ ] Each bookmark includes:
  - [ ] Timestamp in audio
  - [ ] CFI in reading view
  - [ ] Text snippet (sentence or paragraph)
  - [ ] Optional user note/comment
  - [ ] Creation date
- [ ] Jump to bookmark (loads chapter, seeks to timestamp)
- [ ] Edit/delete bookmarks
- [ ] Export bookmarks (JSON, Markdown, CSV)
- [ ] Visual indicator in timeline/progress bar

#### Technical Implementation

**1. Extend Database Schema**

```typescript
// lib/db.ts (Dexie)
db.version(3).stores({
  // ...existing stores
  bookmarks: '++id, bookId, chapterId, timestamp, cfi, text, note, createdAt',
});

interface Bookmark {
  id?: number;
  bookId: string;
  chapterId: string;
  timestamp: number; // Seconds in audio
  cfi: string; // Canonical Fragment Identifier
  text: string; // Text snippet
  note?: string; // User note
  createdAt: number; // Unix timestamp
}
```

**2. Create Bookmark Functions**

```typescript
// lib/bookmarks.ts
import { db } from './db';

export const createBookmark = async (bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Promise<number> => {
  return await db.bookmarks.add({
    ...bookmark,
    createdAt: Date.now(),
  });
};

export const getBookmarksByBook = async (bookId: string): Promise<Bookmark[]> => {
  return await db.bookmarks
    .where('bookId')
    .equals(bookId)
    .sortBy('timestamp');
};

export const deleteBookmark = async (id: number): Promise<void> => {
  await db.bookmarks.delete(id);
};

export const updateBookmark = async (id: number, updates: Partial<Bookmark>): Promise<void> => {
  await db.bookmarks.update(id, updates);
};

export const exportBookmarks = async (bookId: string, format: 'json' | 'markdown' | 'csv'): Promise<string> => {
  const bookmarks = await getBookmarksByBook(bookId);

  switch (format) {
    case 'json':
      return JSON.stringify(bookmarks, null, 2);

    case 'markdown':
      return bookmarks.map(b => `
## ${new Date(b.createdAt).toLocaleDateString()}

**Timestamp**: ${formatTimestamp(b.timestamp)}
**Text**: ${b.text}
${b.note ? `**Note**: ${b.note}` : ''}

---
      `).join('\n');

    case 'csv':
      const header = 'Timestamp,Text,Note,Date\n';
      const rows = bookmarks.map(b =>
        `${formatTimestamp(b.timestamp)},"${b.text.replace(/"/g, '""')}","${(b.note || '').replace(/"/g, '""')}",${new Date(b.createdAt).toISOString()}`
      ).join('\n');
      return header + rows;

    default:
      return '';
  }
};
```

**3. Create Bookmark UI Components**

```typescript
// components/reader/BookmarkButton.tsx
const BookmarkButton = ({ onBookmark }: { onBookmark: () => void }) => {
  const [justBookmarked, setJustBookmarked] = useState(false);

  const handleClick = () => {
    onBookmark();
    setJustBookmarked(true);
    setTimeout(() => setJustBookmarked(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label="Create bookmark"
    >
      <Bookmark className={justBookmarked ? 'fill-current' : ''} />
    </Button>
  );
};

// components/reader/BookmarksList.tsx
const BookmarksList = ({ bookId }: { bookId: string }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, [bookId]);

  const loadBookmarks = async () => {
    const bm = await getBookmarksByBook(bookId);
    setBookmarks(bm);
  };

  const filteredBookmarks = bookmarks.filter(b =>
    b.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.note && b.note.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleJumpToBookmark = (bookmark: Bookmark) => {
    // Load chapter, seek to timestamp, navigate to CFI
    loadChapter(bookmark.chapterId);
    seekAudio(bookmark.timestamp);
    navigateToCFI(bookmark.cfi);
  };

  const handleDelete = async (id: number) => {
    await deleteBookmark(id);
    loadBookmarks();
  };

  return (
    <div className="bookmarks-list">
      <div className="header">
        <Input
          placeholder="Search bookmarks..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <Button onClick={() => exportBookmarks(bookId, 'markdown')}>
          Export
        </Button>
      </div>

      <div className="bookmarks">
        {filteredBookmarks.map(bookmark => (
          <Card key={bookmark.id} className="bookmark-card">
            <CardHeader>
              <CardTitle className="text-sm">
                {formatTimestamp(bookmark.timestamp)}
              </CardTitle>
              <CardDescription>
                {new Date(bookmark.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{bookmark.text}</p>
              {bookmark.note && (
                <p className="text-sm text-muted-foreground mt-2">
                  Note: {bookmark.note}
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button size="sm" onClick={() => handleJumpToBookmark(bookmark)}>
                Jump to
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(bookmark.id!)}>
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

**4. Integrate into Audio Player**

```typescript
// hooks/useAudioPlayer.ts
const useAudioPlayer = () => {
  // ...

  const createBookmarkAtCurrentPosition = async () => {
    const currentSentence = getCurrentSentence(currentTime);
    const currentCFI = timestampToCFI(currentTime);

    await createBookmark({
      bookId: book.id,
      chapterId: currentChapter.id,
      timestamp: currentTime,
      cfi: currentCFI,
      text: currentSentence.text,
    });

    toast.success('Bookmark created');
  };

  return {
    // ...
    createBookmarkAtCurrentPosition,
  };
};
```

#### Files to Modify

- Modify: `lib/db.ts` (add bookmarks table)
- Create: `lib/bookmarks.ts` (CRUD functions, export)
- Create: `components/reader/BookmarkButton.tsx`
- Create: `components/reader/BookmarksList.tsx`
- Modify: `hooks/useAudioPlayer.ts` (add bookmark creation)
- Modify: `components/reader/AudioPlayer.tsx` (integrate bookmark button)

#### Testing Checklist

- [ ] Create, read, update, delete bookmarks
- [ ] Search bookmarks by text/note
- [ ] Jump to bookmark (correct chapter, timestamp, CFI)
- [ ] Export bookmarks in all formats
- [ ] Visual indicator in timeline (optional)

#### Success Metrics

- Bookmarks created per user
- Note-taking engagement
- Export usage

#### Dependencies

- Existing IndexedDB infrastructure (`lib/db.ts`)
- Sentence sync for text snippets (`lib/sentence-sync.ts`)

---

### TTS-013: Multi-Voice Support

**Priority**: P3 (Low)
**Estimated Effort**: 2-3 days
**Sprint**: Future
**Labels**: `feature`, `tts`, `ux`

#### Problem Statement

Only one voice option available (or default voice used). Users have different preferences for voice gender, accent, and tone. OpenAI TTS offers 6 voices (alloy, echo, fable, onyx, nova, shimmer), but UI doesn't expose this choice.

**User Impact**: Low - user preference, personalization.

**Research Reference**:
- `2025-11-13-tts-playback-ux-evaluation.md` - Phase 3 Feature #13

#### Acceptance Criteria

- [ ] Voice selection UI (dropdown or grid)
- [ ] Voice preview (generate sample sentence)
- [ ] Voice preference saved per book
- [ ] Regenerate chapter with different voice
- [ ] Cache audio per voice (key: `${chapterId}_${voice}`)
- [ ] Visual voice descriptions (gender, style)

#### Technical Implementation

**1. Add Voice Options**

```typescript
// lib/types/tts.ts
enum TTSVoice {
  Alloy = 'alloy',
  Echo = 'echo',
  Fable = 'fable',
  Onyx = 'onyx',
  Nova = 'nova',
  Shimmer = 'shimmer',
}

const voiceDescriptions: Record<TTSVoice, { gender: string, style: string }> = {
  [TTSVoice.Alloy]: { gender: 'Neutral', style: 'Balanced, versatile' },
  [TTSVoice.Echo]: { gender: 'Male', style: 'Deep, authoritative' },
  [TTSVoice.Fable]: { gender: 'Male', style: 'Warm, storytelling' },
  [TTSVoice.Onyx]: { gender: 'Male', style: 'Rich, professional' },
  [TTSVoice.Nova]: { gender: 'Female', style: 'Energetic, expressive' },
  [TTSVoice.Shimmer]: { gender: 'Female', style: 'Soft, soothing' },
};
```

**2. Create Voice Selector Component**

```typescript
// components/settings/VoiceSelector.tsx
const VoiceSelector = ({ currentVoice, onChange }: {
  currentVoice: TTSVoice;
  onChange: (voice: TTSVoice) => void;
}) => {
  const [previewingVoice, setPreviewingVoice] = useState<TTSVoice | null>(null);

  const handlePreview = async (voice: TTSVoice) => {
    setPreviewingVoice(voice);

    const sampleText = 'This is a preview of the voice. How does it sound?';
    const audioBlob = await generateTTSChunk(sampleText, { voice });

    // Play preview
    const audio = new Audio(URL.createObjectURL(audioBlob.blob));
    audio.play();

    audio.onended = () => setPreviewingVoice(null);
  };

  return (
    <div className="voice-selector">
      <label className="block text-sm font-medium mb-4">
        Select Narration Voice
      </label>

      <div className="grid grid-cols-2 gap-4">
        {Object.entries(voiceDescriptions).map(([voice, desc]) => (
          <Card
            key={voice}
            className={`cursor-pointer hover:border-primary ${currentVoice === voice ? 'border-primary' : ''}`}
            onClick={() => onChange(voice as TTSVoice)}
          >
            <CardHeader>
              <CardTitle className="text-base">{voice}</CardTitle>
              <CardDescription>
                {desc.gender} • {desc.style}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(voice as TTSVoice);
                }}
                disabled={previewingVoice === voice}
              >
                {previewingVoice === voice ? 'Playing...' : 'Preview'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

**3. Store Voice Preference Per Book**

```typescript
// lib/db.ts
interface AudioSettings {
  // ...existing
  voice: TTSVoice;
}

// When generating audio, use selected voice
const generateChapterAudio = async (chapterId: string, bookId: string) => {
  const settings = await getAudioSettings(bookId);
  const voice = settings?.voice || TTSVoice.Alloy;

  // Generate with selected voice
  const audio = await generateTTS(text, { voice });

  // Cache with voice in key
  await saveAudioFile({
    chapterId,
    bookId,
    voice,
    audioData: audio,
  });
};
```

**4. Handle Voice Change (Regeneration)**

```typescript
// components/settings/AudioSettings.tsx
const AudioSettings = ({ bookId }: { bookId: string }) => {
  const [currentVoice, setCurrentVoice] = useState<TTSVoice>(TTSVoice.Alloy);

  const handleVoiceChange = async (newVoice: TTSVoice) => {
    setCurrentVoice(newVoice);

    // Save preference
    await saveAudioSettings(bookId, { voice: newVoice });

    // Prompt to regenerate existing chapters
    const hasExistingAudio = await checkExistingAudioFiles(bookId);

    if (hasExistingAudio) {
      const shouldRegenerate = await confirm(
        'You have existing audio with a different voice. Would you like to regenerate it with the new voice?'
      );

      if (shouldRegenerate) {
        await regenerateAllChapters(bookId, newVoice);
      }
    }
  };

  return (
    <div>
      <VoiceSelector
        currentVoice={currentVoice}
        onChange={handleVoiceChange}
      />
    </div>
  );
};
```

#### Files to Modify

- Modify: `lib/types/tts.ts` (add TTSVoice enum, descriptions)
- Create: `components/settings/VoiceSelector.tsx`
- Modify: `lib/db.ts` (add voice to AudioSettings)
- Modify: `hooks/useAudioGeneration.ts` (use selected voice)
- Modify: `components/settings/AudioSettings.tsx` (integrate voice selector)

#### Testing Checklist

- [ ] Voice preview plays sample audio
- [ ] Voice preference saves correctly
- [ ] Generated audio uses selected voice
- [ ] Cache keys include voice (separate caches per voice)
- [ ] Regeneration prompt works correctly

#### Success Metrics

- Voice preference distribution (which voices popular)
- Re-generation rate (users trying different voices)

#### Dependencies

- Existing TTS generation (`lib/tts-client.ts`)

---

## Summary

This document provides **13 implementation tickets** organized into 3 phases:

**Phase 1 (P0-P1)**: Critical fixes to bring TTS playback to industry baseline
- TTS-001: Playback Position Persistence (3-5 days)
- TTS-002: Skip Forward/Backward Controls (2-3 days)
- TTS-003: Chapter Auto-Advance (3-4 days)
- TTS-004: Keyboard Shortcuts (2-3 days)
- TTS-005: Auto-Resume on App Load (2 days)

**Phase 2 (P2)**: Enhanced features for competitive UX
- TTS-006: Sleep Timer (3-4 days)
- TTS-007: Lock Screen Controls (2-3 days)
- TTS-008: Progressive TTS Generation (4-5 days)
- TTS-009: Customizable Skip Intervals (1-2 days)

**Phase 3 (P3)**: Differentiating features
- TTS-010: Synchronized Sentence Highlighting (5-7 days)
- TTS-011: Hybrid Reading + Listening Mode (3-4 days)
- TTS-012: Advanced Bookmarking with Timestamps (5-7 days)
- TTS-013: Multi-Voice Support (2-3 days)

**Total Estimated Effort**:
- Phase 1: 14-19 days
- Phase 2: 10-14 days
- Phase 3: 15-21 days
- **Grand Total**: 39-54 days (8-11 weeks for single developer)

Each ticket includes:
- Problem statement and user impact
- Research references
- Acceptance criteria
- Detailed technical implementation
- Files to modify
- Testing checklist
- Success metrics
- Dependencies

---

**Next Steps**:
1. Review and prioritize tickets with team
2. Create tickets in issue tracker (GitHub, Jira, etc.)
3. Assign to sprints based on roadmap
4. Begin implementation with Phase 1 (critical fixes)
5. Iterate based on user feedback and analytics
