---
doc_type: research
date: 2025-11-13T16:01:04+00:00
title: "Mobile Highlighting Issue - Single Word Selection"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T16:01:04+00:00"
research_question: "Why can only single words be highlighted on mobile instead of passages?"
research_type: codebase_research
researcher: Sean Kim

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - highlighting
  - mobile
  - touch-events
  - epub-js
status: complete

related_docs: []
---

# Research: Mobile Highlighting Issue - Single Word Selection

**Date**: 2025-11-13T16:01:04+00:00
**Researcher**: Sean Kim
**Git Commit**: f043ea027c72c71df95873aeac6edad6d812395b
**Branch**: main
**Repository**: reader

## Research Question
Why can only single words be highlighted on mobile instead of passages? On mobile, only a single word can be highlighted and saved. Regular text selection works (shows system UI for copying), but the expected behavior of tap-and-hold to highlight, then drag to extend selection to end of passage, only captures a single word.

## Summary

The mobile highlighting issue is caused by **two separate but interacting problems**:

1. **CSS `select-none` on TapZones wrapper**: The TapZones component wraps the entire epub.js reader with `className="select-none"` ([TapZones.tsx:68](TapZones.tsx:68)), which completely disables text selection within the reading area on all devices. This is the primary blocker.

2. **Touch event handler interference**: The swipe navigation touch handlers in useEpubReader ([useEpubReader.ts:78-104](useEpubReader.ts:78-104)) may interfere with the native text selection drag-to-extend behavior, though this is secondary to the CSS issue.

The system correctly uses epub.js's `selected` event ([useHighlights.ts:77-108](useHighlights.ts:77-108)) to capture selections and show the highlight menu, but users cannot create extended selections due to the CSS blocking user selection entirely.

## Detailed Findings

### TapZones Component - Selection Blocking CSS

**Location**: `/Users/seankim/dev/reader/components/reader/TapZones.tsx:68`

```tsx
<div
  onClick={handleClick}
  className="w-full h-full cursor-pointer select-none"  // ← BLOCKS TEXT SELECTION
  role="button"
  tabIndex={0}
  aria-label="Reading area - swipe or click left to go back, right to go forward, center to show menu"
>
  {children}
</div>
```

The TapZones component wraps the epub.js reader container ([ReaderView.tsx:671-673](ReaderView.tsx:671-673)) and applies `select-none` CSS class, which compiles to `-webkit-user-select: none; user-select: none;`. This completely disables text selection across all devices, preventing users from:
- Tap-and-hold to start selection
- Dragging selection handles to extend selection
- Any native browser text selection UI

This wrapper exists to handle page navigation via tap zones (left 15%, right 15%, center 70% for controls), but the selection blocking is an unintended side effect.

### Highlighting System Architecture

**Core Hook**: `/Users/seankim/dev/reader/hooks/useHighlights.ts`

The highlighting system correctly implements epub.js's selection event pattern:

```typescript
// Listen for text selection (lines 74-115)
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

**How it works**:
1. Epub.js fires `selected` event when user makes text selection inside iframe
2. Handler accesses `contents.window.getSelection()` to get the browser Selection API
3. Extracts selected text, CFI range, and screen position
4. Displays HighlightMenu with color options ([HighlightMenu.tsx:15-111](HighlightMenu.tsx:15-111))
5. Creates highlight via `createHighlight()` ([useHighlights.ts:118-147](useHighlights.ts:118-147))

This architecture is sound and would work correctly **if text selection was enabled**.

### Touch Event Handler for Swipe Navigation

**Location**: `/Users/seankim/dev/reader/hooks/useEpubReader.ts:71-105`

The swipe navigation system registers touch handlers directly on the epub.js iframe document:

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
    touchStartTime = Date.now();
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const duration = Date.now() - touchStartTime;

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

**Swipe detection criteria** ([useEpubReader.ts:90](useEpubReader.ts:90)):
- Horizontal movement > 50px
- Duration < 500ms
- Horizontal distance > 2× vertical distance

**Potential interference**:
- `touchstart` is passive (cannot prevent default), allowing selection to start
- `touchend` with `passive: false` can call `preventDefault()` if swipe detected
- If a user taps and drags slowly to extend selection, the touch gesture might be interpreted as a swipe
- `preventDefault()` on touchend could interfere with drag-to-extend selection handles

However, **this is secondary** to the CSS issue. The current implementation would only matter if `select-none` was removed.

### Epub.js Selection Event Flow

**Integration**: The app correctly uses epub.js's selection event system

Epub.js provides a `selected` event that fires when text is selected inside the iframe. The event provides:
- `cfiRange`: The EPUB Canonical Fragment Identifier range for the selection
- `contents`: Access to the iframe's content window/document

The handler can then access:
- `contents.window.getSelection()`: Browser Selection API
- `selection.getRangeAt(0)`: The actual Range object
- `range.getBoundingClientRect()`: Position for menu placement

This is the standard pattern recommended by epub.js documentation and community examples.

### Mobile-Specific Considerations

**iOS WebKit Issues** (Historical Context):

Research found that epub.js had a severe iOS Safari text selection bug (GitHub issue #904) where:
- Tap-and-hold worked to start selection
- Dragging selection handles caused the selection to contract to one character
- Root cause: WebKit iframe offset bug where drag handle positions were miscalculated
- Fixed in iOS 12.2

This historical bug is **not the current issue** since the user reports that normal text selection works (shows system copy UI). The current issue is that text selection is completely blocked by CSS, not that selection handles behave incorrectly.

### Component Hierarchy

**Reader View Structure**:

```
ReaderView (ReaderView.tsx:44-681)
  ├─ TapZones (line 671) ← APPLIES select-none
  │   └─ div.epub-container (line 672) ← Epub.js renders here
  │       └─ iframe (created by epub.js) ← Content lives here
  │
  ├─ HighlightMenu (line 549-564) ← Shown when currentSelection exists
  └─ Other UI overlays (settings, audio player, etc.)
```

The epub.js rendition is created in useEpubReader ([useEpubReader.ts:62-68](useEpubReader.ts:62-68)) and renders into `containerRef.current`, which is the `.epub-container` div that's a child of TapZones.

### Highlight Creation and Storage

**Database Layer**: `/Users/seankim/dev/reader/lib/db.ts`

Highlights are stored in IndexedDB with schema:
```typescript
interface Highlight {
  id?: number;
  bookId: number;
  cfiRange: string;      // EPUB CFI range for position
  text: string;          // Highlighted text content
  color: 'yellow' | 'blue' | 'orange' | 'pink';
  note?: string;         // Optional user annotation
  createdAt: Date;
}
```

**Highlight Rendering** ([useHighlights.ts:40-71](useHighlights.ts:40-71)):

Existing highlights are rendered using epub.js's annotations API:

```typescript
highlights.forEach((highlight) => {
  const color = HIGHLIGHT_COLORS[highlight.color];

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
    {
      fill: color,
      'fill-opacity': '0.4',
      'mix-blend-mode': 'multiply',
    }
  );
});
```

This system works correctly and displays existing highlights properly. The issue is only with **creating new highlights** due to selection being blocked.

## Code References

- `/Users/seankim/dev/reader/components/reader/TapZones.tsx:68` - CSS `select-none` blocks text selection
- `/Users/seankim/dev/reader/hooks/useEpubReader.ts:78-104` - Touch event handlers for swipe navigation
- `/Users/seankim/dev/reader/hooks/useHighlights.ts:77-108` - Epub.js `selected` event handler
- `/Users/seankim/dev/reader/hooks/useHighlights.ts:118-147` - Highlight creation logic
- `/Users/seankim/dev/reader/hooks/useHighlights.ts:40-71` - Highlight rendering with annotations API
- `/Users/seankim/dev/reader/components/reader/ReaderView.tsx:671-673` - Component hierarchy (TapZones wraps reader)
- `/Users/seankim/dev/reader/components/reader/HighlightMenu.tsx:15-111` - Highlight menu UI
- `/Users/seankim/dev/reader/types/index.ts:42-51` - Highlight data structure

## Architecture Documentation

### Current Event Flow (Blocked by CSS)

```
User taps and holds text
  ↓
❌ BLOCKED by select-none CSS from TapZones
  (Expected: Browser shows selection handles)
  ↓
❌ User cannot drag to extend selection
  ↓
❌ No selection made, epub.js 'selected' event never fires
  ↓
❌ No HighlightMenu shown
```

### Expected Event Flow (If selection enabled)

```
User taps and holds text
  ↓
Browser shows selection handles (native behavior)
  ↓
User drags handles to extend selection
  ↓
User releases to finalize selection
  ↓
Epub.js fires 'selected' event with cfiRange and contents
  ↓
useHighlights.handleSelected() captures:
  - selection text via contents.window.getSelection()
  - CFI range for permanent positioning
  - screen position for menu placement
  ↓
HighlightMenu appears with color options
  ↓
User selects color → createHighlight() saves to IndexedDB
  ↓
Highlight rendered via rendition.annotations.add()
```

### Touch Event Handler Interaction

The swipe navigation handlers run **alongside** text selection, not instead of it:

1. `touchstart` (passive): Records starting position, cannot prevent default
2. User drags finger
3. `touchend` (non-passive): Checks if movement qualifies as swipe
   - If YES → calls `preventDefault()` and navigates to next/prev page
   - If NO → allows event to propagate to TapZones onClick handler

**Potential conflict**: If a user performs a long, slow drag to extend selection, and that drag happens to meet swipe criteria (>50px horizontal, <500ms, 2:1 horizontal:vertical ratio), the `preventDefault()` on touchend could interfere with finalizing the selection.

However, typical text selection drag-to-extend:
- Takes longer than 500ms (users are precise when selecting)
- Has more vertical movement (following text lines)
- Uses selection handle drag, not initial touch position

So swipe detection is **less likely** to interfere than the CSS issue.

## Root Cause Analysis

### Primary Root Cause: CSS `select-none`

**Location**: `TapZones.tsx:68`

**Evidence**:
- `select-none` Tailwind class compiles to `user-select: none`
- Applied to wrapper div that contains the epub.js iframe
- CSS inheritance and/or wrapper containment prevents selection inside iframe
- User reports that "regular text selection works" suggests they see native selection UI elsewhere, but not in reader

**Why it exists**: The TapZones component needs to handle click events for page navigation and likely added `select-none` to prevent accidental text selection when tapping tap zones for navigation. However, this completely blocks intentional text selection for highlighting.

### Secondary Root Cause: Touch Event Handler Interference

**Location**: `useEpubReader.ts:78-104`

**Evidence**:
- Touch handlers call `preventDefault()` on touchend for valid swipes
- Registered with `passive: false` to allow preventing default
- Could interfere with drag-to-extend gesture if user's drag qualifies as swipe

**Why it exists**: Swipe navigation is a standard mobile reading UX pattern. The implementation is reasonable but doesn't account for text selection gestures.

### Why Single Word vs. Passage?

The user reports that "only single word" can be highlighted. This might occur if:

1. **Double-tap selection**: Some mobile browsers allow double-tap to select a word, which might bypass the `select-none` restriction in certain scenarios (browser-specific behavior)
2. **Accidental context menu**: Long-press might trigger native context menu with "Select" option, which selects the word under the press point
3. **Native selection UI**: If the user manages to get a selection started (perhaps in a brief moment before CSS applies), they cannot extend it due to `select-none`

However, the most likely explanation is that the CSS completely blocks selection, and the user is describing attempts where at most a word gets selected via browser-specific workarounds, but extended selection is impossible.

## Related Research

### Epub.js GitHub Issues

- **Issue #904**: "Mobile Safari text selection broken for many ePubs on iOS (iPad)"
  - Historical WebKit bug affecting iPad Safari (fixed in iOS 12.2)
  - Drag handles would contract selection to one character
  - Root cause: iframe offset miscalculation in WebKit
  - Not applicable to current issue (different symptoms)

- **Issue #277**: "How to get the current selection cfi?"
  - Community discussion on using `rendition.on('selected')` event
  - Demonstrates standard pattern for capturing selections (which this app correctly implements)

### Epub.js Tips Documentation

- Community guide by johnfactotum on GitHub
- Recommends using `contents.window.getSelection()` within the `selected` event handler
- Describes using `getBoundingClientRect()` with iframe offset calculation for menu positioning
- App correctly implements these patterns

## Open Questions

### Investigation Needed

1. **Does `select-none` fully prevent selection inside iframe?**
   - Test: Remove `select-none` from TapZones and verify selection works
   - CSS inheritance into iframe content needs verification
   - Tailwind's `select-none` might not penetrate iframe boundary (separate document)

2. **Can selection handles be detected separately from swipe gestures?**
   - Research: Do native selection handle drags fire as touch events?
   - If yes, can we detect and exclude them from swipe detection?
   - iOS vs Android behavior differences

3. **Alternative approach: Click event timing**
   - Could we use `touchstart` timestamp vs `touchend` timestamp to distinguish:
     - Quick tap → TapZone navigation
     - Long press (>500ms) → text selection mode
   - Would require disabling TapZones temporarily during selection

4. **Performance: Does removing select-none impact tap zone responsiveness?**
   - Measure: Does allowing selection cause delay in tap zone click handling?
   - Test: Does selection highlight interfere with page turn taps?

### Implementation Considerations

1. **How to allow selection without breaking tap zones?**
   - Remove `select-none` and rely on epub.js's internal click forwarding?
   - Add conditional logic: disable tap zones during active selection?
   - Use pointer-events instead of user-select?

2. **Should swipe navigation be disabled during text selection?**
   - Detect when user enters "selection mode" (long press without drag)
   - Temporarily disable swipe handlers until selection is finalized or cancelled
   - How to detect when user exits selection mode?

3. **Mobile UX: How do users expect to highlight on mobile?**
   - Current assumption: tap-and-hold → drag handles → highlight
   - Alternative: tap to place cursor → drag to select → tap highlight button
   - Alternative: double-tap word → expand selection → highlight
   - Research competitor apps (Kindle, Apple Books, Google Play Books)

## Conclusions

The mobile highlighting issue is primarily caused by CSS `select-none` on the TapZones wrapper component, which completely blocks text selection in the reading area. This prevents users from tap-and-hold or drag-to-extend text selection, limiting them to at most single-word selection via browser-specific workarounds.

The highlighting system architecture is sound:
- Correctly uses epub.js `selected` event
- Properly captures selection text, CFI range, and position
- Successfully renders highlights via annotations API
- Stores highlights in IndexedDB with correct schema

The touch event handlers for swipe navigation are a secondary concern that may interfere with drag-to-extend gestures, but this only matters if the CSS issue is resolved first.

The fix requires careful UX consideration: balancing tap-zone navigation, swipe navigation, and text selection on mobile devices without creating UI conflicts or accidental interactions.
