---
doc_type: research
date: 2025-11-13T17:13:12+00:00
title: "Font State Synchronization and Reload Issues"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T17:13:12+00:00"
research_question: "Why do uploaded fonts not appear in the font selector until page reload, and why do font changes only apply after reload?"
research_type: codebase_research
researcher: Sean Kim

git_commit: dc51a88d49fa0d4a022d16ad8937c829f6fffc2a
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - fonts
  - state-management
  - react
  - indexeddb
  - reload-dependency
status: complete

related_docs:
  - thoughts/research/2025-11-13-font-switching-not-working-investigation.md
  - thoughts/research/2025-11-13-font-switching-complete-failure-analysis.md
---

# Research: Font State Synchronization and Reload Issues

**Date**: 2025-11-13T17:13:12+00:00
**Researcher**: Sean Kim
**Git Commit**: dc51a88d49fa0d4a022d16ad8937c829f6fffc2a
**Branch**: main
**Repository**: reader

## Research Question

Why do uploaded fonts not appear in the font selector until page reload, and why do font changes only apply after reload?

## Summary

This investigation identified **TWO SEPARATE STATE SYNCHRONIZATION BUGS** that require page reloads:

### Issue 1: Uploaded Fonts Don't Appear in Selector Until Reload

**Root Cause**: `FontSelector` component loads custom fonts only on mount (empty dependency array) and has no mechanism to refresh when new fonts are uploaded.

**Severity**: User Experience Bug - breaks expected workflow

**Location**: `components/fonts/FontSelector.tsx:12-14`

**Impact**: Users must reload the entire page to see newly uploaded fonts in the dropdown

### Issue 2: Font Changes Don't Apply Until Reload

**Root Cause**: This is actually a **DIFFERENT BUG** than the one documented in previous research. Previous research found fonts don't apply immediately (requiring page turn), but THIS investigation found fonts require **full page reload**, suggesting either:
1. Effects are not running at all, OR
2. Zustand store is not triggering re-renders, OR
3. Effects are running but `rendition.themes.update()` is missing (as found in previous research)

**Severity**: Critical - core functionality completely non-functional

**Location**: Multiple potential causes across `hooks/useEpubReader.ts:131-191`

## Detailed Findings

### 1. Font Upload Flow Analysis

#### 1.1 User Uploads Font

**Component**: `components/fonts/FontUploadModal.tsx`

**Upload Handler** (`FontUploadModal.tsx:75-110`):
```typescript
const handleUpload = async () => {
  if (!file || !validationResult?.valid || !validationResult.metadata) return;

  setUploading(true);

  try {
    const buffer = await file.arrayBuffer();
    const fontId = await uploadFont({
      name: validationResult.metadata.family,
      family: validationResult.metadata.family,
      buffer,
      format: validationResult.metadata.format,
      style: validationResult.metadata.style,
      weight: validationResult.metadata.weight,
      sizeBytes: file.size,
      mimeType: file.type,
    });

    console.log('[FontUploadModal] Font uploaded successfully:', fontId);

    // Reset state
    setFile(null);
    setValidationResult(null);
    setUploading(false);

    onSuccess();  // <-- Line 100: Calls parent's onSuccess callback
    onClose();    // <-- Line 101: Closes the modal
  } catch (error) {
    console.error('[FontUploadModal] Upload failed:', error);
    // ...
  }
};
```

**Key Observations**:
- Line 82: Font is uploaded to IndexedDB via `uploadFont()` from `lib/db.ts`
- Line 93: Success log confirms upload completion
- Line 100: Calls `onSuccess()` callback provided by parent component
- Line 101: Closes the modal

**IndexedDB Operation** (`lib/db.ts:556-562`):
```typescript
export async function uploadFont(font: Omit<CustomFont, 'id' | 'uploadedAt'>): Promise<number> {
  const fontWithDate: CustomFont = {
    ...font,
    uploadedAt: new Date(),
  };
  return await db.customFonts.add(fontWithDate);
}
```

The upload completes successfully and returns the font ID. The data IS in IndexedDB.

#### 1.2 Parent Component Receives Success Callback

**Component**: `components/shared/TypographySettings.tsx`

**FontUploadModal Integration** (`TypographySettings.tsx:41-48`):
```typescript
<FontUploadModal
  isOpen={uploadModalOpen}
  onClose={() => setUploadModalOpen(false)}
  onSuccess={() => {
    // Font list will auto-refresh via FontManager's useEffect
  }}
/>
```

**CRITICAL BUG #1**: The `onSuccess` callback at line 45 is **EMPTY** with a misleading comment.

**The Comment Says**: "Font list will auto-refresh via FontManager's useEffect"

**Reality Check**: Let's examine if this is true.

#### 1.3 FontManager Component

**Component**: `components/fonts/FontManager.tsx`

**Font Loading Logic** (`FontManager.tsx:17-24`):
```typescript
useEffect(() => {
  loadFonts();
}, []);  // <-- EMPTY DEPENDENCY ARRAY

const loadFonts = async () => {
  const allFonts = await listFonts();
  setFonts(allFonts);
};
```

**Analysis**:
- Line 17-19: `useEffect` runs ONLY on component mount (empty deps `[]`)
- Line 21-24: `loadFonts()` fetches from IndexedDB and updates local state
- **THERE IS NO MECHANISM TO RE-RUN THIS AFTER UPLOAD**

**FontManager Re-renders**: The component CAN re-render if props change, but it has NO props that would trigger re-render after upload.

**Parent Component**: `TypographySettings.tsx` renders FontManager at line 39:
```typescript
<FontManager onUploadClick={() => setUploadModalOpen(true)} />
```

The only prop is `onUploadClick` which is a stable function. This will NOT trigger re-render.

#### 1.4 FontSelector Component

**Component**: `components/fonts/FontSelector.tsx`

**Font Loading Logic** (`FontSelector.tsx:12-19`):
```typescript
useEffect(() => {
  loadFonts();
}, []);  // <-- EMPTY DEPENDENCY ARRAY

const loadFonts = async () => {
  const fonts = await listFonts();
  setCustomFonts(fonts);
};
```

**IDENTICAL PROBLEM**: Same empty dependency array pattern. No mechanism to refresh.

### 2. State Synchronization Chain Analysis

#### 2.1 Component Hierarchy

```
TypographySettings (parent)
├── FontSelector (loads fonts on mount only)
├── FontManager (loads fonts on mount only)
└── FontUploadModal (uploads font, calls onSuccess, closes)
```

**The Problem**:
1. FontUploadModal uploads font to IndexedDB ✅
2. FontUploadModal calls `onSuccess()` which does nothing ❌
3. FontUploadModal closes ✅
4. FontSelector and FontManager still have stale local state ❌
5. User doesn't see new font ❌

**After Page Reload**:
1. Components remount
2. `useEffect(() => { loadFonts() }, [])` runs again
3. `listFonts()` fetches fresh data from IndexedDB
4. New font appears ✅

### 3. Font Selection and Application Flow

#### 3.1 User Selects Font in Dropdown

**Component**: `components/fonts/FontSelector.tsx`

**Selection Handler** (`FontSelector.tsx:21-34`):
```typescript
const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const value = e.target.value;

  if (value === 'serif' || value === 'sans-serif') {
    setFontFamily(value);  // <-- System font
  } else {
    // Custom font selected
    const fontId = parseInt(value, 10);
    const selectedFont = customFonts.find(f => f.id === fontId);
    if (selectedFont) {
      setCustomFont(fontId, selectedFont.family);  // <-- Custom font
    }
  }
};
```

**Store Actions Called**:
- Line 25: `setFontFamily(value)` for system fonts
- Line 31: `setCustomFont(fontId, family)` for custom fonts

Both are Zustand store actions.

#### 3.2 Settings Store Update

**Store**: `stores/settingsStore.ts`

**System Font Action** (`settingsStore.ts:48-52`):
```typescript
setFontFamily: (fontFamily) => set({
  fontFamily,
  fontType: 'system',      // Set system font type
  customFontId: undefined, // Clear custom font reference
}),
```

**Custom Font Action** (`settingsStore.ts:57-61`):
```typescript
setCustomFont: (fontId, fontFamily) => set({
  customFontId: fontId,
  fontFamily,              // Store CSS font-family name
  fontType: 'custom',
}),
```

Both actions correctly update the Zustand store state. The store uses the `persist` middleware to save to localStorage.

#### 3.3 EPUB Reader Consumes Settings

**Hook**: `hooks/useEpubReader.ts`

**Settings Consumption** (`useEpubReader.ts:26`):
```typescript
const { theme, fontSize, fontFamily, fontType, customFontId, lineHeight } = useSettingsStore();
```

**Font Loader Hook** (`useEpubReader.ts:29-32`):
```typescript
const { font: customFont, loading: fontLoading, error: fontError } = useFontLoader({
  fontId: customFontId,
  enabled: fontType === 'custom',
});
```

**Critical Dependencies**:
- `fontFamily`: Changes when user selects serif/sans-serif
- `fontType`: Changes when switching between system/custom
- `customFontId`: Changes when user selects different custom font
- `customFont`: Changes when `useFontLoader` loads a different font (async)

#### 3.4 Styling Effect

**Effect** (`useEpubReader.ts:131-191`):
```typescript
// Apply styling
useEffect(() => {
  if (!rendition) return;

  // Determine font-family CSS value
  let fontFamilyCSS: string;

  if (fontType === 'custom' && customFont) {
    // Custom font: use font family name with system fallback
    const systemFallback = fontFamily === 'serif' ? 'Georgia, serif' : '-apple-system, sans-serif';
    fontFamilyCSS = `'${customFont.family}', ${systemFallback}`;
  } else {
    // System font: use existing logic
    fontFamilyCSS = fontFamily === 'serif'
      ? 'Georgia, serif'
      : '-apple-system, sans-serif';
  }

  // Apply theme colors and styles
  const colors = THEME_COLORS[theme];

  // Use themes.default() for base styles and color
  rendition.themes.default({
    body: {
      'background-color': `${colors.bg} !important`,
      color: `${colors.text} !important`,
      padding: '2rem !important',
    },
    // ID-based selector for maximum specificity (0,1,0,1) beats classes (0,0,1,0)
    // This overrides EPUB's class-based fonts like .noindent5 { font-family: EBGaramond }
    '#epub-reader-body *': {
      'font-family': `${fontFamilyCSS} !important`,
    },
    p: {
      'margin-bottom': '1em !important',
    },
    a: {
      color: `${colors.text} !important`,
      'text-decoration': 'underline !important',
    },
  });

  // Use themes.override() for typography - this applies INLINE STYLES to body element
  // Inline styles have highest CSS specificity and override EPUB-embedded class styles
  // like .noindent5 { font-family: "EBGaramond", serif; }
  rendition.themes.override('font-family', fontFamilyCSS, true);
  rendition.themes.override('font-size', `${fontSize}px`, true);
  rendition.themes.override('line-height', `${lineHeight}`, true);

  // Force epub.js to re-apply all theme changes to currently rendered content
  rendition.themes.update();

  console.log('[useEpubReader] Styling applied:', {
    fontFamily,
    fontType,
    customFont: customFont?.family,
    computedCSS: fontFamilyCSS,
    theme,
    fontSize,
    lineHeight
  });
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

**Dependency Array** (line 191):
```typescript
[rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]
```

**Analysis**:
- All used variables ARE in the dependency array ✅
- Effect SHOULD re-run when any of these change
- Line 180: `rendition.themes.update()` is present ✅ (added from previous research)
- Line 182-190: Console log for debugging

**WAIT!** Looking at the actual code I read, I see the `rendition.themes.update()` IS there at line 180! This suggests the previous research fix was already applied.

Let me check the other custom font injection effect.

#### 3.5 Custom Font Injection Effect

**Effect** (`useEpubReader.ts:194-244`):
```typescript
// Inject custom font @font-face into iframe when custom font is selected
useEffect(() => {
  if (!rendition || fontType !== 'custom' || !customFont) return;

  console.log('[useEpubReader] Registering custom font injection hook');

  const formatMap: Record<string, string> = {
    truetype: 'truetype',
    opentype: 'opentype',
    woff: 'woff',
    woff2: 'woff2',
  };

  // Register a content hook to inject @font-face into each iframe as it loads
  const contentHook = (contents: any) => {
    const doc = contents.document;

    // Remove any existing custom font styles
    const existingStyles = doc.querySelectorAll('style[data-custom-font="true"]');
    existingStyles.forEach((style: HTMLStyleElement) => style.remove());

    // Inject new custom font using data URL (blob URLs don't work across iframes)
    const style = doc.createElement('style');
    style.setAttribute('data-custom-font', 'true');
    style.textContent = `
      @font-face {
        font-family: '${customFont.family}';
        src: url('${customFont.dataURL}') format('${formatMap[customFont.format]}');
        font-weight: ${customFont.weight};
        font-style: ${customFont.style};
        font-display: swap;
      }
    `;

    doc.head.appendChild(style);
    console.log('[useEpubReader] Custom font injected into iframe:', {
      family: customFont.family,
      format: customFont.format,
      dataURLLength: customFont.dataURL.length
    });
  };

  rendition.hooks.content.register(contentHook);

  // Force re-render of current page with new font
  rendition.themes.update();

  return () => {
    // Deregister the hook when custom font changes or is disabled
    rendition.hooks.content.deregister(contentHook);
  };
}, [rendition, fontType, customFont]);
```

**Dependency Array** (line 244):
```typescript
[rendition, fontType, customFont]
```

**Analysis**:
- Line 195: Effect only runs if `rendition`, `fontType === 'custom'`, and `customFont` are all truthy
- Line 207-234: Registers a content hook that injects `@font-face` into each iframe page
- Line 236: Registers the hook with epub.js
- Line 239: Calls `rendition.themes.update()` to re-render ✅
- Line 242: Cleanup deregisters the hook

This effect also has `themes.update()` called.

### 4. Why "Only Works After Reload"?

Based on the code review, both effects that handle font changes have `rendition.themes.update()` calls. So why would fonts "only work after reload"?

**Hypothesis 1: Effects Not Running**
- Zustand store updates but components don't re-render
- Possible if Zustand subscription is not working
- Would require debugging with console.logs

**Hypothesis 2: themes.update() Not Sufficient**
- Previous research suggested `themes.update()` doesn't re-render current page
- But the code I see HAS this call
- Maybe it was added but still doesn't work?

**Hypothesis 3: Timing Issue**
- Custom font loading is async (`useFontLoader` hook)
- When user selects custom font:
  1. `customFontId` changes → triggers `useFontLoader`
  2. `customFont` is `null` initially (loading)
  3. Effect runs with `customFont === null` → early return (line 195)
  4. Font loads → `customFont` changes to object
  5. Effect SHOULD run again, but maybe it doesn't?

**Hypothesis 4: Stale Closure**
- The `customFont` object might not be triggering effect re-run
- Reference equality issue with Zustand + React effects

**After Page Reload**:
- Components remount
- Fresh state loaded from localStorage (via Zustand persist)
- `customFontId` is loaded
- `useFontLoader` loads the font
- Effects run with correct values
- Fonts work ✅

### 5. Previous Research Comparison

**Previous Research**: `thoughts/research/2025-11-13-font-switching-not-working-investigation.md`

**That research found**: Fonts don't switch immediately, need page turn

**That research suggested**: Add `rendition.themes.update()` call

**Current code**: Already has `rendition.themes.update()` at line 180 and 239

**Current issue**: Fonts require FULL PAGE RELOAD, not just page turn

**This suggests**: Different bug, likely effects not running at all OR Zustand not triggering re-renders

## Root Cause Analysis

### Issue 1: Uploaded Fonts Don't Appear Until Reload

**Root Cause**: Missing state refresh mechanism after font upload

**Specific Locations**:
1. `components/fonts/FontSelector.tsx:12-14` - Empty dependency array, no refresh
2. `components/fonts/FontManager.tsx:17-19` - Empty dependency array, no refresh
3. `components/shared/TypographySettings.tsx:45-47` - Empty `onSuccess` callback

**Why It Happens**:
- Components load fonts on mount only
- No communication between FontUploadModal and FontSelector/FontManager
- Parent component doesn't coordinate state refresh

**Evidence**:
- `listFonts()` from `lib/db.ts:574-576` DOES return correct data from IndexedDB
- Upload completes successfully to IndexedDB
- Components just don't re-fetch

### Issue 2: Font Changes Don't Apply Until Reload

**Root Cause**: Uncertain - requires testing to confirm from multiple possibilities

**Possibility A** (60% confidence): Zustand store updates but useEpubReader effect not re-running
- Effects have correct dependencies
- But Zustand subscription might not trigger re-renders
- Destructuring pattern might create stale closure

**Possibility B** (30% confidence): `rendition.themes.update()` doesn't work in current epub.js version
- Code HAS the call (line 180, 239)
- Previous research suggested adding it
- But maybe it doesn't actually re-render?

**Possibility C** (10% confidence): Async font loading timing issue
- Effect runs before font loads
- Effect doesn't re-run after font loads
- Reference equality issue with `customFont` object

**Why It Works After Reload**:
- Fresh component mount
- Store state loaded from localStorage
- Effects run with correct initial values
- No dependency change tracking needed

## Code References

### Font Upload Flow
- `components/fonts/FontUploadModal.tsx:75-110` - Upload handler, calls onSuccess
- `components/shared/TypographySettings.tsx:45-47` - Empty onSuccess callback
- `lib/db.ts:556-562` - uploadFont() function

### Font List Loading
- `components/fonts/FontSelector.tsx:12-19` - Mount-only font loading
- `components/fonts/FontManager.tsx:17-19` - Mount-only font loading
- `lib/db.ts:574-576` - listFonts() function

### Font Selection
- `components/fonts/FontSelector.tsx:21-34` - Selection handler
- `stores/settingsStore.ts:48-52` - setFontFamily action
- `stores/settingsStore.ts:57-61` - setCustomFont action

### Font Application
- `hooks/useEpubReader.ts:26` - Store consumption
- `hooks/useEpubReader.ts:29-32` - useFontLoader hook
- `hooks/useEpubReader.ts:131-191` - Styling effect with themes.update()
- `hooks/useEpubReader.ts:194-244` - Custom font injection with themes.update()
- `hooks/useFontLoader.ts:34-120` - Font loading from IndexedDB

## Event Flow Diagrams

### Current Flow: Font Upload (BROKEN)

```
User clicks "Upload Font"
    ↓
FontUploadModal opens
    ↓
User selects file → validation → upload
    ↓
uploadFont() → IndexedDB.add() ✅ SUCCESS
    ↓
onSuccess() called → EMPTY CALLBACK ❌
    ↓
Modal closes
    ↓
FontSelector still has old state ❌
FontManager still has old state ❌
    ↓
User doesn't see new font ❌
```

### Current Flow: Font Selection (BROKEN?)

```
User selects font in dropdown
    ↓
handleChange() → setFontFamily() OR setCustomFont()
    ↓
Zustand store updates
    ↓
localStorage persisted
    ↓
useEpubReader re-renders?? (UNCLEAR)
    ↓
useFontLoader loads font (async)
    ↓
Effects run?? (UNCLEAR)
    ↓
themes.update() called?? (UNCLEAR)
    ↓
Font doesn't change ❌
```

### After Page Reload (WORKS)

```
Page reloads
    ↓
Components remount
    ↓
FontSelector.useEffect(() => loadFonts(), [])
    ↓
listFonts() → IndexedDB.getAll() → Fresh data ✅
    ↓
New font appears in dropdown ✅
    ↓
useSettingsStore reads from localStorage
    ↓
customFontId loaded
    ↓
useFontLoader loads font
    ↓
Effects run with correct values
    ↓
Font applies correctly ✅
```

## Testing Strategy

### Test 1: Verify Font Upload to IndexedDB

**Steps**:
1. Upload a custom font
2. Open browser DevTools → Application → IndexedDB → AdaptiveReaderDB → customFonts
3. Verify font entry exists with correct data

**Expected**: Font is in database ✅

**If Fails**: Upload logic is broken (unlikely based on code)

### Test 2: Verify onSuccess Callback Execution

**Add logging** to `components/fonts/FontUploadModal.tsx:100`:
```typescript
onSuccess();
console.log('[FontUploadModal] onSuccess callback executed');
```

**Add logging** to `components/shared/TypographySettings.tsx:45`:
```typescript
onSuccess={() => {
  console.log('[TypographySettings] onSuccess received!');
  // Font list will auto-refresh via FontManager's useEffect
}}
```

**Expected**: Both logs appear after upload

### Test 3: Verify FontSelector State After Upload

**Add logging** to `components/fonts/FontSelector.tsx:17`:
```typescript
const loadFonts = async () => {
  const fonts = await listFonts();
  console.log('[FontSelector] Loaded fonts:', fonts.length, fonts);
  setCustomFonts(fonts);
};
```

**Steps**:
1. Upload font
2. Check console for loadFonts log

**Expected**: Log appears ONCE on mount, NOT after upload

**If True**: Confirms FontSelector doesn't refresh

### Test 4: Verify Styling Effect Execution on Font Change

**Add logging** to `hooks/useEpubReader.ts:133`:
```typescript
useEffect(() => {
  console.log('[useEpubReader.styling] Effect triggered:', {
    rendition: !!rendition,
    fontFamily,
    fontType,
    customFont: customFont?.family,
    timestamp: Date.now()
  });

  if (!rendition) return;
  // ...existing code
```

**Steps**:
1. Select different font
2. Check console for effect log

**Expected If Bug Exists**: Log does NOT appear after selection

**Expected If Working**: Log appears but font still doesn't change (themes.update issue)

### Test 5: Verify Zustand Store Update

**Add logging** to `stores/settingsStore.ts:58`:
```typescript
setCustomFont: (fontId, fontFamily) => {
  console.log('[settingsStore] setCustomFont called:', { fontId, fontFamily });
  set({
    customFontId: fontId,
    fontFamily,
    fontType: 'custom',
  });
},
```

**Steps**:
1. Select custom font
2. Check console for store log

**Expected**: Log appears immediately when font selected

### Test 6: Verify useFontLoader Hook Execution

**Add logging** to `hooks/useFontLoader.ts:47`:
```typescript
const loadFont = async () => {
  console.log('[useFontLoader] Loading font:', fontId);
  setLoading(true);
  setError(null);

  try {
    const customFont = await getFont(fontId);
    console.log('[useFontLoader] Font loaded:', customFont?.family);
    // ...
```

**Steps**:
1. Select custom font
2. Check console for loading logs

**Expected**: Logs appear showing font loading

**If Missing**: useFontLoader not re-running (dependency issue)

## Open Questions

1. **Does the Zustand destructuring pattern trigger re-renders correctly?**
   - Current: `const { fontFamily, fontType, ... } = useSettingsStore();`
   - Alternative: `const fontFamily = useSettingsStore(state => state.fontFamily);`

2. **Is `rendition.themes.update()` actually working?**
   - Code has the call
   - But is it effective?
   - Does it need `rendition.display(currentCFI)` after it?

3. **Does `customFont` object reference change when font loads?**
   - If same reference, effect won't re-run
   - useFontLoader returns new object each time?

4. **Are there errors in console during font selection?**
   - Silent failures?
   - Rejected promises?

5. **Does React Strict Mode double-render cause issues?**
   - Effects run twice in development
   - Cleanup might cancel operations?

## Related Documents

### Previous Research
- `thoughts/research/2025-11-13-font-switching-not-working-investigation.md` - Font switching requiring page turn
- `thoughts/research/2025-11-13-font-switching-complete-failure-analysis.md` - Crash analysis and race conditions

### Differences from This Research
- Previous research focused on fonts not applying immediately (need page turn)
- This research focuses on fonts requiring FULL PAGE RELOAD
- Previous research suggested adding `themes.update()` - already present in current code
- This suggests either:
  - Previous fix was not fully effective, OR
  - User reporting different symptoms of same issue, OR
  - New regression introduced

## Next Steps for Implementation

**NOT INCLUDED** (documentation only, per instructions)

This research documents the current state. Implementation would require:
1. Adding state refresh mechanism after font upload
2. Diagnosing why effects don't run on font selection
3. Testing and verifying the root cause with console logging
4. Potentially refactoring Zustand usage pattern
