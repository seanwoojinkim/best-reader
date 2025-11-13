---
doc_type: plan
date: 2025-11-13T15:52:34+00:00
title: "Custom Font Upload Implementation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T15:52:34+00:00"
feature: "custom-font-upload"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Database & Storage Layer"
    status: pending
    estimated_hours: 3-4
  - name: "Phase 2: Font Validation & Metadata Extraction"
    status: pending
    estimated_hours: 4-5
  - name: "Phase 3: Settings Store Extension"
    status: pending
    estimated_hours: 2-3
  - name: "Phase 4: Font Application Logic"
    status: pending
    estimated_hours: 5-6
  - name: "Phase 5: UI Components"
    status: pending
    estimated_hours: 6-8
  - name: "Phase 6: Legal & Error Handling"
    status: pending
    estimated_hours: 3-4
  - name: "Phase 7: Testing & Polish"
    status: pending
    estimated_hours: 4-5

git_commit: f043ea027c72c71df95873aeac6edad6d812395b
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - typography
  - fonts
  - storage
  - epub-js
  - ui
status: draft

related_docs:
  - thoughts/research/2025-11-13-typography-and-font-implementation-analysis.md
  - thoughts/research/2025-11-11-settings-scope-analysis.md
---

# Custom Font Upload Implementation Plan

**Total Estimated Time**: 27-35 hours across 7 phases

## Executive Summary

### Problem Statement

The e-reader currently supports only two hardcoded font options: serif (Georgia) and sans-serif (system fonts). Users cannot customize reading typography beyond these limited choices, preventing personalization for readability preferences, accessibility needs (e.g., OpenDyslexic), or aesthetic preferences.

### Proposed Solution

Implement a comprehensive custom font upload system that allows users to:
1. Upload font files in standard formats (TTF, OTF, WOFF, WOFF2)
2. Store fonts persistently in IndexedDB using existing Dexie infrastructure
3. Preview and select uploaded fonts for reading
4. Manage (list, delete) custom fonts
5. Apply custom fonts seamlessly to EPUB content via epub.js iframe injection

### Success Criteria

**Functional Requirements Met**:
- ✅ Users can upload valid font files (TTF, OTF, WOFF, WOFF2)
- ✅ Uploaded fonts persist across sessions
- ✅ Font list displays with accurate previews
- ✅ Users can select custom fonts for reading
- ✅ Custom fonts apply correctly to EPUB content
- ✅ Users can delete uploaded fonts
- ✅ Legal disclaimer shown during upload

**Technical Requirements Met**:
- ✅ Font metadata extracted correctly (family name, style, weight)
- ✅ File validation prevents invalid/malicious uploads
- ✅ Memory managed properly (no blob URL leaks)
- ✅ Works cross-platform (web, iOS WebView, Android)
- ✅ Backward compatible (existing serif/sans-serif still work)
- ✅ No FOUT/FOIT flashing during font application

**Quality Benchmarks**:
- Upload validation < 500ms for 2MB font
- Font application to EPUB < 200ms
- No memory leaks during extended reading sessions
- Font preview renders within 100ms

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Storage: IndexedDB (Dexie)** | Follows existing pattern for books/audio (ArrayBuffer storage), supports large files, cross-platform compatible |
| **Font formats: All standard formats** | Support TTF/OTF (universal compatibility), WOFF/WOFF2 (web-optimized) without conversion initially |
| **Loading: FontFace API + Blob URLs** | Modern, performant, works in iframe contexts, proper memory management via URL.revokeObjectURL() |
| **Validation: Multi-layer** | File extension + MIME type + magic number + opentype.js parsing for security and UX |
| **Scope: Global settings** | Fonts apply to all books by default (consistent with current typography settings architecture) |
| **Metadata extraction: opentype.js** | Industry-standard library for reading TrueType/OpenType metadata |

---

## Current State Analysis

### Existing Font System

**Architecture** ([research findings](file:///Users/seankim/dev/reader/thoughts/research/2025-11-13-typography-and-font-implementation-analysis.md)):

```typescript
// Current type constraint
interface ReaderSettings {
  fontFamily: 'serif' | 'sans-serif';  // ← Only two options
}

// Current application logic (hooks/useEpubReader.ts:126)
'font-family': fontFamily === 'serif'
  ? 'Georgia, serif'
  : '-apple-system, sans-serif'
```

**Storage locations**:
- Settings: `localStorage['reader-settings']` via Zustand persist middleware
- Binary assets: IndexedDB via Dexie (books, audio, covers as ArrayBuffer)

**Font application flow**:
1. User changes font in `TypographySettings.tsx` (two-button toggle)
2. Zustand store updates → `settingsStore.ts`
3. localStorage persistence automatic
4. `useEpubReader.ts` hook subscribes to changes
5. `rendition.themes.default()` injects CSS into epub.js iframe
6. EPUB content re-renders with new font

**Iframe architecture** (critical for custom fonts):
- EPUB content renders in isolated iframe (epub.js rendition)
- Fonts must be injected **inside iframe**, not in parent document
- Content hooks provide access: `rendition.hooks.content.register()`

### Existing Infrastructure We'll Leverage

**Database schema** (`lib/db.ts`):
- Currently at version 4 (after TTS sentence sync addition)
- Uses Dexie for IndexedDB abstraction
- Established pattern for binary storage: `ArrayBuffer` fields
- Helper functions for CRUD operations

**Relevant existing tables**:
```typescript
audioFiles: {
  buffer?: ArrayBuffer;  // MP3 data - same pattern for fonts
  sizeBytes: number;
  generatedAt: Date;
}

books: {
  fileBuffer?: ArrayBuffer;  // EPUB data
  coverBuffer?: ArrayBuffer; // Cover image
}
```

**Settings store** (`stores/settingsStore.ts`):
- Zustand with localStorage persistence
- Partialized to only persist user preferences
- Global scope (applies to all books)
- Reactive updates trigger re-renders

### Integration Points Identified

| File | Current Role | Integration Needed |
|------|-------------|-------------------|
| `lib/db.ts` | Database schema/operations | Add `customFonts` table, CRUD helpers |
| `stores/settingsStore.ts` | Typography settings | Extend `fontFamily` type, add `customFontId` |
| `hooks/useEpubReader.ts` | Apply styles to epub | Inject @font-face via content hooks |
| `components/shared/TypographySettings.tsx` | Font selector UI | Replace toggle with dropdown + manager |
| `types/index.ts` | Type definitions | Add `CustomFont` interface |

### Gaps to Fill

**Missing components**:
1. ❌ No font file storage mechanism
2. ❌ No font validation utilities
3. ❌ No font metadata extraction
4. ❌ No @font-face injection logic
5. ❌ No font upload UI
6. ❌ No font preview components
7. ❌ No legal disclaimer for licensing

**Technical challenges**:
1. **Iframe font loading**: Blob URLs created in parent may not work in iframe on some browsers
2. **Memory management**: Blob URLs must be revoked to prevent leaks
3. **FOUT prevention**: Font must load before content renders
4. **EPUB conflicts**: Embedded EPUB fonts may override custom fonts (need `!important`)

---

## Requirements Analysis

### Functional Requirements

#### FR1: Font Upload
- **Description**: User can upload font files via file picker or drag-and-drop
- **Acceptance Criteria**:
  - File picker accepts .ttf, .otf, .woff, .woff2 extensions
  - Drag-and-drop zone provides visual feedback
  - Upload validates file before storage
  - Error messages shown for invalid files
  - Success confirmation with font preview
- **Priority**: P0 (Critical)

#### FR2: Font Validation
- **Description**: System validates uploaded files are legitimate fonts
- **Acceptance Criteria**:
  - File extension check (.ttf, .otf, .woff, .woff2)
  - MIME type verification (font/ttf, font/otf, font/woff, font/woff2)
  - Magic number validation (binary signature check)
  - Font parsing with opentype.js to verify structure
  - File size limit enforcement (10MB hard limit, 5MB warning)
  - Clear error messages for each failure type
- **Priority**: P0 (Critical - security concern)

#### FR3: Font Metadata Extraction
- **Description**: System extracts font family name, style, weight from file
- **Acceptance Criteria**:
  - Font family name extracted from name table
  - Style detected (normal, italic)
  - Weight extracted (100-900)
  - Format detected (truetype, opentype, woff, woff2)
  - Fallback to filename if metadata missing
- **Priority**: P0 (Critical for display)

#### FR4: Font List Display
- **Description**: User can view all uploaded custom fonts
- **Acceptance Criteria**:
  - List shows font family name
  - Preview text rendered in each font
  - File size displayed
  - Upload date shown
  - Delete button per font
  - Empty state for no fonts
- **Priority**: P0 (Critical)

#### FR5: Font Selection
- **Description**: User can select custom font for reading
- **Acceptance Criteria**:
  - Dropdown shows system fonts + custom fonts
  - Custom fonts grouped separately
  - Preview text for each option
  - Selected font persists across sessions
  - Selection applies immediately to EPUB content
- **Priority**: P0 (Critical)

#### FR6: Font Application
- **Description**: Custom fonts render correctly in EPUB content
- **Acceptance Criteria**:
  - Font loads before content renders (no FOUT)
  - Font applies to all EPUB text
  - Font survives chapter navigation
  - Font works in all themes (light/dark/sepia)
  - Fallback to system font if custom font fails
- **Priority**: P0 (Critical)

#### FR7: Font Deletion
- **Description**: User can delete uploaded fonts
- **Acceptance Criteria**:
  - Delete button per font in manager
  - Confirmation modal prevents accidents
  - Font removed from IndexedDB
  - If active font deleted, revert to default
  - Blob URLs cleaned up properly
- **Priority**: P0 (Critical)

#### FR8: Legal Disclaimer
- **Description**: User sees licensing warning before upload
- **Acceptance Criteria**:
  - Modal shown on first upload attempt
  - Clear language about font licensing
  - User must acknowledge to proceed
  - Checkbox "Don't show again" option
  - Links to font licensing resources
- **Priority**: P1 (Important - legal protection)

### Technical Requirements

#### TR1: Database Schema
- Add `customFonts` table to Dexie schema (version 5)
- Store font metadata + ArrayBuffer
- Index on `name` and `family` for searching
- Cascade delete: Remove from settings if deleted

#### TR2: Type Safety
- Extend `ReaderSettings` interface for custom fonts
- Add `CustomFont` interface matching database schema
- Update `FontFamily` type from union to string
- Add type guards for validation

#### TR3: Memory Management
- Blob URLs created per chapter load
- URLs revoked on chapter unload
- No memory leaks during extended sessions
- Font ArrayBuffer cached in memory during reading

#### TR4: Cross-Platform Compatibility
- Works in web browsers (Chrome, Safari, Firefox)
- Works in iOS WKWebView (Capacitor)
- Works in Android WebView (Capacitor)
- Font loading in iframe contexts

#### TR5: Performance
- Upload validation < 500ms for 2MB font
- Font application < 200ms
- Font preview render < 100ms
- No UI blocking during upload

#### TR6: Security
- No script execution from font files
- File size limits prevent DoS
- Magic number validation prevents fake extensions
- Sandboxed font rendering (browser isolation)

### Out of Scope (Future Enhancements)

#### Deferred to V2:
- **Font conversion**: Upload TTF/OTF, auto-convert to WOFF2
  - *Rationale*: Requires wasm library (fontkit), adds complexity
- **Per-book font overrides**: Different font per book
  - *Rationale*: Requires settings architecture refactor (see related research)
- **Font subsetting**: Extract only used glyphs
  - *Rationale*: Complex, marginal storage benefit
- **Google Fonts integration**: Browse/download from API
  - *Rationale*: Network dependency, licensing complexity
- **Font family grouping**: Link regular/bold/italic variants
  - *Rationale*: Complex UX, many users upload single file
- **Font preview customization**: User-editable preview text
  - *Rationale*: Nice-to-have, not critical
- **Export/import font collections**: Share fonts between devices
  - *Rationale*: Licensing concerns, low priority

---

## Architecture & Design

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│  TypographySettings.tsx (modified)                          │
│    ├── FontSelector (new dropdown component)               │
│    ├── FontUploadButton (triggers modal)                   │
│    └── FontManager (font list + delete)                    │
│                                                              │
│  FontUploadModal.tsx (new)                                 │
│    ├── FileDropzone                                        │
│    ├── FontPreview                                         │
│    └── LegalDisclaimer                                     │
├─────────────────────────────────────────────────────────────┤
│                    Business Logic Layer                     │
├─────────────────────────────────────────────────────────────┤
│  hooks/useFontLoader.ts (new)                              │
│    ├── loadFontIntoIframe()                                │
│    ├── createFontFaceDeclaration()                         │
│    └── manageBlobURLs()                                    │
│                                                              │
│  hooks/useEpubReader.ts (modified)                         │
│    └── content.register() → inject custom fonts            │
│                                                              │
│  stores/settingsStore.ts (modified)                        │
│    ├── customFontId: number | null                         │
│    ├── setCustomFont()                                     │
│    └── resetToSystemFont()                                 │
├─────────────────────────────────────────────────────────────┤
│                    Utility Layer                            │
├─────────────────────────────────────────────────────────────┤
│  lib/fontValidation.ts (new)                               │
│    ├── validateFontFile()                                  │
│    ├── checkMagicNumber()                                  │
│    └── validateSize()                                      │
│                                                              │
│  lib/fontMetadata.ts (new)                                 │
│    ├── extractMetadata() → opentype.js                    │
│    ├── parseFontFamily()                                   │
│    └── detectFormat()                                      │
├─────────────────────────────────────────────────────────────┤
│                     Data Layer                              │
├─────────────────────────────────────────────────────────────┤
│  lib/db.ts (modified)                                      │
│    ├── customFonts table (version 5)                       │
│    ├── uploadFont()                                        │
│    ├── getFont()                                           │
│    ├── listFonts()                                         │
│    └── deleteFont()                                        │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema (Version 5)

```typescript
// Add to lib/db.ts
interface CustomFont {
  id?: number;                      // Auto-increment primary key
  name: string;                     // Display name (from metadata or filename)
  family: string;                   // CSS font-family value
  buffer: ArrayBuffer;              // Font file binary data
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  style: 'normal' | 'italic';       // Font style
  weight: number;                   // 100-900 (CSS font-weight)
  uploadedAt: Date;                 // Upload timestamp
  sizeBytes: number;                // File size for display
  mimeType: string;                 // Original MIME type
}

// Dexie schema
this.version(5).stores({
  // ... existing tables ...
  customFonts: '++id, name, family, uploadedAt',
});
```

**Indexes**:
- `id`: Primary key (auto-increment)
- `name`: User-facing name for searching
- `family`: CSS font-family for lookup
- `uploadedAt`: For chronological sorting

**Storage estimates**:
- Metadata: ~500 bytes per font
- Font file: 50KB-2MB typical (WOFF2), up to 10MB max
- Total per font: ~1-2MB average

### Type Definitions

```typescript
// Add to types/index.ts

export interface CustomFont {
  id?: number;
  name: string;
  family: string;
  buffer: ArrayBuffer;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  style: 'normal' | 'italic';
  weight: number;
  uploadedAt: Date;
  sizeBytes: number;
  mimeType: string;
}

export interface FontMetadata {
  family: string;
  style: 'normal' | 'italic';
  weight: number;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
}

export interface FontValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: FontMetadata;
}

// Extend ReaderSettings
export interface ReaderSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number;
  fontFamily: string;               // Changed from 'serif' | 'sans-serif'
  fontType: 'system' | 'custom';    // NEW: Distinguish system vs custom
  customFontId?: number;             // NEW: FK to customFonts table
  lineHeight: number;
  margins: number;
}
```

### Font Loading Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User selects custom font in TypographySettings           │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. settingsStore.setCustomFont(fontId, fontFamily)          │
│    → Updates: fontType='custom', customFontId, fontFamily   │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. useEpubReader hook detects change via Zustand subscribe  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. If fontType === 'custom':                                │
│    a. Fetch font from IndexedDB: getFont(customFontId)      │
│    b. Create Blob from ArrayBuffer                          │
│    c. Generate blob URL: URL.createObjectURL(blob)          │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. rendition.hooks.content.register() fires per chapter     │
│    → Access iframe document: contents.document              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Inject @font-face into iframe:                           │
│    ```                                                       │
│    const style = doc.createElement('style');                │
│    style.textContent = `                                    │
│      @font-face {                                           │
│        font-family: '${family}';                            │
│        src: url('${blobURL}') format('woff2');              │
│        font-weight: ${weight};                              │
│        font-style: ${style};                                │
│        font-display: swap;                                  │
│      }                                                       │
│    `;                                                        │
│    doc.head.appendChild(style);                             │
│    ```                                                       │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. Apply font-family via rendition.themes.default():        │
│    'font-family': `'${customFontFamily}', Georgia, serif`   │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. EPUB content renders with custom font                    │
└──────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. On chapter unload: URL.revokeObjectURL(blobURL)          │
│    → Prevents memory leaks                                  │
└──────────────────────────────────────────────────────────────┘
```

### File Structure

```
reader/
├── lib/
│   ├── db.ts                         # Modified: Add customFonts table
│   ├── fontValidation.ts             # NEW: Validation utilities
│   └── fontMetadata.ts               # NEW: Metadata extraction (opentype.js)
├── hooks/
│   ├── useEpubReader.ts              # Modified: Custom font injection
│   └── useFontLoader.ts              # NEW: Font loading logic
├── stores/
│   └── settingsStore.ts              # Modified: Custom font fields
├── components/
│   ├── shared/
│   │   └── TypographySettings.tsx   # Modified: New font selector
│   ├── fonts/                        # NEW DIRECTORY
│   │   ├── FontUploadModal.tsx      # NEW: Upload UI
│   │   ├── FontSelector.tsx         # NEW: Dropdown component
│   │   ├── FontManager.tsx          # NEW: List + delete UI
│   │   ├── FontPreview.tsx          # NEW: Preview component
│   │   └── LegalDisclaimer.tsx      # NEW: Licensing warning
│   └── reader/
│       └── SettingsDrawer.tsx        # No changes (contains TypographySettings)
├── types/
│   └── index.ts                      # Modified: Add CustomFont interface
└── package.json                      # Modified: Add opentype.js dependency
```

---

## Implementation Phases

### Phase 1: Database & Storage Layer

**Objective**: Establish persistent storage for custom fonts in IndexedDB

**Estimated Time**: 3-4 hours

#### Files to Create/Modify

##### 1.1 Extend Database Schema (`lib/db.ts`)

**Modifications**:

```typescript
// Add to imports
import type { CustomFont } from '@/types';

// Add table property
export class ReaderDatabase extends Dexie {
  // ... existing tables ...
  customFonts!: Table<CustomFont, number>;

  constructor() {
    super('AdaptiveReaderDB');

    // ... existing versions ...

    // Version 5: Add custom fonts support
    this.version(5).stores({
      books: '++id, title, author, addedAt, lastOpenedAt, *tags',
      positions: 'bookId, updatedAt',
      sessions: '++id, bookId, startTime, endTime',
      highlights: '++id, bookId, cfiRange, color, createdAt',
      analytics: '++id, sessionId, bookId, timestamp, event',
      chapters: '++id, bookId, order, cfiStart',
      audioFiles: '++id, chapterId, generatedAt',
      audioSettings: 'bookId, updatedAt',
      audioUsage: '++id, chapterId, bookId, timestamp',
      sentenceSyncData: '++id, audioFileId, chapterId, generatedAt',
      customFonts: '++id, name, family, uploadedAt',  // NEW TABLE
    });
  }
}
```

##### 1.2 Add Font CRUD Operations (`lib/db.ts`)

**Append to end of file**:

```typescript
// ============================================================
// Custom Font Management Functions (Custom Font Upload Feature)
// ============================================================

/**
 * Upload a custom font to IndexedDB
 */
export async function uploadFont(font: Omit<CustomFont, 'id' | 'uploadedAt'>): Promise<number> {
  const fontWithDate: CustomFont = {
    ...font,
    uploadedAt: new Date(),
  };
  return await db.customFonts.add(fontWithDate);
}

/**
 * Get a specific custom font by ID
 */
export async function getFont(id: number): Promise<CustomFont | undefined> {
  return await db.customFonts.get(id);
}

/**
 * Get all custom fonts (sorted by upload date, newest first)
 */
export async function listFonts(): Promise<CustomFont[]> {
  return await db.customFonts.orderBy('uploadedAt').reverse().toArray();
}

/**
 * Delete a custom font
 * Also removes it from settings if currently selected
 */
export async function deleteFont(id: number): Promise<void> {
  await db.customFonts.delete(id);

  // NOTE: Settings cleanup handled by settingsStore.ts
  // via subscription to font deletion events
}

/**
 * Check if a font with the same family name already exists
 */
export async function fontExists(family: string): Promise<boolean> {
  const count = await db.customFonts.where('family').equals(family).count();
  return count > 0;
}

/**
 * Get total storage used by custom fonts (bytes)
 */
export async function getFontStorageSize(): Promise<number> {
  const fonts = await db.customFonts.toArray();
  return fonts.reduce((total, font) => total + font.sizeBytes, 0);
}
```

##### 1.3 Add Type Definitions (`types/index.ts`)

**Append to end of file**:

```typescript
// ============================================================
// Custom Font Interfaces (Custom Font Upload Feature)
// ============================================================

export interface CustomFont {
  id?: number;
  name: string;                     // User-facing display name
  family: string;                   // CSS font-family value
  buffer: ArrayBuffer;              // Font file binary data
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  style: 'normal' | 'italic';
  weight: number;                   // 100-900
  uploadedAt: Date;
  sizeBytes: number;
  mimeType: string;
}

export interface FontMetadata {
  family: string;
  style: 'normal' | 'italic';
  weight: number;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
}

export interface FontValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: FontMetadata;
}
```

##### 1.4 Update ReaderSettings Interface (`types/index.ts`)

**Modify existing interface** (around line 54):

```typescript
// BEFORE
export interface ReaderSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number;
  fontFamily: 'serif' | 'sans-serif';  // ← Change this
  lineHeight: number;
  margins: number;
}

// AFTER
export interface ReaderSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number;
  fontFamily: string;                   // Changed: Allow any font name
  fontType: 'system' | 'custom';        // NEW: Distinguish system vs custom
  customFontId?: number;                 // NEW: FK to customFonts table (optional)
  lineHeight: number;
  margins: number;
}
```

#### Success Criteria

**Automated Tests**:
- [ ] Database upgrades from version 4 to version 5 without data loss
- [ ] `uploadFont()` successfully stores font and returns ID
- [ ] `getFont()` retrieves font with correct ArrayBuffer
- [ ] `listFonts()` returns fonts in chronological order
- [ ] `deleteFont()` removes font from database
- [ ] `fontExists()` correctly detects duplicate family names
- [ ] `getFontStorageSize()` calculates total bytes accurately

**Manual Verification**:
- [ ] Open browser DevTools → Application → IndexedDB → AdaptiveReaderDB
- [ ] Verify `customFonts` table exists with correct schema
- [ ] Manually add a font record (via console), verify it appears in table
- [ ] Check ArrayBuffer field contains binary data
- [ ] Delete font, verify it's removed from IndexedDB

**Regression Tests**:
- [ ] Existing books, audio, positions tables still accessible
- [ ] No errors in browser console during database initialization
- [ ] Existing settings persist after upgrade

#### Time Estimate

- Schema design: 30 min
- Dexie version migration: 1 hour
- CRUD operations: 1 hour
- Type definitions: 30 min
- Testing: 1 hour
- **Total: 3-4 hours**

---

### Phase 2: Font Validation & Metadata Extraction

**Objective**: Implement comprehensive font file validation and metadata extraction

**Estimated Time**: 4-5 hours

**Dependencies**: Phase 1 complete (database schema ready)

#### Files to Create

##### 2.1 Install Dependencies

```bash
npm install opentype.js
npm install --save-dev @types/opentype.js
```

**Package**: `opentype.js` v1.3.4
- Industry-standard TrueType/OpenType parser
- Extracts font metadata (family, style, weight)
- Validates font file structure
- ~100KB bundle size

##### 2.2 Create Font Validation Utility (`lib/fontValidation.ts`)

**New file**:

```typescript
import type { FontValidationResult } from '@/types';

/**
 * Maximum font file size (10MB)
 * Large files may indicate non-font data or cause performance issues
 */
const MAX_FONT_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Warning threshold for large fonts (5MB)
 */
const LARGE_FONT_WARNING = 5 * 1024 * 1024; // 5MB

/**
 * Allowed MIME types for font uploads
 */
const ALLOWED_MIME_TYPES = [
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/font-sfnt',      // Legacy TrueType
  'application/vnd.ms-fontobject', // EOT (not supported, but caught gracefully)
  'application/x-font-ttf',     // Legacy
  'application/x-font-otf',     // Legacy
];

/**
 * Magic numbers (file signatures) for font formats
 * Used to verify file type regardless of extension
 */
const FONT_MAGIC_NUMBERS = {
  // TrueType: starts with 0x00010000 or "true"
  truetype: [
    [0x00, 0x01, 0x00, 0x00],
    [0x74, 0x72, 0x75, 0x65], // "true"
  ],
  // OpenType: starts with "OTTO"
  opentype: [
    [0x4F, 0x54, 0x54, 0x4F], // "OTTO"
  ],
  // WOFF: starts with "wOFF"
  woff: [
    [0x77, 0x4F, 0x46, 0x46], // "wOFF"
  ],
  // WOFF2: starts with "wOF2"
  woff2: [
    [0x77, 0x4F, 0x46, 0x32], // "wOF2"
  ],
};

/**
 * Check file extension
 */
function validateExtension(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ['ttf', 'otf', 'woff', 'woff2'].includes(ext || '');
}

/**
 * Check MIME type
 */
function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase());
}

/**
 * Check file size
 */
function validateSize(sizeBytes: number): { valid: boolean; warning?: string } {
  if (sizeBytes > MAX_FONT_SIZE) {
    return {
      valid: false,
      warning: `File size (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) exceeds maximum (10MB)`
    };
  }

  if (sizeBytes > LARGE_FONT_WARNING) {
    return {
      valid: true,
      warning: `Large file size (${(sizeBytes / 1024 / 1024).toFixed(2)}MB) may impact performance`
    };
  }

  return { valid: true };
}

/**
 * Verify magic number (file signature)
 */
function checkMagicNumber(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer.slice(0, 4));

  for (const [format, signatures] of Object.entries(FONT_MAGIC_NUMBERS)) {
    for (const signature of signatures) {
      if (signature.every((byte, i) => bytes[i] === byte)) {
        return format;
      }
    }
  }

  return null;
}

/**
 * Comprehensive font file validation
 *
 * Checks:
 * 1. File extension
 * 2. MIME type
 * 3. File size
 * 4. Magic number (binary signature)
 *
 * Does NOT parse font structure (that's done in fontMetadata.ts)
 */
export async function validateFontFile(file: File): Promise<FontValidationResult> {
  const warnings: string[] = [];

  // 1. Check extension
  if (!validateExtension(file.name)) {
    return {
      valid: false,
      error: `Invalid file extension. Supported formats: .ttf, .otf, .woff, .woff2`
    };
  }

  // 2. Check MIME type
  if (!validateMimeType(file.type)) {
    // Don't fail immediately - some browsers report incorrect MIME types
    warnings.push(`Unexpected MIME type: ${file.type}. Proceeding with caution.`);
  }

  // 3. Check file size
  const sizeCheck = validateSize(file.size);
  if (!sizeCheck.valid) {
    return { valid: false, error: sizeCheck.warning };
  }
  if (sizeCheck.warning) {
    warnings.push(sizeCheck.warning);
  }

  // 4. Check magic number
  const buffer = await file.arrayBuffer();
  const detectedFormat = checkMagicNumber(buffer);

  if (!detectedFormat) {
    return {
      valid: false,
      error: 'File does not appear to be a valid font file (magic number check failed)'
    };
  }

  // Format mismatch warning (extension vs. magic number)
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'ttf' && detectedFormat !== 'truetype') {
    warnings.push(`File extension is .ttf but detected format is ${detectedFormat}`);
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
```

##### 2.3 Create Font Metadata Extraction Utility (`lib/fontMetadata.ts`)

**New file**:

```typescript
import opentype from 'opentype.js';
import type { FontMetadata, FontValidationResult } from '@/types';

/**
 * Detect font format from magic number
 */
function detectFormat(buffer: ArrayBuffer): 'truetype' | 'opentype' | 'woff' | 'woff2' {
  const bytes = new Uint8Array(buffer.slice(0, 4));

  // WOFF2: "wOF2"
  if (bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && bytes[3] === 0x32) {
    return 'woff2';
  }

  // WOFF: "wOFF"
  if (bytes[0] === 0x77 && bytes[1] === 0x4F && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'woff';
  }

  // OpenType: "OTTO"
  if (bytes[0] === 0x4F && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4F) {
    return 'opentype';
  }

  // TrueType: 0x00010000 or "true"
  return 'truetype';
}

/**
 * Extract font metadata using opentype.js
 *
 * Parses font file to extract:
 * - Font family name
 * - Style (normal/italic)
 * - Weight (100-900)
 * - Format (truetype/opentype/woff/woff2)
 */
export async function extractFontMetadata(
  buffer: ArrayBuffer,
  filename: string
): Promise<FontValidationResult> {
  try {
    // Parse font with opentype.js
    const font = opentype.parse(buffer);

    // Extract family name from name table
    const familyName =
      font.names.fontFamily?.en ||
      font.names.fullName?.en ||
      filename.replace(/\.[^/.]+$/, ''); // Fallback to filename without extension

    // Extract style
    const styleName = (font.names.fontSubfamily?.en || 'Regular').toLowerCase();
    const isItalic = styleName.includes('italic') || styleName.includes('oblique');

    // Extract weight from OS/2 table (or guess from style name)
    let weight = 400; // Default to normal
    if (font.tables.os2?.usWeightClass) {
      weight = font.tables.os2.usWeightClass;
    } else {
      // Fallback: guess from style name
      if (styleName.includes('thin')) weight = 100;
      else if (styleName.includes('light')) weight = 300;
      else if (styleName.includes('medium')) weight = 500;
      else if (styleName.includes('semibold')) weight = 600;
      else if (styleName.includes('bold')) weight = 700;
      else if (styleName.includes('black')) weight = 900;
    }

    const format = detectFormat(buffer);

    const metadata: FontMetadata = {
      family: familyName,
      style: isItalic ? 'italic' : 'normal',
      weight,
      format,
    };

    return {
      valid: true,
      metadata,
    };
  } catch (error) {
    console.error('[extractFontMetadata] Failed to parse font:', error);
    return {
      valid: false,
      error: `Failed to parse font file: ${(error as Error).message}`,
    };
  }
}

/**
 * Full validation + metadata extraction pipeline
 *
 * Use this function for upload flow:
 * 1. Validates file structure
 * 2. Extracts metadata
 * 3. Returns combined result
 */
export async function validateAndExtractMetadata(
  file: File
): Promise<FontValidationResult> {
  // Note: Basic validation done in fontValidation.ts
  // This function focuses on parsing and metadata extraction

  const buffer = await file.arrayBuffer();
  return extractFontMetadata(buffer, file.name);
}
```

#### Success Criteria

**Automated Tests**:
- [ ] `validateFontFile()` accepts valid .ttf files
- [ ] `validateFontFile()` accepts valid .otf files
- [ ] `validateFontFile()` accepts valid .woff files
- [ ] `validateFontFile()` accepts valid .woff2 files
- [ ] `validateFontFile()` rejects files > 10MB
- [ ] `validateFontFile()` warns for files > 5MB
- [ ] `validateFontFile()` rejects non-font files (e.g., .txt renamed to .ttf)
- [ ] Magic number validation catches fake extensions
- [ ] `extractFontMetadata()` correctly extracts family name
- [ ] `extractFontMetadata()` detects italic style
- [ ] `extractFontMetadata()` extracts weight (100-900)
- [ ] `extractFontMetadata()` returns error for corrupted fonts

**Manual Verification**:
- [ ] Upload valid TTF → metadata extracted correctly
- [ ] Upload valid WOFF2 → metadata extracted correctly
- [ ] Upload 8MB font → warning shown but upload succeeds
- [ ] Upload 12MB font → error shown, upload blocked
- [ ] Upload .txt renamed to .ttf → rejected at magic number check
- [ ] Upload font without family name → fallback to filename works

**Test Fonts**:
- Use Google Fonts (Open Font License) for testing:
  - Roboto Regular (TTF)
  - Open Sans Bold (WOFF2)
  - Lora Italic (OTF)
- Create fake font (text file renamed to .ttf) for negative testing

#### Time Estimate

- Research opentype.js API: 1 hour
- Implement validation logic: 1.5 hours
- Implement metadata extraction: 1.5 hours
- Testing: 1 hour
- **Total: 4-5 hours**

---

### Phase 3: Settings Store Extension

**Objective**: Extend Zustand settings store to support custom fonts

**Estimated Time**: 2-3 hours

**Dependencies**: Phase 1 complete (types defined)

#### Files to Modify

##### 3.1 Extend Settings Store (`stores/settingsStore.ts`)

**Modifications**:

```typescript
// BEFORE (current interface)
interface SettingsStore extends ReaderSettings {
  currentBookId: number | null;
  isReading: boolean;
  showControls: boolean;

  setTheme: (theme: ReaderSettings['theme']) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: ReaderSettings['fontFamily']) => void;
  setLineHeight: (height: number) => void;
  setMargins: (margins: number) => void;
  setCurrentBook: (bookId: number | null) => void;
  setIsReading: (isReading: boolean) => void;
  toggleControls: () => void;
  setShowControls: (show: boolean) => void;
  resetSettings: () => void;
}

// AFTER (extended interface)
interface SettingsStore extends ReaderSettings {
  currentBookId: number | null;
  isReading: boolean;
  showControls: boolean;

  // Typography actions
  setTheme: (theme: ReaderSettings['theme']) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: ReaderSettings['fontFamily']) => void; // Still exists for system fonts
  setLineHeight: (height: number) => void;
  setMargins: (margins: number) => void;

  // NEW: Custom font actions
  setCustomFont: (fontId: number, fontFamily: string) => void;
  resetToSystemFont: (systemFont: 'serif' | 'sans-serif') => void;

  // Other actions
  setCurrentBook: (bookId: number | null) => void;
  setIsReading: (isReading: boolean) => void;
  toggleControls: () => void;
  setShowControls: (show: boolean) => void;
  resetSettings: () => void;
}
```

**Implementation**:

```typescript
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Default settings from research
      theme: 'light',
      fontSize: TYPOGRAPHY_DEFAULTS.fontSize,
      fontFamily: TYPOGRAPHY_DEFAULTS.fontFamily,
      fontType: 'system',           // NEW: Default to system fonts
      customFontId: undefined,      // NEW: No custom font selected
      lineHeight: TYPOGRAPHY_DEFAULTS.lineHeight,
      margins: TYPOGRAPHY_DEFAULTS.marginDesktop,
      currentBookId: null,
      isReading: false,
      showControls: false,

      // Existing actions
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({
        fontFamily,
        fontType: 'system',      // Set system font type
        customFontId: undefined, // Clear custom font reference
      }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMargins: (margins) => set({ margins }),

      // NEW: Set custom font
      setCustomFont: (fontId, fontFamily) => set({
        customFontId: fontId,
        fontFamily,              // Store CSS font-family name
        fontType: 'custom',
      }),

      // NEW: Reset to system font
      resetToSystemFont: (systemFont) => set({
        fontFamily: systemFont,
        fontType: 'system',
        customFontId: undefined,
      }),

      // Other actions (unchanged)
      setCurrentBook: (currentBookId) => set({ currentBookId }),
      setIsReading: (isReading) => set({ isReading }),
      toggleControls: () => set((state) => ({ showControls: !state.showControls })),
      setShowControls: (showControls) => set({ showControls }),
      resetSettings: () =>
        set({
          theme: 'light',
          fontSize: TYPOGRAPHY_DEFAULTS.fontSize,
          fontFamily: TYPOGRAPHY_DEFAULTS.fontFamily,
          fontType: 'system',      // Reset to system
          customFontId: undefined,
          lineHeight: TYPOGRAPHY_DEFAULTS.lineHeight,
          margins: TYPOGRAPHY_DEFAULTS.marginDesktop,
        }),
    }),
    {
      name: 'reader-settings',
      // Persist new fields
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        fontType: state.fontType,        // NEW: Persist font type
        customFontId: state.customFontId, // NEW: Persist custom font ID
        lineHeight: state.lineHeight,
        margins: state.margins,
      }),
    }
  )
);
```

##### 3.2 Update Constants (`lib/constants.ts`)

**Modify FontFamily type** (line 56):

```typescript
// BEFORE
export type FontFamily = 'serif' | 'sans-serif';

// AFTER
export type FontFamily = 'serif' | 'sans-serif' | string; // Allow custom font names
```

**Note**: Keep default as `'serif'` for backward compatibility.

#### Success Criteria

**Automated Tests**:
- [ ] `setCustomFont(id, family)` updates `customFontId`, `fontFamily`, `fontType`
- [ ] `resetToSystemFont('serif')` clears `customFontId`, sets `fontType='system'`
- [ ] `setFontFamily('sans-serif')` clears custom font, sets system font
- [ ] Zustand persist saves new fields to localStorage
- [ ] Settings survive page refresh
- [ ] Migration from old settings format (no `fontType` field) works gracefully

**Manual Verification**:
- [ ] Open DevTools → Application → Local Storage → `reader-settings`
- [ ] Verify new fields: `fontType`, `customFontId`
- [ ] Set custom font → refresh page → custom font still selected
- [ ] Reset to system font → `customFontId` is null/undefined
- [ ] Old localStorage data (from before update) doesn't break app

**Backward Compatibility**:
- [ ] Users with existing `fontFamily: 'serif'` settings continue working
- [ ] New fields default to system font if not present
- [ ] No console errors on first load after update

#### Time Estimate

- Extend store interface: 30 min
- Implement new actions: 1 hour
- Update constants: 15 min
- Testing & verification: 45 min
- **Total: 2-3 hours**

---

### Phase 4: Font Application Logic

**Objective**: Load custom fonts into epub.js iframe and apply to content

**Estimated Time**: 5-6 hours

**Dependencies**: Phase 1, 2, 3 complete

#### Files to Create/Modify

##### 4.1 Create Font Loader Hook (`hooks/useFontLoader.ts`)

**New file**:

```typescript
import { useEffect, useRef } from 'react';
import { getFont } from '@/lib/db';
import type { CustomFont } from '@/types';

interface FontLoaderOptions {
  fontId: number | undefined;
  enabled: boolean; // Only load if custom font selected
}

interface LoadedFont {
  family: string;
  blobURL: string;
  format: string;
  weight: number;
  style: string;
}

/**
 * Hook to load custom font from IndexedDB and create blob URL
 *
 * Usage:
 *   const { font, loading, error } = useFontLoader({
 *     fontId: customFontId,
 *     enabled: fontType === 'custom'
 *   });
 */
export function useFontLoader({ fontId, enabled }: FontLoaderOptions) {
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobURLRef = useRef<string | null>(null);

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

    let cancelled = false;

    const loadFont = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch font from IndexedDB
        const customFont = await getFont(fontId);

        if (!customFont) {
          throw new Error(`Font with ID ${fontId} not found`);
        }

        if (cancelled) return;

        // Create blob from ArrayBuffer
        const mimeTypeMap: Record<string, string> = {
          truetype: 'font/ttf',
          opentype: 'font/otf',
          woff: 'font/woff',
          woff2: 'font/woff2',
        };

        const blob = new Blob([customFont.buffer], {
          type: mimeTypeMap[customFont.format] || 'font/ttf'
        });

        // Revoke previous blob URL to prevent memory leak
        if (blobURLRef.current) {
          URL.revokeObjectURL(blobURLRef.current);
        }

        // Create new blob URL
        const blobURL = URL.createObjectURL(blob);
        blobURLRef.current = blobURL;

        const loadedFont: LoadedFont = {
          family: customFont.family,
          blobURL,
          format: customFont.format,
          weight: customFont.weight,
          style: customFont.style,
        };

        setFont(loadedFont);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[useFontLoader] Error loading font:', err);
          setError((err as Error).message);
          setLoading(false);
        }
      }
    };

    loadFont();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (blobURLRef.current) {
        URL.revokeObjectURL(blobURLRef.current);
        blobURLRef.current = null;
      }
    };
  }, [fontId, enabled]);

  return { font, loading, error };
}
```

##### 4.2 Modify Epub Reader Hook (`hooks/useEpubReader.ts`)

**Add import**:

```typescript
import { useFontLoader } from '@/hooks/useFontLoader';
```

**Modify font application logic** (around line 25 and 114-137):

```typescript
// Extract settings from store
const { theme, fontSize, fontFamily, fontType, customFontId, lineHeight } = useSettingsStore();

// Load custom font if selected
const { font: customFont, loading: fontLoading, error: fontError } = useFontLoader({
  fontId: customFontId,
  enabled: fontType === 'custom',
});

// ... existing rendition initialization code ...

// MODIFIED: Inject custom fonts into iframe (inside rendition initialization useEffect)
useEffect(() => {
  if (!book || !containerRef.current) return;

  const newRendition = book.renderTo(containerRef.current, {
    width: '100%',
    height: '100%',
    flow: 'paginated',
    snap: true,
    allowScriptedContent: true,
  });

  // Register custom font injection via content hooks
  newRendition.hooks.content.register((contents: any) => {
    const doc = contents.document;

    // Inject custom font @font-face if available
    if (fontType === 'custom' && customFont) {
      const style = doc.createElement('style');
      style.setAttribute('data-custom-font', 'true'); // For debugging

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

    // ... existing touch event handlers ...
    const handleTouchStart = (e: TouchEvent) => { /* ... */ };
    const handleTouchEnd = (e: TouchEvent) => { /* ... */ };

    doc.addEventListener('touchstart', handleTouchStart, { passive: true });
    doc.addEventListener('touchend', handleTouchEnd, { passive: false });
  });

  setRendition(newRendition);

  return () => {
    newRendition?.destroy();
  };
}, [book, containerRef, fontType, customFont]); // Add fontType, customFont to deps

// MODIFIED: Apply styling (update font-family logic)
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

#### Success Criteria

**Automated Tests**:
- [ ] `useFontLoader` fetches font from IndexedDB when enabled
- [ ] Blob URL created successfully from ArrayBuffer
- [ ] Blob URL revoked on cleanup (no memory leaks)
- [ ] Font state updates when `fontId` changes
- [ ] Error state set when font not found
- [ ] Hook disabled when `enabled=false`

**Manual Verification**:
- [ ] Select custom font → EPUB text renders in custom font
- [ ] Navigate between chapters → custom font persists
- [ ] Switch to system font → custom font removed, system font applied
- [ ] Switch back to custom font → font reloads correctly
- [ ] Open DevTools → Network → No font download requests (loaded from IndexedDB)
- [ ] Open DevTools → Elements → Inspect iframe → Verify `<style data-custom-font="true">` exists
- [ ] Check iframe `<style>` contains correct @font-face declaration
- [ ] Verify font-family applied to `<body>` in iframe

**Cross-Platform Testing**:
- [ ] Web (Chrome): Custom font renders
- [ ] Web (Safari): Custom font renders
- [ ] Web (Firefox): Custom font renders
- [ ] iOS WebView (Capacitor): Custom font renders
- [ ] Android WebView (Capacitor): Custom font renders

**Performance**:
- [ ] Font application < 200ms (measure with console.time)
- [ ] No FOUT (flash of unstyled text) visible
- [ ] No FOIT (flash of invisible text) visible
- [ ] Smooth chapter navigation (no stuttering)

**Error Handling**:
- [ ] If custom font deleted while active → fallback to system font
- [ ] If IndexedDB error → show error message, fallback to system font
- [ ] Console logs helpful debugging info

#### Time Estimate

- Implement `useFontLoader` hook: 2 hours
- Modify `useEpubReader` for font injection: 2 hours
- Testing across browsers: 1 hour
- Bug fixes and polish: 1 hour
- **Total: 5-6 hours**

---

### Phase 5: UI Components

**Objective**: Build user interface for font upload, selection, and management

**Estimated Time**: 6-8 hours

**Dependencies**: Phase 1-4 complete (full backend functional)

#### Files to Create

##### 5.1 Font Upload Modal (`components/fonts/FontUploadModal.tsx`)

**New file**:

```typescript
'use client';

import React, { useState, useCallback } from 'react';
import { validateFontFile } from '@/lib/fontValidation';
import { extractFontMetadata } from '@/lib/fontMetadata';
import { uploadFont, fontExists } from '@/lib/db';
import type { FontValidationResult } from '@/types';

interface FontUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Callback to refresh font list
}

export default function FontUploadModal({ isOpen, onClose, onSuccess }: FontUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validationResult, setValidationResult] = useState<FontValidationResult | null>(null);
  const [showLegalDisclaimer, setShowLegalDisclaimer] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setValidating(true);
    setValidationResult(null);

    // Validate file
    const basicValidation = await validateFontFile(selectedFile);
    if (!basicValidation.valid) {
      setValidationResult(basicValidation);
      setValidating(false);
      return;
    }

    // Extract metadata
    const buffer = await selectedFile.arrayBuffer();
    const metadataResult = await extractFontMetadata(buffer, selectedFile.name);

    if (!metadataResult.valid) {
      setValidationResult(metadataResult);
      setValidating(false);
      return;
    }

    // Check for duplicate
    const exists = await fontExists(metadataResult.metadata!.family);
    if (exists) {
      setValidationResult({
        valid: false,
        error: `A font with the family name "${metadataResult.metadata!.family}" already exists`,
      });
      setValidating(false);
      return;
    }

    setValidationResult({
      valid: true,
      metadata: metadataResult.metadata,
      warnings: basicValidation.warnings,
    });
    setValidating(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  }, [handleFileChange]);

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

      onSuccess();
      onClose();
    } catch (error) {
      console.error('[FontUploadModal] Upload failed:', error);
      setValidationResult({
        valid: false,
        error: `Upload failed: ${(error as Error).message}`,
      });
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Upload Custom Font
        </h2>

        {showLegalDisclaimer && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              <strong>⚠️ Font Licensing Notice</strong>
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
              You are responsible for ensuring you have the right to use uploaded fonts.
              Many fonts require a license for personal or commercial use.
            </p>
            <button
              onClick={() => setShowLegalDisclaimer(false)}
              className="text-xs text-yellow-900 dark:text-yellow-100 underline"
            >
              I understand, continue
            </button>
          </div>
        )}

        {/* Drag-and-drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            className="hidden"
            id="font-upload"
          />
          <label htmlFor="font-upload" className="cursor-pointer">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Drag and drop font file here, or click to browse
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Supported formats: TTF, OTF, WOFF, WOFF2
            </p>
          </label>
        </div>

        {/* File info */}
        {file && (
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>File:</strong> {file.name}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Size:</strong> {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        )}

        {/* Validation status */}
        {validating && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Validating font...
          </p>
        )}

        {/* Validation result */}
        {validationResult && !validating && (
          <div className={`mb-4 p-3 rounded ${
            validationResult.valid
              ? 'bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
          }`}>
            {validationResult.valid ? (
              <>
                <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                  ✓ Font validated successfully
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>Family:</strong> {validationResult.metadata?.family}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>Style:</strong> {validationResult.metadata?.style}
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>Weight:</strong> {validationResult.metadata?.weight}
                </p>
              </>
            ) : (
              <p className="text-sm text-red-800 dark:text-red-200">
                ✗ {validationResult.error}
              </p>
            )}

            {validationResult.warnings && validationResult.warnings.length > 0 && (
              <div className="mt-2">
                {validationResult.warnings.map((warning, i) => (
                  <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300">
                    ⚠ {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!validationResult?.valid || uploading}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Font'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

##### 5.2 Font Selector Dropdown (`components/fonts/FontSelector.tsx`)

**New file**:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { listFonts } from '@/lib/db';
import { useSettingsStore } from '@/stores/settingsStore';
import type { CustomFont } from '@/types';

export default function FontSelector() {
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const { fontFamily, fontType, customFontId, setFontFamily, setCustomFont } = useSettingsStore();

  useEffect(() => {
    loadFonts();
  }, []);

  const loadFonts = async () => {
    const fonts = await listFonts();
    setCustomFonts(fonts);
  };

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

  const currentValue = fontType === 'custom' && customFontId
    ? customFontId.toString()
    : fontFamily;

  return (
    <div>
      <label htmlFor="font-selector" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Font Family
      </label>
      <select
        id="font-selector"
        value={currentValue}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      >
        <optgroup label="System Fonts">
          <option value="serif" style={{ fontFamily: 'Georgia, serif' }}>
            Serif (Georgia)
          </option>
          <option value="sans-serif" style={{ fontFamily: '-apple-system, sans-serif' }}>
            Sans-serif (System)
          </option>
        </optgroup>

        {customFonts.length > 0 && (
          <optgroup label="Custom Fonts">
            {customFonts.map(font => (
              <option key={font.id} value={font.id}>
                {font.name} ({font.style}, {font.weight})
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {fontType === 'custom' && customFonts.length > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Preview text in selected font...
        </p>
      )}
    </div>
  );
}
```

##### 5.3 Font Manager (`components/fonts/FontManager.tsx`)

**New file**:

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { listFonts, deleteFont } from '@/lib/db';
import { useSettingsStore } from '@/stores/settingsStore';
import type { CustomFont } from '@/types';

interface FontManagerProps {
  onUploadClick: () => void;
}

export default function FontManager({ onUploadClick }: FontManagerProps) {
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const { customFontId, resetToSystemFont } = useSettingsStore();

  useEffect(() => {
    loadFonts();
  }, []);

  const loadFonts = async () => {
    const allFonts = await listFonts();
    setFonts(allFonts);
  };

  const handleDelete = async (fontId: number) => {
    await deleteFont(fontId);

    // If deleted font was active, reset to system font
    if (customFontId === fontId) {
      resetToSystemFont('serif');
    }

    setDeleteConfirm(null);
    loadFonts(); // Refresh list
  };

  if (fonts.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          No custom fonts uploaded yet
        </p>
        <button
          onClick={onUploadClick}
          className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Upload Your First Font
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Uploaded Fonts ({fonts.length})
        </h3>
        <button
          onClick={onUploadClick}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Upload Font
        </button>
      </div>

      {fonts.map(font => (
        <div
          key={font.id}
          className="p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {font.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {font.style}, Weight {font.weight} • {(font.sizeBytes / 1024).toFixed(2)} KB
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Uploaded {new Date(font.uploadedAt).toLocaleDateString()}
              </p>
            </div>

            {deleteConfirm === font.id ? (
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => handleDelete(font.id!)}
                  className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="text-xs px-2 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(font.id!)}
                className="text-sm text-red-600 dark:text-red-400 hover:underline ml-2"
              >
                Delete
              </button>
            )}
          </div>

          {customFontId === font.id && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              ✓ Currently active
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

##### 5.4 Update Typography Settings (`components/shared/TypographySettings.tsx`)

**Replace existing font selector** (lines 33-61):

```typescript
import FontSelector from '@/components/fonts/FontSelector';
import FontManager from '@/components/fonts/FontManager';
import FontUploadModal from '@/components/fonts/FontUploadModal';

export default function TypographySettings({ showResetButton = true }: TypographySettingsProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const {
    fontSize,
    setFontSize,
    lineHeight,
    setLineHeight,
    margins,
    setMargins,
    resetSettings,
  } = useSettingsStore();

  // ... existing code ...

  return (
    <div className="space-y-6">
      {/* Font Selector (new component) */}
      <FontSelector />

      {/* Font Manager (new component) */}
      <FontManager onUploadClick={() => setUploadModalOpen(true)} />

      {/* Font Upload Modal */}
      <FontUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          // Font list will auto-refresh via FontManager's useEffect
        }}
      />

      {/* Existing controls: Font Size, Line Height, Margins */}
      {/* ... rest of component unchanged ... */}
    </div>
  );
}
```

#### Success Criteria

**Functional Testing**:
- [ ] Upload modal opens when clicking "Upload Font" button
- [ ] Drag-and-drop works for font files
- [ ] File picker accepts .ttf, .otf, .woff, .woff2 only
- [ ] Legal disclaimer shows on first upload
- [ ] Validation runs automatically after file selection
- [ ] Error message shown for invalid files
- [ ] Success state shown for valid files with metadata preview
- [ ] Upload button enabled only when validation passes
- [ ] Font appears in selector dropdown after upload
- [ ] Selecting custom font from dropdown applies it to EPUB
- [ ] Font manager shows all uploaded fonts
- [ ] Delete button triggers confirmation modal
- [ ] Deleting font removes it from list
- [ ] Deleting active font reverts to system font
- [ ] Empty state shown when no fonts uploaded

**UI/UX Testing**:
- [ ] Modal closes with Esc key
- [ ] Modal closes when clicking outside (optional)
- [ ] Upload progress shown during validation/upload
- [ ] Loading states don't block UI
- [ ] Error messages are clear and actionable
- [ ] Font preview text readable in both light/dark themes
- [ ] Dropdown keyboard accessible (arrow keys, Enter)
- [ ] Delete confirmation prevents accidental deletion

**Cross-Platform**:
- [ ] Components render correctly on mobile (responsive)
- [ ] Touch interactions work on mobile
- [ ] File picker works on iOS
- [ ] File picker works on Android
- [ ] Dark mode styling consistent

#### Time Estimate

- FontUploadModal: 2.5 hours
- FontSelector dropdown: 1.5 hours
- FontManager list: 1.5 hours
- TypographySettings integration: 1 hour
- Styling/polish: 1 hour
- Testing: 1.5 hours
- **Total: 6-8 hours**

---

### Phase 6: Legal & Error Handling

**Objective**: Add legal protections and comprehensive error handling

**Estimated Time**: 3-4 hours

**Dependencies**: Phase 5 complete (UI built)

#### Files to Create/Modify

##### 6.1 Create Legal Disclaimer Component (`components/fonts/LegalDisclaimer.tsx`)

**New file**:

```typescript
'use client';

import React from 'react';

interface LegalDisclaimerProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function LegalDisclaimer({ onAccept, onDecline }: LegalDisclaimerProps) {
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded">
      <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
        Font Licensing Agreement
      </h3>

      <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2 mb-4">
        <p>
          <strong>You are responsible for ensuring you have the legal right to use uploaded fonts.</strong>
        </p>

        <p>
          Many fonts are protected by copyright and require a license for:
        </p>
        <ul className="list-disc list-inside ml-2">
          <li>Personal use</li>
          <li>Commercial use</li>
          <li>Distribution</li>
          <li>Embedding in applications</li>
        </ul>

        <p>
          <strong>Free and open-source fonts:</strong>
        </p>
        <ul className="list-disc list-inside ml-2">
          <li>Google Fonts (Open Font License)</li>
          <li>SIL Open Font License fonts</li>
          <li>Fonts explicitly marked as "free for personal and commercial use"</li>
        </ul>

        <p>
          <strong>This application does not verify font licenses.</strong> By uploading a font, you confirm:
        </p>
        <ul className="list-disc list-inside ml-2">
          <li>You own the font or have obtained a valid license</li>
          <li>Your use complies with the font's license terms</li>
          <li>You will not distribute this font to others without permission</li>
        </ul>

        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-3">
          For more information about font licensing, visit{' '}
          <a
            href="https://fonts.google.com/about"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Google Fonts
          </a>{' '}
          or{' '}
          <a
            href="https://scripts.sil.org/OFL"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            SIL Open Font License
          </a>.
        </p>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={onDecline}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={onAccept}
          className="px-4 py-2 text-sm text-white bg-yellow-600 rounded hover:bg-yellow-700"
        >
          I Understand, Continue
        </button>
      </div>
    </div>
  );
}
```

##### 6.2 Add Error Boundary (`components/fonts/FontErrorBoundary.tsx`)

**New file**:

```typescript
'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class FontErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FontErrorBoundary] Font loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded">
          <p className="text-sm text-red-800 dark:text-red-200">
            Failed to load custom font. Reverting to system font.
          </p>
          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
            Error: {this.state.error?.message}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

##### 6.3 Enhance Error Handling in Font Loader (`hooks/useFontLoader.ts`)

**Add retry logic and better error messages**:

```typescript
// Add to useFontLoader hook
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Modify loadFont function to include retry logic
const loadFont = async (attempt = 1) => {
  setLoading(true);
  setError(null);

  try {
    const customFont = await getFont(fontId);

    if (!customFont) {
      throw new Error(`Font with ID ${fontId} not found in database`);
    }

    // Verify ArrayBuffer is valid
    if (!customFont.buffer || customFont.buffer.byteLength === 0) {
      throw new Error('Font file is empty or corrupted');
    }

    // ... rest of loading logic ...

  } catch (err) {
    const errorMessage = (err as Error).message;
    console.error(`[useFontLoader] Attempt ${attempt} failed:`, errorMessage);

    // Retry logic
    if (attempt < MAX_RETRIES) {
      console.log(`[useFontLoader] Retrying in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return loadFont(attempt + 1);
    }

    // All retries exhausted
    setError(`Failed to load font after ${MAX_RETRIES} attempts: ${errorMessage}`);
    setLoading(false);
  }
};
```

##### 6.4 Add User-Friendly Error Messages (`lib/fontErrors.ts`)

**New file**:

```typescript
export const FONT_ERROR_MESSAGES: Record<string, { title: string; message: string; action: string }> = {
  FONT_NOT_FOUND: {
    title: 'Font Not Found',
    message: 'The selected font could not be found in your library. It may have been deleted.',
    action: 'Please select a different font or upload a new one.',
  },
  FONT_CORRUPTED: {
    title: 'Corrupted Font File',
    message: 'The font file appears to be corrupted or incomplete.',
    action: 'Try re-uploading the font file.',
  },
  INDEXEDDB_ERROR: {
    title: 'Storage Error',
    message: 'Could not access local storage. This may be due to browser privacy settings.',
    action: 'Check that third-party cookies and local storage are enabled.',
  },
  INVALID_FORMAT: {
    title: 'Invalid Font Format',
    message: 'The uploaded file is not a valid font file.',
    action: 'Ensure you are uploading a .ttf, .otf, .woff, or .woff2 file.',
  },
  FILE_TOO_LARGE: {
    title: 'File Too Large',
    message: 'Font files larger than 10MB are not supported.',
    action: 'Use a web-optimized font format (WOFF2) or subset the font.',
  },
  DUPLICATE_FONT: {
    title: 'Duplicate Font',
    message: 'A font with this family name already exists.',
    action: 'Delete the existing font first, or rename the new font file.',
  },
};

export function getFontErrorMessage(errorCode: string): string {
  const error = FONT_ERROR_MESSAGES[errorCode];
  return error ? `${error.title}: ${error.message} ${error.action}` : 'An unknown error occurred.';
}
```

#### Success Criteria

**Legal Compliance**:
- [ ] Disclaimer shown before first upload
- [ ] User must click "I Understand" to proceed
- [ ] Disclaimer dismissable with "Don't show again" option
- [ ] Disclaimer text clear and comprehensive
- [ ] Links to license resources functional

**Error Handling**:
- [ ] Font not found → Fallback to system font + error message
- [ ] Corrupted font file → Clear error, retry option
- [ ] IndexedDB error → Helpful troubleshooting message
- [ ] Upload failure → Error shown, upload can be retried
- [ ] Network error (if applicable) → Retry logic works
- [ ] Error boundary catches React errors → No white screen

**User Experience**:
- [ ] Error messages are non-technical and actionable
- [ ] Errors don't crash the app
- [ ] Users can recover from errors without refresh
- [ ] Loading states shown during retries
- [ ] Success messages shown after recovery

**Edge Cases**:
- [ ] Delete active font → Revert to system font gracefully
- [ ] Upload while another upload in progress → Queue or block
- [ ] Browser storage full → Clear error message
- [ ] Font loads while switching chapters → No visual glitches

#### Time Estimate

- Legal disclaimer component: 1 hour
- Error boundary: 30 min
- Enhanced error handling: 1 hour
- Error messages library: 30 min
- Testing error scenarios: 1 hour
- **Total: 3-4 hours**

---

### Phase 7: Testing & Polish

**Objective**: Comprehensive cross-platform testing and final refinements

**Estimated Time**: 4-5 hours

**Dependencies**: All previous phases complete

#### Testing Checklist

##### 7.1 Functional Testing

**Upload Flow**:
- [ ] Upload valid TTF → Success
- [ ] Upload valid OTF → Success
- [ ] Upload valid WOFF → Success
- [ ] Upload valid WOFF2 → Success
- [ ] Upload 8MB font → Warning shown, upload succeeds
- [ ] Upload 12MB font → Error, upload blocked
- [ ] Upload .txt renamed to .ttf → Rejected at magic number check
- [ ] Upload corrupted font → Rejected at parsing stage
- [ ] Upload duplicate font → Error about existing font
- [ ] Cancel upload → Modal closes, no font added

**Selection Flow**:
- [ ] Select serif → System font applied
- [ ] Select sans-serif → System font applied
- [ ] Select custom font → Custom font loaded and applied
- [ ] Switch between custom fonts → Font changes correctly
- [ ] Switch custom → system → custom → Works each time

**Deletion Flow**:
- [ ] Delete inactive font → Font removed, no other changes
- [ ] Delete active font → Revert to system font, font removed
- [ ] Delete with confirmation cancel → Font not deleted
- [ ] Delete last custom font → Empty state shown

**Persistence**:
- [ ] Upload font → Refresh page → Font still in list
- [ ] Select custom font → Refresh page → Custom font still active
- [ ] Delete font → Refresh page → Font still deleted
- [ ] Settings persist across browser sessions

##### 7.2 Cross-Platform Testing

**Web Browsers**:
- [ ] Chrome (latest): All features work
- [ ] Safari (latest): All features work
- [ ] Firefox (latest): All features work
- [ ] Edge (latest): All features work
- [ ] Chrome iOS: File picker accessible
- [ ] Safari iOS: File picker accessible

**Mobile WebViews** (if applicable):
- [ ] iOS WKWebView (Capacitor): Font upload works
- [ ] iOS WKWebView: Font rendering works
- [ ] Android WebView (Capacitor): Font upload works
- [ ] Android WebView: Font rendering works

**Responsive Design**:
- [ ] Mobile portrait: UI usable
- [ ] Mobile landscape: UI usable
- [ ] Tablet: UI optimized
- [ ] Desktop: UI optimized

##### 7.3 Performance Testing

**Metrics**:
- [ ] Font upload (2MB): < 500ms validation
- [ ] Font application to EPUB: < 200ms
- [ ] Font preview render: < 100ms
- [ ] IndexedDB read: < 100ms
- [ ] Modal open: Instant (no lag)
- [ ] Dropdown open: Instant

**Memory**:
- [ ] Read 10 chapters with custom font → No memory leak
- [ ] Switch fonts 10 times → No memory leak
- [ ] Upload 5 fonts → Memory usage acceptable
- [ ] Check DevTools Memory tab: No detached DOM nodes

**Storage**:
- [ ] Upload 5 fonts → Check IndexedDB size
- [ ] Total storage < 50MB with typical usage
- [ ] Storage quota check works

##### 7.4 Accessibility Testing

**Keyboard Navigation**:
- [ ] Tab through upload modal: All controls reachable
- [ ] Tab through font selector: Dropdown accessible
- [ ] Tab through font manager: Delete button accessible
- [ ] Enter key: Submits upload
- [ ] Escape key: Closes modal

**Screen Reader** (basic check):
- [ ] Upload modal: Labels read correctly
- [ ] Font selector: Options announced
- [ ] Error messages: Read aloud
- [ ] Success messages: Read aloud

**Contrast**:
- [ ] Light mode: All text meets WCAG AA (4.5:1)
- [ ] Dark mode: All text meets WCAG AA
- [ ] Error text: Sufficient contrast

##### 7.5 Edge Cases

**Unusual Scenarios**:
- [ ] Upload font with very long name (>100 chars) → Truncated gracefully
- [ ] Upload font with special characters in name → Handled correctly
- [ ] Upload font with no metadata → Fallback to filename
- [ ] Open upload modal twice simultaneously → Only one modal
- [ ] Delete font while modal open → Modal state correct
- [ ] Switch pages while uploading → Upload continues or cancels cleanly
- [ ] Browser storage disabled → Error message shown
- [ ] IndexedDB upgrade fails → Fallback or error

**Data Integrity**:
- [ ] Corrupt IndexedDB → App recovers or shows error
- [ ] Delete IndexedDB manually → App reinitializes cleanly
- [ ] Downgrade app version → No crashes
- [ ] Partial upload (interrupted) → No orphaned data

##### 7.6 Polish Items

**UI Refinements**:
- [ ] Loading spinners smooth and visible
- [ ] Transitions not jarring
- [ ] Error states clear
- [ ] Success states celebratory (subtle)
- [ ] Empty states helpful
- [ ] Button hover states consistent
- [ ] Focus states visible

**UX Improvements**:
- [ ] Font preview text shows alphabet + numbers
- [ ] Upload modal: File name truncated if too long
- [ ] Font manager: Sort order logical (newest first)
- [ ] Delete confirmation: Shows font name
- [ ] Error messages: Suggest next steps

**Code Quality**:
- [ ] TypeScript: No `any` types (except epub.js)
- [ ] Console: No errors in production
- [ ] Comments: Complex logic explained
- [ ] Functions: Single responsibility
- [ ] Components: Proper prop types

#### Success Criteria

**Zero Critical Bugs**:
- [ ] No data loss scenarios
- [ ] No unrecoverable errors
- [ ] No white screens of death
- [ ] No infinite loops

**Cross-Platform Parity**:
- [ ] Works on all tested browsers
- [ ] Works on mobile (responsive)
- [ ] Works in WebViews (if applicable)

**Performance Benchmarks Met**:
- [ ] All timing metrics under targets
- [ ] No memory leaks detected
- [ ] Storage usage reasonable

**Accessibility**:
- [ ] WCAG AA compliance (basic)
- [ ] Keyboard navigation functional
- [ ] Screen reader friendly (basic)

#### Time Estimate

- Functional testing: 1.5 hours
- Cross-platform testing: 1 hour
- Performance testing: 1 hour
- Polish and refinements: 1 hour
- Bug fixes: 1 hour (buffer)
- **Total: 4-5 hours**

---

## Risk Assessment & Mitigation

### Technical Risks

#### Risk 1: Blob URL Iframe Compatibility
**Description**: Blob URLs created in parent document may not work in epub.js iframe on some browsers
**Impact**: HIGH - Custom fonts won't render
**Probability**: MEDIUM
**Mitigation**:
- Test blob URL approach early (Phase 4)
- Fallback: Use data URIs instead (base64 encode font)
- Fallback 2: Inject font buffer directly into iframe context
- Document browser compatibility in testing phase

#### Risk 2: IndexedDB Quota Exceeded
**Description**: Users upload too many/large fonts, exceeding browser storage quota
**Impact**: MEDIUM - Upload failures
**Probability**: LOW
**Mitigation**:
- 10MB per-font hard limit
- Display total storage used in font manager
- Warning when approaching quota (via StorageManager API)
- Provide "clear all fonts" option

#### Risk 3: Font Parsing Failures
**Description**: opentype.js fails to parse certain valid font formats
**Impact**: MEDIUM - Fonts rejected incorrectly
**Probability**: MEDIUM
**Mitigation**:
- Comprehensive validation before parsing
- Graceful fallback to filename if metadata extraction fails
- Allow manual metadata override (future enhancement)
- Test with diverse font files

#### Risk 4: Memory Leaks
**Description**: Blob URLs not revoked, causing memory accumulation
**Impact**: HIGH - Performance degradation
**Probability**: MEDIUM
**Mitigation**:
- Strict blob URL lifecycle management (create on chapter load, revoke on unload)
- Memory profiling during testing (Phase 7)
- Use WeakMap for blob URL tracking
- Automated memory leak detection

#### Risk 5: EPUB Embedded Fonts Conflict
**Description**: EPUB's internal fonts override custom fonts
**Impact**: MEDIUM - Custom fonts don't apply
**Probability**: MEDIUM
**Mitigation**:
- Use `!important` in CSS rules (already implemented)
- Higher specificity selectors
- Document limitation for users (some EPUBs force specific fonts)

### Legal Risks

#### Risk 6: Copyright Infringement
**Description**: Users upload pirated commercial fonts
**Impact**: HIGH - Legal liability
**Probability**: MEDIUM
**Mitigation**:
- Legal disclaimer (Phase 6)
- No font sharing features (keeps fonts local)
- DMCA compliance in Terms of Service
- User attestation during upload

#### Risk 7: License Violations
**Description**: Users violate font licenses (e.g., personal-use-only font used commercially)
**Impact**: MEDIUM - User liability, app reputation
**Probability**: HIGH
**Mitigation**:
- Clear licensing warnings
- Educational content about font licensing
- Links to free font resources (Google Fonts, etc.)
- Disclaimer: App doesn't verify licenses

### UX Risks

#### Risk 8: Font Format Confusion
**Description**: Users don't understand which font format to upload
**Impact**: LOW - Support burden
**Probability**: MEDIUM
**Mitigation**:
- Accept all common formats (TTF, OTF, WOFF, WOFF2)
- Clear help text: "Any format works"
- Recommend WOFF2 for smaller file size
- Auto-detect format (no user action needed)

#### Risk 9: Font Preview Misleading
**Description**: Font preview looks different than actual reading experience
**Impact**: LOW - User confusion
**Probability**: LOW
**Mitigation**:
- Use same rendering engine for preview
- Show preview in light/dark/sepia themes
- Use realistic preview text (paragraph, not single line)

### Performance Risks

#### Risk 10: Large Font Files
**Description**: 10MB fonts cause slow upload/loading
**Impact**: MEDIUM - Poor UX
**Probability**: MEDIUM
**Mitigation**:
- Warning at 5MB
- Hard limit at 10MB
- Suggest WOFF2 format (smaller)
- Show progress during upload

#### Risk 11: FOUT/FOIT
**Description**: Flash of unstyled/invisible text while font loads
**Impact**: LOW - Visual glitch
**Probability**: HIGH
**Mitigation**:
- `font-display: swap` in @font-face
- Preload font before displaying content
- Fast font loading (IndexedDB is local, fast)

---

## Deployment & Migration

### Pre-Deployment Checklist

- [ ] All phases complete and tested
- [ ] Cross-platform testing passed
- [ ] Performance benchmarks met
- [ ] No critical bugs
- [ ] Legal disclaimer reviewed
- [ ] Documentation updated
- [ ] Database migration tested

### Database Migration

**From Version 4 to Version 5**:

```typescript
// lib/db.ts
// Dexie automatically handles schema upgrades
// No manual migration needed for new table

// Test migration:
// 1. Create test database with version 4 schema
// 2. Add sample data to existing tables
// 3. Upgrade to version 5 (add customFonts table)
// 4. Verify existing data intact
// 5. Verify customFonts table accessible
```

**Migration validation**:
- Existing books still readable
- Existing settings still applied
- No data loss in any table

### Rollback Plan

**If critical bug found post-deployment**:

1. **Immediate**: Disable font upload UI (hide upload button)
2. **Settings fallback**: Automatically reset `fontType` to `'system'` in store
3. **Database**: No rollback needed (new table doesn't affect existing data)
4. **User communication**: Notify users of temporary unavailability
5. **Fix**: Address bug, re-deploy with fix
6. **Re-enable**: Restore upload UI after verification

**Code for emergency disable**:

```typescript
// Add feature flag
const CUSTOM_FONTS_ENABLED = false; // Set to false to disable

// In TypographySettings.tsx
{CUSTOM_FONTS_ENABLED && <FontManager ... />}
{CUSTOM_FONTS_ENABLED && <FontUploadModal ... />}
```

### Post-Deployment Monitoring

**Metrics to track**:
- Upload success rate
- Upload validation failures (by error type)
- Font application errors
- IndexedDB quota errors
- Performance metrics (upload time, load time)
- Browser compatibility issues

**Logging**:
- Console errors related to fonts
- Failed uploads with error codes
- Memory warnings
- Storage quota warnings

---

## Documentation Requirements

### User Documentation

**Help article: "Uploading Custom Fonts"**:
- How to upload a font
- Supported formats
- File size limits
- Where to find free fonts (Google Fonts, Font Squirrel, etc.)
- Font licensing basics
- Troubleshooting common issues

**FAQ**:
- Q: Which font format should I use?
  - A: WOFF2 is recommended for smallest file size, but TTF/OTF also work.
- Q: Why can't I upload a 15MB font?
  - A: Large files impact performance. 10MB is the maximum.
- Q: Is it legal to upload any font?
  - A: Only fonts you own or have a license for. See our licensing guide.
- Q: Can I share fonts with others?
  - A: No, fonts stay on your device for your personal use only.

### Developer Documentation

**Code comments**:
- Complex validation logic
- Blob URL lifecycle management
- IndexedDB schema rationale
- epub.js iframe injection technique

**README additions**:
- Custom font upload feature description
- Dependencies: opentype.js
- Database schema version 5 notes

**API documentation** (if applicable):
- Font CRUD operations
- Validation functions
- Metadata extraction

---

## Future Enhancements (Out of Scope)

**Deferred to V2**:

1. **Font Conversion Service**
   - Auto-convert TTF/OTF to WOFF2 on upload
   - Reduces storage requirements
   - Requires: wasm library (fontkit or similar)

2. **Font Subsetting**
   - Extract only used glyphs from font
   - Dramatically reduces file size
   - Requires: complex font manipulation library

3. **Per-Book Font Overrides**
   - Different font for each book
   - Requires: Settings architecture refactor (see related research)

4. **Font Family Grouping**
   - Link Regular, Bold, Italic variants
   - Apply as single font family
   - Requires: Complex UI for variant management

5. **Google Fonts Integration**
   - Browse/download fonts from API
   - Requires: Network calls, caching strategy, licensing UI

6. **Font Preview Customization**
   - User-editable preview text
   - Preview in different sizes
   - Nice-to-have, not critical

7. **Export/Import Font Collections**
   - Share fonts between devices
   - Requires: Licensing compliance checks

8. **Cloud Sync**
   - Sync fonts across devices
   - Requires: Backend infrastructure

---

## Summary & Next Steps

### What This Plan Delivers

1. **Full custom font upload system** with drag-and-drop
2. **Robust validation** (extension, MIME, magic number, parsing)
3. **Metadata extraction** (family, style, weight) via opentype.js
4. **Persistent storage** in IndexedDB using Dexie
5. **Seamless font application** to EPUB content via epub.js
6. **Font management UI** (list, delete, select)
7. **Legal protections** (disclaimer, licensing warnings)
8. **Comprehensive error handling** (retries, fallbacks, user-friendly messages)
9. **Cross-platform compatibility** (web, iOS, Android)
10. **Production-ready** with testing, polish, and documentation

### Implementation Order

1. **Phase 1** (3-4h): Database & storage foundation
2. **Phase 2** (4-5h): Validation & metadata extraction
3. **Phase 3** (2-3h): Settings store extension
4. **Phase 4** (5-6h): Font loading & application logic
5. **Phase 5** (6-8h): UI components (upload, select, manage)
6. **Phase 6** (3-4h): Legal & error handling
7. **Phase 7** (4-5h): Testing & polish

**Total: 27-35 hours**

### Critical Success Factors

- **Phase 1-3 must be solid**: Database schema and settings are foundation
- **Phase 4 is most complex**: Font injection into iframe requires careful testing
- **Phase 5 is most visible**: UI must be intuitive and polished
- **Phase 6 protects legally**: Don't skip legal disclaimer
- **Phase 7 ensures quality**: Comprehensive testing across platforms

### Ready to Implement?

This plan provides:
- ✅ Complete technical specifications
- ✅ Exact code examples for each phase
- ✅ Clear success criteria (automated + manual)
- ✅ Time estimates with buffers
- ✅ Risk mitigation strategies
- ✅ Rollback procedures
- ✅ Cross-platform considerations

**Next step**: Begin Phase 1 (Database & Storage Layer)

---

**End of Implementation Plan**
