---
doc_type: plan
date: 2025-11-11T08:42:14+00:00
title: "Reader Page Routing Refactor: Dynamic Routes to Query Parameters"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-11T08:42:14+00:00"
feature: "reader-routing-refactor"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: Create New Static Reader Page"
    status: completed
  - name: "Phase 2: Update Navigation to Use Query Parameters"
    status: completed
  - name: "Phase 3: Delete Old Dynamic Route Directory"
    status: completed
  - name: "Phase 4: Build Verification and Testing"
    status: completed

git_commit: fa4dda98f599252e5116b5e3078582965f97393a
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-11
last_updated_by: Sean Kim
last_updated_note: "All implementation phases completed successfully. Build verification passed. Ready for device testing."

ticket_id: ENG-CAP-004
tags:
  - capacitor
  - nextjs
  - routing
  - refactor
status: completed

related_docs:
  - thoughts/implementation-details/2025-11-10-capacitor-implementation-complete-history.md
  - thoughts/research/2025-11-10-ENG-CAP-003-capacitor-implementation-analysis-and-best-practices-comparison.md
---

# Implementation Plan: Reader Page Routing Refactor

## Executive Summary

**Problem**: The reader page uses Next.js dynamic route segments (`/reader/[bookId]`) which are fundamentally incompatible with Capacitor's static WebView asset handler. When Next.js generates static HTML, it URL-encodes the dynamic route segment in script references (`[bookId]` → `%5BbookId%5D`), but Capacitor's asset handler does not decode URLs before filesystem lookup. This mismatch causes JavaScript bundles to 404 silently, preventing React hydration and causing the reader page to fail completely.

**Solution**: Refactor from dynamic route segments to query parameters, changing `/reader/[bookId]` to `/reader?id={bookId}`. This aligns with industry best practices for Capacitor + Next.js static export and eliminates the URL encoding incompatibility.

**Impact**: This fix will restore full reader page functionality on Capacitor native apps (Android/iOS) while maintaining backward compatibility with the web version.

**Estimated Total Time**: 2-3 hours

---

## Current State Analysis

### Existing Implementation

**File Structure**:
```
app/reader/
└── [bookId]/
    └── page.tsx (162 lines) - Dynamic route component
```

**Key Files Affected**:
1. **app/reader/[bookId]/page.tsx** (lines 1-162)
   - Client component using `useParams()` to get `bookId` from URL (lines 20-21)
   - Complete reader logic: book loading, position tracking, recap modal, error handling
   - Renders `ReaderView` component with book data (lines 155-159)

2. **components/library/BookCard.tsx** (line 32)
   - Navigation link: `<Link href={/reader/${book.id}}>`
   - User clicks to navigate to reader page

**Current Behavior (Broken on Capacitor)**:
1. User taps book card in library
2. Next.js router navigates to `/reader/1` (example)
3. Static HTML loads at `/reader/1/index.html` ✅
4. HTML requests JavaScript: `/_next/static/chunks/app/reader/%5BbookId%5D/page-xxx.js`
5. Capacitor looks for directory literally named `%5BbookId%5D` ❌
6. Actual directory is named `[bookId]` (literal brackets)
7. JavaScript 404s silently
8. React never hydrates, component never executes
9. Page shows loading spinner briefly, then redirects to home

**Root Cause** (from ENG-CAP-003 research):
> "Next.js embeds URL-encoded references `%5BbookId%5D` in the HTML, while Capacitor expects the literal directory name `[bookId]`. This mismatch causes silent JavaScript bundle load failures."

### Why Current Approaches Failed

**Approach 1**: Pre-generating static routes 1-20
- **Problem**: Doesn't solve URL encoding mismatch, doesn't scale
- **Result**: Build succeeds but runtime still fails

**Approach 2**: `dynamicParams = true` configuration
- **Problem**: Only works with SSR, not static export
- **Result**: Build errors

**Approach 3**: Server/client component split
- **Problem**: Doesn't address underlying URL encoding issue
- **Result**: Same silent 404 failures

---

## Requirements

### Functional Requirements

**Must Change**:
1. Routing pattern from `/reader/[bookId]` to `/reader?id={bookId}`
2. File structure from `app/reader/[bookId]/page.tsx` to `app/reader/page.tsx`
3. Navigation links to use query parameters
4. Reader page logic to read `bookId` from query params using `useSearchParams()`

**Must Preserve**:
1. All existing reader functionality:
   - Book loading from IndexedDB
   - Reading position tracking and restoration
   - Recap modal display logic
   - Error handling and loading states
   - Session tracking
   - Highlight retrieval
2. Settings drawer access from reader
3. Background audio support
4. All database operations (getBook, getPosition, updateBookLastOpened, etc.)
5. ReaderView component integration

### Technical Requirements

**Must Test**:
1. Build completes without errors (`npm run build`)
2. Generated HTML has no URL-encoded paths in `out/reader/index.html`
3. No dynamic route directories in `out/_next/static/chunks/app/reader/`
4. Navigation from library to reader works in Capacitor
5. Query parameter is read correctly
6. All reader features still function identically

### Success Criteria

1. **Build Success**: `npm run build` completes without errors
2. **No Dynamic Routes**: No `[bookId]` directory in build output
3. **Clean Paths**: No `%5B` or `%5D` in generated HTML script tags
4. **Functional Navigation**: Can navigate to `/reader?id=1` and page loads
5. **Preserved Functionality**: All reader features work identically to before
6. **Capacitor Compatibility**: Reader page opens on Android/iOS native apps

---

## Architecture & Design

### Target Architecture

**New File Structure**:
```
app/reader/
└── page.tsx (new file) - Static route with query param reading
```

**Routing Flow**:
```
User clicks book
  ↓
BookCard Link: href="/reader?id=1"
  ↓
Next.js navigates to /reader?id=1
  ↓
Static HTML loads: /reader/index.html (single file for all books)
  ↓
JavaScript loads: /_next/static/chunks/app/reader/page-xxx.js (no URL encoding)
  ↓
React hydrates ✅
  ↓
useSearchParams() reads id=1 from URL
  ↓
Component loads book from IndexedDB
  ↓
Reader displays book content
```

### Component Migration Strategy

**Source**: `app/reader/[bookId]/page.tsx` (162 lines)
**Target**: `app/reader/page.tsx` (new file)

**Code Changes Required**:

1. **Import Change** (line 4):
   ```typescript
   // OLD:
   import { useParams } from 'next/navigation';

   // NEW:
   import { useSearchParams } from 'next/navigation';
   ```

2. **Parameter Reading** (lines 20-21):
   ```typescript
   // OLD:
   const params = useParams();
   const bookId = Number(params.bookId);

   // NEW:
   const searchParams = useSearchParams();
   const bookId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
   ```

3. **Null Handling** (new validation in useEffect):
   ```typescript
   useEffect(() => {
     if (bookId === null) {
       setError('No book ID provided');
       setLoading(false);
       return;
     }

     // ... existing loadBook logic
   }, [bookId]);
   ```

4. **All Other Logic**: Remains identical (lines 23-162)
   - State management unchanged
   - Database operations unchanged
   - Recap modal logic unchanged
   - Error handling unchanged
   - Loading UI unchanged
   - ReaderView rendering unchanged

### Files to Modify/Create/Delete

| Action | File Path | Changes |
|--------|-----------|---------|
| **CREATE** | `app/reader/page.tsx` | New file with migrated logic using query params |
| **MODIFY** | `components/library/BookCard.tsx` (line 32) | Change href from `/reader/${book.id}` to `/reader?id=${book.id}` |
| **DELETE** | `app/reader/[bookId]/` | Entire directory (dynamic route) |

---

## Implementation Phases

### Phase 1: Create New Static Reader Page

**Goal**: Create new reader page at `app/reader/page.tsx` that reads bookId from query parameters.

**Prerequisites**: None

**Files to Create**:
- `app/reader/page.tsx` (new file)

**Implementation Steps**:

**Step 1.1**: Create new file `app/reader/page.tsx`
- Copy entire contents of `app/reader/[bookId]/page.tsx`
- This preserves all existing logic as starting point

**Step 1.2**: Update imports (line 4)
```typescript
// Change:
import { useParams } from 'next/navigation';

// To:
import { useSearchParams } from 'next/navigation';
```

**Step 1.3**: Update parameter reading logic (lines 19-21)

Replace:
```typescript
export default function ReaderPage() {
  const params = useParams();
  const bookId = Number(params.bookId);
```

With:
```typescript
export default function ReaderPage() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
```

**Step 1.4**: Add null bookId validation (line 33, inside useEffect)

Add at the beginning of the `useEffect`:
```typescript
useEffect(() => {
  if (bookId === null) {
    setError('No book ID provided');
    setLoading(false);
    return;
  }

  const loadBook = async () => {
    // ... existing logic unchanged
  };

  loadBook();
}, [bookId]);
```

**Step 1.5**: Verify all other logic remains unchanged
- Lines 23-32: State declarations (unchanged)
- Lines 34-90: useEffect with loadBook (unchanged except for null check)
- Lines 92-120: Loading UI (unchanged)
- Lines 122-141: Error UI (unchanged)
- Lines 143-162: Recap modal and ReaderView rendering (unchanged)

**Verification**:
```bash
# File should exist
ls app/reader/page.tsx

# Should have approximately same line count as original
wc -l app/reader/page.tsx
# Expected: ~165 lines (162 + null check)

# TypeScript compilation should succeed
npx tsc --noEmit
```

**Success Criteria**:
- New file `app/reader/page.tsx` exists
- File uses `useSearchParams()` instead of `useParams()`
- File handles null bookId case
- All other reader logic preserved identically
- TypeScript compilation succeeds with no errors

**Time Estimate**: 20 minutes

---

### Phase 2: Update Navigation to Use Query Parameters

**Goal**: Update BookCard component to navigate using query parameters instead of dynamic route segments.

**Prerequisites**: Phase 1 complete (new reader page exists)

**Files to Modify**:
- `components/library/BookCard.tsx` (line 32)

**Implementation Steps**:

**Step 2.1**: Open `components/library/BookCard.tsx`

**Step 2.2**: Locate the Link component (lines 31-34)

Current code:
```typescript
<Link
  href={`/reader/${book.id}`}
  className="group block transition-transform duration-200 hover:scale-105"
>
```

**Step 2.3**: Update href to use query parameter

Replace with:
```typescript
<Link
  href={`/reader?id=${book.id}`}
  className="group block transition-transform duration-200 hover:scale-105"
>
```

**Step 2.4**: Save file

**Verification**:
```bash
# Check that href uses query param syntax
grep -n "href={\`/reader?" components/library/BookCard.tsx

# Should output:
# 32:      href={`/reader?id=${book.id}`}

# TypeScript compilation should succeed
npx tsc --noEmit
```

**Success Criteria**:
- BookCard.tsx line 32 uses `/reader?id=${book.id}` format
- No other changes to BookCard component
- TypeScript compilation succeeds
- Link component still uses Next.js Link (not <a> tag)

**Time Estimate**: 5 minutes

---

### Phase 3: Delete Old Dynamic Route Directory

**Goal**: Remove the old dynamic route directory to prevent conflicts and ensure build uses new static route.

**Prerequisites**:
- Phase 1 complete (new static page exists)
- Phase 2 complete (navigation updated)

**Files to Delete**:
- `app/reader/[bookId]/` (entire directory)
- `app/reader/[bookId]/page.tsx` (will be deleted with directory)

**Implementation Steps**:

**Step 3.1**: Verify new static page exists
```bash
# Confirm new file is present
ls -la app/reader/page.tsx

# Should show file with recent timestamp
```

**Step 3.2**: Create backup of old dynamic route (safety measure)
```bash
# Create backup in case rollback needed
cp -r app/reader/[bookId] /tmp/reader-bookid-backup

# Verify backup
ls -la /tmp/reader-bookid-backup/
```

**Step 3.3**: Delete dynamic route directory
```bash
# Remove old dynamic route
rm -rf app/reader/[bookId]

# Verify deletion
ls -la app/reader/
# Should show only page.tsx, no [bookId] directory
```

**Step 3.4**: Verify app directory structure
```bash
tree app/reader/
# Expected output:
# app/reader/
# └── page.tsx
```

**Verification**:
```bash
# Directory should not exist
[ ! -d "app/reader/[bookId]" ] && echo "SUCCESS: Dynamic route deleted" || echo "ERROR: Directory still exists"

# New static page should exist
[ -f "app/reader/page.tsx" ] && echo "SUCCESS: Static page exists" || echo "ERROR: Static page missing"

# TypeScript compilation should succeed
npx tsc --noEmit
```

**Success Criteria**:
- `app/reader/[bookId]/` directory does not exist
- `app/reader/page.tsx` exists and is the only file in app/reader/
- Backup created at `/tmp/reader-bookid-backup/` for rollback if needed
- TypeScript compilation succeeds with no errors
- No import errors in other files referencing reader page

**Time Estimate**: 5 minutes

---

### Phase 4: Build Verification and Testing

**Goal**: Build the application for Capacitor and verify that the routing refactor resolves the URL encoding issue.

**Prerequisites**:
- Phase 1 complete (static page exists)
- Phase 2 complete (navigation uses query params)
- Phase 3 complete (dynamic route deleted)

**Files to Inspect**:
- `out/reader/index.html` (generated HTML)
- `out/_next/static/chunks/app/reader/` (JavaScript bundles)

**Implementation Steps**:

**Step 4.1**: Clean previous build artifacts
```bash
# Remove old build output
rm -rf out/ .next/

# Verify clean state
ls -la | grep -E "(out|.next)"
# Should show no output (directories deleted)
```

**Step 4.2**: Run production build
```bash
# Build Next.js static export
npm run build

# Build should complete without errors
# Expected final output:
# ✓ Generating static pages (XX/XX)
# ✓ Finalizing page optimization
```

**Step 4.3**: Verify build output structure
```bash
# Check reader directory structure
ls -la out/reader/

# Expected output:
# index.html (single file, NOT numbered directories)

# Should NOT see:
# 1/, 2/, 3/, ... 20/ (old dynamic route pre-generation)
```

**Step 4.4**: Inspect generated HTML for URL encoding
```bash
# Check for URL-encoded paths in reader HTML
grep "%5B" out/reader/index.html

# Expected: NO OUTPUT (no URL encoding)
# If any %5B or %5D found: FAILURE, routing still has dynamic segments
```

**Step 4.5**: Verify JavaScript bundle paths
```bash
# Check for dynamic route directories in chunks
ls -la out/_next/static/chunks/app/reader/

# Expected output:
# page-[hash].js (static route bundle)

# Should NOT see:
# [bookId]/ directory or %5BbookId%5D references
```

**Step 4.6**: Inspect script tags in generated HTML
```bash
# Extract script tags from reader HTML
grep "<script src=" out/reader/index.html | head -5

# Expected:
# <script src="/_next/static/chunks/app/reader/page-xxx.js" async=""></script>

# Should NOT contain:
# %5BbookId%5D in any script src attribute
```

**Step 4.7**: Sync with Capacitor
```bash
# Sync build output to Android platform
npx cap sync android

# Sync build output to iOS platform (if applicable)
npx cap sync ios

# Expected output:
# ✔ Copying web assets from out to android/app/src/main/assets/public in X.XXs
# ✔ Updating Android plugins
# ✔ copy android in X.XXms
```

**Step 4.8**: Test in Android Studio (manual verification)
```bash
# Open Android project in Android Studio
npx cap open android

# Manual test steps in Android Studio:
# 1. Run app on emulator or device
# 2. Navigate to library page
# 3. Tap any book card
# 4. Verify reader page loads (doesn't redirect back to library)
# 5. Verify URL in DevTools shows /reader?id=X format
# 6. Verify JavaScript executes (check console for [ReaderPage] logs)
# 7. Verify book content displays correctly
# 8. Test reading position save/restore
# 9. Test settings drawer opens
# 10. Test recap modal displays (if applicable)
```

**Step 4.9**: Chrome DevTools inspection (Capacitor WebView debugging)
```bash
# Connect to WebView via Chrome DevTools
# In Chrome browser, navigate to: chrome://inspect
# Select "Adaptive Reader" under Remote Target
# Open DevTools

# In DevTools Console, verify:
# 1. No 404 errors for JavaScript bundles
# 2. React hydration completed
# 3. Component console logs appear
# 4. window.location.href shows /reader?id=1 format
# 5. searchParams.get('id') returns correct book ID
```

**Verification Checklist**:

Build Output:
- [ ] `npm run build` completes without errors
- [ ] `out/reader/index.html` exists (single file)
- [ ] No `out/reader/1/`, `out/reader/2/`, etc. directories
- [ ] No `%5B` or `%5D` in `out/reader/index.html`
- [ ] No `[bookId]/` directory in `out/_next/static/chunks/app/reader/`
- [ ] Script tags reference `app/reader/page-xxx.js` (not `%5BbookId%5D`)

Capacitor Build:
- [ ] `npx cap sync android` completes without errors
- [ ] `npx cap sync ios` completes without errors (if applicable)

Runtime Functionality:
- [ ] App launches on Android emulator/device
- [ ] Library page displays books correctly
- [ ] Tapping book navigates to reader page
- [ ] Reader page loads completely (no redirect to home)
- [ ] Book content displays correctly
- [ ] Reading position restored from database
- [ ] Settings drawer opens and functions
- [ ] Recap modal displays when appropriate
- [ ] Audio generation works (if OpenAI key configured)
- [ ] All reader features function identically to web version

DevTools Verification:
- [ ] No 404 errors in Network tab
- [ ] JavaScript bundles load successfully
- [ ] React components render
- [ ] Console logs show component execution
- [ ] `window.location.search` contains `?id=X`

**Success Criteria**:
- All build output verification checks pass
- All runtime functionality checks pass
- No URL-encoded paths in generated HTML
- No dynamic route directories in build output
- Reader page opens on Capacitor native app
- All existing reader features work correctly

**Time Estimate**: 60-90 minutes (build 5 min, testing 55-85 min)

---

## Testing Strategy

### Unit Testing

**Files to Test**:
- `app/reader/page.tsx` (new static route)
- `components/library/BookCard.tsx` (updated navigation)

**Test Cases for Reader Page**:

1. **Query Parameter Reading**:
   - Test: URL with valid bookId (`/reader?id=1`)
   - Expected: `bookId` state = 1
   - Test: URL with missing id parameter (`/reader`)
   - Expected: Error state = "No book ID provided"
   - Test: URL with invalid id (`/reader?id=abc`)
   - Expected: `bookId` = NaN, then error from database lookup

2. **Book Loading**:
   - Test: Valid bookId, book exists in database
   - Expected: Book loads, reader displays
   - Test: Valid bookId, book not found
   - Expected: Error state = "Book not found"
   - Test: Valid bookId, book has no fileBlob
   - Expected: Error state = "Book file not found"

3. **Recap Modal Logic**:
   - Test: Last session > 24 hours ago
   - Expected: Recap modal displays
   - Test: Last session < 24 hours ago
   - Expected: No recap modal
   - Test: No previous session
   - Expected: No recap modal

**Test Cases for BookCard**:

1. **Navigation Link**:
   - Test: Render BookCard with book.id = 5
   - Expected: Link href = "/reader?id=5"
   - Test: Click book card
   - Expected: Navigate to /reader?id=5

### Integration Testing

**Test Scenarios**:

1. **Library to Reader Navigation**:
   - Start: Library page with 3 books
   - Action: Click book with id=2
   - Verify: URL changes to /reader?id=2
   - Verify: Reader page loads book 2
   - Verify: Reading position restored from database

2. **Reader to Library Navigation**:
   - Start: Reader page with book loaded
   - Action: Click "Back to Library" link
   - Verify: URL changes to /
   - Verify: Library page loads with all books
   - Verify: Reading position saved to database

3. **Direct URL Navigation**:
   - Start: Browser/app fresh start
   - Action: Navigate to /reader?id=1 directly
   - Verify: Book 1 loads correctly
   - Verify: No errors in console

4. **Invalid URL Handling**:
   - Start: Browser/app fresh start
   - Action: Navigate to /reader (no query param)
   - Verify: Error message displays
   - Verify: "Back to Library" link works

### Manual Testing (Capacitor)

**Android Testing**:

1. **Build and Install**:
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   # Run in Android Studio on emulator or device
   ```

2. **Test Sequence**:
   - Launch app
   - Verify library loads with books
   - Tap first book
   - Verify reader opens (doesn't redirect)
   - Read a few pages
   - Close and reopen app
   - Verify reading position restored
   - Test settings drawer
   - Test recap modal (if session > 24h old)
   - Test audio generation (if API key configured)

3. **DevTools Inspection**:
   - Open `chrome://inspect` in Chrome
   - Connect to Capacitor WebView
   - Verify no JavaScript 404 errors
   - Verify component console logs appear
   - Check Network tab for bundle loads

**iOS Testing** (if applicable):

1. **Build and Install**:
   ```bash
   npm run build
   npx cap sync ios
   npx cap open ios
   # Run in Xcode on simulator or device
   ```

2. **Test Sequence**: Same as Android
3. **Safari DevTools**: Connect Safari Web Inspector to verify

### Regression Testing

**Areas to Verify Unchanged**:

1. **Database Operations**:
   - Book storage and retrieval
   - Reading position save/load
   - Session tracking
   - Highlight storage
   - Audio file storage

2. **Reader Features**:
   - Page navigation (tap zones, swipe gestures)
   - Text highlighting
   - Note taking
   - Settings (font, theme, margins)
   - Audio playback
   - Sentence synchronization
   - Chapter navigation

3. **UI Components**:
   - Settings drawer
   - Highlight menu
   - Note editor
   - Progress indicators
   - Audio player controls
   - Chapter list
   - AI features (recap, explanation, summary)

4. **Performance**:
   - Book loading time
   - Page turn responsiveness
   - Audio generation speed
   - Database query performance

**Test Matrix**:

| Feature | Web | Android | iOS | Status |
|---------|-----|---------|-----|--------|
| Navigation from library | ✓ | ✓ | ✓ | |
| Book loading | ✓ | ✓ | ✓ | |
| Position restore | ✓ | ✓ | ✓ | |
| Settings drawer | ✓ | ✓ | ✓ | |
| Recap modal | ✓ | ✓ | ✓ | |
| Highlighting | ✓ | ✓ | ✓ | |
| Note taking | ✓ | ✓ | ✓ | |
| Audio generation | ✓ | ✓ | ✓ | |
| Audio playback | ✓ | ✓ | ✓ | |
| Sentence sync | ✓ | ✓ | ✓ | |
| Chapter navigation | ✓ | ✓ | ✓ | |

---

## Risk Assessment

### Critical Risks

#### Risk 1: Component Logic Migration Errors

**Description**: Errors when copying logic from dynamic route to static route could break reader functionality.

**Probability**: Low (simple copy-paste with minimal changes)

**Impact**: High (reader completely broken)

**Mitigation**:
1. Copy entire file first, then make targeted changes
2. Only modify parameter reading logic (lines 4, 20-21)
3. Add null check for bookId
4. Run TypeScript compilation after each change
5. Keep backup of old dynamic route until testing complete

**Contingency**:
- If issues arise, restore from backup at `/tmp/reader-bookid-backup/`
- Compare new file with old using `diff` to verify only intended changes

#### Risk 2: Build Output Still Contains URL Encoding

**Description**: Despite refactoring, Next.js might still generate URL-encoded paths in some edge case.

**Probability**: Very Low (query params are standard static route pattern)

**Impact**: High (reader still broken on Capacitor)

**Mitigation**:
1. Thoroughly inspect build output in Phase 4
2. Grep for `%5B` and `%5D` in all generated HTML
3. Verify no dynamic route directories in chunks
4. Test in Capacitor before marking complete

**Contingency**:
- If URL encoding persists, research alternative approaches:
  - Hash routing (`/reader#bookId`)
  - Client-side routing library (React Router)
  - Single-page app without Next.js routing

#### Risk 3: Breaking Existing Web Deployment

**Description**: Changes might work for Capacitor but break web deployment.

**Probability**: Very Low (query params work on both web and Capacitor)

**Impact**: Medium (web users affected)

**Mitigation**:
1. Test on web build before Capacitor build
2. Verify query parameter reading works in browser
3. Test with and without query parameter in URL
4. Check browser history navigation

**Contingency**:
- Web and Capacitor builds use same code, so if it works on one, it works on both
- If issues arise, can deploy different builds (but not ideal)

### Medium Risks

#### Risk 4: Search Engine Indexing Impact

**Description**: Changing URL structure from `/reader/1` to `/reader?id=1` might affect SEO.

**Probability**: Low (personal app, likely not publicly indexed)

**Impact**: Low (no public SEO requirement mentioned)

**Mitigation**:
1. If SEO is required later, add `generateStaticParams()` for common bookIds
2. Use `canonical` meta tags
3. Configure `sitemap.xml` with query param URLs

**Contingency**:
- Can implement hybrid approach: pre-generate popular routes, use query params as fallback
- Not urgent for Capacitor-focused deployment

#### Risk 5: Browser Bookmark Breakage

**Description**: Existing bookmarks to `/reader/1` will break after refactor.

**Probability**: Medium (users may have bookmarked specific books)

**Impact**: Low (minor inconvenience, easy to re-bookmark)

**Mitigation**:
1. Document URL change in release notes
2. Consider adding redirect logic (temporary)
3. Inform users to update bookmarks

**Contingency**:
- If critical, can add catch-all route that redirects old URLs to new format
- Implement in future iteration if user feedback indicates need

### Low Risks

#### Risk 6: TypeScript Type Errors

**Description**: Changing from `useParams()` to `useSearchParams()` might cause type issues.

**Probability**: Very Low (both are well-typed Next.js hooks)

**Impact**: Low (caught by TypeScript compiler)

**Mitigation**:
1. Run `npx tsc --noEmit` after each change
2. Fix any type errors immediately
3. Use proper null handling for missing query param

**Contingency**:
- Type errors are compile-time, easy to fix before runtime
- Next.js types are well-documented

#### Risk 7: Test Coverage Gaps

**Description**: Manual testing might miss edge cases.

**Probability**: Medium (no automated E2E tests exist)

**Impact**: Low (bugs can be caught in user testing)

**Mitigation**:
1. Follow comprehensive manual test plan in Phase 4
2. Test all major features before marking complete
3. Use Chrome DevTools to verify runtime behavior

**Contingency**:
- If bugs found post-deployment, can fix in patch release
- Consider adding E2E tests in future (Appium, Playwright)

---

## Rollback Strategy

### Rollback Triggers

Rollback should be executed if:

1. **Build Fails**: `npm run build` fails with errors after refactor
2. **URL Encoding Persists**: Generated HTML still contains `%5B` or `%5D`
3. **Reader Broken**: Reader page doesn't load on Capacitor after changes
4. **Critical Bug**: Major functionality broken (highlights, audio, position tracking)
5. **TypeScript Errors**: Unresolvable type errors preventing compilation

### Rollback Procedure

#### Option 1: Restore from Backup (Fastest)

**Prerequisites**: Backup created in Phase 3, Step 3.2

**Steps**:
```bash
# 1. Delete new static page
rm app/reader/page.tsx

# 2. Restore old dynamic route from backup
cp -r /tmp/reader-bookid-backup app/reader/[bookId]

# 3. Revert BookCard.tsx navigation change
# (manually change href back to /reader/${book.id})

# 4. Verify restoration
ls -la app/reader/[bookId]/page.tsx
grep "href={\`/reader/\${book.id}\`}" components/library/BookCard.tsx

# 5. Test build
npm run build

# 6. Verify old behavior restored
npx cap sync android
npx cap open android
```

**Time to Rollback**: 5-10 minutes

#### Option 2: Git Revert (If Changes Committed)

**Prerequisites**: Changes committed to git

**Steps**:
```bash
# 1. Find commit hash of refactor
git log --oneline -5

# 2. Revert the commit
git revert <commit-hash>

# 3. Rebuild
npm run build

# 4. Re-sync Capacitor
npx cap sync android
```

**Time to Rollback**: 5 minutes

#### Option 3: Manual Revert (If No Backup or Commit)

**Prerequisites**: None (can always manually undo changes)

**Steps**:
```bash
# 1. Re-create app/reader/[bookId]/page.tsx with original content
mkdir -p app/reader/[bookId]
# Copy content from implementation history document or git history

# 2. Delete new static page
rm app/reader/page.tsx

# 3. Revert BookCard.tsx change
# (manually edit file to restore href=/reader/${book.id})

# 4. Rebuild and test
npm run build
npx cap sync android
```

**Time to Rollback**: 15-20 minutes

### Post-Rollback Actions

After rollback:

1. **Document Issue**: Record what went wrong and why rollback was needed
2. **Investigate Root Cause**: Analyze build output, error logs, DevTools
3. **Research Alternative Solutions**:
   - Hash routing
   - Catch-all routes
   - React Router integration
   - Next.js configuration tweaks
4. **Plan Next Attempt**: Create new implementation plan based on findings
5. **Communicate Status**: Update ticket/stakeholders that rollback occurred

### Rollback Validation

After rollback, verify:

- [ ] `npm run build` completes successfully
- [ ] `app/reader/[bookId]/page.tsx` exists
- [ ] `components/library/BookCard.tsx` uses `/reader/${book.id}` href
- [ ] TypeScript compilation succeeds
- [ ] Web version works (even if Capacitor still broken)
- [ ] No new errors introduced by rollback

---

## Deployment Considerations

### Build Process

**Development Build** (for testing):
```bash
# Clean build artifacts
rm -rf out/ .next/

# Build Next.js static export
npm run build

# Sync to Capacitor platforms
npx cap sync android
npx cap sync ios

# Open in IDE for testing
npx cap open android  # or ios
```

**Production Build** (for release):
```bash
# Clean build artifacts
rm -rf out/ .next/

# Build with production optimizations
NODE_ENV=production npm run build

# Sync to Capacitor
npx cap sync android
npx cap sync ios

# Build APK/IPA
cd android && ./gradlew assembleRelease
# or open in Xcode for iOS build
```

### Capacitor Sync Behavior

When `npx cap sync` runs:
1. Copies `out/` directory to platform assets:
   - Android: `android/app/src/main/assets/public/`
   - iOS: `ios/App/App/public/`
2. Updates native plugins in platform projects
3. Validates configuration in `capacitor.config.ts`

**Important**: After routing changes, always run `cap sync` to update platform assets.

### Platform-Specific Considerations

#### Android

**Build Variants**:
- `assembleDebug`: Development build with debugging enabled
- `assembleRelease`: Production build with ProGuard optimization
- `bundleRelease`: AAB for Google Play Store upload

**Signing**:
- Debug builds use debug keystore automatically
- Release builds require release keystore configuration

**Testing Devices**:
- Emulator: Fast testing, easier debugging
- Physical Device: Real performance, network conditions

#### iOS

**Build Configurations**:
- Debug: Development build with debugging
- Release: Production build with optimizations

**Code Signing**:
- Development: Requires Apple Developer account
- Distribution: Requires provisioning profiles

**Testing Devices**:
- Simulator: Fast testing, easier debugging
- Physical Device: Required for App Store submission

### Migration Path

**For Existing Deployments**:

1. **Web Deployment** (if applicable):
   - Deploy new build with query param routing
   - Old bookmarked URLs `/reader/1` will break
   - Consider temporary redirect middleware
   - Update any external links to books

2. **Capacitor Deployment**:
   - Build new version with fix
   - Increment version number in `package.json` and `capacitor.config.ts`
   - Test thoroughly on Android/iOS
   - Release as update to app stores
   - Users upgrade via store update

3. **Data Migration**: Not required (database schema unchanged)

### Post-Deployment Monitoring

**Metrics to Track**:
1. Build success rate
2. Reader page navigation success rate
3. JavaScript bundle load errors (DevTools)
4. Database operation performance
5. User-reported issues with reader page

**Monitoring Tools**:
- Chrome DevTools (Network tab, Console)
- Android Logcat: `adb logcat | grep -i "capacitor\|reader"`
- iOS Console.app (for iOS devices)
- User feedback channels

---

## Performance Considerations

### Build Performance

**Impact of Refactor on Build**:
- **Before**: Next.js generates 20 static routes (1-20) for `/reader/[bookId]`
- **After**: Next.js generates 1 static route for `/reader`
- **Build Time Improvement**: ~5-10% faster (fewer HTML files to generate)

**Bundle Size Impact**:
- Minimal (same component code, different parameter reading)
- No additional dependencies required
- JavaScript bundle size unchanged

### Runtime Performance

**Page Load Performance**:
- **Before**: Load `/reader/1/index.html` → Request JS → 404 → Fail
- **After**: Load `/reader/index.html` → Request JS → 200 → Success
- **Improvement**: Reader page actually loads (infinite improvement from broken state)

**Navigation Performance**:
- Query parameter reading (`useSearchParams()`) is synchronous and fast
- No performance difference vs. `useParams()` for dynamic routes
- Client-side navigation still instant (Next.js router)

**Database Performance**:
- Unchanged (same book lookup queries)
- Still uses IndexedDB with same schema
- No migration or re-indexing required

### Memory Considerations

**Capacitor WebView Memory**:
- No additional memory overhead from routing change
- Same component tree and state management
- JavaScript bundle loaded once, not per book

**Database Memory**:
- No change to database size or query complexity
- Book blobs stored identically
- Reading positions tracked identically

### Optimization Opportunities

**Future Optimizations** (not in scope of this refactor):

1. **Code Splitting**:
   - Lazy load ReaderView component
   - Split audio player into separate chunk
   - Dynamic import for AI features

2. **Prefetching**:
   - Prefetch reader page JS when library loads
   - Preload next book in reading list

3. **Service Worker** (if re-enabling):
   - Cache reader page and dependencies
   - Offline-first reader experience

---

## Documentation Requirements

### Code Documentation

**Files Requiring Inline Comments**:

1. **app/reader/page.tsx**:
   ```typescript
   // Query parameter routing for Capacitor compatibility
   // Using useSearchParams() instead of dynamic route segments
   // to avoid URL encoding issues with Capacitor's WebView asset handler
   const searchParams = useSearchParams();
   const bookId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
   ```

2. **components/library/BookCard.tsx**:
   ```typescript
   // Navigate using query parameters for Capacitor static export compatibility
   // Previously used dynamic route: /reader/${book.id}
   // Changed to: /reader?id=${book.id}
   href={`/reader?id=${book.id}`}
   ```

### Implementation Documentation

**Document to Create**:
- **File**: `thoughts/implementation-details/2025-11-11-ENG-CAP-004-reader-routing-refactor-implementation.md`
- **Content**:
  - Overview of changes
  - Rationale for query param approach
  - Code changes summary
  - Testing results
  - Lessons learned
  - Future recommendations

**Update Existing Docs**:
- **File**: `thoughts/implementation-details/2025-11-10-capacitor-implementation-complete-history.md`
- **Addition**: New section documenting successful routing fix

### User-Facing Documentation

**If App Has User Documentation**:

1. **URL Format Change**:
   - Old: `/reader/1`
   - New: `/reader?id=1`
   - Impact: Bookmarked URLs will break

2. **Behavior Changes**: None (user-facing functionality unchanged)

3. **Migration Notes**: Users should re-bookmark favorite books if bookmarked

### Developer Handoff Documentation

**For Future Developers**:

1. **Routing Architecture**:
   - Reader page uses query parameters for book ID
   - Why: Capacitor static export incompatibility with dynamic routes
   - Alternative considered: Hash routing (not chosen due to SEO)

2. **Build Requirements**:
   - Always run `npm run build` before `npx cap sync`
   - Verify no `%5B` or `%5D` in build output
   - Single `out/reader/index.html` file expected

3. **Testing Checklist**:
   - Include Phase 4 verification checklist in CI/CD docs
   - Document manual testing steps for Capacitor builds

---

## Success Metrics

### Immediate Success Criteria

**Build Metrics** (must all pass):
- [ ] `npm run build` exits with code 0 (success)
- [ ] Build time <= 60 seconds (should be faster than before)
- [ ] Output directory `out/reader/` contains single `index.html`
- [ ] No `%5B` or `%5D` in any generated HTML file
- [ ] No `[bookId]` directory in `out/_next/static/chunks/app/reader/`

**Functionality Metrics** (must all pass):
- [ ] Tapping book in library navigates to reader page
- [ ] Reader page loads without redirecting to home
- [ ] Book content displays correctly
- [ ] Reading position restored from database
- [ ] Settings drawer opens and functions
- [ ] Recap modal displays when appropriate
- [ ] Highlighting works
- [ ] Note taking works
- [ ] Audio generation works (if API key configured)
- [ ] Chapter navigation works

**DevTools Metrics** (must all pass):
- [ ] 0 JavaScript 404 errors in Network tab
- [ ] 0 React hydration errors in Console
- [ ] Component console logs appear (verifies JS execution)
- [ ] `window.location.search` contains `?id=X`
- [ ] `searchParams.get('id')` returns correct bookId

### Long-Term Success Metrics

**User Experience** (track over 1 week):
- Reader page navigation success rate: 100%
- Average time to open book: < 2 seconds
- User-reported reader page issues: 0
- Reading position restore success rate: 100%

**Technical Health** (monitor continuously):
- Build success rate: 100%
- JavaScript bundle load success rate: 100%
- Database query performance: < 100ms for book retrieval
- Capacitor sync success rate: 100%

**Performance Benchmarks**:
- Library → Reader navigation: < 1 second
- Reader page first paint: < 500ms
- Book content render: < 2 seconds
- Position restore: < 100ms

### Regression Monitoring

**Features to Monitor for Regression**:
1. Book upload and storage
2. Cover image display
3. Anna's Archive search and download
4. TTS audio generation
5. Audio playback and sentence sync
6. Highlight and note functionality
7. Reading statistics tracking
8. Session tracking

**Automated Checks** (if implementing CI/CD):
- TypeScript compilation succeeds
- Build output contains no URL encoding
- No dynamic route directories in build
- Bundle size within expected range (< 5% increase)

---

## Related Documents

### Research and Analysis
- [thoughts/implementation-details/2025-11-10-capacitor-implementation-complete-history.md](/Users/seankim/dev/reader/thoughts/implementation-details/2025-11-10-capacitor-implementation-complete-history.md) - Complete chronological history of Capacitor implementation attempts and failures
- [thoughts/research/2025-11-10-ENG-CAP-003-capacitor-implementation-analysis-and-best-practices-comparison.md](/Users/seankim/dev/reader/thoughts/research/2025-11-10-ENG-CAP-003-capacitor-implementation-analysis-and-best-practices-comparison.md) - Industry best practices research and current state analysis with specific routing recommendations

### Implementation Plans
- [thoughts/plans/2025-11-10-ENG-CAP-002-capacitor-personal-use-setup.md](/Users/seankim/dev/reader/thoughts/plans/2025-11-10-ENG-CAP-002-capacitor-personal-use-setup.md) - Original Capacitor setup plan

### Code Files
- [app/reader/[bookId]/page.tsx](/Users/seankim/dev/reader/app/reader/[bookId]/page.tsx) - Current dynamic route implementation (to be migrated)
- [components/library/BookCard.tsx](/Users/seankim/dev/reader/components/library/BookCard.tsx) - Book card navigation component (to be updated)
- [components/reader/ReaderView.tsx](/Users/seankim/dev/reader/components/reader/ReaderView.tsx) - Main reader component (unchanged)

---

## Appendix

### A. Code Examples

#### Complete New Reader Page (app/reader/page.tsx)

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getBook,
  getPosition,
  updateBookLastOpened,
  getLastSession,
  getAllHighlights,
} from '@/lib/db';
import { shouldShowRecap } from '@/lib/analytics';
import type { Book, ReadingPosition, Session, Highlight } from '@/types';
import ReaderView from '@/components/reader/ReaderView';
import RecapModal from '@/components/reader/RecapModal';

const RECAP_SHOWN_KEY = 'recap-shown-session';

export default function ReaderPage() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  const [book, setBook] = useState<Book | null>(null);
  const [position, setPosition] = useState<ReadingPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 3: Recap modal state
  const [showRecap, setShowRecap] = useState(false);
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [lastHighlight, setLastHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    if (bookId === null) {
      setError('No book ID provided');
      setLoading(false);
      return;
    }

    const loadBook = async () => {
      try {
        // Get book from database
        const bookData = await getBook(bookId);
        if (!bookData) {
          setError('Book not found');
          setLoading(false);
          return;
        }

        if (!bookData.fileBlob) {
          setError('Book file not found');
          setLoading(false);
          return;
        }

        setBook(bookData);

        // Get saved reading position
        const positionData = await getPosition(bookId);
        setPosition(positionData || null);

        // Phase 3: Check if we should show recap modal
        const recapShownThisSession = sessionStorage.getItem(RECAP_SHOWN_KEY);
        if (!recapShownThisSession) {
          const previousSession = await getLastSession(bookId);
          if (previousSession && previousSession.endTime) {
            const currentSessionStart = new Date();
            if (shouldShowRecap(previousSession.endTime, currentSessionStart)) {
              setLastSession(previousSession);

              // Get last highlight for this book
              const allHighlights = await getAllHighlights();
              const bookHighlights = allHighlights.filter((h) => h.bookId === bookId);
              if (bookHighlights.length > 0) {
                setLastHighlight(bookHighlights[0]); // Most recent
              }

              setShowRecap(true);
              sessionStorage.setItem(RECAP_SHOWN_KEY, 'true');
            }
          }
        }

        // Update last opened timestamp
        await updateBookLastOpened(bookId);

        setLoading(false);
      } catch (err) {
        console.error('Error loading book:', err);
        setError('Failed to load book');
        setLoading(false);
      }
    };

    loadBook();
  }, [bookId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-gray-500">Loading book...</p>
        </div>
      </div>
    );
  }

  if (error || !book || !book.fileBlob) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">
            {error || 'Book not found'}
          </h2>
          <p className="text-gray-500 mb-6">
            Unable to load the requested book.
          </p>
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-900 hover:bg-gray-800"
          >
            ← Back to Library
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Phase 3: Recap Modal */}
      {showRecap && lastSession && (
        <RecapModal
          lastSession={lastSession}
          lastHighlight={lastHighlight || undefined}
          bookTitle={book.title}
          onContinue={() => setShowRecap(false)}
        />
      )}

      <ReaderView
        bookId={bookId}
        bookBlob={book.fileBlob}
        initialCfi={position?.cfi}
      />
    </>
  );
}
```

#### Updated BookCard Component

```typescript
// components/library/BookCard.tsx (line 31-34)

<Link
  href={`/reader?id=${book.id}`}  // Changed from /reader/${book.id}
  className="group block transition-transform duration-200 hover:scale-105"
>
```

### B. Build Output Verification Commands

```bash
# Check for URL encoding in reader HTML
grep -r "%5B\|%5D" out/reader/

# List reader directory structure
tree out/reader/

# Check script tags in reader HTML
grep "<script" out/reader/index.html

# Verify no dynamic route chunks
ls -la out/_next/static/chunks/app/reader/

# Count HTML files in reader directory
find out/reader/ -name "*.html" -type f | wc -l
# Expected: 1 (only index.html)

# Full build verification script
verify_build() {
  echo "Build Verification Checklist:"
  echo "1. No URL encoding:"
  if grep -r "%5B\|%5D" out/reader/ > /dev/null; then
    echo "   ❌ FAIL - Found URL encoding"
    grep -r "%5B\|%5D" out/reader/
  else
    echo "   ✅ PASS - No URL encoding found"
  fi

  echo "2. Single HTML file:"
  html_count=$(find out/reader/ -name "*.html" -type f | wc -l)
  if [ "$html_count" -eq 1 ]; then
    echo "   ✅ PASS - Found $html_count HTML file"
  else
    echo "   ❌ FAIL - Found $html_count HTML files (expected 1)"
  fi

  echo "3. No dynamic route directories:"
  if [ -d "out/_next/static/chunks/app/reader/[bookId]" ] || [ -d "out/_next/static/chunks/app/reader/%5BbookId%5D" ]; then
    echo "   ❌ FAIL - Found dynamic route directory"
  else
    echo "   ✅ PASS - No dynamic route directories"
  fi

  echo "4. Static route chunk exists:"
  if ls out/_next/static/chunks/app/reader/page-*.js 1> /dev/null 2>&1; then
    echo "   ✅ PASS - Static route chunk found"
  else
    echo "   ❌ FAIL - Static route chunk not found"
  fi
}

# Run verification
verify_build
```

### C. Troubleshooting Guide

**Issue**: Build fails with "Route segment config cannot be used in export mode"

**Solution**: Ensure no `generateStaticParams()` in new `app/reader/page.tsx`. This function is only needed for dynamic routes.

---

**Issue**: TypeScript error "Property 'get' does not exist on type 'ReadonlyURLSearchParams'"

**Solution**: Ensure Next.js version >= 13.4. Update with `npm install next@latest`.

---

**Issue**: Reader page shows "No book ID provided" error

**Solution**: Verify BookCard navigation uses `/reader?id=${book.id}` format. Check browser URL shows query parameter.

---

**Issue**: Build succeeds but URL encoding still present in HTML

**Solution**:
1. Verify `app/reader/[bookId]/` directory was completely deleted
2. Clear `.next/` and `out/` directories
3. Rebuild from clean state
4. If persists, check for other dynamic route configurations in app directory

---

**Issue**: Capacitor app shows blank screen when opening reader

**Solution**:
1. Open `chrome://inspect` and connect to WebView
2. Check Console for errors
3. Check Network tab for 404s on JavaScript bundles
4. Verify `npx cap sync` was run after build
5. Try uninstalling and reinstalling app (clear cache)

---

**Issue**: Query parameter not being read correctly

**Solution**:
1. Verify `useSearchParams()` import from 'next/navigation' (not 'next/router')
2. Check that component has `'use client'` directive at top
3. Log `searchParams.get('id')` to verify value
4. Ensure URL contains `?id=X` when navigating

---

### D. Glossary

**Dynamic Route Segment**: Next.js routing pattern using square brackets, e.g., `[bookId]`. Generates HTML files at build time for each parameter value.

**Static Route**: Next.js routing pattern without dynamic segments. Generates single HTML file that handles all parameter variations via client-side logic.

**Query Parameter**: URL component after `?` containing key-value pairs, e.g., `?id=1&page=5`. Read via `useSearchParams()` in Next.js.

**URL Encoding**: Process of replacing special characters with `%XX` hex codes. Square brackets become `%5B` (open) and `%5D` (close).

**Capacitor WebView**: Native iOS/Android component that displays web content. Uses platform-specific asset handler to serve files from app bundle.

**Static Export**: Next.js build mode (`output: 'export'`) that generates static HTML/CSS/JS files instead of requiring Node.js server.

**React Hydration**: Process of attaching React event handlers and state to server-rendered (or static) HTML. Fails silently if JavaScript bundles 404.

**IndexedDB**: Browser-based NoSQL database used for client-side storage. Persists across sessions but may be evicted on iOS under storage pressure.

---

## Summary

This implementation plan provides a comprehensive, step-by-step guide to refactoring the reader page routing from dynamic route segments to query parameters. The refactor is necessary to resolve a fundamental incompatibility between Next.js static export URL encoding and Capacitor's WebView asset handler.

**Key Changes**:
1. Create new static route at `app/reader/page.tsx` using `useSearchParams()`
2. Update navigation in `BookCard.tsx` to use `/reader?id={bookId}` format
3. Delete old dynamic route directory `app/reader/[bookId]/`
4. Thoroughly verify build output and test on Capacitor

**Expected Outcome**: Reader page will function correctly on Capacitor native apps (Android/iOS) while maintaining all existing functionality.

**Total Time Estimate**: 2-3 hours
- Phase 1: 20 minutes
- Phase 2: 5 minutes
- Phase 3: 5 minutes
- Phase 4: 60-90 minutes

**Risk Level**: Low (straightforward refactor with clear rollback path)

**Dependencies**: None (can be implemented immediately)
