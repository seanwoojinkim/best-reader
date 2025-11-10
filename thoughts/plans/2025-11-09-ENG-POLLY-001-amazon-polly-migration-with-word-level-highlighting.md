---
doc_type: plan
date: 2025-11-10T00:27:30+00:00
title: "Amazon Polly Migration with Word-Level Highlighting"
_generated: true
_script_version: "1.0"
_generated_at: "2025-11-10T00:27:30+00:00"
feature: "polly-word-highlighting"

# Update phase status as implementation progresses
phases:
  - name: "Phase 1: AWS SDK Integration & Speech Marks Generation"
    status: pending
  - name: "Phase 2: Speech Marks Storage & Data Model Updates"
    status: pending
  - name: "Phase 3: Word-Level Highlighting in epub.js iframe"
    status: pending
  - name: "Phase 4: Cost Updates & Backward Compatibility"
    status: pending

git_commit: 45771598ef6e0b313d618aae328b32a3712760fb
branch: feature/tts-phase3-audio-player-ui
repository: reader

created_by: Sean Kim
last_updated: 2025-11-09
last_updated_by: Sean Kim

ticket_id: ENG-POLLY-001
tags:
  - tts
  - audio
  - polly
  - highlighting
status: draft

related_docs:
  - thoughts/plans/2025-11-09-ENG-TTS-001-text-to-speech-chapter-audio-implementation.md
  - thoughts/implementation-details/2025-11-09-epub-iframe-event-handling.md
---

# Amazon Polly Migration with Word-Level Highlighting

## Executive Summary

Migrate the Adaptive Reader's text-to-speech system from OpenAI TTS-1 to Amazon Polly with speech marks, enabling precise word-level text highlighting synchronized with audio narration. This migration enables a karaoke-style reading experience where words highlight as they're spoken, improving comprehension and engagement.

**Key Changes:**
- Replace OpenAI TTS API with AWS Polly SDK
- Generate and store speech marks alongside audio
- Implement word highlighting in epub.js iframe during playback
- Update cost calculations for Polly pricing ($16/M characters for neural voices)
- Maintain backward compatibility with existing audio files

**Expected Impact:**
- Enhanced reading experience through word-level sync
- More accurate cost tracking (neural voices vs. standard)
- Foundation for future features (speed reading, pronunciation assistance)

## Current State Analysis

### Existing TTS Architecture

**API Endpoint:** `/app/api/tts/generate/route.ts` (lines 1-155)
- Uses OpenAI SDK with `tts-1` model
- Handles text chunking (4096 char limit)
- Returns base64-encoded MP3 audio
- Cost: $0.015 per 1K characters
- Limitations: No word-level timing data, chapter-level sync only

**Audio Storage:** IndexedDB via Dexie (`lib/db.ts`)
- `AudioFile` interface (types/index.ts, lines 89-98):
  - `blob: Blob` - MP3 audio data
  - `duration: number` - total seconds
  - `voice: OpenAIVoice`
  - `speed: number`
  - Missing: speech marks, word-level timing

**Audio Playback:** `hooks/useAudioPlayer.ts`
- HTML5 Audio element
- Syncs audio → reading position every 5 seconds (`ReaderView.tsx`, lines 138-147)
- Uses `timestampToCFI()` for character-position-based sync
- Limitation: Coarse-grained (5-second intervals), character-based estimates

**epub.js Rendering:** `hooks/useEpubReader.ts`
- Renders EPUB content in iframe (line 50)
- Iframe click forwarding for tap zones (lines 90-123)
- CSS styling via `rendition.themes.default()` (lines 66-88)
- DOM access: Available via `rendition.getContents()`

### Dependencies

**Current:**
- `openai@^6.8.1` - Will be replaced
- `epubjs@^0.3.93` - DOM manipulation for highlighting
- `dexie@^4.0.11` - Storage (compatible with speech marks)

**To Add:**
- `@aws-sdk/client-polly@^3.x` - Polly API client
- `@aws-sdk/credential-providers@^3.x` - AWS credentials (optional, for client-side auth)

### Technical Constraints

1. **epub.js iframe isolation**: Word highlighting requires DOM traversal within iframe
2. **Text → CFI mapping**: Speech marks provide character offsets, must map to EPUB CFI positions
3. **Chunking complexity**: Polly has 3000 character limit (vs OpenAI's 4096), speech marks must align across chunks
4. **IndexedDB storage**: Speech marks JSON can be large (~1-5% of text size), must optimize storage
5. **Backward compatibility**: Existing audio files lack speech marks, must degrade gracefully

## Requirements Analysis

### Functional Requirements

**FR1: Replace OpenAI TTS with Amazon Polly**
- Use Polly `synthesizeSpeech` API with neural voices
- Maintain feature parity: voice selection, speed control, chunking
- Support all neural voices: Joanna, Matthew, Salli, Kendra, Kimberly, Ivy, Joey, Justin, Kevin, Ruth, Stephen

**FR2: Generate Speech Marks**
- Request `word` speech marks type alongside audio
- Parse and store speech marks JSON (format: `{time: ms, type: 'word', start: offset, end: offset, value: 'word'}`)
- Handle multi-chunk chapters (concatenate speech marks with time offsets)

**FR3: Word-Level Highlighting**
- Highlight current word in yellow (`background-color: #FFEB3B`) during playback
- Synchronize highlighting with audio playback (≤100ms latency)
- Clear highlights when pausing or seeking
- Handle cross-element words (e.g., `<em>wo</em>rd`)

**FR4: Cost Tracking**
- Update cost calculations: $16 per 1M characters (neural), $4 per 1M (standard)
- Display accurate cost estimates in UI
- Track usage in `AudioUsage` table

### Technical Requirements

**TR1: AWS SDK Integration**
- Add `@aws-sdk/client-polly` dependency
- Configure AWS credentials via environment variables
- Handle API errors, rate limits, throttling (Polly limits: 100 TPS for `synthesizeSpeech`)

**TR2: Data Model Updates**
- Add `speechMarks?: string` field to `AudioFile` interface (JSON-serialized array)
- Maintain backward compatibility (undefined for old files)
- Add `provider: 'openai' | 'polly'` field to distinguish audio sources

**TR3: Speech Mark Processing**
- Parse speech marks from Polly response
- Map character offsets to CFI positions for EPUB content
- Build efficient lookup structure (binary search over time-sorted marks)

**TR4: DOM Manipulation**
- Access epub.js iframe document: `rendition.getContents()[0].document`
- Traverse DOM to find text nodes matching character offsets
- Apply/remove highlight styles dynamically
- Handle edge cases: multi-element words, whitespace, formatting tags

**TR5: Performance**
- Speech mark lookup: O(log n) for 10,000+ words
- Highlight updates: <16ms (60fps) for smooth animation
- Storage overhead: Acceptable if <20% of audio file size

### Out of Scope

- Multi-voice narration (different voices per character)
- Sentence/viseme speech marks (focus on word-level only)
- Custom pronunciation dictionaries
- SSML support for enhanced narration
- Client-side Polly calls (API route only for security)

## Architecture & Design

### Design Option 1: Server-Side Dual API Calls (Recommended)

**Approach:**
- Make two sequential Polly API calls per chunk:
  1. `synthesizeSpeech` with `outputFormat: 'mp3'` → audio
  2. `synthesizeSpeech` with `outputFormat: 'json', speechMarkTypes: ['word']` → speech marks
- Concatenate results across chunks, adjusting time offsets

**Pros:**
- Clean separation: audio and speech marks remain independent
- Standard Polly API usage (documented pattern)
- No response parsing complexity

**Cons:**
- 2x API calls = 2x cost (but speech marks are free, only charged for synthesis)
- Slightly slower generation (sequential requests)

**Implementation:**
```typescript
// In /app/api/tts/generate/route.ts
const audioResponse = await pollyClient.send(new SynthesizeSpeechCommand({
  Text: chunkText,
  OutputFormat: 'mp3',
  VoiceId: 'Joanna',
  Engine: 'neural',
  SampleRate: '22050',
}));

const speechMarksResponse = await pollyClient.send(new SynthesizeSpeechCommand({
  Text: chunkText,
  OutputFormat: 'json',
  SpeechMarkTypes: ['word'],
  VoiceId: 'Joanna',
  Engine: 'neural',
}));
```

### Design Option 2: Combined Request with Mark Extraction

**Approach:**
- Use Polly's ability to return both audio and marks in a single request (if supported)
- Or use a custom pipeline to parse both from a single stream

**Pros:**
- Single API call per chunk
- Potentially faster generation

**Cons:**
- Not standard Polly pattern (audio and marks are separate output formats)
- Polly doesn't support returning both in one call - **this option is not viable**

**Decision: Use Option 1 (Dual API Calls)**

Speech marks and audio are separate outputs in Polly. We'll make two calls per chunk, which is the standard pattern. Cost remains low since we're only charged for synthesis once (marks are metadata, not re-synthesis).

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│ ReaderView.tsx                                           │
│ - Manages audio playback state                          │
│ - Triggers word highlighting via useWordHighlight hook  │
└────────────┬────────────────────────────────────────────┘
             │
             ├──► useAudioPlayer.ts
             │    - Emits currentTime updates (10Hz)
             │
             ├──► useWordHighlight.ts (NEW)
             │    - Subscribes to currentTime
             │    - Finds current word from speech marks
             │    - Highlights word in epub.js iframe
             │
             └──► lib/speech-marks.ts (NEW)
                  - parseSpeechMarks(json): SpeechMark[]
                  - findWordAtTime(marks, time): SpeechMark | null
                  - mapSpeechMarkToCFI(book, chapter, mark): CFI

┌─────────────────────────────────────────────────────────┐
│ /app/api/tts/generate/route.ts                          │
│ - NEW: Import @aws-sdk/client-polly                     │
│ - Replace OpenAI client with PollyClient                │
│ - Generate audio + speech marks per chunk               │
│ - Concatenate with time offset adjustments              │
│ - Return: { audioData, speechMarks, duration, cost }    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ IndexedDB (via Dexie)                                    │
│ - AudioFile table updated:                              │
│   * speechMarks?: string (JSON)                         │
│   * provider: 'openai' | 'polly'                        │
│   * voiceId: string (replace OpenAIVoice with generic)  │
└─────────────────────────────────────────────────────────┘
```

### Word Highlighting Algorithm

**Step 1: Time → Speech Mark Lookup**
```typescript
// Binary search over sorted speech marks
function findWordAtTime(marks: SpeechMark[], currentTime: number): SpeechMark | null {
  // Find mark where mark.time <= currentTime < nextMark.time
  // Handle last word: currentTime >= lastMark.time
}
```

**Step 2: Speech Mark → Text Node Mapping**
```typescript
// Map character offset to DOM text node
function findTextNodeAtOffset(doc: Document, charOffset: number): { node: Text, offset: number } {
  let currentOffset = 0;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const nodeLength = textNode.textContent?.length || 0;

    if (currentOffset + nodeLength > charOffset) {
      return { node: textNode, offset: charOffset - currentOffset };
    }

    currentOffset += nodeLength;
  }
}
```

**Step 3: Apply Highlight**
```typescript
function highlightWord(startNode: Text, startOffset: number, endNode: Text, endOffset: number) {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);

  // Wrap in <span class="tts-highlight">
  const span = document.createElement('span');
  span.className = 'tts-highlight';
  span.style.backgroundColor = '#FFEB3B'; // Yellow
  span.style.transition = 'background-color 0.1s';

  range.surroundContents(span);
}
```

**Performance Optimization:**
- Cache text node positions to avoid repeated traversal (O(n) → O(1) lookup)
- Debounce highlight updates to 100ms intervals
- Use CSS class toggle instead of inline styles (faster DOM updates)

### Data Model Changes

**types/index.ts**
```typescript
// Update AudioFile interface
export interface AudioFile {
  id?: number;
  chapterId: number;
  blob: Blob;
  duration: number;
  voice: string;              // Changed from OpenAIVoice to generic string
  speed: number;
  generatedAt: Date;
  sizeBytes: number;
  provider: 'openai' | 'polly'; // NEW
  speechMarks?: string;        // NEW: JSON-serialized SpeechMark[]
}

// NEW: Speech mark type
export interface SpeechMark {
  time: number;      // Milliseconds from start
  type: 'word';      // Only word marks for now
  start: number;     // Character offset in text (0-indexed)
  end: number;       // Character offset (exclusive)
  value: string;     // The word text
}

// NEW: Polly voice options
export type PollyVoice =
  | 'Joanna' | 'Matthew' | 'Salli' | 'Kendra' | 'Kimberly'
  | 'Ivy' | 'Joey' | 'Justin' | 'Kevin' | 'Ruth' | 'Stephen';
```

**lib/db.ts** (version 4 migration)
```typescript
// Version 4: Add Polly support
this.version(4).stores({
  books: '++id, title, author, addedAt, lastOpenedAt, *tags',
  positions: 'bookId, updatedAt',
  sessions: '++id, bookId, startTime, endTime',
  highlights: '++id, bookId, cfiRange, color, createdAt',
  analytics: '++id, sessionId, bookId, timestamp, event',
  chapters: '++id, bookId, order, cfiStart',
  audioFiles: '++id, chapterId, generatedAt, provider', // Added provider index
  audioSettings: 'bookId, updatedAt',
  audioUsage: '++id, chapterId, bookId, timestamp',
}).upgrade(tx => {
  // Migration: Add default provider to existing audio files
  return tx.table('audioFiles').toCollection().modify(audioFile => {
    if (!audioFile.provider) {
      audioFile.provider = 'openai';
    }
  });
});
```

## Implementation Plan

### Phase 1: AWS SDK Integration & Speech Marks Generation

**Goal:** Replace OpenAI TTS API with Polly and generate speech marks alongside audio.

**Prerequisites:**
- AWS account with Polly access
- IAM user with `polly:SynthesizeSpeech` permission
- AWS credentials (access key + secret)

**Steps:**

1. **Install AWS SDK** (5 min)
   ```bash
   npm install @aws-sdk/client-polly @aws-sdk/types
   ```

2. **Configure AWS credentials** (10 min)
   - Add to `.env.local`:
     ```
     AWS_REGION=us-east-1
     AWS_ACCESS_KEY_ID=your_key
     AWS_SECRET_ACCESS_KEY=your_secret
     ```
   - Update `.gitignore` to exclude `.env.local` (already present)

3. **Update `/app/api/tts/generate/route.ts`** (90 min)

   **Replace OpenAI imports (lines 2-13):**
   ```typescript
   import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
   import type { PollyVoice } from '@/types';

   // Validate AWS credentials
   if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
     console.error('AWS credentials not configured');
   }

   const pollyClient = new PollyClient({
     region: process.env.AWS_REGION || 'us-east-1',
     credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
     },
   });
   ```

   **Update chunk size (line 48):**
   ```typescript
   const MAX_CHARS = 3000; // Polly limit is 3000 for plain text
   ```

   **Replace TTS generation logic (lines 84-103):**
   ```typescript
   const audioBuffers: Buffer[] = [];
   const allSpeechMarks: Array<{ time: number; type: string; start: number; end: number; value: string }> = [];
   let totalDuration = 0; // Track cumulative audio duration for time offsets

   for (let i = 0; i < chunks.length; i++) {
     console.log(`[TTS API] Generating chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);

     // Generate audio
     const audioCommand = new SynthesizeSpeechCommand({
       Text: chunks[i],
       OutputFormat: 'mp3',
       VoiceId: voice as PollyVoice,
       Engine: 'neural',
       SampleRate: '22050',
       TextType: 'text',
     });

     const audioResponse = await pollyClient.send(audioCommand);
     const audioBuffer = Buffer.from(await audioResponse.AudioStream!.transformToByteArray());
     audioBuffers.push(audioBuffer);

     // Generate speech marks
     const marksCommand = new SynthesizeSpeechCommand({
       Text: chunks[i],
       OutputFormat: 'json',
       SpeechMarkTypes: ['word'],
       VoiceId: voice as PollyVoice,
       Engine: 'neural',
       TextType: 'text',
     });

     const marksResponse = await pollyClient.send(marksCommand);
     const marksText = await marksResponse.AudioStream!.transformToString();

     // Parse newline-delimited JSON
     const chunkMarks = marksText
       .trim()
       .split('\n')
       .map(line => JSON.parse(line))
       .map(mark => ({
         ...mark,
         time: mark.time + totalDuration, // Offset for concatenation
       }));

     allSpeechMarks.push(...chunkMarks);

     // Estimate duration from last speech mark (more accurate than word count)
     if (chunkMarks.length > 0) {
       const lastMark = chunkMarks[chunkMarks.length - 1];
       // Add ~200ms buffer for last word duration
       totalDuration = lastMark.time + 200;
     }
   }
   ```

   **Update response (lines 115-124):**
   ```typescript
   const buffer = Buffer.concat(audioBuffers);
   const charCount = chapterText.length;

   // Polly pricing: $16 per 1M characters for neural voices
   const cost = (charCount / 1_000_000) * 16.0;
   const sizeBytes = buffer.length;

   return NextResponse.json({
     success: true,
     audioData: buffer.toString('base64'),
     speechMarks: JSON.stringify(allSpeechMarks),
     duration: totalDuration / 1000, // Convert ms to seconds
     cost,
     charCount,
     sizeBytes,
     voice,
     speed: validSpeed,
     provider: 'polly',
   });
   ```

   **Update voice validation (lines 151-154):**
   ```typescript
   function isValidVoice(voice: string): voice is PollyVoice {
     const validVoices: PollyVoice[] = [
       'Joanna', 'Matthew', 'Salli', 'Kendra', 'Kimberly',
       'Ivy', 'Joey', 'Justin', 'Kevin', 'Ruth', 'Stephen'
     ];
     return validVoices.includes(voice as PollyVoice);
   }
   ```

4. **Testing** (30 min)
   - Create test chapter (~1000 words)
   - Generate audio via API endpoint
   - Verify response contains `speechMarks` JSON array
   - Validate speech mark format: `{time, type, start, end, value}`
   - Check time offsets increase monotonically
   - Confirm audio plays correctly
   - Test multi-chunk chapters (>3000 chars)

**Success Criteria:**
- ✅ API endpoint successfully calls Polly
- ✅ Returns both audio (MP3) and speech marks (JSON)
- ✅ Multi-chunk chapters concatenate correctly
- ✅ Speech mark times align with audio playback
- ✅ No OpenAI dependencies remain

**Time Estimate:** 2-3 hours

---

### Phase 2: Speech Marks Storage & Data Model Updates

**Goal:** Persist speech marks in IndexedDB alongside audio, update types to support Polly.

**Steps:**

1. **Update TypeScript types** (20 min)

   **`types/index.ts`** - Update `AudioFile` interface (lines 89-98):
   ```typescript
   export interface AudioFile {
     id?: number;
     chapterId: number;
     blob: Blob;
     duration: number;
     voice: string;              // Changed from OpenAIVoice to support any provider
     speed: number;
     generatedAt: Date;
     sizeBytes: number;
     provider: 'openai' | 'polly'; // NEW
     speechMarks?: string;        // NEW: JSON-serialized array
   }
   ```

   **`types/index.ts`** - Add speech mark interface (after line 98):
   ```typescript
   export interface SpeechMark {
     time: number;      // Milliseconds from audio start
     type: 'word';
     start: number;     // Character offset in chapter text
     end: number;       // Character offset (exclusive)
     value: string;     // Word text
   }

   export type PollyVoice =
     | 'Joanna' | 'Matthew' | 'Salli' | 'Kendra' | 'Kimberly'
     | 'Ivy' | 'Joey' | 'Justin' | 'Kevin' | 'Ruth' | 'Stephen';
   ```

2. **Update database schema** (30 min)

   **`lib/db.ts`** - Add version 4 migration (after line 45):
   ```typescript
   // Version 4: Add Polly provider and speech marks support
   this.version(4).stores({
     books: '++id, title, author, addedAt, lastOpenedAt, *tags',
     positions: 'bookId, updatedAt',
     sessions: '++id, bookId, startTime, endTime',
     highlights: '++id, bookId, cfiRange, color, createdAt',
     analytics: '++id, sessionId, bookId, timestamp, event',
     chapters: '++id, bookId, order, cfiStart',
     audioFiles: '++id, chapterId, generatedAt, provider', // Added provider to index
     audioSettings: 'bookId, updatedAt',
     audioUsage: '++id, chapterId, bookId, timestamp',
   }).upgrade(tx => {
     // Migrate existing audio files to include provider field
     console.log('[DB Migration v4] Adding provider field to existing audio files');
     return tx.table('audioFiles').toCollection().modify(audioFile => {
       if (!audioFile.provider) {
         audioFile.provider = 'openai'; // Default for existing files
       }
     });
   });
   ```

3. **Update audio generation hook** (15 min)

   **`hooks/useAudioGeneration.ts`** - Store speech marks (lines 85-106):
   ```typescript
   const data = await response.json();

   if (!data.success) {
     throw new Error(data.error);
   }

   // Convert base64 to Blob
   const audioBlob = base64ToBlob(data.audioData, 'audio/mpeg');

   setProgress(90);

   // Save to IndexedDB with speech marks
   const audioFile: Omit<AudioFile, 'id'> = {
     chapterId: chapter.id,
     blob: audioBlob,
     duration: data.duration,
     voice: data.voice,
     speed: data.speed,
     generatedAt: new Date(),
     sizeBytes: data.sizeBytes,
     provider: data.provider || 'polly',    // NEW
     speechMarks: data.speechMarks,          // NEW
   };
   ```

4. **Update audio settings types** (10 min)

   **`types/index.ts`** - Update `AudioSettings` (lines 100-107):
   ```typescript
   export interface AudioSettings {
     bookId: number;
     voice: string;           // Changed from OpenAIVoice to generic string
     playbackSpeed: number;
     autoPlay: boolean;
     updatedAt: Date;
     provider?: 'openai' | 'polly'; // NEW: Track preferred provider
   }
   ```

   **`lib/db.ts`** - Update default settings (lines 451-459):
   ```typescript
   export function getDefaultAudioSettings(bookId: number): AudioSettings {
     return {
       bookId,
       voice: 'Joanna',        // Polly default
       playbackSpeed: 1.0,
       autoPlay: false,
       provider: 'polly',      // NEW
       updatedAt: new Date(),
     };
   }
   ```

5. **Testing** (20 min)
   - Generate audio for test chapter
   - Verify `speechMarks` field saved in IndexedDB
   - Check JSON parsing: `JSON.parse(audioFile.speechMarks!)`
   - Validate backward compatibility: old audio files still load
   - Test database migration: open app with existing data

**Success Criteria:**
- ✅ `AudioFile` includes `provider` and `speechMarks` fields
- ✅ Database migration completes without errors
- ✅ Existing audio files marked as `provider: 'openai'`
- ✅ New audio files include speech marks JSON
- ✅ No TypeScript errors

**Time Estimate:** 1.5-2 hours

---

### Phase 3: Word-Level Highlighting in epub.js iframe

**Goal:** Implement synchronized word highlighting that follows audio playback.

**Steps:**

1. **Create speech marks utility library** (45 min)

   **`lib/speech-marks.ts`** (NEW FILE):
   ```typescript
   import type { SpeechMark } from '@/types';

   /**
    * Parse speech marks JSON string
    */
   export function parseSpeechMarks(json: string): SpeechMark[] {
     try {
       return JSON.parse(json);
     } catch (error) {
       console.error('Failed to parse speech marks:', error);
       return [];
     }
   }

   /**
    * Find word speech mark at given time (binary search)
    * Returns null if no word is active at this time
    */
   export function findWordAtTime(
     marks: SpeechMark[],
     currentTimeMs: number
   ): SpeechMark | null {
     if (marks.length === 0) return null;

     // Binary search for the last mark where mark.time <= currentTimeMs
     let left = 0;
     let right = marks.length - 1;
     let result: SpeechMark | null = null;

     while (left <= right) {
       const mid = Math.floor((left + right) / 2);

       if (marks[mid].time <= currentTimeMs) {
         result = marks[mid];
         left = mid + 1;
       } else {
         right = mid - 1;
       }
     }

     // Check if next word has started (word duration heuristic: ~300ms average)
     const nextMark = result ? marks[marks.indexOf(result) + 1] : null;
     const wordDuration = nextMark ? (nextMark.time - result!.time) : 300;

     // Return null if we've moved past this word's duration
     if (result && currentTimeMs > result.time + wordDuration) {
       return null;
     }

     return result;
   }

   /**
    * Find text node and offset for character position in DOM
    */
   export function findTextNodeAtOffset(
     doc: Document,
     charOffset: number
   ): { node: Text; offset: number } | null {
     let currentOffset = 0;
     const walker = doc.createTreeWalker(
       doc.body,
       NodeFilter.SHOW_TEXT,
       null
     );

     while (walker.nextNode()) {
       const textNode = walker.currentNode as Text;
       const text = textNode.textContent || '';
       const nodeLength = text.length;

       if (currentOffset + nodeLength > charOffset) {
         return {
           node: textNode,
           offset: charOffset - currentOffset,
         };
       }

       currentOffset += nodeLength;
     }

     console.warn('Text node not found for offset:', charOffset);
     return null;
   }
   ```

2. **Create word highlighting hook** (60 min)

   **`hooks/useWordHighlight.ts`** (NEW FILE):
   ```typescript
   import { useEffect, useRef, useState } from 'react';
   import type { Rendition } from 'epubjs';
   import type { SpeechMark } from '@/types';
   import { findWordAtTime, findTextNodeAtOffset } from '@/lib/speech-marks';

   interface UseWordHighlightProps {
     rendition: Rendition | null;
     speechMarks: SpeechMark[] | null;
     currentTimeMs: number;
     isPlaying: boolean;
   }

   const HIGHLIGHT_CLASS = 'tts-word-highlight';

   export function useWordHighlight({
     rendition,
     speechMarks,
     currentTimeMs,
     isPlaying,
   }: UseWordHighlightProps) {
     const [currentWord, setCurrentWord] = useState<SpeechMark | null>(null);
     const highlightedElementRef = useRef<HTMLElement | null>(null);

     // Inject highlight CSS into iframe
     useEffect(() => {
       if (!rendition) return;

       rendition.hooks.content.register((contents: any) => {
         const doc = contents.document;

         // Add CSS for highlighting
         const style = doc.createElement('style');
         style.textContent = `
           .${HIGHLIGHT_CLASS} {
             background-color: #FFEB3B !important;
             transition: background-color 0.1s ease;
             padding: 2px 0;
             border-radius: 2px;
           }
         `;
         doc.head.appendChild(style);
       });
     }, [rendition]);

     // Update highlighted word as time changes
     useEffect(() => {
       if (!isPlaying || !speechMarks || speechMarks.length === 0) {
         // Clear highlight when paused
         clearHighlight();
         setCurrentWord(null);
         return;
       }

       const word = findWordAtTime(speechMarks, currentTimeMs);

       if (word?.value !== currentWord?.value) {
         setCurrentWord(word);
       }
     }, [currentTimeMs, isPlaying, speechMarks, currentWord]);

     // Apply highlight to DOM when word changes
     useEffect(() => {
       if (!rendition || !currentWord) {
         clearHighlight();
         return;
       }

       const contents = rendition.getContents()[0];
       if (!contents) return;

       const doc = contents.document;

       // Clear previous highlight
       clearHighlight();

       // Find text nodes for word start and end
       const startNode = findTextNodeAtOffset(doc, currentWord.start);
       const endNode = findTextNodeAtOffset(doc, currentWord.end);

       if (!startNode || !endNode) {
         console.warn('Could not find text nodes for word:', currentWord);
         return;
       }

       try {
         // Create range for word
         const range = doc.createRange();
         range.setStart(startNode.node, startNode.offset);
         range.setEnd(endNode.node, endNode.offset);

         // Wrap in highlight span
         const span = doc.createElement('span');
         span.className = HIGHLIGHT_CLASS;
         range.surroundContents(span);

         highlightedElementRef.current = span;

         // Scroll into view (optional, can be disabled for less jarring UX)
         // span.scrollIntoView({ behavior: 'smooth', block: 'center' });
       } catch (error) {
         console.error('Error applying highlight:', error);
       }
     }, [rendition, currentWord]);

     // Clear highlight helper
     const clearHighlight = () => {
       if (highlightedElementRef.current) {
         const span = highlightedElementRef.current;
         const parent = span.parentNode;

         if (parent) {
           // Unwrap span: replace with its text content
           while (span.firstChild) {
             parent.insertBefore(span.firstChild, span);
           }
           parent.removeChild(span);
         }

         highlightedElementRef.current = null;
       }
     };

     // Cleanup on unmount
     useEffect(() => {
       return () => clearHighlight();
     }, []);

     return { currentWord };
   }
   ```

3. **Integrate into ReaderView** (30 min)

   **`components/reader/ReaderView.tsx`** - Add word highlighting:

   **Import hook (line 12):**
   ```typescript
   import { useWordHighlight } from '@/hooks/useWordHighlight';
   import { parseSpeechMarks } from '@/lib/speech-marks';
   ```

   **Add state for speech marks (after line 51):**
   ```typescript
   const [currentSpeechMarks, setCurrentSpeechMarks] = useState<SpeechMark[] | null>(null);
   ```

   **Load speech marks when chapter changes (after line 152):**
   ```typescript
   // Load speech marks for current audio chapter (TTS Phase 5: Polly)
   useEffect(() => {
     const loadSpeechMarks = async () => {
       if (!currentAudioChapter?.id) {
         setCurrentSpeechMarks(null);
         return;
       }

       const audioFile = await getAudioFile(currentAudioChapter.id);
       if (audioFile?.speechMarks) {
         const marks = parseSpeechMarks(audioFile.speechMarks);
         setCurrentSpeechMarks(marks);
       } else {
         setCurrentSpeechMarks(null);
       }
     };

     loadSpeechMarks();
   }, [currentAudioChapter]);
   ```

   **Enable word highlighting (after speech marks loading):**
   ```typescript
   // Word-level highlighting (TTS Phase 5: Polly)
   useWordHighlight({
     rendition,
     speechMarks: currentSpeechMarks,
     currentTimeMs: audioPlayer.currentTime * 1000, // Convert seconds to ms
     isPlaying: audioPlayer.playing,
   });
   ```

4. **Update audio player to emit high-frequency time updates** (15 min)

   **`hooks/useAudioPlayer.ts`** - Increase update frequency:

   **Current:** `timeupdate` event fires ~4 times per second (browser default)

   **Enhancement (lines 44-48):** Add custom interval for smoother updates
   ```typescript
   const handleTimeUpdate = () => {
     setCurrentTime(audio.currentTime);
     onTimeUpdate?.(audio.currentTime, audio.duration);
   };

   // Add high-frequency updates for word highlighting (10Hz = 100ms intervals)
   let timeUpdateInterval: NodeJS.Timeout | null = null;

   const startHighFrequencyUpdates = () => {
     timeUpdateInterval = setInterval(() => {
       if (audio && !audio.paused) {
         setCurrentTime(audio.currentTime);
         onTimeUpdate?.(audio.currentTime, audio.duration);
       }
     }, 100); // 10 updates per second
   };

   const stopHighFrequencyUpdates = () => {
     if (timeUpdateInterval) {
       clearInterval(timeUpdateInterval);
       timeUpdateInterval = null;
     }
   };

   // Start interval when playing, stop when paused
   const handlePlay = () => {
     startHighFrequencyUpdates();
   };

   const handlePause = () => {
     stopHighFrequencyUpdates();
   };

   audio.addEventListener('play', handlePlay);
   audio.addEventListener('pause', handlePause);

   // Cleanup
   return () => {
     stopHighFrequencyUpdates();
     audio.removeEventListener('play', handlePlay);
     audio.removeEventListener('pause', handlePause);
   };
   ```

5. **Testing** (45 min)
   - Generate Polly audio for test chapter with speech marks
   - Play audio and verify words highlight in yellow
   - Check highlighting accuracy: word boundaries align with audio
   - Test edge cases:
     - Words spanning multiple DOM elements (e.g., `<em>ital</em>ic`)
     - Punctuation handling
     - Multi-line words
   - Verify performance: no stuttering or lag during playback
   - Test pause/resume: highlights clear when paused
   - Test seek: highlights jump to correct word

**Success Criteria:**
- ✅ Words highlight in yellow during playback
- ✅ Highlighting synchronized within 100ms of audio
- ✅ No visual artifacts (unwrapping works correctly)
- ✅ Highlights clear when pausing or seeking
- ✅ Performance: 60fps, no jank
- ✅ Works across different EPUB structures (simple text, formatted content)

**Time Estimate:** 3-4 hours

---

### Phase 4: Cost Updates & Backward Compatibility

**Goal:** Update UI cost estimates, ensure backward compatibility with OpenAI audio files.

**Steps:**

1. **Update cost calculation displays** (20 min)

   **`hooks/useAudioUsage.ts`** (if exists, or inline in components):
   ```typescript
   function calculateCost(charCount: number, provider: 'openai' | 'polly', voiceType: 'neural' | 'standard' = 'neural'): number {
     if (provider === 'openai') {
       return (charCount / 1000) * 0.015; // $0.015 per 1K chars
     } else if (provider === 'polly') {
       const ratePerMillion = voiceType === 'neural' ? 16.0 : 4.0;
       return (charCount / 1_000_000) * ratePerMillion;
     }
     return 0;
   }
   ```

   **Update ChapterList cost estimates** (if displaying costs):
   ```typescript
   // In ChapterList.tsx or wherever cost is shown
   const estimatedCost = calculateCost(chapter.charCount, 'polly', 'neural');
   ```

2. **Add provider selection UI (optional)** (30 min)

   **`components/reader/AudioSettingsPanel.tsx`** (if exists, or add to SettingsDrawer):
   ```typescript
   <div className="space-y-2">
     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
       TTS Provider
     </label>
     <select
       value={audioSettings.provider || 'polly'}
       onChange={(e) => updateAudioSettings({
         provider: e.target.value as 'openai' | 'polly'
       })}
       className="w-full px-3 py-2 border rounded"
     >
       <option value="polly">Amazon Polly (Word Highlighting)</option>
       <option value="openai">OpenAI TTS-1 (Legacy)</option>
     </select>
   </div>

   {audioSettings.provider === 'polly' && (
     <p className="text-xs text-gray-500">
       Cost: $16 per 1M characters (neural voices)
     </p>
   )}
   {audioSettings.provider === 'openai' && (
     <p className="text-xs text-gray-500">
       Cost: $15 per 1M characters (no word highlighting)
     </p>
   )}
   ```

3. **Graceful degradation for OpenAI files** (15 min)

   **Ensure highlighting only activates for Polly files:**

   **In ReaderView.tsx speech marks loading:**
   ```typescript
   const loadSpeechMarks = async () => {
     if (!currentAudioChapter?.id) {
       setCurrentSpeechMarks(null);
       return;
     }

     const audioFile = await getAudioFile(currentAudioChapter.id);

     // Only load speech marks for Polly-generated audio
     if (audioFile?.provider === 'polly' && audioFile?.speechMarks) {
       const marks = parseSpeechMarks(audioFile.speechMarks);
       setCurrentSpeechMarks(marks);
     } else {
       setCurrentSpeechMarks(null);
       // OpenAI files fall back to chapter-level sync (existing behavior)
     }
   };
   ```

4. **Update voice picker UI** (20 min)

   **Support both OpenAI and Polly voices:**

   **`components/reader/VoiceSelector.tsx`** (create or update):
   ```typescript
   const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
   const POLLY_VOICES = ['Joanna', 'Matthew', 'Salli', 'Kendra', 'Kimberly',
                         'Ivy', 'Joey', 'Justin', 'Kevin', 'Ruth', 'Stephen'];

   const voices = provider === 'polly' ? POLLY_VOICES : OPENAI_VOICES;

   <select value={selectedVoice} onChange={handleVoiceChange}>
     {voices.map(voice => (
       <option key={voice} value={voice}>{voice}</option>
     ))}
   </select>
   ```

5. **Testing** (30 min)
   - Test cost calculations for Polly (neural and standard if implemented)
   - Verify OpenAI audio files still play without errors
   - Check that old files don't attempt word highlighting
   - Test provider switching in UI
   - Verify voice picker shows correct voices per provider
   - Test regenerating audio with different provider

**Success Criteria:**
- ✅ Cost estimates accurate for both providers
- ✅ OpenAI audio files play without word highlighting
- ✅ Polly audio files use word highlighting
- ✅ Provider selection works in settings
- ✅ Voice picker adapts to selected provider
- ✅ No errors when loading old audio files

**Time Estimate:** 2 hours

---

## Testing Strategy

### Unit Tests

**Speech Marks Utility (`lib/speech-marks.ts`):**
- `parseSpeechMarks()`: Valid JSON, invalid JSON, empty string
- `findWordAtTime()`: Start, middle, end, between words, empty array
- `findTextNodeAtOffset()`: Simple text, nested elements, missing offset

**Voice Validation:**
- `isValidVoice()`: Valid Polly voices, invalid voices, OpenAI voices

### Integration Tests

**API Endpoint (`/app/api/tts/generate`):**
- Single chunk generation (< 3000 chars)
- Multi-chunk generation (> 3000 chars)
- Speech marks concatenation across chunks
- Error handling: Invalid credentials, network failure, invalid voice
- Cost calculation accuracy

**Audio Playback with Highlighting:**
- Load Polly audio file with speech marks
- Play and verify highlighting updates
- Pause and verify highlights clear
- Seek and verify highlights update
- Load OpenAI audio file and verify no highlighting (backward compat)

### Manual Testing

**End-to-End Workflow:**
1. Generate audio for chapter using Polly
2. Verify speech marks stored in IndexedDB
3. Play audio and observe word highlighting
4. Pause/resume and check highlight behavior
5. Seek to different positions
6. Switch chapters and verify highlighting follows
7. Test with different EPUB formatting (bold, italic, links)

**Browser Compatibility:**
- Chrome, Safari, Firefox
- Mobile: iOS Safari, Android Chrome

**Performance Testing:**
- Large chapters (10,000+ words): highlight updates remain smooth
- Storage overhead: Check IndexedDB size with speech marks vs without

### Regression Testing

**Ensure existing features still work:**
- Chapter-level audio sync (for OpenAI files)
- Voice selection and playback speed
- Audio player UI controls
- Chapter list with play/generate buttons
- Cost tracking in AudioUsage table

## Deployment Considerations

### Environment Variables

**Required:**
- `AWS_REGION` (default: `us-east-1`)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**Optional (backward compat):**
- `OPENAI_API_KEY` (for users who want to continue using OpenAI)

### Database Migration

**Migration Path:**
- Users upgrading from v3 → v4: Automatic migration adds `provider: 'openai'` to existing audio files
- No data loss, existing audio files remain playable
- Users can regenerate chapters with Polly to get word highlighting

### Performance Considerations

**Speech Marks Storage:**
- Average: 1-5% of text size (e.g., 100KB text → 1-5KB speech marks JSON)
- IndexedDB limit: Typically 50MB+ per origin (sufficient for hundreds of chapters)

**Highlighting Performance:**
- DOM updates: < 16ms per word (60fps)
- Binary search: O(log n) for 10,000 words = ~13 comparisons
- Memory: Speech marks held in memory during playback (~5KB per chapter)

### Rollback Plan

**If Polly integration fails:**
1. Revert API route to OpenAI implementation
2. Database migration is non-destructive (v4 keeps all v3 data)
3. Remove Polly-specific UI elements
4. Keep `provider` field for future re-attempt

## Risk Assessment

### Technical Risks

**Risk 1: Speech mark character offsets don't align with DOM structure**
- **Likelihood:** Medium
- **Impact:** High (broken highlighting)
- **Mitigation:**
  - Extract plain text in same order as Polly receives it
  - Test with diverse EPUB structures (nested tags, special chars)
  - Add debug logging to compare offsets
  - Fallback: Highlight by word matching if offset fails

**Risk 2: DOM manipulation causes layout shifts or breaks epub.js**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Use `<span>` wrapping (non-intrusive)
  - Test unwrapping logic thoroughly
  - Don't modify text nodes, only wrap them
  - Disable highlighting if errors occur

**Risk 3: Polly API rate limits exceed usage patterns**
- **Likelihood:** Low (100 TPS limit is high for single-user app)
- **Impact:** Medium
- **Mitigation:**
  - Implement exponential backoff on 429 errors
  - Cache audio files aggressively (already done)
  - Batch generation for multiple chapters (future enhancement)

**Risk 4: Speech marks JSON parsing fails due to malformed data**
- **Likelihood:** Low
- **Impact:** Low (graceful degradation)
- **Mitigation:**
  - Wrap parsing in try-catch
  - Log errors to console for debugging
  - Fall back to chapter-level sync if parsing fails

### Cost Risks

**Risk 5: Polly costs exceed budget**
- **Likelihood:** Low (single-user, on-demand generation)
- **Impact:** Medium
- **Mitigation:**
  - Display cost estimates prominently in UI
  - Track cumulative costs in AudioUsage table
  - Add optional cost limit warning (future)
  - OpenAI remains available as fallback

### Backward Compatibility Risks

**Risk 6: Existing users lose OpenAI audio files after migration**
- **Likelihood:** Very Low (non-destructive migration)
- **Impact:** High (data loss)
- **Mitigation:**
  - Database migration adds `provider` field, doesn't delete
  - Test migration with real user data (anonymized)
  - Provide export/backup option (future)

## Performance & Security Considerations

### Performance Optimizations

**Client-Side:**
- Binary search for speech marks: O(log n)
- Debounce highlight updates to 100ms (avoid excessive DOM mutations)
- Cache text node positions to avoid repeated tree walks
- Use CSS class toggle instead of inline styles (faster repaints)

**Server-Side:**
- Stream Polly responses instead of buffering (reduces memory)
- Parallelize audio and speech marks requests (await Promise.all)
- Consider chunking strategy: Sentence boundaries for cleaner breaks

**Storage:**
- Compress speech marks JSON before storing (gzip can reduce 50-70%)
- Implement cleanup: Delete old audio files after 30 days (optional)

### Security Considerations

**AWS Credentials:**
- Store in environment variables, never commit to repo
- Use IAM user with minimal permissions (only `polly:SynthesizeSpeech`)
- Consider AWS STS temporary credentials for production
- Rotate keys periodically

**API Route Protection:**
- Rate limiting: Max 10 requests/minute per user (prevent abuse)
- Input validation: Sanitize chapter text to prevent injection
- Error messages: Don't expose AWS credentials or internal paths

**Client-Side:**
- Speech marks contain text content: ensure no PII leakage
- IndexedDB is local-only (no cloud sync), but warn users in privacy policy

## Documentation Requirements

**Code Comments:**
- Add JSDoc to all new functions (speech-marks.ts, useWordHighlight.ts)
- Document Polly API parameters and response format
- Explain text node traversal algorithm

**User-Facing:**
- Update README with Polly setup instructions (AWS credentials)
- Add "Word Highlighting" section to feature list
- Document provider selection in settings

**Developer:**
- Migration guide: OpenAI → Polly transition steps
- Architecture diagram: Speech marks flow from API → storage → highlighting
- Troubleshooting: Common issues (offset misalignment, missing highlights)

## Future Enhancements

**Beyond MVP:**
- **Sentence highlighting:** Use `sentence` speech marks for broader context
- **Adjustable highlight color:** User preference (yellow, blue, none)
- **Speed reading mode:** Auto-advance pages with highlighting
- **SSML support:** Custom pronunciation, pauses, emphasis
- **Multi-voice narration:** Different voices for dialogue vs. narration
- **Offline support:** Download Polly audio with PWA for offline reading
- **Viseme support:** Sync with animated avatars (future AR/VR integration)

---

## Summary

This plan provides a clear path to migrate from OpenAI TTS to Amazon Polly with word-level highlighting in 4 phases totaling 8-11 hours of development time:

1. **Phase 1** (2-3h): AWS SDK integration, speech marks generation
2. **Phase 2** (1.5-2h): Database updates, speech marks storage
3. **Phase 3** (3-4h): Word highlighting implementation
4. **Phase 4** (2h): Cost updates, backward compatibility

Each phase is independently testable and delivers incremental value. The architecture maintains backward compatibility with existing OpenAI audio files while enabling the new word-level highlighting feature for Polly-generated audio.

**Next Steps:**
1. Review this plan for accuracy and completeness
2. Set up AWS account and obtain Polly API credentials
3. Begin Phase 1 implementation
4. Test each phase before proceeding to the next
