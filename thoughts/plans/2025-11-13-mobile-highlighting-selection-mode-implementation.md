---
doc_type: plan
date: 2025-11-13T16:30:44+00:00
title: "Mobile Highlighting Selection Mode Implementation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T16:30:44+00:00"
feature: "mobile-highlighting-selection-mode"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Constants, Types, and Touch Handler Enhancement"
    status: completed
    estimated_time: "3-4 hours"
  - name: "Phase 2: Selection Mode State Management"
    status: completed
    estimated_time: "2-3 hours"
  - name: "Phase 3: CSS Toggling and Gesture Coordination"
    status: completed
    estimated_time: "2-3 hours"
  - name: "Phase 4: Auto-Exit Logic and Integration Testing"
    status: completed
    estimated_time: "3-4 hours"

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Claude Code
last_updated_note: "All 4 phases implemented successfully in worktree. Mobile device testing required."

tags:
  - mobile
  - highlighting
  - touch-events
  - gesture-detection
status: implemented

related_docs:
  - thoughts/research/2025-11-13-mobile-highlighting-issue-single-word-selection.md
  - thoughts/research/2025-11-13-tap-hold-detection-for-mobile-selection-mode.md
---

# Mobile Highlighting Selection Mode Implementation Plan

**Ticket**: N/A (Internal UX improvement)
**Feature**: Enable full-passage text selection on mobile via tap-and-hold gesture
**Branch**: `feature/mobile-highlighting`
**Working Directory**: `/Users/seankim/dev/reader-mobile-highlighting-worktree`

## Executive Summary

This plan implements a solution to fix mobile highlighting by introducing a "selection mode" activated via tap-and-hold gesture (600ms). The implementation conditionally disables the CSS `select-none` that currently blocks text selection, while maintaining tap-zone navigation and swipe gestures through intelligent gesture priority management.

### Problem Statement

Currently on mobile, users can only highlight single words instead of full passages. The root cause is CSS `select-none` on the TapZones component wrapper (`components/reader/TapZones.tsx:68`) that completely blocks text selection. Additionally, touch event handlers for swipe navigation may interfere with selection drag gestures.

### Solution Approach

1. **Tap-and-hold detection** (600ms without movement >10px) enters "selection mode"
2. **Conditional CSS toggling** removes `select-none` during selection mode
3. **Gesture priority management**: swipe (fast) → long press → tap
4. **Auto-exit conditions**: highlight creation, page navigation, 30s timeout

### Success Criteria

- Users can tap-and-hold text, then drag to extend selection and create highlights
- Quick taps still trigger tap-zone navigation (no regression)
- Swipe navigation continues to work normally
- No interference between gestures
- Clean state transitions with no stuck modes

## Current State Analysis

### Architecture Components

**TapZones Component** (`components/reader/TapZones.tsx:68`):
```tsx
<div
  onClick={handleClick}
  className="w-full h-full cursor-pointer select-none"  // ← BLOCKS SELECTION
  role="button"
  tabIndex={0}
  aria-label="Reading area - swipe or click left to go back, right to go forward, center to show menu"
>
  {children}
</div>
```

**Touch Event Infrastructure** (`hooks/useEpubReader.ts:78-139`):
- Already captures touchstart/touchend with timing
- Swipe detection: `duration < 500ms` + `movement > 50px horizontal`
- Registered inside epub.js iframe via `rendition.hooks.content.register()`

**Highlighting System** (`hooks/useHighlights.ts:77-108`):
- Correctly listens for epub.js `selected` event
- Extracts selection text, CFI range, position
- Shows HighlightMenu when selection made
- **Works correctly once selection is enabled**

**State Management Pattern** (`ReaderView.tsx:46-52`):
- Uses `useState<boolean>` for modal/mode states
- Examples: `showSettings`, `showChapterList`, `showAiRecap`
- **Pattern to follow for `selectionMode`**

**Timer Pattern** (`AiExplanation.tsx:25-31`, `ReaderView.tsx:279-283`):
- Uses `setTimeout` with cleanup in `useEffect`
- Returns `clearTimeout` function
- **Pattern to follow for long press detection**

### Current Limitations

1. **CSS blocks all selection**: `select-none` prevents tap-and-hold on mobile
2. **No gesture discrimination**: Can't distinguish tap vs hold vs swipe intent
3. **No state-based CSS toggling**: CSS is always applied, no conditional logic
4. **Touch handlers isolated**: Handlers run in iframe, state lives in React components

## Requirements

### Functional Requirements

**FR-1: Tap-and-Hold Detection**
- Detect touch held for 600ms without movement >10px
- Enter selection mode when long press confirmed
- Cancel detection if finger moves >10px before 600ms

**FR-2: Selection Mode Activation**
- Remove `select-none` CSS when selection mode active
- Disable tap-zone click handling during selection mode
- Disable swipe navigation during selection mode
- Show native browser selection handles

**FR-3: Gesture Priority**
- Swipe (fast horizontal movement) takes highest priority
- Long press (stationary touch) takes second priority
- Quick tap (for tap zones) takes lowest priority
- No ambiguous gestures cause unintended actions

**FR-4: Auto-Exit Selection Mode**
- Exit when user creates highlight (picks color)
- Exit when highlight menu closed without selection
- Exit when user navigates to different page
- Exit after 30 seconds of inactivity
- Exit on app blur/background

**FR-5: Highlight Creation**
- After entering selection mode, user can drag to extend selection
- Selection triggers epub.js `selected` event
- HighlightMenu appears with color options
- Creating highlight exits selection mode

### Technical Requirements

**TR-1: Touch Event Enhancement**
- Add `touchmove` listener to detect movement during hold
- Track touch start time, position, and movement delta
- Use timer to detect 600ms threshold
- Communicate to React component via callback

**TR-2: State Management**
- Add `selectionMode` boolean state in `ReaderView.tsx`
- Pass state to `TapZones` component as prop
- Provide callback for touch handler to update state
- Use refs for cross-context communication (iframe ↔ React)

**TR-3: CSS Conditional Application**
- Use template literal to conditionally apply `select-none`
- Test that parent CSS toggle affects iframe content selection
- If parent CSS doesn't work, inject styles into iframe document

**TR-4: Constants and Configuration**
- Add `longPressThreshold: 600` to `UI_CONSTANTS`
- Add `longPressMovementThreshold: 10` to `UI_CONSTANTS`
- Add `selectionModeTimeout: 30000` to `UI_CONSTANTS`
- Use constants consistently across implementation

**TR-5: Hook Interface Extension**
- Extend `UseEpubReaderProps` to accept `onLongPress` callback
- Return selection mode ref for conflict resolution
- Maintain backward compatibility with existing code

### Out of Scope

- Visual indicator/banner for selection mode (rely on native selection handles)
- Configurable long press threshold via settings UI
- Double-tap alternative gesture
- Pressure-sensitive detection (not available in web)
- Desktop implementation changes (focus on mobile)
- Haptic feedback on long press detection

## Architecture & Design

### Component Architecture

```
ReaderView (state owner)
  ├─ selectionMode: boolean state
  ├─ useEpubReader({ onLongPress: callback })
  │   └─ Touch handlers (inside iframe)
  │       ├─ touchstart: start timer, record position
  │       ├─ touchmove: check movement, cancel if > 10px
  │       └─ touchend: check swipe vs tap, fire onLongPress if hold
  └─ TapZones({ selectionMode, onSelectionModeChange })
      └─ Conditional CSS: selectionMode ? '' : 'select-none'
```

### Data Flow Diagram

```
User taps and holds text
  ↓
touchstart (iframe) → start 600ms timer
  ↓
[If touchmove > 10px: cancel timer]
  ↓
Timer completes (600ms) → onLongPress() callback
  ↓
ReaderView.setSelectionMode(true)
  ↓
TapZones re-renders with selectionMode=true
  ↓
CSS removes select-none → text selection enabled
  ↓
User drags selection handles (native browser)
  ↓
User releases → selection finalized
  ↓
epub.js fires 'selected' event
  ↓
useHighlights.handleSelected() → HighlightMenu appears
  ↓
User picks color → createHighlight()
  ↓
setSelectionMode(false) → exit selection mode
```

### Gesture Decision Tree

```
Touch Event Sequence
  ├─ Movement > 50px horizontal + Duration < 500ms?
  │   YES → SWIPE: Navigate page (highest priority)
  │
  ├─ Duration > 600ms + Movement < 10px?
  │   YES → LONG PRESS: Enter selection mode (medium priority)
  │
  ├─ Duration < 300ms + Movement < 10px?
  │   YES → TAP: Trigger tap zone (lowest priority)
  │
  └─ ELSE: Ignore (ambiguous gesture)
```

### State Machine

```
States:
  - NORMAL: selection mode off, tap zones active, swipe active
  - SELECTION: selection mode on, tap zones disabled, swipe disabled
  - SELECTING: user actively dragging selection handles (transient)

Transitions:
  NORMAL → SELECTION: Long press detected (600ms hold)
  SELECTION → SELECTING: User starts dragging (native browser)
  SELECTING → SELECTION: User releases, HighlightMenu appears
  SELECTION → NORMAL: Highlight created, menu closed, timeout, or navigation
```

## Implementation Phases

### Phase 1: Constants, Types, and Touch Handler Enhancement

**Goal**: Add long press detection to existing touch event infrastructure without breaking swipe navigation.

**Prerequisites**: None

**Files to Modify**:
1. `/Users/seankim/dev/reader/lib/constants.ts`
2. `/Users/seankim/dev/reader/hooks/useEpubReader.ts`

**Changes**:

#### 1.1 Add Constants (`lib/constants.ts`)

```typescript
// UI behavior constants
export const UI_CONSTANTS = {
  controlsAutoHideDelay: 3000, // milliseconds - how long to wait before hiding controls
  longPressThreshold: 600,      // milliseconds - tap + hold duration for selection mode
  longPressMovementThreshold: 10, // pixels - max movement allowed for long press
  selectionModeTimeout: 30000,  // milliseconds - auto-exit selection mode after inactivity
} as const;
```

**Location**: After line 44

#### 1.2 Extend Hook Interface (`hooks/useEpubReader.ts`)

```typescript
interface UseEpubReaderProps {
  bookBlob: Blob | null;
  containerRef: React.RefObject<HTMLDivElement>;
  onLocationChange?: (cfi: string, percentage: number) => void;
  onLongPress?: () => void;  // NEW: Callback when long press detected
}

export function useEpubReader({
  bookBlob,
  containerRef,
  onLocationChange,
  onLongPress,  // NEW
}: UseEpubReaderProps) {
```

**Location**: Lines 8-18

#### 1.3 Add Long Press Detection to Touch Handlers (`hooks/useEpubReader.ts`)

Replace the touch handler registration block (lines 77-139) with:

```typescript
// Register swipe handlers and long press detection via epub.js hooks API
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let longPressTimer: NodeJS.Timeout | null = null;
const selectionModeActiveRef = { current: false }; // Shared flag for swipe detection

newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  // Inject custom font @font-face if available
  if (fontType === 'custom' && customFont) {
    // ... existing font injection code (lines 86-110) ...
  }

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();

    // Start long press timer
    longPressTimer = setTimeout(() => {
      const deltaX = e.touches[0]?.clientX - touchStartX || 0;
      const deltaY = e.touches[0]?.clientY - touchStartY || 0;
      const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if finger hasn't moved significantly
      if (movement < UI_CONSTANTS.longPressMovementThreshold) {
        // Long press detected
        selectionModeActiveRef.current = true;
        onLongPress?.();
        console.log('[useEpubReader] Long press detected, entering selection mode');
      }
    }, UI_CONSTANTS.longPressThreshold);
  };

  const handleTouchMove = (e: TouchEvent) => {
    // Cancel long press timer if user moves finger significantly
    if (!longPressTimer) return;

    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;
    const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (movement > UI_CONSTANTS.longPressMovementThreshold) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      console.log('[useEpubReader] Touch moved, long press cancelled');
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    // Clear long press timer if still running
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // Don't process swipes if in selection mode
    if (selectionModeActiveRef.current) {
      console.log('[useEpubReader] In selection mode, skipping swipe detection');
      return;
    }

    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const duration = Date.now() - touchStartTime;

    // Only process as swipe if significant horizontal movement
    // PRIORITY: Swipe takes precedence over long press for fast gestures
    if (Math.abs(deltaX) > 50 && duration < 500 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      // Valid swipe - prevent click and navigate
      e.preventDefault();
      e.stopPropagation();
      if (deltaX > 0) {
        newRendition.prev();
      } else {
        newRendition.next();
      }
      console.log('[useEpubReader] Swipe detected:', deltaX > 0 ? 'previous' : 'next');
    }
    // Otherwise let the event propagate for tap zone handling
  };

  const handleTouchCancel = (e: TouchEvent) => {
    // Clean up timer on touch cancel (e.g., system interrupt)
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  doc.addEventListener('touchstart', handleTouchStart, { passive: true });
  doc.addEventListener('touchmove', handleTouchMove, { passive: true });
  doc.addEventListener('touchend', handleTouchEnd, { passive: false });
  doc.addEventListener('touchcancel', handleTouchCancel, { passive: true });
});
```

**Import Addition** (top of file, line 6):
```typescript
import { THEME_COLORS, UI_CONSTANTS } from '@/lib/constants';
```

**Success Criteria**:
- Long press timer starts on touchstart
- Timer cancelled if finger moves >10px within 600ms
- Timer cancelled on touchend before 600ms
- `onLongPress` callback fires after 600ms if stationary
- Swipe detection still works for fast horizontal movements
- Console logs confirm gesture detection

**Testing**:
```bash
# Manual test on mobile device
1. Tap and hold text for 700ms without moving
   → Console shows "Long press detected, entering selection mode"

2. Tap and hold, then move finger 15px within 500ms
   → Console shows "Touch moved, long press cancelled"

3. Quick swipe left/right
   → Page navigates, console shows "Swipe detected"

4. Quick tap (< 300ms)
   → Tap zone activates (no long press or swipe)
```

**Time Estimate**: 3-4 hours (including testing and debugging)

---

### Phase 2: Selection Mode State Management

**Goal**: Add state management for selection mode and connect touch handler callback to React component state.

**Prerequisites**: Phase 1 complete

**Files to Modify**:
1. `/Users/seankim/dev/reader/components/reader/ReaderView.tsx`
2. `/Users/seankim/dev/reader/components/reader/TapZones.tsx`

**Changes**:

#### 2.1 Add Selection Mode State (`ReaderView.tsx`)

Add state declaration after existing modal states (after line 52):

```typescript
const [showChapterList, setShowChapterList] = useState(false);
const [selectionMode, setSelectionMode] = useState(false); // NEW: Selection mode state
const [currentAudioChapter, setCurrentAudioChapter] = useState<Chapter | null>(null);
```

#### 2.2 Connect Long Press Callback (`ReaderView.tsx`)

Modify `useEpubReader` hook call (line 62-82) to include `onLongPress`:

```typescript
const { book, rendition, loading, currentLocation, progress, totalLocations, nextPage, prevPage, goToLocation } =
  useEpubReader({
    bookBlob,
    containerRef,
    onLocationChange: async (cfi, percentage) => {
      // ... existing logic ...
    },
    onLongPress: () => {
      console.log('[ReaderView] Long press detected, entering selection mode');
      setSelectionMode(true);
    },
  });
```

#### 2.3 Pass State to TapZones (`ReaderView.tsx`)

Modify TapZones component usage (line 671-673):

```typescript
<TapZones
  onPrevPage={prevPage}
  onNextPage={nextPage}
  onToggleControls={toggleControls}
  selectionMode={selectionMode}
  onSelectionModeChange={setSelectionMode}
>
  <div ref={containerRef} className="epub-container h-full w-full" />
</TapZones>
```

#### 2.4 Update TapZones Interface (`TapZones.tsx`)

Modify props interface (lines 6-11):

```typescript
interface TapZonesProps {
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleControls: () => void;
  children: React.ReactNode;
  selectionMode: boolean;              // NEW
  onSelectionModeChange: (enabled: boolean) => void; // NEW
}

export default function TapZones({
  onPrevPage,
  onNextPage,
  onToggleControls,
  children,
  selectionMode,              // NEW
  onSelectionModeChange,      // NEW
}: TapZonesProps) {
```

**Success Criteria**:
- `selectionMode` state initializes to `false`
- Long press callback updates state to `true`
- TapZones component receives state as prop
- No TypeScript errors
- State updates trigger React re-render

**Testing**:
```bash
# Manual test with React DevTools
1. Open React DevTools, find ReaderView component
2. Verify selectionMode state exists and is false
3. Perform long press on mobile
4. Verify selectionMode state changes to true
5. Verify TapZones component receives selectionMode=true prop
```

**Time Estimate**: 2-3 hours (including prop threading and verification)

---

### Phase 3: CSS Toggling and Gesture Coordination

**Goal**: Conditionally remove `select-none` CSS during selection mode and disable tap zones.

**Prerequisites**: Phase 2 complete

**Files to Modify**:
1. `/Users/seankim/dev/reader/components/reader/TapZones.tsx`

**Changes**:

#### 3.1 Conditional CSS Application (`TapZones.tsx`)

Modify the wrapper div (lines 66-74):

```typescript
return (
  <div
    onClick={handleClick}
    className={`w-full h-full cursor-pointer ${selectionMode ? '' : 'select-none'}`}
    role="button"
    tabIndex={0}
    aria-label={
      selectionMode
        ? "Selection mode - select text to highlight"
        : "Reading area - swipe or click left to go back, right to go forward, center to show menu"
    }
  >
    {children}
  </div>
);
```

#### 3.2 Disable Tap Zones During Selection Mode (`TapZones.tsx`)

Modify `handleClick` function (lines 19-38):

```typescript
const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
  // Ignore clicks when in selection mode
  if (selectionMode) {
    console.log('[TapZones] Click ignored - selection mode active');
    return;
  }

  const { clientX, currentTarget } = event;
  const { left, width } = currentTarget.getBoundingClientRect();
  const clickX = clientX - left;
  const percentage = clickX / width;

  // Stop event from bubbling to prevent double-handling
  event.stopPropagation();

  if (percentage < TAP_ZONES.left) {
    // Left zone - previous page
    onPrevPage();
  } else if (percentage > 1 - TAP_ZONES.right) {
    // Right zone - next page
    onNextPage();
  } else {
    // Center zone - toggle controls
    onToggleControls();
  }
};
```

**Success Criteria**:
- When `selectionMode=false`: className includes `select-none`
- When `selectionMode=true`: className does NOT include `select-none`
- Click handler returns early when `selectionMode=true`
- aria-label updates to reflect current mode
- Text selection becomes possible on mobile when mode active

**Testing**:
```bash
# Manual test on mobile device
1. Inspect TapZones div in browser DevTools
   → Verify className="w-full h-full cursor-pointer select-none"

2. Perform long press to enter selection mode
   → Verify className="w-full h-full cursor-pointer " (no select-none)

3. Try to select text by tapping and dragging
   → Verify native selection handles appear

4. While in selection mode, tap left edge
   → Verify page does NOT navigate (click ignored)

5. Exit selection mode (next phase will implement this)
   → Verify className includes select-none again
```

**Time Estimate**: 2-3 hours (including CSS testing and mobile device verification)

---

### Phase 4: Auto-Exit Logic and Integration Testing

**Goal**: Implement all exit conditions for selection mode and ensure clean integration with highlighting system.

**Prerequisites**: Phase 3 complete

**Files to Modify**:
1. `/Users/seankim/dev/reader/components/reader/ReaderView.tsx`

**Changes**:

#### 4.1 Exit on Highlight Creation (`ReaderView.tsx`)

Modify highlight creation handler (around line 553):

```typescript
onHighlight={(color: HighlightColor) => {
  createHighlight(color);
  setSelectionMode(false); // NEW: Exit selection mode
  console.log('[ReaderView] Highlight created, exiting selection mode');
}}
```

#### 4.2 Exit on Menu Close (`ReaderView.tsx`)

Modify menu close handler (around line 562):

```typescript
onClose={() => {
  setCurrentSelection(null);
  setSelectionMode(false); // NEW: Exit selection mode
  console.log('[ReaderView] Highlight menu closed, exiting selection mode');
}}
```

#### 4.3 Exit on Page Navigation (`ReaderView.tsx`)

Add useEffect after highlight-related effects (around line 122):

```typescript
// Exit selection mode when user navigates to different page
useEffect(() => {
  if (selectionMode) {
    setSelectionMode(false);
    console.log('[ReaderView] Page navigation detected, exiting selection mode');
  }
}, [currentLocation]); // Dependency: currentLocation changes on page turn
```

#### 4.4 Auto-Exit After Timeout (`ReaderView.tsx`)

Add useEffect for timeout after page navigation effect:

```typescript
// Auto-exit selection mode after inactivity timeout
useEffect(() => {
  if (!selectionMode) return;

  const timeout = setTimeout(() => {
    setSelectionMode(false);
    console.log('[ReaderView] Selection mode timeout, auto-exiting');
  }, UI_CONSTANTS.selectionModeTimeout);

  return () => clearTimeout(timeout);
}, [selectionMode]);
```

**Import Addition** (top of ReaderView.tsx, around line 19):
```typescript
import { UI_CONSTANTS } from '@/lib/constants';
```

#### 4.5 Reset Selection Mode Flag in Touch Handler (`hooks/useEpubReader.ts`)

To ensure the touch handler knows when selection mode has been exited, we need to expose a way to reset the flag. Modify the `useEpubReader` hook to accept a ref:

**Option A: Simple callback approach** (recommended for simplicity)

Add callback parameter to reset selection mode active flag:

```typescript
interface UseEpubReaderProps {
  bookBlob: Blob | null;
  containerRef: React.RefObject<HTMLDivElement>;
  onLocationChange?: (cfi: string, percentage: number) => void;
  onLongPress?: () => void;
  onSelectionModeChange?: (active: boolean) => void; // NEW: Notify parent of selection mode state
}
```

Then in the touch handler registration, expose a way to reset:

```typescript
// After long press detected
if (movement < UI_CONSTANTS.longPressMovementThreshold) {
  selectionModeActiveRef.current = true;
  onLongPress?.();
  onSelectionModeChange?.(true); // NEW
  console.log('[useEpubReader] Long press detected, entering selection mode');
}
```

And in ReaderView, when exiting selection mode:

```typescript
const { book, rendition, loading, currentLocation, progress, totalLocations, nextPage, prevPage, goToLocation } =
  useEpubReader({
    bookBlob,
    containerRef,
    onLocationChange: async (cfi, percentage) => { /* ... */ },
    onLongPress: () => {
      setSelectionMode(true);
    },
    onSelectionModeChange: (active) => {
      // Sync with parent state if needed
      if (!active && selectionMode) {
        setSelectionMode(false);
      }
    },
  });
```

**Actually**, let's simplify further. The touch handler's `selectionModeActiveRef` should be reset whenever React's `selectionMode` state becomes false. Add this effect:

```typescript
// Sync selection mode state to touch handler flag
// This effect runs in ReaderView.tsx
useEffect(() => {
  if (!selectionMode) {
    // Reset the flag in useEpubReader's touch handlers
    // This is a bit hacky, but works because the ref is in closure scope
    // Better approach: expose resetSelectionMode() from useEpubReader
  }
}, [selectionMode]);
```

Actually, the cleanest approach is to make the touch handler check React state. Let me revise:

**Option B: Use shared ref** (cleanest approach)

In `ReaderView.tsx`, create a ref and pass it down:

```typescript
const selectionModeRef = useRef(false);

// Update ref whenever state changes
useEffect(() => {
  selectionModeRef.current = selectionMode;
}, [selectionMode]);

// Pass ref to useEpubReader
const { book, rendition, /* ... */ } = useEpubReader({
  // ... other props
  selectionModeRef, // NEW: shared ref
});
```

Then in `useEpubReader.ts`, use the ref:

```typescript
interface UseEpubReaderProps {
  bookBlob: Blob | null;
  containerRef: React.RefObject<HTMLDivElement>;
  onLocationChange?: (cfi: string, percentage: number) => void;
  onLongPress?: () => void;
  selectionModeRef?: React.MutableRefObject<boolean>; // NEW
}

// In touch handler:
const handleTouchEnd = (e: TouchEvent) => {
  // ...

  // Don't process swipes if in selection mode (check shared ref)
  if (selectionModeRef?.current) {
    console.log('[useEpubReader] In selection mode, skipping swipe detection');
    return;
  }

  // ... swipe detection
};
```

And when long press is detected:

```typescript
if (movement < UI_CONSTANTS.longPressMovementThreshold) {
  if (selectionModeRef) {
    selectionModeRef.current = true;
  }
  onLongPress?.();
  console.log('[useEpubReader] Long press detected, entering selection mode');
}
```

This keeps the flag in sync automatically.

**Success Criteria**:
- Creating highlight exits selection mode
- Closing highlight menu exits selection mode
- Navigating to next/previous page exits selection mode
- 30 seconds of inactivity exits selection mode
- After exiting, tap zones work normally again
- After exiting, `select-none` CSS re-applied
- Swipe navigation re-enabled after exit
- No stuck states or infinite loops

**Testing Checklist**:

```bash
# Test Case 1: Normal Highlight Flow
1. Long press text (600ms) → Enter selection mode
2. Drag to extend selection → Native handles appear
3. Release → HighlightMenu appears
4. Tap yellow color → Highlight created
5. Verify: Selection mode exited, tap zones work

# Test Case 2: Menu Close Without Highlight
1. Long press text → Enter selection mode
2. Drag selection → Menu appears
3. Tap outside menu or close button
4. Verify: Selection mode exited, tap zones work

# Test Case 3: Page Navigation During Selection
1. Long press text → Enter selection mode
2. Before making selection, swipe to next page
3. Verify: Selection mode exited, page navigates

# Test Case 4: Timeout
1. Long press text → Enter selection mode
2. Wait 30+ seconds without action
3. Verify: Selection mode auto-exits

# Test Case 5: Gesture Priority
1. Quick swipe left/right → Page navigates (no selection mode)
2. Slow movement (>10px within 600ms) → Long press cancelled
3. Quick tap left edge → Previous page (no selection mode)
4. Long press (600ms stationary) → Selection mode entered

# Test Case 6: Swipe Disabled During Selection
1. Long press → Enter selection mode
2. Attempt to swipe → Should not navigate (mode active)
3. Exit selection mode
4. Swipe → Page navigates normally

# Test Case 7: Tap Zones Disabled During Selection
1. Long press → Enter selection mode
2. Tap center of screen → Controls should NOT toggle
3. Tap left edge → Should NOT navigate to previous page
4. Exit selection mode
5. Tap center → Controls toggle normally

# Test Case 8: Multiple Selection Attempts
1. Long press → Enter selection mode
2. Make selection → Menu appears
3. Close menu → Exit selection mode
4. Long press again → Enter selection mode (repeatable)

# Test Case 9: Edge Case - Rapid Gestures
1. Perform rapid sequence: tap, long press, swipe
2. Verify: Each gesture handled correctly
3. Verify: No stuck states or mode conflicts

# Test Case 10: Cross-Device Testing
- iOS Safari (primary target)
- Android Chrome
- iPad (larger touch target)
- iPhone (smaller screen)
```

**Integration Testing**:

```typescript
// Add temporary debug logging to verify state transitions
// In ReaderView.tsx:

useEffect(() => {
  console.log('[ReaderView] Selection mode state changed:', selectionMode);
}, [selectionMode]);

useEffect(() => {
  console.log('[ReaderView] Current location changed:', currentLocation);
}, [currentLocation]);

useEffect(() => {
  console.log('[ReaderView] Current selection:', currentSelection);
}, [currentSelection]);
```

**Time Estimate**: 3-4 hours (including comprehensive testing and debugging)

---

## Testing Strategy

### Unit Testing (Manual)

**Phase 1 Tests**:
- Touch handler timing accuracy
- Movement threshold detection
- Timer cancellation on touchmove/touchend
- Callback firing on long press completion
- Swipe detection still functional

**Phase 2 Tests**:
- State initialization
- State update on callback
- Prop passing to child components
- Re-render triggered by state change

**Phase 3 Tests**:
- CSS class conditional application
- Text selection enabled/disabled
- Tap zone click handling enabled/disabled
- Aria-label updates

**Phase 4 Tests**:
- Exit on highlight creation
- Exit on menu close
- Exit on page navigation
- Exit on timeout
- Ref synchronization

### Integration Testing

**Scenario 1: Happy Path**
```
User Story: As a mobile user, I want to highlight a full passage

Steps:
1. Navigate to book reading view on mobile
2. Tap and hold on word "beginning" for 600ms
3. Verify: Selection mode entered (check console log)
4. Drag finger to word "end" to extend selection
5. Verify: Native selection handles visible
6. Release touch
7. Verify: HighlightMenu appears with selected text
8. Tap "Yellow" color button
9. Verify: Highlight created with yellow color
10. Verify: Selection mode exited (tap zones work)
11. Tap left edge of screen
12. Verify: Previous page loads (tap zones functional)
```

**Scenario 2: Gesture Conflicts**
```
User Story: Swipe navigation should still work normally

Steps:
1. Quick swipe right → Next page loads
2. Quick swipe left → Previous page loads
3. Long press text → Selection mode entered
4. Attempt to swipe while in selection mode → No navigation (expected)
5. Close selection mode
6. Quick swipe → Navigation works again
```

**Scenario 3: Auto-Exit Conditions**
```
User Story: Selection mode should exit automatically in appropriate scenarios

Steps:
1. Long press → Selection mode entered
2. Navigate to next page via keyboard (Arrow Right)
3. Verify: Selection mode exited
4. Long press → Selection mode entered
5. Wait 30 seconds without action
6. Verify: Selection mode auto-exited
```

### Device Testing Matrix

| Device | OS | Browser | Priority | Test Coverage |
|--------|-----|---------|----------|---------------|
| iPhone 14 | iOS 17 | Safari | High | Full suite |
| iPhone SE | iOS 16 | Safari | Medium | Smoke tests |
| iPad Pro | iOS 17 | Safari | Medium | Smoke tests |
| Pixel 7 | Android 13 | Chrome | High | Full suite |
| Samsung Galaxy | Android 12 | Chrome | Low | Smoke tests |

### Performance Testing

**Metrics to Monitor**:
- Touch event latency: < 16ms (one frame)
- State update to render: < 32ms (two frames)
- CSS application: Immediate (next frame)
- Memory leaks: No timer leaks after unmount

**Tools**:
- Chrome DevTools Performance tab
- React DevTools Profiler
- Mobile device remote debugging

### Regression Testing

**Existing Features to Verify**:
- ✓ Swipe navigation still works
- ✓ Tap zones (left/right/center) still work
- ✓ Existing highlights render correctly
- ✓ HighlightMenu appears on selection
- ✓ Highlight creation saves to IndexedDB
- ✓ Keyboard navigation unchanged
- ✓ Settings drawer opens/closes
- ✓ Chapter list navigation works

## Deployment & Migration

### Deployment Steps

1. **Merge to Main Branch**:
   ```bash
   cd /Users/seankim/dev/reader-mobile-highlighting-worktree
   git add .
   git commit -m "feat: Add mobile text selection via long press gesture

   - Implement tap-and-hold (600ms) to enter selection mode
   - Conditionally disable select-none CSS during selection mode
   - Add gesture priority: swipe > long press > tap
   - Auto-exit on highlight creation, navigation, or timeout
   - Maintain tap zone and swipe navigation compatibility

   Fixes mobile highlighting issue where only single words could be selected."

   git push origin feature/mobile-highlighting
   ```

2. **Create Pull Request**:
   - Title: "feat: Enable mobile text selection via long press gesture"
   - Description: Link to this plan and research documents
   - Request review from team
   - Include testing checklist in PR description

3. **Deploy to Production**:
   - No database migrations needed
   - No environment variable changes
   - No breaking API changes
   - Safe to deploy directly after PR approval

### Rollback Plan

If critical issues discovered post-deployment:

1. **Immediate Rollback** (if selection completely broken):
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Feature Flag Approach** (if partial issues):
   - Add environment variable: `ENABLE_MOBILE_SELECTION=true`
   - Wrap selection mode logic in flag check
   - Disable via environment variable without code change

3. **Hotfix Branch**:
   - Create `hotfix/mobile-selection-fix` branch
   - Apply minimal fix
   - Fast-track review and deploy

### Migration Considerations

**None Required**: This is a pure frontend enhancement with no:
- Database schema changes
- Persistent state changes
- API changes
- Breaking changes to existing functionality

## Risk Assessment

### Technical Risks

**Risk 1: CSS Inheritance into iframe**
- **Severity**: High
- **Probability**: Medium
- **Description**: Parent div `select-none` may not actually block selection inside iframe due to separate document context
- **Mitigation**: Phase 3 testing will reveal if CSS toggle works. If not, fall back to injecting styles directly into iframe document via `rendition.hooks.content.register()`
- **Contingency**: Add style injection code:
  ```typescript
  if (selectionMode) {
    doc.body.style.userSelect = 'text';
    doc.body.style.webkitUserSelect = 'text';
  } else {
    doc.body.style.userSelect = 'none';
    doc.body.style.webkitUserSelect = 'none';
  }
  ```

**Risk 2: Gesture Conflict - Selection Drag Interpreted as Swipe**
- **Severity**: Medium
- **Probability**: Low
- **Description**: User extending selection by dragging might trigger swipe navigation
- **Mitigation**: Selection mode disables swipe detection. Native selection handle drags may not fire touch events (browser handles them)
- **Contingency**: Increase swipe movement threshold from 50px to 75px to reduce false positives

**Risk 3: Timer Memory Leak**
- **Severity**: Low
- **Probability**: Low
- **Description**: Long press timer not cleaned up on component unmount
- **Mitigation**: `touchcancel` handler clears timer. Hook cleanup runs on unmount.
- **Contingency**: Add explicit cleanup in hook return:
  ```typescript
  return () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    if (newRendition) {
      newRendition.destroy();
    }
  };
  ```

**Risk 4: State Synchronization Between iframe and React**
- **Severity**: Medium
- **Probability**: Medium
- **Description**: Touch handlers in iframe closure and React state may desync
- **Mitigation**: Use shared ref (`selectionModeRef`) that both contexts can access
- **Contingency**: Add debug logging to detect desyncs, reset state on page navigation as safety

**Risk 5: Mobile Browser Compatibility**
- **Severity**: Medium
- **Probability**: Low
- **Description**: Different mobile browsers may handle touch events or selection differently
- **Mitigation**: Test on iOS Safari and Android Chrome (covers 95% of mobile users)
- **Contingency**: Add browser-specific handling if needed, or progressive enhancement (feature works on supported browsers, graceful degradation on others)

### UX Risks

**Risk 6: Accidental Long Press During Reading**
- **Severity**: Low
- **Probability**: Medium
- **Description**: User resting finger while reading might trigger selection mode
- **Mitigation**: 600ms threshold is long enough to avoid most accidents. Movement threshold (10px) cancels detection if user's hand shakes.
- **Contingency**: Increase threshold to 700-800ms if too many accidental activations reported

**Risk 7: Selection Mode Feels "Stuck"**
- **Severity**: Medium
- **Probability**: Low
- **Description**: User enters selection mode but doesn't know how to exit
- **Mitigation**: Multiple auto-exit conditions (timeout, navigation, menu close)
- **Contingency**: Add visual indicator (banner) showing "Selection Mode - Tap text to select" with "Exit" button

**Risk 8: Discovery Problem - Users Don't Know About Long Press**
- **Severity**: Low
- **Probability**: High
- **Description**: Users may not discover the long press gesture naturally
- **Mitigation**: This is a standard mobile OS pattern (iOS, Android). Users likely already familiar.
- **Contingency**: Add one-time tooltip on first book open: "Tip: Long press text to highlight passages"

### Timeline Risks

**Risk 9: Mobile Device Testing Delays**
- **Severity**: Low
- **Probability**: Medium
- **Description**: Access to physical iOS/Android devices for testing
- **Mitigation**: Use browser DevTools device emulation for initial testing. Borrow devices from team or use BrowserStack.
- **Contingency**: Deploy to staging environment accessible via mobile devices

**Risk 10: Unexpected Edge Cases**
- **Severity**: Medium
- **Probability**: Medium
- **Description**: Real-world usage reveals edge cases not covered in testing
- **Mitigation**: Comprehensive testing checklist (10 test cases). Staged rollout.
- **Contingency**: Feature flag to disable if critical issues found. Hotfix branch for rapid fixes.

## Performance Considerations

### Touch Event Performance

**Current State**:
- Touch handlers registered per page render (via epub.js hooks)
- Handlers run in iframe context (separate from React)
- `passive: true` on touchstart/touchmove (no scrolling interference)
- `passive: false` on touchend (allows preventDefault for swipes)

**Performance Impact of Changes**:
- **Adding touchmove listener**: Minimal impact (passive mode, no blocking)
- **Timer overhead**: Single setTimeout per touchstart (< 1ms overhead)
- **State update on long press**: Triggers React re-render of ReaderView and TapZones (< 16ms for small component tree)

**Optimization Opportunities**:
- None needed at this scale. Touch events are lightweight, timer is single-threaded, and state updates are infrequent.

### CSS Re-rendering

**CSS Toggle Impact**:
- Changing className triggers DOM update in React
- Browser re-calculates styles (< 1ms for single element)
- No reflow/repaint of iframe content (iframe isolation)

**Measurement**:
```javascript
// Add temporary performance measurement
const start = performance.now();
setSelectionMode(true);
requestAnimationFrame(() => {
  const end = performance.now();
  console.log(`Selection mode state update took ${end - start}ms`);
});
```

Expected: < 16ms (one frame)

### Memory Considerations

**Memory Usage**:
- Selection mode state: 1 boolean (negligible)
- Long press timer: 1 timeout ID per touch (cleared on end)
- Shared ref: 1 boolean reference (negligible)

**Potential Leaks**:
- Timer not cleared on unmount → **Mitigated by cleanup functions**
- Event listeners not removed → **Mitigated by rendition.destroy()**

**Monitoring**:
- Chrome DevTools Memory Profiler
- Check for timer leaks after 100 page turns
- Verify event listeners cleaned up on unmount

## Security Considerations

**No Security Impact**: This feature is pure UI/UX enhancement with no:
- User authentication changes
- Data storage changes (highlights already stored)
- Network requests
- Third-party code execution
- Access control changes

**Text Selection Security**:
- Native browser text selection is sandboxed within epub.js iframe
- No clipboard access or data exfiltration
- Selection text used only for highlighting (already implemented)

## Documentation Requirements

### Code Documentation

**Inline Comments** (added during implementation):
```typescript
// Phase 1: Touch handler enhancement
// Long press detection: 600ms hold without >10px movement enters selection mode

// Phase 2: State management
// selectionMode: boolean - Controls CSS toggle and tap zone behavior

// Phase 3: CSS toggling
// Conditional select-none: Disabled during selection mode to allow text selection

// Phase 4: Auto-exit logic
// Exit conditions: highlight creation, menu close, navigation, timeout
```

**JSDoc** (for exported interfaces):
```typescript
/**
 * Touch event handler hook with long press detection.
 *
 * @param onLongPress - Callback fired when user holds touch for 600ms without movement
 * @param selectionModeRef - Shared ref to track selection mode state (disables swipe when true)
 * @returns Rendition controls and navigation functions
 */
```

### User-Facing Documentation

**Help Article** (to be created post-launch):
```markdown
# How to Highlight Text on Mobile

## Creating Highlights

1. **Long press** the text where you want to start highlighting (hold for about half a second)
2. **Drag** your finger to extend the selection to the end of the passage
3. **Release** to see the highlight menu
4. **Tap** a color to create the highlight

## Tips

- **Quick taps** still navigate pages (left/right edges)
- **Swipe** still turns pages as normal
- **Long press** is only needed to start selecting text
- Selection mode exits automatically after highlighting or navigating

## Troubleshooting

- If long press doesn't work, make sure you're holding for at least half a second
- If selection mode feels stuck, navigate to another page to reset
- On older devices, try tapping more deliberately
```

### Developer Documentation

**Implementation Guide** (this plan serves as primary documentation):
- Architecture diagrams included
- Code examples for each phase
- Testing checklist
- Risk mitigation strategies

**Future Maintainers**:
- Constants defined in `lib/constants.ts` (UI_CONSTANTS)
- Touch handlers in `hooks/useEpubReader.ts` (lines 77-139)
- State management in `ReaderView.tsx` (selectionMode state)
- CSS toggling in `TapZones.tsx` (conditional className)

## Success Metrics

### Quantitative Metrics

**Pre-Launch Baselines**:
- Highlight creation rate on mobile: Currently low (single-word only)
- Average highlight length: ~1-5 words (limited by current issue)
- Highlight abandonment rate: High (users give up on multi-word selection)

**Post-Launch Targets**:
- Highlight creation rate increase: +50% (more users can highlight successfully)
- Average highlight length increase: 10-30 words (full passages)
- Highlight abandonment rate decrease: -40% (fewer frustrated users)

**Technical Metrics**:
- Long press detection accuracy: > 95% (few false positives/negatives)
- Gesture conflict rate: < 2% (swipe/tap/hold correctly distinguished)
- Selection mode stuck states: 0 (all auto-exit conditions work)
- Mobile device compatibility: 100% (iOS Safari, Android Chrome)

### Qualitative Metrics

**User Feedback Signals**:
- User reports of highlighting issues decrease
- Positive feedback on mobile highlighting UX
- No complaints about gesture conflicts or stuck states

**Developer Experience**:
- Code maintainability: High (follows existing patterns)
- Testing coverage: Comprehensive (10 test scenarios)
- Bug reports post-launch: < 3 (mature implementation)

### Monitoring & Analytics

**Events to Track** (future Phase 5 - Analytics):
```typescript
// Track selection mode activations
analytics.track('selection_mode_entered', {
  device: 'mobile',
  trigger: 'long_press',
  timestamp: Date.now(),
});

// Track selection mode exits
analytics.track('selection_mode_exited', {
  reason: 'highlight_created' | 'menu_closed' | 'navigation' | 'timeout',
  duration_ms: Date.now() - entryTime,
});

// Track gesture conflicts (if any)
analytics.track('gesture_conflict_detected', {
  attempted_gesture: 'swipe' | 'tap' | 'long_press',
  selection_mode_active: boolean,
});
```

**Dashboard Metrics**:
- Daily selection mode activations
- Average session duration in selection mode
- Exit reason distribution (pie chart)
- Gesture conflict rate (line graph)

## Future Enhancements

### Considered But Deferred

**Enhancement 1: Visual Selection Mode Indicator**
- **Description**: Show banner/chip indicating "Selection Mode Active" with exit button
- **Benefit**: Clearer user feedback, explicit exit control
- **Deferred Reason**: Native selection handles provide sufficient feedback. Can add later if user testing shows confusion.

**Enhancement 2: Configurable Long Press Threshold**
- **Description**: Settings UI to adjust long press duration (400-800ms range)
- **Benefit**: Personalization for users with different motor skills
- **Deferred Reason**: 600ms is researched default. Premature optimization without user demand.

**Enhancement 3: Haptic Feedback on Long Press Detection**
- **Description**: Vibrate device briefly when selection mode entered
- **Benefit**: Tactile confirmation of mode entry
- **Deferred Reason**: Vibration API support varies. Not critical for MVP.

**Enhancement 4: Double-Tap Alternative Gesture**
- **Description**: Allow double-tap word to enter selection mode (like iOS default)
- **Benefit**: Familiar gesture for some users
- **Deferred Reason**: Double-tap conflicts with browser zoom. Long press is sufficient.

**Enhancement 5: Selection Mode Persistence Across Pages**
- **Description**: Keep selection mode active when navigating if user hasn't made selection yet
- **Benefit**: User could navigate to find end of passage to highlight
- **Deferred Reason**: Edge case. Most highlights are within single page. Adds complexity.

### Roadmap Integration

**Near-term** (Next 2-4 weeks):
- Phase 1-4 implementation (this plan)
- Mobile device testing
- Production deployment

**Mid-term** (Next 1-3 months):
- Monitor analytics and user feedback
- Address any edge cases discovered
- Consider visual indicator if users report confusion

**Long-term** (3-6 months):
- Evaluate configurable threshold if accessibility concerns raised
- Integrate with broader mobile UX improvements
- Cross-reference with highlighting analytics for feature success

## Appendix

### Research Documents

1. **Mobile Highlighting Issue** (`thoughts/research/2025-11-13-mobile-highlighting-issue-single-word-selection.md`):
   - Root cause analysis: CSS `select-none` blocks selection
   - Architecture documentation: TapZones, touch handlers, highlighting system
   - Historical context: epub.js iOS selection bug (resolved in iOS 12.2)

2. **Tap-and-Hold Detection** (`thoughts/research/2025-11-13-tap-hold-detection-for-mobile-selection-mode.md`):
   - Implementation approach: Touch event timing, state management
   - Timer patterns: useEffect with setTimeout cleanup
   - Gesture conflict resolution: Priority decision tree
   - Alternative approaches considered: Double-tap, dedicated button, pressure-sensitive

### Code References

**Primary Files**:
- `/Users/seankim/dev/reader/components/reader/TapZones.tsx` - CSS toggle, click handling
- `/Users/seankim/dev/reader/hooks/useEpubReader.ts` - Touch event detection
- `/Users/seankim/dev/reader/components/reader/ReaderView.tsx` - State management
- `/Users/seankim/dev/reader/hooks/useHighlights.ts` - Selection event handling
- `/Users/seankim/dev/reader/lib/constants.ts` - Configuration constants

**Related Files**:
- `/Users/seankim/dev/reader/components/reader/HighlightMenu.tsx` - Highlight color selection
- `/Users/seankim/dev/reader/components/reader/AiExplanation.tsx` - Timer pattern example
- `/Users/seankim/dev/reader/types/index.ts` - Highlight data structure

### Constants Reference

```typescript
// lib/constants.ts
export const UI_CONSTANTS = {
  controlsAutoHideDelay: 3000,      // ms - controls auto-hide
  longPressThreshold: 600,          // ms - tap + hold duration
  longPressMovementThreshold: 10,   // px - max movement allowed
  selectionModeTimeout: 30000,      // ms - auto-exit timeout
} as const;

export const TAP_ZONES = {
  left: 0.15,   // Left 15% = previous page
  right: 0.15,  // Right 15% = next page
  center: 0.70, // Center 70% = toggle controls
} as const;
```

### Glossary

- **CFI (Canonical Fragment Identifier)**: EPUB standard for identifying specific locations in book
- **Selection Mode**: UI state where text selection is enabled and tap zones are disabled
- **Long Press**: Touch gesture held for 600ms without significant movement
- **Tap Zone**: Invisible clickable regions (left 15%, right 15%, center 70%) for navigation
- **Swipe Gesture**: Fast horizontal touch movement (>50px in <500ms) for page turning
- **Rendition**: epub.js object representing rendered book view (iframe content)
- **HighlightMenu**: Popup menu showing color options after text selection

### Troubleshooting Common Issues

**Issue: Long press not detected**
- Check: Timer started on touchstart? (Console log)
- Check: Timer cancelled by touchmove? (Movement >10px)
- Check: `onLongPress` callback defined? (Hook props)
- Fix: Verify `UI_CONSTANTS.longPressThreshold` imported

**Issue: Text selection not working**
- Check: `selectionMode` state is true? (React DevTools)
- Check: CSS className updated? (Inspect element)
- Check: Is `select-none` removed? (Should be `className="w-full h-full cursor-pointer "`)
- Fix: If parent CSS doesn't affect iframe, inject styles into iframe document

**Issue: Tap zones still active during selection**
- Check: `handleClick` returns early when `selectionMode=true`?
- Check: Props passed correctly to TapZones?
- Fix: Verify conditional logic in `handleClick` function

**Issue: Selection mode stuck**
- Check: Auto-exit effects running? (Console logs)
- Check: Timeout set correctly? (30 seconds)
- Check: Navigation effect triggered? (currentLocation dependency)
- Fix: Manual escape hatch - reload page or navigate

**Issue: Swipe conflicts with selection**
- Check: Swipe detection skipped when `selectionMode=true`?
- Check: `selectionModeRef.current` synced with React state?
- Fix: Add ref synchronization useEffect

### Phase Completion Checklist

**Phase 1 Complete When**:
- [ ] Constants added to `lib/constants.ts`
- [ ] `UseEpubReaderProps` interface extended
- [ ] Touch handlers enhanced with long press timer
- [ ] `touchmove` listener cancels timer on movement
- [ ] `onLongPress` callback fires after 600ms
- [ ] Console logs confirm gesture detection
- [ ] Swipe navigation still works (no regression)
- [ ] Manual mobile testing passes

**Phase 2 Complete When**:
- [ ] `selectionMode` state added to ReaderView
- [ ] Long press callback updates state
- [ ] TapZones interface extended with new props
- [ ] Props passed from ReaderView to TapZones
- [ ] React DevTools shows state updates
- [ ] No TypeScript errors
- [ ] Component re-renders on state change

**Phase 3 Complete When**:
- [ ] CSS className conditionally applied
- [ ] `select-none` removed when `selectionMode=true`
- [ ] Text selection works on mobile device
- [ ] Tap zones disabled during selection mode
- [ ] Aria-label updates for accessibility
- [ ] Browser DevTools confirms CSS changes
- [ ] Native selection handles appear

**Phase 4 Complete When**:
- [ ] Highlight creation exits selection mode
- [ ] Menu close exits selection mode
- [ ] Page navigation exits selection mode
- [ ] Timeout (30s) exits selection mode
- [ ] Ref synchronization implemented
- [ ] All 10 test cases pass
- [ ] No stuck states observed
- [ ] Integration testing complete

### Pre-Deployment Checklist

**Code Quality**:
- [ ] All TypeScript errors resolved
- [ ] Console.log debug statements removed (or gated by DEBUG flag)
- [ ] Code follows existing style conventions
- [ ] Comments added for complex logic
- [ ] No hardcoded values (constants used)

**Testing**:
- [ ] Manual testing on iOS Safari completed
- [ ] Manual testing on Android Chrome completed
- [ ] All 10 test scenarios passed
- [ ] Regression tests passed (existing features work)
- [ ] Performance profiling done (< 16ms state updates)

**Documentation**:
- [ ] This plan document finalized
- [ ] Code comments added
- [ ] JSDoc for new interfaces
- [ ] PR description written with testing checklist
- [ ] Related research docs linked

**Deployment**:
- [ ] Branch merged to main
- [ ] Production build successful
- [ ] Staging environment tested
- [ ] Rollback plan documented
- [ ] Team notified of deployment

---

**Plan Status**: Draft
**Next Step**: Begin Phase 1 implementation
**Owner**: Sean Kim
**Review Required**: Yes (before production deployment)
