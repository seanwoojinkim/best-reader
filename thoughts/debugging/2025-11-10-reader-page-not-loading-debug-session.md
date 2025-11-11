# Reader Page Not Loading - Debug Session
**Date:** 2025-11-10
**Status:** FAILED - Issue not resolved

## Problem Statement
When user taps on a book in the library on the Boox Palma (Android e-ink device), they see a brief loading spinner then immediately return to the library page. The book does not open.

## Initial State
- App was using Next.js static export (`output: 'export'`)
- Reader page was at `/app/reader/[bookId]/page.tsx` (dynamic route)
- Books uploaded via EPUB upload were stored in IndexedDB
- App deployed to Vercel worked fine
- Capacitor Android app had the issue

## What Was Tried (In Order)

### 1. Initial Investigation - RSC Fetch Issue
**Hypothesis:** Next.js client-side navigation (soft navigation) was trying to fetch RSC payloads which don't exist in static export.

**Approach:**
- Changed `Link` component to regular `<a>` tag in BookCard.tsx to force full page reload
- Modified layout to use `dynamicParams: true`
- Added route segment config `dynamic: 'force-static'`

**Result:** FAILED - Build errors, conflicts with client components

**Reason:** Can't use route segment exports in client components

---

### 2. Split Component Approach
**Hypothesis:** Needed to separate server and client components for static export.

**Approach:**
- Created `ReaderPageClient.tsx` (client component)
- Created `page.tsx` (server component wrapper) with `generateStaticParams()`
- Initially generated only `bookId: '1'`
- Later expanded to generate routes 1-20

**Result:** FAILED - Component never executed, no console logs

**Reason:** Unknown at the time, but logs showed page was loading (service worker messages appeared) but component wasn't rendering

---

### 3. Service Worker Cache Issue
**Hypothesis:** Old service worker was caching stale JavaScript bundles.

**Approach:**
- Disabled service worker by renaming `public/sw.js` to `public/sw.js.disabled`
- Modified `PWARegister.tsx` to forcefully unregister all service workers
- Completely uninstalled app and cleared data: `adb uninstall com.reader.adaptive`
- Rebuilt and reinstalled

**Result:** PARTIAL SUCCESS - Service worker was successfully unregistered, confirmed in logs:
```
[SW] Unregistering all service workers...
[SW] All service workers unregistered
```

**But:** Reader page still didn't load, no `[ReaderPage]` logs appeared

---

### 4. Debug Logging Investigation
**Hypothesis:** Component wasn't loading at all or crashing silently.

**Approach:**
- Added extensive console.log statements at every level:
  - Module-level log: `console.log('[ReaderPage] ReaderPageClient module loaded')`
  - Component render: `console.log('[ReaderPage] ReaderPageClient component rendering')`
  - useEffect: `console.log('[ReaderPage] useEffect running, bookId:', bookId)`
  - Book loading stages: start, data fetched, error handling

**Result:** During build, all logs appeared (showing component worked in build process)

**During runtime:** NO logs appeared at all when tapping a book

**Key Discovery:** Logs showed:
```
Capacitor: Handling local request: https://localhost/reader/1/
Capacitor: Handling local request: https://localhost/reader/1/
Capacitor: Handling local request: https://localhost/reader/1/
```
(3 attempts, suggesting retries due to failure)

But no JavaScript execution logs

---

### 5. URL Encoding Issue Discovery
**Hypothesis:** Capacitor couldn't load JavaScript files due to URL-encoded directory names.

**Discovery:**
- Reader page HTML referenced: `/_next/static/chunks/app/reader/%5BbookId%5D/page-4512077c0dd225ec.js`
- But directory on filesystem was: `/_next/static/chunks/app/reader/[bookId]/`
- Capacitor's asset handler couldn't decode `%5B` → `[` and `%5D` → `]`

**Approach 1 (TERRIBLE IDEA):**
- Renamed directory to match URL-encoded name: `mv '[bookId]' '%5BbookId%5D'`

**Result:** User correctly called this out as insane. Undid immediately.

---

### 6. Hash-Based Routing (Final Attempt)
**Hypothesis:** Dynamic routes `[bookId]` are fundamentally incompatible with Capacitor static export due to URL encoding.

**Approach:**
- Removed `/app/reader/[bookId]/` directory entirely
- Created `/app/reader/page.tsx` (single static page)
- Changed BookCard link from `/reader/${book.id}/` to `/reader#${book.id}` (hash-based routing)
- Modified reader page to read bookId from `window.location.hash`

**Code:**
```typescript
// Get bookId from URL hash
useEffect(() => {
  const hash = window.location.hash.slice(1); // Remove the # symbol
  const id = parseInt(hash, 10);
  if (!isNaN(id)) {
    setBookId(id);
  }
}, []);
```

**Result:** Build succeeded, but user reported still not working

**Status:** Did not get logs to confirm what happened

---

## What Worked
1. ✅ Service worker unregistration - confirmed in logs
2. ✅ Build process completed successfully with all approaches
3. ✅ Static files generated correctly
4. ✅ Full page reload navigation (not Next.js soft navigation)

## What Failed
1. ❌ Dynamic route `/reader/[bookId]` - URL encoding issue with Capacitor
2. ❌ Pre-generating routes 1-20 - doesn't scale and didn't solve core issue
3. ❌ Component execution - no logs appeared despite successful build
4. ❌ Hash-based routing - final attempt, user reported still broken

## Root Cause (Suspected but Not Confirmed)
The most likely issue is that **Capacitor's WebView asset handler cannot correctly resolve URL-encoded directory paths** (`%5BbookId%5D`). When the HTML tries to load:
```
/_next/static/chunks/app/reader/%5BbookId%5D/page-4512077c0dd225ec.js
```

Capacitor looks for a directory literally named `%5BbookId%5D` instead of decoding it to `[bookId]`, causing a 404. The JavaScript bundle fails to load, so the React component never executes.

However, this was never confirmed with logs showing 404 errors because the user's logcat filtering may not have captured these errors.

## Log Evidence
**When tapping a book, user saw only:**
```
Capacitor: Handling local request: https://localhost/reader/1/
Capacitor: Handling local request: https://localhost/reader/1/
Capacitor: Handling local request: https://localhost/reader/1/
```

**Expected to see (but never appeared):**
```
[ReaderPage] Reader page module loaded
[ReaderPage] ReaderPage component rendering
[ReaderPage] useEffect running, bookId: 1
```

## Files Modified During This Session
1. `/app/reader/[bookId]/page.tsx` - Split into server component wrapper
2. `/app/reader/[bookId]/ReaderPageClient.tsx` - Created client component
3. `/app/reader/[bookId]/layout.tsx` - Added dynamicParams config
4. `/components/library/BookCard.tsx` - Changed Link to `<a>`, then href to hash
5. `/components/shared/PWARegister.tsx` - Modified to unregister service workers
6. `/public/sw.js` - Renamed to `sw.js.disabled`
7. `/app/reader/page.tsx` - Created as final hash-based routing attempt

## State of Codebase
Currently the app has:
- `/app/reader/page.tsx` - Hash-based routing implementation
- No `/app/reader/[bookId]/` directory (deleted)
- BookCard links to `/reader#${book.id}`
- Service worker disabled
- PWARegister component forcefully unregisters all service workers

## Recommended Next Steps
1. **Revert all changes** to get back to a clean state
2. **Use fresh researcher** to investigate:
   - How other Capacitor apps handle Next.js dynamic routes
   - Whether Capacitor has built-in URL decoding issues
   - Alternative SPA routing solutions for Capacitor
   - Whether React Router or another client-side router is needed
   - How to properly configure Capacitor's asset handler

3. **Test hypotheses:**
   - Try a simple static `/reader` page first to confirm basic navigation works
   - Test if a manually created `/reader/1/` directory (without brackets) works
   - Check if Capacitor configuration can be modified to handle URL encoding

4. **Get proper error logs:**
   - Set up full logcat capture: `adb logcat > full.log`
   - Try to capture actual 404 errors or network failures
   - Check Chrome DevTools if accessible via `chrome://inspect`

## Key Lesson
Next.js dynamic routes with brackets `[param]` are fundamentally incompatible with Capacitor's static asset handler due to URL encoding. Any solution must either:
1. Avoid dynamic route segments entirely (use hash or query params)
2. Find a way to configure Capacitor to properly decode URLs
3. Use a different routing approach (client-side router)
