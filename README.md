# Adaptive Reader

A serene, intelligent e-reading experience that adapts to how you read.

## Phase 1: Core Reading Experience (v0.1.0-phase1)

This is the initial implementation of the Adaptive Reader focusing on the core reading experience with EPUB support, beautiful typography, and distraction-free interface.

### Features

**Library Management**
- Upload EPUB files to your personal library
- View books with cover images, titles, and authors
- Track when you last opened each book

**Reading Experience**
- Clean, paginated EPUB reader
- Three research-backed themes:
  - Light: #F9F9F9 background, #1A1A1A text
  - Dark: #121212 background (not pure black), #E0E0E0 text
  - Sepia: #FBF0D9 background (Kindle standard), #5F4B32 text

**Typography Controls**
- Font size: 14-24px (default 18px)
- Line height: 1.2-1.8 (default 1.5)
- Font family: Serif (Georgia) or Sans-serif
- Optimal line length: 65ch desktop, 40ch mobile

**Navigation**
- Tap zones: Left 15% = previous page, Center/Right = next page
- Swipe gestures: Swipe left/right to navigate
- Keyboard shortcuts: Arrow keys, PageUp/PageDown, Spacebar

**Data Persistence**
- Books stored in IndexedDB (local-only)
- Reading position saved automatically
- Theme and typography preferences persist across sessions

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **EPUB Parsing**: epub.js v0.3
- **Local Storage**: Dexie.js (IndexedDB wrapper)
- **State Management**: Zustand
- **Gestures**: react-swipeable

### Getting Started

#### Installation

```bash
npm install
```

#### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Build

```bash
npm run build
npm start
```

#### Type Checking

```bash
npm run type-check
```

### Usage

1. **Upload a Book**
   - Click "Upload EPUB" button on the library page
   - Select an .epub file from your device
   - The book will appear in your library with cover and metadata

2. **Read a Book**
   - Click on any book cover to open the reader
   - Tap the center of the screen to show/hide controls
   - Use tap zones or swipe gestures to navigate pages

3. **Customize Reading Experience**
   - Click the theme toggle in the top bar to switch between Light/Dark/Sepia
   - Click the settings icon (gear) to adjust typography:
     - Font size slider
     - Line height slider
     - Font family toggle (Serif/Sans-serif)
   - Click "Reset to Defaults" to restore original settings

4. **Resume Reading**
   - Your position is automatically saved as you read
   - Next time you open the book, you'll resume where you left off

### Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Library page
│   ├── layout.tsx         # Root layout with theme provider
│   ├── globals.css        # Global styles and theme CSS
│   └── reader/
│       └── [bookId]/
│           └── page.tsx   # Reader page
├── components/
│   ├── library/           # Library view components
│   │   ├── BookCard.tsx
│   │   ├── BookGrid.tsx
│   │   ├── EmptyState.tsx
│   │   └── UploadButton.tsx
│   ├── reader/            # Reader view components
│   │   ├── ReaderView.tsx
│   │   └── TapZones.tsx
│   └── shared/            # Shared components
│       ├── ThemeProvider.tsx
│       ├── ThemeToggle.tsx
│       └── TypographySettings.tsx
├── lib/                   # Utility functions
│   ├── db.ts             # Dexie database schema and helpers
│   ├── constants.ts      # Theme colors and typography defaults
│   └── epub-utils.ts     # EPUB parsing utilities
├── stores/                # Zustand state management
│   └── settingsStore.ts  # Settings (theme, typography, UI state)
├── hooks/                 # Custom React hooks
│   └── useEpubReader.ts  # epub.js integration hook
└── types/                 # TypeScript interfaces
    └── index.ts
```

### Success Criteria

**Functional Requirements**
- ✅ User can upload an EPUB file
- ✅ EPUB displays in library with cover and metadata
- ✅ Tapping book opens reader view
- ✅ Can navigate pages via tap zones and swipe gestures
- ✅ Can switch between Light/Dark/Sepia themes
- ✅ Can adjust font size, line height, font family
- ✅ Settings persist across sessions (localStorage)
- ✅ Reading position saves to IndexedDB

**Visual Requirements**
- ✅ Clean, minimal library interface
- ✅ Typography meets standards: 18px default, 1.5 line height, 65ch max-width
- ✅ Themes use exact research-backed colors
- ✅ Auto-hiding UI with smooth transitions
- ✅ Responsive on mobile and desktop

**Technical Requirements**
- ✅ Book file and metadata stored in IndexedDB
- ✅ Theme and typography preferences persist across sessions
- ✅ No console errors or warnings
- ✅ Page transitions smooth (<300ms)
- ✅ EPUB renders correctly (text, basic formatting)

### Known Limitations

- EPUB files must be valid EPUB 2 or EPUB 3 format
- Complex layouts (fixed-layout EPUBs, comics) may not render correctly
- No support for DRM-protected EPUBs
- Local-only storage (no cloud sync in Phase 1)
- No highlighting or annotations (coming in Phase 2)

### Next Steps (Phase 2)

- Text highlighting with 4 colors (yellow, blue, orange, pink)
- Note-taking on highlights
- Session tracking (reading speed, time spent)
- Settings drawer with full typography controls
- Auto-hiding UI implementation

### Contributing

This is a personal project implementing the Adaptive Reader spec. See `spec-v0.1.md` for the full product specification and `thoughts/plans/` for implementation details.

### License

Private project - All rights reserved.

---

**Built with research-backed design principles for optimal reading experience.**
