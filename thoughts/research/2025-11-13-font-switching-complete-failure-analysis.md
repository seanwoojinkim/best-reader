---
doc_type: research
date: 2025-11-13T16:29:58+00:00
title: "Font Switching Complete Failure Analysis"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T16:29:58+00:00"
research_question: "Why do fonts not switch at all and why does clicking custom fonts crash the app?"
research_type: codebase_research
researcher: Sean Kim

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - fonts
  - bug
  - critical
  - crash
  - race-condition
status: complete

related_docs: []
---

# Research: Font Switching Complete Failure Analysis

**Date**: 2025-11-13T16:29:58+00:00
**Researcher**: Sean Kim
**Git Commit**: f043ea027c72c71df95873aeac6edad6d812395b
**Branch**: main
**Repository**: reader

## Research Question

Why do fonts not switch at all and why does clicking custom fonts crash the app?

**User Reports**:
- Bug 1: "Defaults at serif, fonts remain serif regardless of selection" - clicking any font option has NO visual effect
- Bug 2: "TypeError: Cannot read properties of undefined (reading 'removeEventListener')" when clicking custom fonts

## Executive Summary

This investigation uncovered **TWO CRITICAL BUGS** in the font switching system:

### Bug 1: Custom Font Crash (TypeError)
**Root Cause**: Race condition in useEffect cleanup caused by `fontType` and `customFont` in rendition initialization dependency array.

**Severity**: Production-blocking - crashes app when clicking custom fonts

**Location**: [`hooks/useEpubReader.ts:148`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L148) (dependency array) and cleanup at lines 223-228

### Bug 2: Fonts Don't Switch At All
**Root Cause**: Multiple potential causes identified:
1. **Likely**: `rendition.themes.update()` doesn't actually re-render current page in epub.js
2. **Possible**: React effect not running due to reference equality in Zustand
3. **Possible**: Browser caching old iframe content

**Severity**: Production-blocking - core feature completely non-functional

**Location**: [`hooks/useEpubReader.ts:190`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L190) (themes.update call)

## Detailed Findings

### 1. The "Line 68" Red Herring

**Initial Error Report**: "TypeError at ReaderView.tsx:68"

**Reality**: Line 68 of ReaderView.tsx is:
```typescript
try {
  await savePosition({
```

This has **NOTHING to do with removeEventListener**. The error stack trace is misleading or the line numbers shifted after a code change.

**Actual Crash Location**: [`hooks/useEpubReader.ts:223-228`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L223-228)

```typescript
return () => {
  // Check if rendition still exists before removing event listener
  if (rendition && typeof rendition.off === 'function') {
    rendition.off('click', handleIframeClick);  // <-- CRASHES HERE
  }
};
```

### 2. Race Condition: The Rendition Destruction Timeline

**The Fatal Sequence**:

1. User clicks custom font in FontSelector
2. [`components/fonts/FontSelector.tsx:31`](/Users/seankim/dev/reader/components/fonts/FontSelector.tsx#L31) calls `setCustomFont(fontId, selectedFont.family)`
3. [`stores/settingsStore.ts:57-61`](/Users/seankim/dev/reader/stores/settingsStore.ts#L57-61) updates state:
   ```typescript
   setCustomFont: (fontId, fontFamily) => set({
     customFontId: fontId,
     fontFamily,
     fontType: 'custom',
   }),
   ```
4. **CRITICAL**: `fontType` changes from 'system' → 'custom'
5. **CRITICAL**: `customFontId` changes from undefined → number

**The useEpubReader.ts Effect Chain Reaction**:

**Effect 1 (Lines 65-148)**: Rendition initialization
```typescript
useEffect(() => {
  // ... create rendition ...

  return () => {
    if (newRendition) {
      newRendition.destroy();  // <-- Destroys rendition object
    }
  };
}, [book, containerRef, fontType, customFont]);  // <-- RE-RUNS when fonts change!
```

**Effect 3 (Lines 193-229)**: Click event forwarding
```typescript
useEffect(() => {
  rendition.on('click', handleIframeClick);

  return () => {
    if (rendition && typeof rendition.off === 'function') {
      rendition.off('click', handleIframeClick);  // <-- CRASHES
    }
  };
}, [rendition, containerRef]);
```

**What Happens**:
1. Effect 1's cleanup runs first → `rendition.destroy()`
2. Effect 3's cleanup runs → tries `rendition.off('click', ...)`
3. **Crash**: The rendition object still exists (passes null check) but internal state is destroyed
4. epub.js throws error trying to remove event listener from destroyed rendition

**Why the Null Check Fails**:
```typescript
if (rendition && typeof rendition.off === 'function')  // <-- Passes!
```

The rendition object still exists in memory, `rendition.off` is still a function, but the **internal iframe/document is destroyed**.

### 3. The Dependency Array Disaster

**Three interconnected effects with conflicting dependencies**:

| Effect | Lines | Dependencies | Purpose |
|--------|-------|--------------|---------|
| Rendition Init | 65-148 | `[book, containerRef, fontType, customFont]` | Create rendition |
| Apply Styling | 150-191 | `[rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]` | Update theme |
| Click Forwarding | 193-229 | `[rendition, containerRef]` | Forward iframe clicks |
| Location Tracking | 254-287 | `[rendition, book, onLocationChange]` | Track page changes |

**The Problem**:
- Effect 1 includes `fontType` and `customFont` in dependencies
- This causes **full rendition destruction and recreation** on every font change
- Effects 3 & 4 have event listeners that get orphaned

**Why Include `fontType` and `customFont`?**

Looking at [`hooks/useEpubReader.ts:82-139`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L82-139), the rendition initialization registers a content hook that injects custom fonts:

```typescript
newRendition.hooks.content.register((contents: any) => {
  // Inject custom font @font-face if available
  if (fontType === 'custom' && customFont) {
    const style = doc.createElement('style');
    // ... inject @font-face ...
  }
});
```

**The hook closure captures `fontType` and `customFont`**, so they MUST be in the dependency array to get new values. But this creates the race condition.

### 4. Why Fonts Don't Switch (Even Serif/Sans)

**Expected Behavior**: Clicking serif/sans-serif should change the font immediately.

**What Actually Happens**: Font stays at serif no matter what.

**Investigation of the Flow**:

1. **FontSelector.tsx:24-25** - System font click:
   ```typescript
   if (value === 'serif' || value === 'sans-serif') {
     setFontFamily(value);  // <-- Calls store action
   }
   ```

2. **settingsStore.ts:48-52** - Store updates:
   ```typescript
   setFontFamily: (fontFamily) => set({
     fontFamily,
     fontType: 'system',
     customFontId: undefined,
   }),
   ```

3. **useEpubReader.ts:26** - Hook reads from store:
   ```typescript
   const { theme, fontSize, fontFamily, fontType, customFontId, lineHeight } = useSettingsStore();
   ```

4. **useEpubReader.ts:150-191** - Styling effect should run:
   ```typescript
   useEffect(() => {
     if (!rendition) return;

     let fontFamilyCSS = fontFamily === 'serif'
       ? 'Georgia, serif'
       : '-apple-system, sans-serif';

     rendition.themes.default({ /* ... */ });
     rendition.themes.update();  // <-- Should apply immediately
   }, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
   ```

**Possible Causes (Ranked by Likelihood)**:

#### Cause 1: `rendition.themes.update()` Doesn't Re-render Current Page (HIGH)

**Evidence**: Comment at [`useEpubReader.ts:188-189`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L188-189) says:
```typescript
// Force epub.js to re-apply theme to currently rendered content
// Without this, font changes only appear after navigating to next page
```

This comment suggests the developer EXPECTED `themes.update()` to work, but it might not.

**epub.js Behavior**: The `.update()` method might only:
- Update the theme configuration
- Apply to NEW pages when navigating
- NOT re-render the current iframe content

**Test This**: Add console.log before and after `themes.update()` and check if iframe DOM updates.

#### Cause 2: Effect Not Running (MEDIUM)

**Evidence**: No console.log in the styling effect at lines 150-191.

**Possible Issues**:
- Zustand not triggering re-render when store updates
- React batching multiple state updates
- Reference equality causing stale closure

**Test This**: Add console.log at line 152:
```typescript
useEffect(() => {
  console.log('[useEpubReader] STYLING EFFECT RUNNING', {
    fontFamily,
    fontType,
    customFont,
    rendition: !!rendition
  });

  if (!rendition) return;
  // ...
```

#### Cause 3: Browser Caching Iframe Content (LOW)

**Evidence**: None directly, but iframes can cache aggressively.

**Test This**: Hard refresh (Cmd+Shift+R) and try changing fonts.

#### Cause 4: localStorage Corruption (LOW)

**Evidence**: Zustand persists to localStorage at [`settingsStore.ts:86-98`](/Users/seankim/dev/reader/stores/settingsStore.ts#L86-98).

**Possible Issue**:
- Old persisted state without `fontType` field
- Corrupted JSON in localStorage
- Mismatched state shape

**Test This**:
```javascript
localStorage.getItem('reader-settings')
localStorage.removeItem('reader-settings')
```

### 5. Event Listener Cleanup Patterns Across Codebase

**All removeEventListener calls found**:

| File | Line | Event | Null Check? |
|------|------|-------|-------------|
| `ReaderView.tsx` | 297 | mousemove | ❌ No - assumes window exists |
| `ReaderView.tsx` | 311 | keydown | ❌ No - assumes document exists |
| `SettingsDrawer.tsx` | 41 | keydown | ❌ No |
| `TapZones.tsx` | 62 | keydown | ❌ No |
| `useEpubReader.ts` | 226 | click (rendition) | ✅ Yes - but doesn't work |
| `useEpubReader.ts` | 284 | relocated (rendition) | ✅ Yes - but doesn't work |
| `useAudioPlayer.ts` | 79-82 | audio events | ❌ No - but audio is ref |

**Pattern**: Most cleanup functions assume the event target still exists. Only epub.js rendition has null checks, but they're insufficient.

### 6. Custom Font vs System Font Behavior Difference

**Why Custom Font Crashes But Serif/Sans Doesn't**:

When clicking **serif** or **sans-serif**:
- [`settingsStore.ts:48-52`](/Users/seankim/dev/reader/stores/settingsStore.ts#L48-52) updates `fontFamily` only
- `fontType` changes to 'system'
- `customFontId` changes to undefined
- **Both** are in Effect 1 dependency array → **still triggers re-render!**

**Wait, why doesn't serif/sans crash too?**

Let me check the dependency array again at [`useEpubReader.ts:148`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L148):

```typescript
}, [book, containerRef, fontType, customFont]);
```

**AH! It's `customFont`, not `customFontId`!**

`customFont` comes from [`useEpubReader.ts:29-32`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L29-32):
```typescript
const { font: customFont, loading: fontLoading, error: fontError } = useFontLoader({
  fontId: customFontId,
  enabled: fontType === 'custom',
});
```

**When switching serif → sans-serif**:
- `fontType` changes: 'system' → 'system' (no change) OR 'custom' → 'system'
- `customFont` changes: null → null (no change) OR LoadedFont → null

**When clicking custom font**:
- `fontType` changes: 'system' → 'custom'
- `customFont` changes: null → LoadedFont (async load)
- **TWO dependency changes** → rendition destroyed → **CRASH**

**So serif/sans SHOULD also crash if switching from custom!**

The user report says "fonts remain serif regardless of selection" - this suggests they're always on serif, never tried custom yet.

### 7. The useFontLoader Hook

[`hooks/useFontLoader.ts`](/Users/seankim/dev/reader/hooks/useFontLoader.ts) loads custom fonts from IndexedDB.

**Key Behavior**:
- Returns `{ font, loading, error }`
- `font` is `null` when not enabled or loading
- `font` is `LoadedFont` object when loaded

**Potential Issue**:
- Font loads asynchronously
- During load, `customFont` is `null`
- After load, `customFont` is object
- **This triggers Effect 1 TWICE** - once when `fontType` changes, again when font loads

**Timeline**:
1. User clicks custom font
2. `setCustomFont(123, 'MyFont')` called
3. `fontType: 'custom'`, `customFontId: 123`
4. useFontLoader starts loading (font is still null)
5. **Effect 1 runs** with `customFont: null` → rendition destroyed/recreated
6. useFontLoader finishes loading
7. `customFont` changes from `null` → `LoadedFont`
8. **Effect 1 runs AGAIN** → rendition destroyed/recreated **AGAIN**
9. **Effects 3 & 4 cleanup** → try to remove listeners from destroyed rendition → **CRASH**

## Root Cause Analysis

### Bug 1: Custom Font Crash

**Primary Root Cause**: Including `fontType` and `customFont` in rendition initialization dependency array ([`useEpubReader.ts:148`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L148)) causes rendition to be destroyed and recreated on font changes, triggering race condition with event listener cleanup.

**Secondary Cause**: epub.js rendition null checks are insufficient - checking `if (rendition && typeof rendition.off === 'function')` doesn't detect destroyed rendition state.

**Tertiary Cause**: Asynchronous font loading triggers Effect 1 twice, compounding the race condition.

**Why It Happens**: The content hook that injects custom fonts captures `fontType` and `customFont` in closure, requiring them in dependency array. But this creates an impossible situation - we MUST include them (for correctness) but doing so causes crashes.

### Bug 2: Fonts Don't Switch

**Primary Root Cause** (80% confidence): `rendition.themes.update()` at [`useEpubReader.ts:190`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L190) does not actually re-render the current page in epub.js. It only updates theme config for future page renders.

**Secondary Cause** (15% confidence): React effect not running due to Zustand subscription issue or effect dependency stale closure.

**Tertiary Cause** (5% confidence): Browser caching or localStorage corruption.

## Evidence Summary

| Finding | Evidence | Confidence |
|---------|----------|------------|
| Line 68 is wrong location | Line 68 is savePosition, not removeEventListener | 100% |
| Actual crash at useEpubReader.ts:226 | Only removeEventListener in epub.js code | 95% |
| Race condition from dependency array | fontType/customFont in Effect 1 deps | 100% |
| Null check insufficient | rendition.off exists on destroyed object | 90% |
| Async font load triggers twice | useFontLoader changes null→object | 95% |
| themes.update() doesn't re-render | Comment + user report | 80% |
| Effect might not run | No console.log evidence | 50% |

## Testing Strategy

### Verify Crash Bug

1. **Setup**: Open reader with serif font
2. **Upload**: Upload a custom font (TTF/OTF)
3. **Trigger**: Click custom font in settings
4. **Observe**: Check browser console for TypeError
5. **Expected**: Crash with "Cannot read properties of undefined (reading 'removeEventListener')"

### Verify Font Switching Bug

1. **Setup**: Open reader with serif font
2. **Action**: Click sans-serif in FontSelector
3. **Observe**: Check if font changes on current page
4. **Expected**: Font remains serif (bug confirmed)
5. **Test Navigation**: Click next page
6. **Observe**: Check if font changes on new page
7. **Expected**: If font changes on new page but not current, confirms `themes.update()` doesn't work

### Test Console Logging

Add logging to verify effect execution:

**Location**: [`hooks/useEpubReader.ts:152`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L152)
```typescript
useEffect(() => {
  console.log('[useEpubReader] STYLING EFFECT RUNNING', {
    fontFamily,
    fontType,
    customFont: !!customFont,
    rendition: !!rendition,
    timestamp: Date.now()
  });

  if (!rendition) return;
  // ... existing code
```

**Location**: [`hooks/useEpubReader.ts:190`](/Users/seankim/dev/reader/hooks/useEpubReader.ts#L190)
```typescript
  // Before themes.update()
  console.log('[useEpubReader] Calling themes.update()', { fontFamilyCSS });

  rendition.themes.update();

  console.log('[useEpubReader] themes.update() completed');
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

### Test localStorage

```javascript
// In browser console
const settings = localStorage.getItem('reader-settings');
console.log('Current settings:', JSON.parse(settings));

// Clear and test
localStorage.removeItem('reader-settings');
location.reload();
```

## Proposed Fixes (Not Implemented - Documentation Only)

### Fix 1: Rendition Destruction Race Condition

**Option A**: Don't include `fontType`/`customFont` in rendition deps - inject fonts via different mechanism

**Option B**: Add flag to prevent cleanup when re-initializing:
```typescript
const reinitializing = useRef(false);

useEffect(() => {
  // ... create rendition ...

  return () => {
    if (!reinitializing.current && newRendition) {
      newRendition.destroy();
    }
  };
}, [book, containerRef, fontType, customFont]);
```

**Option C**: Manually remove event listeners BEFORE destroying rendition:
```typescript
return () => {
  if (newRendition) {
    // Explicitly clean up listeners first
    newRendition.off('click');
    newRendition.off('relocated');
    newRendition.destroy();
  }
};
```

### Fix 2: Font Switching Not Working

**Option A**: Force re-render by navigating to same location:
```typescript
rendition.themes.update();

// Force re-render current page
const currentCfi = rendition.location?.start?.cfi;
if (currentCfi) {
  rendition.display(currentCfi);
}
```

**Option B**: Don't destroy rendition on font change - inject styles dynamically:
```typescript
// In hooks.content.register
const updateFontStyles = () => {
  const existingStyle = doc.querySelector('[data-custom-font]');
  if (existingStyle) existingStyle.remove();

  if (fontType === 'custom' && customFont) {
    // ... inject new style ...
  }
};
```

**Option C**: Use epub.js themes API differently - register multiple themes:
```typescript
rendition.themes.register('serif', { /* ... */ });
rendition.themes.register('sans-serif', { /* ... */ });
rendition.themes.register('custom', { /* ... */ });

// Then switch
rendition.themes.select(fontFamily);
```

## Related Issues

- Similar crash reported in: (check git history for previous "font" or "removeEventListener" fixes)
- epub.js documentation: Check if `themes.update()` is documented to re-render current page

## Open Questions

1. Does epub.js `rendition.themes.update()` actually re-render the current page, or only apply to next navigation?
2. Can we inject custom fonts WITHOUT including them in rendition initialization dependencies?
3. Is there a way to detect "destroyed" state on epub.js rendition object?
4. Why doesn't epub.js provide a `.isDestroyed()` method or similar?
5. Could we use a single effect for ALL rendition lifecycle instead of splitting into 4 effects?

## Next Steps for Implementation

1. **Immediate**: Add console.log statements to verify effect execution and themes.update() behavior
2. **Quick Win**: Test if navigating to current CFI after themes.update() forces re-render
3. **Proper Fix**: Refactor font injection to not require rendition re-initialization
4. **Long-term**: Consider switching from epub.js to different EPUB renderer if issues persist
