# Capacitor Setup for Personal Use Testing

**Ticket ID:** ENG-CAP-002
**Created:** 2025-11-10
**Status:** In Progress
**Priority:** High

## Objective

Set up Capacitor to package the Adaptive Reader as a native iOS/Android app for personal testing on phone. No monetization, no user accounts - just get TTS working with background playback.

## Current Status

✅ Capacitor CLI installed
✅ Next.js configured for static export (output: 'export')
✅ Capacitor initialized with config
✅ Dynamic route fixed with generateStaticParams()

## Implementation Plan

### Phase 1: Complete Basic Capacitor Setup ✅ IN PROGRESS

**Tasks:**
1. ✅ Install Capacitor dependencies
2. ✅ Configure Next.js for static export
3. ✅ Fix dynamic routes for export
4. Build Next.js static export
5. Add iOS platform
6. Add Android platform
7. Sync web assets to native projects
8. Test basic build on device

**Success Criteria:**
- Next.js builds successfully to `/out` directory
- iOS project opens in Xcode
- Android project opens in Android Studio
- App launches on device showing library view

### Phase 2: Client-Side TTS with API Key Storage

**Tasks:**
1. Install `@capacitor/preferences` plugin
2. Create client-side TTS service using OpenAI SDK
3. Add API key settings UI in settings drawer
4. Update TTS generation to use client-side service (not API routes)
5. Handle API key validation and errors
6. Test TTS generation works with stored API key

**Success Criteria:**
- User can enter and save OpenAI API key
- TTS generation works directly from client
- No network calls to any backend except OpenAI
- API key stored securely

### Phase 3: Add Native Platforms

**Tasks:**
1. Build Next.js static export (`npm run build`)
2. Add iOS platform (`npx cap add ios`)
3. Add Android platform (`npx cap add android`)
4. Sync assets to native projects (`npx cap sync`)
5. Open in Xcode and test basic launch
6. Open in Android Studio and test basic launch

**Success Criteria:**
- Static build succeeds
- iOS project opens in Xcode
- Android project opens in Android Studio
- App launches showing library view

### Phase 4: Background Audio & Media Controls

**Tasks:**
1. Configure iOS Info.plist for background audio
2. Configure Android manifest for foreground service
3. Test HTML5 audio background playback
4. Implement Media Session API for lock screen controls
5. Test background playback on device
6. Test lock screen controls

**Success Criteria:**
- Audio continues when app is backgrounded
- Lock screen shows chapter info and controls
- Play/pause works from lock screen
- Audio survives screen lock

### Phase 3: Platform-Specific Configuration

**iOS Configuration:**
```xml
<!-- ios/App/App/Info.plist -->
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

**Android Configuration:**
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

### Phase 4: Testing & Iteration

**Test Scenarios:**
- Upload EPUB
- Generate TTS audio
- Play audio in foreground
- Background app → audio continues
- Lock screen → controls visible
- Phone call → pause/resume

## Technical Notes

### Self-Contained Architecture

**No server dependency - everything runs locally:**

- EPUB parsing: epub.js (client-side)
- Book storage: IndexedDB
- TTS generation: OpenAI SDK (client-side, direct API calls)
- Audio storage: IndexedDB + Capacitor Filesystem
- Audio playback: Native HTML5 audio with background mode

**Only external network calls:**
- OpenAI API (for TTS generation)
- Anna's Archive (optional, for book search)

### API Key Storage

Use Capacitor Preferences plugin for secure storage:
- iOS: Stored in Keychain
- Android: Stored in EncryptedSharedPreferences
- User enters API key once in settings
- Stored securely, never logged

### File Storage

Books stored in:
- IndexedDB (current - works in Capacitor WebView)
- Generated audio: IndexedDB for now, Capacitor Filesystem for optimization later

## Files Modified

1. `/next.config.js` - Added static export config
2. `/app/reader/[bookId]/page.tsx` - Added generateStaticParams
3. `/capacitor.config.ts` - Created by Capacitor init

## Next Steps

1. Complete Next.js build
2. Add iOS platform
3. Add Android platform
4. Open in Xcode/Android Studio
5. Deploy to test device

## Blockers

None currently

## Questions

- Which device to test first? iOS or Android?
- Need signing certificates for iOS?
- Android: Debug build or release build?
