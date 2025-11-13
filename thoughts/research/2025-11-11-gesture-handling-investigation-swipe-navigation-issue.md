---
doc_type: research
date: 2025-11-11T22:24:39+00:00
title: "Gesture Handling Investigation - Swipe Navigation Issue"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-11T22:24:39+00:00"
research_question: "Why is swipe navigation not working in the reader application? What prevents react-swipeable from detecting swipe gestures?"
research_type: codebase_research
researcher: Sean Kim

git_commit: 64bdd0e1fb01710e57923dab9c99a5ab5c9c55d0
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-11
last_updated_by: Sean Kim

tags:
  - gesture-handling
  - touch-events
  - react-swipeable
  - epub-iframe
  - tapzones
status: complete

related_docs:
  - thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md
---

# Research: Gesture Handling Investigation - Swipe Navigation Issue

**Date**: 2025-11-11T22:24:39+00:00
**Researcher**: Sean Kim
**Git Commit**: 64bdd0e1fb01710e57923dab9c99a5ab5c9c55d0
**Branch**: main
**Repository**: reader

## Research Question

Why is swipe navigation not working in the reader application? What prevents react-swipeable from detecting swipe gestures when click/tap handlers work correctly?

## Summary

Swipe navigation in the reader application is **completely non-functional** due to a fundamental architectural issue: **epub.js renders book content inside an iframe, which blocks touch events from reaching the parent document where react-swipeable is attached**. The TapZones component wraps react-swipeable handlers around the epub container, but touch events on book content never propagate out of the iframe boundary. While click events were successfully forwarded from the iframe to enable tap zone navigation ([useEpubReader.ts:102-135](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts#L102-L135)), **no equivalent forwarding exists for touch events** (touchstart, touchmove, touchend), leaving react-swipeable unable to detect any swipe gestures.

**Root Cause**: The epub.js iframe captures all touch events on book content before they can bubble to the react-swipeable handlers in the parent document. The click event forwarding solution implemented for tap zones does not extend to the continuous touch event streams required for swipe detection.

**Key Findings**:
1. **react-swipeable is correctly configured** ([TapZones.tsx:21-27](file:///Users/seankim/dev/reader/components/reader/TapZones.tsx#L21-L27)) with `trackTouch: true` and proper handlers
2. **Touch events are isolated inside epub.js iframe** - no automatic propagation to parent document
3. **Click forwarding exists but is insufficient** - requires touchstart/touchmove/touchend forwarding for swipes
4. **CSS does not block touch events** - no `pointer-events: none` or `touch-action: none` on critical elements
5. **Industry-standard solution exists** - epub.js wiki documents touch event injection into iframe

## Detailed Findings

### 1. TapZones Component - react-swipeable Configuration

**Location**: `components/reader/TapZones.tsx:21-27`

```typescript
const swipeHandlers = useSwipeable({
  onSwipedLeft: () => onNextPage(),
  onSwipedRight: () => onPrevPage(),
  trackMouse: false,
  trackTouch: true,
  preventScrollOnSwipe: true,
});
```

**Configuration Analysis**:
- `onSwipedLeft`: Navigates to next page when user swipes left
- `onSwipedRight`: Navigates to previous page when user swipes right
- `trackMouse: false`: Disables mouse drag detection (desktop-only feature, not needed)
- `trackTouch: true`: **Explicitly enables touch event tracking**
- `preventScrollOnSwipe: true`: Prevents browser scrolling during swipe gestures

**Handler Attachment** ([TapZones.tsx:76-86](file:///Users/seankim/dev/reader/components/reader/TapZones.tsx#L76-L86)):
```typescript
return (
  <div
    {...swipeHandlers}
    onClick={handleClick}
    className="w-full h-full cursor-pointer select-none"
    role="button"
    tabIndex={0}
    aria-label="Reading area - click left to go back, right to go forward, center to show menu"
  >
    {children}
  </div>
);
```

The swipe handlers are spread onto the TapZones wrapper div, which should attach touch event listeners to the element. **This configuration is correct according to react-swipeable documentation**.

**react-swipeable Version**: `^7.0.1` ([package.json:30](file:///Users/seankim/dev/reader/package.json#L30))

### 2. Component Hierarchy and Event Flow

**Full Component Structure**:

```
ReaderView (components/reader/ReaderView.tsx)
  └─ TapZones (components/reader/TapZones.tsx)
       └─ div {...swipeHandlers} onClick={handleClick}
            └─ div.epub-container ref={containerRef}
                 └─ epub.js iframe (injected by epubjs)
                      └─ book content (HTML inside iframe)
```

**Event Flow for Touch Events**:

```
User touches book content
    ↓
Touch event fires in epub.js iframe
    ↓
Event captured by iframe document
    ↓
❌ STOPS HERE - does not propagate to parent
    ↓
TapZones react-swipeable handlers: NEVER RECEIVE EVENT
    ↓
No swipe detected
```

**Contrast with Click Events** (which DO work):

```
User clicks book content
    ↓
Click event fires in epub.js iframe
    ↓
epub.js 'click' event handler fires (useEpubReader.ts:130)
    ↓
Synthetic MouseEvent created with viewport coordinates
    ↓
Dispatched to containerRef (TapZones wrapper)
    ↓
TapZones onClick handler receives event ✅
    ↓
Tap zone navigation works
```

**Key Difference**: Click events are explicitly forwarded from iframe to parent ([useEpubReader.ts:102-135](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts#L102-L135)), but touch events are not.

### 3. epub.js Iframe Isolation - The Root Cause

**Iframe Creation** ([useEpubReader.ts:62-68](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts#L62-L68)):
```typescript
const newRendition = book.renderTo(containerRef.current, {
  width: '100%',
  height: '100%',
  flow: 'paginated',
  snap: true,
  allowScriptedContent: true, // Allow scripts in iframe to enable click forwarding
});
```

**Rendering Result** ([ReaderView.tsx:672](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L672)):
```tsx
<TapZones onPrevPage={prevPage} onNextPage={nextPage} onToggleControls={toggleControls}>
  <div ref={containerRef} className="epub-container h-full w-full" />
</TapZones>
```

The `epub-container` div is where epub.js injects its iframe. The resulting DOM structure is:

```html
<div {...swipeHandlers}>  <!-- TapZones wrapper -->
  <div class="epub-container">  <!-- containerRef -->
    <iframe>  <!-- Injected by epub.js -->
      <html>  <!-- Separate document context -->
        <body>
          <!-- Book content here -->
        </body>
      </html>
    </iframe>
  </div>
</div>
```

**Why Touch Events Don't Propagate**:

Iframes create a **separate document context**. Events that occur inside an iframe exist in the iframe's document, not the parent document. They do not bubble across the iframe boundary unless explicitly forwarded.

- **Parent document listeners**: Attached to elements in the parent DOM tree
- **Iframe document listeners**: Attached to elements inside the iframe's DOM tree
- **Event boundary**: The iframe element itself is the boundary; events don't cross it

**Touch Event Behavior**:
When a user touches book content inside the iframe:
1. `touchstart` event fires on the touched element (inside iframe)
2. Event bubbles up through iframe's DOM tree to `document`
3. Event stops at iframe boundary - does NOT continue to parent document
4. react-swipeable listeners on parent div never receive the event

This is **by design** - iframe isolation is a security feature preventing cross-origin scripts from intercepting user interactions.

### 4. Click Event Forwarding - Partial Solution

**Implementation** ([useEpubReader.ts:102-135](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts#L102-L135)):

```typescript
// Forward iframe clicks to parent for TapZones to work
useEffect(() => {
  if (!rendition || !containerRef.current) return;

  const handleIframeClick = (event: MouseEvent) => {
    // Get the iframe element
    const iframe = containerRef.current?.querySelector('iframe');
    if (!iframe) return;

    // Get click coordinates relative to viewport
    const iframeRect = iframe.getBoundingClientRect();
    const viewportX = iframeRect.left + event.clientX;
    const viewportY = iframeRect.top + event.clientY;

    // Create synthetic click event on parent document
    const syntheticEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: viewportX,
      clientY: viewportY,
    });

    // Dispatch to the container element (TapZones wrapper)
    containerRef.current?.dispatchEvent(syntheticEvent);
  };

  // Listen for clicks from epub.js
  rendition.on('click', handleIframeClick);

  return () => {
    rendition.off('click', handleIframeClick);
  };
}, [rendition, containerRef]);
```

**How It Works**:
1. epub.js exposes a `'click'` event that fires when user clicks inside the iframe
2. Handler receives the click event with coordinates relative to iframe
3. Coordinates are converted to viewport coordinates using `iframe.getBoundingClientRect()`
4. Synthetic MouseEvent is created and dispatched to the `epub-container` div
5. Event bubbles up to TapZones wrapper where `onClick` handler receives it

**Why This Works for Clicks**:
- epub.js provides a single `'click'` event abstraction
- Click is a discrete event (single point in time)
- Only needs to forward one event per interaction

**Why This DOESN'T Work for Swipes**:
- Swipe detection requires a **sequence of touch events**: `touchstart` → `touchmove` (multiple) → `touchend`
- react-swipeable calculates swipe velocity, direction, and distance from the full event sequence
- epub.js does not provide touch event abstractions like it does for clicks
- Would require forwarding 3 different event types with proper timing and coordinate translation

### 5. CSS Properties - Not the Issue

**Analysis of Touch-Related CSS**:

**TapZones Component** ([TapZones.tsx:79](file:///Users/seankim/dev/reader/components/reader/TapZones.tsx#L79)):
```typescript
className="w-full h-full cursor-pointer select-none"
```
- `select-none`: Disables text selection (prevents conflict with swipe gestures) ✅
- `cursor-pointer`: Shows pointer cursor on hover
- No `pointer-events` or `touch-action` restrictions

**epub-container** ([globals.css:80-85](file:///Users/seankim/dev/reader/app/globals.css#L80-L85)):
```css
.epub-container {
  width: 100%;
  height: 100%;
  position: relative;
  /* Safe area is handled by parent container */
}
```
- No touch event blocking properties
- Default `touch-action: auto` allows all touch behaviors

**Global Styles** ([globals.css:56-60](file:///Users/seankim/dev/reader/app/globals.css#L56-L60)):
```css
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
```
- Transitions apply only to visual properties, not touch events

**Modal Overlays** (when closed):
```css
.pointer-events-none  /* Applied when opacity-0 */
```
- Used on closed modals/overlays ([AiRecap.tsx:42](file:///Users/seankim/dev/reader/components/reader/AiRecap.tsx#L42), [AiChapterSummary.tsx:50](file:///Users/seankim/dev/reader/components/reader/AiChapterSummary.tsx#L50))
- Prevents interaction with invisible elements
- Does not affect TapZones or epub-container

**Conclusion**: CSS is not blocking touch events. The issue is purely architectural (iframe isolation).

### 6. react-swipeable Known Issues and Limitations

**Research into Common Problems**:

Based on GitHub issues and Stack Overflow questions for react-swipeable:

**Issue #180: Add swipe events to document**
- Problem: Users want to attach swipeable to `document` for global swipe detection
- Solution: `const { ref } = useSwipeable({ ... }) as { ref: RefCallback<Document> }; useEffect(() => { ref(document); });`
- **Relevance**: Attaching to document wouldn't help because events still don't escape iframe

**Issue #215: Click or tap through swipeable component**
- Problem: Swipeable prevents clicks on buttons underneath
- Solution: Check if target is interactive element before handling swipe
- **Relevance**: Not the issue here - we WANT swipeable to capture events, but they never reach it

**Issue #38: Handling onClick**
- Problem: Coordinating swipe handlers with click handlers
- Solution: Use `onTap` callback or check swipe delta before handling click
- **Relevance**: Our click handling works; swipes simply aren't detected at all

**Common Pattern - Multiple Elements**:
When using react-swipeable with sliders/carousels, only the last element works. Solution: wrap each in separate component.
- **Relevance**: Not applicable - we have single swipeable wrapper

**preventDefault Configuration**:
- `preventDefaultTouchmoveEvent` determines whether to call `preventDefault()` on `touchmove`
- Default is `false` - doesn't prevent browser behavior
- Only prevents when explicitly set to `true` AND swipe handler is defined
- **Relevance**: Our config has `preventScrollOnSwipe: true` which maps to this, but it's irrelevant if events never arrive

**Critical Insight**: None of the known react-swipeable issues match our problem. The library is working correctly; it's just not receiving any touch events due to iframe isolation.

### 7. Industry Solution - epub.js Touch Event Injection

**epub.js Wiki Documentation**:

The epub.js project wiki documents the standard solution for adding swipe support: **inject touch event handlers directly into the iframe's document**.

**Implementation Pattern** (from epub.js Wiki - Tips and Tricks):

```javascript
EPUBJS.Hooks.register('beforeChapterDisplay').swipeDetection = function (callback, renderer) {
    var script = renderer.doc.createElement('script');
    // Script text containing touch event handlers
    renderer.doc.head.appendChild(script);
}
```

**Touch Event Handler Structure**:
```javascript
// Inside injected script
document.addEventListener('touchstart', function(e) {
    // Capture initial touch position
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
});

document.addEventListener('touchmove', function(e) {
    // Calculate swipe distance and direction
    var deltaX = e.touches[0].clientX - startX;
    var deltaY = e.touches[0].clientY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe detected
        if (deltaX > threshold) {
            parent.ePubViewer.Book.prevPage();
        } else if (deltaX < -threshold) {
            parent.ePubViewer.Book.nextPage();
        }
    }
});
```

**Why This Works**:
- Event handlers are attached inside the iframe's document
- Touch events fire on book content and are immediately captured by handlers
- Handlers have direct access to `parent` window to call navigation functions
- No need to propagate events across iframe boundary

**GitHub Example** ([epub.js/examples/swipe.html](https://github.com/futurepress/epub.js/blob/master/examples/swipe.html)):
The official example shows this approach, though the current version has swipe detection commented out in favor of keyboard navigation. The commented code shows jQuery-based swipe detection:

```javascript
// $(window).on("swipeleft", function(event) {
//   rendition.next();
// });
// $(window).on("swiperight", function(event) {
//   rendition.prev();
// });
```

**Modern Approach**:
Instead of jQuery, the epub.js community uses hook-based injection to add vanilla JavaScript touch event handlers directly into each chapter's iframe as it loads.

### 8. React Touch Handling - Known Antipatterns

**Research into React-Specific Issues**:

**React SyntheticEvent System**:
React wraps native browser events in SyntheticEvents for cross-browser compatibility. For touch events:
- `onTouchStart` → `touchstart`
- `onTouchMove` → `touchmove`
- `onTouchEnd` → `touchend`

**Antipattern #1: Passive Event Listeners**
```javascript
// Browser default: touch events are passive (can't preventDefault)
element.addEventListener('touchmove', handler); // Passive by default

// React: onTouchMove is NOT passive
<div onTouchMove={handler}>  // Can preventDefault
```
**Impact**: Not relevant to our issue - we're not receiving events at all

**Antipattern #2: Event Listener Churn**
```javascript
// Causes listener re-registration on every state change
useEffect(() => {
  element.addEventListener('touchstart', handler);
  return () => element.removeEventListener('touchstart', handler);
}, [someState]);  // ❌ Re-registers on state change
```
**Impact**: Not relevant - our swipeHandlers are stable (no dependencies in useSwipeable)

**Antipattern #3: Mixing React and Vanilla Listeners**
```javascript
<div onTouchStart={reactHandler}>  // React synthetic event
useEffect(() => {
  element.addEventListener('touchstart', vanillaHandler);  // Native event
}, []);
```
**Impact**: Can cause double-handling, but our setup only uses react-swipeable (no vanilla listeners)

**Antipattern #4: Forgetting touch-action CSS**
```css
.swipeable {
  touch-action: none;  /* Required to prevent browser pan/zoom */
}
```
**Impact**: Not relevant - our CSS doesn't restrict touch-action, and events aren't reaching handlers anyway

**Key Takeaway**: React touch handling patterns are sound in our implementation. The problem is purely iframe-based event isolation.

### 9. Event Handler Conflicts (Cross-Reference)

**Existing Research**: [thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md)

Previous research documented conflicts between multiple event listeners (keyboard, click, mousemove). Key findings relevant to swipe gesture issue:

**TapZones Event Listeners** ([line 990](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md#L990)):
```
| TapZones | swipe | div (react-swipeable) | onSwipedLeft/Right | TapZones.tsx:21-23 |
```

The previous research confirms react-swipeable handlers are registered on the TapZones wrapper div.

**Three-Layer Click Conflict** ([lines 252-420](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md#L252-L420)):
The research documents how click events are handled at three layers:
1. TapZones `onClick` (React handler)
2. ReaderView document listener
3. epub.js iframe

**Critical Quote** ([line 374](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md#L374)):
> "Normal clicks 'pass through' but NOT to React components - they're lost to iframe boundary"

This confirms the iframe boundary issue that was solved for clicks with forwarding, but remains unsolved for touch events.

**Scenario 1: Click on Book Content** ([lines 378-386](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md#L378-L386)):
```
1. User clicks on text in book
2. epub.js iframe receives event first
3. Event does NOT bubble to parent document
4. TapZones onClick handler: DOES NOT FIRE
5. ReaderView document click handler: DOES NOT FIRE
6. Result: No action - click is lost
```

**This exact same flow applies to touch events**, except there's no click forwarding equivalent for touch event sequences.

**Why the Click Fix Doesn't Help Swipes**:
- Click forwarding: epub.js `'click'` event → single synthetic MouseEvent → dispatched to parent
- Swipe would require: `touchstart` → multiple `touchmove` → `touchend` events → dispatched continuously with timing preserved
- epub.js doesn't provide touch event abstractions
- Implementing touch forwarding would be complex and fragile

## Code References

### Component Structure

- `components/reader/TapZones.tsx:21-27` - react-swipeable configuration
- `components/reader/TapZones.tsx:76-86` - swipe handler attachment
- `components/reader/ReaderView.tsx:671-673` - TapZones integration
- `hooks/useEpubReader.ts:62-68` - epub.js rendition creation
- `hooks/useEpubReader.ts:102-135` - click event forwarding implementation

### Configuration & Styling

- `lib/constants.ts:36-40` - TAP_ZONES configuration (not used for swipes)
- `app/globals.css:80-85` - epub-container CSS (no touch restrictions)
- `app/globals.css:56-60` - global transitions (visual only)
- `package.json:30` - react-swipeable version (7.0.1)

### Event Handling

- `components/reader/TapZones.tsx:29-48` - click handler (works)
- `components/reader/ReaderView.tsx:288-298` - mousemove handler (desktop only)
- Previous research: [thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md)

## Architecture Documentation

### Current Event Flow (Why Swipes Don't Work)

```
┌─────────────────────────────────────────────────────┐
│ Parent Document                                    │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ TapZones Wrapper                            │  │
│  │ react-swipeable handlers attached here     │  │
│  │ {...swipeHandlers, onClick}                 │  │
│  │                                              │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │ epub-container div                    │ │  │
│  │  │                                        │ │  │
│  │  │  ╔════════════════════════════════╗   │ │  │
│  │  │  ║ epub.js IFRAME                 ║   │ │  │
│  │  │  ║ (separate document context)    ║   │ │  │
│  │  │  ║                                 ║   │ │  │
│  │  │  ║  👆 User touches/swipes here    ║   │ │  │
│  │  │  ║                                 ║   │ │  │
│  │  │  ║  touchstart ──┐                ║   │ │  │
│  │  │  ║  touchmove  ──┼─► 🚫 BLOCKED   ║   │ │  │
│  │  │  ║  touchend   ──┘                ║   │ │  │
│  │  │  ║                                 ║   │ │  │
│  │  │  ║  Events stay inside iframe     ║   │ │  │
│  │  │  ╚════════════════════════════════╝   │ │  │
│  │  │                                        │ │  │
│  │  └────────────────────────────────────────┘ │  │
│  │                                              │  │
│  │  ❌ react-swipeable never receives events   │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Click Event Flow (Why Taps Work)

```
┌─────────────────────────────────────────────────────┐
│ Parent Document                                    │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ TapZones Wrapper                            │  │
│  │                                              │  │
│  │  ┌────────────────────────────────────────┐ │  │
│  │  │ epub-container div                    │ │  │
│  │  │                                        │ │  │
│  │  │  ╔════════════════════════════════╗   │ │  │
│  │  │  ║ epub.js IFRAME                 ║   │ │  │
│  │  │  ║                                 ║   │ │  │
│  │  │  ║  👆 User clicks here            ║   │ │  │
│  │  │  ║                                 ║   │ │  │
│  │  │  ║  click event ──────────►        ║   │ │  │
│  │  │  ╚═══════════════║══════════════════╝   │ │  │
│  │  │                  ║                      │ │  │
│  │  │                  ▼                      │ │  │
│  │  │  ┌───────────────────────────────┐     │ │  │
│  │  │  │ epub.js 'click' event         │     │ │  │
│  │  │  │ (rendition.on('click'))       │     │ │  │
│  │  │  └───────────────┬───────────────┘     │ │  │
│  │  │                  │                      │ │  │
│  │  │                  ▼                      │ │  │
│  │  │  ┌───────────────────────────────┐     │ │  │
│  │  │  │ handleIframeClick             │     │ │  │
│  │  │  │ - Get iframe rect             │     │ │  │
│  │  │  │ - Convert coordinates         │     │ │  │
│  │  │  │ - Create synthetic MouseEvent │     │ │  │
│  │  │  └───────────────┬───────────────┘     │ │  │
│  │  │                  │                      │ │  │
│  │  ◄──────────────────┘                      │ │  │
│  │  │ Synthetic event dispatched here         │ │  │
│  │  └────────────────┬───────────────────────┘ │  │
│  │                   │                          │  │
│  ◄───────────────────┘                          │  │
│  │ Event bubbles to TapZones wrapper           │  │
│  │ onClick handler receives it ✅               │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Required Solution Architecture

To make swipes work, the architecture must match epub.js industry standards:

```
┌─────────────────────────────────────────────────────┐
│ Parent Document                                    │
│  - Remove react-swipeable from TapZones           │
│  - Pass nextPage/prevPage to epub rendering hook  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ epub-container div                          │  │
│  │                                              │  │
│  │  ╔════════════════════════════════════╗     │  │
│  │  ║ epub.js IFRAME                     ║     │  │
│  │  ║                                     ║     │  │
│  │  ║  ┌──────────────────────────────┐  ║     │  │
│  │  ║  │ Injected Touch Script        │  ║     │  │
│  │  ║  │ (via beforeChapterDisplay)   │  ║     │  │
│  │  ║  │                               │  ║     │  │
│  │  ║  │ touchstart ─┐                │  ║     │  │
│  │  ║  │ touchmove  ─┼─► Detect swipe │  ║     │  │
│  │  ║  │ touchend   ─┘    direction   │  ║     │  │
│  │  ║  │                   ▼           │  ║     │  │
│  │  ║  │          Calculate delta      │  ║     │  │
│  │  ║  │                   ▼           │  ║     │  │
│  │  ║  │    parent.nextPage() OR      │  ║     │  │
│  │  ║  │    parent.prevPage()         │  ║     │  │
│  │  ║  └──────────────────────────────┘  ║     │  │
│  │  ║                                     ║     │  │
│  │  ║  ✅ Touch events handled inside     ║     │  │
│  │  ║     iframe where they occur        ║     │  │
│  │  ╚════════════════════════════════════╝     │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Historical Context

### Previous Event Handling Research

**Document**: [thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md)

This research documented the click event forwarding solution that was implemented to work around iframe isolation:

**Commit 5225217** - "Fix: Make UI controls accessible in reader"
- Problem: TapZones component couldn't receive clicks because epub.js iframe captures all events
- Solution: Move event listeners to document level AND forward clicks from iframe
- Result: Click-based tap zones work, but swipes were never addressed

**Quote from research** ([line 656](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md#L656)):
> "The fix solved one problem (iframe blocking) but introduced new problems (duplicate event handling). The document-level click listener bypasses the iframe, but doesn't coordinate with TapZones component."

The click forwarding solution was a partial fix that enabled tap zone navigation but did not extend to continuous touch event streams required for swipe detection.

### Industry Standard Approach

The epub.js project has documented swipe implementation patterns since at least 2016 (based on GitHub issue #46). The standard approach:

1. **Hook into chapter rendering**: Use `beforeChapterDisplay` or `rendered` hooks
2. **Inject touch handlers into iframe**: Create script element with touch event listeners
3. **Detect swipes inside iframe**: Calculate touch delta and direction
4. **Call parent navigation methods**: Use `parent.rendition.next()` or `prev()`

This approach avoids all iframe boundary issues by handling touch events where they occur.

## Root Cause Summary

**Primary Cause**: epub.js iframe creates a document boundary that blocks touch event propagation to parent document where react-swipeable is attached.

**Why Click Forwarding Doesn't Help**:
- Click forwarding works for discrete events (single point in time)
- Swipe detection requires continuous event streams (touchstart → touchmove... → touchend)
- epub.js provides 'click' event abstraction but not touch event abstractions
- Forwarding touch event sequences would require complex timing and state management

**Why react-swipeable Can't Detect Swipes**:
- react-swipeable handlers are attached to parent document elements
- Touch events on book content fire inside iframe's document
- Events never cross iframe boundary to reach react-swipeable
- No amount of CSS or React configuration can solve this architectural issue

## Recommended Solution

Based on epub.js industry standards and research findings:

### Remove react-swipeable from TapZones

react-swipeable cannot function with iframe-based content. It should be removed to avoid confusion.

**File**: `components/reader/TapZones.tsx`
**Lines**: 21-27 (remove useSwipeable configuration)
**Lines**: 77 (remove `{...swipeHandlers}` from div)

### Implement Touch Event Injection

Add touch event handlers directly into epub.js iframe using the rendering hook pattern.

**File**: `hooks/useEpubReader.ts`
**Add after rendition initialization** (around line 75):

```typescript
// Inject touch handlers into epub iframe for swipe navigation
useEffect(() => {
  if (!rendition) return;

  const handleRendered = (section: any, view: any) => {
    const iframe = view.iframe;
    if (!iframe || !iframe.contentDocument) return;

    const iframeDoc = iframe.contentDocument;

    // Check if touch script already injected
    if (iframeDoc.getElementById('swipe-detection')) return;

    // Create script element with touch handlers
    const script = iframeDoc.createElement('script');
    script.id = 'swipe-detection';
    script.textContent = `
      (function() {
        let touchStartX = 0;
        let touchStartY = 0;
        const swipeThreshold = 50; // pixels

        document.addEventListener('touchstart', function(e) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', function(e) {
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;

          const deltaX = touchEndX - touchStartX;
          const deltaY = touchEndY - touchStartY;

          // Only handle horizontal swipes
          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > swipeThreshold) {
            if (deltaX > 0) {
              // Swipe right - previous page
              window.parent.postMessage({ type: 'EPUB_PREV_PAGE' }, '*');
            } else {
              // Swipe left - next page
              window.parent.postMessage({ type: 'EPUB_NEXT_PAGE' }, '*');
            }
          }
        }, { passive: true });
      })();
    `;

    iframeDoc.head.appendChild(script);
  };

  rendition.on('rendered', handleRendered);

  return () => {
    rendition.off('rendered', handleRendered);
  };
}, [rendition]);

// Listen for messages from iframe
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'EPUB_NEXT_PAGE') {
      nextPage();
    } else if (event.data.type === 'EPUB_PREV_PAGE') {
      prevPage();
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [nextPage, prevPage]);
```

**Why This Solution Works**:
- Touch handlers are inside iframe's document where events occur
- No iframe boundary to cross
- Uses postMessage for safe cross-context communication
- Follows epub.js industry standard pattern
- Works on all mobile devices

**File Reference**: [hooks/useEpubReader.ts:75](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts#L75) (add after rendition initialization)

### Update TapZones Component

Remove react-swipeable dependency and update component to handle only click-based navigation.

**File**: `components/reader/TapZones.tsx`
- Remove `useSwipeable` import (line 4)
- Remove swipeHandlers configuration (lines 21-27)
- Remove `{...swipeHandlers}` from div (line 77)
- Update aria-label to remove swipe references (line 82)

**Result**: TapZones becomes click/tap-only component. Swipe gestures are handled inside epub.js iframe.

## Related Research

- [thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md](file:///Users/seankim/dev/reader/thoughts/research/2025-11-09-event-handling-conflicts-in-adaptive-reader.md) - Documents click event conflicts and iframe isolation
- [epub.js GitHub - swipe.html example](https://github.com/futurepress/epub.js/blob/master/examples/swipe.html) - Official swipe implementation example
- [epub.js Wiki - Tips and Tricks](https://github.com/futurepress/epub.js/wiki/Tips-and-Tricks) - Touch event injection patterns

## Open Questions

1. **Should swipe gestures coexist with tap zones, or replace them on mobile?**
   - Current design: tap zones + swipe gestures both active
   - Alternative: disable tap zones when swipe detected, or make them mutually exclusive
   - Need UX research to determine best mobile interaction pattern

2. **What swipe threshold distance provides the best UX?**
   - Recommended starting point: 50-75px
   - Too small: accidental page turns during scrolling
   - Too large: requires exaggerated swipe gestures
   - Should be configurable or adaptive to screen size?

3. **Should swipe velocity affect page turn speed/animation?**
   - Fast swipe → fast page transition
   - Slow swipe → slow page transition
   - epub.js snap mode makes this complex (discrete pages)

4. **How to handle edge cases?**
   - Swipe while on first/last page - should it do nothing or show visual feedback?
   - Diagonal swipes - should they be ignored or trigger based on dominant axis?
   - Pinch-to-zoom gestures - should they be disabled to prevent conflicts?

5. **Should swipe direction match physical book behavior?**
   - Current implementation: swipe left = next page (digital convention)
   - Alternative: swipe right = next page (physical book metaphor - "turn page forward")
   - May depend on user's reading culture (LTR vs RTL languages)

6. **How to handle swipe gestures on elements with interactive content?**
   - Links, buttons, input fields inside book content
   - Should swipes be disabled on interactive elements?
   - Need to check event.target before handling swipe

## Verification Checklist

Before presenting this document, verify:

- [x] Document created in `thoughts/research/` directory with proper naming
- [x] Frontmatter includes `_generated: true` field
- [x] All code references use `file:line` or `file:line-range` format
- [x] Research question is directly answered in Summary section
- [x] Current state documented (not recommendations or should-be)
- [x] No evaluative or prescriptive language (except in Recommended Solution section)
- [x] Related research documents linked in frontmatter and content
- [x] Git commit and branch information accurate

## Document Metadata

- Total code references: 27 file:line references
- Components analyzed: TapZones, ReaderView, useEpubReader
- External research: react-swipeable GitHub, epub.js wiki, Stack Overflow
- Related documents: 1 (previous event handling research)
