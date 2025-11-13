# Settings Scope Analysis

**Date:** 2025-11-11
**Context:** Determining if settings are book-specific or globally scoped
**Issue:** Settings are only accessible within book view, but unclear if they should be global

---

## Executive Summary

**Finding**: Settings have **mixed scope** - some are global, some are per-book. This creates a confusing UX where settings are only accessible inside a book, but some changes affect all books.

### Current Scope Breakdown

| Setting Category | Scope | Storage Location | Key |
|-----------------|-------|------------------|-----|
| **Typography** | ✅ **Global** | localStorage (Zustand persist) | `reader-settings` |
| - Theme | Global | localStorage | - |
| - Font Size | Global | localStorage | - |
| - Font Family | Global | localStorage | - |
| - Line Height | Global | localStorage | - |
| - Margins | Global | localStorage | - |
| **Audio Settings** | 📘 **Per-Book** | IndexedDB | `bookId` (primary key) |
| - Voice | Per-book | audioSettings table | - |
| - Playback Speed | Per-book | audioSettings table | - |
| - Auto Play | Per-book | audioSettings table | - |
| **API Keys** | ✅ **Global** | Capacitor Preferences | - |
| - OpenAI API Key | Global | Secure storage | - |
| - Anna's Archive Key | Global | Secure storage | - |
| **Usage Dashboard** | 📘 **Per-Book** | IndexedDB | `bookId` query |
| - Audio usage stats | Per-book | audioUsage table | - |

---

## Detailed Analysis

### 1. Typography Settings (Global Scope)

**File**: `stores/settingsStore.ts`

```typescript
// Zustand store with localStorage persistence
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: TYPOGRAPHY_DEFAULTS.fontSize,
      fontFamily: TYPOGRAPHY_DEFAULTS.fontFamily,
      lineHeight: TYPOGRAPHY_DEFAULTS.lineHeight,
      margins: TYPOGRAPHY_DEFAULTS.marginDesktop,
      // ... actions
    }),
    {
      name: 'reader-settings', // localStorage key
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

**Storage**:
- Location: `localStorage['reader-settings']`
- Key: No bookId - single global object
- Scope: Affects ALL books

**Behavior**:
- Change font size in Book A → affects Book B immediately
- User preference applies across entire library
- Makes sense for personal reading preferences

---

### 2. Audio Settings (Per-Book Scope)

**File**: `lib/db.ts:460-480`

```typescript
// IndexedDB schema
audioSettings: 'bookId, updatedAt',  // bookId is PRIMARY KEY

// Interface
export interface AudioSettings {
  bookId: number;     // Primary key
  voice: OpenAIVoice;
  playbackSpeed: number;
  autoPlay: boolean;
  updatedAt: Date;
}

// Getter - requires bookId
export async function getAudioSettings(bookId: number): Promise<AudioSettings | undefined> {
  return await db.audioSettings.get(bookId);
}
```

**Storage**:
- Location: IndexedDB `audioSettings` table
- Key: `bookId` (primary key)
- Scope: Per-book settings

**Behavior**:
- Each book has its own audio preferences
- Book A can use "Alloy" voice, Book B uses "Nova"
- Playback speed is independent per book
- Makes sense for different content types (fiction vs textbook)

**Usage in SettingsDrawer** (`components/reader/SettingsDrawer.tsx:40-48`):
```typescript
// Loads audio settings for CURRENT book
useEffect(() => {
  const loadAudioSettings = async () => {
    const settings = await getAudioSettings(bookId) || getDefaultAudioSettings(bookId);
    setAudioSettings(settings);
  };

  if (isOpen) {
    loadAudioSettings();
  }
}, [bookId, isOpen]);
```

---

### 3. API Keys (Global Scope)

**File**: `lib/tts-client.ts`, `lib/annas-archive.ts`

**Storage**:
- Location: Capacitor Preferences (secure native storage)
- Key: `'openai_api_key'`, `'annas_archive_api_key'`
- Scope: Global across all books

**Behavior**:
- Single API key for entire app
- Not book-specific (wouldn't make sense)
- Secure storage on native platforms

---

### 4. Usage Dashboard (Per-Book Data)

**File**: `components/reader/SettingsDrawer.tsx:36`

```typescript
const audioUsage = useAudioUsage({ bookId });
```

**Storage**:
- Location: IndexedDB `audioUsage` table
- Query: Filtered by `bookId`
- Scope: Shows stats for current book only

**Behavior**:
- Each book tracks its own usage/costs
- Cannot see total usage across all books from here
- Makes sense for cost tracking per book

---

## The Problem: Access vs Scope Mismatch

### Current Situation

**Settings are only accessible from within a book view:**
- User must open a book to change settings
- SettingsDrawer requires `bookId` prop (line 18)
- No global settings access point

**But some settings are global:**
- Typography settings affect ALL books
- API keys are global credentials
- Changing theme in Book A changes it everywhere

### User Experience Issues

1. **Confusion**: "Why am I setting global preferences inside Book A?"
2. **Discoverability**: New users don't know settings exist until opening a book
3. **Unnecessary context**: Must have a book open to change global theme
4. **Inconsistency**: Some tabs (Audio, Usage) need book context, others don't

---

## Architecture Analysis

### SettingsDrawer Component

**File**: `components/reader/SettingsDrawer.tsx:21`

```typescript
export default function SettingsDrawer({
  isOpen,
  onClose,
  bookId  // ❌ Required prop - cannot render without a book
}: SettingsDrawerProps)
```

**Tab Dependencies**:

| Tab | Needs bookId? | Why |
|-----|---------------|-----|
| Typography | ❌ No | Global settings |
| Audio | ✅ Yes | Per-book audio preferences |
| API Key | ❌ No | Global credentials |
| Usage | ✅ Yes | Per-book usage stats |

**Current Implementation**:
- All tabs are in single drawer
- Drawer requires bookId even for global settings
- 50% of tabs don't actually need book context

---

## Design Patterns in Similar Apps

### Pattern 1: Split Settings (Recommended)

**Global Settings** (accessible anywhere):
- Typography (font, theme, margins)
- API Keys
- App preferences

**Book Settings** (accessible in book view):
- Audio preferences (voice, speed)
- Book-specific overrides
- Usage/statistics

**Examples**: Kindle, Apple Books, Google Play Books

### Pattern 2: Unified with Context Awareness

**Single Settings Screen**:
- Shows all settings
- Per-book sections disabled/hidden when no book open
- Book selector dropdown for per-book settings

**Examples**: Calibre, Readera

### Pattern 3: Tabs with Different Access

**Global Settings Tab** (navigation bar):
- Always accessible
- Typography, theme, API keys

**Book Settings Tab** (in book view):
- Only when reading
- Audio, usage, book-specific

**Examples**: Moon+ Reader

---

## Recommendations

### Option 1: Split into Two Settings Locations (Recommended)

**Global App Settings** (accessible from library/navigation):
```
📱 App Settings (accessible from library)
├── Typography
│   ├── Theme
│   ├── Font Size
│   ├── Font Family
│   ├── Line Height
│   └── Margins
└── API Keys
    ├── OpenAI
    └── Anna's Archive
```

**Book Settings** (accessible in book view):
```
📖 Book Settings (accessible when reading)
├── Audio
│   ├── Voice (per-book)
│   ├── Playback Speed (per-book)
│   └── Auto Play (per-book)
└── Usage
    └── Stats for this book
```

**Pros**:
- Clear separation of concerns
- No confusion about scope
- Global settings don't require opening a book
- Can still access audio settings while reading

**Cons**:
- Need to create new global settings access point
- Two settings locations to maintain

---

### Option 2: Make Audio Settings Global with Per-Book Overrides

**Change audio settings to global**:
- Default voice/speed for all books
- Option to override per book
- Similar to typography (global by default)

**Database Schema Change**:
```typescript
// New table: globalAudioSettings
interface GlobalAudioSettings {
  id: 1; // Singleton
  voice: OpenAIVoice;
  playbackSpeed: number;
  autoPlay: boolean;
  updatedAt: Date;
}

// Keep per-book overrides
interface AudioSettings {
  bookId: number;
  voice?: OpenAIVoice;        // Optional - uses global if null
  playbackSpeed?: number;     // Optional - uses global if null
  autoPlay?: boolean;         // Optional - uses global if null
  updatedAt: Date;
}
```

**Pros**:
- Consistent scope (most things global)
- Still allows per-book customization
- Reduces friction for most users

**Cons**:
- More complex logic (global + overrides)
- Migration needed for existing users

---

### Option 3: Keep Current Architecture, Add Global Access

**Keep everything as-is, but add:**
- Global settings button in library view
- Shows same drawer, but with dummy bookId or optional bookId
- Disable/hide book-specific tabs when no book selected

**Props Update**:
```typescript
interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: number;  // Optional now
}
```

**Pros**:
- Minimal code changes
- Backward compatible
- Quick fix

**Cons**:
- Still somewhat confusing
- "Half-disabled" UI when no book
- Doesn't fully solve the scope mismatch

---

## Implementation Considerations

### Database Schema Impact

**Option 1 (Split Settings)**: No schema changes needed

**Option 2 (Global Audio)**:
- Add `globalAudioSettings` table
- Migrate existing `audioSettings` to global defaults
- Update getters to check global → per-book override

**Option 3 (Current + Global Access)**: No schema changes

---

### Component Refactoring

**Option 1 (Split Settings)** - Moderate refactor:
```
Create:
- components/settings/GlobalSettings.tsx
- components/settings/BookSettings.tsx

Modify:
- Add settings button to library navigation
- Keep existing SettingsDrawer for book-specific settings
```

**Option 2 (Global Audio)** - Large refactor:
- Update all audio settings logic
- Add global audio settings storage
- Implement override resolution
- Migrate existing data

**Option 3 (Current + Global Access)** - Small refactor:
- Make `bookId` optional in SettingsDrawer
- Add conditional rendering for book-specific tabs
- Add settings button to library view

---

## User Research Questions

To validate which option to choose:

1. **Do users want different audio settings per book?**
   - Fiction book with "Fable" voice
   - Textbook with "Onyx" voice
   - Or: Same voice for everything?

2. **How often do users change typography settings?**
   - Once and forget? → Keep global
   - Per book basis? → Consider per-book

3. **Do users want to access settings without opening a book?**
   - "I want to set up my API key before reading"
   - "I want to change theme in library view"

---

## Conclusion

**Current State**: Confusing mixed scope with single access point

**Root Issue**: Settings drawer requires `bookId` but contains global settings

**Recommended Solution**: **Option 1 (Split Settings)**
- Global App Settings accessible from library
- Book Settings accessible while reading
- Clean separation matches user mental model
- Future-proof for adding more per-book customization

**Quick Fix**: **Option 3 (Add Global Access)**
- Make `bookId` optional
- Add global settings button
- Can iterate to Option 1 later

**Not Recommended**: Option 2 (Global Audio)
- Per-book audio makes sense (different genres/contexts)
- Over-complicates the data model
- Doesn't solve fundamental access issue

---

## Next Steps (If Implementing Option 1)

1. Create `components/settings/GlobalSettings.tsx`
   - Typography tab
   - API Keys tab
   - Theme management

2. Refactor `SettingsDrawer.tsx` → `BookSettings.tsx`
   - Audio tab
   - Usage tab
   - Remove typography/API key tabs

3. Add global settings button to library navigation
   - Top-right corner
   - Icon: ⚙️ Settings

4. Update navigation
   - Library → Global Settings
   - Book View → Book Settings (existing drawer)

5. Test both access points
   - Verify global settings apply to all books
   - Verify book settings are independent

---

## File References

**Settings Components**:
- `stores/settingsStore.ts` - Global typography settings (Zustand + localStorage)
- `components/reader/SettingsDrawer.tsx:21` - Main settings UI (requires bookId)
- `components/reader/AudioSettingsPanel.tsx` - Audio settings controls
- `components/settings/ApiKeySettings.tsx` - OpenAI API key management

**Database**:
- `lib/db.ts:44` - audioSettings table (bookId primary key)
- `lib/db.ts:460` - getAudioSettings(bookId) getter
- `types/index.ts:104-111` - AudioSettings interface

**Storage Locations**:
- localStorage: `reader-settings` (typography)
- IndexedDB: `audioSettings` table (per-book audio)
- Capacitor Preferences: API keys (secure global)

---

**End of Research Document**
