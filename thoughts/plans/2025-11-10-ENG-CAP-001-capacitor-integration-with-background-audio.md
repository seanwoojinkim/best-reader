# Capacitor Integration with Background Audio Support

**Ticket ID:** ENG-CAP-001
**Created:** 2025-11-10
**Status:** Planning
**Priority:** High

## Overview

Integrate Capacitor to package the Next.js e-reader app as native iOS and Android apps with background audio playback and native media controls.

## Key Requirements

1. Package web app as native iOS/Android apps
2. Background audio playback (continues when app is minimized)
3. Native media controls (lock screen, notification controls)
4. Pre-fetch TTS generation (2-3 chapters ahead)
5. Handle media interruptions (phone calls, etc.)

## Critical Constraint

**Background TTS generation is NOT possible** - Both iOS and Android terminate long-running HTTP connections when apps are backgrounded. Solution: Pre-fetch chapters while in foreground.

## Architecture Changes

### Current Architecture
```
User reads → Click TTS → Generate via OpenAI API → Play in Web Audio API
```

### New Architecture
```
Foreground:
  User reads → Queue chapters → Generate TTS → Store audio files → Play

Background:
  Native audio player → Continue playback → Media controls → Handle interruptions
```

## Implementation Phases

### Phase 1: Capacitor Setup (Week 1)

**Goal:** Basic Capacitor integration, static export configuration

**Tasks:**
1. Install Capacitor CLI and dependencies
2. Configure Next.js for static export
3. Initialize iOS and Android projects
4. Configure app metadata (name, icons, splash screens)
5. Test basic build and deployment

**Deliverables:**
- Working iOS and Android app builds
- App launches and displays web content
- No functionality changes yet

### Phase 2: Native Audio Integration (Week 2)

**Goal:** Replace Web Audio API with native audio for background support

**Tasks:**
1. Install `@mediagrid/capacitor-native-audio` plugin
2. Create native audio service wrapper
3. Update audio playback logic to use native player
4. Test audio continues when app backgrounds
5. Handle platform-specific audio session configuration

**Technical Details:**
```typescript
// New: NativeAudioService
interface NativeAudioService {
  preload(id: string, audioUrl: string): Promise<void>;
  play(id: string): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
}
```

**Platform Configuration:**
- iOS: Add `audio` to UIBackgroundModes in Info.plist
- Android: Configure foreground service with mediaPlayback type

**Deliverables:**
- Audio plays using native player
- Playback continues when app is backgrounded
- Screen lock doesn't stop playback

### Phase 3: Media Controls Integration (Week 3)

**Goal:** Add lock screen controls and notification controls

**Tasks:**
1. Install `@jofr/capacitor-media-session` plugin
2. Set up MediaSession metadata (title, chapter, artwork)
3. Implement media control handlers (play/pause/skip)
4. Configure notification display (Android)
5. Test Control Center integration (iOS)

**Technical Details:**
```typescript
// MediaSession Integration
import { MediaSession } from '@jofr/capacitor-media-session';

await MediaSession.setMetadata({
  title: chapterTitle,
  artist: bookAuthor,
  album: bookTitle,
  artwork: [{ src: coverImageUrl, sizes: '512x512' }]
});

await MediaSession.setActionHandler({ action: 'play' }, async () => {
  await nativeAudio.play(currentAudioId);
});

await MediaSession.setActionHandler({ action: 'pause' }, async () => {
  await nativeAudio.pause();
});
```

**Platform Configuration:**
- iOS: Control Center shows chapter metadata
- Android: Persistent notification with playback controls

**Deliverables:**
- Lock screen shows chapter info and controls
- Play/pause from lock screen works
- Notification controls functional (Android)

### Phase 4: TTS Pre-fetching System (Week 4)

**Goal:** Generate chapters ahead of current playback

**Tasks:**
1. Create TTS queue manager
2. Implement chapter pre-fetch logic (2-3 chapters ahead)
3. Store generated audio in filesystem
4. Handle queue updates as user progresses
5. Manage storage cleanup (remove old chapters)

**Technical Details:**
```typescript
interface TTSQueueManager {
  // Queue management
  queueChapter(chapterId: string, priority: number): Promise<void>;
  getQueueStatus(): QueueStatus;

  // Pre-fetching
  prefetchAhead(currentChapterId: string, lookAhead: number): Promise<void>;
  isPrefetched(chapterId: string): boolean;

  // Storage management
  getStoredAudioUrl(chapterId: string): Promise<string | null>;
  cleanupOldChapters(keepCount: number): Promise<void>;
}

// Pre-fetch strategy
- Always keep current + next 2 chapters
- Generate in background while user reads
- Pause generation when app backgrounds (resume on foreground)
- Clean up chapters more than 5 behind current position
```

**Storage Strategy:**
- Use Capacitor Filesystem API for audio files
- IndexedDB for metadata (generation status, file paths)
- Cache limit: 10 chapters max (~50-100MB)

**Deliverables:**
- Chapters auto-generate ahead of playback
- Seamless playback transition between chapters
- Storage stays under limit

### Phase 5: Background State Management (Week 5)

**Goal:** Handle app lifecycle and state transitions

**Tasks:**
1. Detect app state changes (foreground/background)
2. Pause TTS generation when backgrounded
3. Resume generation when foregrounded
4. Handle interruptions (phone calls, other media)
5. Save playback position for resume

**Technical Details:**
```typescript
import { App } from '@capacitor/app';

App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // App came to foreground
    ttsQueueManager.resumeGeneration();
  } else {
    // App went to background
    ttsQueueManager.pauseGeneration();
    // Native audio continues playing
  }
});

// iOS audio interruption handling
App.addListener('audioInterruption', ({ type }) => {
  if (type === 'began') {
    nativeAudio.pause();
  } else if (type === 'ended') {
    nativeAudio.play(currentAudioId);
  }
});
```

**Deliverables:**
- TTS generation pauses in background
- Audio playback continues in background
- Interruptions handled gracefully
- Playback position persists

### Phase 6: Platform-Specific Configuration (Week 6)

**Goal:** Configure iOS and Android for App Store submission

**Tasks:**
1. Configure iOS Info.plist (background modes, permissions)
2. Configure Android manifest (foreground service, permissions)
3. Create app icons and splash screens
4. Set up signing certificates
5. Prepare App Store metadata

**iOS Configuration (Info.plist):**
```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>

<key>NSMicrophoneUsageDescription</key>
<string>Not used - only for audio playback</string>
```

**Android Configuration (AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<service
    android:name="com.mediagrid.capacitornativeaudio.ForegroundService"
    android:foregroundServiceType="mediaPlayback"
    android:exported="false" />
```

**App Store Requirements:**
- iOS: Demo video showing persistent audio playback
- Android: Demo video of foreground service notification
- Privacy policy for data collection
- App Review notes explaining background audio use

**Deliverables:**
- Platform configurations complete
- App icons and splash screens added
- Signing certificates configured
- App Store metadata ready

### Phase 7: Testing & Optimization (Week 7)

**Goal:** Comprehensive testing and performance optimization

**Tasks:**
1. Test background playback scenarios
2. Test media controls on all platforms
3. Battery usage profiling
4. Storage management testing
5. Edge case handling (network errors, storage full, etc.)

**Test Scenarios:**
- Lock screen → Unlock → Audio continues
- Switch to another app → Audio continues
- Phone call interruption → Resume after call
- Low battery → Audio continues
- Storage full → Show error, prevent generation
- Network offline → Play cached chapters only
- Generate 10 chapters → Storage cleanup works

**Battery Optimization:**
- Profile CPU usage during generation vs playback
- Test Doze mode impact (Android)
- Optimize pre-fetch frequency
- Target: <5% battery drain per hour of playback

**Deliverables:**
- All test scenarios pass
- Battery usage acceptable
- Performance metrics documented

## Technical Specifications

### Dependencies

```json
{
  "@capacitor/core": "^6.0.0",
  "@capacitor/cli": "^6.0.0",
  "@capacitor/ios": "^6.0.0",
  "@capacitor/android": "^6.0.0",
  "@capacitor/app": "^6.0.0",
  "@capacitor/filesystem": "^6.0.0",
  "@mediagrid/capacitor-native-audio": "^6.0.0",
  "@jofr/capacitor-media-session": "^6.0.0"
}
```

### Next.js Configuration Changes

```javascript
// next.config.js
const nextConfig = {
  output: 'export',  // Required for Capacitor
  images: {
    unoptimized: true,  // Static export doesn't support image optimization
  },
  // ... existing webpack config
};
```

### File Structure

```
/
├── capacitor.config.ts          # Capacitor configuration
├── ios/                         # iOS native project
├── android/                     # Android native project
├── out/                         # Next.js static export output
├── lib/
│   ├── audio/
│   │   ├── NativeAudioService.ts      # Native audio wrapper
│   │   ├── MediaSessionService.ts     # Media controls
│   │   └── TTSQueueManager.ts         # Pre-fetch queue
│   └── capacitor/
│       ├── AppStateManager.ts         # Lifecycle handling
│       └── StorageManager.ts          # Filesystem + IndexedDB
```

## Success Criteria

- [ ] App builds successfully for iOS and Android
- [ ] Audio continues playing when app is backgrounded
- [ ] Lock screen controls work (play/pause/skip)
- [ ] Chapters pre-fetch automatically (2-3 ahead)
- [ ] Phone call interruption handled gracefully
- [ ] Storage stays under 100MB
- [ ] Battery drain <5% per hour of playback
- [ ] App Store submission requirements met

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| iOS app rejection (background audio) | High | Prepare demo video, clear App Review notes |
| Storage limits on device | Medium | Aggressive cleanup, user settings for cache size |
| Battery drain from pre-fetching | Medium | Limit concurrent generations, pause in background |
| OpenAI API rate limits | Medium | Implement exponential backoff, queue throttling |
| Large EPUB files crash app | Low | Chunk processing, memory profiling |

## Open Questions

1. Should we allow user to configure pre-fetch count (1-5 chapters)?
2. What happens if user jumps to chapter 20 when only 1-3 are cached?
3. Should we show storage usage in settings?
4. Do we need offline mode messaging if no cached chapters available?

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [capacitor-native-audio Plugin](https://github.com/mediagrid/capacitor-native-audio)
- [capacitor-media-session Plugin](https://github.com/jofr/capacitor-media-session)
- [iOS Background Execution](https://developer.apple.com/documentation/avfoundation/media_playback/configuring_your_app_for_media_playback)
- [Android Foreground Services](https://developer.android.com/develop/background-work/services/foreground-services)

## Related Documents

- Research: `/thoughts/research/2025-11-10-ENG-MOBILE-001-next-js-e-reader-mobile-packaging-solutions.md`
- Research: `/thoughts/research/2025-11-10-ENG-SYNC-001-background-audio-and-media-controls-in-capacitor-tts-apps.md`
