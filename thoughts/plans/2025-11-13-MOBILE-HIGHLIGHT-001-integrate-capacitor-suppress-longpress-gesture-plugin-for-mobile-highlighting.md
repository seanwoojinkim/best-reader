---
doc_type: plan
date: 2025-11-13T18:34:51+00:00
title: "Integrate capacitor-suppress-longpress-gesture Plugin for Mobile Highlighting"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T18:34:51+00:00"
feature: "mobile-highlighting-native-fix"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Research & Compatibility Assessment"
    status: completed
  - name: "Phase 2: Installation & Configuration"
    status: completed
  - name: "Phase 3: Integration & Testing"
    status: in_progress
  - name: "Phase 4: Fallback Implementation"
    status: pending

git_commit: dc51a88d49fa0d4a022d16ad8937c829f6fffc2a
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Claude Code
last_updated_note: "Phases 1-2 completed, Phase 3 code implementation complete (awaiting iOS device testing)"

ticket_id: MOBILE-HIGHLIGHT-001
tags:
  - mobile
  - ios
  - highlighting
  - capacitor
  - plugin
status: in_progress

related_docs:
  - thoughts/research/2025-11-13-ios-text-selection-in-epub-js-iframes-css-vs-javascript-approaches.md
  - thoughts/research/2025-11-13-mobile-highlighting-issue-single-word-selection.md
---

# Implementation Plan: Native iOS Long-Press Suppression for Mobile Highlighting

## Executive Summary

**Problem**: iOS's native `UILongPressGestureRecognizer` operates at the OS level (before web technologies), making it impossible to prevent the system copy/paste menu from appearing using CSS or JavaScript alone. This interferes with our custom highlighting UI.

**Solution**: Integrate the `capacitor-suppress-longpress-gesture` plugin to suppress iOS's native long-press gesture at the Swift/WKWebView level, while implementing a fallback JavaScript approach.

**Critical Finding**: The plugin currently only supports Capacitor v6 (latest version 0.0.8), but we're running Capacitor v7. This plan includes testing for compatibility and implementing a robust fallback.

**Timeline**: 6-8 hours (with Capacitor 7 compatibility testing)

**Success Criteria**:
- User can drag to select text on iOS without system menu appearing
- Custom HighlightMenu appears after selection
- epub.js `selected` event fires correctly
- Fallback works if plugin is incompatible

## Current State Analysis

### Technology Stack
- **epub.js**: 0.3.93 (renders in iframes)
- **Capacitor**: 7.4.4 (iOS WKWebView)
- **Next.js**: 14.2.18
- **React**: 18.3.1
- **Platform**: iOS (Capacitor WKWebView)

### Working Directory
**Main repo**: `/Users/seankim/dev/reader`
**iOS project**: `/Users/seankim/dev/reader/ios/App`

### Current Highlighting Flow

**Files**:
- `/Users/seankim/dev/reader/hooks/useHighlights.ts` - Captures epub.js selection events
- `/Users/seankim/dev/reader/components/reader/ReaderView.tsx` - Main reader component
- `/Users/seankim/dev/reader/hooks/useEpubReader.ts` - Manages epub.js rendition

**Flow**:
1. User selects text (attempts to)
2. iOS system long-press gesture triggers (500ms press)
3. **Problem**: iOS native menu appears before our custom UI
4. epub.js fires `selected` event (lines 77-115 in useHighlights.ts)
5. useHighlights captures selection, shows HighlightMenu
6. **Issue**: Both native AND custom menus appear

### Previous Attempts (from research docs)

**CSS Approaches** (Failed):
- `-webkit-user-select: none` - Ineffective due to iOS gesture recognition order
- `-webkit-touch-callout: none` - Bypassed by iOS 13+ haptic touch
- Dynamic CSS class toggling - iOS 18 beta crash bug

**JavaScript Approaches** (Partial success):
- Touch event `preventDefault()` - Works but breaks scrolling
- Movement threshold detection - Timing issues
- `event.returnValue = false` - Most promising, but still imperfect

**Root Cause**: iOS's `UILongPressGestureRecognizer` operates at the OS level, BEFORE CSS/JavaScript are evaluated. Only native Swift code can reliably suppress it.

### Plugin Information

**Package**: `capacitor-suppress-longpress-gesture`
**Repository**: https://github.com/Nikita-schetko/capacitor-suppress-longpress-gesture
**NPM**: https://www.npmjs.com/package/capacitor-suppress-longpress-gesture

**Version Support**:
- v0.0.8 - Capacitor v6 ✅
- v0.0.7 - Capacitor v5
- v0.0.6 - Capacitor v4
- v0.0.5 - Capacitor v3
- **v0.0.9+ for Capacitor v7** - ⚠️ NOT YET RELEASED

**API**:
```typescript
import { SuppressLongpressGesture } from 'capacitor-suppress-longpress-gesture';

// Activate suppression
await SuppressLongpressGesture.activateService();

// Deactivate suppression
await SuppressLongpressGesture.deactivateService();
```

## Architecture Design

### Approach: Plugin-First with JavaScript Fallback

We'll implement a two-tier approach:

1. **Primary**: Try the Capacitor plugin (test for v7 compatibility)
2. **Fallback**: Use JavaScript event interception if plugin fails

### Component Structure

```
ReaderView.tsx
  ├─ useNativeLongPressSuppress() [NEW HOOK]
  │   ├─ Try plugin on mount
  │   ├─ Fall back to JS if plugin unavailable
  │   └─ Clean up on unmount
  │
  ├─ useEpubReader()
  │   ├─ Rendition initialization
  │   └─ Touch handlers (updated for fallback)
  │
  └─ useHighlights()
      └─ Selection capture (existing)
```

### Files to Create

1. **`/Users/seankim/dev/reader/hooks/useNativeLongPressSuppress.ts`**
   - New hook to manage long-press suppression
   - Handles plugin initialization and fallback logic
   - Provides status and error reporting

2. **`/Users/seankim/dev/reader/lib/platform.ts`** (optional)
   - Platform detection utilities
   - iOS version checking (for debugging)

### Files to Modify

1. **`/Users/seankim/dev/reader/package.json`**
   - Add plugin dependency

2. **`/Users/seankim/dev/reader/components/reader/ReaderView.tsx`**
   - Import and call new hook
   - Handle plugin status

3. **`/Users/seankim/dev/reader/hooks/useEpubReader.ts`**
   - Add fallback JavaScript event handlers
   - Conditional activation based on plugin status

4. **`/Users/seankim/dev/reader/capacitor.config.ts`** (potentially)
   - iOS-specific configuration if needed

## Implementation Phases

---

## Phase 1: Research & Compatibility Assessment

**Goal**: Determine if plugin works with Capacitor 7, understand risks

**Duration**: 1-2 hours

### Steps

#### 1.1 Check Plugin Repository for Capacitor 7 Support

**Action**:
```bash
# Check for any v7 branches or PRs
cd /Users/seankim/dev/reader
open https://github.com/Nikita-schetko/capacitor-suppress-longpress-gesture/issues
open https://github.com/Nikita-schetko/capacitor-suppress-longpress-gesture/pulls
```

**Check for**:
- Any open issues mentioning Capacitor 7
- Recent commits or branches
- Maintainer activity (last commit date)

**Decision Point**:
- If v7 support exists → Proceed to Phase 2
- If no v7 support → Note risk, proceed with testing plan
- If plugin abandoned → Skip to Phase 4 (fallback only)

#### 1.2 Review Plugin Source Code

**Action**:
```bash
# Clone plugin to examine iOS native code
cd /tmp
git clone https://github.com/Nikita-schetko/capacitor-suppress-longpress-gesture.git
cd capacitor-suppress-longpress-gesture

# Check iOS implementation
cat ios/Plugin/SuppressLongpressGesturePlugin.swift
# or
cat ios/Plugin/Plugin.swift
```

**Look for**:
- Capacitor API usage (check if any breaking changes in v7)
- Dependencies on specific Capacitor versions
- Complexity of native code (can we fork if needed?)

#### 1.3 Check Capacitor 7 Migration Guide

**Action**:
```bash
open https://capacitorjs.com/docs/updating/7-0
open https://capacitorjs.com/docs/updating/plugins/7-0
```

**Questions to answer**:
- What changed in plugin API from v6 → v7?
- Are there breaking changes affecting gesture handling?
- Is there a recommended migration path?

**Document findings** in this section (update after research).

### Success Criteria

- [ ] Understand plugin's Capacitor 7 compatibility status
- [ ] Identify specific API changes (if any)
- [ ] Make informed decision: use plugin, fork, or fallback only
- [ ] Document risks and mitigation strategies

### Time Estimate

- **Best case**: 30 minutes (plugin works, clear documentation)
- **Worst case**: 2 hours (need to analyze source code, test compatibility)
- **Average**: 1 hour

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Plugin doesn't support Capacitor 7 | High | Medium | Use fallback approach |
| Plugin causes crashes | Low | High | Wrap in try-catch, test thoroughly |
| Plugin abandoned by maintainer | Medium | Low | Fork or use fallback |

### Outputs

- **Decision document**: Plugin compatibility assessment
- **Next steps**: Proceed to Phase 2 OR skip to Phase 4

---

## Phase 2: Installation & Configuration

**Goal**: Install plugin and configure for iOS

**Duration**: 1 hour

**Prerequisites**: Phase 1 completed, decision to use plugin made

### Steps

#### 2.1 Install Plugin Package

**Command**:
```bash
cd /Users/seankim/dev/reader
npm install capacitor-suppress-longpress-gesture@latest
```

**Expected output**:
```
+ capacitor-suppress-longpress-gesture@0.0.8
```

**Note**: Version 0.0.8 is for Capacitor v6. We're testing compatibility with v7.

**Verify installation**:
```bash
grep "capacitor-suppress-longpress-gesture" package.json
# Should show: "capacitor-suppress-longpress-gesture": "^0.0.8"
```

#### 2.2 Sync Capacitor Project

**Command**:
```bash
npx cap sync ios
```

**Expected output**:
```
✔ Copying web assets from out to ios/App/App/public in 123ms
✔ Creating capacitor.config.json in ios/App/App in 2ms
✔ copy ios in 234ms
✔ Updating iOS plugins in 45ms
  Found 8 Capacitor plugins for ios:
    capacitor-suppress-longpress-gesture (0.0.8)
    @capacitor/android (7.4.4)
    ...
```

**What this does**:
- Copies plugin's iOS native code to `ios/App/App/Plugins/`
- Registers plugin in Capacitor's plugin registry
- Updates Podfile dependencies

#### 2.3 Update iOS Pods (if needed)

**Command**:
```bash
cd /Users/seankim/dev/reader/ios/App
pod install
```

**Expected output**:
```
Pod installation complete! There are X dependencies from the Podfile and Y total pods installed.
```

**Troubleshooting**:
If pod install fails:
```bash
# Clean and retry
pod cache clean --all
pod deintegrate
pod install
```

#### 2.4 Verify Plugin Registration

**Check iOS project**:
```bash
# Plugin should be registered in Capacitor
ls /Users/seankim/dev/reader/ios/App/App/capacitor.config.json
grep -A 5 "plugins" /Users/seankim/dev/reader/ios/App/App/capacitor.config.json
```

**Manual verification** (if needed):
1. Open Xcode: `open /Users/seankim/dev/reader/ios/App/App.xcworkspace`
2. Navigate to Pods → capacitor-suppress-longpress-gesture
3. Verify Swift files are present

#### 2.5 Add TypeScript Types

**Create type declaration** (if not included):

File: `/Users/seankim/dev/reader/types/capacitor-suppress-longpress-gesture.d.ts`

```typescript
declare module 'capacitor-suppress-longpress-gesture' {
  export interface SuppressLongpressGesturePlugin {
    activateService(): Promise<void>;
    deactivateService(): Promise<void>;
  }

  export const SuppressLongpressGesture: SuppressLongpressGesturePlugin;
}
```

**Why**: Ensures TypeScript recognizes the plugin's API.

### Success Criteria

- [ ] Plugin installed in package.json
- [ ] `npx cap sync ios` completes without errors
- [ ] Plugin visible in iOS project structure
- [ ] TypeScript types available (no red squiggles in imports)

### Time Estimate

- **Best case**: 15 minutes (clean install)
- **Worst case**: 1.5 hours (dependency conflicts, pod issues)
- **Average**: 30-45 minutes

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| npm install fails due to peer dependencies | Medium | Low | Use `--legacy-peer-deps` flag |
| Capacitor sync fails with v7 | High | Medium | Manually register plugin |
| Pod install conflicts | Low | Medium | Clean pod cache, update Podfile |

### Rollback Plan

If installation fails critically:
```bash
npm uninstall capacitor-suppress-longpress-gesture
npx cap sync ios
cd ios/App && pod install
```

### Outputs

- Updated `package.json` with plugin dependency
- iOS project synced with plugin code
- Ready for integration in Phase 3

---

## Phase 3: Integration & Testing

**Goal**: Integrate plugin into ReaderView, test on iOS device

**Duration**: 2-3 hours

**Prerequisites**: Phase 2 completed, plugin installed

### Steps

#### 3.1 Create Suppression Hook

**File**: `/Users/seankim/dev/reader/hooks/useNativeLongPressSuppress.ts`

```typescript
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

interface LongPressSuppressStatus {
  active: boolean;
  error: string | null;
  method: 'plugin' | 'fallback' | null;
}

export function useNativeLongPressSuppress(enabled: boolean = true) {
  const [status, setStatus] = useState<LongPressSuppressStatus>({
    active: false,
    error: null,
    method: null,
  });

  useEffect(() => {
    if (!enabled) return;

    // Only run on iOS native (not web or Android)
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
      console.log('[LongPressSuppress] Not iOS native platform, skipping');
      return;
    }

    const activatePlugin = async () => {
      try {
        // Dynamic import to avoid errors if plugin not available
        const { SuppressLongpressGesture } = await import(
          'capacitor-suppress-longpress-gesture'
        );

        await SuppressLongpressGesture.activateService();

        console.log('[LongPressSuppress] Plugin activated successfully');
        setStatus({
          active: true,
          error: null,
          method: 'plugin',
        });
      } catch (error) {
        console.error('[LongPressSuppress] Plugin activation failed:', error);
        setStatus({
          active: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          method: null,
        });
      }
    };

    activatePlugin();

    // Cleanup: deactivate on unmount
    return () => {
      if (status.method === 'plugin') {
        import('capacitor-suppress-longpress-gesture')
          .then(({ SuppressLongpressGesture }) => {
            SuppressLongpressGesture.deactivateService()
              .then(() => console.log('[LongPressSuppress] Plugin deactivated'))
              .catch((err) => console.error('[LongPressSuppress] Deactivation error:', err));
          })
          .catch(() => {
            // Plugin not available, no cleanup needed
          });
      }
    };
  }, [enabled]);

  return status;
}
```

**Key features**:
- Platform detection (iOS only)
- Graceful degradation if plugin unavailable
- Cleanup on unmount
- Status reporting for debugging

#### 3.2 Integrate into ReaderView

**File**: `/Users/seankim/dev/reader/components/reader/ReaderView.tsx`

**Changes**:

```typescript
// Add import at top (around line 10)
import { useNativeLongPressSuppress } from '@/hooks/useNativeLongPressSuppress';

// Inside ReaderViewContentComponent function (around line 60)
function ReaderViewContentComponent({ bookId, bookBlob, initialCfi }: ReaderViewProps) {
  // ... existing state ...

  // Add long press suppression
  const longPressSuppressStatus = useNativeLongPressSuppress(true);

  // Log status for debugging
  useEffect(() => {
    if (longPressSuppressStatus.active) {
      console.log('[ReaderView] Long press suppression active via:', longPressSuppressStatus.method);
    } else if (longPressSuppressStatus.error) {
      console.error('[ReaderView] Long press suppression error:', longPressSuppressStatus.error);
    }
  }, [longPressSuppressStatus]);

  // ... rest of component ...
}
```

**Explanation**:
- Hook activates when ReaderView mounts
- Only activates on iOS native platform
- Logs status for debugging
- Automatically deactivates when unmounting

#### 3.3 Test on iOS Device

**Build and deploy**:

```bash
cd /Users/seankim/dev/reader

# Build Next.js app
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios
```

**In Xcode**:
1. Select target device (physical iOS device or simulator)
2. Click Run (Cmd+R)
3. Wait for app to launch on device

**Test cases**:

##### Test Case 1: Basic Long Press Suppression
**Steps**:
1. Open any book
2. Long-press on text (hold for 500ms+)
3. Observe behavior

**Expected**:
- ❌ iOS native menu does NOT appear
- ❌ Haptic feedback does NOT occur
- ✅ epub.js selection starts (visual highlight)

**Actual**: [Document results here]

##### Test Case 2: Drag Selection
**Steps**:
1. Tap and hold on text
2. Drag to select multiple words/lines
3. Release

**Expected**:
- ✅ Text selection extends as you drag
- ✅ epub.js fires `selected` event
- ✅ Custom HighlightMenu appears
- ❌ iOS native menu does NOT appear

**Actual**: [Document results here]

##### Test Case 3: Single Word Selection
**Steps**:
1. Double-tap a word (iOS native single-word selection)

**Expected**:
- Behavior depends on plugin scope
- Ideally: double-tap still works for selection
- Alternative: double-tap disabled (acceptable trade-off)

**Actual**: [Document results here]

##### Test Case 4: Navigation Still Works
**Steps**:
1. Tap left/right zones to navigate pages
2. Swipe left/right to navigate

**Expected**:
- ✅ Page turns work normally
- ✅ Swipe navigation works
- ✅ No interference from suppression

**Actual**: [Document results here]

##### Test Case 5: Highlight Creation Flow
**Steps**:
1. Long-press and drag to select text
2. Wait for HighlightMenu to appear
3. Tap a color (e.g., yellow)

**Expected**:
- ✅ Highlight saved to database
- ✅ Highlight rendered in epub.js
- ✅ No duplicate menus or UI glitches

**Actual**: [Document results here]

#### 3.4 Debug Console Monitoring

**Check Safari Web Inspector**:
1. On Mac: Safari > Develop > [Your iPhone] > [App]
2. Monitor console for log messages

**Expected logs**:
```
[LongPressSuppress] Plugin activated successfully
[ReaderView] Long press suppression active via: plugin
```

**Error scenarios**:
```
[LongPressSuppress] Plugin activation failed: [error details]
[ReaderView] Long press suppression error: [error message]
```

#### 3.5 Handle Plugin Failure (If Occurs)

**If plugin doesn't work with Capacitor 7**:

**Decision tree**:
1. **Minor issues** (warnings but works) → Document and proceed
2. **Crashes or build failures** → Proceed to Phase 4 (fallback)
3. **Silent failure** (activates but doesn't suppress) → Proceed to Phase 4

**Gather diagnostics**:
```bash
# Check Xcode build logs
# Look for plugin-related warnings or errors

# Check iOS crash logs (if app crashes)
# Xcode > Window > Devices and Simulators > View Device Logs
```

### Success Criteria

- [ ] Plugin activates without errors on iOS
- [ ] Long press does NOT trigger iOS native menu
- [ ] Text selection via drag works correctly
- [ ] epub.js `selected` event fires
- [ ] Custom HighlightMenu appears
- [ ] Highlighting end-to-end flow works
- [ ] Page navigation unaffected

### Time Estimate

- **Best case**: 1 hour (plugin works perfectly)
- **Worst case**: 4 hours (debugging, multiple test iterations)
- **Average**: 2 hours

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Plugin causes app crash | Medium | High | Wrap in try-catch, test on simulator first |
| Plugin silently fails to suppress | High | Medium | Proceed to Phase 4 fallback |
| Breaks existing touch handlers | Low | Medium | Test all touch interactions thoroughly |
| iOS version-specific bugs | Medium | Medium | Test on multiple iOS versions if possible |

### Rollback Plan

**If Phase 3 fails completely**:

1. Remove hook from ReaderView:
```typescript
// Comment out or remove
// const longPressSuppressStatus = useNativeLongPressSuppress(true);
```

2. Rebuild and deploy:
```bash
npm run build
npx cap sync ios
```

3. Proceed directly to Phase 4 (fallback implementation)

### Outputs

- Test results documented (what works, what doesn't)
- Decision: plugin works → DONE, or plugin fails → Phase 4
- Debug logs and diagnostics (for troubleshooting)

---

## Phase 4: Fallback Implementation (JavaScript Event Interception)

**Goal**: Implement JavaScript-based suppression if plugin fails or is incompatible

**Duration**: 2-3 hours

**Prerequisites**: Phase 3 completed, plugin determined to be insufficient

### Overview

This fallback uses the most reliable JavaScript approach identified in research:
- `event.returnValue = false` on all touch events
- Conditional activation based on selection mode
- Implemented at the epub.js iframe content level

### Steps

#### 4.1 Update Suppression Hook for Fallback

**File**: `/Users/seankim/dev/reader/hooks/useNativeLongPressSuppress.ts`

**Add fallback detection**:

```typescript
// Inside useEffect, after plugin activation attempt fails

if (status.error && Capacitor.getPlatform() === 'ios') {
  console.log('[LongPressSuppress] Plugin failed, activating JavaScript fallback');
  setStatus({
    active: true,
    error: null,
    method: 'fallback',
  });
}
```

**Return additional data**:

```typescript
return {
  ...status,
  useFallback: status.method === 'fallback',
};
```

#### 4.2 Implement Fallback in useEpubReader

**File**: `/Users/seankim/dev/reader/hooks/useEpubReader.ts`

**Add selection mode tracking**:

```typescript
// At top of hook (around line 26)
const selectionModeRef = useRef(false);
```

**Add touch event prevention in content hooks** (around line 141, inside `newRendition.hooks.content.register()`):

```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  // Existing swipe handlers...
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  };

  // ... existing handleTouchEnd ...

  // NEW: JavaScript fallback for iOS long-press suppression
  const preventNativeSelection = (e: TouchEvent) => {
    // Only prevent if NOT in selection mode
    if (!selectionModeRef.current) {
      // This is the key: prevents iOS native text selection
      (e as any).returnValue = false;

      // Modern alternative (but may affect scrolling)
      // e.preventDefault();
    }
  };

  // Apply to all touch events (critical for iOS)
  ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach((eventType) => {
    doc.addEventListener(eventType, preventNativeSelection, {
      passive: false // MUST be false to allow preventDefault
    });
  });

  // Existing swipe event listeners...
  doc.addEventListener('touchstart', handleTouchStart, { passive: true });
  doc.addEventListener('touchend', handleTouchEnd, { passive: false });

  // Store cleanup function
  return () => {
    ['touchstart', 'touchend', 'touchmove', 'touchcancel'].forEach((eventType) => {
      doc.removeEventListener(eventType, preventNativeSelection);
    });
  };
});
```

**Important notes**:
- `returnValue = false` is deprecated but proven to work on iOS 13-14+
- `passive: false` is CRITICAL - without it, `preventDefault()` won't work
- Applied to ALL touch events, not just touchstart

#### 4.3 Add Selection Mode Activation

**In useEpubReader** (below touch handlers):

```typescript
// NEW: Long press detection for selection mode
const LONG_PRESS_DURATION = 500;  // Match iOS native
const MOVEMENT_THRESHOLD = 10;    // Match iOS allowableMovement

let longPressTimer: NodeJS.Timeout | null = null;

const handleTouchStartForSelection = (e: TouchEvent) => {
  const startX = e.touches[0].clientX;
  const startY = e.touches[0].clientY;

  longPressTimer = setTimeout(() => {
    // Check if finger moved too much
    const currentX = e.touches[0]?.clientX || startX;
    const currentY = e.touches[0]?.clientY || startY;
    const movement = Math.sqrt(
      Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2)
    );

    if (movement <= MOVEMENT_THRESHOLD) {
      // Activate selection mode
      selectionModeRef.current = true;
      console.log('[useEpubReader] Selection mode activated');

      // Auto-exit after 3 seconds
      setTimeout(() => {
        selectionModeRef.current = false;
        console.log('[useEpubReader] Selection mode auto-exited');
      }, 3000);
    }
  }, LONG_PRESS_DURATION);
};

const handleTouchMoveForSelection = (e: TouchEvent) => {
  // Cancel long press if moved too much (but allow natural wobble)
  if (longPressTimer) {
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;
    const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (movement > MOVEMENT_THRESHOLD) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
};

const handleTouchEndForSelection = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

doc.addEventListener('touchstart', handleTouchStartForSelection, { passive: true });
doc.addEventListener('touchmove', handleTouchMoveForSelection, { passive: true });
doc.addEventListener('touchend', handleTouchEndForSelection, { passive: true });
```

#### 4.4 Exit Selection Mode on Highlight

**File**: `/Users/seankim/dev/reader/hooks/useHighlights.ts`

**In `handleSelected` function** (around line 103):

```typescript
setCurrentSelection({
  text,
  cfiRange,
  position,
});

// NEW: Exit selection mode after selection captured
// This will re-enable touch event prevention
if (window.selectionModeRef) {
  window.selectionModeRef.current = false;
  console.log('[useHighlights] Selection captured, exiting selection mode');
}
```

**Note**: Need to pass `selectionModeRef` from useEpubReader to useHighlights via ReaderView props.

#### 4.5 Connect Refs Between Hooks

**File**: `/Users/seankim/dev/reader/components/reader/ReaderView.tsx`

**Changes**:

```typescript
// Create shared ref
const selectionModeRef = useRef(false);

// Pass to useEpubReader
const { book, rendition, loading, currentLocation, progress, totalLocations, nextPage, prevPage, goToLocation } =
  useEpubReader({
    bookBlob,
    containerRef,
    selectionModeRef, // NEW
    onLocationChange: async (cfi, percentage) => {
      // ... existing code ...
    },
  });

// Pass to useHighlights
const {
  currentSelection,
  editingNote,
  createHighlight,
  updateNote,
  setCurrentSelection,
  setEditingNote,
} = useHighlights({
  bookId,
  rendition,
  selectionModeRef, // NEW
});
```

**Update hook signatures**:

In `/Users/seankim/dev/reader/hooks/useEpubReader.ts`:
```typescript
interface UseEpubReaderProps {
  bookBlob: Blob | null;
  containerRef: React.RefObject<HTMLDivElement>;
  selectionModeRef?: React.RefObject<boolean>; // NEW
  onLocationChange?: (cfi: string, percentage: number) => void;
}
```

In `/Users/seankim/dev/reader/hooks/useHighlights.ts`:
```typescript
interface UseHighlightsProps {
  bookId: number;
  rendition: Rendition | null;
  selectionModeRef?: React.RefObject<boolean>; // NEW
}
```

#### 4.6 Test Fallback Implementation

**Test cases** (same as Phase 3.3, re-run all):

1. **Long press suppression**: iOS menu should NOT appear
2. **Drag selection**: Multi-word selection should work
3. **epub.js event**: `selected` event should fire
4. **Custom menu**: HighlightMenu should appear
5. **Navigation**: Page turns should work
6. **Performance**: No lag or stuttering during scrolling

**Additional fallback-specific test**:

##### Test Case 6: Scrolling Performance
**Steps**:
1. Scroll through book pages rapidly
2. Monitor for lag or frame drops

**Expected**:
- ✅ Smooth scrolling (60fps)
- ✅ No perceivable delay from event handlers

**Actual**: [Document results here]

**If scrolling is affected**:
- Consider debouncing touch event handlers
- May need to optimize event listener implementation

### Success Criteria

- [ ] Fallback activates when plugin unavailable
- [ ] JavaScript event interception prevents iOS native menu
- [ ] Selection mode activates on long press
- [ ] Text selection works via drag
- [ ] epub.js `selected` event fires
- [ ] Custom HighlightMenu appears
- [ ] Scrolling performance acceptable (>30fps)

### Time Estimate

- **Best case**: 1.5 hours (straightforward implementation)
- **Worst case**: 4 hours (performance tuning, edge case handling)
- **Average**: 2.5 hours

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Event handlers affect scrolling performance | Medium | Medium | Optimize with debouncing/throttling |
| Timing issues with selection mode | High | Low | Extensive testing, adjust thresholds |
| Still doesn't prevent iOS menu 100% | Medium | Medium | Document as known limitation |
| Conflicts with swipe navigation | Low | Medium | Coordinate event handlers carefully |

### Known Limitations of Fallback

**What it CAN do**:
- ✅ Suppress iOS native selection menu (mostly)
- ✅ Allow custom selection UI
- ✅ Maintain scrolling functionality

**What it CANNOT do**:
- ❌ Prevent haptic feedback vibration (OS level)
- ❌ Guarantee 100% suppression (iOS 18 beta has bugs)
- ❌ Match native gesture recognition perfectly

**User experience trade-offs**:
- Users may feel haptic feedback but see custom menu (acceptable)
- Small delay between long press and selection activation (~500ms)
- May require explicit selection mode button for best UX

### Outputs

- Fully functional JavaScript fallback
- Test results and performance metrics
- Decision on whether additional UX improvements needed

---

## Testing Strategy

### Test Matrix

| Scenario | iOS Simulator | Physical Device | Expected Behavior |
|----------|---------------|-----------------|-------------------|
| Plugin activation | ✅ | ✅ | Logs "Plugin activated" or fallback message |
| Long press text | ✅ | ✅ | No iOS native menu |
| Drag selection | ✅ | ✅ | Multi-word selection works |
| epub.js event | ✅ | ✅ | `selected` event fires in console |
| Custom menu | ✅ | ✅ | HighlightMenu appears |
| Highlight save | ✅ | ✅ | Stored in IndexedDB, renders correctly |
| Page navigation | ✅ | ✅ | Tap zones and swipe work |
| Scrolling | ✅ | ✅ | Smooth, no lag |
| iOS 15 | - | ✅ | Works on older iOS |
| iOS 16 | ✅ | ✅ | Works on current stable |
| iOS 17 | ✅ | ✅ | Works on latest stable |
| iOS 18 beta | ✅ | ⚠️ | Document if issues occur |

### Performance Benchmarks

**Metrics to measure**:
- **Long press detection latency**: <100ms from 500ms press completion
- **Selection capture time**: <50ms from touchend to epub.js `selected` event
- **Menu render time**: <100ms from selection to menu display
- **Scrolling FPS**: ≥30fps during rapid scrolling (target 60fps)

**Tools**:
- Safari Web Inspector (Performance tab)
- React DevTools (Profiler)
- Xcode Instruments (Time Profiler, GPU Driver)

### Edge Cases to Test

1. **Rapid taps**: Ensure doesn't trigger selection mode
2. **Zoom gestures**: Two-finger pinch should still work
3. **Link taps**: Links should still be clickable
4. **Image long press**: What happens? (acceptable if suppressed)
5. **Selection across page boundaries**: Test if CFI range is correct
6. **Highlight overlapping text**: Test if rendering is correct

### Regression Testing

**Ensure existing features still work**:
- [ ] Swipe navigation (Phase 1 feature)
- [ ] Tap zones for page turning
- [ ] TTS playback and sync
- [ ] Settings drawer
- [ ] Font changes
- [ ] Theme changes
- [ ] Audio player controls
- [ ] Chapter list navigation

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Plugin incompatible with Capacitor 7 | High | Medium | Implement fallback (Phase 4) | Dev |
| iOS 18 beta crash bug | Medium | High | Test on iOS 17, document iOS 18 issue | QA |
| Performance degradation from event handlers | Medium | Medium | Optimize, profile, benchmark | Dev |
| Conflicts with existing touch handlers | Low | High | Coordinate event listeners carefully | Dev |
| Plugin causes App Store rejection | Low | High | Use fallback, or remove plugin | PM |

### UX Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Haptic feedback still occurs (fallback) | High | Low | Document as known limitation | PM |
| Native menu still appears occasionally | Medium | Medium | Refine event handling, test extensively | Dev |
| Users confused by long-press delay | Low | Low | Consider adding visual feedback | Design |
| Selection mode timeout too short/long | Medium | Low | Make configurable, gather user feedback | PM |

### Timeline Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|-------------|--------|------------|-------|
| Phase 1 research takes longer than expected | Medium | Low | Time-box to 2 hours max | Dev |
| Plugin debugging extends Phase 3 | High | Medium | Set 3-hour limit, then move to Phase 4 | Dev |
| iOS device testing delays | Medium | Medium | Use simulator for initial testing | QA |
| Need to fork plugin for v7 support | Low | High | Evaluate: fork vs. fallback only | Tech Lead |

---

## Deployment Plan

### Pre-Deployment Checklist

- [ ] All phases completed (or Phase 4 fallback working)
- [ ] Tested on iOS simulator (iOS 16, 17)
- [ ] Tested on physical device (at least one iOS version)
- [ ] Performance benchmarks met
- [ ] No regressions in existing features
- [ ] Error handling tested (plugin fails gracefully)
- [ ] Console logs added for debugging
- [ ] Code reviewed

### Deployment Steps

1. **Merge to feature branch**:
```bash
git checkout -b feature/mobile-highlighting-native-fix
git add .
git commit -m "feat: Add native iOS long-press suppression for highlighting

- Integrate capacitor-suppress-longpress-gesture plugin
- Implement JavaScript fallback for Capacitor 7 compatibility
- Add selection mode detection with iOS-native thresholds
- Test on iOS 16/17, works with some limitations on iOS 18 beta

Refs: MOBILE-HIGHLIGHT-001"
```

2. **Build and test on CI** (if applicable):
```bash
npm run build
npm run type-check
npm run lint
```

3. **Deploy to TestFlight** (iOS beta testing):
```bash
npm run build
npx cap sync ios
# Open Xcode, archive, upload to TestFlight
```

4. **Gather beta feedback**:
   - Share with 3-5 beta testers
   - Monitor for crashes or unexpected behavior
   - Collect UX feedback on selection experience

5. **Merge to main** (after beta approval):
```bash
git checkout main
git merge feature/mobile-highlighting-native-fix
git push origin main
```

### Rollback Plan

**If critical issues discovered in production**:

1. **Immediate**: Disable long-press suppression:
```typescript
// In ReaderView.tsx
const longPressSuppressStatus = useNativeLongPressSuppress(false); // Disable
```

2. **Short-term**: Revert commit:
```bash
git revert <commit-hash>
git push origin main
```

3. **Long-term**: Investigate root cause, fix, and redeploy

### Monitoring

**Post-deployment metrics to track**:
- Crash rate (should not increase)
- Highlighting feature usage (should increase)
- User feedback (App Store reviews mentioning highlighting)
- Error logs (plugin activation failures)

**Analytics events** (to add):
- `long_press_suppress_plugin_activated`
- `long_press_suppress_fallback_used`
- `long_press_suppress_failed`
- `highlight_created_mobile` (to measure success rate)

---

## Documentation Updates

### Code Comments

**Add JSDoc comments to new code**:

```typescript
/**
 * Hook to suppress iOS native long-press text selection gestures.
 *
 * Uses capacitor-suppress-longpress-gesture plugin when available (iOS native),
 * falls back to JavaScript touch event interception if plugin incompatible.
 *
 * @param enabled - Whether to activate suppression (default: true)
 * @returns Status object with activation state and method used
 *
 * @example
 * const { active, method } = useNativeLongPressSuppress();
 * console.log(`Suppression ${active ? 'active' : 'inactive'} via ${method}`);
 */
```

### README Updates

**Add section** to `/Users/seankim/dev/reader/README.md`:

```markdown
## Mobile Highlighting

### iOS Long-Press Suppression

This app uses native iOS gesture suppression to enable custom text highlighting on mobile.

**Implementation**:
- Primary: `capacitor-suppress-longpress-gesture` plugin (iOS native)
- Fallback: JavaScript touch event interception (if plugin unavailable)

**Known Limitations**:
- Haptic feedback may still occur when using fallback method
- iOS 18 beta has a known WebKit bug affecting text selection (reported to Apple)

**Testing**:
```bash
npm run build
npx cap sync ios
npx cap open ios
# Run on device, test long-press text selection
```
```

### Inline Code Comments

**Update useEpubReader.ts** with explanation:

```typescript
// iOS Long-Press Suppression (MOBILE-HIGHLIGHT-001)
//
// Problem: iOS's native UILongPressGestureRecognizer operates at OS level,
// before CSS/JavaScript are evaluated, making web-based suppression unreliable.
//
// Solution: Capacitor plugin intercepts at Swift/WKWebView level (preferred),
// or JavaScript event interception as fallback (iOS 13-14+ compatible).
//
// See: thoughts/plans/2025-11-13-MOBILE-HIGHLIGHT-001-*.md
```

---

## Alternative Approaches (Considered but Not Chosen)

### Approach 1: CSS-Only Solution

**Description**: Use `-webkit-user-select: none` and `-webkit-touch-callout: none`

**Why rejected**:
- Research shows CSS ineffective on iOS 13+ (gesture recognizer fires first)
- iOS 18 beta has crash bug with `user-select: none`
- Cannot reliably prevent native menu

**Reference**: `thoughts/research/2025-11-13-ios-text-selection-in-epub-js-iframes-css-vs-javascript-approaches.md` (lines 64-139)

### Approach 2: Button-Activated Selection Mode

**Description**: Add "Highlight Mode" button to toolbar, require explicit activation

**Why rejected** (for now):
- Extra step reduces UX fluidity
- Users expect long-press selection (matches native iOS apps)
- Can add later if native suppression proves unreliable

**Possible future enhancement**: Add as preference for users who struggle with long-press timing

### Approach 3: Embrace Native Selection UI

**Description**: Allow iOS native menu, intercept selection immediately, show custom menu

**Why rejected**:
- Native menu flashes briefly (confusing UX)
- Cannot prevent haptic feedback
- User sees two different UIs (jarring)

**When to reconsider**: If iOS makes native gesture suppression impossible in future updates

### Approach 4: Fork Plugin for Capacitor 7

**Description**: Fork `capacitor-suppress-longpress-gesture`, update for v7 API

**Why deprioritized**:
- Maintenance burden (must track Capacitor updates)
- Plugin author may release v7 support soon
- Fallback approach works adequately

**When to reconsider**: If plugin proves essential and author abandons maintenance

---

## Success Metrics

### Technical Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Plugin activation rate | >95% | Log analytics |
| Fallback activation rate | <5% | Log analytics (only when plugin fails) |
| iOS native menu suppression | >90% | User testing, QA validation |
| Highlighting success rate | >95% | Analytics: selections → highlights created |
| Performance impact | <10% overhead | Profiler: FPS during touch events |
| Crash rate | 0% increase | Xcode crash reports |

### UX Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Time to create highlight | <3 seconds | User testing (long press → selection → menu → save) |
| User-reported issues | <10% | App Store reviews, support tickets |
| Feature discovery | >50% within 1 week | Analytics: % users who create highlights |
| Highlight creation frequency | 2x increase | Compare pre/post implementation |

### Qualitative Metrics

- **User feedback**: "Easy to highlight on mobile now" (positive sentiment)
- **App Store reviews**: No negative reviews mentioning highlighting issues
- **Beta tester feedback**: 4/5 or better rating on highlighting UX

---

## Timeline Summary

| Phase | Duration | Start Condition | End Condition |
|-------|----------|-----------------|---------------|
| Phase 1: Research | 1-2 hours | Plan approved | Compatibility decision made |
| Phase 2: Installation | 1 hour | Phase 1 complete | Plugin installed, synced |
| Phase 3: Integration | 2-3 hours | Phase 2 complete | Plugin tested on device |
| Phase 4: Fallback | 2-3 hours | Phase 3 insufficient | Fallback tested, working |
| **Total** | **6-9 hours** | - | Feature fully functional |

**Best case**: 6 hours (plugin works perfectly with v7)
**Worst case**: 9 hours (plugin fails, fallback requires tuning)
**Average**: 7-8 hours

---

## Related Documentation

**Research Documents**:
- `/Users/seankim/dev/reader/thoughts/research/2025-11-13-ios-text-selection-in-epub-js-iframes-css-vs-javascript-approaches.md` - Deep dive on why CSS doesn't work
- `/Users/seankim/dev/reader/thoughts/research/2025-11-13-mobile-highlighting-issue-single-word-selection.md` - Original problem investigation

**Codebase Files**:
- `/Users/seankim/dev/reader/hooks/useHighlights.ts` - Selection event handling
- `/Users/seankim/dev/reader/hooks/useEpubReader.ts` - Touch event handlers
- `/Users/seankim/dev/reader/components/reader/ReaderView.tsx` - Main integration point
- `/Users/seankim/dev/reader/components/reader/HighlightMenu.tsx` - Custom highlight UI

**External References**:
- Plugin repository: https://github.com/Nikita-schetko/capacitor-suppress-longpress-gesture
- Capacitor v7 docs: https://capacitorjs.com/docs/updating/7-0
- iOS UILongPressGestureRecognizer: https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer

---

## Appendix A: Plugin Source Code Reference

**iOS Native Implementation** (from plugin repository):

```swift
import Foundation
import Capacitor

@objc(SuppressLongpressGesturePlugin)
public class SuppressLongpressGesturePlugin: CAPPlugin {
    @objc func activateService(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("Unable to access webView")
                return
            }

            // Disable long press gesture recognizer
            for recognizer in webView.gestureRecognizers ?? [] {
                if recognizer is UILongPressGestureRecognizer {
                    recognizer.isEnabled = false
                }
            }

            call.resolve()
        }
    }

    @objc func deactivateService(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let webView = self.bridge?.webView else {
                call.reject("Unable to access webView")
                return
            }

            // Re-enable long press gesture recognizer
            for recognizer in webView.gestureRecognizers ?? [] {
                if recognizer is UILongPressGestureRecognizer {
                    recognizer.isEnabled = true
                }
            }

            call.resolve()
        }
    }
}
```

**Key mechanism**: Iterates through WKWebView's gesture recognizers, disables any `UILongPressGestureRecognizer` instances.

**Why this works**: Operates at the same layer as iOS's native gesture recognition, before web content is consulted.

**Potential Capacitor 7 incompatibility**: If `bridge?.webView` API changed in v7, this would fail. Needs verification.

---

## Appendix B: Debugging Commands

**Check if plugin is loaded**:
```typescript
// In Safari Web Inspector console
window.Capacitor.Plugins.SuppressLongpressGesture
// Should return: {activateService: ƒ, deactivateService: ƒ}
```

**Force activate plugin**:
```typescript
import { SuppressLongpressGesture } from 'capacitor-suppress-longpress-gesture';
await SuppressLongpressGesture.activateService();
console.log('Activated');
```

**Check gesture recognizers (requires iOS debug)**:
```swift
// In Xcode debugger, break in app delegate
po webView.gestureRecognizers
// Should list gesture recognizers, check if long press is disabled
```

**Monitor touch events**:
```typescript
// In Safari Web Inspector console
const iframe = document.querySelector('iframe');
const doc = iframe.contentDocument;
doc.addEventListener('touchstart', (e) => console.log('touchstart', e));
doc.addEventListener('touchend', (e) => console.log('touchend', e));
```

**Check selection mode state**:
```typescript
// In ReaderView component
console.log('Selection mode:', selectionModeRef.current);
```

---

## Appendix C: Capacitor 7 Migration Notes

**Key changes in Capacitor 7** (that may affect plugin):

1. **Minimum iOS version**: iOS 13.0 (up from 12.0)
   - Impact: None (long-press gesture API unchanged)

2. **Swift 5.9+ required**:
   - Impact: Plugin code may need Swift syntax updates

3. **Xcode 15+ required**:
   - Impact: Build configuration may need updates

4. **Plugin API changes**:
   - `CAPBridgeProtocol` methods may have changed
   - `bridge?.webView` access path may differ

**How to verify**:
```bash
# Check Capacitor bridge source code
cd /Users/seankim/dev/reader/node_modules/@capacitor/ios
grep -r "webView" ios/Capacitor/Capacitor/
```

**If plugin fails**, likely causes:
1. `bridge?.webView` returns nil (API changed)
2. Gesture recognizer API changed (unlikely)
3. Plugin not registered correctly (packaging issue)

**Next steps if incompatible**:
- File GitHub issue on plugin repository
- Offer to contribute v7 support PR
- Or: Use fallback approach (Phase 4)

---

## Appendix D: Performance Optimization Notes

**If fallback JavaScript approach causes lag**:

### Optimization 1: Debounce Touch Move Events

```typescript
import { debounce } from 'lodash'; // or implement own

const preventNativeSelectionDebounced = debounce(
  (e: TouchEvent) => {
    if (!selectionModeRef.current) {
      (e as any).returnValue = false;
    }
  },
  16 // ~60fps
);

doc.addEventListener('touchmove', preventNativeSelectionDebounced, { passive: false });
```

### Optimization 2: Use Passive Listeners Where Possible

```typescript
// Only use passive: false where preventDefault is needed
doc.addEventListener('touchstart', preventSelection, { passive: false }); // Must preventDefault
doc.addEventListener('touchmove', handleSwipe, { passive: true }); // No preventDefault needed
```

### Optimization 3: Early Exit in Event Handlers

```typescript
const preventNativeSelection = (e: TouchEvent) => {
  // Early exit: if already in selection mode, don't process
  if (selectionModeRef.current) return;

  // Early exit: if not a single touch, don't process
  if (e.touches.length !== 1) return;

  (e as any).returnValue = false;
};
```

### Optimization 4: Remove Console Logs in Production

```typescript
// Replace console.log with conditional logging
const DEBUG = process.env.NODE_ENV === 'development';
if (DEBUG) console.log('[LongPressSuppress] Plugin activated');
```

---

**Plan Status**: Draft
**Next Action**: Phase 1 - Research plugin Capacitor 7 compatibility
**Owner**: Development Team
**Last Updated**: 2025-11-13
