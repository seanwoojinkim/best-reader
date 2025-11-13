---
doc_type: research
date: 2025-11-13T20:24:04+00:00
title: "Drawer and AI Implementation Architecture for Card Components"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T20:24:04+00:00"
research_question: "Understand how drawers and AI features currently work so we can design card components for aspirational reading mode"
research_type: codebase_research
researcher: Sean Kim

git_commit: 6d13f4eb7d8f64fa60c3adad0b47258c5944cde6
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

tags:
  - architecture
  - ui-patterns
  - ai-features
  - card-design
status: complete

related_docs:
  - thoughts/plans/2025-11-09-adaptive-reader-v0-1-ux-focused-first-implementation.md
---

# Research: Drawer and AI Implementation Architecture for Card Components

**Date**: 2025-11-13T20:24:04+00:00
**Researcher**: Sean Kim
**Git Commit**: 6d13f4eb7d8f64fa60c3adad0b47258c5944cde6
**Branch**: main
**Repository**: reader

## Research Question

Understand how drawers and AI features currently work in the reader app so we can design card components for aspirational reading mode.

## Summary

The reader app implements a **custom drawer pattern** without external UI libraries (no shadcn/ui or radix-ui). All overlay components (drawers, popovers, sidebars) use **native CSS transitions** with Tailwind utility classes. The architecture provides excellent patterns for card components:

**Key Findings:**
1. **No UI Library**: All drawers are custom-built with `fixed`, `transform`, and `transition` CSS
2. **Three Main Drawer Types**: Settings (right slide-in), AI Sidebars (right slide-in), AI Popover (absolute positioned)
3. **Consistent Pattern**: Backdrop + Animated Content + Escape/Close handlers
4. **AI Features**: Three mock AI implementations (Recap, Explanation, Chapter Summary) with visual distinction
5. **State Management**: Zustand for global settings, local component state for drawer visibility
6. **Integration Points**: Cards would fit in the reader component hierarchy between the book content and overlay UI

## Detailed Findings

### 1. Current Drawer Implementation Pattern

All drawers follow a consistent architecture without external dependencies:

#### SettingsDrawer Component ([SettingsDrawer.tsx:52-164](file:///Users/seankim/dev/reader/components/reader/SettingsDrawer.tsx#L52-L164))

**Structure:**
```tsx
<>
  {/* Backdrop with fade transition */}
  <div className={`fixed inset-0 bg-black/50 transition-opacity z-40
    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    onClick={onClose}
  />

  {/* Drawer with slide transition */}
  <div className={`fixed right-0 top-0 h-full w-full md:w-80
    transform transition-transform duration-300 z-50
    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
  >
    {/* Content */}
  </div>
</>
```

**Key Characteristics:**
- **Z-index layering**: Backdrop at `z-40`, content at `z-50`
- **Responsive width**: Full width on mobile, `w-80` (320px) on desktop
- **Slide animation**: `translate-x-full` (hidden) to `translate-x-0` (visible)
- **Duration**: 300ms transition using `duration-300`
- **Easing**: `ease-out` for natural motion

#### AI Sidebar Pattern ([AiRecap.tsx:48-62](file:///Users/seankim/dev/reader/components/reader/AiRecap.tsx#L48-L62), [AiChapterSummary.tsx:57-63](file:///Users/seankim/dev/reader/components/reader/AiChapterSummary.tsx#L57-L63))

**Same architecture as SettingsDrawer with:**
- Fixed width: `w-96` (384px) on desktop
- Identical slide-in animation from right
- Scroll container: `overflow-y-auto` for long content

#### AI Popover Pattern ([AiExplanation.tsx:58-66](file:///Users/seankim/dev/reader/components/reader/AiExplanation.tsx#L58-L66))

**Different positioning strategy:**
```tsx
<div
  className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border"
  style={{
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translate(-50%, -100%) translateY(-16px)',
  }}
>
```

**Key Differences:**
- Uses `fixed` with dynamic `style` positioning (not `absolute`)
- Positioned relative to text selection coordinates
- CSS transform for centering: `translate(-50%, -100%)` plus offset
- No slide animation, just opacity fade via backdrop

### 2. ReaderView Component Hierarchy

The main reader interface ([ReaderView.tsx:344-676](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L344-L676)) shows the complete component tree:

```
<ErrorBoundary>
  <div className="relative h-screen w-screen overflow-hidden">
    {/* 1. Top Controls Bar - z-10, toggleable */}
    <div className={showControls ? 'translate-y-0' : '-translate-y-full'}>
      {/* Library link, AI buttons, Chapters, Settings */}
    </div>

    {/* 2. Settings Drawer - z-40/z-50 */}
    <SettingsDrawer isOpen={showSettings} />

    {/* 3. Chapter List Modal - z-40/z-50 */}
    {showChapterList && (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" />
        <div className="fixed left-0 top-0 bottom-0 w-full md:w-80 z-50">
          <ChapterList />
        </div>
      </>
    )}

    {/* 4. Highlight Menu - z-40/z-50 */}
    {currentSelection && (
      <HighlightMenu position={currentSelection.position} />
    )}

    {/* 5. Note Editor - z-40/z-50 (modal) */}
    {(showNoteEditor || editingNote) && <NoteEditor />}

    {/* 6. Audio Player - z-30, bottom bar */}
    {currentAudioChapter && (
      <AudioPlayer className="fixed bottom-0 left-0 right-0 z-30" />
    )}

    {/* 7. Progress Indicators - bottom, when no audio */}
    {!currentAudioChapter && <ProgressIndicators />}

    {/* 8. AI Recap - z-40/z-50 sidebar */}
    <AiRecap isOpen={showAiRecap} />

    {/* 9. AI Explanation - z-40/z-50 popover */}
    {showAiExplanation && <AiExplanation />}

    {/* 10. AI Chapter Summary - z-40/z-50 sidebar */}
    <AiChapterSummary isOpen={showAiChapterSummary} />

    {/* 11. Book Content - base layer */}
    <TapZones>
      <div ref={containerRef} className="epub-container h-full w-full" />
    </TapZones>
  </div>
</ErrorBoundary>
```

**Z-Index Strategy:**
- Base content: No explicit z-index (z-0 implicit)
- Audio player: `z-30` (bottom bar, above content)
- All overlays: Backdrop at `z-40`, content at `z-50`
- Top controls: `z-10` (below overlays, above content)

**Card Integration Point**: Cards would live at the **same z-index level as overlays (z-40/z-50)** or potentially a new intermediate layer (z-35) if they should appear below full overlays but above audio player.

### 3. Current AI Feature Implementations

All AI features use mock data from [mockAi.ts](file:///Users/seankim/dev/reader/lib/mockAi.ts) with consistent visual language.

#### AI Recap ([AiRecap.tsx:12-184](file:///Users/seankim/dev/reader/components/reader/AiRecap.tsx#L12-L184))

**Trigger**: Manual button click in top controls bar ([ReaderView.tsx:366-380](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L366-L380))

**Visual Identity:**
- Sky blue color scheme: `text-sky-700 dark:text-sky-300`, `bg-sky-50 dark:bg-sky-950`
- AI badge: Pill-shaped with sparkle icon ([AiRecap.tsx:94-111](file:///Users/seankim/dev/reader/components/reader/AiRecap.tsx#L94-L111))
- Content box: `bg-sky-50/50 dark:bg-sky-950/30` with left border `border-l-4 border-sky-500`

**Content Structure:**
- Session Summary (pages read, time spent)
- What You Read (narrative summary)
- Key Points (bulleted list)
- Disclaimer noting mock data

**State Management**: Local `useState` for content, props control visibility

#### AI Explanation ([AiExplanation.tsx:13-238](file:///Users/seankim/dev/reader/components/reader/AiExplanation.tsx#L13-L238))

**Trigger**: "Explain" button in highlight menu ([HighlightMenu.tsx:72-98](file:///Users/seankim/dev/reader/components/reader/HighlightMenu.tsx#L72-L98))

**Visual Identity:**
- Same sky blue scheme as Recap
- Popover with shadow: `shadow-2xl border border-sky-200 dark:border-sky-800`
- Smaller AI badge: Inline with header

**Content Structure:**
- Selected text preview (truncated to 100 chars)
- AI-generated explanation with markdown-style formatting
- "Save to Note" action button
- Mock disclaimer

**Positioning**: Dynamic based on text selection coordinates, centered above selection

#### AI Chapter Summary ([AiChapterSummary.tsx:12-228](file:///Users/seankim/dev/reader/components/reader/AiChapterSummary.tsx#L12-L228))

**Trigger**: "Summarize" button in top controls bar ([ReaderView.tsx:382-397](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L382-L397))

**Visual Identity:**
- Same sky blue scheme
- Sidebar layout (right side, same as Settings)
- AI badge with sparkle icon

**Content Structure:**
- Chapter metadata (title, word count, estimated pages)
- Overview paragraph
- Key Themes (bulleted list)
- Conclusion statement
- Mock disclaimer

**Generation**: Simulated 1-second delay for realistic UX ([AiChapterSummary.tsx:19-28](file:///Users/seankim/dev/reader/components/reader/AiChapterSummary.tsx#L19-L28))

### 4. AI Visual Language Design System

All AI components share **consistent visual markers** to distinguish AI-generated content:

**Color Palette** (from [constants.ts](file:///Users/seankim/dev/reader/lib/constants.ts)):
- Sky blue is not used elsewhere in the app (highlights use yellow/blue/orange/pink from `HIGHLIGHT_COLORS`)
- AI-specific shades: `sky-50`, `sky-100`, `sky-500`, `sky-700`, `sky-950`
- Works in both light and dark themes

**Typography:**
- Small badge text: `text-xs font-medium`
- Content text: `text-sm text-gray-700 dark:text-gray-300`
- Headers: `text-sm font-bold text-gray-900 dark:text-gray-100`

**Icons:**
- Sparkle/star icon used consistently ([AiRecap.tsx:102-116](file:///Users/seankim/dev/reader/components/reader/AiRecap.tsx#L102-L116))
- SVG with `strokeLinecap="round"` for friendly appearance

**Layout Patterns:**
- Content in colored background boxes with left border accent
- Generous padding: `p-4` or `p-6`
- Clear sectioning with border separators
- Disclaimer always at bottom in muted gray

### 5. State Management Architecture

#### Global Settings State ([settingsStore.ts:26-78](file:///Users/seankim/dev/reader/stores/settingsStore.ts#L26-L78))

**Zustand store with persistence:**
```typescript
interface SettingsStore extends ReaderSettings {
  currentBookId: number | null;
  isReading: boolean;
  showControls: boolean;
  // Actions
  setTheme: (theme) => void;
  setFontSize: (size: number) => void;
  setSystemFont: (fontId: string) => void;
  setCustomFont: (fontId: number) => void;
  // ... other typography setters
  toggleControls: () => void;
  setShowControls: (show: boolean) => void;
}
```

**Persistence Strategy** ([settingsStore.ts:64-77](file:///Users/seankim/dev/reader/stores/settingsStore.ts#L64-L77)):
- Only persists user preferences (theme, fonts, typography)
- Runtime state (currentBookId, showControls) not persisted
- Uses `partialize` to control what gets saved

#### Local Component State Pattern

All drawer/overlay components use **props-controlled visibility**:
```typescript
// Parent component (ReaderView)
const [showSettings, setShowSettings] = useState(false);
const [showAiRecap, setShowAiRecap] = useState(false);

// Child component
<SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} />
<AiRecap isOpen={showAiRecap} onClose={() => setShowAiRecap(false)} />
```

**Card Components Pattern**: Would follow the same props-controlled approach with local visibility state in parent.

### 6. Typography and Theme System

#### Design Tokens ([constants.ts:1-149](file:///Users/seankim/dev/reader/lib/constants.ts#L1-L149))

**Theme Colors**:
```typescript
THEME_COLORS = {
  light: { bg: '#F9F9F9', text: '#1A1A1A' },
  dark: { bg: '#121212', text: '#E0E0E0' }, // Not pure black - prevents OLED smearing
  sepia: { bg: '#FBF0D9', text: '#5F4B32' }, // Kindle standard
}
```

**Typography Defaults** (research-backed):
```typescript
TYPOGRAPHY_DEFAULTS = {
  fontSize: 18, // px
  lineHeight: 1.5,
  fontFamily: 'serif',
  maxWidthDesktop: '65ch',
  maxWidthMobile: '40ch',
  marginDesktop: 2, // rem
  marginMobile: 1, // rem
}
```

**System Fonts** ([constants.ts:56-123](file:///Users/seankim/dev/reader/lib/constants.ts#L56-L123)): 11 curated fonts including accessibility options like OpenDyslexic

#### Tailwind Configuration ([tailwind.config.ts](file:///Users/seankim/dev/reader/tailwind.config.ts))

**Custom Extensions**:
```typescript
theme: {
  extend: {
    colors: { light, dark, sepia },
    maxWidth: { 'reading': '65ch', 'reading-mobile': '40ch' },
    fontFamily: {
      serif: ['Georgia', 'Charter', 'serif'],
      sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    },
  },
}
```

**Dark Mode**: Uses class-based strategy (`darkMode: 'class'`), toggled via theme selector

### 7. Where Cards Would Fit in the Architecture

#### Integration Points for Card Components

**Option 1: As Overlay Layer (Recommended)**
```tsx
<ReaderView>
  {/* Existing UI... */}

  {/* NEW: Aspirational Cards Layer */}
  {aspirationalMode && (
    <AspiratinalCards
      position="inline" // or "floating"
      cards={relevantCards}
      onDismiss={handleCardDismiss}
      className="z-35" // Between audio player (z-30) and overlays (z-40)
    />
  )}

  {/* Book content */}
  <TapZones><div ref={containerRef} /></TapZones>
</ReaderView>
```

**Option 2: As Inline Content (Alternative)**
- Inject cards directly into the epub.js rendition at specific CFI (chapter) positions
- Would require epub.js annotation API similar to highlights
- More complex but feels more "native" to reading flow

**Option 3: As Bottom Sheet (Mobile-First)**
- Similar to AudioPlayer pattern ([AudioPlayer.tsx:89-217](file:///Users/seankim/dev/reader/components/reader/AudioPlayer.tsx#L89-L217))
- Slide up from bottom with `translate-y-full` to `translate-y-0`
- Good for mobile, but may conflict with existing audio player

#### Recommended Card Architecture

Based on existing patterns, cards should follow this structure:

```tsx
// components/reader/AspirationCard.tsx
interface AspirationCardProps {
  type: 'comprehension' | 'reflection' | 'connection';
  content: string;
  position?: { x: number; y: number }; // For floating cards
  onDismiss: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
}

// Visual distinction from AI features
// Use different color scheme (e.g., purple/violet instead of sky blue)
// Example: `bg-purple-50 dark:bg-purple-950` with `border-purple-500`

// Animation: Slide in from side or fade in at position
// Z-index: 35 (above audio, below full overlays)
// Dismissible: Tap outside, swipe down (mobile), or close button
```

**Key Differences from AI Features:**
- **Proactive vs Reactive**: Cards appear automatically based on reading patterns, AI features are manually triggered
- **Visual Identity**: Different color scheme to distinguish from AI (purple/violet vs sky blue)
- **Position**: May be inline with content or floating, not full-width sidebars
- **Interaction**: Expandable (collapsed preview → full content), AI features are full-form from start
- **State**: More complex (dismissed cards shouldn't reappear), AI features are stateless

### 8. Interaction Patterns and Event Handling

#### Escape Key Handling Pattern

All overlays implement consistent escape key handling:

```typescript
// Example from SettingsDrawer.tsx:36-42
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) onClose();
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [isOpen, onClose]);
```

**Cards Should Follow**: Same pattern for keyboard accessibility

#### Click Outside to Dismiss Pattern

```typescript
// Backdrop receives onClick
<div
  className="fixed inset-0 bg-black/50 z-40"
  onClick={onClose}
  aria-hidden="true"
/>
```

**Cards Should Follow**: Same backdrop pattern, but consider **partial backdrop** (doesn't cover book content) if cards are inline

#### Auto-Hide Controls Pattern ([ReaderView.tsx:275-284](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L275-L284))

```typescript
useEffect(() => {
  if (!showControls) return;

  const timeout = setTimeout(() => {
    setShowControls(false);
  }, UI_CONSTANTS.controlsAutoHideDelay); // 3000ms

  return () => clearTimeout(timeout);
}, [showControls, setShowControls]);
```

**Cards Consideration**: Aspirational cards might need **longer timeout** or **explicit dismiss** to avoid feeling rushed

### 9. Mobile vs Desktop UX Patterns

#### Responsive Width Patterns

**Drawers:**
- Mobile: `w-full` (full screen takeover)
- Desktop: `md:w-80` (320px) or `md:w-96` (384px)
- Example: [SettingsDrawer.tsx:66](file:///Users/seankim/dev/reader/components/reader/SettingsDrawer.tsx#L66)

**Controls:**
- Icon-only on mobile, text+icon on desktop
- Example: [ReaderView.tsx:379](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L379) `<span className="hidden md:inline">AI Recap</span>`

**Cards Should Follow:**
- Mobile: Full-width bottom sheet or floating over content
- Desktop: Max-width card (e.g., `max-w-md` = 448px) positioned inline or floating

#### Safe Area Handling

Mobile notches and home indicators handled with custom classes:
```tsx
// Top safe area
<div className="safe-area-top">

// Bottom safe area
<div className="safe-area-bottom">

// Full insets
<div className="safe-area-inset">
```

**Cards on Mobile**: Must respect safe areas, especially if positioned at screen edges

### 10. Loading and Error States

#### Loading Pattern ([AiChapterSummary.tsx:123-148](file:///Users/seankim/dev/reader/components/reader/AiChapterSummary.tsx#L123-L148))

```tsx
{isGenerating ? (
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <svg className="animate-spin h-12 w-12 text-sky-500">
      {/* Spinner SVG */}
    </svg>
    <p className="text-sm text-gray-500">Analyzing chapter content...</p>
  </div>
) : (
  <>{content}</>
)}
```

**Cards Should Follow**: Similar spinner + message pattern if cards fetch data or run analysis

#### Error Boundaries ([ReaderView.tsx:345](file:///Users/seankim/dev/reader/components/reader/ReaderView.tsx#L345))

Main reader wrapped in ErrorBoundary with `level="feature"`:
```tsx
<ErrorBoundary level="feature">
  <ReaderView />
</ErrorBoundary>
```

**Cards Should Follow**: Individual cards in error boundaries so one failing card doesn't break entire UI

## Code References

### Core Implementation Files
- `components/reader/ReaderView.tsx:344-676` - Main reader interface showing complete component hierarchy
- `components/reader/SettingsDrawer.tsx:52-164` - Canonical drawer implementation pattern
- `components/reader/AiRecap.tsx:12-184` - AI sidebar with full visual identity
- `components/reader/AiExplanation.tsx:13-238` - AI popover with dynamic positioning
- `components/reader/AiChapterSummary.tsx:12-228` - AI sidebar with loading states
- `components/reader/HighlightMenu.tsx:28-111` - Contextual menu pattern
- `components/reader/AudioPlayer.tsx:89-217` - Bottom bar component pattern

### State and Configuration
- `stores/settingsStore.ts:26-78` - Zustand global state with persistence
- `lib/constants.ts:1-149` - Design tokens and typography system
- `lib/mockAi.ts:29-201` - Mock AI response generation patterns
- `types/index.ts:54-62` - ReaderSettings interface

### Styling and Theming
- `tailwind.config.ts` - Custom theme configuration
- `lib/constants.ts:1-15` - Theme color values (light, dark, sepia)
- `lib/constants.ts:56-123` - System font definitions

## Architecture Documentation

### Current Pattern Summary

**Drawer Architecture:**
1. No external UI library dependencies
2. Pure CSS transforms with Tailwind classes
3. Consistent backdrop + content structure
4. 300ms transition duration with ease-out
5. Props-controlled visibility (parent manages state)

**Component Communication:**
- Parent → Child: Props (isOpen, onClose, data)
- Child → Parent: Callbacks (onClose, onAction)
- No global event bus or complex state orchestration
- Simple and maintainable

**Z-Index Hierarchy:**
```
z-0:  Book content (implicit)
z-10: Top controls bar
z-30: Audio player (bottom bar)
z-35: [AVAILABLE for cards]
z-40: Overlay backdrops
z-50: Overlay content (drawers, modals, popovers)
```

**Animation Patterns:**
- Slide-in from right: `translate-x-full` → `translate-x-0`
- Slide-in from bottom: `translate-y-full` → `translate-y-0`
- Fade: `opacity-0` → `opacity-100`
- Duration: 300ms standard
- Respect `prefers-reduced-motion`

### AI Feature Patterns

**Visual Language:**
- Color: Sky blue family (`sky-50` through `sky-950`)
- Badge: Pill with sparkle icon + "AI Generated" text
- Content: Light background with left border accent
- Typography: Small (text-sm), clear hierarchy
- Disclaimer: Always present in muted gray

**Interaction Model:**
- Manually triggered (buttons in UI)
- Full-screen takeover or popover (no inline cards yet)
- Dismissible without affecting reading position
- Simulated generation delay for realistic UX

**Mock Data Strategy:**
- All responses from `lib/mockAi.ts`
- Context-aware (varies by genre, text length)
- Markdown-style formatting in strings
- Parsed and rendered with simple logic (no markdown library)

### Design System Tokens

**Colors:**
- Reading themes: Light (#F9F9F9), Dark (#121212), Sepia (#FBF0D9)
- Highlights: Yellow (#FEF3C7), Blue (#DBEAFE), Orange (#FED7AA), Pink (#FCE7F3)
- AI features: Sky blue shades
- [AVAILABLE for cards]: Purple/violet, amber, or emerald

**Typography:**
- Base size: 18px (research-backed for optimal readability)
- Line height: 1.5 (comfortable reading)
- Max width: 65ch desktop, 40ch mobile (optimal line length)
- Font families: 11 system fonts + custom upload support

**Spacing:**
- Padding: Generous (p-4, p-6 for content areas)
- Margins: Responsive (2rem desktop, 1rem mobile)
- Gaps: Consistent (gap-2, gap-4 for flex layouts)

## Related Research

### Historical Context

**Adaptive Reader Implementation Plan** ([thoughts/plans/2025-11-09-adaptive-reader-v0-1-ux-focused-first-implementation.md](file:///Users/seankim/dev/reader/thoughts/plans/2025-11-09-adaptive-reader-v0-1-ux-focused-first-implementation.md)):
- Outlines original vision for AI features (Phase 4: Mock AI Features)
- Defines UX-first approach with distraction-free interface
- Cards would be evolution of adaptive behaviors (Phase 3: Adaptive Tracking)
- Original plan mentions "intervention timing" using JITAI framework (Just-In-Time Adaptive Interventions)

**Relevant Sections:**
- Phase 3 Deliverables (lines 858-904): Reading analytics, slowdown detection, friction zones
- Phase 4 Deliverables (lines 1032-1092): Mock AI features with visual distinction
- Section 0.1 Roadmap (lines 1552-1689): "Advanced Adaptive Behaviors" mentions intervention logic for slowdowns

**Implication for Cards**: Aspirational cards are the **proactive intervention** that Phase 3 analytics enable. Current AI features are reactive (user-triggered), but cards would be adaptive (system-triggered based on reading patterns).

## Open Questions

### Architecture Decisions Needed

1. **Card Positioning Strategy**:
   - Inline vs floating vs bottom sheet?
   - Fixed position or scroll with content?
   - Single card or multiple cards visible?

2. **Card State Management**:
   - Store dismissed cards in IndexedDB?
   - Per-book or global dismissed state?
   - Expiration/reset logic for dismissed cards?

3. **Card Trigger Logic**:
   - What reading patterns trigger which cards?
   - How to avoid feeling intrusive?
   - Rate limiting (max cards per session)?

4. **Visual Identity**:
   - Which color scheme to distinguish from AI features?
   - Same "badge" pattern or different visual marker?
   - How to convey "proactive suggestion" vs "AI response"?

5. **Mobile UX**:
   - Bottom sheet, side panel, or overlay?
   - Swipe to dismiss or explicit close button?
   - Conflict resolution with audio player?

6. **Expandable Content**:
   - Collapsed preview size (1-2 lines)?
   - Expand animation (grow in place or open modal)?
   - Show multiple collapsed cards simultaneously?

### Technical Unknowns

1. **Performance**:
   - Impact of cards on reading flow?
   - Animation performance on low-end devices?
   - Memory usage of card state tracking?

2. **Accessibility**:
   - Screen reader announcements for new cards?
   - Keyboard navigation for card interactions?
   - Focus management when cards appear?

3. **Integration with Existing Features**:
   - Should cards be dismissible while audio playing?
   - Interaction with highlight menu if both appear?
   - Card behavior during theme transitions?

## Recommendations for Card Implementation

### Follow Existing Patterns

1. **Use Custom CSS Transitions** (no new dependencies)
2. **Props-controlled visibility** from parent component
3. **Consistent escape key handling** for dismissal
4. **Error boundaries** around individual cards
5. **Loading states** with spinner if cards fetch data

### Differentiate from AI Features

1. **Color scheme**: Purple/violet instead of sky blue
2. **Badge design**: Different icon (maybe compass or target instead of sparkle)
3. **Label**: "Suggestion" or "Reflection Prompt" instead of "AI Generated"
4. **Interaction**: Collapsed preview with expand action
5. **Trigger**: Automatic based on reading patterns, not manual button

### Mobile-First Considerations

1. **Bottom sheet pattern** for primary card display on mobile
2. **Swipe down to dismiss** gesture (in addition to close button)
3. **Single card at a time** to avoid overwhelming small screen
4. **Collapsed by default** with expand affordance
5. **Safe area handling** for notches and home indicators

### State Management Strategy

1. **Create new store**: `aspirationalCardsStore.ts` with Zustand
2. **Track dismissed cards**: `{ cardId: string, bookId: number, dismissedAt: Date }[]`
3. **Persist to IndexedDB**: Via Zustand middleware
4. **Expiration logic**: Re-show cards after N days or on new reading session
5. **Analytics**: Track show/dismiss/expand rates for optimization
