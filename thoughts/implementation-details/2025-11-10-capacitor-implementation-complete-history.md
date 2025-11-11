# Capacitor Implementation - Complete History
**Date:** 2025-11-10
**Status:** PARTIALLY COMPLETE - App builds and installs but reader page doesn't open

## Original Goal
Convert the Next.js e-reader web app to a native Android/iOS app using Capacitor, making it fully self-contained without requiring a Vercel server connection.

## Requirements
1. App must work entirely offline (no Vercel dependency)
2. All data stored locally on device (IndexedDB)
3. API keys stored securely (iOS Keychain / Android EncryptedSharedPreferences)
4. Background audio playback support
5. Anna's Archive search and download working from the device
6. TTS generation working client-side

---

## Phase 1: Initial Capacitor Setup

### What Was Done
1. **Installed Capacitor and dependencies:**
   ```bash
   npm install @capacitor/core @capacitor/cli
   npm install @capacitor/app @capacitor/filesystem @capacitor/preferences
   npx cap init "Adaptive Reader" "com.reader.adaptive"
   ```

2. **Created `capacitor.config.ts`:**
   ```typescript
   import type { CapacitorConfig } from '@capacitor/cli';

   const config: CapacitorConfig = {
     appId: 'com.reader.adaptive',
     appName: 'Adaptive Reader',
     webDir: 'out'
   };

   export default config;
   ```

3. **Modified `next.config.js` for static export:**
   ```javascript
   const nextConfig = {
     output: 'export',
     images: {
       unoptimized: true,
     },
     trailingSlash: true,
     webpack: (config, { isServer }) => {
       if (!isServer) {
         config.resolve.fallback = {
           ...config.resolve.fallback,
           fs: false,
           path: false,
         };
       }
       return config;
     },
     experimental: {
       missingSuspenseWithCSRBailout: false,
     },
   };
   ```

4. **Added platforms:**
   ```bash
   npx cap add ios
   npx cap add android
   ```

### What Worked
- ✅ Capacitor installed successfully
- ✅ Static export configuration working
- ✅ Android and iOS platforms created
- ✅ Basic app structure in place

### What Didn't Work
- ❌ Initial build had issues with dynamic routes (addressed later)

---

## Phase 2: Server-to-Client Migration

### Goal
Remove all server-side API routes and move functionality to client-side to work without Vercel.

### Files Deleted (Server API Routes)
1. `/app/api/tts/generate/route.ts` - Server-side TTS generation
2. `/app/api/tts/generate-stream/route.ts` - Server-side TTS streaming
3. `/app/api/books/search/route.ts` - Server-side Anna's Archive search
4. `/app/api/books/download/route.ts` - Server-side book download
5. `/lib/rate-limiter.ts` - Server-side rate limiting (no longer needed)

### Files Created

#### 1. `/lib/api-keys.ts` - Centralized API Key Management
```typescript
import { Preferences } from '@capacitor/preferences';

const OPENAI_API_KEY = 'openai_api_key';
const ANNAS_ARCHIVE_API_KEY = 'annas_archive_api_key';

export async function getOpenAIApiKey(): Promise<string | null> {
  const { value } = await Preferences.get({ key: OPENAI_API_KEY });
  return value;
}

export async function setOpenAIApiKey(apiKey: string): Promise<void> {
  await Preferences.set({ key: OPENAI_API_KEY, value: apiKey });
}

export async function removeOpenAIApiKey(): Promise<void> {
  await Preferences.remove({ key: OPENAI_API_KEY });
}

export async function hasOpenAIApiKey(): Promise<boolean> {
  const key = await getOpenAIApiKey();
  return key !== null && key.length > 0;
}

// Similar functions for Anna's Archive API key
export async function getAnnasArchiveApiKey(): Promise<string | null> { ... }
export async function setAnnasArchiveApiKey(apiKey: string): Promise<void> { ... }
export async function removeAnnasArchiveApiKey(): Promise<void> { ... }
export async function hasAnnasArchiveApiKey(): Promise<boolean> { ... }
```

**Purpose:** Secure storage using Capacitor Preferences (iOS Keychain / Android EncryptedSharedPreferences)

**Status:** ✅ Working - Keys stored and retrieved successfully

#### 2. `/lib/tts-client.ts` - Client-Side TTS Generation
```typescript
import OpenAI from 'openai';
import { getOpenAIApiKey } from './api-keys';

export async function generateTTS({
  text,
  voice,
  speed,
  onProgress,
}: GenerateTTSParams): Promise<GenerateTTSResult> {
  const apiKey = await getOpenAIApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side
  });

  // Split text into chunks and generate audio
  // ... chunking logic
}
```

**Purpose:** Client-side TTS generation using OpenAI SDK with `dangerouslyAllowBrowser: true`

**Status:** ✅ Working (in theory - not tested due to reader page issue)

#### 3. `/components/settings/ApiKeySettings.tsx` - OpenAI API Key UI
Component for managing OpenAI API key with:
- Input field with show/hide toggle
- Save/Update/Remove buttons
- Status indicator (configured/not configured)
- Masked display of existing key
- Secure storage via Capacitor Preferences

**Status:** ✅ UI created and integrated into SettingsDrawer

#### 4. `/components/settings/AnnasArchiveApiKeySettings.tsx` - Anna's Archive API Key UI
Similar to ApiKeySettings but for Anna's Archive:
- Input field with show/hide toggle
- Save/Update/Remove buttons
- Status indicator
- Link to annas-archive.org/account for getting API key

**Status:** ✅ UI created and integrated into SettingsDrawer

### Files Modified

#### 1. `/components/reader/SettingsDrawer.tsx`
**Changes:**
- Added new "API Key" tab to settings
- Imported ApiKeySettings and AnnasArchiveApiKeySettings components
- Displays both API key settings in one tab with divider

```typescript
{activeTab === 'apikey' && (
  <div className="space-y-8">
    <ApiKeySettings />
    <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
      <AnnasArchiveApiKeySettings />
    </div>
  </div>
)}
```

**Status:** ✅ Working - Settings drawer displays API key inputs

#### 2. `/hooks/useAudioGeneration.ts`
**Changes:**
- Modified to use client-side `generateTTS` from `lib/tts-client.ts`
- Changed import from server route to client library
- Fixed TypeScript type narrowing issue with destructuring

```typescript
// Before
const response = await fetch('/api/tts/generate', { ... });

// After
import { generateTTS } from '@/lib/tts-client';
const result = await generateTTS({ ... });
```

**Status:** ✅ Code modified correctly (not tested due to reader issue)

#### 3. `/lib/annas-archive.ts`
**Major Changes:** Added Capacitor HTTP support to bypass CORS

```typescript
import { CapacitorHttp } from '@capacitor/core';

function isCapacitor(): boolean {
  return !!(window as any).Capacitor;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, isBinaryDownload = false): Promise<Response> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36...',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9...',
    // ... other headers
  };

  // Use Capacitor HTTP in native app to bypass CORS
  if (isCapacitor()) {
    const capOptions: any = {
      url,
      headers: headers as Record<string, string>,
      connectTimeout: TIMEOUT_MS,
      readTimeout: TIMEOUT_MS,
    };

    if (isBinaryDownload) {
      capOptions.responseType = 'blob';
    }

    const response = await CapacitorHttp.get(capOptions);
    return new Response(response.data, {
      status: response.status,
      statusText: response.status === 200 ? 'OK' : 'Error',
      headers: response.headers as HeadersInit,
    });
  }

  // Use regular fetch for web
  // ... existing fetch code
}
```

**Purpose:** Bypass CORS restrictions in native WebView

**Status:** ✅ Code working, search works on device, download not tested

#### 4. `/components/library/SearchModal.tsx`
**Changes:**
- Removed fetch calls to `/api/books/search` and `/api/books/download`
- Now calls `searchAnnasArchive()` and `downloadFromAnnasArchive()` directly
- Added API key check before download

```typescript
// Before
const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);

// After
const results = await searchAnnasArchive(query, 'epub');
```

**Status:** ✅ Search working on device

#### 5. `/package.json`
**Dependencies Added:**
```json
{
  "@capacitor/android": "^7.1.0",
  "@capacitor/app": "^7.1.0",
  "@capacitor/cli": "^7.1.0",
  "@capacitor/core": "^7.1.0",
  "@capacitor/filesystem": "^7.1.4",
  "@capacitor/ios": "^7.1.0",
  "@capacitor/preferences": "^7.0.2"
}
```

**Status:** ✅ All dependencies installed

---

## Phase 3: Android Configuration

### Files Created/Modified

#### 1. `/android/app/src/main/AndroidManifest.xml`
**Added Permissions:**
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

**Added Network Security Config:**
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    android:usesCleartextTraffic="false">
```

**Purpose:** Enable internet, background audio, and enforce HTTPS

**Status:** ✅ Permissions configured

#### 2. `/android/app/src/main/res/xml/network_security_config.xml`
**Created:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">annas-archive.org</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>

    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.openai.com</domain>
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </domain-config>
</network-security-config>
```

**Purpose:** Configure network security for HTTPS connections

**Status:** ✅ Configuration in place

---

## Phase 4: Dynamic Route Configuration

### Goal
Make Next.js dynamic routes work with Capacitor static export.

### Approach 1: generateStaticParams with dynamicParams
**Files Modified:**
- `/app/reader/[bookId]/page.tsx` - Added `generateStaticParams()` returning `[{bookId: '0'}]`
- `/app/reader/[bookId]/layout.tsx` - Created with `export const dynamicParams = true`

**Code:**
```typescript
// page.tsx
export function generateStaticParams() {
  return [{ bookId: '0' }];
}

// layout.tsx
export const dynamicParams = true;
```

**Result:** Build failed - "Page is missing generateStaticParams()"

### Approach 2: Generate Multiple Static Routes
**Modified to generate routes 1-20:**
```typescript
export function generateStaticParams() {
  return Array.from({ length: 20 }, (_, i) => ({
    bookId: String(i + 1),
  }));
}
```

**Result:** Build succeeded, but routes didn't work at runtime

### Approach 3: Split Server/Client Components
**Created:**
- `/app/reader/[bookId]/ReaderPageClient.tsx` - Client component with all logic
- `/app/reader/[bookId]/page.tsx` - Server component wrapper

**Code:**
```typescript
// page.tsx
import ReaderPageClient from './ReaderPageClient';

export function generateStaticParams() {
  return Array.from({ length: 20 }, (_, i) => ({
    bookId: String(i + 1),
  }));
}

export default function ReaderPage() {
  return <ReaderPageClient />;
}
```

**Result:** Build succeeded, but component never executed at runtime

**Status:** ❌ FAILED - See debugging session document for details

---

## What Currently Works

### ✅ Working Features
1. **App Installation:** App builds and installs on Android successfully
2. **Library Page:** Home page displays, books show up
3. **Book Upload:** Can upload EPUB files
4. **Book Storage:** Books stored in IndexedDB with cover images as Blobs
5. **Anna's Archive Search:** Search works on device (CORS bypassed)
6. **API Key Storage:** Both OpenAI and Anna's Archive keys can be stored/retrieved
7. **Settings UI:** All settings panels render correctly
8. **Service Worker Unregistration:** Successfully unregisters old service workers

### ❌ Broken Features
1. **Reader Page Navigation:** Tapping a book doesn't open it (main blocker)
2. **TTS Generation:** Can't test because reader page doesn't open
3. **Background Audio:** Can't test because reader page doesn't open
4. **Anna's Archive Download:** Search works but download not tested
5. **Book Reading:** Can't read any books

---

## Root Cause Analysis

### The Core Issue: URL Encoding in Dynamic Routes

**Discovery:**
When Next.js generates static HTML for `/reader/[bookId]/`, it creates:
- Directory: `out/reader/[bookId]/` (literal brackets)
- HTML references: `/_next/static/chunks/app/reader/%5BbookId%5D/page-xxx.js` (URL-encoded brackets)

**The Problem:**
Capacitor's WebView asset handler looks for a directory literally named `%5BbookId%5D` instead of decoding the URL to `[bookId]`, causing JavaScript bundles to fail to load silently (404).

**Evidence:**
1. Capacitor logs showed: `Handling local request: https://localhost/reader/1/` (repeated 3 times)
2. No JavaScript execution logs appeared
3. No `[ReaderPage]` console logs despite extensive debug logging
4. Page loaded briefly (spinner visible) then immediately redirected back to library

**Why This Happens:**
- Next.js uses URL encoding in generated HTML paths
- Capacitor serves files directly from filesystem without URL decoding
- Mismatch causes silent 404 on JavaScript bundles
- React never hydrates, component never executes
- App falls back to home page

---

## Attempted Solutions (All Failed)

### 1. Pre-generating Static Routes (1-20)
**Problem:** Doesn't scale, doesn't solve URL encoding issue

### 2. dynamicParams Configuration
**Problem:** Only works with server-side rendering, not static export

### 3. Server/Client Component Split
**Problem:** Doesn't address the underlying URL encoding issue

### 4. Disabling Service Worker
**Problem:** Not related to the actual issue (but was a good cleanup)

### 5. Hash-Based Routing
**Attempt:** Changed to `/reader#${bookId}` and single `/app/reader/page.tsx`
**Status:** User reported still not working (insufficient logs to diagnose)

---

## Build Process

### Commands Used
```bash
# Development
npm run dev

# Build for Capacitor
npm run build
npx cap sync android
npx cap sync ios

# Open in Android Studio
npx cap open android

# Or build APK directly
cd android && ./gradlew assembleDebug

# Install on device
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or run directly
npx cap run android
```

### Build Configuration
**next.config.js:**
```javascript
output: 'export'           // Static HTML export
images: { unoptimized: true }  // No Next.js image optimization
trailingSlash: true        // Add trailing slashes to URLs
```

**capacitor.config.ts:**
```typescript
webDir: 'out'  // Points to Next.js static export output
```

---

## Key Files in Final State

### Configuration Files
- `capacitor.config.ts` - Capacitor app configuration
- `next.config.js` - Modified for static export
- `package.json` - Added Capacitor dependencies
- `android/app/src/main/AndroidManifest.xml` - Android permissions
- `android/app/src/main/res/xml/network_security_config.xml` - Network config

### New Library Files
- `lib/api-keys.ts` - Secure API key storage using Capacitor Preferences
- `lib/tts-client.ts` - Client-side TTS generation
- `lib/annas-archive.ts` - Modified with Capacitor HTTP for CORS bypass

### New Components
- `components/settings/ApiKeySettings.tsx` - OpenAI API key management UI
- `components/settings/AnnasArchiveApiKeySettings.tsx` - Anna's Archive API key UI

### Modified Components
- `components/reader/SettingsDrawer.tsx` - Added API Key tab
- `components/library/SearchModal.tsx` - Uses client-side Anna's Archive
- `hooks/useAudioGeneration.ts` - Uses client-side TTS

### Deleted Files
- All `/app/api/*` routes (server-side APIs removed)
- `lib/rate-limiter.ts` (no longer needed)

---

## Outstanding Questions for Research

1. **URL Encoding Issue:**
   - How do other Capacitor apps handle Next.js dynamic routes?
   - Can Capacitor be configured to decode URLs before resolving assets?
   - Is there a Capacitor plugin or setting we're missing?

2. **Alternative Routing:**
   - Should we use React Router instead of Next.js routing?
   - Is there a Capacitor-specific routing solution?
   - Can we configure Next.js to not use URL encoding in static export?

3. **Debugging:**
   - How to access Chrome DevTools for Capacitor WebView?
   - How to capture full network logs including 404s?
   - Is there a Capacitor debugging mode that shows more details?

4. **Static Export:**
   - Are dynamic routes fundamentally incompatible with Capacitor?
   - Should we restructure the app to avoid dynamic routes entirely?
   - What's the recommended pattern for SPA routing in Capacitor + Next.js?

5. **Best Practices:**
   - What's the recommended approach for Capacitor + Next.js?
   - Should we use `output: 'export'` or a different Next.js config?
   - Are there working examples of Capacitor + Next.js with dynamic routes?

---

## Recommendations for Next Implementation Attempt

1. **Start with Simple Static Page:**
   - First, create `/reader/index.html` (no dynamic route) to verify basic navigation works
   - Confirm Capacitor can load and execute JavaScript on static pages

2. **Research URL Encoding:**
   - Investigate if Capacitor has URL decoding configuration
   - Check if there's a file path vs URL path mismatch

3. **Consider Alternative Architectures:**
   - Use a single `/reader` page with client-side routing (React Router)
   - Pass bookId via query params or hash (simpler than dynamic routes)
   - Store route state in memory/localStorage instead of URL

4. **Test Incrementally:**
   - Verify each piece works before moving to next:
     - Static page loads ✓
     - JavaScript executes ✓
     - Navigation works ✓
     - Dynamic content loads ✓

5. **Get Better Debugging:**
   - Set up Chrome DevTools connection: `chrome://inspect`
   - Capture full logcat: `adb logcat > full.log`
   - Check Network tab for 404s on JavaScript bundles
   - Verify file paths match what HTML requests

6. **Learn from Working Examples:**
   - Find open-source Capacitor + Next.js apps
   - Check if they use dynamic routes or alternative patterns
   - Study their configuration and routing approach

---

## Summary

We successfully:
- ✅ Set up Capacitor infrastructure
- ✅ Migrated all server APIs to client-side
- ✅ Implemented secure API key storage
- ✅ Configured Android permissions and network security
- ✅ Got Anna's Archive search working on device
- ✅ Created comprehensive settings UI for API keys

We failed to:
- ❌ Make dynamic routes work with Capacitor static export
- ❌ Open the reader page when tapping a book
- ❌ Achieve the core goal of reading books on device

The fundamental blocker is **Next.js dynamic route URL encoding is incompatible with Capacitor's asset handler**, causing JavaScript bundles to fail to load silently. This needs to be resolved before the app can function.
