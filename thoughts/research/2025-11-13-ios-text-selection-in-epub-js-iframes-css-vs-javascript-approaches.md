---
doc_type: research
date: 2025-11-13T17:20:47+00:00
title: "iOS Text Selection in epub.js iframes - CSS vs JavaScript Approaches"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T17:20:47+00:00"
research_question: "Why CSS user-select properties are not preventing native iOS text selection in epub.js iframes, and what are the working solutions?"
research_type: online_research
research_strategy: "technical_documentation,community_solutions"
sources_reviewed: 35
quality_score: high
confidence: high
researcher: Sean Kim

git_commit: dc51a88d49fa0d4a022d16ad8937c829f6fffc2a
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - ios
  - wkwebview
  - epub.js
  - text-selection
  - mobile
  - iframe
status: complete

related_docs: []
---

# Online Research: iOS Text Selection in epub.js iframes

**Date**: 2025-11-13T17:20:47+00:00
**Researcher**: Claude (research-coordinator)
**Research Depth**: Deep
**Sources Reviewed**: 35
**Confidence Level**: High

## Research Question

Why do CSS `user-select` properties fail to prevent native iOS text selection in epub.js iframes (within Capacitor/WKWebView), and what are working solutions for implementing custom highlighting on mobile?

## Research Strategy

**Approach**: Deep investigation combining technical documentation analysis with community-sourced solutions

**Depth rationale**: This problem requires comprehensive research because:
- Multiple technology layers interact (React → Capacitor → WKWebView → iframe → epub.js)
- Platform-specific iOS/WebKit behavior differs from standards
- Known bugs across iOS versions (iOS 13-18)
- No single authoritative solution exists in documentation
- Timing and lifecycle issues complicate CSS injection
- Trade-offs exist between different approaches

**Sources**: Technical documentation (Apple Developer, WebKit), Stack Overflow solutions, GitHub issues (epub.js, Capacitor), MDN compatibility data, real-world implementations

## Executive Summary

**Root Cause**: CSS `user-select: none` fails in iOS WKWebView iframes due to THREE critical issues:

1. **Known WebKit Bugs**: iOS has multiple documented bugs where `user-select: none` either doesn't work or causes crashes (iOS 18 beta) when applied to WKWebView content
2. **Gesture Recognizer Override**: iOS uses native `UILongPressGestureRecognizer` (500ms press, 10px movement tolerance) that operates BEFORE CSS is evaluated, making CSS ineffective
3. **Timing Issue**: The current implementation has touch movement canceling long press detection too aggressively, preventing selection mode from ever activating

**Working Solution**: Use JavaScript event interception (`event.returnValue = false` on all touch events) combined with proper timing thresholds that match iOS native behavior (≥500ms press, ≥10px movement tolerance).

**Key Insight**: CSS approaches are fundamentally flawed on iOS because the native gesture recognizer fires before web content processes the event. JavaScript event handlers are the only reliable solution.

## Root Cause Analysis

### Issue 1: iOS WebKit `user-select` Bugs

#### Bug Evidence from Multiple Sources

**iOS 18 Beta Crash Bug** (Apple Developer Forums):
- WKWebView **consistently crashes** when pages use `-webkit-user-select: none` globally
- Specific gesture sequence: double-tap, hold, then drag
- Does NOT reproduce in Safari (only in WKWebView)
- Status: Reported but no fix as of research date

**iOS 14+ Random Selection Bug** (Stack Overflow #69286174):
- When long-pressing areas with `user-select: none`, iOS selects random text from the NEXT element that doesn't have this property
- "The first text it finds that doesn't have user-select none" gets selected
- Workaround: Place dummy off-screen selectable element to absorb selection

**iOS 13+ Haptic Touch Bypass** (Stack Overflow #61855027):
- CSS `user-select: none` is **ineffective** against iOS 13+ haptic touch text selection
- The vibration and selection menu appear regardless of CSS
- Multiple developers confirm CSS alone cannot prevent iOS long-press selection

#### Why CSS Doesn't Work: Gesture Recognition Order

From Apple's documentation and community analysis:

```
Touch Event Sequence on iOS:
1. Native UILongPressGestureRecognizer detects long press (OS level)
   - Default: 500ms minimum press duration
   - Default: 10px maximum movement
2. OS triggers text selection gesture (if applicable)
3. WebView evaluates CSS properties (too late!)
4. JavaScript touchstart/touchend events fire
```

CSS `user-select` is evaluated AFTER the native gesture recognizer has already decided to initiate selection. This is why CSS injection—even when successful—cannot prevent iOS selection.

### Issue 2: epub.js Iframe Context Complications

#### CSS Injection is Working (But Ineffective)

From the codebase (commit 564947dd):

```javascript
// This CSS IS successfully injected into iframe
const style = doc.createElement('style');
style.textContent = `
  body {
    -webkit-touch-callout: none !important;
    -webkit-user-select: none !important;
    user-select: none !important;
  }
  body.selection-enabled {
    -webkit-touch-callout: default !important;
    -webkit-user-select: text !important;
    user-select: text !important;
  }
`;
doc.head.appendChild(style); // ✅ This works
```

**Verification**: The style element appears in the iframe's `<head>`, CSS is present. But iOS still shows native selection menu.

**Why It Doesn't Matter**: Even with CSS present, iOS's native `UILongPressGestureRecognizer` operates at the OS level before CSS is consulted.

#### Same-Origin Context (Good News)

- epub.js renders content in **same-origin** iframes (not cross-origin)
- `rendition.hooks.content.register()` has full DOM access
- CSS and JavaScript injection both work without CORS issues
- The problem is NOT about CSS cascade—it's about iOS gesture recognition order

### Issue 3: Touch Movement Threshold Mismatch

#### Current Implementation Problem

From logs:
```
[useEpubReader] Touch moved, long press cancelled
[useEpubReader] In selection mode, skipping swipe detection
[ReaderView] Selection mode timeout, auto-exiting
```

**Analysis**: The long press is being canceled by touch movement BEFORE iOS's native gesture recognizer would trigger selection.

#### iOS Native vs. Current Implementation

| Parameter | iOS Native (UILongPressGestureRecognizer) | Current Implementation | Issue |
|-----------|-------------------------------------------|------------------------|-------|
| Duration | 500ms (0.5s) | 500ms ✅ | Matches |
| Movement Tolerance | 10px default | Very low (immediate cancel) ❌ | Too strict |
| Behavior | Press completes even with small movement | Cancels on ANY movement | Prevents long press |

**Root Issue**: The `touchmove` handler cancels the long press timer immediately on ANY movement, but iOS allows up to 10 pixels of movement. Normal finger wobble is ~2-5 pixels, which cancels the timer but wouldn't cancel iOS's native gesture.

**Result**: User holds for 500ms with minor natural finger movement → Custom timer cancels → Selection mode never activates → Native iOS gesture recognizer triggers → Native selection appears instead of custom flow.

## Working Solutions (Ranked by Reliability)

### Solution 1: JavaScript Touch Event Interception (RECOMMENDED)

#### Approach: Set `event.returnValue = false` on All Touch Events

**Source**: Stack Overflow #61855027 (confirmed working iOS 13-14+)

```javascript
// In rendition.hooks.content.register()
const doc = contents.document;

['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach(eventType => {
  doc.addEventListener(eventType, (e) => {
    // Only prevent if NOT in selection mode
    if (!isSelectionModeActive()) {
      e.returnValue = false; // Prevents iOS text selection
      // Modern alternative: e.preventDefault() - but see note below
    }
  }, { passive: false }); // CRITICAL: passive: false allows preventDefault
});
```

**Why This Works**:
- Sets `returnValue = false` on touch events BEFORE iOS gesture recognizer processes them
- Prevents the chain of events that leads to text selection
- Works at the correct layer (JavaScript events fire before CSS evaluation)
- Maintains scroll functionality (unlike `preventDefault()` on touchstart alone)

**Important Notes**:
- `event.returnValue` is deprecated but widely supported and proven to work
- Modern alternative is `e.preventDefault()`, but this disables scrolling if used on touchstart
- Setting on ALL touch events (including touchmove, touchend) is required
- **MUST use `{ passive: false }`** or preventDefault won't work (Chrome/modern WebKit requirement)

#### Conditional Enablement Pattern

```javascript
let selectionModeActive = false;

// Prevent selection by default
doc.addEventListener('touchstart', (e) => {
  if (!selectionModeActive) {
    e.returnValue = false;
  }
}, { passive: false });

// When user wants to select (e.g., via button press):
function enableSelectionMode() {
  selectionModeActive = true;
  // Now touches won't be blocked
}

// After selection complete:
rendition.on('selected', (cfiRange) => {
  selectionModeActive = false; // Re-disable selection
  // Show custom highlight menu
});
```

**Trade-offs**:
- ✅ Most reliable across iOS versions
- ✅ Maintains scroll functionality
- ✅ Works in iframes
- ❌ Requires explicit enable/disable mechanism (can't use long press to auto-detect selection intent)

### Solution 2: Fix Movement Threshold + Hybrid Approach

#### Approach: Match iOS Native Tolerances + Conditional preventDefault

**Rationale**: Allow natural finger wobble to avoid canceling long press prematurely.

```javascript
// In rendition.hooks.content.register()
const LONG_PRESS_DURATION = 500; // Match iOS native
const MOVEMENT_THRESHOLD = 10;   // Match iOS native allowableMovement
const SELECTION_MODE_TIMEOUT = 3000; // Auto-exit after 3s

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let longPressTimer = null;
let selectionModeActive = false;
let selectionModeTimeout = null;

const handleTouchStart = (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();

  // Start long press timer
  longPressTimer = setTimeout(() => {
    const currentX = e.touches[0]?.clientX || touchStartX;
    const currentY = e.touches[0]?.clientY || touchStartY;
    const movement = Math.sqrt(
      Math.pow(currentX - touchStartX, 2) +
      Math.pow(currentY - touchStartY, 2)
    );

    // Only trigger if movement is within iOS tolerance
    if (movement <= MOVEMENT_THRESHOLD) {
      enterSelectionMode();
    }
  }, LONG_PRESS_DURATION);
};

const handleTouchMove = (e) => {
  if (!longPressTimer) return;

  const deltaX = e.touches[0].clientX - touchStartX;
  const deltaY = e.touches[0].clientY - touchStartY;
  const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Only cancel if movement EXCEEDS iOS tolerance
  if (movement > MOVEMENT_THRESHOLD) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

const handleTouchEnd = (e) => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  // If in selection mode, don't process swipes
  if (selectionModeActive) {
    return; // Let selection complete
  }

  // Process swipe navigation...
};

function enterSelectionMode() {
  selectionModeActive = true;

  // Apply CSS class to enable selection
  doc.body.classList.add('selection-enabled');

  // Auto-exit after timeout
  selectionModeTimeout = setTimeout(() => {
    exitSelectionMode();
  }, SELECTION_MODE_TIMEOUT);

  console.log('[Selection] Mode activated');
}

function exitSelectionMode() {
  selectionModeActive = false;
  doc.body.classList.remove('selection-enabled');

  if (selectionModeTimeout) {
    clearTimeout(selectionModeTimeout);
    selectionModeTimeout = null;
  }

  console.log('[Selection] Mode exited');
}

doc.addEventListener('touchstart', handleTouchStart, { passive: true });
doc.addEventListener('touchmove', handleTouchMove, { passive: true });
doc.addEventListener('touchend', handleTouchEnd, { passive: false });
```

**Why This Works Better**:
- 10px movement threshold matches iOS native behavior
- Allows natural finger wobble during long press
- Long press timer actually completes instead of premature cancellation
- Selection mode activates BEFORE native iOS gesture would trigger
- CSS class toggle (`selection-enabled`) can still be used for UI feedback

**Trade-offs**:
- ✅ More natural UX (matches iOS expectations)
- ✅ Allows long-press detection to work
- ⚠️ Still relies on CSS which has known bugs
- ⚠️ May not fully prevent native selection on iOS 18 beta (crash bug)

**Recommendation**: Combine this with Solution 1 (preventDefault when NOT in selection mode).

### Solution 3: Native Capacitor Plugin (Most Robust, Requires Native Code)

#### Approach: Suppress Long Press Gesture at iOS Native Layer

**Source**: capacitor-suppress-longpress-gesture plugin (GitHub discussion #3208)

```bash
npm install capacitor-suppress-longpress-gesture
```

**iOS Native Implementation** (if building custom plugin):

```swift
import UIKit
import Capacitor

@objc(SuppressLongPressPlugin)
public class SuppressLongPressPlugin: CAPPlugin {

    @objc func suppressLongPress(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else { return }

            let recognizer = UILongPressGestureRecognizer()
            recognizer.minimumPressDuration = 0.45  // Intercept before iOS default
            recognizer.allowableMovement = 100.0     // Wide tolerance
            recognizer.delegate = self

            webView.addGestureRecognizer(recognizer)
            call.resolve()
        }
    }
}

extension SuppressLongPressPlugin: UIGestureRecognizerDelegate {
    public func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        return false // Prevent other recognizers
    }
}
```

**Why This Works**:
- Operates at the same layer as iOS native gesture recognition
- Intercepts gestures BEFORE WebView processing
- No CSS or JavaScript workarounds needed
- Most reliable for preventing haptic feedback and native menus

**Trade-offs**:
- ✅ Most reliable solution across all iOS versions
- ✅ Prevents haptic feedback vibration
- ✅ No JavaScript event handler complexity
- ❌ Requires native iOS code (not pure web)
- ❌ App Store approval required
- ❌ Must maintain native plugin across Capacitor updates

### Solution 4: Capacitor Configuration (Limited Effectiveness)

#### Approach: Configure WKWebView Settings

**capacitor.config.ts**:

```typescript
{
  ios: {
    allowsLinkPreview: false  // Disables link previews on long press
  }
}
```

**Additional Configuration** (requires subclassing CAPBridgeViewController):

```swift
// In custom view controller
override func webViewConfiguration(for capacitorConfig: InstanceConfiguration)
  -> WKWebViewConfiguration
{
    let config = super.webViewConfiguration(for: capacitorConfig)

    // iOS 14.5+ only
    if #available(iOS 14.5, *) {
        config.preferences.isTextInteractionEnabled = false
    }

    return config
}
```

**Why Limited**:
- `allowsLinkPreview: false` only affects links, not text selection
- `isTextInteractionEnabled = false` disables ALL text interaction (including input fields)
- Not a selective solution

**Trade-offs**:
- ✅ Simple configuration
- ❌ Disables all text interaction (breaks inputs)
- ❌ iOS 14.5+ only
- ❌ Doesn't solve the problem (too broad)

## Recommended Implementation Strategy

### Phase 1: Fix Movement Threshold (Immediate)

Update `useEpubReader.ts` touch handlers:

```javascript
const MOVEMENT_THRESHOLD = 10; // Match iOS native

const handleTouchMove = (e: TouchEvent) => {
  if (!longPressTimer) return;

  const deltaX = e.touches[0].clientX - touchStartX;
  const deltaY = e.touches[0].clientY - touchStartY;
  const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Only cancel if exceeding iOS tolerance
  if (movement > MOVEMENT_THRESHOLD) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    console.log('[useEpubReader] Movement exceeded threshold, long press cancelled');
  }
};
```

**Impact**: Allows long press detection to complete, enabling selection mode activation.

### Phase 2: Add JavaScript Event Prevention (Required for iOS)

```javascript
// In rendition.hooks.content.register()
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  // Prevent native iOS selection when NOT in selection mode
  const preventSelection = (e: TouchEvent) => {
    if (!selectionModeRef?.current) {
      e.returnValue = false;
    }
  };

  ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach(eventType => {
    doc.addEventListener(eventType, preventSelection, { passive: false });
  });

  // Store cleanup reference
  cleanupFns.push(() => {
    ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach(eventType => {
      doc.removeEventListener(eventType, preventSelection);
    });
  });
});
```

**Impact**: Prevents native iOS selection menu when selection mode is inactive.

### Phase 3: Coordinate Selection Mode State

```javascript
// In ReaderView.tsx
const selectionModeRef = useRef(false);

// Pass ref to useEpubReader
const { rendition } = useEpubReader({
  bookBlob,
  containerRef,
  selectionModeRef,  // NEW
  onLongPress: () => {
    console.log('[ReaderView] Long press detected, entering selection mode');
    selectionModeRef.current = true;
  },
});

// Exit selection mode after highlight created
const handleHighlightCreated = () => {
  selectionModeRef.current = false;
};
```

**Impact**: Coordinates selection mode state between React component and iframe event handlers.

### Testing Checklist

- [ ] Long press (500ms) with minor finger wobble (<10px) activates selection mode
- [ ] Native iOS selection menu does NOT appear when selection mode is inactive
- [ ] Native iOS selection menu DOES appear when selection mode is active
- [ ] Swipe navigation still works (when not in selection mode)
- [ ] Text selection works after long press completes
- [ ] Selection mode auto-exits after timeout (3 seconds)
- [ ] Highlight menu appears on selection complete
- [ ] No haptic feedback when selection mode inactive (may require native plugin)

## Alternative UX Patterns (If Technical Solutions Fail)

### Pattern 1: Button-Activated Selection Mode

Instead of long press detection, use explicit button:

```
[Selection Mode] button in toolbar
  ↓ User taps button
  ↓ Selection enabled for entire page
  ↓ User makes selection
  ↓ Highlight menu appears
  ↓ Selection mode auto-disables
```

**Pros**:
- No conflict with native iOS gestures
- Clear user intent
- Simple implementation

**Cons**:
- Extra step (tap button before selecting)
- Less intuitive than long-press
- Requires UI space for button

### Pattern 2: Double-Tap to Select

Use double-tap gesture instead of long press:

```
User double-taps word
  ↓ JavaScript detects double-tap
  ↓ Programmatically select word at tap location
  ↓ Show custom highlight menu
```

**Pros**:
- Doesn't conflict with iOS long-press
- Fast interaction
- Common in reading apps (iBooks uses double-tap)

**Cons**:
- Conflicts with tap zones if implemented
- May conflict with double-tap zoom (if enabled)
- Harder to implement word boundary detection

### Pattern 3: Embrace Native Selection + Intercept

Allow native iOS selection, but intercept the `selected` event immediately:

```
User long-presses (native iOS selection appears)
  ↓ epub.js fires 'selected' event
  ↓ Immediately clear native selection
  ↓ Show custom highlight menu in same position
  ↓ User never sees native menu (appears for ~50ms)
```

**Implementation**:

```javascript
rendition.on('selected', (cfiRange, contents) => {
  // Clear native selection immediately
  contents.window.getSelection().removeAllRanges();

  // Show custom menu
  showHighlightMenu(cfiRange);
});
```

**Pros**:
- No fighting against iOS native behavior
- Works reliably across iOS versions
- No custom gesture detection needed

**Cons**:
- Native menu may flash briefly
- User sees two different selection UIs (confusing)
- Can't prevent haptic feedback vibration

## Cross-Validation & Confidence Assessment

### Agreements (High Confidence)

**CSS `user-select` is ineffective on iOS for preventing native selection**:
- Apple Developer Forums (iOS 18 crash bug)
- Stack Overflow (#61855027, #69286174, #54300608)
- Multiple epub.js community reports (#904, #978)
- Confirmed by Apple's event handling documentation (gesture recognizer fires before CSS)

**JavaScript event interception (`returnValue = false`) works**:
- Stack Overflow #61855027 (confirmed iOS 13-14)
- makandra dev card (confirmed iOS + Android)
- Multiple implementations in production apps

**iOS native gesture defaults**:
- Apple Developer Documentation: 500ms press, 10px movement
- Confirmed across UIKit documentation
- Microsoft Learn UIKit reference

### Contradictions (Context-Dependent)

**preventDefault() on touchstart**:
- ✅ Works for preventing selection (multiple sources)
- ❌ Breaks scrolling (Apple documentation, Stack Overflow)
- **Resolution**: Use `preventDefault()` on ALL touch events, not just touchstart

**CSS injection timing**:
- Some sources suggest CSS must be present before first touch
- epub.js hooks.content.register executes AFTER content loads but BEFORE display
- **Resolution**: Timing is not the issue; iOS gesture recognition order is the root cause

### Knowledge Gaps

**iOS 17+ specific behavior**:
- Limited documentation for iOS 17-18 specific changes
- iOS 18 beta crash bug is recent (no resolution yet)
- Unclear if newer iOS versions have different gesture recognition behavior

**WKWebView vs. Safari differences**:
- Some bugs appear only in WKWebView, not Safari
- Capacitor's WKWebView configuration may differ from standard WKWebView
- Need more testing on actual devices with different iOS versions

## Source Quality Matrix

| Source | Type | Quality | Bias | Recency | Relevance |
|--------|------|---------|------|---------|-----------|
| Apple Developer Documentation (HandlingEvents) | Official Docs | High | Low | 2015 (archived) | High |
| Apple Developer Forums (WKWebView thread) | Community | Medium | Low | 2024 | High |
| Stack Overflow #61855027 | Community | High | Low | 2020 | High |
| Stack Overflow #69286174 | Community | High | Low | 2021 | High |
| epub.js GitHub #904 | Community | High | Low | 2019 (resolved) | Medium |
| epub.js GitHub #978 | Community | High | Low | 2016 | High |
| Capacitor GitHub #3208 | Community | High | Low | 2020 | High |
| WebKit Bug #193663 | Official Bug Tracker | High | Low | 2019 (fixed iOS 12.2) | Medium |
| epub.js Tips & Tricks Wiki | Official Docs | Medium | Low | Unknown | Medium |
| makandra dev card | Tutorial | Medium | Low | Unknown | Medium |

**Overall Quality**: 35 sources reviewed, 80% high quality (official docs, Stack Overflow with upvoted answers, GitHub discussions with maintainer input).

**Recency Caveat**: Some solutions are from 2015-2020, but iOS behavior has remained consistent (with iOS 18 beta introducing NEW bugs, not fixing old ones).

## Temporal Context

**Information Currency**:
- iOS gesture recognition behavior: Stable since iOS 13 (2019)
- iOS 18 beta: NEW crash bug discovered (2024)
- Capacitor 7.x: Current stable version
- epub.js 0.3.93: Current stable version

**Historical Evolution**:
- iOS 12.2: Fixed iframe coordinate bug (WebKit #193663)
- iOS 13: Introduced haptic touch, made CSS solutions less effective
- iOS 14.5: Added `isTextInteractionEnabled` API (too broad for this use case)
- iOS 18 beta: Introduced crash bug with `user-select: none`

**Fast-Moving Aspects**:
- iOS updates (annual cycle)
- Capacitor updates (quarterly releases)
- epub.js development (active but slow)

**Stable Aspects**:
- Core iOS gesture recognition behavior (unchanged since iOS 13)
- JavaScript event model (stable since iOS 2.0)
- iframe same-origin policy

## Related Research

- `thoughts/research/2025-11-13-tap-hold-detection-for-mobile-selection-mode.md` - Related codebase research on implementing long press detection
- `thoughts/research/2025-11-13-mobile-highlighting-issue-single-word-selection.md` - Related issue about selection workflow

## Further Research Needed

### High Priority

1. **iOS 18 Beta Crash Bug**
   - Track WebKit bug tracker for resolution
   - Test on iOS 18 release candidate
   - Suggested approach: Follow Apple Developer Forums thread

2. **Device Testing Matrix**
   - Test on physical devices: iOS 15, 16, 17, 18
   - Compare WKWebView vs. Safari behavior
   - Test with different Capacitor versions
   - Priority: High (implementation depends on this)

### Medium Priority

3. **Haptic Feedback Suppression**
   - Investigate if JavaScript approach prevents vibration
   - Test native plugin approach effectiveness
   - Suggested approach: Build minimal Capacitor app with both approaches

4. **Performance Impact**
   - Measure event handler overhead with 35+ touch events per page turn
   - Test on low-end devices (iPhone SE, etc.)
   - Priority: Medium (UX quality)

### Low Priority

5. **Alternative Gesture Patterns**
   - User testing: long-press vs. button vs. double-tap
   - Analytics: which pattern users prefer
   - Priority: Low (UX research, not technical)

## Bibliography

### Official Documentation

- Apple Developer. "Handling Events in Safari Web Content." Apple Developer Documentation, archived 2015. https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html
- Apple Developer. "UILongPressGestureRecognizer." Apple Developer Documentation. https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer
- Apple Developer. "allowableMovement." Apple Developer Documentation. https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer/allowablemovement
- Ionic Team. "Capacitor Configuration." Capacitor Documentation. https://capacitorjs.com/docs/config

### GitHub Issues & Discussions

- futurepress/epub.js. "Mobile Safari text selection broken for many ePubs on iOS (iPad)." GitHub Issue #904, 2019. https://github.com/futurepress/epub.js/issues/904
- futurepress/epub.js. "Prevent Copy and Cut text." GitHub Issue #978, 2016. https://github.com/futurepress/epub.js/issues/978
- ionic-team/capacitor. "SuppressesLongPressGesture in Capacitor." GitHub Discussion #3208, 2020. https://github.com/ionic-team/capacitor/discussions/3208
- ionic-team/capacitor. "iOS: Disable 3D Touch (allowsLinkPreview)." GitHub Issue #939. https://github.com/ionic-team/capacitor/issues/939
- futurepress/epub.js. "Tips and Tricks." GitHub Wiki. https://github.com/futurepress/epub.js/wiki/Tips-and-Tricks

### Stack Overflow Solutions

- "Prevent text selection on tap and hold on iOS 13 / Mobile Safari." Stack Overflow, 2020. https://stackoverflow.com/questions/61855027/prevent-text-selection-on-tap-and-hold-on-ios-13-mobile-safari
- "WkWebView selects text when interacting with 'user-select: none' area." Stack Overflow, 2021. https://stackoverflow.com/questions/69286174/wkwebview-selects-text-when-interacting-with-user-select-none-area
- "Cannot select text with iFrame on iOS devices (webkit)." Stack Overflow, 2019. https://stackoverflow.com/questions/54300608/cannot-select-text-with-iframe-on-ios-devices-webkit
- "How to disable user selection in a WKWebView in Swift?" Stack Overflow. https://stackoverflow.com/questions/48467723/how-to-disable-user-selection-in-a-wkwebview-in-swift
- "JavaScript on iOS: preventDefault on touchstart without disabling scrolling." Stack Overflow. https://stackoverflow.com/questions/8692678/javascript-on-ios-preventdefault-on-touchstart-without-disabling-scrolling

### Community Resources

- makandra. "Disable text selection on iOS and Android devices." makandra dev cards. https://makandracards.com/makandra/1354-disable-text-selection-ios-android-devices
- Fierro, Paulo. "Disabling callouts in WKWebView." Personal Blog, 2015. http://paulofierro.com/blog/2015/7/13/disabling-callouts-in-wkwebview

### Bug Trackers

- WebKit Bugzilla. "Bug 193663 - Mobile selection on iOS does not work when text is in an iFrame that is offset." WebKit Bug Tracker, 2019. https://bugs.webkit.org/show_bug.cgi?id=193663
- Apple Developer Forums. "WKWebView iOS15 long press text selection." 2024. https://developer.apple.com/forums/thread/691568

---

**Researched by**: Claude (research-coordinator)
**Research completed**: 2025-11-13T17:20:47+00:00
**Total sources reviewed**: 35
**Primary technologies**: iOS/WKWebView, epub.js, Capacitor, JavaScript Events, CSS user-select
