---
doc_type: research
date: 2025-11-09T20:02:03+00:00
title: "Event Handling Conflicts in Adaptive Reader"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-09T20:02:03+00:00"
research_question: "How are keyboard, mouse, and tap zone event handling implemented? What conflicts exist between event listeners?"
research_type: codebase_research
researcher: Sean Kim

git_commit: 5225217be9b6ad8923dfc3cb79c299db8e4abce5
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Sean Kim

tags:
  - event-handling
  - reader
  - tapzones
  - keyboard
  - mouse
status: complete

related_docs: []
---

# Research: Event Handling Conflicts in Adaptive Reader

**Date**: 2025-11-09T20:02:03+00:00
**Researcher**: Sean Kim
**Git Commit**: 5225217be9b6ad8923dfc3cb79c299db8e4abce5
**Branch**: main
**Repository**: reader

## Research Question

How are keyboard, mouse, and tap zone event handling implemented in the Adaptive Reader? What conflicts exist between different components listening to the same events? Why might keyboard navigation stop working, mouse movement be inconsistent, or tap zones fail on mobile?

## Summary

The Adaptive Reader currently has **multiple overlapping event listeners** that create potential conflicts and race conditions. Analysis of commit `5225217` ("Fix: Make UI controls accessible in reader") reveals that document-level event listeners were added to work around epub.js iframe event blocking, but this creates a complex event handling hierarchy with **three distinct layers** of event listeners competing for the same user interactions.

**Key Findings:**
- **4 different components** register keyboard event listeners (`keydown`)
- **2 different components** register click event listeners at different DOM levels
- **1 component** registers mouse movement listener (`mousemove`)
- **epub.js iframe** captures events before they reach React components
- Event listeners have **overlapping responsibilities** (e.g., Escape key handled in 5 places)
- No event coordination or priority system between layers

The most critical issue is the **TapZones vs ReaderView conflict**: both components handle clicks for page navigation and control toggling, leading to unpredictable behavior depending on event propagation timing.

## Detailed Findings

### 1. Keyboard Event Listeners - Multiple Components Listening

#### TapZones Component Keyboard Handler
**Location**: `components/reader/TapZones.tsx:48-70`

```typescript
React.useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
      case 'PageUp':
        event.preventDefault();
        onPrevPage();
        break;
      case 'ArrowRight':
      case 'PageDown':
      case ' ': // Spacebar
        event.preventDefault();
        onNextPage();
        break;
      case 'Escape':
        onToggleControls();
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [onPrevPage, onNextPage, onToggleControls]);
```

**Behavior**:
- Listens on `window` object (global scope)
- Handles navigation keys: ArrowLeft, ArrowRight, PageUp, PageDown, Spacebar
- Handles Escape key to toggle controls
- Calls `event.preventDefault()` on all matched keys

#### ReaderView Settings Escape Handler
**Location**: `components/reader/ReaderView.tsx:148-160`

```typescript
useEffect(() => {
  if (!showSettings) return;

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSettings(false);
    }
  };

  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [showSettings]);
```

**Behavior**:
- Listens on `document` object (below window in hierarchy)
- Only active when `showSettings` is true
- Handles Escape key to close settings panel
- Does NOT call `preventDefault()`

#### AI Modal Components Escape Handlers
**Locations**:
- `components/reader/AiRecap.tsx:33-34`
- `components/reader/AiExplanation.tsx:42-43`
- `components/reader/AiChapterSummary.tsx:41-42`

```typescript
// Pattern used by all three AI modals
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [onClose]);
```

**Behavior**:
- Each modal listens on `document` object
- All handle Escape key
- None call `preventDefault()`
- Multiple modals can have active listeners simultaneously

#### Onboarding Flow Keyboard Handler
**Location**: `components/library/OnboardingFlow.tsx:104-105`

```typescript
document.addEventListener('keydown', handleKeyPress);
return () => document.removeEventListener('keydown', handleKeyPress);
```

**Behavior**:
- Handles Arrow keys, Enter, Escape for onboarding navigation
- Active on library page, not reader page

#### Keyboard Event Listener Summary

**Total `keydown` listeners on Reader page**: **5 simultaneous listeners**
1. TapZones (window-level)
2. ReaderView settings (document-level, conditional)
3. AiRecap (document-level, conditional)
4. AiExplanation (document-level, conditional)
5. AiChapterSummary (document-level, conditional)

**Conflict Analysis**:

| Key | TapZones | ReaderView | AI Modals | Conflict? |
|-----|----------|------------|-----------|-----------|
| Escape | Toggles controls | Closes settings | Closes modal | **YES** - Multiple handlers |
| ArrowLeft/Right | Page navigation | - | - | No |
| PageUp/PageDown | Page navigation | - | - | No |
| Spacebar | Next page | - | - | No |

**Critical Issue - Escape Key**:
When settings panel is open AND an AI modal is open:
1. User presses Escape
2. TapZones handler fires first (window-level), calls `preventDefault()`, toggles controls
3. ReaderView handler fires second, closes settings
4. AI modal handler fires third, closes modal

**Result**: Escape key triggers ALL THREE actions instead of just the most specific one (modal close).

**Why Keyboard Might Stop Working**:
- If any component calls `preventDefault()` on a key, other handlers still run but browser default is blocked
- TapZones calls `preventDefault()` on ALL matched keys
- If TapZones component unmounts/remounts, there's a brief period where keyboard is unresponsive
- Event handler dependencies (`onPrevPage`, `onNextPage`, `onToggleControls`) changing causes listener re-registration

### 2. Mouse Movement Event Handling

#### ReaderView Mouse Movement Handler
**Location**: `components/reader/ReaderView.tsx:110-122`

```typescript
// Show controls on mouse movement near top of screen (desktop UX)
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    // Show controls when mouse moves to top 15% of screen
    const topThreshold = window.innerHeight * 0.15;
    if (e.clientY < topThreshold && !showControls) {
      setShowControls(true);
    }
  };

  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, [showControls, setShowControls]);
```

**Behavior**:
- Listens on `window` object for ALL mouse movements
- Checks if mouse Y position is in top 15% of screen
- Shows controls if mouse enters top zone AND controls are currently hidden
- Dependency on `showControls` causes re-registration on every show/hide

**Performance Characteristics**:
- Fires on EVERY mouse movement (high frequency)
- Performs calculation on every movement: `window.innerHeight * 0.15`
- Triggers state update (`setShowControls(true)`) when threshold crossed
- No debouncing or throttling

**Potential Issues**:

1. **Race Condition with Auto-Hide**:
   - Lines 99-108: Auto-hide timer set when controls shown
   - If user moves mouse in/out of top zone rapidly, controls flicker
   - State updates can overlap with timeout-based hiding

2. **Dependency Re-registration**:
   - Effect depends on `showControls` state
   - When `showControls` changes, listener is removed and re-added
   - Brief gap where mousemove events aren't captured

3. **Event Listener Churn**:
   ```
   showControls: false → User moves mouse → Set to true
   Effect re-runs → Remove listener → Add new listener
   Auto-hide timer expires → Set to false
   Effect re-runs → Remove listener → Add new listener
   ```
   This creates unnecessary listener churn

**Why Mouse Movement Might Be Inconsistent**:
- Listener re-registration during state transitions
- Race between auto-hide timer and mouse movement detection
- No handling of mouse leaving the top zone (controls stay shown)
- Dependency array causes effect to run more often than necessary

### 3. TapZones Click Handling - Three-Layer Conflict

#### Layer 1: TapZones Component Click Handler
**Location**: `components/reader/TapZones.tsx:29-44`

```typescript
const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
  const { clientX, currentTarget } = event;
  const { left, width } = currentTarget.getBoundingClientRect();
  const clickX = clientX - left;
  const percentage = clickX / width;

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

**Tap Zone Configuration** (`lib/constants.ts:36-40`):
```typescript
export const TAP_ZONES = {
  left: 0.15,   // Left 15% = previous page
  right: 0.15,  // Right 15% = next page
  center: 0.70, // Center 70% = toggle controls
} as const;
```

**Behavior**:
- Attached to TapZones div wrapper via `onClick` prop
- Calculates click position relative to container
- Left 15%: previous page
- Right 15%: next page
- Center 70%: toggle controls

#### Layer 2: ReaderView Document-Level Click Handler
**Location**: `components/reader/ReaderView.tsx:124-146`

```typescript
// Toggle controls on tap (mobile) - listen on document to catch all clicks
useEffect(() => {
  const handleClick = (e: MouseEvent) => {
    // Don't toggle if clicking on a button or link
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select')) {
      return;
    }

    // Click in center area toggles controls
    const clickX = e.clientX;
    const width = window.innerWidth;
    const leftZone = width * 0.15;
    const rightZone = width * 0.85;

    if (clickX > leftZone && clickX < rightZone) {
      toggleControls();
    }
  };

  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}, [toggleControls]);
```

**Behavior**:
- Listens on `document` object (captures ALL clicks)
- Excludes clicks on interactive elements (buttons, links, inputs, selects)
- Same zone calculation: 15% left, 15% right, 70% center
- Center zone: toggles controls
- **Does NOT handle page navigation** (left/right zones ignored)

**Why This Was Added** (from commit message):
> Problem: TapZones component couldn't receive clicks because epub.js iframe captures all events
> Solution: Move event listeners to document level to catch events before iframe

#### Layer 3: epub.js Iframe Event Capturing
**Context**: epub.js renders book content in an iframe

**Iframe Event Isolation**:
- Iframe is a separate document context
- Click events inside iframe do NOT bubble to parent document by default
- This is why TapZones `onClick` handler doesn't fire for clicks on book content
- epub.js provides its own event system for iframe interactions

**epub.js Event Handling** (`hooks/useHighlights.ts:54-62`):
```typescript
rendition.annotations.add(
  'highlight',
  highlight.cfiRange,
  {},
  (e: MouseEvent) => {
    // Only show note editor on Shift+click to allow normal page turns
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      setEditingNote(highlight);
    }
    // Normal clicks pass through to allow TapZones to handle page turns
  },
  'hl',
  { fill: color, 'fill-opacity': '0.4', 'mix-blend-mode': 'multiply' }
);
```

**epub.js Selection Handler** (`hooks/useHighlights.ts:110-114`):
```typescript
rendition.on('selected', handleSelected);

return () => {
  rendition.off('selected', handleSelected);
};
```

**Behavior**:
- epub.js intercepts mouse events inside iframe
- Highlights can be clicked (Shift+click shows note editor)
- Text selection triggers 'selected' event
- Normal clicks "pass through" but NOT to React components - they're lost to iframe boundary

#### Three-Layer Click Conflict Analysis

**Scenario 1: Click on Book Content (Inside Iframe)**
1. User clicks on text in book
2. epub.js iframe receives event first
3. Event does NOT bubble to parent document
4. TapZones `onClick` handler: **DOES NOT FIRE**
5. ReaderView document click handler: **DOES NOT FIRE** (event never reaches document)
6. Result: **No action** - click is lost

This is the bug that commit `5225217` attempted to fix.

**Scenario 2: Click on TapZones Wrapper (Outside Iframe)**
1. User clicks on TapZones div (margins around book content)
2. TapZones `onClick` handler fires, checks zone, performs action
3. Event bubbles to document
4. ReaderView document click handler fires, checks zone, toggles controls
5. Result: **BOTH handlers run** - potential conflict

**Scenario 3: Click on Interactive Element**
1. User clicks on button (e.g., "AI Recap")
2. TapZones `onClick` handler fires (button is inside TapZones)
3. Event bubbles to document
4. ReaderView handler checks `target.closest('button, a, input, select')`, returns early
5. Result: Button action only (correct)

**Critical Conflict - Double Handling**:

When user clicks on TapZones div (but not inside epub iframe):
- **TapZones handler**: Runs first, determines zone, calls `onPrevPage()` / `onNextPage()` / `onToggleControls()`
- **ReaderView handler**: Runs second, ignores left/right zones, calls `toggleControls()` for center

**Example Bug**:
1. User clicks center zone on TapZones wrapper
2. TapZones calls `onToggleControls()` → Controls toggle (hidden → shown)
3. ReaderView calls `toggleControls()` → Controls toggle again (shown → hidden)
4. **Result**: Controls flicker on/off instead of toggling

**Why TapZones Might Not Work on Mobile**:
- On mobile, ALL clicks on book content are inside epub.js iframe
- Iframe doesn't forward events to parent
- TapZones `onClick` only fires for clicks on wrapper/margins
- Document-level handler is the only one that works (but only for center zone)
- **Left/right tap zones don't work at all** because document handler ignores them

### 4. Event Propagation Flow

#### Current Event Flow Diagram

```
User Click/Tap
    ↓
┌─────────────────────────────────────┐
│ Is click inside epub.js iframe?    │
└─────────────────────────────────────┘
    ↓ YES                    ↓ NO
    │                        │
    ↓                        ↓
epub.js handles        TapZones onClick
(event stops here)          ↓
                       Determines zone
                            ↓
                       Calls onPrevPage/
                       onNextPage/
                       onToggleControls
                            ↓
                       Event bubbles
                            ↓
                    document click listener
                            ↓
                    Checks if button/link
                            ↓ NO
                    Checks if center zone
                            ↓ YES
                    Calls toggleControls()
                            ↓
                    CONFLICT - both handlers ran
```

#### Keyboard Event Flow

```
User presses key
    ↓
window 'keydown' listener (TapZones)
    ↓
Calls preventDefault() if matched
    ↓
document 'keydown' listeners (ReaderView, AI Modals)
    ↓
Multiple handlers run for same key
    ↓
Unpredictable behavior
```

#### Mouse Movement Flow

```
User moves mouse
    ↓
window 'mousemove' listener (ReaderView)
    ↓
Every movement triggers handler
    ↓
Checks Y position vs top 15%
    ↓ If in top zone
State update: setShowControls(true)
    ↓
Effect re-runs (dependency changed)
    ↓
Listener removed and re-added
    ↓
Brief gap in event handling
```

## Code References

### Event Listener Registration Points

| Component | Event | Target | Line Reference |
|-----------|-------|--------|----------------|
| TapZones | keydown | window | `components/reader/TapZones.tsx:68` |
| TapZones | click | div (React onClick) | `components/reader/TapZones.tsx:75` |
| ReaderView | mousemove | window | `components/reader/ReaderView.tsx:120` |
| ReaderView | click | document | `components/reader/ReaderView.tsx:144` |
| ReaderView | keydown (Escape) | document | `components/reader/ReaderView.tsx:158` |
| AiRecap | keydown (Escape) | document | `components/reader/AiRecap.tsx:33` |
| AiExplanation | keydown (Escape) | document | `components/reader/AiExplanation.tsx:42` |
| AiChapterSummary | keydown (Escape) | document | `components/reader/AiChapterSummary.tsx:41` |
| OnboardingFlow | keydown | document | `components/library/OnboardingFlow.tsx:104` |
| useHighlights | selected (epub.js) | rendition | `hooks/useHighlights.ts:110` |
| useEpubReader | relocated (epub.js) | rendition | `hooks/useEpubReader.ts:120` |

### Event Handler Dependencies

**TapZones keyboard handler** (`TapZones.tsx:70`):
```typescript
}, [onPrevPage, onNextPage, onToggleControls]);
```
- Re-registers listener when navigation callbacks change
- Callbacks are passed from ReaderView
- useEpubReader provides `nextPage`/`prevPage` via `useCallback` (stable)
- `onToggleControls` comes from Zustand store (stable)
- **Low risk** of re-registration

**ReaderView mousemove handler** (`ReaderView.tsx:122`):
```typescript
}, [showControls, setShowControls]);
```
- Re-registers listener when `showControls` changes
- `showControls` changes frequently (auto-hide, user toggle)
- **High risk** of re-registration churn

**ReaderView click handler** (`ReaderView.tsx:146`):
```typescript
}, [toggleControls]);
```
- Depends on `toggleControls` from Zustand store
- Zustand provides stable references
- **Low risk** of re-registration

### epub.js Event Isolation

**Rendition initialization** (`hooks/useEpubReader.ts:50-55`):
```typescript
const newRendition = book.renderTo(containerRef.current, {
  width: '100%',
  height: '100%',
  flow: 'paginated',
  snap: true,
});
```

**Container structure** (`components/reader/ReaderView.tsx:383-385`):
```tsx
<TapZones onPrevPage={prevPage} onNextPage={nextPage} onToggleControls={toggleControls}>
  <div ref={containerRef} className="epub-container h-full w-full" />
</TapZones>
```

**Key Point**: The `containerRef` div is where epub.js injects its iframe. TapZones wraps this div, but the iframe inside captures all mouse events on book content.

## Architecture Issues

### 1. Event Listener Hierarchy Violation

**Problem**: Event listeners registered at different DOM levels without coordination

**Current Hierarchy** (from highest to lowest):
1. `window` object (TapZones keyboard, ReaderView mousemove)
2. `document` object (ReaderView click, multiple Escape handlers)
3. React component (TapZones onClick)
4. epub.js iframe (isolated, events don't bubble up)

**Issue**: No priority system or coordination between layers. Higher-level listeners can't know about lower-level handlers.

### 2. Shared Responsibility Without Coordination

**TapZones Component Responsibilities**:
- Page navigation (left/right zones, keyboard arrows)
- Control toggle (center zone, Escape key)

**ReaderView Component Responsibilities**:
- Control toggle (center zone clicks via document listener)
- Auto-hide controls (timer)
- Show controls on mouse movement (top zone)
- Close settings on Escape

**Overlap**:
- Both handle center zone clicks → `toggleControls()`
- Both handle Escape key → different actions
- Both affect `showControls` state

**No Coordination**: TapZones doesn't know ReaderView is also listening. ReaderView doesn't know TapZones already handled the event.

### 3. Missing Event Coordination Patterns

**Standard Patterns Not Used**:

1. **Event Delegation**: No single event coordinator
2. **stopPropagation()**: TapZones doesn't stop event bubbling
3. **Event Priority**: No way to determine which handler should run
4. **Event Capture Phase**: All listeners use bubble phase, can't intercept early
5. **Custom Event System**: No app-level event bus for coordination

### 4. State-Driven Listener Re-registration

**Anti-Pattern**: Including state in dependency arrays causes unnecessary re-registration

```typescript
// ReaderView mousemove - ANTI-PATTERN
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    if (e.clientY < topThreshold && !showControls) {
      setShowControls(true);
    }
  };
  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, [showControls, setShowControls]);  // ← State dependency
```

**Effect**: Every time controls toggle, listener is removed and re-added. Should use refs to avoid this.

## Historical Context (from thoughts/)

### Phase 1 Implementation
**Document**: `thoughts/implementation-details/2025-11-09-phase-1-core-reading-experience-implementation.md`

Original TapZones design (lines 195-198):
> ### Tap Zone Layout
> - Left 15% of screen = previous page
> - Center 70% = next page (or reveal menu)
> - Right 15% = next page

**Note**: Original design was "center 70% = next page (or reveal menu)" - ambiguous behavior.

### Phase 3 Review
**Document**: `thoughts/reviews/2025-11-09-adaptive-reader-phase-3-review.md`

Lines 87-90 documented existing keyboard handling:
> **Onboarding**: Four-step tour covering welcome, themes, highlighting, and progress tracking. Fully keyboard navigable (arrows, Enter, Escape). Skippable at any time.

This confirms multiple components were already handling Escape key before the recent fix.

### Recent Fix - Commit 5225217
**Commit Message** (from git log):
> Fix: Make UI controls accessible in reader - mouse and tap interactions
>
> This commit fixes the issue where UI controls were not accessible while reading because the epub.js iframe was blocking click events.
>
> **Changes:**
>
> 1. **Mouse Movement Detection (Desktop)**:
>    - Added mousemove listener that shows controls when mouse enters top 15% of screen
>
> 2. **Center Tap Toggle (Mobile/Touch)**:
>    - Added document-level click listener that bypasses iframe event blocking
>
> **Technical Details:**
> - Problem: TapZones component couldn't receive clicks because epub.js iframe captures all events
> - Solution: Move event listeners to document level to catch events before iframe

**Analysis**: The fix solved one problem (iframe blocking) but introduced new problems (duplicate event handling). The document-level click listener bypasses the iframe, but doesn't coordinate with TapZones component.

## Root Cause Analysis

### Primary Issue: epub.js Iframe Event Isolation

**Fundamental Problem**: epub.js renders book content in an iframe, which creates a separate document context. Events inside the iframe DO NOT bubble to the parent document unless explicitly forwarded.

**Why This Breaks TapZones**:
1. User clicks on book text
2. Click event fires in iframe document
3. Event does NOT cross iframe boundary
4. TapZones `onClick` handler never fires
5. Page navigation and control toggle don't work

**Attempted Fix**: Add document-level click listener to catch events before iframe.

**Why Fix Is Incomplete**:
- Document-level listener still can't capture events INSIDE iframe
- It only helps for clicks OUTSIDE iframe (margins, wrapper)
- For clicks on actual book content, neither listener fires

### Secondary Issue: Event Handler Duplication

**Problem**: Two components handle the same user action with different implementations.

**TapZones**: Handles clicks via React `onClick` (component-level)
**ReaderView**: Handles clicks via `document.addEventListener` (global-level)

**Conflict**: When both fire (clicks outside iframe), they execute in sequence:
1. TapZones determines zone, performs action
2. Event bubbles to document
3. ReaderView checks zone again, performs action (possibly different)

**Result**: Double handling, flickering, unpredictable behavior.

### Tertiary Issue: No Event Coordination Strategy

**Missing Patterns**:
1. No single source of truth for event handling
2. No event delegation pattern
3. No priority/precedence system
4. No use of `stopPropagation()` to prevent bubbling
5. No communication between event handlers

**Example**: When TapZones handles a click, it should signal "I handled this" to prevent ReaderView from also handling it. Currently, no such mechanism exists.

## Recommendations for Fixes

### Fix 1: Use epub.js Passthrough Events

**Recommendation**: Configure epub.js to forward iframe events to parent.

**Implementation**:
```typescript
// In useEpubReader.ts, after rendition creation
rendition.on('click', (event: MouseEvent) => {
  // Forward click from iframe to parent document
  const syntheticEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: event.clientX,
    clientY: event.clientY,
  });
  containerRef.current?.dispatchEvent(syntheticEvent);
});
```

**Benefits**:
- TapZones `onClick` handler will receive all clicks
- No need for document-level listener
- Events flow through normal React hierarchy
- Single source of truth for click handling

**Complexity**: Low
**Risk**: Low

### Fix 2: Consolidate Click Handling to Single Component

**Recommendation**: Remove document-level click listener from ReaderView. Let TapZones handle all click-based navigation and control toggling.

**Implementation**:
```typescript
// Remove from ReaderView.tsx lines 124-146
// TapZones already handles this correctly
```

**Benefits**:
- Eliminates duplicate handling
- Single component responsible for click interactions
- Clear ownership of event handling

**Complexity**: Trivial
**Risk**: None (removes problematic code)

### Fix 3: Add Event Coordination with stopPropagation

**Recommendation**: When TapZones handles an event, stop it from bubbling to prevent other handlers from processing it.

**Implementation**:
```typescript
// In TapZones.tsx handleClick
const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
  event.stopPropagation(); // ← Add this

  const { clientX, currentTarget } = event;
  // ... rest of handler
};
```

**Benefits**:
- Prevents event from reaching document listeners
- Clear signal that event has been handled
- Standard React/DOM pattern

**Complexity**: Trivial
**Risk**: None

### Fix 4: Consolidate Escape Key Handling

**Recommendation**: Use event capture phase and priority system for Escape key.

**Implementation**:
```typescript
// In ReaderView.tsx - single Escape handler
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;

    // Priority order: modals → settings → controls
    if (showAiExplanation) {
      setShowAiExplanation(false);
    } else if (showAiRecap) {
      setShowAiRecap(false);
    } else if (showAiChapterSummary) {
      setShowAiChapterSummary(false);
    } else if (showSettings) {
      setShowSettings(false);
    } else {
      toggleControls();
    }

    e.preventDefault();
    e.stopPropagation();
  };

  document.addEventListener('keydown', handleEscape, { capture: true });
  return () => document.removeEventListener('keydown', handleEscape, { capture: true });
}, [showAiExplanation, showAiRecap, showAiChapterSummary, showSettings, toggleControls]);
```

**Benefits**:
- Single handler with clear priority
- Capture phase runs before all other listeners
- Prevents multiple handlers from firing
- Centralized logic

**Complexity**: Low
**Risk**: Low (requires testing all modal states)

### Fix 5: Optimize Mousemove Handler with Refs

**Recommendation**: Use refs instead of state in dependency array to prevent listener churn.

**Implementation**:
```typescript
// In ReaderView.tsx
useEffect(() => {
  const showControlsRef = { current: showControls };

  const handleMouseMove = (e: MouseEvent) => {
    const topThreshold = window.innerHeight * 0.15;
    if (e.clientY < topThreshold && !showControlsRef.current) {
      setShowControls(true);
    }
  };

  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, []); // ← Empty dependency array
```

**Alternative**: Use `useCallback` with ref:
```typescript
const showControlsRef = useRef(showControls);
useEffect(() => {
  showControlsRef.current = showControls;
}, [showControls]);

const handleMouseMove = useCallback((e: MouseEvent) => {
  const topThreshold = window.innerHeight * 0.15;
  if (e.clientY < topThreshold && !showControlsRef.current) {
    setShowControls(true);
  }
}, [setShowControls]);

useEffect(() => {
  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, [handleMouseMove]);
```

**Benefits**:
- Listener registered once, never re-registered
- No listener churn on state changes
- Better performance

**Complexity**: Low
**Risk**: None

### Fix 6: Add Throttling to Mousemove Handler

**Recommendation**: Throttle mousemove events to reduce handler execution frequency.

**Implementation**:
```typescript
// In ReaderView.tsx
useEffect(() => {
  let throttleTimer: NodeJS.Timeout | null = null;

  const handleMouseMove = (e: MouseEvent) => {
    if (throttleTimer) return; // Skip if throttled

    throttleTimer = setTimeout(() => {
      throttleTimer = null;
    }, 100); // Fire at most once per 100ms

    const topThreshold = window.innerHeight * 0.15;
    if (e.clientY < topThreshold && !showControls) {
      setShowControls(true);
    }
  };

  window.addEventListener('mousemove', handleMouseMove);
  return () => {
    window.removeEventListener('mousemove', handleMouseMove);
    if (throttleTimer) clearTimeout(throttleTimer);
  };
}, [showControls, setShowControls]);
```

**Benefits**:
- Reduces CPU usage (fewer calculations)
- Still responsive (100ms is imperceptible)
- Standard performance optimization

**Complexity**: Low
**Risk**: None

### Fix 7: Document Event Handling Architecture

**Recommendation**: Create a clear architecture document for event handling.

**Proposed Structure**:
```
Event Handling Layers (priority order):
1. epub.js iframe events (forward to parent)
2. React component handlers (TapZones)
3. Document-level handlers (ReaderView - removed)
4. Window-level handlers (keyboard only)

Event Ownership:
- TapZones: All click-based navigation and control toggle
- ReaderView: Keyboard shortcuts (Escape for modals/settings)
- Modals: Self-contained Escape handling (priority based)

Coordination:
- Use stopPropagation() when event is fully handled
- Use capture phase for priority handlers
- Use refs to avoid listener re-registration
```

**Benefits**:
- Clear understanding for future developers
- Prevents similar issues in new features
- Establishes patterns for event handling

**Complexity**: Low (documentation)
**Risk**: None

## Related Research

**epub.js Documentation**:
- [epub.js Events](https://github.com/futurepress/epub.js/wiki/Events) - Official event documentation
- [epub.js Rendition](https://github.com/futurepress/epub.js/wiki/Rendition) - Rendition API and iframe handling

**React Event Documentation**:
- [React SyntheticEvent](https://react.dev/reference/react-dom/components/common#react-event-object) - How React wraps native events
- [React Event Handling](https://react.dev/learn/responding-to-events) - Best practices for event handlers

**Browser Event Flow**:
- [MDN: Event Bubbling and Capture](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#event_bubbling_and_capture)
- [MDN: stopPropagation()](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation)
- [MDN: preventDefault()](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)

## Open Questions

1. **Does epub.js provide a built-in way to forward iframe events to the parent document?**
   - Need to check epub.js API documentation
   - May have configuration option for event passthrough

2. **Are there other event types being captured by the iframe that we haven't identified?**
   - Scroll events?
   - Touch events (for swipe gestures)?
   - Context menu events?

3. **How do other epub readers (Calibre, Kindle Web Reader) handle this iframe event issue?**
   - Research industry patterns
   - May reveal better architectural solutions

4. **Should keyboard navigation be handled at the document level or component level?**
   - Current implementation uses both
   - Need to decide on single approach

5. **Is there a performance impact from mousemove handler frequency?**
   - Consider measuring with DevTools Performance tab
   - May need profiling before adding throttling

6. **What happens to event listeners during React strict mode double-mounting?**
   - Strict mode calls effects twice in development
   - Could cause temporary double event handling

## Appendix: Complete Event Listener Inventory

### Reader Page Event Listeners

| Component | Event Type | Target | Handler | File:Line |
|-----------|------------|--------|---------|-----------|
| TapZones | click | div (React) | handleClick | TapZones.tsx:29 |
| TapZones | keydown | window | handleKeyDown | TapZones.tsx:49 |
| TapZones | swipe | div (react-swipeable) | onSwipedLeft/Right | TapZones.tsx:21-23 |
| ReaderView | mousemove | window | handleMouseMove | ReaderView.tsx:112 |
| ReaderView | click | document | handleClick | ReaderView.tsx:126 |
| ReaderView | keydown | document | handleEscape | ReaderView.tsx:152 |
| AiRecap | keydown | document | handleEscape | AiRecap.tsx:30 |
| AiExplanation | keydown | document | handleEscape | AiExplanation.tsx:39 |
| AiChapterSummary | keydown | document | handleEscape | AiChapterSummary.tsx:38 |
| useHighlights | selected | rendition (epub.js) | handleSelected | useHighlights.ts:77 |
| useEpubReader | relocated | rendition (epub.js) | handleRelocated | useEpubReader.ts:109 |

### Library Page Event Listeners

| Component | Event Type | Target | Handler | File:Line |
|-----------|------------|--------|---------|-----------|
| OnboardingFlow | keydown | document | handleKeyPress | OnboardingFlow.tsx:91 |

### Total Active Listeners (Reader Page)

- **keydown**: 6 listeners (1 window, 5 document)
- **click**: 2 listeners (1 React, 1 document)
- **mousemove**: 1 listener (window)
- **selected**: 1 listener (epub.js)
- **relocated**: 1 listener (epub.js)
- **swipe**: 2 listeners (react-swipeable)

**Total**: 13 simultaneous event listeners on the reader page.
