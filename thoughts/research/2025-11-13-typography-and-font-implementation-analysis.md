---
doc_type: research
date: 2025-11-13T15:34:56+00:00
title: "Typography and Font Implementation Analysis"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T15:34:56+00:00"
research_question: "How are fonts currently configured and applied in the e-reader application, and what would be needed to support custom typeface uploads?"
research_type: codebase_research
researcher: Sean Kim

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - typography
  - fonts
  - epub.js
  - settings
  - storage
status: complete

related_docs:
  - thoughts/research/2025-11-11-settings-scope-analysis.md
---

# Research: Typography and Font Implementation Analysis

**Date**: 2025-11-13T15:34:56+00:00
**Researcher**: Sean Kim
**Git Commit**: f043ea027c72c71df95873aeac6edad6d812395b
**Branch**: main
**Repository**: reader

## Research Question

How are fonts currently configured and applied in the e-reader application, and what would be needed to support custom typeface uploads?

## Summary

This e-reader application uses a **two-option font system** with hardcoded font families applied through epub.js themes. Typography settings are **globally scoped** and persisted to localStorage via Zustand. The current architecture supports only "serif" (Georgia) and "sans-serif" (system fonts), with font styling applied dynamically to epub.js rendition iframes. No custom font assets currently exist in the codebase, and no font loading infrastructure is present. To support custom typeface uploads, the application would need: (1) font file storage in IndexedDB, (2) @font-face injection into epub.js iframes, (3) UI for font upload/management, (4) extension of the settings store to handle custom font references, and (5) font preview/selection components.

## Detailed Findings

### 1. Font Configuration System

#### Settings Store ([stores/settingsStore.ts:1-68](file:///Users/seankim/dev/reader/stores/settingsStore.ts))

The font family setting is managed through Zustand with localStorage persistence:

```typescript
// stores/settingsStore.ts:14
setFontFamily: (family: ReaderSettings['fontFamily']) => void;

// stores/settingsStore.ts:30
fontFamily: TYPOGRAPHY_DEFAULTS.fontFamily,

// stores/settingsStore.ts:40
setFontFamily: (fontFamily) => set({ fontFamily }),
```

**Storage mechanism**:
- Location: `localStorage['reader-settings']`
- Persistence: Zustand middleware ([stores/settingsStore.ts:56-67](file:///Users/seankim/dev/reader/stores/settingsStore.ts))
- Scope: **Global** - applies to all books (see [thoughts/research/2025-11-11-settings-scope-analysis.md](file:///Users/seankim/dev/reader/thoughts/research/2025-11-11-settings-scope-analysis.md))
- Partialized: Only user preferences are persisted (runtime state excluded)

**Type definition** ([types/index.ts:54-60](file:///Users/seankim/dev/reader/types/index.ts)):
```typescript
export interface ReaderSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number; // 14-24px
  fontFamily: 'serif' | 'sans-serif';  // ← Only two options
  lineHeight: number; // 1.2-1.8
  margins: number; // 1-4rem
}
```

**Current limitation**: The `fontFamily` type is a string union with only two hardcoded values. Custom fonts would require extending this type or changing it to a string to support font names.

#### Typography Constants ([lib/constants.ts:17-26](file:///Users/seankim/dev/reader/lib/constants.ts))

Default values and valid ranges are defined in constants:

```typescript
export const TYPOGRAPHY_DEFAULTS = {
  fontSize: 18, // px
  lineHeight: 1.5,
  fontFamily: 'serif' as const,  // Default to serif
  maxWidthDesktop: '65ch',
  maxWidthMobile: '40ch',
  marginDesktop: 2, // rem
  marginMobile: 1, // rem
} as const;

export const TYPOGRAPHY_RANGES = {
  fontSize: { min: 14, max: 24, step: 1 },
  lineHeight: { min: 1.2, max: 1.8, step: 0.1 },
  margins: { min: 1, max: 4, step: 0.5 },
} as const;

export type FontFamily = 'serif' | 'sans-serif';  // ← Type export
```

**Key insight**: Constants are centralized for easy modification, but font families are hardcoded string literals rather than a configurable list.

### 2. TypographySettings Component

#### UI Component ([components/shared/TypographySettings.tsx:1-137](file:///Users/seankim/dev/reader/components/shared/TypographySettings.tsx))

The font selector is a simple two-button toggle:

```typescript
// components/shared/TypographySettings.tsx:33-61
<div>
  <label className="block text-sm font-medium...">Font Family</label>
  <div className="flex gap-2">
    <button
      onClick={() => setFontFamily('serif')}
      className={/* conditional styling */}
      style={{ fontFamily: 'Georgia, serif' }}  // ← Preview styling
    >
      Serif
    </button>
    <button
      onClick={() => setFontFamily('sans-serif')}
      className={/* conditional styling */}
      style={{ fontFamily: '-apple-system, sans-serif' }}  // ← Preview styling
    >
      Sans
    </button>
  </div>
</div>
```

**Current implementation**:
- Two hardcoded buttons
- Inline preview styling with hardcoded font stacks
- No dropdown, list, or extensible selection mechanism
- Uses direct store mutations via `setFontFamily()`

**Integration** ([components/reader/SettingsDrawer.tsx:139-141](file:///Users/seankim/dev/reader/components/reader/SettingsDrawer.tsx)):
```typescript
{activeTab === 'typography' && (
  <div className="space-y-6">
    {/* Theme */}
    <ThemeToggle />
    {/* Typography Settings */}
    <TypographySettings />
  </div>
)}
```

The component is embedded in a tabbed drawer that requires a `bookId` prop, even though typography settings are global ([thoughts/research/2025-11-11-settings-scope-analysis.md:186-188](file:///Users/seankim/dev/reader/thoughts/research/2025-11-11-settings-scope-analysis.md)).

### 3. Font Application in Reader

#### Epub.js Integration ([hooks/useEpubReader.ts:114-137](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts))

Fonts are applied dynamically to the epub.js rendition using the theme API:

```typescript
// hooks/useEpubReader.ts:25
const { theme, fontSize, fontFamily, lineHeight } = useSettingsStore();

// hooks/useEpubReader.ts:115-137
useEffect(() => {
  if (!rendition) return;

  const colors = THEME_COLORS[theme];
  rendition.themes.default({
    body: {
      'background-color': `${colors.bg} !important`,
      color: `${colors.text} !important`,
      'font-size': `${fontSize}px !important`,
      'line-height': `${lineHeight} !important`,
      'font-family': fontFamily === 'serif'
        ? 'Georgia, serif'           // ← Hardcoded serif stack
        : '-apple-system, sans-serif',  // ← Hardcoded sans stack
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
}, [rendition, theme, fontSize, fontFamily, lineHeight]);
```

**How it works**:
1. Settings store is subscribed to at component level
2. Any change to `fontFamily` triggers this effect
3. `rendition.themes.default()` injects CSS into the epub iframe
4. Font families are conditional: `'serif'` maps to `'Georgia, serif'`, `'sans-serif'` maps to system font stack

**Critical architecture point**: Epub.js renders content in an iframe ([hooks/useEpubReader.ts:62-68](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)). Custom fonts would need to be loaded **inside this iframe**, not just in the main document.

#### Rendition Initialization ([hooks/useEpubReader.ts:58-112](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts))

```typescript
const newRendition = book.renderTo(containerRef.current, {
  width: '100%',
  height: '100%',
  flow: 'paginated',
  snap: true,
  allowScriptedContent: true,  // ← Allows scripts in iframe
});
```

The rendition creates an iframe for displaying EPUB content. Custom fonts would need to be injected into this iframe's document.

### 4. Styling System

#### Global CSS ([app/globals.css:1-340](file:///Users/seankim/dev/reader/app/globals.css))

Font definitions are in Tailwind and global CSS:

```css
/* app/globals.css:23 */
body {
  font-family: Georgia, Charter, serif;  /* ← Global body font */
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* app/globals.css:43 */
.reading-content {
  font-family: Georgia, Charter, serif;
  max-width: 65ch;
  margin: 0 auto;
}
```

**Important**: These styles apply to the **app UI**, not the epub content. Epub content is styled separately via `rendition.themes.default()`.

#### Tailwind Configuration ([tailwind.config.ts:30-33](file:///Users/seankim/dev/reader/tailwind.config.ts))

```typescript
fontFamily: {
  serif: ['Georgia', 'Charter', 'serif'],
  sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
},
```

Tailwind utility classes use these font stacks, but they only affect UI components, not epub rendered content.

#### CSS Variables ([app/globals.css:6-19](file:///Users/seankim/dev/reader/app/globals.css))

```css
:root {
  --bg-light: #F9F9F9;
  --text-light: #1A1A1A;
  /* ... theme colors ... */

  /* iOS Safe Area Insets */
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  /* ... */
}
```

No font-related CSS variables are currently defined.

### 5. Storage Mechanisms

#### Typography Settings Storage

**Primary storage: localStorage via Zustand** ([stores/settingsStore.ts:56-67](file:///Users/seankim/dev/reader/stores/settingsStore.ts)):

```typescript
persist(
  (set) => ({ /* store state */ }),
  {
    name: 'reader-settings',  // ← localStorage key
    partialize: (state) => ({
      theme: state.theme,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,  // ← Stored as 'serif' | 'sans-serif'
      lineHeight: state.lineHeight,
      margins: state.margins,
    }),
  }
)
```

**Format**: JSON object stored at `localStorage['reader-settings']`
**Size limit**: ~5-10MB depending on browser
**Synchronous**: All reads/writes are synchronous

**Current storage example**:
```json
{
  "state": {
    "theme": "light",
    "fontSize": 18,
    "fontFamily": "serif",
    "lineHeight": 1.5,
    "margins": 2
  },
  "version": 0
}
```

#### Database Storage Options

The application uses **Dexie (IndexedDB)** for large binary data ([lib/db.ts:1-531](file:///Users/seankim/dev/reader/lib/db.ts)):

**Current tables** ([lib/db.ts:19-60](file:///Users/seankim/dev/reader/lib/db.ts)):
- `books` - Stores EPUB files as ArrayBuffer ([types/index.ts:16](file:///Users/seankim/dev/reader/types/index.ts))
- `audioFiles` - Stores generated MP3 as ArrayBuffer ([types/index.ts:96](file:///Users/seankim/dev/reader/types/index.ts))
- `positions`, `sessions`, `highlights`, `chapters`, `audioSettings`, `audioUsage`, `sentenceSyncData`

**Key pattern for binary storage** ([types/index.ts:8-9](file:///Users/seankim/dev/reader/types/index.ts)):
```typescript
coverBlob?: Blob;           // Deprecated
coverBuffer?: ArrayBuffer;  // iOS compatibility - preferred format
```

**Insight**: The codebase already has infrastructure for storing binary files (fonts) in IndexedDB. Font files would follow the same pattern as cover images and audio files.

#### No Font Assets Currently

**Search results**:
- No `.ttf`, `.otf`, `.woff`, or `.woff2` files in `/public` directory
- No font files in application directories (only in `node_modules`)
- No `@font-face` declarations in application CSS
- No font loading utilities or hooks

**Conclusion**: The application relies entirely on system fonts. No custom font loading infrastructure exists.

### 6. Epub.js Font Capabilities

#### Library Version

**Package.json** ([package.json:25](file:///Users/seankim/dev/reader/package.json)):
```json
"epubjs": "^0.3.93"
```

#### Theme API

Epub.js provides a themes API for styling content ([hooks/useEpubReader.ts:120](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)):

```typescript
rendition.themes.default({ /* CSS rules */ })
```

**How it works**:
1. Accepts CSS-in-JS object
2. Injects styles into iframe `<style>` tag
3. Applies to all rendered content
4. Supports `!important` for overriding EPUB's internal styles

**Custom font support**: The themes API accepts any valid CSS, including `@font-face` rules. However, font files must be accessible from within the iframe context.

#### Iframe Architecture

**Rendition container** ([hooks/useEpubReader.ts:62](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)):
```typescript
const newRendition = book.renderTo(containerRef.current, {
  width: '100%',
  height: '100%',
  flow: 'paginated',
  snap: true,
  allowScriptedContent: true,
});
```

**Challenge**: EPUB content renders in an iframe ([app/globals.css:93](file:///Users/seankim/dev/reader/app/globals.css)). Custom fonts need to be loaded in the iframe's document, not the parent document.

**Potential solutions**:
1. **Blob URLs**: Create blob URL from font ArrayBuffer, inject into iframe
2. **Data URIs**: Base64 encode font, inject as data URI in `@font-face`
3. **Service Worker**: Intercept font requests, serve from IndexedDB

#### Content Hooks

Epub.js provides content hooks for iframe manipulation ([hooks/useEpubReader.ts:75-105](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)):

```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;  // ← Access to iframe document
  // Can inject scripts, styles, modify DOM
});
```

**This is the integration point for custom fonts**: The hook gives access to the iframe document where `@font-face` declarations can be injected.

### 7. Current Font Fallback Stacks

#### Serif Stack
- Primary: Georgia (available on all platforms)
- Fallback: Charter (macOS/iOS)
- Generic: `serif`

**Used in**:
- Reader body text (when `fontFamily === 'serif'`)
- Global body text ([app/globals.css:23](file:///Users/seankim/dev/reader/app/globals.css))
- Tailwind utilities ([tailwind.config.ts:31](file:///Users/seankim/dev/reader/tailwind.config.ts))

#### Sans-serif Stack
- Primary: `-apple-system` (macOS/iOS system font)
- Fallback: BlinkMacSystemFont, Segoe UI, Roboto
- Generic: `sans-serif`

**Used in**:
- Reader body text (when `fontFamily === 'sans-serif'`)
- Tailwind utilities ([tailwind.config.ts:32](file:///Users/seankim/dev/reader/tailwind.config.ts))

**Design rationale**: System fonts provide optimal rendering and don't require loading external resources.

## Architecture Documentation

### Current Font Application Flow

```
User changes font in UI
  ↓
[TypographySettings.tsx:39] setFontFamily('serif')
  ↓
[settingsStore.ts:40] Zustand state update
  ↓
[settingsStore.ts:56-67] localStorage persistence
  ↓
[useEpubReader.ts:25] Hook subscribes to store change
  ↓
[useEpubReader.ts:115-137] useEffect re-runs
  ↓
[useEpubReader.ts:126] Conditional: 'serif' → 'Georgia, serif'
  ↓
[useEpubReader.ts:120] rendition.themes.default({ body: { 'font-family': ... }})
  ↓
Epub.js injects CSS into iframe <style> tag
  ↓
EPUB content re-renders with new font
```

### Storage Architecture

```
Typography Settings (Global)
├── Storage: localStorage['reader-settings']
├── Format: JSON via Zustand persist
├── Size: <1KB
└── Scope: All books

Audio Settings (Per-Book)
├── Storage: IndexedDB audioSettings table
├── Format: Dexie table with bookId primary key
├── Size: <1KB per book
└── Scope: Individual book

Book Files (Binary)
├── Storage: IndexedDB books table
├── Format: ArrayBuffer (fileBuffer field)
├── Size: Variable (typically 1-50MB per book)
└── Scope: Individual book

Audio Files (Binary)
├── Storage: IndexedDB audioFiles table
├── Format: ArrayBuffer (buffer field)
├── Size: Variable (typically 1-10MB per chapter)
└── Scope: Individual chapter
```

### Component Hierarchy

```
ReaderView (components/reader/ReaderView.tsx)
├── SettingsDrawer (components/reader/SettingsDrawer.tsx:18)
│   ├── Typography Tab (line 129)
│   │   ├── ThemeToggle (line 136)
│   │   └── TypographySettings (line 140) ← Font selector
│   ├── Audio Tab (line 144)
│   └── Usage Tab (line 151)
├── epub-container (line 672)
│   └── <iframe> (rendered by epub.js)
│       └── EPUB content with injected styles
└── Other components (progress, audio player, etc.)
```

## Integration Points for Custom Fonts

### 1. Font Storage

**Recommended approach**: IndexedDB table similar to `audioFiles`

**Schema design**:
```typescript
interface CustomFont {
  id?: number;
  name: string;              // User-facing name (e.g., "Inter")
  family: string;            // CSS font-family value
  buffer: ArrayBuffer;       // Font file data (.ttf, .otf, .woff2)
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  style: 'normal' | 'italic';
  weight: number;            // 100-900
  uploadedAt: Date;
  sizeBytes: number;
}
```

**Database integration**: Add to [lib/db.ts:61](file:///Users/seankim/dev/reader/lib/db.ts) schema:
```typescript
this.version(5).stores({
  // ... existing tables ...
  customFonts: '++id, name, family, uploadedAt',
});
```

### 2. Font Loading in Epub.js

**Injection point**: [hooks/useEpubReader.ts:75](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts) content hooks

**Implementation pattern**:
```typescript
newRendition.hooks.content.register((contents: any) => {
  const doc = contents.document;

  // Create blob URL from font ArrayBuffer
  const fontBlob = new Blob([fontBuffer], { type: 'font/woff2' });
  const fontUrl = URL.createObjectURL(fontBlob);

  // Inject @font-face into iframe
  const style = doc.createElement('style');
  style.textContent = `
    @font-face {
      font-family: '${fontFamily}';
      src: url('${fontUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
    }
  `;
  doc.head.appendChild(style);

  // Cleanup blob URL when chapter changes
  contents.on('unload', () => URL.revokeObjectURL(fontUrl));
});
```

### 3. Settings Store Extension

**Type changes** ([types/index.ts:57](file:///Users/seankim/dev/reader/types/index.ts)):
```typescript
// Current
fontFamily: 'serif' | 'sans-serif';

// Proposed
fontFamily: string;  // Allow any font name
fontType: 'system' | 'custom';  // Distinguish system vs custom fonts
customFontId?: number;  // Reference to customFonts table
```

**Store changes** ([stores/settingsStore.ts:14](file:///Users/seankim/dev/reader/stores/settingsStore.ts)):
```typescript
interface SettingsStore extends ReaderSettings {
  // ... existing fields ...

  // New actions
  setCustomFont: (fontId: number, fontFamily: string) => void;
  resetToSystemFont: () => void;
}
```

### 4. UI Components

**Required new components**:
1. **Font Upload Modal** - File input, validation, preview
2. **Font Manager** - List of custom fonts, delete functionality
3. **Font Selector Dropdown** - Replaces current two-button toggle
4. **Font Preview** - Show sample text in selected font

**Integration location**: [components/shared/TypographySettings.tsx:33-61](file:///Users/seankim/dev/reader/components/shared/TypographySettings.tsx) (replace existing font selector)

### 5. Font Family CSS Mapping

**Current mapping** ([hooks/useEpubReader.ts:126](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts)):
```typescript
'font-family': fontFamily === 'serif'
  ? 'Georgia, serif'
  : '-apple-system, sans-serif'
```

**Proposed mapping**:
```typescript
'font-family': fontType === 'system'
  ? (fontFamily === 'serif' ? 'Georgia, serif' : '-apple-system, sans-serif')
  : `'${fontFamily}', ${defaultFallback}`  // Custom font with fallback
```

### 6. Font Validation

**Required checks**:
- File type validation (TTF, OTF, WOFF, WOFF2)
- File size limits (recommend <2MB per font file)
- Font parsing (verify valid font file structure)
- Security: Check for embedded scripts or malicious content

**Integration point**: New utility in `lib/` directory, called from upload component

## Epub.js Limitations

### 1. Iframe Sandboxing

**Issue**: Each epub chapter may render in a new iframe instance
**Impact**: Custom fonts need to be re-injected on each chapter navigation
**Mitigation**: Use `rendition.hooks.content.register()` which fires for every loaded chapter

### 2. Font Loading Timing

**Issue**: Font files must load before content renders to avoid FOUT (flash of unstyled text)
**Impact**: May see brief flicker when changing fonts
**Mitigation**: Preload fonts into memory, use `font-display: block` or `font-display: swap`

### 3. Cross-Origin Restrictions

**Issue**: Blob URLs created in parent document may not work in iframe on some browsers
**Impact**: Font loading may fail in certain environments
**Mitigation**: Use data URIs instead of blob URLs, or inject fonts directly into iframe context

### 4. Memory Management

**Issue**: Creating blob URLs for every chapter/font combination can leak memory
**Impact**: Performance degradation on long reading sessions
**Mitigation**: Properly revoke blob URLs on chapter unload (using `contents.on('unload')`)

### 5. Embedded EPUB Fonts

**Issue**: EPUBs can have their own embedded fonts that may conflict
**Impact**: Custom fonts might not apply if EPUB has strong font declarations
**Mitigation**: Use `!important` in CSS rules (already done in current implementation)

## File Structure Relevant to Typography

```
reader/
├── stores/
│   └── settingsStore.ts              ← Font preference storage (Zustand + localStorage)
├── lib/
│   ├── constants.ts                  ← Typography defaults and ranges
│   └── db.ts                         ← Database schema (potential font storage location)
├── hooks/
│   └── useEpubReader.ts              ← Font application to epub.js rendition
├── components/
│   ├── shared/
│   │   └── TypographySettings.tsx   ← Font selector UI (2-button toggle)
│   └── reader/
│       ├── SettingsDrawer.tsx        ← Settings container (typography tab)
│       └── ReaderView.tsx            ← Main reader component
├── types/
│   └── index.ts                      ← ReaderSettings interface (fontFamily field)
├── app/
│   └── globals.css                   ← Global styles (UI fonts, not epub content)
├── tailwind.config.ts                ← Tailwind font stacks
└── package.json                      ← epub.js version (0.3.93)
```

## Historical Context

### Previous Settings Architecture Decision

From [thoughts/research/2025-11-11-settings-scope-analysis.md](file:///Users/seankim/dev/reader/thoughts/research/2025-11-11-settings-scope-analysis.md):

**Key finding**: Typography settings are **globally scoped** but only accessible from within book view, creating UX confusion. The recommended solution is to split settings into:
1. **Global App Settings** (typography, theme, API keys) - accessible from library
2. **Book Settings** (audio, usage) - accessible while reading

**Relevance to custom fonts**: Custom fonts would likely be global settings (apply to all books), but individual books might need per-book font overrides for specific use cases (e.g., dyslexic-friendly font for technical books, decorative font for fiction).

**Implementation consideration**: If implementing custom fonts, consider the settings scope refactoring as a prerequisite to improve UX.

## Code References

### Core Files
- [stores/settingsStore.ts:1-68](file:///Users/seankim/dev/reader/stores/settingsStore.ts) - Font preference state management
- [lib/constants.ts:17-58](file:///Users/seankim/dev/reader/lib/constants.ts) - Typography constants and defaults
- [hooks/useEpubReader.ts:114-137](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts) - Font application to rendition
- [components/shared/TypographySettings.tsx:33-61](file:///Users/seankim/dev/reader/components/shared/TypographySettings.tsx) - Font selector UI

### Type Definitions
- [types/index.ts:54-60](file:///Users/seankim/dev/reader/types/index.ts) - ReaderSettings interface
- [lib/constants.ts:56](file:///Users/seankim/dev/reader/lib/constants.ts) - FontFamily type export

### Storage & Database
- [lib/db.ts:1-531](file:///Users/seankim/dev/reader/lib/db.ts) - Database schema and operations
- [stores/settingsStore.ts:56-67](file:///Users/seankim/dev/reader/stores/settingsStore.ts) - Zustand persistence config

### Styling
- [app/globals.css:1-340](file:///Users/seankim/dev/reader/app/globals.css) - Global CSS (UI fonts)
- [tailwind.config.ts:30-33](file:///Users/seankim/dev/reader/tailwind.config.ts) - Tailwind font configuration

### Epub.js Integration
- [hooks/useEpubReader.ts:58-112](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts) - Rendition initialization
- [hooks/useEpubReader.ts:75-105](file:///Users/seankim/dev/reader/hooks/useEpubReader.ts) - Content hooks (potential font injection point)
- [types/epubjs-extensions.ts:1-92](file:///Users/seankim/dev/reader/types/epubjs-extensions.ts) - Epub.js type extensions

## Related Research
- [thoughts/research/2025-11-11-settings-scope-analysis.md](file:///Users/seankim/dev/reader/thoughts/research/2025-11-11-settings-scope-analysis.md) - Settings scope and architecture analysis

## Summary for Implementation

### Current State
1. **Two hardcoded font options**: "serif" (Georgia) and "sans-serif" (system fonts)
2. **Global settings**: Font preferences apply to all books, stored in localStorage
3. **Dynamic application**: Fonts injected into epub.js iframe via themes API
4. **No font assets**: Application uses only system fonts
5. **No loading infrastructure**: No @font-face, no font file storage, no loading utilities

### Requirements for Custom Typeface Upload Feature

#### Required Components
1. **Storage Layer**
   - IndexedDB table for font metadata and ArrayBuffer storage
   - Helper functions: `uploadFont()`, `getFont()`, `deleteFont()`, `listFonts()`
   - Schema: id, name, family, buffer, format, style, weight, sizeBytes, uploadedAt

2. **Font Loading System**
   - Inject @font-face into epub.js iframe using content hooks
   - Create blob URLs from IndexedDB ArrayBuffers
   - Memory management: Revoke URLs on chapter unload
   - Format detection and validation

3. **UI Components**
   - Font upload modal with drag-drop support
   - Font manager for viewing/deleting custom fonts
   - Font selector dropdown (replace two-button toggle)
   - Font preview component with sample text

4. **Settings Store Extension**
   - Change `fontFamily` type from `'serif' | 'sans-serif'` to `string`
   - Add `fontType: 'system' | 'custom'` field
   - Add `customFontId?: number` reference field
   - New actions: `setCustomFont()`, `resetToSystemFont()`

5. **Type System Updates**
   - Extend `ReaderSettings` interface
   - Add `CustomFont` interface
   - Update type guards and validators

6. **Font Validation**
   - File type checking (TTF, OTF, WOFF, WOFF2)
   - Size limits (recommend 2MB per file)
   - Font parsing to verify structure
   - Security scanning for embedded scripts

#### Integration Approach
1. **Phase 1**: Storage and database schema
2. **Phase 2**: Font loading infrastructure in epub.js hooks
3. **Phase 3**: Settings store extension and type updates
4. **Phase 4**: UI components (upload, selector, manager)
5. **Phase 5**: Validation and error handling
6. **Phase 6**: Memory optimization and cleanup

#### Key Technical Decisions
- **Storage format**: ArrayBuffer (following existing pattern for audio/images)
- **Font formats**: Support WOFF2 (primary), TTF/OTF (fallback)
- **Scope**: Global by default, with potential per-book overrides in future
- **Loading strategy**: Blob URLs created per chapter, revoked on unload
- **Fallback**: Always include system font fallback in font-family stack

#### Known Challenges
1. **Iframe context**: Fonts must be injected per chapter/iframe
2. **Memory management**: Blob URLs need cleanup to avoid leaks
3. **FOUT/FOIT**: May see text reflow when font loads
4. **EPUB conflicts**: Embedded EPUB fonts may override custom fonts
5. **Cross-browser**: Blob URL support varies in iframe contexts

---

**End of Research Document**
