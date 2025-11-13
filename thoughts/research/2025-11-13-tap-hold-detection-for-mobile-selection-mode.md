---
doc_type: research
date: 2025-11-13T16:11:09+00:00
title: "Tap + Hold Detection for Mobile Selection Mode"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T16:11:09+00:00"
research_question: "How to implement tap + hold detection to determine selection mode for mobile highlighting?"
research_type: codebase_research
researcher: Sean Kim

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - touch-events
  - mobile
  - highlighting
  - selection-mode
  - gesture-detection
status: complete

related_docs:
  - thoughts/research/2025-11-13-mobile-highlighting-issue-single-word-selection.md
  - thoughts/research/2025-11-11-gesture-handling-investigation-swipe-navigation-issue.md
---

# Research: Tap + Hold Detection for Mobile Selection Mode

**Date**: 2025-11-13T16:11:09+00:00
**Researcher**: Sean Kim
**Git Commit**: f043ea027c72c71df95873aeac6edad6d812395b
**Branch**: main
**Repository**: reader

## Research Question

How to implement tap + hold detection to determine selection mode for mobile highlighting? The goal is to use tap + hold as a signal to enter "selection mode" where tap zones would be disabled, text selection would be enabled, and users could drag to extend selection.

## Summary

The codebase already has touch event infrastructure in place (`useEpubReader.ts:78-139`) that detects swipe gestures using touchstart/touchend timing. Implementing tap + hold detection requires extending this pattern to detect long presses (typically >500ms without significant movement), then managing "selection mode" state to conditionally toggle CSS `user-select` on the TapZones wrapper. The architecture follows existing patterns: useState for modal/mode states (similar to `showSettings`, `showChapterList` in `ReaderView.tsx:46-52`), useEffect with setTimeout for timing-based detection (pattern used in `AiExplanation.tsx:25-31`, `ReaderView.tsx:279-283`), and conditional CSS class application via template strings.

**Key Implementation Areas**:
1. **Touch event handler extension** in `useEpubReader.ts:78-139` to detect long press
2. **State management** using useState pattern in `ReaderView.tsx` or `TapZones.tsx`
3. **CSS toggling** conditional `select-none` class on `TapZones.tsx:68`
4. **Conflict resolution** between hold detection and swipe gestures

## Detailed Findings

### 1. Current Touch Event Handling Infrastructure

**Location**: `/Users/seankim/dev/reader/hooks/useEpubReader.ts:78-139`

The codebase already implements touch event detection for swipe navigation. This provides the foundation for tap + hold detection.

**Existing touch handler registration**:

```typescript
// Register swipe handlers via epub.js hooks API (runs before render)
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();  // ← Timing foundation exists
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const duration = Date.now() - touchStartTime;  // ← Duration calculation

    // Only process as swipe if significant horizontal movement
    if (Math.abs(deltaX) > 50 && duration < 500 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      // Valid swipe - prevent click and navigate
      e.preventDefault();
      e.stopPropagation();
      if (deltaX > 0) {
        newRendition.prev();
      } else {
        newRendition.next();
      }
    }
    // Otherwise let the event propagate for tap zone handling
  };

  doc.addEventListener('touchstart', handleTouchStart, { passive: true });
  doc.addEventListener('touchend', handleTouchEnd, { passive: false });
});
```

**Current timing pattern**:
- `touchStartTime = Date.now()` on touchstart (`line 115`)
- `duration = Date.now() - touchStartTime` on touchend (`line 121`)
- Swipe validation: `duration < 500` (must be quick)

**For tap + hold detection**, this pattern needs to be inverted:
- Long press threshold: `duration > 500ms` (or configurable value)
- Movement threshold: `Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10` (minimal drift)
- Action: Enter selection mode instead of navigating

**Event listener configuration**:
- `touchstart`: `{ passive: true }` - cannot call preventDefault
- `touchend`: `{ passive: false }` - can call preventDefault

**Registration via epub.js hooks**:
The touch handlers are registered inside `rendition.hooks.content.register()` callback (`line 82`), which runs every time a new page/chapter is rendered. This ensures handlers are attached to the iframe document (`contents.document`) where the book content lives, not the parent document.

**Critical architectural insight**: Touch events must be handled inside the epub.js iframe because that's where users interact with the content. The parent document's TapZones wrapper cannot detect touches on iframe content due to iframe isolation (documented in `2025-11-11-gesture-handling-investigation-swipe-navigation-issue.md`).

### 2. Timer-Based Detection Patterns in Codebase

**Pattern**: `useEffect` with `setTimeout` for time-delayed actions

**Example 1: Auto-hide controls** (`ReaderView.tsx:276-284`):

```typescript
// Auto-hide controls after configured delay
useEffect(() => {
  if (!showControls) return;

  const timeout = setTimeout(() => {
    setShowControls(false);
  }, UI_CONSTANTS.controlsAutoHideDelay);  // 3000ms from constants.ts:44

  return () => clearTimeout(timeout);
}, [showControls, setShowControls]);
```

**Example 2: AI explanation generation delay** (`AiExplanation.tsx:23-32`):

```typescript
// Generate explanation when component mounts
useEffect(() => {
  // Simulate API delay for realistic UX
  const timer = setTimeout(() => {
    const generated = generateExplanation(selectedText);
    setExplanation(generated);
    setIsGenerating(false);
  }, 800);

  return () => clearTimeout(timer);
}, [selectedText]);
```

**Key characteristics**:
- `setTimeout` returns timer ID stored in const
- Cleanup function `clearTimeout(timer)` returned from useEffect
- Timer started on state change, cleared on unmount or dependency change
- Durations defined in constants file (`lib/constants.ts:44`)

**For tap + hold detection**, a similar pattern would work:
1. Start timer on `touchstart`
2. Clear timer on `touchend` or `touchmove` (if movement exceeds threshold)
3. If timer completes → fire "hold detected" callback
4. Cleanup on component unmount

**However**, there's a key difference: touch event handlers run **inside the epub.js iframe** (registered via `rendition.hooks.content.register`), not in React component lifecycle. This means:
- Cannot directly use React hooks (useState, useEffect) inside the touch handlers
- Need to communicate from iframe touch handlers to parent React component
- Options: callback functions passed down, or managing timer in vanilla JS inside handler

### 3. State Management Patterns for Modal/Mode States

**Pattern**: `useState<boolean>` for show/hide toggles

**Location**: `/Users/seankim/dev/reader/components/reader/ReaderView.tsx:46-52`

```typescript
const [showSettings, setShowSettings] = useState(false);
const [showNoteEditor, setShowNoteEditor] = useState(false);
const [showAiRecap, setShowAiRecap] = useState(false);
const [showAiExplanation, setShowAiExplanation] = useState(false);
const [showAiChapterSummary, setShowAiChapterSummary] = useState(false);
const [showChapterList, setShowChapterList] = useState(false);
```

**Usage pattern**:
- State initialized to `false` (modal/mode starts hidden/disabled)
- Setter function called to toggle: `setShowSettings(!showSettings)` or `setShowSettings(true)`
- Conditional rendering: `{showSettings && <SettingsDrawer />}`
- Escape key handling to close: `if (e.key === 'Escape') setShowSettings(false)` (`lines 304-312`)

**For selection mode state**, the same pattern applies:

```typescript
const [selectionMode, setSelectionMode] = useState(false);
```

**State location options**:

1. **ReaderView component** (`ReaderView.tsx`):
   - Pros: Central state management alongside other modals
   - Pros: Can coordinate with other UI states (disable tap zones when in selection mode)
   - Cons: Need to pass state down to TapZones as prop

2. **TapZones component** (`TapZones.tsx`):
   - Pros: Local to the component that needs to toggle CSS
   - Pros: Simpler prop passing (none needed)
   - Cons: Less visibility to parent component for coordination

3. **Global store** (`stores/settingsStore.ts`):
   - Pros: Accessible from anywhere
   - Pros: Could persist selection mode preference
   - Cons: Overkill for transient UI state
   - Note: Current store uses Zustand with persistence (`settingsStore.ts:1-100`)

**Recommendation**: Start with local state in `TapZones.tsx` for simplicity. If coordination with other UI elements is needed later, lift to `ReaderView.tsx`.

**State lifecycle for selection mode**:
1. User taps and holds → detect via touch handler → `setSelectionMode(true)`
2. TapZones CSS conditionally removes `select-none`
3. User makes selection → epub.js fires `selected` event → HighlightMenu appears
4. User picks color or closes menu → `setSelectionMode(false)` to re-enable tap zones

### 4. CSS `user-select` Toggling Strategy

**Current blocking CSS**: `/Users/seankim/dev/reader/components/reader/TapZones.tsx:68`

```tsx
<div
  onClick={handleClick}
  className="w-full h-full cursor-pointer select-none"  // ← Blocks selection
  role="button"
  tabIndex={0}
  aria-label="Reading area - swipe or click left to go back, right to go forward, center to show menu"
>
  {children}
</div>
```

The Tailwind class `select-none` compiles to:
```css
-webkit-user-select: none;
user-select: none;
```

This CSS property blocks all text selection, preventing the mobile highlighting workflow (documented in `2025-11-13-mobile-highlighting-issue-single-word-selection.md:45-74`).

**Conditional CSS toggling approach**:

```tsx
<div
  onClick={handleClick}
  className={`w-full h-full cursor-pointer ${selectionMode ? '' : 'select-none'}`}
  role="button"
  tabIndex={0}
  aria-label="Reading area - swipe or click left to go back, right to go forward, center to show menu"
>
  {children}
</div>
```

**How it works**:
- When `selectionMode === false`: `className="w-full h-full cursor-pointer select-none"` (normal behavior, tap zones enabled)
- When `selectionMode === true`: `className="w-full h-full cursor-pointer "` (text selection enabled, tap zones should ignore clicks)

**CSS application timing**:
- React re-renders on state change → className updates → DOM updates
- Browser applies new CSS immediately
- Text selection becomes available within ~16ms (next frame)

**Does CSS toggle propagate into iframe?**

The TapZones wrapper applies `select-none` to the parent div, but the epub.js content lives inside an iframe (separate document). CSS from parent document does **not** automatically inherit into iframe content.

**Testing needed**: Verify whether `select-none` on parent div actually blocks selection inside iframe, or if the previous research assumption was incorrect. The iframe content has its own document and stylesheet context.

**Alternative: Apply CSS to iframe content directly**

If parent CSS doesn't affect iframe, we need to inject styles into the iframe document:

```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;
  const body = doc.body;

  // Apply/remove user-select CSS directly to iframe body
  if (selectionMode) {
    body.style.userSelect = 'text';
    body.style.webkitUserSelect = 'text';
  } else {
    body.style.userSelect = 'none';
    body.style.webkitUserSelect = 'none';
  }
});
```

However, this creates a challenge: the hook runs once per page render, but `selectionMode` state lives in React component. We'd need to:
1. Store rendition reference
2. Re-apply CSS whenever `selectionMode` changes
3. Access iframe document and manipulate styles

**Simpler approach**: Since the root cause research may have been wrong about CSS inheritance into iframe, first test if removing `select-none` from TapZones wrapper is sufficient.

### 5. Existing Selection Event Integration

**Location**: `/Users/seankim/dev/reader/hooks/useHighlights.ts:74-115`

The app already has a working selection event handler via epub.js:

```typescript
// Listen for text selection
useEffect(() => {
  if (!rendition) return;

  const handleSelected = (cfiRange: string, contents: any) => {
    if (!cfiRange) {
      setCurrentSelection(null);
      return;
    }

    const selection = contents.window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setCurrentSelection(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setCurrentSelection(null);
      return;
    }

    // Get position for menu
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };

    setCurrentSelection({
      text,
      cfiRange,
      position,
    });
  };

  rendition.on('selected', handleSelected);

  return () => {
    rendition.off('selected', handleSelected);
  };
}, [rendition]);
```

**When does `selected` event fire?**

The epub.js `selected` event fires when:
1. User makes a text selection inside the iframe (via native browser selection API)
2. User releases touch/mouse, finalizing the selection
3. Selection contains at least one character

**Event timing**:
- Does NOT fire during drag (only after release)
- Does NOT fire on touchstart or touchmove
- DOES fire on selection complete (typically on touchend or mouseup)

**Selection mode lifecycle integration**:

```
User taps and holds text (500ms+)
  ↓
Touch handler detects long press → setSelectionMode(true)
  ↓
TapZones CSS removes select-none
  ↓
User drags to extend selection (native browser behavior)
  ↓
User releases touch → Selection finalized
  ↓
Epub.js fires 'selected' event → handleSelected() called
  ↓
HighlightMenu appears with currentSelection data
  ↓
User selects color → createHighlight() → setSelectionMode(false)
  OR
User cancels → setCurrentSelection(null) → setSelectionMode(false)
```

**Exit condition**: Selection mode should automatically exit when:
- Highlight is created
- Menu is closed/canceled
- User taps elsewhere (blur selection)

### 6. Interaction Conflicts and Edge Cases

#### Conflict 1: Tap + Hold vs. Swipe Gestures

**Current swipe detection** (`useEpubReader.ts:118-134`):
- Requires horizontal movement > 50px
- Duration < 500ms
- Horizontal distance > 2× vertical distance

**Tap + hold detection**:
- Requires minimal movement (< 10px drift)
- Duration > 500ms
- No specific direction

**Mutual exclusivity analysis**:

| Gesture | Duration | Movement | Conflict? |
|---------|----------|----------|-----------|
| Swipe | < 500ms | > 50px horizontal | ✅ No conflict |
| Hold | > 500ms | < 10px | ✅ No conflict |
| Slow swipe | > 500ms | > 50px horizontal | ⚠️ Ambiguous |

**Edge case: Slow swipe** (user drags finger slowly across page)
- Duration could exceed 500ms
- Movement could exceed 50px
- Could trigger both hold detection AND swipe navigation

**Resolution strategy**:

```typescript
const handleTouchEnd = (e: TouchEvent) => {
  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  const duration = Date.now() - touchStartTime;
  const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Priority 1: Swipe (even if slow, prioritize intentional navigation)
  if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
    e.preventDefault();
    e.stopPropagation();
    if (deltaX > 0) {
      newRendition.prev();
    } else {
      newRendition.next();
    }
    return;  // Exit early, don't check for hold
  }

  // Priority 2: Hold (only if no significant movement)
  if (duration > 500 && movement < 10) {
    // Enter selection mode
    enterSelectionMode();
    return;
  }

  // Priority 3: Quick tap (tap zones)
  // Let event propagate to TapZones onClick handler
};
```

**Key insight**: Swipe should take priority over hold detection. Users who swipe intend to navigate, even if they do it slowly.

#### Conflict 2: Hold Detection vs. Tap Zones

**Current tap zone behavior** (`TapZones.tsx:19-38`):
- Detects click position (left 15%, right 15%, center 70%)
- Triggers navigation or control toggle

**With hold detection**:
- Hold (500ms+) → enters selection mode
- Quick tap (< 500ms) → should still trigger tap zones

**Problem**: When user holds and then releases:
- `touchend` fires → touch handler logic runs
- Click event also fires → TapZones `onClick` fires

**Solution**: Prevent click after hold detection

```typescript
let longPressDetected = false;

const handleTouchEnd = (e: TouchEvent) => {
  // ... existing swipe/hold detection ...

  if (duration > 500 && movement < 10) {
    longPressDetected = true;
    enterSelectionMode();

    // Prevent click event from firing
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  longPressDetected = false;
};

// In TapZones.tsx onClick handler
const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
  if (longPressDetected) {
    // Ignore clicks that followed long press
    return;
  }

  // ... existing tap zone logic ...
};
```

**Challenge**: The `longPressDetected` flag needs to be shared between iframe touch handlers and parent component click handler. This requires:
1. Touch handlers in iframe context
2. Click handler in React component context
3. Shared state mechanism

**Possible approaches**:
- Use ref: `const longPressRef = useRef(false)` in useEpubReader, pass to both handlers
- Use click timestamp check: if click happens within 100ms of touchend, check if it was a long press
- Disable tap zones entirely when in selection mode (simpler)

#### Conflict 3: Selection Drag vs. Swipe Navigation

**Scenario**: User enters selection mode via long press, then drags to extend selection

**Current behavior**:
- Touch handlers capture touchstart/touchend on the text
- If drag is horizontal and fast → might trigger swipe navigation
- `preventDefault()` on swipe would cancel selection drag

**Problem**: Selection handle drag could be misinterpreted as swipe

**Solution**: Disable swipe detection when in selection mode

```typescript
const handleTouchEnd = (e: TouchEvent) => {
  // Check if currently in selection mode
  if (isInSelectionMode()) {
    // Don't process swipes, let selection complete
    return;
  }

  // ... rest of swipe detection logic ...
};
```

**Implementation challenge**: How does touch handler (in iframe) know if selection mode is active (state in React component)?

**Option 1: Pass state via closure**

```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  const handleTouchEnd = (e: TouchEvent) => {
    // Access selectionMode from parent scope (needs to be passed in)
    if (selectionModeRef.current) {
      return;  // Don't interfere with selection
    }

    // ... swipe detection ...
  };
});
```

Requires passing `selectionModeRef` from component to hook.

**Option 2: Assume selection in progress if recent long press**

```typescript
let selectionModeActive = false;
let selectionModeTimeout: NodeJS.Timeout | null = null;

const handleTouchEnd = (e: TouchEvent) => {
  const duration = Date.now() - touchStartTime;
  const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (duration > 500 && movement < 10) {
    // Long press detected
    selectionModeActive = true;
    enterSelectionMode();

    // Auto-disable after 10 seconds if no selection made
    selectionModeTimeout = setTimeout(() => {
      selectionModeActive = false;
    }, 10000);

    return;
  }

  if (selectionModeActive) {
    // Don't process swipes while selection mode active
    return;
  }

  // ... swipe detection ...
};
```

Then, when selection is completed or cancelled, clear the flag:

```typescript
// In handleSelected (after user makes selection)
const handleSelected = (cfiRange: string, contents: any) => {
  // ... existing logic ...

  // Reset selection mode flag
  selectionModeActive = false;
  if (selectionModeTimeout) {
    clearTimeout(selectionModeTimeout);
  }
};
```

#### Conflict 4: Accidental Holds During Scrolling

**Scenario**: User scrolling through book might accidentally rest finger on text for 500ms+

**Current architecture**: The app uses paginated flow (`useEpubReader.ts:72`), not scrollable content, so traditional scrolling doesn't exist. However, users might:
- Rest finger while reading
- Hold finger steady while deciding where to tap
- Palm touch while holding device

**Mitigation**: Require intentional tap at start

- Only start hold timer if initial tap is deliberate (pressure-based detection not available in web)
- Could increase hold threshold from 500ms to 700ms to avoid accidental triggers
- Add configuration constant: `UI_CONSTANTS.longPressThreshold = 600`

**Related constant** (`lib/constants.ts:44`):

```typescript
export const UI_CONSTANTS = {
  controlsAutoHideDelay: 3000, // milliseconds - how long to wait before hiding controls
} as const;
```

Could add:

```typescript
export const UI_CONSTANTS = {
  controlsAutoHideDelay: 3000,
  longPressThreshold: 600,      // milliseconds - tap + hold duration for selection mode
  longPressMovementThreshold: 10, // pixels - max movement allowed for long press
} as const;
```

#### Edge Case 5: Selection Mode Exit Conditions

**When should selection mode end?**

**Explicit exits**:
1. User creates highlight → `createHighlight()` called → `setSelectionMode(false)`
2. User closes HighlightMenu → `onClose()` called → `setSelectionMode(false)`
3. User taps elsewhere → blur event or click outside → `setSelectionMode(false)`

**Implicit exits**:
4. Timeout: If user enters selection mode but never makes selection (forgets, walks away)
   - Auto-exit after 30 seconds?
   - Risk: User might be carefully planning their selection
5. Navigation: If user turns page while in selection mode
   - Should exit because selection context is lost
6. System interruption: Phone call, notification, app backgrounded
   - Browser handles this via blur events

**Recommended exit logic**:

```typescript
useEffect(() => {
  if (!selectionMode) return;

  // Auto-exit after 30 seconds of inactivity
  const timeout = setTimeout(() => {
    setSelectionMode(false);
  }, 30000);

  return () => clearTimeout(timeout);
}, [selectionMode]);

// Exit on page navigation
useEffect(() => {
  if (selectionMode) {
    setSelectionMode(false);
  }
}, [currentLocation]);  // currentLocation changes when page turns

// Exit when highlight created or menu closed
const handleHighlightCreated = () => {
  createHighlight(color);
  setSelectionMode(false);
};

const handleMenuClosed = () => {
  setCurrentSelection(null);
  setSelectionMode(false);
};
```

### 7. Recommended Implementation Approach

Based on the research findings, here's a concrete implementation strategy:

#### Step 1: Extend touch event handler in `useEpubReader.ts`

Add long press detection to existing swipe handler:

```typescript
// Add state management for selection mode (needs ref for iframe access)
const selectionModeRef = useRef(false);

newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let longPressTimer: NodeJS.Timeout | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();

    // Start long press timer
    longPressTimer = setTimeout(() => {
      // Check if finger hasn't moved significantly
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (movement < UI_CONSTANTS.longPressMovementThreshold) {
        // Long press detected
        selectionModeRef.current = true;
        onLongPress?.();  // Callback to parent component
      }
    }, UI_CONSTANTS.longPressThreshold);
  };

  const handleTouchMove = (e: TouchEvent) => {
    // Cancel long press if user moves finger significantly
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;
    const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (movement > UI_CONSTANTS.longPressMovementThreshold && longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const duration = Date.now() - touchStartTime;

    // Don't process swipes if in selection mode
    if (selectionModeRef.current) {
      return;
    }

    // Only process as swipe if significant horizontal movement
    if (Math.abs(deltaX) > 50 && duration < 500 && Math.abs(deltaX) > Math.abs(deltaY) * 2) {
      e.preventDefault();
      e.stopPropagation();
      if (deltaX > 0) {
        newRendition.prev();
      } else {
        newRendition.next();
      }
    }
  };

  doc.addEventListener('touchstart', handleTouchStart, { passive: true });
  doc.addEventListener('touchmove', handleTouchMove, { passive: true });
  doc.addEventListener('touchend', handleTouchEnd, { passive: false });
});
```

**Key changes**:
- Add `longPressTimer` to track hold detection
- Add `touchmove` listener to cancel timer if user moves finger
- Add `onLongPress` callback to communicate with parent component
- Use `selectionModeRef` to disable swipe detection during selection

#### Step 2: Add selection mode state to TapZones

Modify `TapZones.tsx` to manage selection mode:

```typescript
interface TapZonesProps {
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleControls: () => void;
  children: React.ReactNode;
  selectionMode: boolean;  // New prop
  onSelectionModeChange: (enabled: boolean) => void;  // New prop
}

export default function TapZones({
  onPrevPage,
  onNextPage,
  onToggleControls,
  children,
  selectionMode,
  onSelectionModeChange,
}: TapZonesProps) {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks when in selection mode
    if (selectionMode) {
      return;
    }

    const { clientX, currentTarget } = event;
    const { left, width } = currentTarget.getBoundingClientRect();
    const clickX = clientX - left;
    const percentage = clickX / width;

    event.stopPropagation();

    if (percentage < TAP_ZONES.left) {
      onPrevPage();
    } else if (percentage > 1 - TAP_ZONES.right) {
      onNextPage();
    } else {
      onToggleControls();
    }
  };

  // ... keyboard handling ...

  return (
    <div
      onClick={handleClick}
      className={`w-full h-full cursor-pointer ${selectionMode ? '' : 'select-none'}`}
      role="button"
      tabIndex={0}
      aria-label="Reading area - swipe or click left to go back, right to go forward, center to show menu"
    >
      {children}
    </div>
  );
}
```

**Key changes**:
- Add `selectionMode` and `onSelectionModeChange` props
- Conditionally apply `select-none` class
- Disable tap zone clicks when in selection mode

#### Step 3: Coordinate state in ReaderView

Modify `ReaderView.tsx` to manage selection mode state:

```typescript
function ReaderViewContentComponent({ bookId, bookBlob, initialCfi }: ReaderViewProps) {
  // ... existing state ...
  const [selectionMode, setSelectionMode] = useState(false);

  const { book, rendition, loading, currentLocation, progress, totalLocations, nextPage, prevPage, goToLocation } =
    useEpubReader({
      bookBlob,
      containerRef,
      onLocationChange: async (cfi, percentage) => {
        // ... existing logic ...
      },
      onLongPress: () => {
        // Long press detected in iframe
        setSelectionMode(true);
      },
    });

  // Exit selection mode when highlight created
  const handleHighlightCreated = async (color: HighlightColor) => {
    await createHighlight(color);
    setSelectionMode(false);
  };

  // Exit selection mode when menu closed
  const handleHighlightMenuClosed = () => {
    setCurrentSelection(null);
    setSelectionMode(false);
  };

  // Exit selection mode on page navigation
  useEffect(() => {
    if (selectionMode) {
      setSelectionMode(false);
    }
  }, [currentLocation]);

  // Auto-exit selection mode after timeout
  useEffect(() => {
    if (!selectionMode) return;

    const timeout = setTimeout(() => {
      setSelectionMode(false);
    }, 30000);  // 30 seconds

    return () => clearTimeout(timeout);
  }, [selectionMode]);

  return (
    // ... existing JSX ...
    <TapZones
      onPrevPage={prevPage}
      onNextPage={nextPage}
      onToggleControls={toggleControls}
      selectionMode={selectionMode}
      onSelectionModeChange={setSelectionMode}
    >
      <div ref={containerRef} className="epub-container h-full w-full" />
    </TapZones>

    {currentSelection && (
      <HighlightMenu
        selectedText={currentSelection.text}
        position={currentSelection.position}
        onHighlight={handleHighlightCreated}
        onClose={handleHighlightMenuClosed}
      />
    )}
  );
}
```

**Key changes**:
- Add `selectionMode` state
- Pass `onLongPress` callback to useEpubReader
- Pass `selectionMode` props to TapZones
- Auto-exit selection mode on navigation or timeout
- Exit selection mode when highlight created or menu closed

#### Step 4: Update constants

Add configuration values to `lib/constants.ts`:

```typescript
export const UI_CONSTANTS = {
  controlsAutoHideDelay: 3000,
  longPressThreshold: 600,           // ms - tap + hold duration for selection mode
  longPressMovementThreshold: 10,    // px - max movement allowed for long press
  selectionModeTimeout: 30000,       // ms - auto-exit selection mode after inactivity
} as const;
```

#### Step 5: Update useEpubReader hook signature

Modify hook to accept `onLongPress` callback:

```typescript
interface UseEpubReaderProps {
  bookBlob: Blob | null;
  containerRef: React.RefObject<HTMLDivElement>;
  onLocationChange?: (cfi: string, percentage: number) => void;
  onLongPress?: () => void;  // New callback
}

export function useEpubReader({
  bookBlob,
  containerRef,
  onLocationChange,
  onLongPress,
}: UseEpubReaderProps) {
  // ... implementation with onLongPress callback in touch handlers ...
}
```

### 8. Testing Considerations

**Manual testing scenarios**:

1. **Basic long press**:
   - Tap and hold text for 600ms without moving finger
   - Verify selection mode activates (CSS changes, user-select enabled)
   - Drag to extend selection
   - Verify HighlightMenu appears

2. **Movement cancellation**:
   - Tap and start holding
   - Move finger 15px before 600ms elapses
   - Verify selection mode does NOT activate

3. **Swipe vs hold priority**:
   - Perform quick swipe left/right
   - Verify page navigation works (swipe not blocked)
   - Perform slow swipe (>600ms)
   - Verify swipe takes priority over hold

4. **Tap zone interaction**:
   - Quick tap left edge
   - Verify previous page navigation (not blocked by hold detection)
   - Hold for 600ms then release
   - Verify tap zone does NOT fire (click suppressed)

5. **Selection mode exit**:
   - Enter selection mode
   - Create highlight
   - Verify selection mode exits (tap zones re-enabled)
   - Enter selection mode
   - Close menu without highlighting
   - Verify selection mode exits

6. **Auto-timeout**:
   - Enter selection mode
   - Wait 30 seconds without making selection
   - Verify selection mode auto-exits

7. **Page navigation reset**:
   - Enter selection mode
   - Turn page via keyboard or swipe
   - Verify selection mode exits

**Device testing**:
- iOS Safari (primary mobile target)
- Android Chrome
- iOS WebView (if app wrapped)
- Tablet vs phone screen sizes

**Edge cases**:
- Multi-touch (two fingers on screen)
- Interrupted touches (notification during hold)
- Rapid tap sequences
- Touch during page transition/animation

### 9. Alternative Approaches Considered

#### Alternative 1: Double-tap to enter selection mode

**Pattern**: Double-tap word → selects word and enters selection mode → user drags handles

**Pros**:
- Familiar pattern from iOS/Android text selection
- No timing ambiguity (clear intentional gesture)
- No conflict with swipe or hold

**Cons**:
- Double-tap is already used by browsers for zoom (though zoom can be disabled)
- Requires tracking tap count and timing between taps
- Less discoverable than long press

**Implementation complexity**: Similar to long press, but tracks tap count instead of duration.

#### Alternative 2: Dedicated selection mode button

**Pattern**: User taps floating action button to enter selection mode → tap zones disabled → text selection enabled

**Pros**:
- Explicit, no gesture ambiguity
- Easy to discover (visible UI)
- Can show mode indicator (e.g., "Selection Mode" banner)

**Cons**:
- Requires extra tap (less efficient)
- Clutters reading UI with another button
- Not consistent with mobile OS text selection patterns

**Use case**: Better for desktop or accessibility, not ideal for mobile UX.

#### Alternative 3: Pressure-sensitive touch (3D Touch / Haptic Touch)

**Pattern**: Press harder on screen to enter selection mode

**Pros**:
- Very intentional gesture
- No timing or movement ambiguity
- iOS native pattern

**Cons**:
- Not available in web APIs (only native iOS apps)
- Android lacks equivalent
- 3D Touch deprecated by Apple

**Not viable**: Web platform limitation.

#### Alternative 4: Remove tap zones entirely, rely on swipe only

**Pattern**: No tap zones → text selection always enabled → navigation via swipe only

**Pros**:
- Simplest solution (no mode switching needed)
- Text selection always available
- No gesture conflicts

**Cons**:
- Removes center tap to show controls (important UX)
- Removes left/right tap navigation (some users prefer tapping over swiping)
- Would need alternative way to show controls (e.g., always visible, or top-edge swipe)

**Recommendation**: Tap zones are valuable UX, don't remove.

## Code References

- `/Users/seankim/dev/reader/hooks/useEpubReader.ts:78-139` - Touch event handler infrastructure
- `/Users/seankim/dev/reader/hooks/useEpubReader.ts:112-116` - touchstart handler
- `/Users/seankim/dev/reader/hooks/useEpubReader.ts:118-135` - touchend handler with timing
- `/Users/seankim/dev/reader/components/reader/TapZones.tsx:68` - CSS select-none application
- `/Users/seankim/dev/reader/components/reader/ReaderView.tsx:46-52` - Modal state pattern
- `/Users/seankim/dev/reader/components/reader/ReaderView.tsx:276-284` - setTimeout pattern for auto-hide
- `/Users/seankim/dev/reader/components/reader/AiExplanation.tsx:23-32` - setTimeout cleanup pattern
- `/Users/seankim/dev/reader/hooks/useHighlights.ts:74-115` - Selection event handler
- `/Users/seankim/dev/reader/lib/constants.ts:44` - UI timing constants
- `/Users/seankim/dev/reader/stores/settingsStore.ts:1-100` - Zustand state management pattern

## Architecture Documentation

### Event Flow Timeline: Tap + Hold for Selection

```
T=0ms: User touches text
  ↓
  touchstart event fires (passive: true)
    - Record touchStartX, touchStartY, touchStartTime
    - Start longPressTimer (600ms)
  ↓
T=0-600ms: User holds finger steady
  ↓
  [If user moves > 10px: touchmove fires]
    - Clear longPressTimer
    - Hold detection cancelled
  ↓
T=600ms: Timer completes
  ↓
  onLongPress callback fires
    - setSelectionMode(true)
    - React re-renders TapZones
    - CSS removes select-none
  ↓
  User sees native selection UI (handles appear)
  ↓
  User drags to extend selection
  ↓
  User releases touch
    - Selection finalized by browser
    - epub.js fires 'selected' event
  ↓
  handleSelected() in useHighlights
    - Captures selection text, CFI range, position
    - setCurrentSelection(...)
  ↓
  HighlightMenu renders
  ↓
  User taps color button
    - createHighlight(color)
    - setSelectionMode(false)
    - TapZones re-applies select-none
  ↓
  Selection mode exited, tap zones re-enabled
```

### State Coordination Pattern

```
Component Hierarchy:
  ReaderView
    ├─ useState(selectionMode)
    ├─ useEpubReader({ onLongPress })
    │   └─ Touch handlers in iframe
    │       └─ Call onLongPress() → setSelectionMode(true)
    └─ TapZones({ selectionMode })
        └─ Conditional CSS based on selectionMode prop

State Flow:
  Touch handler (iframe) → onLongPress callback →
  ReaderView.setSelectionMode(true) →
  TapZones re-renders with selectionMode=true →
  CSS class updates (removes select-none) →
  Text selection enabled
```

### Gesture Priority Decision Tree

```
Touch detected
  ├─ Duration > 600ms && Movement < 10px?
  │   └─ YES: Long Press → Enter selection mode
  │
  ├─ Duration < 500ms && Horizontal movement > 50px?
  │   └─ YES: Swipe → Navigate page
  │
  ├─ Duration < 300ms && Movement < 10px?
  │   └─ YES: Tap → Trigger tap zone action
  │
  └─ Else: Ignore (ambiguous gesture)
```

## Historical Context

### Related Research Documents

1. **Mobile Highlighting Issue** (`thoughts/research/2025-11-13-mobile-highlighting-issue-single-word-selection.md`):
   - Identified CSS `select-none` as primary blocker for text selection
   - Documented epub.js `selected` event integration (already working correctly)
   - Found that highlighting system architecture is sound, just blocked by CSS
   - Conclusion: Need to conditionally disable `select-none` to allow selection

2. **Gesture Handling Investigation** (`thoughts/research/2025-11-11-gesture-handling-investigation-swipe-navigation-issue.md`):
   - Documented iframe isolation for touch events
   - Explained why touch handlers must be registered inside epub.js iframe
   - Showed existing pattern of registering handlers via `rendition.hooks.content.register()`
   - Provides foundation for understanding where to implement long press detection

3. **Swipe Navigation Best Practices** (`thoughts/research/2025-11-11-epub-js-swipe-navigation-best-practices.md`):
   - Likely contains additional context on swipe implementation
   - May have timing and threshold recommendations

### Design Decisions

**Why tap + hold instead of alternatives?**

Tap + hold (long press) is the **native mobile OS pattern** for text selection:
- iOS: Long press shows magnifier and selection handles
- Android: Long press selects word and shows handles
- Users already trained on this gesture from Messages, Notes, Safari, etc.

**Why 600ms threshold?**

- iOS uses ~500ms for system long press recognition
- Adding 100ms buffer (600ms) reduces accidental triggers
- Still fast enough to feel responsive
- Can be configured via constant for tuning

**Why conditional CSS instead of always enabling selection?**

- Tap zones provide valuable navigation UX (left tap = prev, right tap = next)
- Text selection interferes with tap zones (selects text instead of navigating)
- Cannot have both active simultaneously without UX conflicts
- Mode switching provides explicit intention signal

## Open Questions

### Investigation Needed

1. **Does CSS `select-none` on parent actually block selection inside iframe?**
   - Need to test: Remove `select-none` from TapZones wrapper and verify selection works
   - The iframe has separate document context, CSS might not inherit
   - If CSS doesn't inherit, need to inject styles into iframe document instead

2. **How do native selection handles interact with touch events?**
   - Do selection handle drags fire as touchmove events?
   - Will swipe detection interfere with dragging handles?
   - Need device testing to observe behavior

3. **Should long press threshold be configurable by user?**
   - Some users might want faster/slower activation
   - Could add setting in SettingsDrawer
   - Or use system default and don't make it configurable (simpler)

4. **What's the best visual feedback for selection mode?**
   - Should there be a mode indicator (e.g., banner saying "Selection Mode")?
   - Or rely on native selection handles as feedback?
   - Trade-off: Explicit vs minimal UI

5. **How to handle simultaneous selections?**
   - If user makes selection, menu appears, but they long-press elsewhere before closing menu
   - Should previous selection be cancelled?
   - Or allow multiple selections (show both menus)?

### Performance Considerations

1. **Does adding `touchmove` listener impact scroll performance?**
   - Current implementation only has touchstart/touchend
   - Adding touchmove for movement threshold checking
   - Registered with `passive: true` to avoid blocking (can't call preventDefault anyway)
   - Should be performant, but worth monitoring

2. **React re-render on mode state change**:
   - `setSelectionMode(true)` triggers re-render of ReaderView and TapZones
   - TapZones re-renders to update CSS class
   - Should be fast (small component tree)
   - No expensive computations

3. **CSS class toggle timing**:
   - Browser must apply new CSS before selection is possible
   - Happens within ~16ms (next frame)
   - User perception: instant
   - No performance concern

## Conclusions

Implementing tap + hold detection for mobile selection mode is **architecturally straightforward** given the existing codebase patterns:

1. **Foundation exists**: Touch event infrastructure already in place for swipe detection
2. **State pattern established**: Modal/mode state management well-defined in ReaderView
3. **Timer pattern documented**: setTimeout cleanup pattern used throughout codebase
4. **Selection system ready**: epub.js `selected` event integration already working

**Implementation involves**:
- Extending touch handlers in `useEpubReader.ts` with long press timer
- Adding `selectionMode` state in `ReaderView.tsx`
- Conditionally applying `select-none` CSS in `TapZones.tsx`
- Coordinating state via callback props

**Key design decisions**:
- 600ms threshold for long press (configurable via constants)
- 10px movement threshold to cancel hold detection
- Swipe gesture takes priority over hold (even if slow swipe)
- Tap zones disabled during selection mode
- Auto-exit after 30 seconds or page navigation

**Main challenge**: Coordinating state between iframe touch handlers (vanilla JS) and React component state. Solved via callback pattern and refs.

**Testing priority**: Device testing on iOS Safari and Android Chrome to verify gesture interactions and CSS inheritance into iframe.

The implementation follows existing architectural patterns and integrates cleanly with the current highlighting system. No major refactoring required.
