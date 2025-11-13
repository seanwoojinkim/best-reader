---
doc_type: plan
date: 2025-11-13T20:28:07+00:00
title: "Aspirational Reading Cards Implementation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-13T20:28:07+00:00"
feature: "aspirational-cards"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Core Card Component & 'Before Reading' Card"
    status: pending
    estimated_time: "4-6 hours"
  - name: "Phase 2: Expandable 'After Reading' Cards with State Management"
    status: pending
    estimated_time: "6-8 hours"
  - name: "Phase 3: Full Aspirational Mode with All Card Types"
    status: pending
    estimated_time: "8-12 hours"

git_commit: 6d13f4eb7d8f64fa60c3adad0b47258c5944cde6
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-13
last_updated_by: Sean Kim

ticket_id: CARDS-001
tags:
  - ui
  - cards
  - aspirational-reading
  - adaptive-features
status: draft

related_docs:
  - thoughts/research/2025-11-13-drawer-and-ai-implementation-architecture-for-card-components.md
  - thoughts/plans/2025-11-09-adaptive-reader-v0-1-ux-focused-first-implementation.md
---

# Aspirational Reading Cards Implementation Plan

**Date**: 2025-11-13T20:28:07+00:00
**Feature**: aspirational-cards
**Ticket**: CARDS-001
**Status**: Draft

## Executive Summary

This plan details the implementation of **aspirational reading cards** - a new UI pattern for contextual, proactive reading guidance that appears inline with the reading flow. Unlike existing AI features (which are reactive/user-triggered), aspirational cards are **adaptive** - appearing automatically based on reading patterns and context.

**Key Differentiators:**
- **Visual Identity**: Purple/violet theme (vs sky blue for AI features)
- **Positioning**: Inline/floating within reading flow (vs full-width sidebars)
- **Interaction**: Expandable with progressive disclosure (vs full-form from start)
- **Trigger**: Automatic based on reading events (vs manual button clicks)
- **State**: Persistent dismissal tracking (vs stateless)

**Success Criteria:**
- Cards visually distinct from AI features
- Smooth integration into reading flow without disruption
- Expandable/collapsible interaction with 300ms animations
- State persistence for dismissed cards
- Mobile-responsive with bottom sheet pattern
- No performance impact on reading experience

## Current State Analysis

### Existing Architecture Patterns

The reader app has **strong existing patterns** we'll follow for consistency:

**Drawer Pattern** (SettingsDrawer.tsx, AiRecap.tsx):
```tsx
// Backdrop + Animated Content structure
<>
  <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" />
  <div className="fixed right-0 top-0 h-full w-full md:w-80
    transform transition-transform duration-300 z-50
    translate-x-full → translate-x-0" />
</>
```

**Z-Index Hierarchy**:
```
z-0:  Book content (implicit)
z-10: Top controls bar
z-30: Audio player (bottom bar)
z-35: [AVAILABLE - we'll use for cards]
z-40: Overlay backdrops
z-50: Overlay content (drawers, modals)
```

**AI Visual Language** (Sky Blue):
- Colors: `sky-50`, `sky-500`, `sky-700`, `sky-950`
- Badge: Pill with sparkle icon + "AI Generated"
- Content: `bg-sky-50/50 dark:bg-sky-950/30` with `border-l-4 border-sky-500`
- Typography: `text-sm`, clear hierarchy

**Component Communication**:
- Parent → Child: Props (`isOpen`, `onClose`, data)
- Child → Parent: Callbacks
- No global event bus

### Integration Points

Cards will integrate at **z-35 layer** in ReaderView component hierarchy:

```tsx
<ReaderView>
  {/* Existing overlays at z-40/z-50 */}
  <SettingsDrawer />
  <AiRecap />

  {/* NEW: Aspirational Cards at z-35 */}
  <AspirationCardContainer />

  {/* Audio player at z-30 */}
  <AudioPlayer />

  {/* Book content at z-0 */}
  <TapZones><div ref={containerRef} /></TapZones>
</ReaderView>
```

### File Structure (Current State)

```
components/reader/
├── ReaderView.tsx           # Main integration point
├── SettingsDrawer.tsx       # Drawer pattern reference
├── AiRecap.tsx             # AI visual language reference
├── AiExplanation.tsx       # Popover positioning reference
├── AudioPlayer.tsx         # Bottom bar pattern reference
├── HighlightMenu.tsx       # Contextual menu reference
└── ... existing components

stores/
├── settingsStore.ts        # Zustand with persistence
└── ... existing stores

lib/
├── constants.ts            # Design tokens
├── mockAi.ts              # Mock data patterns
└── ... existing utilities

types/
└── index.ts               # TypeScript interfaces
```

## Requirements Analysis

### Functional Requirements

#### FR1: Card Component Architecture
- [ ] Reusable `AspirationCard` component for individual cards
- [ ] Container component `AspirationCardContainer` for managing multiple cards
- [ ] Props interface for card type, content, state
- [ ] Support for "before reading" (expanded) and "after reading" (collapsed) modes
- [ ] Progressive disclosure: tap to expand/collapse

#### FR2: Visual Design
- [ ] Purple/violet color scheme distinct from AI features
- [ ] Badge with unique icon (compass, not sparkle)
- [ ] Label: "Reading Suggestion" or "Reflection Prompt"
- [ ] Expandable animation: 300ms ease-out (matching existing patterns)
- [ ] Dark mode support

#### FR3: Card Types
- [ ] **Comprehension Check**: Questions to test understanding
- [ ] **Reflection Prompt**: Deeper thinking questions
- [ ] **Connection Card**: Relate to prior knowledge/experience
- [ ] **Context Card**: Background information before reading

#### FR4: Positioning Strategy
- [ ] Desktop: Floating card at z-35, max-width 448px (`max-w-md`)
- [ ] Mobile: Bottom sheet sliding from bottom
- [ ] Position relative to reading progress (inline with content flow)

#### FR5: State Management
- [ ] Track dismissed cards per book
- [ ] Track expanded/collapsed state
- [ ] Persist to IndexedDB via Zustand
- [ ] Expiration logic: re-show after N days or new session

#### FR6: Trigger Logic
- [ ] **Before Reading**: Show context card at chapter start
- [ ] **After Reading**: Show comprehension/reflection after chapter end
- [ ] **During Reading**: Slowdown detection triggers support card (future)
- [ ] Rate limiting: Max 1 card visible at a time

### Technical Requirements

#### TR1: Performance
- [ ] No impact on reading flow or page turns
- [ ] Animations run at 60fps
- [ ] Card state queries < 50ms
- [ ] Memory usage < 5MB for card state

#### TR2: Accessibility
- [ ] Screen reader announcements for new cards
- [ ] Keyboard navigation: Tab through card actions
- [ ] Escape key to dismiss
- [ ] Focus management when cards appear/disappear

#### TR3: Responsive Design
- [ ] Mobile: Full-width bottom sheet
- [ ] Desktop: Floating card with max-width
- [ ] Safe area handling for notches/home indicators
- [ ] Swipe down to dismiss on mobile

#### TR4: Integration
- [ ] No conflicts with audio player at z-30
- [ ] No conflicts with highlight menu at z-50
- [ ] Dismiss when settings drawer opens
- [ ] Hide when controls auto-hide

### Out of Scope

- [ ] Real AI-generated card content (use mock data)
- [ ] Reading analytics/slowdown detection (use hardcoded triggers)
- [ ] Multi-card simultaneous display (Phase 1-2: single card only)
- [ ] Card personalization/learning (future enhancement)
- [ ] Export/share card content
- [ ] Card history/review view

## Architecture & Design

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│ ReaderView.tsx (Parent)                                 │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ AspirationCardContainer                             │ │
│ │ - Manages card visibility                           │ │
│ │ - Handles triggers and rate limiting                │ │
│ │ - Props: currentCfi, bookId, readingEvents          │ │
│ │                                                     │ │
│ │ ┌─────────────────────────────────────────────────┐ │ │
│ │ │ AspirationCard                                  │ │ │
│ │ │ - Renders individual card                       │ │ │
│ │ │ - Handles expand/collapse                       │ │ │
│ │ │ - Animates entry/exit                           │ │ │
│ │ │                                                 │ │ │
│ │ │ Props:                                          │ │ │
│ │ │   type: 'context' | 'comprehension' | ...       │ │ │
│ │ │   content: CardContent                          │ │ │
│ │ │   isExpanded: boolean                           │ │ │
│ │ │   onExpand: () => void                          │ │ │
│ │ │   onDismiss: () => void                         │ │ │
│ │ │   position: 'inline' | 'floating' | 'bottom'    │ │ │
│ │ └─────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### File Structure (New Files)

```
components/reader/
├── AspirationCard.tsx              # Individual card component
├── AspirationCardContainer.tsx     # Container managing card lifecycle
└── ... existing components

stores/
├── aspirationCardsStore.ts         # Zustand store for card state
└── ... existing stores

lib/
├── mockAspirationCards.ts          # Mock card content generator
└── ... existing utilities

types/
└── index.ts                        # Add card interfaces
```

### Data Model

#### TypeScript Interfaces

```typescript
// types/index.ts additions

/**
 * Card type determines visual style and trigger logic
 */
export type AspirationCardType =
  | 'context'         // Before reading: background info
  | 'comprehension'   // After reading: check understanding
  | 'reflection'      // After reading: deeper thinking
  | 'connection';     // After reading: relate to experience

/**
 * Card content structure
 */
export interface AspirationCardContent {
  id: string;                    // Unique card ID (e.g., "meditations-ch1-context")
  type: AspirationCardType;
  title: string;                 // Card heading
  body: string;                  // Main content (supports markdown-style formatting)
  action?: {                     // Optional call-to-action
    label: string;
    onClick: () => void;
  };
  timing: 'before' | 'after' | 'during'; // When to show
}

/**
 * Card display state
 */
export interface CardDisplayState {
  cardId: string;
  bookId: number;
  isExpanded: boolean;
  isDismissed: boolean;
  dismissedAt?: Date;
  lastShownAt: Date;
}

/**
 * Store interface
 */
export interface AspirationCardsStore {
  // State
  cardStates: Map<string, CardDisplayState>;
  currentCardId: string | null;

  // Actions
  showCard: (cardId: string, bookId: number) => void;
  dismissCard: (cardId: string) => void;
  toggleExpanded: (cardId: string) => void;
  shouldShowCard: (cardId: string, bookId: number) => boolean;
  resetForBook: (bookId: number) => void;
}
```

### Visual Design Specifications

#### Color Palette (Purple/Violet Theme)

Distinct from AI features (sky blue):

```typescript
// lib/constants.ts additions

export const ASPIRATION_CARD_COLORS = {
  light: {
    bg: '#FAF5FF',        // violet-50
    bgAccent: '#F3E8FF',  // violet-100
    border: '#A78BFA',    // violet-400
    text: '#5B21B6',      // violet-800
    textMuted: '#6D28D9', // violet-700
  },
  dark: {
    bg: '#2E1065',        // violet-950
    bgAccent: '#4C1D95',  // violet-900
    border: '#7C3AED',    // violet-600
    text: '#DDD6FE',      // violet-200
    textMuted: '#C4B5FD', // violet-300
  },
} as const;
```

#### Tailwind Classes

**Badge (collapsed state):**
```tsx
<div className="inline-flex items-center gap-2 px-3 py-1.5
  bg-violet-50 dark:bg-violet-950
  text-violet-700 dark:text-violet-300
  text-xs font-medium rounded-full
  border border-violet-200 dark:border-violet-800">
  <CompassIcon />
  <span>Reading Suggestion</span>
</div>
```

**Content Box (expanded state):**
```tsx
<div className="bg-violet-50/50 dark:bg-violet-950/30
  border-l-4 border-violet-500
  p-4 rounded-r-lg">
  {/* Card content */}
</div>
```

**Card Container (desktop floating):**
```tsx
<div className="fixed bottom-24 right-8 z-35
  max-w-md w-full
  bg-white dark:bg-gray-900
  rounded-lg shadow-2xl
  border border-violet-200 dark:border-violet-800
  transform transition-all duration-300 ease-out
  ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}">
```

**Card Container (mobile bottom sheet):**
```tsx
<div className="fixed bottom-0 left-0 right-0 z-35
  bg-white dark:bg-gray-900
  rounded-t-xl shadow-2xl
  border-t border-violet-200 dark:border-violet-800
  transform transition-transform duration-300 ease-out
  ${isVisible ? 'translate-y-0' : 'translate-y-full'}
  safe-area-bottom">
```

#### Icon Design

**Compass Icon** (distinct from AI sparkle):
```tsx
// Compass icon SVG for card badge
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
    d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
</svg>
```

#### Animation Specifications

Following existing 300ms ease-out pattern:

```tsx
// Expand/collapse animation
const expandAnimation = {
  enter: 'transition-all duration-300 ease-out',
  enterFrom: 'max-h-0 opacity-0',
  enterTo: 'max-h-96 opacity-100',
  leave: 'transition-all duration-300 ease-out',
  leaveFrom: 'max-h-96 opacity-100',
  leaveTo: 'max-h-0 opacity-0',
};

// Slide in from bottom (mobile)
const slideUpAnimation = {
  enter: 'transition-transform duration-300 ease-out',
  enterFrom: 'translate-y-full',
  enterTo: 'translate-y-0',
  leave: 'transition-transform duration-300 ease-out',
  leaveFrom: 'translate-y-0',
  leaveTo: 'translate-y-full',
};

// Fade + slide up (desktop)
const fadeSlideAnimation = {
  enter: 'transition-all duration-300 ease-out',
  enterFrom: 'translate-y-8 opacity-0',
  enterTo: 'translate-y-0 opacity-100',
  leave: 'transition-all duration-300 ease-out',
  leaveFrom: 'translate-y-0 opacity-100',
  leaveTo: 'translate-y-8 opacity-0',
};
```

### State Management Strategy

#### Zustand Store Architecture

```typescript
// stores/aspirationCardsStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CardDisplayState {
  cardId: string;
  bookId: number;
  isExpanded: boolean;
  isDismissed: boolean;
  dismissedAt?: Date;
  lastShownAt: Date;
}

interface AspirationCardsStore {
  // Map: cardId → state
  cardStates: Record<string, CardDisplayState>;

  // Currently visible card (only one at a time in Phase 1-2)
  currentCardId: string | null;

  // Actions
  showCard: (cardId: string, bookId: number) => void;
  dismissCard: (cardId: string) => void;
  toggleExpanded: (cardId: string) => void;
  shouldShowCard: (cardId: string, bookId: number) => boolean;
  resetForBook: (bookId: number) => void;
}

export const useAspirationCardsStore = create<AspirationCardsStore>()(
  persist(
    (set, get) => ({
      cardStates: {},
      currentCardId: null,

      showCard: (cardId, bookId) => {
        const { shouldShowCard } = get();
        if (!shouldShowCard(cardId, bookId)) return;

        set((state) => ({
          currentCardId: cardId,
          cardStates: {
            ...state.cardStates,
            [cardId]: {
              cardId,
              bookId,
              isExpanded: false, // Start collapsed for 'after' cards
              isDismissed: false,
              lastShownAt: new Date(),
            },
          },
        }));
      },

      dismissCard: (cardId) => {
        set((state) => ({
          currentCardId: null,
          cardStates: {
            ...state.cardStates,
            [cardId]: {
              ...state.cardStates[cardId],
              isDismissed: true,
              dismissedAt: new Date(),
            },
          },
        }));
      },

      toggleExpanded: (cardId) => {
        set((state) => ({
          cardStates: {
            ...state.cardStates,
            [cardId]: {
              ...state.cardStates[cardId],
              isExpanded: !state.cardStates[cardId]?.isExpanded,
            },
          },
        }));
      },

      shouldShowCard: (cardId, bookId) => {
        const state = get().cardStates[cardId];

        // Never shown before
        if (!state) return true;

        // Different book
        if (state.bookId !== bookId) return true;

        // Dismissed
        if (state.isDismissed) {
          // Re-show after 7 days
          const daysSinceDismissed = state.dismissedAt
            ? (Date.now() - state.dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
            : 999;
          return daysSinceDismissed > 7;
        }

        return true;
      },

      resetForBook: (bookId) => {
        set((state) => {
          const filtered = Object.fromEntries(
            Object.entries(state.cardStates).filter(
              ([_, cardState]) => cardState.bookId !== bookId
            )
          );
          return { cardStates: filtered, currentCardId: null };
        });
      },
    }),
    {
      name: 'aspiration-cards-state',
      // Persist everything
      partialize: (state) => ({
        cardStates: state.cardStates,
      }),
    }
  )
);
```

#### State Persistence Strategy

- **What persists**: Dismissed cards, expanded state, last shown timestamp
- **What doesn't persist**: Currently visible card (recalculated on load)
- **Storage**: Zustand persist middleware → localStorage
- **Expiration**: Dismissed cards re-show after 7 days
- **Reset**: User can reset via settings (future enhancement)

### Integration with ReaderView

#### ReaderView Changes

```tsx
// components/reader/ReaderView.tsx

import AspirationCardContainer from './AspirationCardContainer';

function ReaderViewContentComponent({ bookId, bookBlob, initialCfi }: ReaderViewProps) {
  // ... existing state
  const [aspirationalMode, setAspirationalMode] = useState(false); // Phase 1: manual toggle

  return (
    <ErrorBoundary level="feature">
      <div className="relative h-screen w-screen overflow-hidden safe-area-inset">
        {/* Existing overlays at z-40/z-50 */}
        <SettingsDrawer isOpen={showSettings} onClose={() => setShowSettings(false)} />
        <AiRecap isOpen={showAiRecap} onClose={() => setShowAiRecap(false)} />

        {/* NEW: Aspiration Cards at z-35 */}
        {aspirationalMode && (
          <AspirationCardContainer
            bookId={bookId}
            currentCfi={currentLocation}
            onCardDismiss={(cardId) => console.log('[ReaderView] Card dismissed:', cardId)}
          />
        )}

        {/* Audio player at z-30 */}
        {currentAudioChapter && <AudioPlayer {...audioPlayerProps} />}

        {/* Book content at z-0 */}
        <TapZones>
          <div ref={containerRef} className="epub-container h-full w-full" />
        </TapZones>
      </div>
    </ErrorBoundary>
  );
}
```

## Implementation Phases

### Phase 1: Core Card Component & "Before Reading" Card

**Goal**: Implement basic card infrastructure with a single "context" card type that appears before reading.

**Estimated Time**: 4-6 hours

**Prerequisites**:
- Research document reviewed
- Design mockups understood
- TypeScript interfaces defined

**Files to Create**:
1. `types/index.ts` (additions)
2. `lib/constants.ts` (additions for colors)
3. `lib/mockAspirationCards.ts`
4. `stores/aspirationCardsStore.ts`
5. `components/reader/AspirationCard.tsx`
6. `components/reader/AspirationCardContainer.tsx`

**Files to Modify**:
1. `components/reader/ReaderView.tsx` (add card container)

**Implementation Steps**:

#### Step 1.1: Define TypeScript Interfaces (30 min)

Edit `types/index.ts`:

```typescript
// Add at end of file

/**
 * Aspiration Card Types (Phase 1: context only)
 */
export type AspirationCardType =
  | 'context'         // Before reading: background info
  | 'comprehension'   // After reading: check understanding
  | 'reflection'      // After reading: deeper thinking
  | 'connection';     // After reading: relate to experience

export interface AspirationCardContent {
  id: string;
  type: AspirationCardType;
  title: string;
  body: string;
  action?: {
    label: string;
    href?: string;
  };
  timing: 'before' | 'after' | 'during';
}

export interface CardDisplayState {
  cardId: string;
  bookId: number;
  isExpanded: boolean;
  isDismissed: boolean;
  dismissedAt?: Date;
  lastShownAt: Date;
}
```

#### Step 1.2: Add Color Constants (15 min)

Edit `lib/constants.ts`:

```typescript
// Add after HIGHLIGHT_COLORS

export const ASPIRATION_CARD_COLORS = {
  light: {
    bg: '#FAF5FF',        // violet-50
    bgAccent: '#F3E8FF',  // violet-100
    border: '#A78BFA',    // violet-400
    text: '#5B21B6',      // violet-800
    textMuted: '#6D28D9', // violet-700
  },
  dark: {
    bg: '#2E1065',        // violet-950
    bgAccent: '#4C1D95',  // violet-900
    border: '#7C3AED',    // violet-600
    text: '#DDD6FE',      // violet-200
    textMuted: '#C4B5FD', // violet-300
  },
} as const;
```

#### Step 1.3: Create Mock Card Generator (45 min)

Create `lib/mockAspirationCards.ts`:

```typescript
import type { AspirationCardContent } from '@/types';

/**
 * Generate mock "context" card for before reading
 * Provides background information to enhance comprehension
 */
export function generateContextCard(bookTitle: string, chapterTitle?: string): AspirationCardContent {
  const contextCards = [
    {
      id: `context-${bookTitle}-${chapterTitle || 'intro'}`,
      type: 'context' as const,
      title: 'Before You Read',
      body: `This section builds on themes of Stoic philosophy, particularly the concept of focusing on what you can control. Marcus Aurelius wrote these meditations as personal reflections, not for publication.

**Key Context**:
- Written around 170-180 AD during military campaigns
- Influenced by Stoic teachers Epictetus and earlier philosophers
- Personal notebook, not polished for public consumption

**Reading Tip**: Notice how he addresses himself directly - these are reminders he gave himself during challenging times.`,
      timing: 'before' as const,
    },
    {
      id: `context-technical-${chapterTitle}`,
      type: 'context' as const,
      title: 'Technical Context',
      body: `This chapter introduces fundamental concepts that will be built upon throughout the book. Don't worry if everything doesn't click immediately - the author will revisit these ideas with examples.

**Prerequisites**:
- Basic understanding of object-oriented programming
- Familiarity with the problem domain from previous chapters

**What to Focus On**: The underlying principles rather than specific syntax. The code examples illustrate patterns you can apply broadly.`,
      timing: 'before' as const,
    },
  ];

  return contextCards[0]; // Phase 1: Always return first card
}

/**
 * Generate mock "comprehension" card for after reading
 * Phase 2: Used to check understanding
 */
export function generateComprehensionCard(chapterTitle: string): AspirationCardContent {
  return {
    id: `comprehension-${chapterTitle}`,
    type: 'comprehension',
    title: 'Check Your Understanding',
    body: `**Quick Reflection**:

1. What was the main argument or theme in this section?
2. How does this connect to what you read earlier?
3. Is there anything you'd like to revisit or clarify?

*Tap to expand for more questions*`,
    timing: 'after',
  };
}

/**
 * Generate mock "reflection" card for after reading
 * Phase 2: Used for deeper thinking
 */
export function generateReflectionCard(chapterTitle: string): AspirationCardContent {
  return {
    id: `reflection-${chapterTitle}`,
    type: 'reflection',
    title: 'Reflect Deeper',
    body: `**Think About**:

- How does this idea challenge or confirm your existing beliefs?
- What would change if you applied this principle?
- What questions does this raise for you?

*Take a moment to consider before moving on*`,
    timing: 'after',
  };
}
```

#### Step 1.4: Create Zustand Store (1 hour)

Create `stores/aspirationCardsStore.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardDisplayState } from '@/types';

interface AspirationCardsStore {
  cardStates: Record<string, CardDisplayState>;
  currentCardId: string | null;

  showCard: (cardId: string, bookId: number) => void;
  dismissCard: (cardId: string) => void;
  toggleExpanded: (cardId: string) => void;
  shouldShowCard: (cardId: string, bookId: number) => boolean;
  resetForBook: (bookId: number) => void;
}

export const useAspirationCardsStore = create<AspirationCardsStore>()(
  persist(
    (set, get) => ({
      cardStates: {},
      currentCardId: null,

      showCard: (cardId, bookId) => {
        const { shouldShowCard } = get();
        if (!shouldShowCard(cardId, bookId)) {
          console.log('[AspirationCards] Card should not show:', cardId);
          return;
        }

        console.log('[AspirationCards] Showing card:', cardId);
        set((state) => ({
          currentCardId: cardId,
          cardStates: {
            ...state.cardStates,
            [cardId]: {
              cardId,
              bookId,
              isExpanded: true, // Phase 1: Start expanded for 'before' cards
              isDismissed: false,
              lastShownAt: new Date(),
            },
          },
        }));
      },

      dismissCard: (cardId) => {
        console.log('[AspirationCards] Dismissing card:', cardId);
        set((state) => ({
          currentCardId: null,
          cardStates: {
            ...state.cardStates,
            [cardId]: {
              ...state.cardStates[cardId],
              isDismissed: true,
              dismissedAt: new Date(),
            },
          },
        }));
      },

      toggleExpanded: (cardId) => {
        console.log('[AspirationCards] Toggling expanded:', cardId);
        set((state) => ({
          cardStates: {
            ...state.cardStates,
            [cardId]: {
              ...state.cardStates[cardId],
              isExpanded: !state.cardStates[cardId]?.isExpanded,
            },
          },
        }));
      },

      shouldShowCard: (cardId, bookId) => {
        const state = get().cardStates[cardId];

        // Never shown before
        if (!state) return true;

        // Different book
        if (state.bookId !== bookId) return true;

        // Dismissed
        if (state.isDismissed) {
          // Re-show after 7 days
          const daysSinceDismissed = state.dismissedAt
            ? (Date.now() - state.dismissedAt.getTime()) / (1000 * 60 * 60 * 24)
            : 999;
          return daysSinceDismissed > 7;
        }

        // Already shown in this session
        const hoursSinceShown = state.lastShownAt
          ? (Date.now() - state.lastShownAt.getTime()) / (1000 * 60 * 60)
          : 999;
        return hoursSinceShown > 1; // Re-show after 1 hour
      },

      resetForBook: (bookId) => {
        console.log('[AspirationCards] Resetting cards for book:', bookId);
        set((state) => {
          const filtered = Object.fromEntries(
            Object.entries(state.cardStates).filter(
              ([_, cardState]) => cardState.bookId !== bookId
            )
          );
          return { cardStates: filtered, currentCardId: null };
        });
      },
    }),
    {
      name: 'aspiration-cards-state',
      partialize: (state) => ({
        cardStates: state.cardStates,
      }),
    }
  )
);
```

#### Step 1.5: Create AspirationCard Component (1.5 hours)

Create `components/reader/AspirationCard.tsx`:

```typescript
'use client';

import React, { useEffect } from 'react';
import type { AspirationCardContent } from '@/types';

interface AspirationCardProps {
  content: AspirationCardContent;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onDismiss: () => void;
  position?: 'floating' | 'bottom'; // Desktop vs mobile
}

export default function AspirationCard({
  content,
  isExpanded,
  onToggleExpanded,
  onDismiss,
  position = 'floating',
}: AspirationCardProps) {
  // Handle Escape key to dismiss
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onDismiss]);

  // Compass icon for badge
  const CompassIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );

  // Card type determines badge label
  const getBadgeLabel = () => {
    switch (content.type) {
      case 'context': return 'Before You Read';
      case 'comprehension': return 'Check Understanding';
      case 'reflection': return 'Reflect Deeper';
      case 'connection': return 'Make Connections';
      default: return 'Reading Suggestion';
    }
  };

  // Container classes based on position
  const containerClasses = position === 'floating'
    ? `fixed bottom-24 right-4 md:right-8 z-35 max-w-md w-[calc(100%-2rem)] md:w-full
       bg-white dark:bg-gray-900 rounded-lg shadow-2xl
       border border-violet-200 dark:border-violet-800
       transform transition-all duration-300 ease-out
       translate-y-0 opacity-100`
    : `fixed bottom-0 left-0 right-0 z-35
       bg-white dark:bg-gray-900 rounded-t-xl shadow-2xl
       border-t border-violet-200 dark:border-violet-800
       transform transition-transform duration-300 ease-out
       translate-y-0 safe-area-bottom`;

  return (
    <div className={containerClasses}>
      {/* Header with badge and controls */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="inline-flex items-center gap-2 px-3 py-1.5
          bg-violet-50 dark:bg-violet-950
          text-violet-700 dark:text-violet-300
          text-xs font-medium rounded-full
          border border-violet-200 dark:border-violet-800">
          <CompassIcon />
          <span>{getBadgeLabel()}</span>
        </div>

        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss card"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content area */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {content.title}
        </h3>

        {/* Body in colored box */}
        <div className={`
          bg-violet-50/50 dark:bg-violet-950/30
          border-l-4 border-violet-500
          p-4 rounded-r-lg
          transition-all duration-300 ease-out
          ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-24 opacity-80'}
          overflow-hidden
        `}>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {content.body}
          </div>
        </div>

        {/* Expand/collapse toggle (Phase 2: will be collapsible) */}
        {content.body.length > 150 && (
          <button
            onClick={onToggleExpanded}
            className="mt-3 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                <span>Show less</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>Show more</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        )}

        {/* Action button (if provided) */}
        {content.action && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <a
              href={content.action.href}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                text-violet-700 dark:text-violet-300
                bg-violet-50 dark:bg-violet-950
                hover:bg-violet-100 dark:hover:bg-violet-900
                border border-violet-200 dark:border-violet-800
                rounded transition-colors"
            >
              {content.action.label}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Disclaimer for mock data */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-400 dark:text-gray-600">
          Mock suggestion for demonstration. Future versions will use AI-generated content.
        </p>
      </div>
    </div>
  );
}
```

#### Step 1.6: Create AspirationCardContainer Component (1 hour)

Create `components/reader/AspirationCardContainer.tsx`:

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { useAspirationCardsStore } from '@/stores/aspirationCardsStore';
import { generateContextCard } from '@/lib/mockAspirationCards';
import AspirationCard from './AspirationCard';
import type { AspirationCardContent } from '@/types';

interface AspirationCardContainerProps {
  bookId: number;
  currentCfi?: string;
  onCardDismiss?: (cardId: string) => void;
}

export default function AspirationCardContainer({
  bookId,
  currentCfi,
  onCardDismiss,
}: AspirationCardContainerProps) {
  const { currentCardId, cardStates, showCard, dismissCard, toggleExpanded } = useAspirationCardsStore();
  const [cardContent, setCardContent] = useState<AspirationCardContent | null>(null);

  // Phase 1: Show context card on mount (simulating "before reading" trigger)
  useEffect(() => {
    const contextCard = generateContextCard('Meditations', 'Book 1');
    setCardContent(contextCard);
    showCard(contextCard.id, bookId);
  }, [bookId, showCard]);

  // Get current card state
  const currentCard = currentCardId ? cardStates[currentCardId] : null;

  // Handle dismiss
  const handleDismiss = () => {
    if (currentCardId) {
      dismissCard(currentCardId);
      onCardDismiss?.(currentCardId);
      setCardContent(null);
    }
  };

  // Handle toggle expanded
  const handleToggleExpanded = () => {
    if (currentCardId) {
      toggleExpanded(currentCardId);
    }
  };

  // Don't render if no card or card is dismissed
  if (!currentCard || currentCard.isDismissed || !cardContent) {
    return null;
  }

  // Determine position based on screen size (desktop: floating, mobile: bottom)
  // Phase 1: Always floating, Phase 2 will add responsive logic
  const position = 'floating';

  return (
    <AspirationCard
      content={cardContent}
      isExpanded={currentCard.isExpanded}
      onToggleExpanded={handleToggleExpanded}
      onDismiss={handleDismiss}
      position={position}
    />
  );
}
```

#### Step 1.7: Integrate into ReaderView (30 min)

Edit `components/reader/ReaderView.tsx`:

```typescript
// Add import at top
import AspirationCardContainer from './AspirationCardContainer';

// Add state for aspirational mode (around line 50)
const [aspirationalMode, setAspirationalMode] = useState(true); // Phase 1: Always on for testing

// Add container in render (after audio player, before book content)
// Around line 616-626

{/* Aspiration Cards (z-35) - Phase 1 */}
{aspirationalMode && (
  <AspirationCardContainer
    bookId={bookId}
    currentCfi={currentLocation}
    onCardDismiss={(cardId) => {
      console.log('[ReaderView] Card dismissed:', cardId);
    }}
  />
)}

{/* Audio Player (z-30) */}
{currentAudioChapter && (
  <AudioPlayer {...audioPlayerProps} />
)}
```

**Success Criteria for Phase 1**:
- [ ] Card appears on reader load with purple/violet theme
- [ ] Card visually distinct from AI features (different color, icon, badge text)
- [ ] Expand/collapse works smoothly with 300ms animation
- [ ] Dismiss button hides card and persists state
- [ ] Card doesn't re-appear after dismissal on same session
- [ ] No z-index conflicts with audio player or AI drawers
- [ ] Dark mode works correctly
- [ ] Escape key dismisses card
- [ ] Console logs show card lifecycle events

**Testing Checklist**:
- [ ] Test in light mode
- [ ] Test in dark mode
- [ ] Test dismiss and reload (should not reappear)
- [ ] Test expand/collapse animation
- [ ] Test with audio player visible (no overlap at z-30)
- [ ] Test with AI drawer open (card should be below at z-35)
- [ ] Test keyboard navigation (Escape key)
- [ ] Test on mobile viewport (responsive sizing)

---

### Phase 2: Expandable "After Reading" Cards with State Management

**Goal**: Add collapsed-by-default "after reading" cards (comprehension, reflection) with full expand/collapse animations and mobile bottom sheet.

**Estimated Time**: 6-8 hours

**Prerequisites**:
- Phase 1 complete and tested
- Understanding of trigger logic for "after reading"

**Files to Modify**:
1. `lib/mockAspirationCards.ts` (add comprehension/reflection generators)
2. `components/reader/AspirationCard.tsx` (improve animations)
3. `components/reader/AspirationCardContainer.tsx` (add trigger logic)
4. `stores/aspirationCardsStore.ts` (update for collapsed state)

**Implementation Steps**:

#### Step 2.1: Enhance Mock Card Generator (30 min)

Edit `lib/mockAspirationCards.ts` - expand existing functions:

```typescript
// Add more comprehensive mock data
export function generateComprehensionCard(
  bookTitle: string,
  chapterTitle: string,
  pagesRead: number
): AspirationCardContent {
  const comprehensionCards = [
    {
      id: `comprehension-${bookTitle}-${chapterTitle}`,
      type: 'comprehension' as const,
      title: 'Quick Check: Did It Click?',
      body: `You just read ${pagesRead} pages. Let's see what stuck:

**Main Ideas**:
- Can you summarize the key point in one sentence?
- What was the author's strongest argument or example?

**Connections**:
- How does this build on what came before?
- What surprised you or contradicted expectations?

**Clarity**:
- Is there anything you'd like to revisit?
- Any concepts that need clarification?

*These questions help cement your understanding. No need to answer all - pick what resonates.*`,
      timing: 'after' as const,
    },
  ];

  return comprehensionCards[0];
}

export function generateReflectionCard(
  bookTitle: string,
  chapterTitle: string,
  genre: 'fiction' | 'nonfiction' | 'technical'
): AspirationCardContent {
  const reflectionsByGenre = {
    fiction: `**Go Deeper**:

Think about what you just read through a different lens:

- Which character's perspective resonated most? Why?
- How would you have acted in this situation?
- What does this reveal about human nature or society?

**Connection to Your Life**:
- Have you experienced something similar?
- What would you do differently knowing what the characters learned?

*Reflection turns passive reading into active learning. Take a moment before continuing.*`,

    nonfiction: `**Apply What You Learned**:

This section presented ideas and evidence. Now make them yours:

- Do you agree with the author's conclusions? Why or why not?
- What real-world examples can you think of?
- How might you use this information?

**Critical Thinking**:
- What assumptions is the author making?
- What counter-arguments exist?
- What questions does this raise?

*Active engagement helps ideas stick and evolve.*`,

    technical: `**Solidify Your Understanding**:

Technical content needs practice to sink in:

- Can you explain this concept to someone else?
- What would you build with this knowledge?
- Where might this approach not work?

**Next Steps**:
- Try coding an example without looking
- Think of edge cases the author didn't cover
- Consider how this fits into larger patterns

*Implementation is the best teacher. Consider experimenting before moving on.*`,
  };

  return {
    id: `reflection-${bookTitle}-${chapterTitle}`,
    type: 'reflection',
    title: 'Reflect & Retain',
    body: reflectionsByGenre[genre],
    timing: 'after',
  };
}
```

#### Step 2.2: Add Collapsed State to Store (30 min)

Edit `stores/aspirationCardsStore.ts`:

```typescript
// Update showCard to start collapsed for 'after' cards
showCard: (cardId, bookId, timing: 'before' | 'after' | 'during' = 'before') => {
  const { shouldShowCard } = get();
  if (!shouldShowCard(cardId, bookId)) {
    console.log('[AspirationCards] Card should not show:', cardId);
    return;
  }

  console.log('[AspirationCards] Showing card:', cardId);
  set((state) => ({
    currentCardId: cardId,
    cardStates: {
      ...state.cardStates,
      [cardId]: {
        cardId,
        bookId,
        isExpanded: timing === 'before', // Before: expanded, After: collapsed
        isDismissed: false,
        lastShownAt: new Date(),
      },
    },
  }));
},
```

#### Step 2.3: Improve Card Animations (1.5 hours)

Edit `components/reader/AspirationCard.tsx`:

```typescript
// Add animation state
const [isVisible, setIsVisible] = useState(false);

// Trigger entrance animation
useEffect(() => {
  setIsVisible(true);
}, []);

// Update container classes for entrance animation
const containerClasses = position === 'floating'
  ? `fixed bottom-24 right-4 md:right-8 z-35 max-w-md w-[calc(100%-2rem)] md:w-full
     bg-white dark:bg-gray-900 rounded-lg shadow-2xl
     border border-violet-200 dark:border-violet-800
     transform transition-all duration-300 ease-out
     ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`
  : `fixed bottom-0 left-0 right-0 z-35
     bg-white dark:bg-gray-900 rounded-t-xl shadow-2xl
     border-t border-violet-200 dark:border-violet-800
     transform transition-transform duration-300 ease-out
     ${isVisible ? 'translate-y-0' : 'translate-y-full'}
     safe-area-bottom`;

// Update body container for smooth expand/collapse
<div className={`
  bg-violet-50/50 dark:bg-violet-950/30
  border-l-4 border-violet-500
  p-4 rounded-r-lg
  transition-all duration-300 ease-out
  overflow-hidden
  ${isExpanded ? 'max-h-[500px]' : 'max-h-20'}
`}>
  <div className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line
    transition-opacity duration-200
    ${isExpanded ? 'opacity-100' : 'opacity-60'}`}>
    {isExpanded ? content.body : content.body.slice(0, 100) + '...'}
  </div>
</div>
```

#### Step 2.4: Add Mobile Bottom Sheet (2 hours)

Edit `components/reader/AspirationCard.tsx`:

```typescript
// Add responsive position detection
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768); // md breakpoint
  };

  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);

// Update position prop to be responsive
const effectivePosition = isMobile ? 'bottom' : position;

// Add swipe-to-dismiss for mobile
const [touchStart, setTouchStart] = useState<number | null>(null);
const [touchEnd, setTouchEnd] = useState<number | null>(null);

const handleTouchStart = (e: React.TouchEvent) => {
  setTouchEnd(null);
  setTouchStart(e.targetTouches[0].clientY);
};

const handleTouchMove = (e: React.TouchEvent) => {
  setTouchEnd(e.targetTouches[0].clientY);
};

const handleTouchEnd = () => {
  if (!touchStart || !touchEnd) return;

  const distance = touchStart - touchEnd;
  const isDownSwipe = distance < 0;
  const threshold = 50;

  // Swipe down to dismiss on mobile
  if (isDownSwipe && Math.abs(distance) > threshold) {
    onDismiss();
  }
};

// Add touch handlers to bottom sheet
{effectivePosition === 'bottom' && (
  <div
    className={containerClasses}
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
  >
    {/* Card content */}
  </div>
)}
```

#### Step 2.5: Add Trigger Logic for "After Reading" (2 hours)

Edit `components/reader/AspirationCardContainer.tsx`:

```typescript
import { generateContextCard, generateComprehensionCard, generateReflectionCard } from '@/lib/mockAspirationCards';

// Add trigger logic based on reading progress
const [lastCfi, setLastCfi] = useState<string | null>(null);
const [pagesReadInSession, setPagesReadInSession] = useState(0);

// Detect chapter completion (simplified for Phase 2)
useEffect(() => {
  if (!currentCfi || currentCfi === lastCfi) return;

  setLastCfi(currentCfi);
  setPagesReadInSession(prev => prev + 1);

  // Trigger "after reading" card after 10 page turns
  if (pagesReadInSession > 0 && pagesReadInSession % 10 === 0) {
    const card = Math.random() > 0.5
      ? generateComprehensionCard('Meditations', 'Book 1', pagesReadInSession)
      : generateReflectionCard('Meditations', 'Book 1', 'nonfiction');

    setCardContent(card);
    showCard(card.id, bookId, 'after');
  }
}, [currentCfi, lastCfi, pagesReadInSession, bookId, showCard]);
```

#### Step 2.6: Add Card Queue (Phase 2 Enhancement) (1 hour)

Edit `stores/aspirationCardsStore.ts`:

```typescript
interface AspirationCardsStore {
  // ... existing
  cardQueue: string[]; // Queue of card IDs to show

  enqueueCard: (cardId: string) => void;
  dequeueCard: () => string | null;
  clearQueue: () => void;
}

// Implementation
enqueueCard: (cardId) => {
  set((state) => ({
    cardQueue: [...state.cardQueue, cardId],
  }));
},

dequeueCard: () => {
  const { cardQueue } = get();
  if (cardQueue.length === 0) return null;

  const [nextCardId, ...rest] = cardQueue;
  set({ cardQueue: rest });
  return nextCardId;
},

clearQueue: () => {
  set({ cardQueue: [] });
},
```

**Success Criteria for Phase 2**:
- [ ] Cards start collapsed for "after reading" type
- [ ] Expand animation smooth (300ms)
- [ ] Collapse shows truncated preview
- [ ] Mobile bottom sheet works on < 768px viewport
- [ ] Swipe down to dismiss on mobile
- [ ] Comprehension and reflection cards trigger after 10 pages
- [ ] Card queue prevents multiple cards showing simultaneously
- [ ] State persists across page reloads
- [ ] Performance: No jank during animations

**Testing Checklist**:
- [ ] Test expand/collapse on desktop
- [ ] Test bottom sheet on mobile (use DevTools responsive mode)
- [ ] Test swipe-to-dismiss gesture
- [ ] Read 15+ pages and verify cards appear
- [ ] Test card queue (dismiss one, next should appear)
- [ ] Test with slow 3G throttling (animations should still be smooth)
- [ ] Test state persistence (reload page, check cardStates in localStorage)

---

### Phase 3: Full Aspirational Mode with All Card Types

**Goal**: Complete implementation with all card types, intelligent triggers, settings integration, and production polish.

**Estimated Time**: 8-12 hours

**Prerequisites**:
- Phase 1 & 2 complete and tested
- Reading analytics available (Phase 3 of main plan)

**Files to Create**:
1. `lib/cardTriggers.ts` (trigger logic)
2. `components/settings/AspirationModeSettings.tsx` (settings panel)

**Files to Modify**:
1. `lib/mockAspirationCards.ts` (add connection cards)
2. `components/reader/AspirationCardContainer.tsx` (full trigger system)
3. `components/reader/SettingsDrawer.tsx` (add toggle)
4. `stores/aspirationCardsStore.ts` (add preferences)

**Implementation Steps**:

#### Step 3.1: Add Connection Card Type (1 hour)

Edit `lib/mockAspirationCards.ts`:

```typescript
export function generateConnectionCard(
  bookTitle: string,
  chapterTitle: string,
  previousChapters: string[]
): AspirationCardContent {
  return {
    id: `connection-${bookTitle}-${chapterTitle}`,
    type: 'connection',
    title: 'Make Connections',
    body: `**Relate to Earlier Ideas**:

This section builds on themes from earlier chapters. Think about:

- How does this connect to "${previousChapters[0]}"?
- What patterns are emerging across chapters?
- Is the author reinforcing or challenging earlier points?

**Your Experience**:
- What from your life relates to this?
- How does this confirm or challenge what you already knew?

*Building connections strengthens memory and deepens understanding.*`,
    timing: 'after',
  };
}
```

#### Step 3.2: Create Trigger Logic System (2 hours)

Create `lib/cardTriggers.ts`:

```typescript
import type { AspirationCardContent } from '@/types';
import {
  generateContextCard,
  generateComprehensionCard,
  generateReflectionCard,
  generateConnectionCard
} from './mockAspirationCards';

export interface ReadingContext {
  bookId: number;
  bookTitle: string;
  currentChapter: string;
  pagesRead: number;
  sessionTime: number; // minutes
  slowdownDetected: boolean;
  rereadDetected: boolean;
  genre: 'fiction' | 'nonfiction' | 'technical';
}

export interface TriggerResult {
  shouldTrigger: boolean;
  card: AspirationCardContent | null;
  priority: number; // 1-10, higher = more urgent
}

/**
 * Determine which card (if any) to show based on reading context
 */
export function evaluateTriggers(context: ReadingContext): TriggerResult {
  // Priority 1: Slowdown/difficulty detected (during reading)
  if (context.slowdownDetected || context.rereadDetected) {
    // Future: Would trigger difficulty support card
    return { shouldTrigger: false, card: null, priority: 0 };
  }

  // Priority 2: Chapter start (before reading)
  if (context.pagesRead === 0) {
    return {
      shouldTrigger: true,
      card: generateContextCard(context.bookTitle, context.currentChapter),
      priority: 8,
    };
  }

  // Priority 3: Comprehension check after significant reading
  if (context.pagesRead > 0 && context.pagesRead % 15 === 0) {
    return {
      shouldTrigger: true,
      card: generateComprehensionCard(context.bookTitle, context.currentChapter, context.pagesRead),
      priority: 6,
    };
  }

  // Priority 4: Reflection prompt after medium session
  if (context.sessionTime > 20 && context.pagesRead % 20 === 0) {
    return {
      shouldTrigger: true,
      card: generateReflectionCard(context.bookTitle, context.currentChapter, context.genre),
      priority: 5,
    };
  }

  // Priority 5: Connection card periodically
  if (context.pagesRead > 0 && context.pagesRead % 25 === 0) {
    return {
      shouldTrigger: true,
      card: generateConnectionCard(context.bookTitle, context.currentChapter, ['Previous Chapter']),
      priority: 4,
    };
  }

  return { shouldTrigger: false, card: null, priority: 0 };
}

/**
 * Rate limiting: Don't overwhelm reader with cards
 */
export function shouldAllowNewCard(
  lastCardShown: Date | null,
  minMinutesBetweenCards: number = 5
): boolean {
  if (!lastCardShown) return true;

  const minutesSinceLastCard = (Date.now() - lastCardShown.getTime()) / (1000 * 60);
  return minutesSinceLastCard >= minMinutesBetweenCards;
}
```

#### Step 3.3: Integrate Trigger System (2 hours)

Edit `components/reader/AspirationCardContainer.tsx`:

```typescript
import { evaluateTriggers, shouldAllowNewCard } from '@/lib/cardTriggers';
import { useSession } from '@/hooks/useSession';

export default function AspirationCardContainer({
  bookId,
  currentCfi,
  onCardDismiss,
}: AspirationCardContainerProps) {
  const { currentCardId, cardStates, showCard, dismissCard, toggleExpanded } = useAspirationCardsStore();
  const [cardContent, setCardContent] = useState<AspirationCardContent | null>(null);
  const [pagesReadInSession, setPagesReadInSession] = useState(0);
  const [lastCfi, setLastCfi] = useState<string | null>(null);
  const [lastCardShown, setLastCardShown] = useState<Date | null>(null);

  // Get session data
  const { pagesRead, sessionStartTime } = useSession({ bookId, currentCfi });

  // Evaluate triggers on page turn
  useEffect(() => {
    if (!currentCfi || currentCfi === lastCfi) return;

    setLastCfi(currentCfi);
    setPagesReadInSession(prev => prev + 1);

    // Check rate limiting
    if (!shouldAllowNewCard(lastCardShown, 5)) {
      console.log('[AspirationCards] Rate limited, skipping trigger evaluation');
      return;
    }

    // Evaluate what card to show
    const sessionTime = Math.floor((Date.now() - sessionStartTime.getTime()) / 60000);
    const context = {
      bookId,
      bookTitle: 'Meditations', // Mock - would come from book metadata
      currentChapter: 'Book 1',  // Mock - would come from EPUB navigation
      pagesRead: pagesReadInSession,
      sessionTime,
      slowdownDetected: false,   // Phase 3 adaptive features
      rereadDetected: false,     // Phase 3 adaptive features
      genre: 'nonfiction' as const,
    };

    const triggerResult = evaluateTriggers(context);

    if (triggerResult.shouldTrigger && triggerResult.card) {
      console.log('[AspirationCards] Trigger fired:', triggerResult.card.type, 'Priority:', triggerResult.priority);
      setCardContent(triggerResult.card);
      showCard(triggerResult.card.id, bookId, triggerResult.card.timing);
      setLastCardShown(new Date());
    }
  }, [currentCfi, lastCfi, pagesReadInSession, bookId, showCard, lastCardShown, sessionStartTime]);

  // ... rest of component
}
```

#### Step 3.4: Add Settings Integration (2 hours)

Create `components/settings/AspirationModeSettings.tsx`:

```typescript
'use client';

import React from 'react';
import { useAspirationCardsStore } from '@/stores/aspirationCardsStore';

export default function AspirationModeSettings() {
  // Future: These would be in store
  const [enabled, setEnabled] = React.useState(true);
  const [frequency, setFrequency] = React.useState<'low' | 'medium' | 'high'>('medium');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Aspirational Reading Mode
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Get contextual suggestions and reflection prompts while reading
        </p>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-300">Enable cards</span>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors duration-200 ease-in-out
            ${enabled ? 'bg-violet-600' : 'bg-gray-200 dark:bg-gray-700'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white
              transition-transform duration-200 ease-in-out
              ${enabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {/* Frequency */}
      {enabled && (
        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">
            Frequency
          </label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFrequency(level)}
                className={`
                  flex-1 px-3 py-2 text-xs font-medium rounded
                  transition-colors duration-200
                  ${frequency === level
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {frequency === 'low' && 'Cards appear every 20-30 pages'}
            {frequency === 'medium' && 'Cards appear every 10-15 pages'}
            {frequency === 'high' && 'Cards appear every 5-10 pages'}
          </p>
        </div>
      )}

      {/* Card Types */}
      {enabled && (
        <div>
          <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block">
            Card Types
          </label>
          <div className="space-y-2">
            {[
              { id: 'context', label: 'Before Reading (Context)' },
              { id: 'comprehension', label: 'After Reading (Comprehension)' },
              { id: 'reflection', label: 'After Reading (Reflection)' },
              { id: 'connection', label: 'After Reading (Connections)' },
            ].map((type) => (
              <label key={type.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {type.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Edit `components/reader/SettingsDrawer.tsx` to add the settings panel:

```typescript
import AspirationModeSettings from '../settings/AspirationModeSettings';

// Add in settings sections (around line 120-180)
{/* Aspiration Mode Settings */}
<div className="border-t border-gray-200 dark:border-gray-700 pt-6">
  <AspirationModeSettings />
</div>
```

#### Step 3.5: Add Analytics & Polish (2 hours)

Edit `stores/aspirationCardsStore.ts`:

```typescript
interface CardAnalytics {
  cardId: string;
  shown: number;      // Times shown
  dismissed: number;  // Times dismissed
  expanded: number;   // Times expanded
  avgTimeVisible: number; // Seconds
}

interface AspirationCardsStore {
  // ... existing
  analytics: Record<string, CardAnalytics>;

  trackCardShown: (cardId: string) => void;
  trackCardExpanded: (cardId: string) => void;
  getCardAnalytics: (cardId: string) => CardAnalytics | null;
}

// Implementation
trackCardShown: (cardId) => {
  set((state) => ({
    analytics: {
      ...state.analytics,
      [cardId]: {
        ...state.analytics[cardId],
        shown: (state.analytics[cardId]?.shown || 0) + 1,
      },
    },
  }));
},

trackCardExpanded: (cardId) => {
  set((state) => ({
    analytics: {
      ...state.analytics,
      [cardId]: {
        ...state.analytics[cardId],
        expanded: (state.analytics[cardId]?.expanded || 0) + 1,
      },
    },
  }));
},
```

#### Step 3.6: Error Boundaries & Loading States (1 hour)

Edit `components/reader/AspirationCardContainer.tsx`:

```typescript
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function AspirationCardContainer(props: AspirationCardContainerProps) {
  return (
    <ErrorBoundary level="feature" fallback={null}>
      <AspirationCardContainerContent {...props} />
    </ErrorBoundary>
  );
}

function AspirationCardContainerContent({...}: AspirationCardContainerProps) {
  // ... existing implementation

  // Add loading state
  const [isLoading, setIsLoading] = useState(false);

  // Simulate async card generation (future: would be real AI call)
  const loadCard = async (cardGenerator: () => AspirationCardContent) => {
    setIsLoading(true);

    try {
      // Simulate 200ms delay for card generation
      await new Promise(resolve => setTimeout(resolve, 200));
      const card = cardGenerator();
      setCardContent(card);
      showCard(card.id, bookId, card.timing);
    } catch (error) {
      console.error('[AspirationCards] Error loading card:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading spinner while card generates
  if (isLoading) {
    return (
      <div className="fixed bottom-24 right-8 z-35 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 border border-violet-200 dark:border-violet-800">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Preparing suggestion...
          </span>
        </div>
      </div>
    );
  }

  // ... rest of component
}
```

#### Step 3.7: Accessibility Improvements (1.5 hours)

Edit `components/reader/AspirationCard.tsx`:

```typescript
// Add ARIA attributes
<div
  className={containerClasses}
  role="complementary"
  aria-label="Reading suggestion card"
  aria-live="polite"
>
  {/* Keyboard navigation */}
  <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700">
    <div className="inline-flex items-center gap-2 px-3 py-1.5"
      role="status"
      aria-label={`${getBadgeLabel()} card`}
    >
      <CompassIcon aria-hidden="true" />
      <span>{getBadgeLabel()}</span>
    </div>

    <button
      onClick={onDismiss}
      className="text-gray-400 hover:text-gray-600"
      aria-label="Dismiss reading suggestion"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDismiss();
        }
      }}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>

  {/* Content area */}
  <div className="p-4">
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3" id="card-title">
      {content.title}
    </h3>

    <div className="..." aria-labelledby="card-title">
      {/* Card content */}
    </div>

    {/* Expand/collapse */}
    {content.body.length > 150 && (
      <button
        onClick={onToggleExpanded}
        className="mt-3 text-xs font-medium text-violet-600"
        aria-expanded={isExpanded}
        aria-controls="card-content"
        tabIndex={0}
      >
        {/* ... button content */}
      </button>
    )}
  </div>
</div>

// Announce card to screen readers
useEffect(() => {
  if (isVisible) {
    // Announce new card after animation completes
    setTimeout(() => {
      const announcement = `New reading suggestion: ${content.title}`;
      // Use aria-live region (already set on container)
      console.log('[A11y]', announcement);
    }, 300);
  }
}, [isVisible, content.title]);
```

#### Step 3.8: Performance Optimization (1 hour)

Edit `components/reader/AspirationCardContainer.tsx`:

```typescript
import { memo, useCallback, useMemo } from 'react';

// Memoize card evaluation
const AspirationCardContainerContent = memo(function AspirationCardContainerContent({
  bookId,
  currentCfi,
  onCardDismiss,
}: AspirationCardContainerProps) {
  // ... existing implementation

  // Memoize expensive calculations
  const sessionTime = useMemo(() => {
    return Math.floor((Date.now() - sessionStartTime.getTime()) / 60000);
  }, [sessionStartTime]);

  // Memoize callbacks
  const handleDismiss = useCallback(() => {
    if (currentCardId) {
      dismissCard(currentCardId);
      onCardDismiss?.(currentCardId);
      setCardContent(null);
    }
  }, [currentCardId, dismissCard, onCardDismiss]);

  const handleToggleExpanded = useCallback(() => {
    if (currentCardId) {
      toggleExpanded(currentCardId);
    }
  }, [currentCardId, toggleExpanded]);

  // Throttle trigger evaluation
  const evaluateTriggersThrottled = useMemo(() => {
    let lastEvaluation = 0;

    return () => {
      const now = Date.now();
      if (now - lastEvaluation < 1000) return; // Max 1 evaluation per second

      lastEvaluation = now;
      // ... trigger evaluation logic
    };
  }, []);

  // ... rest of component
});
```

**Success Criteria for Phase 3**:
- [ ] All card types (context, comprehension, reflection, connection) working
- [ ] Intelligent triggers based on reading context
- [ ] Rate limiting prevents card spam
- [ ] Settings integration with toggle and preferences
- [ ] Analytics tracking card engagement
- [ ] Error boundaries prevent crashes
- [ ] Loading states during card generation
- [ ] Full accessibility (keyboard nav, screen readers, ARIA)
- [ ] Performance: < 5ms for trigger evaluation
- [ ] Memory: < 10MB total for card system

**Testing Checklist**:
- [ ] Read 50+ pages, verify all card types appear at appropriate times
- [ ] Test settings toggle (enable/disable cards)
- [ ] Test frequency settings (low/medium/high)
- [ ] Test rate limiting (cards don't appear too frequently)
- [ ] Test analytics (check localStorage for tracked data)
- [ ] Test error handling (throw error in card generator, verify error boundary)
- [ ] Test accessibility with VoiceOver/NVDA screen reader
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Profile with React DevTools (check for unnecessary rerenders)
- [ ] Test memory usage with Chrome DevTools (heap snapshot)

---

## Testing Strategy

### Unit Testing

**Mock Data Tests** (`lib/mockAspirationCards.test.ts`):
```typescript
describe('mockAspirationCards', () => {
  test('generateContextCard returns valid card structure', () => {
    const card = generateContextCard('Test Book', 'Chapter 1');
    expect(card.type).toBe('context');
    expect(card.timing).toBe('before');
    expect(card.body.length).toBeGreaterThan(0);
  });

  test('generateComprehensionCard includes page count', () => {
    const card = generateComprehensionCard('Test', 'Ch1', 15);
    expect(card.body).toContain('15 pages');
  });
});
```

**Store Tests** (`stores/aspirationCardsStore.test.ts`):
```typescript
describe('aspirationCardsStore', () => {
  test('showCard creates new state', () => {
    const { showCard, cardStates } = useAspirationCardsStore.getState();
    showCard('test-card', 1, 'before');

    expect(cardStates['test-card']).toBeDefined();
    expect(cardStates['test-card'].isExpanded).toBe(true);
  });

  test('dismissCard sets isDismissed flag', () => {
    const { showCard, dismissCard, cardStates } = useAspirationCardsStore.getState();
    showCard('test-card', 1, 'before');
    dismissCard('test-card');

    expect(cardStates['test-card'].isDismissed).toBe(true);
  });

  test('shouldShowCard respects 7-day dismissal period', () => {
    const { showCard, dismissCard, shouldShowCard } = useAspirationCardsStore.getState();
    showCard('test-card', 1, 'before');
    dismissCard('test-card');

    expect(shouldShowCard('test-card', 1)).toBe(false);
  });
});
```

**Trigger Logic Tests** (`lib/cardTriggers.test.ts`):
```typescript
describe('cardTriggers', () => {
  test('evaluateTriggers shows context card at chapter start', () => {
    const result = evaluateTriggers({
      bookId: 1,
      bookTitle: 'Test',
      currentChapter: 'Ch1',
      pagesRead: 0,
      sessionTime: 0,
      slowdownDetected: false,
      rereadDetected: false,
      genre: 'fiction',
    });

    expect(result.shouldTrigger).toBe(true);
    expect(result.card?.type).toBe('context');
  });

  test('shouldAllowNewCard respects rate limit', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(shouldAllowNewCard(fiveMinutesAgo, 5)).toBe(true);

    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
    expect(shouldAllowNewCard(fourMinutesAgo, 5)).toBe(false);
  });
});
```

### Integration Testing

**ReaderView Integration** (manual testing):
1. Open book in reader
2. Verify context card appears within 2 seconds
3. Dismiss card, verify it disappears
4. Reload page, verify card doesn't reappear
5. Read 15 pages, verify comprehension card appears
6. Test with audio player active (no z-index conflicts)
7. Test with AI drawer open (card below drawer)

**Mobile Testing** (use DevTools responsive mode):
1. Resize to 375px width (iPhone)
2. Verify bottom sheet positioning
3. Test swipe-down-to-dismiss gesture
4. Verify safe area handling
5. Test with iOS notch simulation
6. Test landscape orientation

### Performance Testing

**Animation Performance**:
```bash
# Chrome DevTools Performance tab
1. Start recording
2. Trigger card appearance
3. Expand/collapse card
4. Dismiss card
5. Stop recording
6. Verify 60fps during animations (16.67ms frame budget)
```

**Memory Testing**:
```bash
# Chrome DevTools Memory tab
1. Take heap snapshot (baseline)
2. Show/dismiss 20 cards
3. Take second heap snapshot
4. Compare (should be < 5MB increase)
5. Look for detached DOM nodes (should be 0)
```

**State Persistence Testing**:
```javascript
// Browser console
localStorage.getItem('aspiration-cards-state')
// Should show JSON with cardStates
```

### Accessibility Testing

**Keyboard Navigation**:
1. Tab to card (should focus dismiss button)
2. Press Enter (should dismiss)
3. Tab to expand button (if present)
4. Press Space (should toggle expand)
5. Press Escape (should dismiss from anywhere)

**Screen Reader Testing** (VoiceOver on Mac):
1. Enable VoiceOver (Cmd+F5)
2. Navigate to card
3. Verify announcement: "Reading suggestion card, Before You Read"
4. Navigate through content
5. Verify dismiss button labeled correctly
6. Verify expand/collapse state announced

### Edge Cases

**Edge Case Checklist**:
- [ ] What happens if card generator throws error? (Error boundary should catch)
- [ ] What if localStorage is full? (Persist middleware should handle gracefully)
- [ ] What if user dismisses card during animation? (Animation should complete, then remove)
- [ ] What if two triggers fire simultaneously? (Rate limiting should prevent)
- [ ] What if user switches books mid-card? (Card should dismiss or update)
- [ ] What if card content is extremely long? (Scroll container with max-height)
- [ ] What if browser doesn't support backdrop-filter? (Solid background fallback)
- [ ] What if user has prefers-reduced-motion? (Disable animations)

## Risk Assessment

### Technical Risks

**Risk 1: Z-Index Conflicts**
- **Likelihood**: Medium
- **Impact**: High (cards could be hidden or block content)
- **Mitigation**:
  - Thoroughly test with all existing overlays
  - Use z-35 (between audio player and drawers)
  - Document z-index hierarchy in constants.ts

**Risk 2: Performance Degradation**
- **Likelihood**: Low
- **Impact**: High (janky reading experience)
- **Mitigation**:
  - Memoize expensive calculations
  - Throttle trigger evaluations
  - Use CSS transforms for animations (GPU-accelerated)
  - Profile with React DevTools and Chrome Performance

**Risk 3: State Synchronization Issues**
- **Likelihood**: Medium
- **Impact**: Medium (cards reappearing when they shouldn't)
- **Mitigation**:
  - Comprehensive store tests
  - Clear state on book change
  - Version state schema for future migrations

**Risk 4: Mobile UX Complexity**
- **Likelihood**: Medium
- **Impact**: Medium (poor mobile experience)
- **Mitigation**:
  - Test on real devices (not just DevTools)
  - Follow bottom sheet best practices
  - Respect safe areas and system gestures

### Product Risks

**Risk 1: Cards Feel Intrusive**
- **Likelihood**: Medium
- **Impact**: High (users disable feature)
- **Mitigation**:
  - Rate limiting (max 1 per 5 minutes)
  - Easy dismissal (swipe, Escape, close button)
  - Settings to control frequency
  - Start with conservative trigger thresholds

**Risk 2: Visual Confusion with AI Features**
- **Likelihood**: Low
- **Impact**: Medium (users don't understand distinction)
- **Mitigation**:
  - Clear visual differentiation (purple vs sky blue)
  - Different icon (compass vs sparkle)
  - Different label ("Reading Suggestion" vs "AI Generated")
  - Consistent badge pattern users learn

**Risk 3: Mock Data Feels Generic**
- **Likelihood**: High
- **Impact**: Low (acceptable for Phase 1-3)
- **Mitigation**:
  - Vary mock content by genre/context
  - Add disclaimer about mock data
  - Plan for real AI integration in future phases
  - Focus on UX patterns, not content quality

## Deployment & Migration

### Deployment Strategy

**Phase 1 Deployment**:
1. Merge feature branch with Phase 1 complete
2. Deploy to staging environment
3. Internal testing (2-3 days)
4. Fix critical bugs
5. Deploy to production with feature flag OFF
6. Enable for 10% of users
7. Monitor analytics and error rates
8. Gradual rollout to 100%

**Phase 2 Deployment**:
1. Merge Phase 2 on top of Phase 1
2. Staging testing (focus on mobile)
3. Production deploy with same gradual rollout

**Phase 3 Deployment**:
1. Full QA cycle (all card types, triggers, settings)
2. Accessibility audit
3. Performance benchmarks
4. Gradual production rollout

### Feature Flags

```typescript
// lib/featureFlags.ts (to be created)
export const FEATURE_FLAGS = {
  ASPIRATION_CARDS_ENABLED: process.env.NEXT_PUBLIC_ASPIRATION_CARDS === 'true',
  ASPIRATION_CARDS_PHASE: parseInt(process.env.NEXT_PUBLIC_ASPIRATION_CARDS_PHASE || '0'),
};

// components/reader/ReaderView.tsx
import { FEATURE_FLAGS } from '@/lib/featureFlags';

const [aspirationalMode, setAspirationalMode] = useState(
  FEATURE_FLAGS.ASPIRATION_CARDS_ENABLED
);
```

### Migration Considerations

**State Schema Versioning**:
```typescript
// stores/aspirationCardsStore.ts
interface AspirationCardsStore {
  version: number; // Schema version for migrations
  // ...
}

// On store initialization
const currentVersion = 1;
const storedVersion = stored?.version || 0;

if (storedVersion < currentVersion) {
  // Migrate state
  console.log('[AspirationCards] Migrating state from v%d to v%d', storedVersion, currentVersion);
  // ... migration logic
}
```

**Backward Compatibility**:
- Phase 2 must work if Phase 1 state exists
- Phase 3 must work if Phase 1 or Phase 2 state exists
- Never delete old state fields without migration

## Documentation Requirements

### Code Documentation

**JSDoc Comments** (required for all exported functions):
```typescript
/**
 * Generate a context card to show before reading a chapter
 *
 * @param bookTitle - Title of the book being read
 * @param chapterTitle - Optional chapter title for context
 * @returns AspirationCardContent with 'before' timing
 *
 * @example
 * const card = generateContextCard('Meditations', 'Book 1');
 * // Returns: { id: 'context-...', type: 'context', ... }
 */
export function generateContextCard(
  bookTitle: string,
  chapterTitle?: string
): AspirationCardContent { ... }
```

**Component Documentation** (`components/reader/AspirationCard.tsx`):
```typescript
/**
 * AspirationCard Component
 *
 * Displays a single aspirational reading card with expand/collapse
 * and dismiss interactions. Cards use purple/violet theme to
 * distinguish from AI features (sky blue).
 *
 * @component
 *
 * @prop {AspirationCardContent} content - Card data (title, body, type)
 * @prop {boolean} isExpanded - Current expanded state
 * @prop {() => void} onToggleExpanded - Handler for expand/collapse
 * @prop {() => void} onDismiss - Handler for dismissal
 * @prop {'floating' | 'bottom'} position - Desktop vs mobile layout
 *
 * @example
 * <AspirationCard
 *   content={cardContent}
 *   isExpanded={true}
 *   onToggleExpanded={() => {}}
 *   onDismiss={() => {}}
 *   position="floating"
 * />
 */
```

### User-Facing Documentation

**Help Text in Settings**:
```
Aspirational Reading Mode

Get contextual suggestions and reflection prompts while you read.
Cards appear at natural break points to enhance comprehension and
retention without interrupting your flow.

Types of cards:
• Before Reading: Background context to prepare you
• After Reading: Comprehension checks and reflection prompts
• During Reading: Support when you slow down (future)

You can dismiss any card and control how often they appear.
```

**Implementation Details Document** (this plan serves as primary doc)

**API Documentation** (for stores and utilities):
- `stores/aspirationCardsStore.ts` - State management API
- `lib/mockAspirationCards.ts` - Card content generators
- `lib/cardTriggers.ts` - Trigger evaluation logic

## Success Metrics

### Phase 1 Success Metrics

**Technical Metrics**:
- [ ] Card renders in < 100ms
- [ ] Animation runs at 60fps (16.67ms frames)
- [ ] No console errors or warnings
- [ ] State persists correctly (localStorage)
- [ ] All TypeScript errors resolved
- [ ] No accessibility violations (WAVE scan)

**UX Metrics** (to be tracked in analytics):
- Card dismissal rate < 50% (shows value)
- Average time visible > 10 seconds (users read it)
- Zero z-index conflicts reported

### Phase 2 Success Metrics

**Technical Metrics**:
- [ ] Mobile bottom sheet works on all viewports
- [ ] Swipe gesture 90%+ success rate
- [ ] Expand/collapse smooth on slow devices
- [ ] Queue system prevents card spam
- [ ] State migrations work correctly

**UX Metrics**:
- Expand rate > 30% (users engage)
- Mobile dismissal rate similar to desktop
- Zero gesture conflict reports

### Phase 3 Success Metrics

**Technical Metrics**:
- [ ] All card types trigger correctly
- [ ] Rate limiting works (no spam)
- [ ] Settings integration complete
- [ ] Analytics tracking functional
- [ ] Memory usage < 10MB
- [ ] Error boundaries catch all errors

**UX Metrics**:
- Feature enabled rate > 70% (users keep it on)
- Card value rating > 3.5/5 (user survey)
- Comprehension card engagement > 40%
- Reflection card engagement > 25%

### Long-Term Success Metrics

**Engagement**:
- Daily active users with cards enabled > 60%
- Cards per session: 2-4 (sweet spot)
- Feature satisfaction score > 4/5

**Learning Outcomes** (future research):
- Comprehension test scores (with vs without cards)
- Reading session duration (cards increase?)
- Book completion rate (cards help?)

## Appendix

### ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ ReaderView.tsx (Parent Component)                              │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Z-Index: 50 (Overlay Content)                          │   │
│  │ - SettingsDrawer                                       │   │
│  │ - AiRecap                                              │   │
│  │ - AiExplanation                                        │   │
│  │ - AiChapterSummary                                     │   │
│  │ - ChapterList                                          │   │
│  │ - NoteEditor                                           │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Z-Index: 40 (Overlay Backdrops)                       │   │
│  │ - Semi-transparent black backdrop for above overlays   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Z-Index: 35 (NEW: Aspiration Cards Layer)             │   │
│  │                                                         │   │
│  │  AspirationCardContainer                               │   │
│  │   ├─ State: currentCardId, cardStates                  │   │
│  │   ├─ Logic: evaluateTriggers on page turn             │   │
│  │   └─ Renders: AspirationCard                          │   │
│  │                                                         │   │
│  │     AspirationCard                                     │   │
│  │      ├─ Badge (purple theme, compass icon)            │   │
│  │      ├─ Content (expandable/collapsible)              │   │
│  │      ├─ Dismiss button (X icon)                       │   │
│  │      └─ Animation (fade + slide, 300ms)               │   │
│  │                                                         │   │
│  │  Position:                                             │   │
│  │   - Desktop: Floating bottom-right (max-w-md)         │   │
│  │   - Mobile: Bottom sheet (full width, slide up)       │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Z-Index: 30 (Audio Player)                             │   │
│  │ - Bottom bar with playback controls                    │   │
│  │ - Hybrid mode with reading progress                    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Z-Index: 10 (Top Controls)                             │   │
│  │ - Library link, AI buttons, Chapters, Settings        │   │
│  │ - Auto-hide after 3 seconds                            │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Z-Index: 0 (Book Content - Base Layer)                │   │
│  │                                                         │   │
│  │  TapZones (navigation)                                 │   │
│  │   └─ <div ref={containerRef}>                         │   │
│  │       Epub.js Rendition (iframe)                      │   │
│  │       - Book text                                      │   │
│  │       - Highlights                                     │   │
│  │       - Typography applied                             │   │
│  │      </div>                                            │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### State Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ User Action: Page Turn                                      │
└────────────┬─────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ ReaderView: currentCfi changes                             │
│ - useEffect detects CFI change                             │
│ - Increments pagesReadInSession                            │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ AspirationCardContainer: evaluateTriggers()                │
│ - Build ReadingContext from session data                   │
│ - Call cardTriggers.evaluateTriggers(context)              │
│ - Check shouldAllowNewCard (rate limiting)                 │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Trigger Logic: Determine Card Type                        │
│ - pagesRead === 0 → Context Card (priority 8)             │
│ - pagesRead % 15 === 0 → Comprehension (priority 6)       │
│ - pagesRead % 20 === 0 → Reflection (priority 5)          │
│ - pagesRead % 25 === 0 → Connection (priority 4)          │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Mock Card Generator: generateCard(type)                   │
│ - mockAspirationCards.generateContextCard() or            │
│ - mockAspirationCards.generateComprehensionCard() etc.     │
│ - Returns AspirationCardContent                            │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ Store Action: showCard(cardId, bookId, timing)            │
│ - Check shouldShowCard (not dismissed, not shown recently) │
│ - Update cardStates map                                    │
│ - Set currentCardId                                        │
│ - Set isExpanded based on timing                           │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ AspirationCard: Render                                     │
│ - Animate entrance (fade + slide, 300ms)                   │
│ - Display badge, title, content                            │
│ - Handle expand/collapse interaction                       │
│ - Handle dismiss interaction                               │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ User Interaction: Dismiss / Expand / Ignore                │
│                                                             │
│ If Dismiss:                                                │
│   ├─ Store: dismissCard(cardId)                           │
│   ├─ Set isDismissed = true                               │
│   ├─ Set dismissedAt = now                                │
│   └─ Remove from view (fade out 300ms)                    │
│                                                             │
│ If Expand/Collapse:                                        │
│   ├─ Store: toggleExpanded(cardId)                        │
│   ├─ Flip isExpanded boolean                              │
│   └─ Animate height change (300ms)                        │
│                                                             │
│ If Ignore:                                                 │
│   └─ Card persists until explicit dismiss                 │
└─────────────────────────────────────────────────────────────┘
```

### Component Props Reference

**AspirationCard.tsx**:
```typescript
interface AspirationCardProps {
  content: AspirationCardContent;      // Card data
  isExpanded: boolean;                 // Expand/collapse state
  onToggleExpanded: () => void;        // Toggle handler
  onDismiss: () => void;               // Dismiss handler
  position?: 'floating' | 'bottom';    // Layout mode
}
```

**AspirationCardContainer.tsx**:
```typescript
interface AspirationCardContainerProps {
  bookId: number;                      // Current book ID
  currentCfi?: string;                 // Current reading position
  onCardDismiss?: (cardId: string) => void; // Dismiss callback
}
```

**AspirationCardContent** (types/index.ts):
```typescript
interface AspirationCardContent {
  id: string;                          // Unique ID
  type: AspirationCardType;            // context | comprehension | reflection | connection
  title: string;                       // Card heading
  body: string;                        // Main content (markdown-style)
  action?: {                           // Optional CTA
    label: string;
    href?: string;
  };
  timing: 'before' | 'after' | 'during'; // When to show
}
```

**CardDisplayState** (types/index.ts):
```typescript
interface CardDisplayState {
  cardId: string;                      // Card identifier
  bookId: number;                      // Associated book
  isExpanded: boolean;                 // Current expand state
  isDismissed: boolean;                // User dismissed?
  dismissedAt?: Date;                  // When dismissed
  lastShownAt: Date;                   // Last time shown
}
```

### Color Palette Reference

**Aspiration Cards (Purple/Violet)**:
```css
/* Light Mode */
--card-bg: #FAF5FF;        /* violet-50 */
--card-bg-accent: #F3E8FF; /* violet-100 */
--card-border: #A78BFA;    /* violet-400 */
--card-text: #5B21B6;      /* violet-800 */
--card-text-muted: #6D28D9; /* violet-700 */

/* Dark Mode */
--card-bg: #2E1065;        /* violet-950 */
--card-bg-accent: #4C1D95; /* violet-900 */
--card-border: #7C3AED;    /* violet-600 */
--card-text: #DDD6FE;      /* violet-200 */
--card-text-muted: #C4B5FD; /* violet-300 */
```

**AI Features (Sky Blue) - For Comparison**:
```css
/* Light Mode */
--ai-bg: #F0F9FF;          /* sky-50 */
--ai-border: #0EA5E9;      /* sky-500 */
--ai-text: #0369A1;        /* sky-700 */

/* Dark Mode */
--ai-bg: #082F49;          /* sky-950 */
--ai-border: #0EA5E9;      /* sky-500 */
--ai-text: #7DD3FC;        /* sky-300 */
```

### Timeline Summary

**Phase 1**: 4-6 hours
- Day 1: Types, constants, mock generator, store (3-4 hours)
- Day 2: Components, integration, testing (1-2 hours)

**Phase 2**: 6-8 hours
- Day 3: Enhanced mock data, collapsed state, animations (3-4 hours)
- Day 4: Mobile bottom sheet, trigger logic, queue (3-4 hours)

**Phase 3**: 8-12 hours
- Day 5: Connection cards, trigger system, settings (4-5 hours)
- Day 6: Analytics, error boundaries, accessibility (3-4 hours)
- Day 7: Performance, polish, documentation (1-3 hours)

**Total Estimated Time**: 18-26 hours (~3-5 days of focused work)

---

## Final Notes

This plan provides a **production-ready roadmap** for implementing aspirational reading cards. Key strengths:

1. **Phased Approach**: Each phase delivers incremental value and can be tested independently
2. **Existing Patterns**: Follows established drawer, animation, and state management patterns
3. **Visual Distinction**: Clear differentiation from AI features (purple vs sky blue)
4. **Mobile-First**: Bottom sheet pattern ensures great mobile UX
5. **Accessibility**: ARIA labels, keyboard nav, screen reader support
6. **Performance**: Memoization, throttling, GPU-accelerated animations
7. **Maintainability**: TypeScript, error boundaries, comprehensive tests

**Hand-off to Implementation**:
- All TypeScript interfaces defined
- All component structures outlined
- All integration points specified
- Success criteria measurable
- Testing strategy comprehensive
- Risks identified with mitigation

This plan is ready for `plan-implementer` to execute.
