---
doc_type: research
date: 2025-11-12T01:23:48+00:00
title: "Comprehensive Feature Implementation Analysis"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-12T01:23:48+00:00"
research_question: "What features have been implemented in the Adaptive Reader codebase?"
research_type: codebase_research
researcher: Claude

git_commit: be794567d752c58e047e77bbe3e93fe7f16c142b
branch: claude/audit-vision-spec-v0.1-011CV37n5M5VfcUCpH2GTfAm
repository: best-reader

created_by: Claude
last_updated: 2025-11-12
last_updated_by: Claude

tags:
  - architecture
  - features
  - implementation
  - database
  - audio
  - tts
status: complete

related_docs: []
---

# Research: Comprehensive Feature Implementation Analysis

**Date**: 2025-11-12T01:23:48+00:00
**Researcher**: Claude
**Git Commit**: be794567d752c58e047e77bbe3e93fe7f16c142b
**Branch**: claude/audit-vision-spec-v0.1-011CV37n5M5VfcUCpH2GTfAm
**Repository**: best-reader

## Research Question

What features have been implemented in the Adaptive Reader codebase? Document all major features, the database schema, API integrations, and component organization to understand the current state of the application.

## Summary

The Adaptive Reader codebase is **significantly more feature-complete** than indicated by the PROGRESS.md document. The project has evolved well beyond "Phase 4" to include a comprehensive text-to-speech system with progressive audio streaming, sentence-level synchronization, Anna's Archive integration, and a full PWA implementation. The application is a Next.js 14 TypeScript project using epub.js for EPUB rendering, Dexie.js for IndexedDB storage, and OpenAI's TTS API for audio generation.

**Key Discovery**: The most recent git commit message mentions "Merge progressive audio streaming feature (Phases 1-4)", indicating substantial audio feature development that is not reflected in the main PROGRESS.md file.

## Detailed Findings

### 1. Project Architecture

**Tech Stack** ([package.json:1-38](file:///home/user/best-reader/package.json))
- **Framework**: Next.js 14.2.18 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4.1
- **State Management**: Zustand 4.5.5
- **Database**: Dexie.js 4.0.11 (IndexedDB wrapper)
- **EPUB Rendering**: epub.js 0.3.93
- **NLP**: compromise 14.14.4 (for sentence parsing)
- **AI**: OpenAI SDK 6.8.1
- **HTML Parsing**: Cheerio 1.1.2 (for Anna's Archive scraping)

**Directory Structure**:
- `/app` - Next.js pages and API routes (App Router)
- `/components` - React components organized by feature (reader/, library/, shared/)
- `/lib` - Core utilities (db.ts, annas-archive.ts, audio-sync.ts, sentence-parser.ts, etc.)
- `/hooks` - Custom React hooks (11 hooks total)
- `/stores` - Zustand stores (settingsStore.ts)
- `/types` - TypeScript type definitions
- `/public` - Static assets (manifest.json, sw.js, icons)
- `/thoughts` - Development documentation (53 markdown files: plans, implementation-details, reviews, research)

### 2. Core EPUB Reading Features

**EPUB Reader Implementation** ([components/reader/ReaderView.tsx:1-150](file:///home/user/best-reader/components/reader/ReaderView.tsx), [hooks/useEpubReader.ts](file:///home/user/best-reader/hooks/useEpubReader.ts))

**Features**:
- Paginated EPUB rendering with epub.js
- Three theme system: Light (#FAF9F7), Dark, Sepia ([lib/constants.ts](file:///home/user/best-reader/lib/constants.ts))
- Typography controls (font size 14-24px, font family serif/sans-serif, line height 1.2-1.8, margins 1-4rem)
- Tap zone navigation (left = previous page, right/center = next page)
- Swipe gesture support ([components/reader/TapZones.tsx](file:///home/user/best-reader/components/reader/TapZones.tsx))
- Auto-hiding UI with configurable delay
- Reading position persistence (CFI-based)
- Responsive design (mobile-first)

**Reader Settings** ([components/reader/SettingsDrawer.tsx](file:///home/user/best-reader/components/reader/SettingsDrawer.tsx))
- Accessible via drawer component
- All typography settings exposed
- Settings persist to localStorage
- Keyboard navigation support

### 3. Library Management

**Library Features** ([app/page.tsx:1-100](file:///home/user/best-reader/app/page.tsx), [components/library/](file:///home/user/best-reader/components/library/))

**Components**:
- `BookGrid.tsx` - Grid view of books with covers
- `BookCard.tsx` - Individual book display
- `UploadButton.tsx` - EPUB file upload
- `EmptyState.tsx` - First-time user guidance
- `OnboardingFlow.tsx` - Interactive first-run tutorial
- `SearchButton.tsx` & `SearchModal.tsx` - Anna's Archive search integration
- `SearchResultCard.tsx` - Search result display

**Book Storage** ([lib/db.ts:85-156](file:///home/user/best-reader/lib/db.ts))
- Books stored in IndexedDB with full file Blob
- Cover images extracted and stored as Blob
- Metadata: title, author, ISBN, tags, added date, last opened date
- Books sorted by last opened, then by added date (newest first)

### 4. Highlighting and Annotations

**Highlighting System** ([components/reader/HighlightMenu.tsx](file:///home/user/best-reader/components/reader/HighlightMenu.tsx), [hooks/useHighlights.ts](file:///home/user/best-reader/hooks/useHighlights.ts))

**Features**:
- Four highlight colors: Yellow (#FEF3C7), Blue (#DBEAFE), Orange (#FED7AA), Pink (#FCE7F3)
- Text selection via epub.js 'selected' event
- Contextual highlight menu (popover near selection)
- Note-taking on highlights ([components/reader/NoteEditor.tsx](file:///home/user/best-reader/components/reader/NoteEditor.tsx))
- Highlight library view ([components/library/HighlightList.tsx](file:///home/user/best-reader/components/library/HighlightList.tsx))
- Color filtering in highlight library
- Jump-to-location from highlights
- Persistent storage with CFI ranges

**Database Functions** ([lib/db.ts:200-248](file:///home/user/best-reader/lib/db.ts)):
- `addHighlight()`, `getHighlights()`, `getAllHighlights()`
- `getHighlightsByColor()`, `updateHighlight()`, `deleteHighlight()`

### 5. Session Tracking and Analytics

**Session Management** ([hooks/useSession.ts](file:///home/user/best-reader/hooks/useSession.ts), [lib/db.ts:250-306](file:///home/user/best-reader/lib/db.ts))

**Tracked Metrics**:
- Session start/end time
- Pages read per session
- Words read (estimated at 250 words/page)
- Average reading speed (words per minute)
- Listening time (for TTS audio)
- Current audio chapter

**Analytics Features** ([lib/analytics.ts](file:///home/user/best-reader/lib/analytics.ts), [lib/db.ts:308-376](file:///home/user/best-reader/lib/db.ts))

**Privacy-First Analytics** (all stored locally, never sent to server):
- Page turn events with timestamps
- Slowdown detection (>2x average turn time)
- Speed-up detection (<0.5x average turn time)
- Rolling average calculation (last 10 page turns)
- Reading insights: average turn time, slowdown count, total page turns
- Automatic cleanup of old analytics (90-day retention by default)

**Progress Indicators** ([components/reader/ProgressIndicators.tsx](file:///home/user/best-reader/components/reader/ProgressIndicators.tsx))
- Progress bar with percentage
- Pages read counter
- Time remaining estimate (based on current reading speed)
- Session duration display

**Recap System** ([components/reader/RecapModal.tsx](file:///home/user/best-reader/components/reader/RecapModal.tsx))
- Triggered when >15 minutes have passed since last session
- Shows last session summary (pages read, time spent, reading speed)
- Mock AI content for recap narrative (uses `lib/mockAi.ts`)

### 6. Database Schema (IndexedDB)

**Database Name**: `AdaptiveReaderDB` ([lib/db.ts:1-78](file:///home/user/best-reader/lib/db.ts))

**Schema Evolution** (5 versions tracking feature additions):

**Version 1** (Initial):
- `books` - Book metadata and file storage
- `positions` - Reading position (CFI, percentage, chapter)
- `sessions` - Reading sessions
- `highlights` - Text highlights with notes

**Version 2** (Phase 3 - Analytics):
- Added `analytics` - Reading analytics events

**Version 3** (TTS Phase 1):
- Added `chapters` - Chapter metadata (title, CFI range, word/char count, order)
- Added `audioFiles` - Generated TTS audio files
- Added `audioSettings` - Per-book audio preferences (voice, speed, autoplay)
- Added `audioUsage` - TTS generation cost tracking

**Version 4** (TTS Sentence Sync):
- Added `sentenceSyncData` - Sentence-level timing metadata for audio synchronization

**Version 5** (Progressive Audio Streaming):
- Added `audioChunks` - Progressive audio chunk storage for streaming playback

**Complete Schema Tables**:

1. **books**: `++id, title, author, addedAt, lastOpenedAt, *tags`
2. **positions**: `bookId (PK), updatedAt`
3. **sessions**: `++id, bookId, startTime, endTime`
4. **highlights**: `++id, bookId, cfiRange, color, createdAt`
5. **analytics**: `++id, sessionId, bookId, timestamp, event`
6. **chapters**: `++id, bookId, order, cfiStart`
7. **audioFiles**: `++id, chapterId, generatedAt`
8. **audioSettings**: `bookId (PK), updatedAt`
9. **audioUsage**: `++id, chapterId, bookId, timestamp`
10. **sentenceSyncData**: `++id, audioFileId, chapterId, generatedAt`
11. **audioChunks**: `++id, audioFileId, [audioFileId+chunkIndex], chunkIndex, generatedAt`

**Database Functions** (735 lines of helper functions in [lib/db.ts](file:///home/user/best-reader/lib/db.ts)):
- Book management (10 functions)
- Position management (2 functions)
- Highlight management (7 functions)
- Session management (6 functions)
- Analytics management (5 functions)
- Chapter management (3 functions)
- Audio file management (11 functions)
- Sentence sync management (3 functions)
- Audio chunk management (13 functions)

### 7. AI Features (Mock Implementation)

**Mock AI Module** ([lib/mockAi.ts:1-202](file:///home/user/best-reader/lib/mockAi.ts))

**AI Components**:
- `AiRecap.tsx` - Session recap sidebar with mock summary
- `AiExplanation.tsx` - Text explanation popover (selected passages)
- `AiChapterSummary.tsx` - Chapter summary modal

**Mock Functions**:
- `generateRecap(sessionData)` - Generates genre-aware session summary (fiction/nonfiction/technical)
- `generateExplanation(selectedText)` - Provides simplified explanations for complex passages
- `generateChapterSummary(chapterData)` - Overview with key themes and conclusion
- `generateDifficultySupport(context)` - Triggered by slowdown detection

**Visual Distinction**:
- AI content has blue tint background
- Clear labeling with "AI Generated" indicator
- Icon differentiation

**Note**: These are placeholder responses to demonstrate UX. The spec mentions future integration with OpenAI GPT-4 or Anthropic Claude for real AI features.

### 8. Audio Features (Text-to-Speech)

This is the **most significant implemented feature beyond the documented spec**.

#### 8.1 TTS Generation API

**Streaming TTS API** ([app/api/tts/generate-stream/route.ts:1-331](file:///home/user/best-reader/app/api/tts/generate-stream/route.ts))

**Features**:
- OpenAI TTS integration (tts-1 model)
- Six voice options: alloy, echo, fable, onyx, nova, shimmer
- Playback speed control (0.25x - 4.0x)
- Automatic chunking for long text (4096 character OpenAI limit)
- Sentence boundary detection for natural chunk breaks
- Server-Sent Events (SSE) for progress streaming
- Progressive chunk delivery (audio streams as it generates)
- Character count validation (100,000 character max per chapter)
- Input sanitization (control character removal)
- Cost calculation ($0.015 per 1,000 characters)

**API Events**:
- `progress` - Generation progress updates
- `audio_chunk` - Individual audio chunks as they complete
- `generation_complete` - Final metadata when all chunks done
- `result` - Complete audio data (backwards compatibility)
- `error` - Error handling with detailed messages

#### 8.2 Progressive Audio Streaming

**Progressive Audio Player** ([hooks/useProgressiveAudioPlayer.ts:1-559](file:///home/user/best-reader/hooks/useProgressiveAudioPlayer.ts))

**Architecture**:
- Web Audio API-based playback
- Gapless audio playback via AudioContext scheduling
- Chunk-based storage in IndexedDB (not single blob)
- Sliding window memory management (max 5 chunks in memory)
- Dynamic chunk loading during generation
- Automatic preloading (2 chunks ahead)

**Features**:
- Play/pause with proper AudioContext suspend/resume
- Real-time progress tracking (100ms interval)
- Chunk polling during generation (checks every 2 seconds for new chunks)
- Playback speed control (applies to all scheduled chunks)
- Memory-efficient (evicts chunks behind playback position)
- Playback during generation (can start listening before chapter completes)

**Limitations** (documented in code):
- Seeking not yet implemented (requires re-creating source nodes)
- Speed changes during playback may cause timing issues

#### 8.3 Sentence-Level Synchronization

**Sentence Parser** ([lib/sentence-parser.ts:1-120](file:///home/user/best-reader/lib/sentence-parser.ts))

**Features**:
- NLP-based sentence detection using compromise library
- Handles abbreviations (Dr., Mr., Mrs.)
- Handles ellipsis and quotes
- Handles numbers with decimals
- Returns sentence positions (startChar, endChar) in chapter text

**Audio Sync Module** ([lib/audio-sync.ts:1-140](file:///home/user/best-reader/lib/audio-sync.ts))

**Synchronization Strategy**:
- Linear interpolation based on character position
- `timestampToCFI()` - Maps audio time to EPUB CFI position
- `cfiToTimestamp()` - Maps EPUB position to audio time
- `isCFIInChapter()` - Checks if CFI is within chapter range
- `findChapterByCFI()` - Finds chapter containing given CFI

**Sentence Highlighter** ([lib/sentence-highlighter.ts](file:///home/user/best-reader/lib/sentence-highlighter.ts))
- Real-time sentence highlighting during audio playback
- Visual sync between audio and text position
- Integrated with progressive audio player

**Sentence Sync Hook** ([hooks/useSentenceSync.ts](file:///home/user/best-reader/hooks/useSentenceSync.ts))
- Manages sentence-level timing data
- Coordinates highlighter with audio playback

#### 8.4 Audio Components

**Audio Player Component** ([components/reader/AudioPlayer.tsx](file:///home/user/best-reader/components/reader/AudioPlayer.tsx))
- Standard audio player UI (for single-blob mode)
- Play/pause/seek controls
- Speed control
- Progress bar
- Time display (current/total)

**Chapter Audio Button** ([components/reader/ChapterAudioButton.tsx](file:///home/user/best-reader/components/reader/ChapterAudioButton.tsx))
- Per-chapter audio generation trigger
- Progress indicator during generation
- Chapter selection modal

**Audio Settings Panel** ([components/reader/AudioSettingsPanel.tsx](file:///home/user/best-reader/components/reader/AudioSettingsPanel.tsx))
- Voice selection (6 OpenAI voices)
- Playback speed control
- Auto-play toggle
- Settings persist per book

**Usage Dashboard** ([components/reader/UsageDashboard.tsx](file:///home/user/best-reader/components/reader/UsageDashboard.tsx))
- TTS generation cost tracking
- Character count statistics
- Usage history

**Chapter List** ([components/reader/ChapterList.tsx](file:///home/user/best-reader/components/reader/ChapterList.tsx))
- Navigate between chapters
- Shows which chapters have audio generated
- Jump to chapter in reading view

#### 8.5 Audio Generation Hooks

**useAudioGeneration** ([hooks/useAudioGeneration.ts](file:///home/user/best-reader/hooks/useAudioGeneration.ts))
- Manages TTS API calls
- Handles SSE event parsing
- Progress tracking (0-100%)
- Chunk storage to IndexedDB
- Error handling and retry logic

**useAudioPlayer** ([hooks/useAudioPlayer.ts](file:///home/user/best-reader/hooks/useAudioPlayer.ts))
- Standard audio player (single-blob mode)
- Play/pause/seek/speed controls
- Time tracking

**useProgressiveAudioPlayer** ([hooks/useProgressiveAudioPlayer.ts](file:///home/user/best-reader/hooks/useProgressiveAudioPlayer.ts))
- Progressive streaming audio player (chunk-based mode)
- Memory-efficient chunk management
- Gapless playback
- Dynamic loading during generation

**useAudioUsage** ([hooks/useAudioUsage.ts](file:///home/user/best-reader/hooks/useAudioUsage.ts))
- Track TTS costs per book
- Calculate total usage
- Query usage history

#### 8.6 Chapter Extraction

**useChapters Hook** ([hooks/useChapters.ts](file:///home/user/best-reader/hooks/useChapters.ts))
- Extracts chapter structure from EPUB navigation document
- Parses TOC (Table of Contents)
- Calculates word/character counts per chapter
- Determines chapter boundaries (cfiStart, cfiEnd)
- Handles nested chapters (level tracking)
- Stores chapters in IndexedDB

**Chapter Utilities** ([lib/epub-utils.ts](file:///home/user/best-reader/lib/epub-utils.ts))
- Helper functions for chapter metadata extraction
- CFI range calculations
- Text content extraction from EPUB sections

### 9. Anna's Archive Integration

**Anna's Archive Library** ([lib/annas-archive.ts:1-180](file:///home/user/best-reader/lib/annas-archive.ts))

**Features**:
- `searchAnnasArchive(query, format)` - Scrapes search results using Cheerio
- `downloadFromAnnasArchive(hash, apiKey)` - Downloads books via fast_download API
- Parses book metadata: title, author, publisher, language, format, size
- MD5 hash validation
- Timeout handling (30 seconds)
- EPUB format filtering

**Search API Route** ([app/api/books/search/route.ts:1-98](file:///home/user/best-reader/app/api/books/search/route.ts))

**Features**:
- Rate limiting (10 searches per minute per client)
- EPUB-only filtering (hardcoded format filter)
- Input validation (2-200 characters)
- Error categorization (timeout, network, validation, unknown)
- Retry-After header for rate limit responses

**Search UI** ([components/library/SearchModal.tsx](file:///home/user/best-reader/components/library/SearchModal.tsx), [components/library/SearchResultCard.tsx](file:///home/user/best-reader/components/library/SearchResultCard.tsx))
- Modal-based search interface
- Real-time search (debounced)
- Result display with metadata
- One-click download and add to library
- Error handling with user-friendly messages

**Download API Route** ([app/api/books/download/route.ts](file:///home/user/best-reader/app/api/books/download/route.ts))
- Proxies download requests through server
- Validates API key (from environment variable)
- Streams downloaded file to client

**Rate Limiter** ([lib/rate-limiter.ts](file:///home/user/best-reader/lib/rate-limiter.ts))
- In-memory rate limiting (IP-based)
- Configurable limits and windows
- Automatic cleanup of expired entries

### 10. PWA (Progressive Web App)

**PWA Implementation**:

**Manifest** ([public/manifest.json:1-27](file:///home/user/best-reader/public/manifest.json))
- Name: "Adaptive Reader"
- Display: standalone (no browser chrome)
- Orientation: portrait-primary
- Background: #F9F9F9
- Theme: #1A1A1A
- Categories: productivity, education, books
- Icons: SVG with maskable support

**Service Worker** ([public/sw.js:1-50](file:///home/user/best-reader/public/sw.js))
- Cache-first strategy
- Offline page support
- Static asset caching (manifest, icons, landing page)
- Cache versioning (adaptive-reader-v1)
- Automatic cache cleanup on activation
- Immediate client claiming

**PWA Register Component** ([components/shared/PWARegister.tsx](file:///home/user/best-reader/components/shared/PWARegister.tsx))
- Client-side service worker registration
- Update detection
- Install prompts

**Offline Support**:
- Offline page fallback
- IndexedDB for book/position/session storage (fully offline-capable)
- Service worker caches app shell

### 11. UI Component Organization

**Component Structure**:

**Reader Components** (`/components/reader/`):
- `ReaderView.tsx` - Main reader container (orchestrates all features)
- `TapZones.tsx` - Touch navigation areas
- `SettingsDrawer.tsx` - Settings sidebar
- `HighlightMenu.tsx` - Text highlight popover
- `NoteEditor.tsx` - Note-taking modal
- `ProgressIndicators.tsx` - Progress bar and stats
- `RecapModal.tsx` - Session recap overlay
- `AudioPlayer.tsx` - Standard audio player UI
- `ChapterAudioButton.tsx` - Audio generation trigger
- `AudioSettingsPanel.tsx` - Audio configuration
- `UsageDashboard.tsx` - TTS cost tracking
- `ChapterList.tsx` - Chapter navigation
- `AiRecap.tsx` - AI recap sidebar
- `AiExplanation.tsx` - AI explanation popover
- `AiChapterSummary.tsx` - AI chapter summary modal

**Library Components** (`/components/library/`):
- `BookGrid.tsx` - Book grid layout
- `BookCard.tsx` - Individual book card
- `UploadButton.tsx` - File upload
- `EmptyState.tsx` - Empty library state
- `OnboardingFlow.tsx` - First-run tutorial
- `SearchButton.tsx` - Search trigger
- `SearchModal.tsx` - Search interface
- `SearchResultCard.tsx` - Search result item
- `HighlightList.tsx` - Highlight library view

**Shared Components** (`/components/shared/`):
- `ThemeProvider.tsx` - Theme context
- `ThemeToggle.tsx` - Light/dark/sepia switcher
- `TypographySettings.tsx` - Font controls
- `LoadingSkeleton.tsx` - Loading states
- `ErrorBoundary.tsx` - Error handling
- `PWARegister.tsx` - Service worker registration

**Design System** ([lib/constants.ts](file:///home/user/best-reader/lib/constants.ts)):
- Theme colors defined
- Highlight colors (4 options)
- UI constants (auto-hide delays, animation durations)
- Typography defaults

### 12. Adaptive Behaviors

**Adaptive Features** ([lib/analytics.ts](file:///home/user/best-reader/lib/analytics.ts)):

**Implemented**:
- Slowdown detection (>2x average page turn time)
- Speed-up detection (<0.5x average turn time)
- Rolling average calculation (last 10 page turns)
- Session recap threshold (>15 minutes gap)

**Planned** (from spec but not yet implemented):
- Difficulty zone marking (passive data collection only)
- Reading mode inference (pleasure/instrumental/aspirational)
- Reread detection
- Adaptive recap behavior based on reading patterns

### 13. Reading Stats and Insights

**Reading Statistics Hook** ([hooks/useReadingStats.ts](file:///home/user/best-reader/hooks/useReadingStats.ts))

**Calculated Metrics**:
- Pages per minute
- Words per minute
- Time remaining (based on current pace)
- Session duration
- Progress percentage
- Total pages read in session

**Analytics Functions** ([lib/analytics.ts:1-162](file:///home/user/best-reader/lib/analytics.ts)):
- `calculateReadingSpeed()` - WPM calculation
- `calculateTimeRemaining()` - Estimated time to finish
- `formatTimeRemaining()` - Human-readable time formatting
- `formatSessionDuration()` - Session length formatting
- `calculatePagesPerMinute()` - Page turn rate
- `isSlowdown()` - Anomaly detection
- `isSpeedUp()` - Fast reading detection
- `calculateRollingAverage()` - Moving average calculation
- `shouldShowRecap()` - Recap trigger logic
- `formatRecapSummary()` - Session summary formatting

### 14. Accessibility Features

**Implemented Accessibility**:
- ARIA labels on all interactive elements
- Keyboard navigation support
- Focus management (modals, drawers)
- Semantic HTML structure
- Reduced motion support (respects `prefers-reduced-motion`)
- Screen reader compatibility
- High contrast themes (light/dark modes)

**Keyboard Shortcuts** (documented in components):
- Arrow keys for page navigation
- Space for page forward
- Escape to close modals/drawers
- Tab navigation through UI controls

### 15. Error Handling and Logging

**Error Boundary** ([components/shared/ErrorBoundary.tsx](file:///home/user/best-reader/components/shared/ErrorBoundary.tsx))
- React error boundary component
- Graceful error display
- Error logging

**Logger Utility** ([lib/logger.ts](file:///home/user/best-reader/lib/logger.ts))
- Structured logging
- Environment-aware (dev vs. production)

**Error Handling Patterns**:
- Try-catch blocks around database operations
- API error responses with categorization
- User-friendly error messages
- Retry logic for transient failures

### 16. Testing and Development Tools

**Development Scripts** ([package.json:5-11](file:///home/user/best-reader/package.json)):
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm start` - Production server
- `npm run lint` - ESLint
- `npm run type-check` - TypeScript validation

**Test Data** (`/test-data/` directory)
- Sample EPUB files for development
- Test scripts for sentence sync validation

**Sentence Sync Test Script** ([test-sentence-sync.ts](file:///home/user/best-reader/test-sentence-sync.ts))
- Validates sentence parser
- Tests timing calculations
- Manual testing utility

**Hack Scripts** (`/hack/` directory)
- `generate_frontmatter.sh` - Documentation frontmatter generator
- README for script usage

### 17. Documentation System

**Thoughts Directory** (`/thoughts/` - 53 markdown files)

**Categories**:
1. **Plans** (10 files) - Feature planning documents
2. **Implementation Details** (19 files) - Implementation progress tracking
3. **Reviews** (13 files) - Code review documents
4. **Research** (11 files) - Research and analysis documents

**Frontmatter System**:
- Consistent metadata using YAML frontmatter
- Schema defined in `.claude/FRONTMATTER_SCHEMA.md`
- Generation script for consistency
- Git integration (tracks commit, branch, repository)

**Notable Documentation**:
- Progressive audio streaming implementation (4 phases documented)
- Anna's Archive integration (4 phases documented)
- TTS feature development (5 phases documented)
- Sentence-level synchronization research and implementation
- Comprehensive code reviews for each phase

### 18. Features NOT Implemented (from spec-v0.1.md)

Based on comparison with [spec-v0.1.md](file:///home/user/best-reader/spec-v0.1.md):

**Not Yet Implemented**:
1. **Real AI Integration** - Currently using mock AI responses
2. **Cloud Sync** - No Supabase/Firebase integration yet
3. **Multi-device Sync** - All data is local-only
4. **Advanced Adaptive Triggers** - Difficulty detection collects data but doesn't surface interventions
5. **Reading Mode Inference** - Pleasure/instrumental/aspirational modes not implemented
6. **Spaced Repetition** - No flashcard system for highlights
7. **Reading Habit Analytics Dashboard** - No weekly/monthly reports
8. **Social Features** - No sharing, reading groups, or recommendations
9. **Export Functionality** - Can't export highlights/notes to Markdown/PDF
10. **Import from Other Services** - No Kindle/Apple Books import
11. **Background Sync** - PWA background sync not implemented
12. **Push Notifications** - No reading reminders

**Partially Implemented**:
- **Adaptive Behaviors** - Slowdown detection works but doesn't trigger interventions
- **Recap System** - Works but uses mock AI instead of real content analysis

### 19. Undocumented Features (Beyond Spec)

**Features Present in Code but Not in spec-v0.1.md**:

1. **Progressive Audio Streaming** - Entire chunk-based architecture for memory-efficient TTS playback
2. **Sentence-Level Synchronization** - Visual highlighting synced with audio playback
3. **Anna's Archive Integration** - Full search and download capability
4. **Usage Dashboard** - TTS cost tracking and usage statistics
5. **Rate Limiting** - API rate limiting for Anna's Archive searches
6. **Sentence Parser** - NLP-based sentence boundary detection
7. **Dynamic Chapter Loading** - Automatic chapter extraction from EPUB TOC
8. **Sliding Window Memory Management** - Efficient chunk caching for progressive audio
9. **Real-time Progress Streaming** - SSE-based progress updates during TTS generation
10. **Character Count Limits** - Protection against excessive API costs (100k char limit per chapter)

## Code References

### Key Implementation Files

**Core Database**:
- [`lib/db.ts:1-735`](file:///home/user/best-reader/lib/db.ts) - 11 tables, 60+ helper functions

**Audio System**:
- [`app/api/tts/generate-stream/route.ts:1-331`](file:///home/user/best-reader/app/api/tts/generate-stream/route.ts) - Streaming TTS API
- [`hooks/useProgressiveAudioPlayer.ts:1-559`](file:///home/user/best-reader/hooks/useProgressiveAudioPlayer.ts) - Progressive audio player
- [`lib/audio-sync.ts:1-140`](file:///home/user/best-reader/lib/audio-sync.ts) - Audio-text synchronization
- [`lib/sentence-parser.ts:1-120`](file:///home/user/best-reader/lib/sentence-parser.ts) - Sentence boundary detection

**External Integrations**:
- [`lib/annas-archive.ts:1-180`](file:///home/user/best-reader/lib/annas-archive.ts) - Anna's Archive integration
- [`app/api/books/search/route.ts:1-98`](file:///home/user/best-reader/app/api/books/search/route.ts) - Search API with rate limiting

**Reader Core**:
- [`components/reader/ReaderView.tsx:1-150+`](file:///home/user/best-reader/components/reader/ReaderView.tsx) - Main reader orchestration
- [`hooks/useEpubReader.ts`](file:///home/user/best-reader/hooks/useEpubReader.ts) - EPUB rendering logic

**Analytics**:
- [`lib/analytics.ts:1-162`](file:///home/user/best-reader/lib/analytics.ts) - Privacy-first reading analytics
- [`hooks/useSession.ts`](file:///home/user/best-reader/hooks/useSession.ts) - Session tracking

**PWA**:
- [`public/manifest.json:1-27`](file:///home/user/best-reader/public/manifest.json) - PWA manifest
- [`public/sw.js:1-50+`](file:///home/user/best-reader/public/sw.js) - Service worker

**Type Definitions**:
- [`types/index.ts:1-171`](file:///home/user/best-reader/types/index.ts) - Complete TypeScript interfaces

## Architecture Documentation

### Data Flow

1. **EPUB Upload** → IndexedDB (`books` table with file Blob)
2. **Reading** → Position tracking (`positions` table, updated on page turn)
3. **Session** → Analytics collection (`sessions` + `analytics` tables)
4. **Highlighting** → Stored with CFI ranges (`highlights` table)
5. **Audio Generation** → API call → Chunks → IndexedDB (`audioChunks` table)
6. **Audio Playback** → Progressive loading → Web Audio API → Memory management
7. **Search** → Anna's Archive API → Download → Add to library

### State Management

- **Global Settings**: Zustand store ([`stores/settingsStore.ts`](file:///home/user/best-reader/stores/settingsStore.ts))
- **Reader State**: React hooks (useEpubReader, useHighlights, useSession, useChapters)
- **Audio State**: Dedicated hooks (useAudioPlayer, useProgressiveAudioPlayer, useAudioGeneration)
- **Persistent State**: IndexedDB via Dexie.js (11 tables)
- **UI State**: React component state (modals, drawers, overlays)

### Performance Considerations

**Optimizations Implemented**:
- Dynamic imports for epub.js (SSR issues)
- Lazy loading of components
- IndexedDB for offline-first architecture
- Sliding window memory management for audio chunks
- Debounced search input
- Auto-cleanup of old analytics data
- Service worker caching

**Known Limitations** (from code comments):
- Highlight rendering re-renders all highlights on change (not incremental)
- 250 words/page is estimated (should calculate actual words from EPUB)
- Native `confirm()` dialogs used (should use modal component)
- Seeking not implemented for progressive audio
- Speed changes during playback may cause gaps in progressive audio

### Technology Choices Rationale

From examination of code and documentation:

1. **Next.js 14** - App Router for better routing, built-in API routes, SSR capabilities
2. **Dexie.js** - TypeScript-friendly IndexedDB wrapper with schema versioning
3. **epub.js** - Industry-standard EPUB rendering library
4. **Zustand** - Lightweight (3KB) state management, simpler than Redux
5. **Tailwind CSS** - Utility-first CSS for rapid UI development
6. **OpenAI TTS** - High-quality voices, simple API, reasonable pricing ($0.015/1k chars)
7. **compromise** - Lightweight NLP for sentence parsing without heavy dependencies
8. **Cheerio** - Server-side HTML parsing for Anna's Archive scraping

## Historical Context (from thoughts/)

The project has undergone significant evolution:

### Development Timeline (from git commits and documentation)

**Phase 1 (Nov 9)**: Core reading experience
- EPUB rendering, themes, typography, navigation

**Phase 2 (Nov 9)**: Highlighting & session management
- 4-color highlighting, notes, session tracking

**Phase 3 (Nov 9)**: UI polish & adaptive tracking
- Progress indicators, recap modal, onboarding, analytics

**Phase 4 (Nov 9)**: Mock AI & PWA
- Mock AI features, PWA manifest, service worker

**TTS Phase 1 (Nov 9)**: Database & chapter extraction
- Chapter extraction, audio tables, audio settings

**TTS Phase 2 (Nov 9)**: OpenAI TTS integration
- API integration, audio storage, cost tracking

**TTS Phase 3 (Nov 9)**: Audio player UI
- Playback controls, UI components

**TTS Phase 4 (Nov 9)**: Progress sync & session tracking
- Audio-reading sync, listening time tracking

**TTS Phase 5 (Nov 9)**: Settings & usage dashboard
- Voice selection, usage tracking UI

**Sentence Sync Phase (Nov 9)**: Sentence-level synchronization
- Sentence parser, sync data generation, real-time highlighting

**Anna's Archive Integration (Nov 10)**:
- Search scraping, download API, library integration, rate limiting

**Progressive Audio Streaming (Nov 10)**:
- Phase 1: Database schema, chunk storage
- Phase 2: Streaming API, SSE progress
- Phase 3: Progressive audio player, gapless playback
- Phase 4: UI integration, memory management polish

### Key Decisions Documented

From [`thoughts/research/`](file:///home/user/best-reader/thoughts/research/) and [`thoughts/plans/`](file:///home/user/best-reader/thoughts/plans/):

1. **Privacy-First Analytics** - All reading data stored locally, never sent to servers
2. **Progressive Streaming** - Enables listening during generation, reduces memory usage
3. **OpenAI TTS over Amazon Polly** - Simpler API, better voice quality (Polly migration planned)
4. **Anna's Archive Integration** - Provides free book access, addresses user need for content
5. **Chunk-Based Architecture** - Enables streaming, memory management, better UX for long chapters

## Related Research

From the 53 markdown files in `/thoughts/`:

### Technical Research
- **TTS Generation Progress Tracking** - Analysis of streaming UX patterns
- **Progressive Audio Streaming** - Memory management and gapless playback strategies
- **Event Handling Conflicts** - Solutions for epub.js iframe event issues
- **Background Audio in Capacitor** - Research for future mobile app

### UX Research
- **Digital Reading Attention and Engagement** - Reading behavior patterns
- **Digital Reading Interface UX Patterns** - Best practices from existing apps
- **Audio Features in E-Reader Applications** - Business models and UX patterns

### Implementation Analysis
- **TTS Implementation Analysis** - Industry best practices comparison
- **Next.js E-Reader Mobile Packaging** - Capacitor vs. other solutions
- **Anna's Archive MCP Integration** - API analysis and integration approach

## Open Questions

Based on code analysis:

1. **Audio Seeking** - How to implement seek for progressive audio? (requires re-creating source nodes)
2. **Speed Changes** - How to handle playback speed changes without gaps? (Phase 4 improvement)
3. **Word-Level Highlighting** - Amazon Polly provides word-level timings - should we migrate?
4. **Real AI Integration** - When to replace mock AI with actual GPT-4/Claude integration?
5. **Cloud Sync** - What's the priority for multi-device sync vs. local-first?
6. **Anna's Archive API Key** - How to handle API key distribution for downloads?
7. **TTS Cost Management** - How to prevent users from accidentally generating expensive audio?
8. **Mobile App** - Timeline for Capacitor integration and native app packaging?

## Conclusion

The Adaptive Reader codebase has evolved significantly beyond the initial spec. The most notable achievements are:

1. **Complete TTS Audio System** - From basic chapter audio to progressive streaming with sentence-level sync
2. **Anna's Archive Integration** - Full search and download capability
3. **Comprehensive Database** - 5 schema versions tracking feature evolution
4. **Privacy-First Analytics** - Sophisticated reading behavior tracking without external tracking
5. **Production-Ready PWA** - Offline support, installability, service worker

The documentation in `/thoughts/` reveals a methodical development process with thorough planning, implementation tracking, and code reviews for each feature. The codebase is well-organized, typed with TypeScript, and demonstrates thoughtful architecture decisions.

**Current State**: A feature-complete v0.1 e-reader with advanced audio capabilities and external content integration, ready for user testing and refinement before moving toward real AI integration and multi-device sync.
