---
doc_type: research
date: 2025-11-11T22:45:26+00:00
title: "epub.js rendered event investigation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-11T22:45:26+00:00"
research_question: "Why is the epub.js rendered event not firing and what is the correct approach for injecting swipe handlers?"
research_type: codebase_research
researcher: Sean Kim

git_commit: 64bdd0e1fb01710e57923dab9c99a5ab5c9c55d0
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-11
last_updated_by: Sean Kim

tags:
  - epub.js
  - event-lifecycle
  - swipe-handlers
  - react-hooks
status: complete

related_docs: []
---

# Research: epub.js rendered Event Not Firing

**Date**: 2025-11-11T22:45:26+00:00
**Researcher**: Sean Kim
**Git Commit**: 64bdd0e1fb01710e57923dab9c99a5ab5c9c55d0
**Branch**: main
**Repository**: reader

## Research Question
Why is the epub.js `rendered` event not firing and what is the correct approach for injecting swipe handlers?

## Summary

The `rendered` event IS firing, but the listener is registered **too late** to catch the initial render. This is a **race condition** caused by React useEffect execution order relative to epub.js's internal rendering lifecycle.

**Root Cause**: The `rendered` event fires when `rendition.display()` is called (lines 285-289 of useEpubReader.ts), but the event listener is registered in a separate useEffect (lines 137-201) that may run after the display has already occurred.

**Key Finding**: Unlike the `click` event (which fires continuously on user interaction), the `rendered` event fires **once per chapter/section** when content is rendered. If you miss the initial firing, you won't see subsequent events until the user navigates to a new chapter.

**Correct Approach**: Register the `rendered` event listener **before** calling `rendition.display()`, or use the event for **future renders** (when user navigates to new chapters) rather than the initial render.

## Detailed Findings

### 1. epub.js `rendered` Event Lifecycle

**Location**: Documentation research via web search and epub.js type definitions

The `rendered` event has specific characteristics:

- **When it fires**: When a section/chapter is rendered via `rendition.display()` ([rendition.d.ts:86-87](file:///Users/seankim/dev/reader/node_modules/epubjs/types/rendition.d.ts))
- **How often**: Once per chapter/section render, NOT continuously like `click` events
- **Parameters**: Receives `(section: Section, iframe: Window)` - provides access to the iframe document
- **Common use case**: Redrawing annotations, attaching DOM event listeners to newly rendered content

From web research:
```javascript
// Typical pattern from epub.js community
rendition.on('rendered', (e, iframe) => {
  // iframe.document gives access to the rendered content's DOM
  iframe.document.documentElement.addEventListener('touchstart', handler);
});
```

**Critical insight**: The `rendered` event is designed to fire **each time a new page/chapter is displayed**, making it suitable for injecting handlers into **future renders**, not necessarily the initial render.

### 2. useEffect Execution Order Analysis

**Location**: [hooks/useEpubReader.ts:28-289](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)

There are 7 useEffects in useEpubReader.ts with different dependencies:

1. **Lines 28-56**: Book initialization - depends on `[bookBlob]`
2. **Lines 58-75**: Rendition creation - depends on `[book, containerRef]`
3. **Lines 78-100**: Apply styling - depends on `[rendition, theme, fontSize, fontFamily, lineHeight]`
4. **Lines 102-135**: Click forwarding (WORKING) - depends on `[rendition, containerRef]`
5. **Lines 137-201**: Rendered event listener (NOT WORKING) - depends on `[rendition]`
6. **Lines 203-223**: Generate locations - depends on `[book]`
7. **Lines 225-255**: Track location changes - depends on `[rendition, book, onLocationChange]`
8. **Lines 284-289**: **Display initial content** - depends on `[rendition, currentLocation]`

**The Race Condition**:

The execution order creates a timing issue:

```
1. Book created → setBook(epubBook)
2. React re-renders with new book
3. Rendition created → setRendition(newRendition)
4. React re-renders with new rendition
5. MULTIPLE useEffects run in parallel:
   - Click listener registers (lines 102-135)
   - Rendered listener registers (lines 137-201)
   - Location tracking registers (lines 225-255)
   - Display effect runs (lines 284-289) → calls rendition.display()
6. rendition.display() triggers rendered event
7. ??? Was the listener registered yet? NO GUARANTEE!
```

**Why it fails**: When React batches useEffect executions, there's no guaranteed order between effects with the same dependency (`[rendition]`). The display effect (lines 284-289) may execute **before** the rendered listener effect (lines 137-201), causing the event to fire before the listener is registered.

### 3. Working vs Non-Working Pattern Comparison

**Location**: [hooks/useEpubReader.ts:102-201](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)

#### Working Pattern: Click Forwarding (lines 102-135)

```typescript
useEffect(() => {
  if (!rendition || !containerRef.current) return;

  const handleIframeClick = (event: MouseEvent) => {
    // ... handler logic ...
  };

  rendition.on('click', handleIframeClick);

  return () => {
    rendition.off('click', handleIframeClick);
  };
}, [rendition, containerRef]);
```

**Why this works**:
- `click` events fire **on every user click**, continuously throughout the app lifecycle
- Timing of listener registration doesn't matter - clicks will occur in the future
- No dependency on initial render timing

#### Non-Working Pattern: Rendered Event (lines 137-201)

```typescript
useEffect(() => {
  if (!rendition) return;

  const setupSwipeHandlers = (contents: any) => {
    console.log('[useEpubReader] rendered event fired, setting up swipe handlers');
    // ... handler logic ...
  };

  console.log('[useEpubReader] Registering rendered event listener');
  rendition.on('rendered', setupSwipeHandlers);

  return () => {
    console.log('[useEpubReader] Cleaning up rendered event listener');
    rendition.off('rendered', setupSwipeHandlers);
  };
}, [rendition]);
```

**Why this fails for initial render**:
- `rendered` event fires **once** when `rendition.display()` is called (line 287)
- If the display effect runs before this listener effect, the event fires with no listener
- No subsequent `rendered` events occur until user navigates to a new chapter
- The registration log (`[useEpubReader] Registering rendered event listener`) may never appear if React hasn't executed this effect yet

**Observation**: The user reports **no logs at all** from the rendered listener, suggesting the useEffect may not be running, OR it's running after the initial display and simply never seeing a `rendered` event.

### 4. iframe Creation Timing and DOM Availability

**Location**: [hooks/useEpubReader.ts:58-75](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)

The rendition creation happens in a useEffect:

```typescript
// Lines 58-75
useEffect(() => {
  if (!book || !containerRef.current) return;

  const newRendition = book.renderTo(containerRef.current, {
    width: '100%',
    height: '100%',
    flow: 'paginated',
    snap: true,
    allowScriptedContent: true,
  });

  setRendition(newRendition);

  return () => {
    newRendition?.destroy();
  };
}, [book, containerRef]);
```

**Key finding**: `book.renderTo()` creates the rendition but does **not** immediately render content or create iframes. The actual iframe creation happens when `rendition.display()` is called.

**iframe Lifecycle**:
1. `book.renderTo()` → Creates rendition object, attaches to container
2. `rendition.display()` → Triggers content render, creates iframe, emits `rendered` event
3. User navigates → New content renders, emits another `rendered` event

**DOM Availability**: The click forwarding pattern (lines 102-135) successfully accesses iframes via:
```typescript
const iframe = containerRef.current?.querySelector('iframe');
```

This proves that:
- iframes DO exist in the DOM after rendering
- Direct DOM queries work for accessing already-rendered content
- The `rendered` event is specifically for **catching** the render, not querying afterward

### 5. Alternative Approaches for Swipe Handler Injection

Based on research and codebase analysis, there are several viable approaches:

#### Option A: Use `rendered` for Future Renders Only (epub.js Pattern)

Accept that the initial render is missed and inject handlers on all subsequent renders:

```typescript
// The current implementation WILL work for chapter navigation
// but misses initial render
useEffect(() => {
  if (!rendition) return;

  const setupSwipeHandlers = (contents: any) => {
    const doc = contents.document;
    doc.addEventListener('touchstart', handleTouchStart);
    doc.addEventListener('touchend', handleTouchEnd);
  };

  rendition.on('rendered', setupSwipeHandlers);
  return () => rendition.off('rendered', setupSwipeHandlers);
}, [rendition]);
```

**Pros**: Follows epub.js conventions, handles chapter navigation
**Cons**: Initial chapter has no swipe handlers until user navigates away and back

#### Option B: Combine `rendered` Event with Direct iframe Query

Register `rendered` for future renders, AND immediately inject into existing iframe:

```typescript
useEffect(() => {
  if (!rendition || !containerRef.current) return;

  const setupSwipeHandlers = (contents: any) => {
    const doc = contents.document;
    doc.addEventListener('touchstart', handleTouchStart);
    doc.addEventListener('touchend', handleTouchEnd);
  };

  // Register for future renders
  rendition.on('rendered', setupSwipeHandlers);

  // ALSO: Inject into already-rendered iframe (if exists)
  const iframe = containerRef.current.querySelector('iframe');
  if (iframe?.contentDocument) {
    const contents = { document: iframe.contentDocument };
    setupSwipeHandlers(contents);
  }

  return () => rendition.off('rendered', setupSwipeHandlers);
}, [rendition, containerRef]);
```

**Pros**: Handles both initial render and subsequent navigation
**Cons**: Duplicate injection logic, may inject twice on re-renders

#### Option C: Use `relocated` Event Instead

The `relocated` event fires when location changes, which includes initial display:

```typescript
useEffect(() => {
  if (!rendition || !containerRef.current) return;

  const setupSwipeHandlers = () => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (iframe?.contentDocument) {
      iframe.contentDocument.addEventListener('touchstart', handleTouchStart);
      iframe.contentDocument.addEventListener('touchend', handleTouchEnd);
    }
  };

  // This fires on initial display AND every page turn
  rendition.on('relocated', setupSwipeHandlers);

  return () => rendition.off('relocated', setupSwipeHandlers);
}, [rendition, containerRef]);
```

**Pros**: Fires reliably on initial display and all subsequent navigation
**Cons**: Fires more frequently than `rendered`, may re-inject handlers unnecessarily

#### Option D: Register Before Display (Timing Fix)

Ensure listener is registered before calling `display()` by combining effects:

```typescript
// Lines 137-201 and 284-289 combined
useEffect(() => {
  if (!rendition || !containerRef.current) return;
  if (currentLocation) return; // Already displayed

  const setupSwipeHandlers = (contents: any) => {
    const doc = contents.document;
    doc.addEventListener('touchstart', handleTouchStart);
    doc.addEventListener('touchend', handleTouchEnd);
  };

  // Register listener FIRST
  rendition.on('rendered', setupSwipeHandlers);

  // THEN trigger display
  rendition.display();

  return () => rendition.off('rendered', setupSwipeHandlers);
}, [rendition, containerRef, currentLocation]);
```

**Pros**: Guarantees listener is registered before event fires
**Cons**: Combines two separate concerns (event registration + display logic), harder to maintain

### 6. Recommended Approach

**Option B (Hybrid Approach)** is recommended for this codebase:

1. Register `rendered` event listener for chapter navigation (future renders)
2. Immediately inject handlers into already-rendered iframe (initial render)
3. Add idempotency check to prevent duplicate handler registration

**Why this approach**:
- Handles both initial render and navigation
- Follows React patterns (useEffect for setup)
- Aligns with existing click forwarding pattern (lines 102-135)
- Minimal changes to current architecture

**Implementation** (lines 137-201 modification):

```typescript
useEffect(() => {
  if (!rendition || !containerRef.current) return;

  let injectedDocs = new WeakSet(); // Track which documents have handlers

  const setupSwipeHandlers = (contents: any) => {
    const doc = contents.document;
    if (!doc || injectedDocs.has(doc)) return; // Prevent duplicate injection

    injectedDocs.add(doc);
    console.log('[useEpubReader] Injecting swipe handlers');

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();

      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const duration = touchEndTime - touchStartTime;

      if (Math.abs(deltaX) > 30 && duration < 500 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX > 0) {
          rendition.prev();
        } else {
          rendition.next();
        }
      }
    };

    doc.addEventListener('touchstart', handleTouchStart, { passive: true });
    doc.addEventListener('touchend', handleTouchEnd, { passive: true });
  };

  // Register for future renders (chapter navigation)
  rendition.on('rendered', setupSwipeHandlers);

  // Inject into already-rendered iframe (initial render)
  const iframe = containerRef.current.querySelector('iframe');
  if (iframe?.contentDocument) {
    setupSwipeHandlers({ document: iframe.contentDocument });
  }

  return () => {
    rendition.off('rendered', setupSwipeHandlers);
  };
}, [rendition, containerRef]);
```

## Code References

- `hooks/useEpubReader.ts:28-56` - Book initialization useEffect
- `hooks/useEpubReader.ts:58-75` - Rendition creation useEffect
- `hooks/useEpubReader.ts:102-135` - Working click forwarding pattern
- `hooks/useEpubReader.ts:137-201` - Non-working rendered event listener
- `hooks/useEpubReader.ts:284-289` - Display initial content (triggers race condition)
- `node_modules/epubjs/types/rendition.d.ts:86-87` - display() method signature
- `node_modules/epubjs/types/contents.d.ts:12-19` - Contents interface (passed to rendered event)

## Architecture Documentation

The reader architecture uses a hook-based approach with multiple useEffects managing different aspects of the epub.js lifecycle:

**Hook**: `useEpubReader` ([hooks/useEpubReader.ts](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts))

**Lifecycle Flow**:
1. Book initialization (blob → epub.js book object)
2. Rendition creation (book → rendition attached to DOM)
3. Styling application (theme, fonts applied to rendition)
4. Event listener registration (click, rendered, relocated)
5. Initial display (rendition.display() called)
6. Location tracking (relocated event captures position changes)

**Event Forwarding Pattern**:
The codebase forwards iframe events to parent document for UI interaction. The click forwarding (lines 102-135) demonstrates the working pattern for continuous events.

**React Integration**:
epub.js is integrated via useEffect hooks with careful dependency management to ensure proper lifecycle ordering. However, the `rendered` event use case revealed a race condition where useEffect execution order doesn't guarantee event listener registration timing.

## Related Research

- [thoughts/debugging/2025-11-10-reader-page-not-loading-debug-session.md](file:///Users/seankim/dev/reader/thoughts/debugging/2025-11-10-reader-page-not-loading-debug-session.md) - Context on reader page architecture and Capacitor integration challenges

## Open Questions

1. **Performance**: Does injecting touch handlers on `relocated` (which fires frequently) cause performance issues compared to `rendered` (which fires only on chapter changes)?

2. **Cleanup**: The current implementation doesn't explicitly remove touch event listeners when chapters change. Should we track handlers and remove them before injecting new ones?

3. **WeakSet limitations**: WeakSet prevents duplicate injection but doesn't work if the same document object is reused by epub.js. Should we use a different tracking mechanism?

4. **Multiple iframes**: Does epub.js ever create multiple iframes simultaneously (e.g., for prefetching)? If so, do we need to inject handlers into all of them?

5. **Epub.js hooks**: The types show a `hooks.render` Hook ([rendition.d.ts:61](file:///Users/seankim/dev/reader/node_modules/epubjs/types/rendition.d.ts)). Should we investigate using hooks instead of events for guaranteed execution timing?
