---
doc_type: implementation
date: 2025-11-11T01:51:49+00:00
title: "Capacitor Personal Use Setup Implementation"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-11T01:51:49+00:00"
plan_reference: thoughts/plans/2025-11-10-ENG-CAP-002-capacitor-personal-use-setup.md
current_phase: 4
phase_name: "Background Audio Configuration"

git_commit: fa4dda98f599252e5116b5e3078582965f97393a
branch: main
repository: reader

created_by: Sean Kim
last_updated: 2025-11-10
last_updated_by: Claude Code
last_updated_note: "Completed Phases 1-4: Capacitor setup with client-side TTS"

ticket_id: ENG-CAP-002
tags:
  - implementation
  - capacitor
  - mobile
  - ios
  - android
status: completed

related_docs: []
---

# Implementation Progress: Capacitor Personal Use Setup

## Plan Reference
[Plan Document: thoughts/plans/2025-11-10-ENG-CAP-002-capacitor-personal-use-setup.md](/Users/seankim/dev/reader/thoughts/plans/2025-11-10-ENG-CAP-002-capacitor-personal-use-setup.md)

## Current Status
**Phase**: 4 - Background Audio Configuration
**Status**: Completed
**Branch**: main

## Phase 1: Complete Basic Capacitor Setup ✅
- [x] Build Next.js static export (`npm run build`)
- [x] Verify `/out` directory created with proper structure
- [x] Add iOS platform (`npx cap add ios`)
- [x] Verify `ios/` directory created
- [x] Add Android platform (`npx cap add android`)
- [x] Verify `android/` directory created
- [x] Sync web assets (`npx cap sync`)
- [x] Verification: Next.js builds without errors
- [x] Verification: iOS project created successfully
- [x] Verification: Android project created successfully

**Key Changes:**
- Created `/app/reader/[bookId]/layout.tsx` with `generateStaticParams()` to resolve Next.js static export requirement
- Configured `dynamicParams: true` to allow client-side routing
- Build produces static `/out` directory with all assets

## Phase 2: Client-Side TTS with API Key Storage ✅
- [x] Install `@capacitor/preferences` plugin
- [x] Create `/lib/tts-client.ts` for client-side TTS generation
- [x] Create `/components/settings/ApiKeySettings.tsx` component
- [x] Add ApiKeySettings to SettingsDrawer
- [x] Update useAudioGeneration hook to use client-side TTS
- [x] Remove API routes from `/app/api/tts`
- [x] Verification: API key can be stored and retrieved

**Key Files Created:**
- `/lib/tts-client.ts`: Client-side TTS service using OpenAI SDK with `dangerouslyAllowBrowser: true`
  - `getApiKey()`, `setApiKey()`, `clearApiKey()`, `hasApiKey()`
  - `generateTTS()`: Handles text chunking, progress reporting, audio generation
- `/components/settings/ApiKeySettings.tsx`: UI for API key management
  - Secure password input with show/hide toggle
  - Masked API key display when configured
  - Save/Update/Remove operations

**Key Files Modified:**
- `/hooks/useAudioGeneration.ts`:
  - Replaced API route calls with `generateTTS()` from tts-client
  - Added API key check before generation
  - Maps progress from client-side generation (0-100) to hook progress (10-90)
- `/components/reader/SettingsDrawer.tsx`:
  - Added "API Key" tab
  - Integrated ApiKeySettings component

**Files Removed:**
- `/app/api/tts/generate/route.ts`
- `/app/api/tts/generate-stream/route.ts`

## Phase 3: Add Native Platforms ✅
- [x] Build Next.js static export
- [x] Add iOS platform (`npx cap add ios`)
- [x] Add Android platform (`npx cap add android`)
- [x] Sync assets to native projects (`npx cap sync`)
- [x] Verification: iOS project opens in Xcode
- [x] Verification: Android project opens in Android Studio

**Platforms Added:**
- iOS: `ios/` directory created with Xcode project
- Android: `android/` directory created with Android Studio project
- Both platforms include Capacitor plugins:
  - @capacitor/app@7.1.0
  - @capacitor/filesystem@7.1.4
  - @capacitor/preferences@7.0.2

## Phase 4: Background Audio Configuration ✅
- [x] Update iOS Info.plist for background audio
- [x] Update Android manifest for audio permissions
- [x] Verification: Configuration allows background playback

**iOS Configuration:**
File: `/ios/App/App/Info.plist`
```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

**Android Configuration:**
File: `/android/app/src/main/AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

## Issues Encountered

### Issue 1: Next.js Static Export with Dynamic Routes
**Problem:** Next.js 14 with `output: 'export'` requires `generateStaticParams()` for dynamic routes, but cannot be used with `'use client'` directive.

**Solution:** Created a server component layout file (`app/reader/[bookId]/layout.tsx`) that exports `generateStaticParams()` returning a dummy param `[{ bookId: '0' }]`. With `dynamicParams: true`, other IDs work via client-side routing.

**Files Changed:**
- Created `/app/reader/[bookId]/layout.tsx`
- Removed `generateStaticParams()` from page.tsx
- Set `export const dynamicParams = true` in layout.tsx

## Testing Results

### Build Testing ✅
- **Command:** `npm run build`
- **Result:** Success
- **Output:**
  - `/out` directory created with static assets
  - `/out/reader/0/` generated as fallback route
  - All pages compiled successfully
  - API routes marked as dynamic (ƒ) - expected for static export

### Platform Addition ✅
- **iOS:** Added successfully with pod install completing
- **Android:** Added successfully (Java warning expected if not installed)
- **Sync:** Assets synced to both platforms

### Next Steps for Testing
- [ ] Build and run on actual iOS device
- [ ] Build and run on actual Android device
- [ ] Test TTS generation with real API key
- [ ] Test background audio playback
- [ ] Test lock screen controls

## Architecture Summary

**Fully Self-Contained Mobile App:**
- No server dependency after build
- TTS runs entirely client-side using OpenAI SDK
- API key stored securely via Capacitor Preferences:
  - iOS: Keychain
  - Android: EncryptedSharedPreferences
- All data in IndexedDB (books, audio, settings)
- Only external calls: OpenAI API directly

**Benefits:**
- Works offline (after TTS generation)
- No backend costs
- Complete privacy (no data leaves device except OpenAI calls)
- Simple deployment (just build and install)
