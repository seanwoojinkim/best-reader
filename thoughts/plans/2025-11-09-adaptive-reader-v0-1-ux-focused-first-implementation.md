---
doc_type: plan
date: 2025-11-09T16:46:46+00:00
title: "Adaptive Reader v0.1 - UX-Focused First Implementation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-09T16:46:46+00:00"
feature: "adaptive-reader-v0.1"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Core Reading Experience & EPUB Loading"
    status: complete
    completed_date: 2025-11-09
  - name: "Phase 2: Highlighting & Session Management"
    status: pending
  - name: "Phase 3: UI Polish & Adaptive Tracking"
    status: pending
  - name: "Phase 4: Mock AI Features & PWA"
    status: pending

git_commit: 08be909ee4bb4c8d0f8fa013451fcc05c70f0cb6
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Sean Kim

tags:
  - web
  - epub
  - react
  - ux
  - mvp
status: draft

related_docs:
  - thoughts/research/2025-11-09-digital-reading-attention-and-engagement.md
  - thoughts/research/2025-11-09-digital-reading-interface-ux-patterns.md
  - spec-v0.1.md
---

# Implementation Plan: Adaptive Reader v0.1 - UX-Focused First Version

## Executive Summary

This plan outlines a **phased, UX-first implementation** of the Adaptive Reader web application. The first version prioritizes the **core reading experience** with EPUB support, typography-first design, distraction-free interface, and **mock AI features** to demonstrate the vision without requiring real AI integration.

**Key Decisions:**
- **Tech Stack**: Next.js 14 (App Router) with React, TypeScript, Tailwind CSS
- **EPUB Parsing**: epub.js v0.3
- **Local Storage**: Dexie.js (IndexedDB wrapper)
- **State Management**: Zustand (lightweight, performant)
- **Testing**: Playwright for E2E validation at key milestones

**Timeline**: 4 phases, approximately 4-6 weeks total for a single developer

**Success Criteria**: At the end of Phase 4, the application should:
- Load and display EPUB files with beautiful typography
- Support 3 themes (Light, Dark, Sepia) with industry-standard colors
- Provide distraction-free pagination with tap/swipe navigation
- Track reading sessions and show mock "recap" on reopening
- Demonstrate mock AI features (recap, summarize, explain) with placeholder data
- Work on mobile and desktop (responsive)
- Be installable as PWA

---

## Technology Stack Recommendation

### Framework: **Next.js 14 (App Router) with React 18**

**Rationale:**
- **SEO-friendly**: Server-side rendering for landing/library pages
- **Performance**: Built-in optimization (lazy loading, image optimization, code splitting)
- **Routing**: File-based routing simplifies navigation (library → book reader)
- **PWA Support**: Easy to add service worker and manifest
- **Developer Experience**: Hot reload, TypeScript support, excellent tooling
- **Future-proof**: App Router is modern approach, will be maintained

**Alternative Considered: React (Create React App/Vite)**
- Pros: Simpler setup, less opinionated
- Cons: No SSR, manual PWA setup, less built-in optimization
- **Decision**: Next.js provides better foundation for future features (sync, auth)

### EPUB Library: **epub.js v0.3**

**Rationale:**
- Industry-standard EPUB parser for web
- Supports EPUB 2 and EPUB 3
- Built-in pagination and rendering
- Active maintenance (last updated 2023)
- Well-documented API

**Usage:**
```javascript
import ePub from 'epubjs';

const book = ePub(epubUrl);
const rendition = book.renderTo('reader-container', {
  width: '100%',
  height: '100%',
  flow: 'paginated' // or 'scrolled'
});

rendition.display();
```

### Local Storage: **Dexie.js 3.x**

**Rationale:**
- Clean API wrapper around IndexedDB
- Supports transactions, queries, indexing
- TypeScript support
- Small bundle size (~20KB)
- Handles async naturally

**Schema Preview:**
```typescript
db.version(1).stores({
  books: '++id, title, author, filePath, coverUrl, *tags',
  sessions: '++id, bookId, startTime, endTime, pagesRead, wordsRead',
  highlights: '++id, bookId, cfiRange, text, color, note, createdAt',
  positions: 'bookId, cfi, percentage, chapter'
});
```

### State Management: **Zustand 4.x**

**Rationale:**
- Lightweight (3KB) vs. Redux (45KB)
- Simple API, minimal boilerplate
- Good for reading state (current position, theme, font settings)
- Integrates well with React hooks
- Supports persistence middleware

**Example Store:**
```typescript
import create from 'zustand';

interface ReaderStore {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number;
  fontFamily: 'serif' | 'sans-serif';
  lineHeight: number;
  setTheme: (theme: 'light' | 'dark' | 'sepia') => void;
  // ...
}

export const useReaderStore = create<ReaderStore>((set) => ({
  theme: 'light',
  fontSize: 18,
  fontFamily: 'serif',
  lineHeight: 1.5,
  setTheme: (theme) => set({ theme }),
  // ...
}));
```

### Styling: **Tailwind CSS 3.x**

**Rationale:**
- Rapid prototyping with utility classes
- Consistent design system (spacing, colors, typography)
- Dark mode support built-in (`dark:` prefix)
- Custom theme configuration (sepia colors, typography scale)
- Tree-shaking for small production bundle

**Theme Configuration:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        sepia: {
          bg: '#FBF0D9',
          text: '#5F4B32',
        },
        dark: {
          bg: '#121212',
          text: '#E0E0E0',
        },
      },
      maxWidth: {
        'reading': '65ch',
        'reading-mobile': '40ch',
      },
    },
  },
};
```

### Testing: **Playwright**

**Rationale:**
- Cross-browser testing (Chromium, Firefox, WebKit)
- Mobile emulation for responsive testing
- Can test file upload (EPUB loading)
- Built-in waiting and assertions
- MCP integration available (user has Playwright MCP)

**Test Scenarios:**
- Phase 1: EPUB loads, text renders, pagination works
- Phase 2: Highlights save/load, session resumes at last position
- Phase 3: Theme switching, font customization, tap zones work
- Phase 4: Mock AI features appear, PWA installs

---

## Data Models & Schema

### IndexedDB Schema (Dexie.js)

```typescript
// src/lib/db.ts
import Dexie, { Table } from 'dexie';

export interface Book {
  id?: number;
  title: string;
  author: string;
  filePath: string; // Blob URL or File reference
  coverUrl?: string;
  isbn?: string;
  tags?: string[];
  addedAt: Date;
  lastOpenedAt?: Date;
  totalPages?: number;
}

export interface Session {
  id?: number;
  bookId: number;
  startTime: Date;
  endTime?: Date;
  pagesRead: number;
  wordsRead: number;
  avgSpeed?: number; // words per minute
  currentCFI?: string; // Canonical Fragment Identifier (EPUB position)
}

export interface Highlight {
  id?: number;
  bookId: number;
  cfiRange: string; // EPUB CFI range
  text: string; // highlighted text content
  color: 'yellow' | 'blue' | 'orange' | 'pink';
  note?: string; // user annotation
  createdAt: Date;
}

export interface ReadingPosition {
  bookId: number; // Primary key
  cfi: string; // Current position
  percentage: number; // Progress 0-100
  chapter?: string; // Chapter title
  updatedAt: Date;
}

export class ReaderDatabase extends Dexie {
  books!: Table<Book, number>;
  sessions!: Table<Session, number>;
  highlights!: Table<Highlight, number>;
  positions!: Table<ReadingPosition, number>;

  constructor() {
    super('AdaptiveReaderDB');
    this.version(1).stores({
      books: '++id, title, author, addedAt, lastOpenedAt, *tags',
      sessions: '++id, bookId, startTime, endTime',
      highlights: '++id, bookId, cfiRange, color, createdAt',
      positions: 'bookId, updatedAt',
    });
  }
}

export const db = new ReaderDatabase();
```

### Zustand State Store

```typescript
// src/stores/readerStore.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

export interface ReaderSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontSize: number; // 14-24px
  fontFamily: 'serif' | 'sans-serif';
  lineHeight: number; // 1.2-1.8
  margins: number; // 1-4rem
}

interface ReaderStore extends ReaderSettings {
  currentBookId: number | null;
  isReading: boolean;
  showControls: boolean;

  // Actions
  setTheme: (theme: ReaderSettings['theme']) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: ReaderSettings['fontFamily']) => void;
  setLineHeight: (height: number) => void;
  setMargins: (margins: number) => void;
  setCurrentBook: (bookId: number | null) => void;
  toggleControls: () => void;
  resetSettings: () => void;
}

export const useReaderStore = create<ReaderStore>()(
  persist(
    (set) => ({
      // Defaults from research (18px, 1.5 line height, serif)
      theme: 'light',
      fontSize: 18,
      fontFamily: 'serif',
      lineHeight: 1.5,
      margins: 2,
      currentBookId: null,
      isReading: false,
      showControls: false,

      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMargins: (margins) => set({ margins }),
      setCurrentBook: (bookId) => set({ currentBookId: bookId }),
      toggleControls: () => set((state) => ({ showControls: !state.showControls })),
      resetSettings: () => set({
        theme: 'light',
        fontSize: 18,
        fontFamily: 'serif',
        lineHeight: 1.5,
        margins: 2,
      }),
    }),
    {
      name: 'reader-settings',
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        lineHeight: state.lineHeight,
        margins: state.margins,
      }),
    }
  )
);
```

---

## Component Architecture

### File Structure

```
/Users/seankim/dev/reader/
├── public/
│   ├── manifest.json (PWA manifest)
│   ├── sw.js (service worker - Phase 4)
│   └── icons/ (PWA icons)
├── src/
│   ├── app/ (Next.js App Router)
│   │   ├── layout.tsx (root layout, theme provider)
│   │   ├── page.tsx (library view)
│   │   ├── read/
│   │   │   └── [bookId]/
│   │   │       └── page.tsx (reader view)
│   │   └── globals.css (Tailwind imports, theme CSS variables)
│   ├── components/
│   │   ├── library/
│   │   │   ├── BookCard.tsx (book cover + metadata)
│   │   │   ├── BookGrid.tsx (grid layout of books)
│   │   │   ├── UploadButton.tsx (EPUB file upload)
│   │   │   └── EmptyState.tsx (no books yet)
│   │   ├── reader/
│   │   │   ├── EpubRenderer.tsx (epub.js integration)
│   │   │   ├── ReaderControls.tsx (hidden UI, bottom-right menu)
│   │   │   ├── SettingsDrawer.tsx ("Aa" menu with typography settings)
│   │   │   ├── ProgressBar.tsx (bottom progress indicator)
│   │   │   ├── TapZones.tsx (invisible overlays for navigation)
│   │   │   ├── HighlightMenu.tsx (contextual menu on text selection)
│   │   │   ├── HighlightMarker.tsx (visual highlight rendering)
│   │   │   └── RecapModal.tsx (session resumption - Phase 3)
│   │   ├── ai/
│   │   │   ├── AISidebar.tsx (AI recap/summary - Phase 4)
│   │   │   ├── AIPopover.tsx (AI explanation - Phase 4)
│   │   │   └── MockAIResponse.tsx (placeholder AI content)
│   │   └── shared/
│   │       ├── ThemeToggle.tsx (Light/Dark/Sepia switcher)
│   │       ├── Button.tsx (reusable button component)
│   │       └── Modal.tsx (reusable modal)
│   ├── lib/
│   │   ├── db.ts (Dexie schema and helpers)
│   │   ├── epub-utils.ts (EPUB parsing utilities)
│   │   ├── session-tracker.ts (reading session logic)
│   │   ├── mock-ai.ts (mock AI responses - Phase 4)
│   │   └── constants.ts (colors, typography values)
│   ├── stores/
│   │   └── readerStore.ts (Zustand state)
│   ├── hooks/
│   │   ├── useEpubReader.ts (epub.js integration hook)
│   │   ├── useHighlighting.ts (text selection and highlights)
│   │   ├── useSessionTracking.ts (session start/end, position save)
│   │   └── useReadingStats.ts (calculate WPM, reading time)
│   └── types/
│       └── index.ts (TypeScript interfaces)
├── tests/
│   ├── e2e/
│   │   ├── epub-loading.spec.ts
│   │   ├── navigation.spec.ts
│   │   ├── highlighting.spec.ts
│   │   └── themes.spec.ts
│   └── fixtures/
│       └── sample.epub (test file)
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

### Key Components

#### EpubRenderer.tsx
**Responsibility**: Integrate epub.js, render book content, handle pagination
**Props**:
- `bookId: number` (load from DB)
- `onPageChange: (cfi: string, progress: number) => void`
- `onTextSelection: (text: string, cfiRange: string) => void`

**State**:
- epub.js `book` and `rendition` instances
- Current CFI (position)
- Total pages/progress

**Key Methods**:
- `loadBook()`: Fetch book file from DB, initialize epub.js
- `nextPage()`, `prevPage()`: Navigation
- `applyStyling()`: Inject CSS for theme, font size, line height
- `applyHighlights()`: Render saved highlights

#### HighlightMenu.tsx
**Responsibility**: Contextual menu on text selection (Highlight, Note, AI Explain)
**Props**:
- `selectedText: string`
- `cfiRange: string`
- `position: { x: number, y: number }`
- `onHighlight: (color: HighlightColor) => void`
- `onExplain: () => void`

**Appearance**: Popover near selection with 4 color buttons + "Explain" + "Note"

#### SettingsDrawer.tsx
**Responsibility**: Typography and theme controls
**Sections**:
- Theme toggle (Light/Dark/Sepia with visual indicators)
- Font size slider (14-24px, shows current value)
- Font family toggle (Serif/Sans-serif)
- Line height slider (1.2-1.8)
- Margins slider (1-4rem)
- "Reset to Defaults" button

**Placement**: Slide-in drawer from right on desktop, bottom sheet on mobile

#### RecapModal.tsx (Phase 3)
**Responsibility**: Session resumption with context recap
**Trigger**: Open book after >15 minutes away
**Content**:
- "It's been [time] since your last session"
- "Previously: [mock summary of last section]"
- "Continue Reading" button (dismisses and goes to last position)

**Mock Data** (Phase 4 will show real AI-generated recaps):
```typescript
const mockRecaps = {
  fiction: "You were reading Chapter 5, where [character] was confronting [conflict].",
  nonfiction: "You were reading about [topic], focusing on [key concept]."
};
```

---

## Phase Breakdown

## Phase 1: Core Reading Experience & EPUB Loading

**Objective**: Build the foundational reading interface with EPUB support, beautiful typography, and basic pagination.

**Duration**: 1.5-2 weeks (single developer)

### Deliverables

1. **Project Setup**
   - Initialize Next.js 14 project with TypeScript and Tailwind CSS
   - Configure Dexie.js for IndexedDB
   - Set up Zustand for state management
   - Install and configure epub.js

2. **Library View** (`/app/page.tsx`)
   - Empty state with "Upload EPUB" button
   - File upload component (accepts `.epub` files)
   - Save uploaded EPUB to IndexedDB with metadata extraction
   - Display books as grid of cards (cover image, title, author)
   - Click book → navigate to reader view

3. **Reader View** (`/app/read/[bookId]/page.tsx`)
   - Load book from IndexedDB by ID
   - Initialize epub.js `rendition` with pagination
   - Render book content in paginated view
   - Apply typography defaults (18px, 1.5 line height, serif, 65ch max-width)

4. **Basic Navigation**
   - Tap zones: left 15% = previous, center/right = next
   - Swipe gestures (left-to-right = previous, right-to-left = next)
   - Keyboard shortcuts (arrow keys, spacebar)

5. **Theme System**
   - Implement 3 themes (Light, Dark, Sepia) with exact color values from research:
     - Light: `#F9F9F9` bg, `#1A1A1A` text
     - Dark: `#121212` bg, `#E0E0E0` text
     - Sepia: `#FBF0D9` bg, `#5F4B32` text
   - Theme switcher in temporary top-right button (will move to settings drawer in Phase 2)
   - Persist theme preference in Zustand

6. **Typography Settings (Basic)**
   - Font size adjustment (14-24px slider)
   - Font family toggle (Serif/Sans-serif)
   - Persist settings in Zustand
   - Apply settings to epub.js rendition via CSS injection

### Files to Create

- `/src/app/page.tsx` (Library view)
- `/src/app/layout.tsx` (Root layout with theme provider)
- `/src/app/globals.css` (Tailwind + theme CSS variables)
- `/src/app/read/[bookId]/page.tsx` (Reader page)
- `/src/components/library/UploadButton.tsx`
- `/src/components/library/BookCard.tsx`
- `/src/components/library/BookGrid.tsx`
- `/src/components/library/EmptyState.tsx`
- `/src/components/reader/EpubRenderer.tsx`
- `/src/components/reader/TapZones.tsx`
- `/src/components/shared/ThemeToggle.tsx`
- `/src/lib/db.ts` (Dexie schema)
- `/src/lib/epub-utils.ts` (EPUB metadata extraction)
- `/src/lib/constants.ts` (Theme colors, typography defaults)
- `/src/stores/readerStore.ts` (Zustand state)
- `/src/hooks/useEpubReader.ts`
- `/tailwind.config.js` (Custom theme colors)
- `/next.config.js`

### Success Criteria

**Functional:**
- [ ] User can upload an EPUB file via Library view
- [ ] Uploaded book appears in Library with cover, title, author
- [ ] Clicking book opens Reader view and displays content
- [ ] Pagination works (tap/swipe/keyboard navigation)
- [ ] All 3 themes (Light/Dark/Sepia) apply correct colors
- [ ] Font size and family changes apply to rendered text
- [ ] Typography meets standards (18px default, 1.5 line height, 65ch max-width)

**Visual:**
- [ ] Text is crisp and readable on all 3 themes
- [ ] Line length is comfortable (not too wide) on desktop
- [ ] Margins are generous and symmetrical
- [ ] Dark theme uses `#121212`, not pure black
- [ ] Sepia theme matches Kindle standard (`#FBF0D9`, `#5F4B32`)

**Technical:**
- [ ] Book file and metadata stored in IndexedDB
- [ ] Theme and typography preferences persist across sessions
- [ ] No console errors or warnings
- [ ] Responsive: works on mobile (320px+) and desktop (1440px+)

### Testing Checkpoint (Playwright)

**Test scenarios:**
1. Upload EPUB → verify book appears in library
2. Open book → verify text renders with correct typography
3. Navigate pages → verify tap zones and swipe gestures work
4. Switch themes → verify colors change immediately
5. Adjust font size → verify text resizes correctly
6. Refresh page → verify theme persists

**Playwright test file**: `/tests/e2e/phase-1-core-reading.spec.ts`

**Example test:**
```typescript
import { test, expect } from '@playwright/test';

test('Phase 1: Core Reading Experience', async ({ page }) => {
  // Navigate to library
  await page.goto('http://localhost:3000');

  // Upload EPUB
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('tests/fixtures/sample.epub');

  // Wait for book to appear in library
  await expect(page.locator('text=Sample Book')).toBeVisible();

  // Open book
  await page.click('text=Sample Book');

  // Verify reader view loads
  await expect(page).toHaveURL(/\/read\/\d+/);
  await expect(page.locator('.epub-container')).toBeVisible();

  // Verify typography
  const textElement = page.locator('.epub-container p').first();
  await expect(textElement).toHaveCSS('font-size', '18px');
  await expect(textElement).toHaveCSS('line-height', '27px'); // 1.5 * 18

  // Test navigation (tap next page)
  await page.click('.epub-container', { position: { x: 500, y: 300 } }); // center tap
  await page.waitForTimeout(500); // Wait for page turn animation

  // Test theme switching
  await page.click('[data-testid="theme-toggle"]');
  await page.click('text=Dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
});
```

### Implementation Notes

**EPUB.js Integration:**
- Use `flow: 'paginated'` for book-like pagination
- Inject custom CSS for themes via `rendition.themes.register()`
- Handle CFI (Canonical Fragment Identifier) for position tracking
- Extract cover image using `book.coverUrl()`
- Parse metadata using `book.loaded.metadata`

**Responsive Design:**
- Desktop: max-width 65ch for reading column, centered
- Mobile: max-width 40ch, narrower margins (1rem)
- Use Tailwind breakpoints: `sm:`, `md:`, `lg:`

**Theme CSS Variables:**
```css
/* globals.css */
:root {
  --bg-light: #F9F9F9;
  --text-light: #1A1A1A;
  --bg-dark: #121212;
  --text-dark: #E0E0E0;
  --bg-sepia: #FBF0D9;
  --text-sepia: #5F4B32;
}

body.theme-light {
  background: var(--bg-light);
  color: var(--text-light);
}

body.theme-dark {
  background: var(--bg-dark);
  color: var(--text-dark);
}

body.theme-sepia {
  background: var(--bg-sepia);
  color: var(--text-sepia);
}
```

**Estimated Time Breakdown:**
- Project setup and configuration: 4 hours
- Library view (upload, display books): 8 hours
- Reader view (epub.js integration, rendering): 12 hours
- Navigation (tap zones, swipes, keyboard): 6 hours
- Theme system (3 themes, switcher, persistence): 6 hours
- Typography settings (sliders, application): 6 hours
- Responsive styling and polish: 8 hours
- Testing and bug fixes: 10 hours
- **Total: ~60 hours (1.5-2 weeks)**

---

## Phase 2: Highlighting & Session Management

**Objective**: Add text highlighting with notes, session tracking, and reading position persistence.

**Duration**: 1-1.5 weeks

### Deliverables

1. **Text Selection & Highlighting**
   - Enable text selection in epub.js rendition
   - Show contextual menu on text selection (HighlightMenu)
   - 4 highlight colors: yellow (default), blue, orange, pink
   - Apply highlights to rendition using `rendition.annotations.add()`
   - Save highlights to IndexedDB with CFI range, text, color, timestamp

2. **Highlight Management**
   - Load highlights from DB on book open
   - Render saved highlights in epub.js rendition
   - Tap highlight → show menu (Change Color, Add Note, Delete)
   - Highlight library view (sidebar or separate page)
   - Filter highlights by color

3. **Note-Taking**
   - "Add Note" button in highlight menu
   - Inline note editor (textarea, autofocus)
   - Save note to highlight record in DB
   - Display note icon on highlighted text
   - Tap note icon → show note in popover

4. **Session Tracking**
   - Create session record on book open (startTime, bookId)
   - Track pages read during session
   - Calculate reading speed (words per minute) from page turns and time
   - End session on book close (save endTime, pagesRead, avgSpeed)
   - Store sessions in IndexedDB

5. **Reading Position Persistence**
   - Save current CFI (position) to DB on every page turn
   - On book open, load last position and resume there
   - Show "Resume Reading" indicator if book was previously opened
   - Update `lastOpenedAt` timestamp on book record

6. **UI Enhancements**
   - Move theme toggle into Settings Drawer (replace temporary button)
   - Add Settings Drawer with full typography controls (line height, margins)
   - Add persistent bottom-right menu button (hamburger icon)
   - Auto-hide controls after 3 seconds of inactivity
   - Tap screen → toggle controls visibility

### Files to Create

- `/src/components/reader/HighlightMenu.tsx`
- `/src/components/reader/HighlightMarker.tsx`
- `/src/components/reader/NoteEditor.tsx`
- `/src/components/reader/HighlightLibrary.tsx`
- `/src/components/reader/SettingsDrawer.tsx`
- `/src/components/reader/ReaderControls.tsx`
- `/src/hooks/useHighlighting.ts`
- `/src/hooks/useSessionTracking.ts`
- `/src/lib/session-tracker.ts`

### Files to Modify

- `/src/components/reader/EpubRenderer.tsx` (add highlighting, position saving)
- `/src/lib/db.ts` (add session methods)
- `/src/stores/readerStore.ts` (add showControls state)

### Success Criteria

**Functional:**
- [ ] User can select text and see highlight menu
- [ ] Highlighting text in any of 4 colors works correctly
- [ ] Highlights persist across sessions (saved to DB, loaded on reopen)
- [ ] User can add notes to highlights
- [ ] Notes display when tapping highlighted text
- [ ] Session starts on book open, ends on close
- [ ] Reading position saves on every page turn
- [ ] Book reopens at last-read position
- [ ] Settings drawer contains all typography controls
- [ ] Controls auto-hide after 3 seconds, reappear on tap

**Visual:**
- [ ] Highlight colors are subtle and neutral (not distracting)
- [ ] Highlight menu appears near selected text (not off-screen)
- [ ] Note editor is easy to use (autofocus, clear save/cancel)
- [ ] Settings drawer slides in smoothly (right side desktop, bottom mobile)
- [ ] Bottom-right menu button is persistent and discoverable

**Technical:**
- [ ] CFI ranges correctly identify highlight positions
- [ ] Highlights render correctly after pagination changes
- [ ] No performance issues with 100+ highlights
- [ ] Session data accurately calculates reading speed
- [ ] Position saves within 1 second of page turn

### Testing Checkpoint (Playwright)

**Test scenarios:**
1. Select text → verify highlight menu appears
2. Highlight text in yellow → verify highlight persists on page turn
3. Add note to highlight → verify note saves and displays
4. Close and reopen book → verify highlights and notes load correctly
5. Navigate to new page and close → verify position saves
6. Reopen book → verify opens at last position
7. Auto-hide controls → verify controls disappear after 3 seconds

**Playwright test file**: `/tests/e2e/phase-2-highlighting.spec.ts`

### Implementation Notes

**epub.js Highlighting:**
```javascript
// Add highlight
rendition.annotations.add(
  'highlight',
  cfiRange,
  {},
  (e) => { /* click callback */ },
  'highlight-class',
  { fill: 'yellow', 'fill-opacity': '0.3' }
);

// Remove highlight
rendition.annotations.remove(cfiRange, 'highlight');
```

**CFI Range Format:**
- CFI (Canonical Fragment Identifier) is EPUB standard for positions
- Example: `epubcfi(/6/4[chap01ref]!/4/2/16,/1:0,/1:20)`
- Use `rendition.getRange(cfiRange)` to get DOM range

**Session Tracking Logic:**
```typescript
// Start session
const session = {
  bookId: currentBookId,
  startTime: new Date(),
  pagesRead: 0,
  wordsRead: 0,
};
const sessionId = await db.sessions.add(session);

// Update on page turn
session.pagesRead += 1;
session.wordsRead += estimatedWordsOnPage;

// End session
await db.sessions.update(sessionId, {
  endTime: new Date(),
  pagesRead: session.pagesRead,
  wordsRead: session.wordsRead,
  avgSpeed: session.wordsRead / ((endTime - startTime) / 60000), // WPM
});
```

**Estimated Time Breakdown:**
- Text selection and highlight menu: 6 hours
- Highlight rendering and persistence: 8 hours
- Note-taking feature: 6 hours
- Highlight library and filtering: 6 hours
- Session tracking implementation: 6 hours
- Position persistence: 4 hours
- Settings drawer UI: 8 hours
- Auto-hide controls: 4 hours
- Testing and bug fixes: 8 hours
- **Total: ~56 hours (1-1.5 weeks)**

---

## Phase 3: UI Polish & Adaptive Tracking

**Objective**: Refine UX with progress indicators, session resumption modal, and passive reading analytics.

**Duration**: 1 week

### Deliverables

1. **Progress Indicators**
   - Bottom progress bar (fills left-to-right as user reads)
   - Progress percentage in settings menu ("23% complete")
   - Time remaining estimate ("5 minutes left in chapter")
   - Page/location info ("Page 42 of 150" or location number)

2. **Session Resumption Modal**
   - Detect time since last session (check `lastOpenedAt`)
   - If >15 minutes, show RecapModal before opening book
   - Modal content:
     - "It's been [time] since your last session"
     - "Previously: [mock summary]"
     - "Continue Reading" button
   - Mock recap data for Phase 3 (hardcoded based on book genre)

3. **Reading Analytics (Passive Tracking)**
   - Track page turn cadence (time between page turns)
   - Calculate average reading speed per session
   - Detect slowdowns (page turn >2x average time)
   - Store analytics in Session records
   - Mark "friction zones" (pages where user slowed significantly)
   - No UI for analytics yet (data collection only for Phase 4 AI features)

4. **Onboarding Flow**
   - First-time user tutorial (overlay with hints)
   - Explain tap zones ("Tap here to turn page")
   - Explain hidden controls ("Tap to show menu")
   - Explain themes ("Try different reading modes")
   - Skip button / "Don't show again" checkbox

5. **Microinteractions & Polish**
   - Page turn animation (subtle fade or slide)
   - Theme transition animation (smooth color fade, not jarring)
   - Highlight color animation (gentle opacity transition)
   - Settings drawer slide-in animation (ease-out)
   - Button hover states (scale, color change)
   - Loading states (skeleton screens for book loading)

6. **Accessibility**
   - Keyboard navigation (Tab, Enter, Escape)
   - ARIA labels on interactive elements
   - Focus indicators on buttons and inputs
   - Reduced motion preference support (prefers-reduced-motion)

### Files to Create

- `/src/components/reader/ProgressBar.tsx`
- `/src/components/reader/RecapModal.tsx`
- `/src/components/reader/OnboardingOverlay.tsx`
- `/src/hooks/useReadingStats.ts`
- `/src/lib/analytics.ts` (reading speed calculations)
- `/src/lib/mock-recap-data.ts` (hardcoded recaps)

### Files to Modify

- `/src/components/reader/EpubRenderer.tsx` (add progress tracking, slowdown detection)
- `/src/hooks/useSessionTracking.ts` (add analytics)
- `/src/app/read/[bookId]/page.tsx` (add RecapModal, onboarding)

### Success Criteria

**Functional:**
- [ ] Progress bar accurately reflects reading position
- [ ] Time remaining estimate is reasonable (±2 minutes)
- [ ] Recap modal appears when reopening after >15 minutes
- [ ] User can dismiss recap and resume reading
- [ ] Onboarding appears on first book open
- [ ] Onboarding can be skipped or completed
- [ ] Reading analytics capture page turn times
- [ ] Slowdowns are detected and recorded

**Visual:**
- [ ] Progress bar is subtle (1-2px height, primary color)
- [ ] Page turn animation is smooth (not distracting)
- [ ] Theme transitions don't flash or flicker
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Recap modal is easy to read (clear typography, adequate spacing)

**Accessibility:**
- [ ] All interactive elements are keyboard-accessible
- [ ] Focus indicators are visible
- [ ] ARIA labels provide context for screen readers
- [ ] Color contrast meets WCAG AA standards (4.5:1 for normal text)

### Testing Checkpoint (Playwright)

**Test scenarios:**
1. Read through book → verify progress bar updates
2. Close and reopen after 16 minutes → verify recap modal appears
3. First-time user flow → verify onboarding displays
4. Keyboard navigation → Tab through controls, Enter to activate
5. Reduced motion → verify animations are disabled
6. Slowdown detection → Read page slowly, verify analytics record it

**Playwright test file**: `/tests/e2e/phase-3-polish.spec.ts`

### Implementation Notes

**Progress Calculation:**
```typescript
// Calculate progress percentage
const progress = (currentLocation / totalLocations) * 100;

// Estimate time remaining
const wordsRemaining = totalWords - wordsRead;
const timeRemaining = wordsRemaining / avgWordsPerMinute; // minutes
```

**Slowdown Detection:**
```typescript
// Track page turn times
const pageTurnTimes: number[] = [];
let lastTurnTime = Date.now();

function onPageTurn() {
  const now = Date.now();
  const timeSinceLastTurn = now - lastTurnTime;
  pageTurnTimes.push(timeSinceLastTurn);

  // Calculate average
  const avgTime = pageTurnTimes.reduce((a, b) => a + b) / pageTurnTimes.length;

  // Detect slowdown (>2x average)
  if (timeSinceLastTurn > avgTime * 2) {
    console.log('Slowdown detected at CFI:', currentCFI);
    // Mark friction zone (Phase 4 will use this data)
  }

  lastTurnTime = now;
}
```

**Recap Modal Mock Data:**
```typescript
// mock-recap-data.ts
export const mockRecaps = {
  fiction: [
    "You were reading Chapter 5, where {character} was confronting {conflict}.",
    "Previously: {character} discovered {revelation} and must now decide {choice}.",
  ],
  nonfiction: [
    "You were exploring {topic}, focusing on {concept}.",
    "Last session covered {section}, discussing {key-idea}.",
  ],
};

export function getRecapForBook(bookId: number, genre: string): string {
  const templates = mockRecaps[genre] || mockRecaps.fiction;
  const template = templates[Math.floor(Math.random() * templates.length)];
  // In Phase 4, this will be replaced with real AI-generated recaps
  return template;
}
```

**Estimated Time Breakdown:**
- Progress indicators: 6 hours
- Session resumption modal: 6 hours
- Reading analytics implementation: 8 hours
- Onboarding flow: 8 hours
- Microinteractions and animations: 8 hours
- Accessibility enhancements: 6 hours
- Testing and bug fixes: 8 hours
- **Total: ~50 hours (1 week)**

---

## Phase 4: Mock AI Features & PWA

**Objective**: Demonstrate AI features with mock data and make the app installable as a PWA.

**Duration**: 1-1.5 weeks

### Deliverables

1. **Mock AI Recap (Document-Level)**
   - "AI Recap" button in settings menu
   - Opens sidebar with mock recap content
   - Recap shows:
     - "Session Summary" (mock: "You read 15 pages in 23 minutes")
     - "What You Read" (mock: chapter summary)
     - "Key Points" (mock: 3-4 bullet points)
   - Visual distinction: light blue background, "AI Generated" label, sparkle icon
   - Dismissible sidebar (doesn't block reading)

2. **Mock AI Explanation (Selection-Level)**
   - "Explain" option in highlight menu (alongside colors, note)
   - Select text → Explain → opens inline popover with mock explanation
   - Popover shows:
     - "AI Explanation" header
     - Mock explanation text (simplified paraphrase)
     - "Save to Note" button (saves explanation as note on highlight)
   - Visual distinction: light blue tint, italic text, AI icon

3. **Mock AI Summarization**
   - "Summarize Chapter" button in settings menu
   - Opens sidebar with mock chapter summary
   - Summary shows:
     - Chapter title and number
     - 3-5 sentence summary (mock)
     - Key themes or concepts (mock bullet points)
   - Same visual styling as recap

4. **Mock Data Generation**
   - Create `/src/lib/mock-ai.ts` with functions:
     - `generateRecap(bookId: number, sessionData: Session): string`
     - `generateExplanation(selectedText: string): string`
     - `generateSummary(chapter: string, content: string): string`
   - Mock data should be contextually plausible (not "Lorem ipsum")
   - Use book metadata (genre) to vary responses
   - Example: Fiction → character-focused; Non-fiction → concept-focused

5. **PWA Implementation**
   - Create `/public/manifest.json` with app metadata
   - Add app icons (192x192, 512x512) to `/public/icons/`
   - Create service worker `/public/sw.js` for offline support
   - Register service worker in app layout
   - Add "Add to Home Screen" prompt for mobile users
   - Test installability on iOS (Safari) and Android (Chrome)

6. **Offline Support**
   - Cache static assets (JS, CSS, fonts) in service worker
   - Cache book files after first load
   - Show "Offline" indicator when no network
   - Allow reading cached books offline
   - Sync highlights/sessions when back online (optional for v0.1)

### Files to Create

- `/src/components/ai/AISidebar.tsx`
- `/src/components/ai/AIPopover.tsx`
- `/src/components/ai/MockAIResponse.tsx`
- `/src/lib/mock-ai.ts`
- `/public/manifest.json`
- `/public/sw.js`
- `/public/icons/icon-192.png`
- `/public/icons/icon-512.png`

### Files to Modify

- `/src/components/reader/HighlightMenu.tsx` (add "Explain" button)
- `/src/components/reader/SettingsDrawer.tsx` (add AI buttons)
- `/src/app/layout.tsx` (register service worker)
- `/next.config.js` (PWA configuration)

### Success Criteria

**Functional:**
- [ ] "AI Recap" button shows sidebar with mock recap
- [ ] "Explain" on selected text shows popover with mock explanation
- [ ] "Summarize Chapter" shows sidebar with mock summary
- [ ] All AI content is clearly labeled "AI Generated"
- [ ] AI content is dismissible without affecting reading position
- [ ] App can be installed as PWA on iOS and Android
- [ ] Installed PWA has correct icon and name
- [ ] App works offline (can read cached books)

**Visual:**
- [ ] AI content has consistent visual distinction (light blue, icon, label)
- [ ] AI sidebar slides in smoothly from right
- [ ] AI popover appears near selected text (not off-screen)
- [ ] AI content is easy to read (adequate spacing, typography)
- [ ] "AI Generated" label is prominent but not distracting

**Technical:**
- [ ] Mock AI responses are contextually plausible
- [ ] Service worker caches assets correctly
- [ ] PWA manifest validates (Chrome DevTools)
- [ ] App passes Lighthouse PWA audit (score >80)
- [ ] Offline mode works (disconnect network, reload app)

### Testing Checkpoint (Playwright)

**Test scenarios:**
1. Click "AI Recap" → verify sidebar appears with mock content
2. Select text → Explain → verify popover shows explanation
3. Click "Summarize Chapter" → verify summary displays
4. Verify all AI content is labeled "AI Generated"
5. Install as PWA → verify app installs and icon appears
6. Open PWA → verify app loads correctly
7. Disconnect network → verify cached book loads

**Playwright test file**: `/tests/e2e/phase-4-ai-pwa.spec.ts`

**PWA Testing:**
- Use Chrome DevTools → Application → Manifest (verify manifest loads)
- Use Chrome DevTools → Application → Service Workers (verify SW registers)
- Run Lighthouse audit (PWA category should score >80)
- Test on real mobile device (iOS Safari, Android Chrome)

### Implementation Notes

**Mock AI Response Examples:**

```typescript
// mock-ai.ts

export function generateRecap(bookId: number, sessionData: Session): string {
  const timeRead = Math.floor((sessionData.endTime - sessionData.startTime) / 60000);
  const pagesRead = sessionData.pagesRead;

  return `
**Session Summary**
You read ${pagesRead} pages in ${timeRead} minutes.

**What You Read**
In this session, you explored key concepts about [topic]. The author discussed [main idea] and provided examples of [supporting details].

**Key Points**
- [Point 1]: The main argument was that [explanation]
- [Point 2]: Evidence showed [supporting fact]
- [Point 3]: This connects to earlier chapters about [reference]
  `.trim();
}

export function generateExplanation(selectedText: string): string {
  // In real implementation, this would call GPT-4/Claude
  // For mock, provide plausible simplified explanation

  if (selectedText.length < 50) {
    return `"${selectedText}" refers to [simple definition]. It's commonly used to describe [context].`;
  } else {
    return `This passage discusses [main idea]. In simpler terms, the author is saying [paraphrase]. The key concept here is [explanation].`;
  }
}

export function generateSummary(chapter: string, content: string): string {
  return `
**${chapter}**

This chapter covers [main topic]. The author begins by explaining [introduction], then moves on to discuss [development]. Key themes include [theme 1], [theme 2], and [theme 3].

**Key Concepts**
- [Concept 1]: [Explanation]
- [Concept 2]: [Explanation]
- [Concept 3]: [Explanation]

The chapter concludes by [conclusion].
  `.trim();
}
```

**PWA Manifest:**

```json
{
  "name": "Adaptive Reader",
  "short_name": "Reader",
  "description": "A serene, intelligent e-reading experience",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F9F9F9",
  "theme_color": "#1A1A1A",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Service Worker (Basic):**

```javascript
// sw.js
const CACHE_NAME = 'adaptive-reader-v1';
const urlsToCache = [
  '/',
  '/globals.css',
  // Add other static assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

**Register Service Worker:**

```typescript
// app/layout.tsx
useEffect(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => console.log('SW registered'))
      .catch((error) => console.log('SW registration failed', error));
  }
}, []);
```

**Estimated Time Breakdown:**
- Mock AI recap sidebar: 6 hours
- Mock AI explanation popover: 6 hours
- Mock AI summarization: 4 hours
- Mock data generation functions: 6 hours
- PWA manifest and icons: 4 hours
- Service worker implementation: 8 hours
- Offline support and caching: 8 hours
- PWA testing on devices: 6 hours
- Bug fixes and polish: 8 hours
- **Total: ~56 hours (1-1.5 weeks)**

---

## Progress Tracking Document

**Purpose**: Track implementation status across all phases.

**Location**: `/thoughts/implementation-details/2025-11-09-adaptive-reader-progress.md`

**Template:**

```markdown
# Implementation Progress: Adaptive Reader v0.1

## Phase 1: Core Reading Experience & EPUB Loading
**Status**: ⏳ In Progress / ✅ Complete / ❌ Blocked
**Started**: [Date]
**Completed**: [Date]

### Checklist
- [ ] Project setup (Next.js, TypeScript, Tailwind)
- [ ] Library view with EPUB upload
- [ ] Reader view with epub.js integration
- [ ] Pagination (tap/swipe/keyboard)
- [ ] 3 themes (Light/Dark/Sepia)
- [ ] Typography settings (font size, family)
- [ ] Responsive design (mobile + desktop)
- [ ] Playwright tests pass

**Notes**: [Any blockers, decisions, or learnings]

---

## Phase 2: Highlighting & Session Management
**Status**: ⏳ Pending
**Started**: [Date]
**Completed**: [Date]

### Checklist
- [ ] Text selection and highlight menu
- [ ] 4 highlight colors (yellow/blue/orange/pink)
- [ ] Highlight persistence (save to IndexedDB)
- [ ] Note-taking on highlights
- [ ] Session tracking (start/end, reading speed)
- [ ] Position persistence (resume at last page)
- [ ] Settings drawer (full typography controls)
- [ ] Auto-hide controls
- [ ] Playwright tests pass

**Notes**:

---

## Phase 3: UI Polish & Adaptive Tracking
**Status**: ⏳ Pending
**Started**: [Date]
**Completed**: [Date]

### Checklist
- [ ] Progress indicators (bar, percentage, time remaining)
- [ ] Recap modal on session resumption
- [ ] Reading analytics (page turn cadence, slowdowns)
- [ ] Onboarding flow for first-time users
- [ ] Microinteractions (animations, transitions)
- [ ] Accessibility (keyboard nav, ARIA, reduced motion)
- [ ] Playwright tests pass

**Notes**:

---

## Phase 4: Mock AI Features & PWA
**Status**: ⏳ Pending
**Started**: [Date]
**Completed**: [Date]

### Checklist
- [ ] Mock AI recap sidebar
- [ ] Mock AI explanation popover
- [ ] Mock AI chapter summarization
- [ ] Mock data generation functions
- [ ] PWA manifest and icons
- [ ] Service worker for offline support
- [ ] App installable on iOS and Android
- [ ] Playwright + PWA tests pass

**Notes**:

---

## Overall Status
- **Phases Complete**: 0 / 4
- **Estimated Time Remaining**: 4-6 weeks
- **Blockers**: [List any blockers]
- **Next Steps**: [What to work on next]
```

---

## Testing Strategy

### Unit Tests (Optional for v0.1)
- Use Vitest or Jest for utility function tests
- Test: mock AI generation, reading speed calculations, CFI parsing
- Priority: Low (focus on E2E for MVP)

### Integration Tests (Playwright - Primary)
**Why Playwright for this project:**
- Can test file upload (EPUB loading)
- Supports mobile emulation (responsive testing)
- Can test PWA installation
- Visual regression testing (themes, typography)
- User has Playwright MCP available

**Test Coverage:**
- Phase 1: EPUB loading, navigation, themes, typography
- Phase 2: Highlighting, note-taking, session tracking, position persistence
- Phase 3: Progress indicators, recap modal, onboarding, accessibility
- Phase 4: Mock AI features, PWA installation, offline mode

**Test Structure:**
```typescript
// tests/e2e/reader.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Adaptive Reader E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('Complete user flow: Upload → Read → Highlight → Resume', async ({ page }) => {
    // Upload EPUB
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/sample.epub');
    await expect(page.locator('text=Sample Book')).toBeVisible();

    // Open book
    await page.click('text=Sample Book');
    await expect(page).toHaveURL(/\/read\/\d+/);

    // Navigate pages
    await page.click('.epub-container'); // Next page
    await page.waitForTimeout(500);

    // Highlight text
    await page.locator('.epub-container p').first().dblclick();
    await page.click('button:has-text("Highlight")');
    await page.click('[data-color="yellow"]');

    // Close and reopen
    await page.goto('http://localhost:3000');
    await page.click('text=Sample Book');

    // Verify position restored and highlight persists
    // ... assertions
  });
});
```

**When to Run Tests:**
- After completing each phase deliverable
- Before marking phase as "complete"
- Before merging to main branch
- Before any release/deployment

### Manual Testing Checklist
**Phase 1:**
- [ ] Upload EPUB with missing metadata → verify defaults used
- [ ] Upload very large EPUB (>10MB) → verify performance
- [ ] Navigate to last page → verify "Next" doesn't break
- [ ] Switch themes rapidly → verify no flashing
- [ ] Adjust font size to extremes (14px, 24px) → verify readability

**Phase 2:**
- [ ] Highlight 100+ passages → verify no slowdown
- [ ] Highlight across page boundary → verify CFI range correct
- [ ] Delete highlight while viewing → verify removes immediately
- [ ] Close app mid-session → verify session ends gracefully
- [ ] Open multiple books → verify positions don't conflict

**Phase 3:**
- [ ] Read for exactly 15 minutes, close, reopen → verify recap appears
- [ ] Skip onboarding → verify never shows again
- [ ] Disable animations (OS setting) → verify reduced motion works
- [ ] Tab through all controls → verify keyboard nav complete

**Phase 4:**
- [ ] Request AI explanation on 1-word selection → verify response plausible
- [ ] Request recap with 0 pages read → verify handles gracefully
- [ ] Install PWA, disconnect internet → verify book loads
- [ ] Test on iOS Safari, Android Chrome → verify install works

---

## Risk Assessment & Mitigation

### Risk 1: epub.js Compatibility with Next.js SSR
**Likelihood**: Medium
**Impact**: High
**Risk**: epub.js may have issues with server-side rendering (expects `window`, `document`)

**Mitigation:**
- Use dynamic import with `ssr: false`:
  ```typescript
  const EpubRenderer = dynamic(() => import('./EpubRenderer'), { ssr: false });
  ```
- Initialize epub.js only in `useEffect` (client-side)
- Test early in Phase 1 to catch issues

### Risk 2: EPUB Files with Complex Layouts
**Likelihood**: Medium
**Impact**: Medium
**Risk**: Some EPUBs have embedded CSS, fixed layouts, or multimedia that may not render correctly

**Mitigation:**
- Test with diverse EPUB files (fiction, textbooks, magazines)
- Provide "Report Issue" button for users to flag problematic books
- Document known limitations in README
- Consider EPUB validation tool in future version

### Risk 3: Mobile Performance with Large EPUBs
**Likelihood**: Low
**Impact**: Medium
**Risk**: Large EPUB files (>50MB) may cause memory issues on mobile browsers

**Mitigation:**
- Test with large files on real mobile devices (not just emulators)
- Implement lazy loading of chapters (epub.js supports this)
- Show loading indicator during book parsing
- Set file size limit (recommend <100MB) in UI

### Risk 4: IndexedDB Quota Limits
**Likelihood**: Low
**Impact**: Low
**Risk**: Browsers have storage quotas; users with many books may hit limits

**Mitigation:**
- Monitor storage usage with `navigator.storage.estimate()`
- Show warning when approaching 80% of quota
- Provide "Clear Library" option to free space
- Document storage requirements (~5MB per typical book)

### Risk 5: PWA Installation Friction on iOS
**Likelihood**: Medium
**Impact**: Low
**Risk**: iOS Safari has limited PWA support; "Add to Home Screen" is not automatic

**Mitigation:**
- Show iOS-specific instructions ("Tap Share → Add to Home Screen")
- Detect iOS Safari and show tutorial overlay
- Accept that iOS users may just use browser (not critical for v0.1)
- Test on real iPhone device

### Risk 6: Time Estimates Are Optimistic
**Likelihood**: High
**Impact**: Medium
**Risk**: Developer may encounter unexpected issues, increasing timeline

**Mitigation:**
- Build in 30% buffer to all estimates (already included)
- Prioritize ruthlessly (cut features if running late)
- Focus on Phase 1 and 2 first (core functionality)
- Phase 4 (AI/PWA) can be deferred if needed

---

## 0.1 Roadmap: What's Next After First Version

**Purpose**: After completing Phase 4, this document will outline the path to full v0.1 spec.

**Location**: `/thoughts/plans/2025-XX-XX-adaptive-reader-v0-1-roadmap.md`

**Contents to Include:**

### 1. Real AI Integration
**What's Missing**: Currently using mock data; need real API calls
**Required Work:**
- Choose AI provider (OpenAI GPT-4o or Anthropic Claude 3.5 Sonnet)
- Implement API integration layer
- Design prompts for recap, summarization, explanation
- Handle API rate limits and errors
- Privacy: Anonymize excerpts, don't send full books
- Cost management: Estimate and monitor API usage
- Caching: Store AI responses to reduce repeat calls

**Estimated Effort**: 1-2 weeks

### 2. Advanced Adaptive Behaviors
**What's Missing**: Currently just tracking data; need intervention logic
**Required Work:**
- Implement slowdown detection → offer explanation/summary
- Implement reread detection → offer recap or "Back to [position]"
- Implement speed variance analysis → detect "pleasure" vs "study" mode
- Implement inactivity triggers → optional recap prompts
- Design intervention timing (JITAI framework from research)
- A/B test intervention effectiveness

**Estimated Effort**: 2-3 weeks

### 3. Reading Modes (Pleasure / Instrumental / Aspirational)
**What's Missing**: Currently one-size-fits-all; need mode detection
**Required Work:**
- Infer mode from behavior (speed, highlights, rereads)
- Adjust AI responses per mode (recap for pleasure, summary for instrumental)
- UI indicators for detected mode (subtle, non-intrusive)
- Allow manual mode selection (override inference)

**Estimated Effort**: 1-2 weeks

### 4. Multi-Device Sync (Optional Cloud Sync)
**What's Missing**: Currently local-only; no cross-device sync
**Required Work:**
- Choose backend (Supabase, Firebase, or custom)
- Implement auth (email/password, Google OAuth)
- Sync books, highlights, sessions, positions
- Conflict resolution (e.g., reading on two devices simultaneously)
- Privacy: Encrypted sync, opt-in only
- Offline-first: Use IndexedDB as source of truth, sync as backup

**Estimated Effort**: 3-4 weeks

### 5. Enhanced Library Management
**What's Missing**: Currently minimal library; no organization
**Required Work:**
- Collections/shelves (group books by topic, genre, status)
- Tags (user-defined, filterable)
- Search (by title, author, content)
- Sort (by title, author, date added, last opened, progress)
- Bulk actions (delete, tag, move to collection)
- Import from Kindle, Apple Books, Calibre

**Estimated Effort**: 2-3 weeks

### 6. Additional File Format Support
**What's Missing**: Currently EPUB only
**Options to Consider:**
- PDF support (react-pdf or pdf.js)
- Markdown files
- Plain text (.txt)
- Web articles (Reader mode for URLs)
- Audiobook integration (optional)

**Estimated Effort**: 1-2 weeks per format

### 7. Social/Sharing Features (Low Priority)
**What's Missing**: No social features (by design)
**Consider If Requested:**
- Export highlights as Markdown, PDF, or images
- Share quotes to social media (generate quote images)
- Integration with note-taking apps (Obsidian, Roam, Notion)
- Readwise integration for spaced repetition
- **Note**: Research showed users find in-app social distracting; keep external

**Estimated Effort**: 1-2 weeks

### 8. Performance & Scalability
**What's Missing**: Not optimized for large libraries (100+ books)
**Required Work:**
- Virtual scrolling for library view (react-window)
- Optimize IndexedDB queries (proper indexes)
- Lazy load book metadata (don't load all books at once)
- Service worker caching strategy refinement
- Bundle size optimization (code splitting, tree shaking)

**Estimated Effort**: 1 week

### 9. Accessibility & Internationalization
**What's Missing**: Basic accessibility, English-only
**Required Work:**
- Full screen reader support (semantic HTML, ARIA)
- Keyboard-only navigation (comprehensive shortcuts)
- High contrast themes (beyond Light/Dark/Sepia)
- Font options for dyslexia (OpenDyslexic, larger spacing)
- Multi-language UI (i18n with next-intl)
- RTL text support (Arabic, Hebrew)

**Estimated Effort**: 2-3 weeks

### 10. Analytics & Privacy Dashboard
**What's Missing**: Tracking data but no user-facing analytics
**Required Work:**
- Reading stats page (books read, time spent, pages turned, WPM)
- Habit tracking (reading frequency, time of day patterns)
- Comprehension indicators (highlight density, slowdowns)
- Privacy dashboard (show what data is stored, export, delete all)
- Data portability (export everything as JSON)

**Estimated Effort**: 1-2 weeks

---

**Total Estimated Effort to Full v0.1**: 15-25 additional weeks (3-6 months) beyond first version

**Priority Order** (recommended):
1. Real AI integration (core feature)
2. Advanced adaptive behaviors (spec fulfillment)
3. Multi-device sync (user request)
4. Enhanced library management (usability)
5. Performance optimization (required at scale)
6. Additional formats (nice-to-have)
7. Accessibility & i18n (important for broader audience)
8. Analytics dashboard (value-add)
9. Social/sharing (optional)

---

## Conclusion

This implementation plan provides a **phased, realistic roadmap** to build the Adaptive Reader v0.1 first version in **4-6 weeks**. Each phase is independently testable, builds on the previous phase, and delivers incremental value.

**Key Success Factors:**
- **UX-first approach**: Beautiful typography and distraction-free interface from Phase 1
- **Mock AI data**: Demonstrates vision without API complexity
- **Phased delivery**: Can stop after any phase and have working app
- **Clear testing criteria**: Playwright tests validate functionality
- **Documented decisions**: Tech stack choices backed by research rationale

**Next Steps:**
1. Review this plan with stakeholders
2. Set up project repository and development environment
3. Begin Phase 1 implementation
4. Use progress tracking document to monitor status
5. Run Playwright tests at end of each phase
6. Create 0.1 roadmap document after Phase 4 completion

**Questions or Changes:**
- If timeline is too aggressive, cut Phase 4 (AI/PWA can be v0.2)
- If specific features are critical, reprioritize phases
- If tech stack choices need adjustment, discuss before Phase 1 starts
