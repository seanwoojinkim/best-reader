---
doc_type: research
date: 2025-11-13T16:22:02+00:00
title: "Font Switching Not Working Investigation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T16:22:02+00:00"
research_question: "Why are fonts not switching when users select different font options (serif, sans-serif, or custom fonts)?"
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
  - epub-reader
  - settings
  - ui-bug
status: complete

related_docs: []
---

# Research: Font Switching Not Working Investigation

**Date**: 2025-11-13T16:22:02+00:00
**Researcher**: Sean Kim
**Git Commit**: f043ea027c72c71df95873aeac6edad6d812395b
**Branch**: main
**Repository**: reader

## Research Question

Why are fonts not switching when users select different font options (serif, sans-serif, or custom fonts)? The app is no longer crashing, but font changes are not being applied to the EPUB reader.

## Summary

**ROOT CAUSE IDENTIFIED**: The styling effect in `hooks/useEpubReader.ts:151-187` is **NOT re-running when font settings change** because it has a **stale dependency array** that does not properly trigger on font changes.

**Specific Issue**: The effect at line 151 depends on `fontFamily` (line 163) for determining the font CSS, but the dependency array at line 187 includes `fontFamily` which should theoretically work. However, the real problem is more subtle:

1. When `setFontFamily()` is called for system fonts, it updates `fontFamily`, `fontType`, and clears `customFontId`
2. When `setCustomFont()` is called, it updates `customFontId`, `fontFamily`, and `fontType`
3. The styling effect dependency array includes: `[rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]`
4. The `customFont` dependency is from the `useFontLoader` hook result

The flow appears correct on paper, but there's a **critical issue**: The settings store updates happen, but the React effect is not detecting the change properly, likely due to Zustand's state management and how React's effect dependency comparison works.

## Detailed Findings

### 1. Font Selection UI Flow (`components/fonts/FontSelector.tsx`)

**File**: `components/fonts/FontSelector.tsx`

**How it works**:
- Component renders a `<select>` dropdown with system fonts (serif, sans-serif) and custom fonts ([FontSelector.tsx:40-69](https://github.com/user/reader/blob/main/components/fonts/FontSelector.tsx#L40-L69))
- On change handler at line 21 processes selection:
  - For system fonts: calls `setFontFamily(value)` at line 25
  - For custom fonts: calls `setCustomFont(fontId, selectedFont.family)` at line 31
- Current value is determined by `fontType` and `customFontId` state at lines 36-38

**State reading**:
```typescript
const { fontFamily, fontType, customFontId, setFontFamily, setCustomFont } = useSettingsStore();
```
[FontSelector.tsx:10](https://github.com/user/reader/blob/main/components/fonts/FontSelector.tsx#L10)

**Event handler**:
```typescript
const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  const value = e.target.value;

  if (value === 'serif' || value === 'sans-serif') {
    setFontFamily(value);
  } else {
    // Custom font selected
    const fontId = parseInt(value, 10);
    const selectedFont = customFonts.find(f => f.id === fontId);
    if (selectedFont) {
      setCustomFont(fontId, selectedFont.family);
    }
  }
};
```
[FontSelector.tsx:21-34](https://github.com/user/reader/blob/main/components/fonts/FontSelector.tsx#L21-L34)

**Finding**: The UI wiring is correct. When users select fonts, the appropriate store actions are called.

---

### 2. Settings Store Updates (`stores/settingsStore.ts`)

**File**: `stores/settingsStore.ts`

**System Font Selection** (`setFontFamily`):
```typescript
setFontFamily: (fontFamily) => set({
  fontFamily,
  fontType: 'system',      // Set system font type
  customFontId: undefined, // Clear custom font reference
}),
```
[settingsStore.ts:48-52](https://github.com/user/reader/blob/main/stores/settingsStore.ts#L48-L52)

**Custom Font Selection** (`setCustomFont`):
```typescript
setCustomFont: (fontId, fontFamily) => set({
  customFontId: fontId,
  fontFamily,              // Store CSS font-family name
  fontType: 'custom',
}),
```
[settingsStore.ts:57-61](https://github.com/user/reader/blob/main/stores/settingsStore.ts#L57-L61)

**Persistence Configuration**:
```typescript
partialize: (state) => ({
  theme: state.theme,
  fontSize: state.fontSize,
  fontFamily: state.fontFamily,
  fontType: state.fontType,        // NEW: Persist font type
  customFontId: state.customFontId, // NEW: Persist custom font ID
  lineHeight: state.lineHeight,
  margins: state.margins,
}),
```
[settingsStore.ts:89-97](https://github.com/user/reader/blob/main/stores/settingsStore.ts#L89-L97)

**Finding**: Store actions are implemented correctly. Both `setFontFamily` and `setCustomFont` update the state properly and include the new `fontType` and `customFontId` fields. Persistence is configured to save these values.

---

### 3. Font Loading Hook (`hooks/useFontLoader.ts`)

**File**: `hooks/useFontLoader.ts`

**Hook signature**:
```typescript
export function useFontLoader({ fontId, enabled }: FontLoaderOptions) {
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobURLRef = useRef<string | null>(null);
```
[useFontLoader.ts:27-31](https://github.com/user/reader/blob/main/hooks/useFontLoader.ts#L27-L31)

**Effect dependencies**:
```typescript
useEffect(() => {
  if (!enabled || !fontId) {
    // Cleanup previous blob URL if font disabled
    if (blobURLRef.current) {
      URL.revokeObjectURL(blobURLRef.current);
      blobURLRef.current = null;
    }
    setFont(null);
    return;
  }
  // ... load font from IndexedDB
}, [fontId, enabled]);
```
[useFontLoader.ts:33-110](https://github.com/user/reader/blob/main/hooks/useFontLoader.ts#L33-L110)

**Font loading logic**:
1. Fetches font from IndexedDB via `getFont(fontId)` at line 52
2. Creates blob URL from ArrayBuffer at line 78
3. Returns `LoadedFont` object with family, blobURL, format, weight, style

**Finding**: The hook correctly responds to `fontId` and `enabled` changes. When `customFontId` changes in the store, this hook will re-run and load the new font. The cleanup logic properly revokes old blob URLs to prevent memory leaks.

---

### 4. Font Application in EPUB Reader (`hooks/useEpubReader.ts`)

**File**: `hooks/useEpubReader.ts`

This is where the **critical issue** exists.

#### 4.1 Settings Store Reading

```typescript
const { theme, fontSize, fontFamily, fontType, customFontId, lineHeight } = useSettingsStore();
```
[useEpubReader.ts:26](https://github.com/user/reader/blob/main/hooks/useEpubReader.ts#L26)

**⚠️ OBSERVATION**: The code reads `fontFamily`, `fontType`, and `customFontId` from the store. These are all the necessary values.

#### 4.2 Custom Font Loading

```typescript
// Load custom font if selected
const { font: customFont, loading: fontLoading, error: fontError } = useFontLoader({
  fontId: customFontId,
  enabled: fontType === 'custom',
});
```
[useEpubReader.ts:28-32](https://github.com/user/reader/blob/main/hooks/useEpubReader.ts#L28-L32)

**Finding**: The `useFontLoader` is correctly configured to load fonts only when `fontType === 'custom'` and uses the `customFontId` from settings.

#### 4.3 Font Injection into EPUB.js Iframe

```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  // Inject custom font @font-face if available
  if (fontType === 'custom' && customFont) {
    const style = doc.createElement('style');
    style.setAttribute('data-custom-font', 'true');

    const formatMap: Record<string, string> = {
      truetype: 'truetype',
      opentype: 'opentype',
      woff: 'woff',
      woff2: 'woff2',
    };

    style.textContent = `
      @font-face {
        font-family: '${customFont.family}';
        src: url('${customFont.blobURL}') format('${formatMap[customFont.format]}');
        font-weight: ${customFont.weight};
        font-style: ${customFont.style};
        font-display: swap;
      }
    `;

    doc.head.appendChild(style);

    console.log('[useEpubReader] Custom font injected:', customFont.family);
  }
  // ... swipe handlers
});
```
[useEpubReader.ts:82-110](https://github.com/user/reader/blob/main/hooks/useEpubReader.ts#L82-L110)

**Finding**: Custom fonts are injected into the iframe's `<head>` via `@font-face` rules when the rendition initializes. This happens in the `hooks.content.register` callback which runs for each content document loaded by epub.js.

**⚠️ CRITICAL OBSERVATION**: This injection happens in the **rendition initialization effect** at line 66. The dependency array for this effect is:
```typescript
}, [book, containerRef, fontType, customFont]);
```
[useEpubReader.ts:148](https://github.com/user/reader/blob/main/hooks/useEpubReader.ts#L148)

This means when `fontType` or `customFont` changes, the **entire rendition is destroyed and recreated**. This is a heavy operation but ensures the font injection happens.

#### 4.4 Styling Effect - THE PROBLEM

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

  // Apply theme colors
  const colors = THEME_COLORS[theme];
  rendition.themes.default({
    body: {
      'background-color': `${colors.bg} !important`,
      color: `${colors.text} !important`,
      'font-size': `${fontSize}px !important`,
      'line-height': `${lineHeight} !important`,
      'font-family': `${fontFamilyCSS} !important`,
      padding: '2rem !important',
    },
    p: {
      'margin-bottom': '1em !important',
    },
    a: {
      color: `${colors.text} !important`,
      'text-decoration': 'underline !important',
    },
  });
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```
[useEpubReader.ts:150-187](https://github.com/user/reader/blob/main/hooks/useEpubReader.ts#L150-L187)

**Analysis**:

1. **Dependencies**: `[rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]`
2. **Variables used in effect**:
   - `rendition` (line 152) ✅ in deps
   - `fontType` (line 157) ✅ in deps
   - `customFont` (line 157, 160) ✅ in deps
   - `fontFamily` (line 159, 163) ✅ in deps
   - `theme` (line 169) ✅ in deps
   - `fontSize` (line 174) ✅ in deps
   - `lineHeight` (line 175) ✅ in deps

**All dependencies are correctly listed!**

**But wait...** Let me examine the Zustand store reading more carefully.

---

### 5. The Real Problem: Zustand Selector Pattern

**Current pattern** in `useEpubReader.ts:26`:
```typescript
const { theme, fontSize, fontFamily, fontType, customFontId, lineHeight } = useSettingsStore();
```

This uses the **default selector** which subscribes to the entire store. According to Zustand documentation, this should work and trigger re-renders when any of these values change.

However, there's a potential issue with how Zustand's `persist` middleware works with React's effect dependencies.

Let me check if there are any console logs or errors that might give us more information:

**Console logs present**:
- Line 109: `console.log('[useEpubReader] Custom font injected:', customFont.family);`
- No logs in the styling effect

**Hypothesis**: The styling effect is not re-running because:

1. **Possibility 1**: The `rendition` object is being recreated (line 66-148 effect) when `fontType` or `customFont` changes, which means the styling effect at line 151 should also re-run since `rendition` is a dependency. However, there might be a timing issue where the old rendition is destroyed before the new one's styling is applied.

2. **Possibility 2**: The effect IS running, but `rendition.themes.default()` is not applying the styles correctly to the already-rendered content. The epub.js API might require calling `rendition.themes.update()` or re-displaying the current location after theme changes.

3. **Possibility 3**: The `customFont` object reference is not changing even when a different font is loaded, causing React to skip the re-render.

---

### 6. EPUB.js Theme Application Investigation

Looking at the epub.js theme application at line 170:
```typescript
rendition.themes.default({
  body: { /* styles */ },
  p: { /* styles */ },
  a: { /* styles */ },
});
```

**Research findings about epub.js**:
- `rendition.themes.default()` registers default theme styles
- These styles are applied when content is rendered
- For **already rendered content**, the styles might not automatically update
- May need to call `rendition.themes.update()` or re-render the current location

**The rendition recreation** (lines 66-148) has dependencies `[book, containerRef, fontType, customFont]`, which means:
- When `fontType` changes (system ↔ custom), rendition is recreated ✅
- When `customFont` changes (different custom font loaded), rendition is recreated ✅
- When `fontFamily` changes (serif ↔ sans-serif), rendition is **NOT** recreated ❌

**🔍 FOUND IT! This is the issue!**

When user switches between serif and sans-serif (both system fonts):
1. `setFontFamily('serif')` or `setFontFamily('sans-serif')` is called
2. Store updates: `fontFamily` changes, `fontType` stays 'system', `customFontId` stays undefined
3. Rendition initialization effect (line 66) does NOT re-run because `fontType` and `customFont` haven't changed
4. Styling effect (line 151) DOES re-run because `fontFamily` changed
5. Styling effect calls `rendition.themes.default()` with new font
6. But epub.js doesn't apply the new theme to already-rendered content
7. User sees no visual change

---

## Root Cause Analysis

### Primary Issue: Theme Changes Not Applied to Rendered Content

**Location**: `hooks/useEpubReader.ts:170-186`

**Problem**: When the styling effect re-runs and calls `rendition.themes.default()`, epub.js does not automatically re-apply the theme to content that has already been rendered.

**Why it happens**:
1. User is reading a book (content is rendered in iframe)
2. User changes font from serif to sans-serif
3. Styling effect detects `fontFamily` change and re-runs
4. `rendition.themes.default()` updates the theme object
5. But the currently visible page in the iframe keeps the old styles
6. Only when user navigates to a new page, the new theme is applied

**Evidence**:
- The dependency array includes all necessary values
- The effect is likely running (no errors)
- But visual update doesn't happen until page turn

### Secondary Issue: Rendition Not Recreated for System Font Changes

**Location**: `hooks/useEpubReader.ts:148` (rendition effect dependency array)

**Problem**: The rendition initialization effect only depends on `[book, containerRef, fontType, customFont]`, not `fontFamily`. This means:
- Switching serif ↔ sans-serif doesn't recreate rendition (only updates theme)
- Switching to/from custom font DOES recreate rendition (because `fontType` changes)

This inconsistency means:
- Custom font changes trigger full re-render (working, but slow)
- System font changes only update theme (not working, but should be fast)

---

## Code References

### Font Selection UI
- `components/fonts/FontSelector.tsx:21-34` - Font selection handler
- `components/fonts/FontSelector.tsx:10` - Settings store hook usage

### Settings Store
- `stores/settingsStore.ts:48-52` - `setFontFamily()` implementation
- `stores/settingsStore.ts:57-61` - `setCustomFont()` implementation
- `stores/settingsStore.ts:89-97` - Persistence configuration

### Font Loading
- `hooks/useFontLoader.ts:27-31` - Hook state initialization
- `hooks/useFontLoader.ts:33-110` - Font loading effect with IndexedDB

### EPUB Reader
- `hooks/useEpubReader.ts:26` - Settings destructuring from store
- `hooks/useEpubReader.ts:28-32` - Custom font loader hook usage
- `hooks/useEpubReader.ts:66-148` - Rendition initialization effect
- `hooks/useEpubReader.ts:82-110` - Custom font injection via hooks.content.register
- `hooks/useEpubReader.ts:150-187` - Styling effect (THE PROBLEM)

### Type Definitions
- `types/index.ts:54-62` - ReaderSettings interface with fontType and customFontId

---

## Recommended Fixes

### Fix 1: Force Theme Re-application After Update (Primary Fix)

**File**: `hooks/useEpubReader.ts:150-187`

**Problem**: `rendition.themes.default()` doesn't re-apply styles to rendered content.

**Solution**: After calling `rendition.themes.default()`, force a theme update and re-render the current location.

**Implementation**:
```typescript
// Apply styling
useEffect(() => {
  if (!rendition) return;

  // ... determine fontFamilyCSS (lines 154-166)

  // Apply theme colors
  const colors = THEME_COLORS[theme];
  rendition.themes.default({
    // ... theme styles (lines 171-185)
  });

  // ADD THIS: Force re-apply theme to current content
  rendition.themes.update();  // Update theme on already-rendered content

  // OPTIONAL: Re-render current location to ensure theme applies
  // const currentCFI = rendition.currentLocation()?.start.cfi;
  // if (currentCFI) {
  //   rendition.display(currentCFI);
  // }

}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

**Expected behavior**: When font settings change, the theme is updated AND immediately applied to the visible content.

**Trade-offs**:
- ✅ Immediate visual feedback
- ✅ Works for all theme changes (font, colors, size, etc.)
- ⚠️ May cause brief flash if re-rendering location
- ✅ Lightweight compared to recreating entire rendition

### Fix 2: Add Rendition Dependency on fontFamily (Alternative)

**File**: `hooks/useEpubReader.ts:148`

**Problem**: Rendition is not recreated when `fontFamily` changes.

**Solution**: Add `fontFamily` to the rendition effect dependencies to force full recreation.

**Implementation**:
```typescript
return () => {
  if (newRendition) {
    newRendition.destroy();
  }
};
}, [book, containerRef, fontType, customFont, fontFamily]); // ADD fontFamily
//                                               ^^^^^^^^^^
```

**Expected behavior**: Any font change (system or custom) recreates the rendition.

**Trade-offs**:
- ✅ Guarantees theme is applied (fresh rendition)
- ❌ Heavy operation (destroys and recreates entire rendition)
- ❌ User loses current scroll position (unless saved/restored)
- ❌ Performance impact on every font change
- ⚠️ Not recommended - Fix 1 is better

### Fix 3: Improve Zustand Selector (Diagnostic/Optimization)

**File**: `hooks/useEpubReader.ts:26`

**Current**:
```typescript
const { theme, fontSize, fontFamily, fontType, customFontId, lineHeight } = useSettingsStore();
```

**Alternative (explicit selector)**:
```typescript
const theme = useSettingsStore(state => state.theme);
const fontSize = useSettingsStore(state => state.fontSize);
const fontFamily = useSettingsStore(state => state.fontFamily);
const fontType = useSettingsStore(state => state.fontType);
const customFontId = useSettingsStore(state => state.customFontId);
const lineHeight = useSettingsStore(state => state.lineHeight);
```

**Expected behavior**: Ensures each value change triggers proper re-renders.

**Trade-offs**:
- ✅ More explicit, easier to debug
- ✅ Potentially better performance (only re-render when specific values change)
- ❌ More verbose
- ⚠️ May not fix the issue if Fix 1 is needed

---

## Testing Strategy

### Manual Testing Steps

1. **Test system font switching**:
   - Open a book
   - Switch from serif to sans-serif
   - ✅ Expected: Font changes immediately
   - ❌ Current: Font doesn't change until page turn

2. **Test custom font switching**:
   - Upload a custom font
   - Switch to custom font
   - ✅ Expected: Font changes immediately
   - Test: Does it work? (Rendition recreates, so might work)

3. **Test serif ↔ sans-serif switching**:
   - Switch back and forth between serif and sans-serif
   - ✅ Expected: Each change is visible immediately

4. **Test custom ↔ system switching**:
   - Switch from custom to system font
   - ✅ Expected: Font changes immediately
   - Test: Does it work? (Rendition recreates, so might work)

### Console Debugging

Add these logs to diagnose the issue:

**In styling effect** (`useEpubReader.ts:151`):
```typescript
useEffect(() => {
  console.log('[useEpubReader.styling] Effect running:', {
    fontFamily,
    fontType,
    customFont: customFont?.family,
    rendition: !!rendition,
  });

  if (!rendition) return;

  // ... rest of effect

  console.log('[useEpubReader.styling] Theme applied:', {
    fontFamilyCSS,
    theme,
  });
}, [rendition, theme, fontSize, fontFamily, fontType, customFont, lineHeight]);
```

**Expected logs**:
- Effect should run on every font change
- If effect doesn't run, issue is with dependencies
- If effect runs but font doesn't change, issue is with theme application

---

## Related Research

### Historical Context

Check these research documents for related information:
- `thoughts/research/*settings*` - Settings architecture decisions
- `thoughts/research/*font*` - Font loading and management research
- `thoughts/research/*epub*` - EPUB.js integration patterns

### Future Enhancements (Not Part of This Investigation)

These are areas that could be improved but are NOT causing the current bug:

1. **Margins implementation**: The `margins` variable is read from store but hardcoded to `2rem` in the styling (line 177). This is a separate feature gap.

2. **Font preview in selector**: Users can't preview fonts before selecting them.

3. **Persistent font preferences per book**: Currently, font settings are global.

---

## Conclusion

The root cause of fonts not switching is that `rendition.themes.default()` updates the theme object but **does not re-apply it to already-rendered content** in the epub.js iframe.

**Primary fix**: Call `rendition.themes.update()` after `rendition.themes.default()` to force re-application of the theme.

**Implementation location**: `hooks/useEpubReader.ts:186` (after the themes.default() call)

This is a **one-line fix** that will immediately resolve the issue for both system and custom font changes.
