# Parallel TTS Batching Research - Performance Optimization

**Date:** 2025-11-11
**Context:** Speeding up TTS generation from 5+ minutes (14 chunks serialized) to acceptable UX
**Scope:** Research only - implementation not included

---

## Executive Summary

Current implementation processes TTS chunks **serially** (one at a time), taking 5+ minutes for 14 chunks. By implementing **parallel chunk processing** with proper rate limiting and error handling, we can potentially reduce this to under 1 minute while maintaining reliability.

### Key Findings
- ✅ **Parallel processing is viable** with proper rate limiting
- ⚠️ **Rate limits are strict**: 3 RPM (free tier) to ~50 RPM (paid tiers)
- ✅ **Chunk ordering is preserved** using `Promise.allSettled()` with indexed arrays
- ✅ **Error handling patterns** exist for partial failures
- ⚠️ **Exponential backoff required** for 429 (rate limit) errors

---

## Current Implementation Analysis

### File: `lib/tts-client.ts:107-200`

**Current Flow (Serialized):**
```typescript
for (let i = 0; i < chunks.length; i++) {
  const response = await openai.audio.speech.create({...});
  audioBuffers.push(await response.arrayBuffer());
}
```

**Performance Bottleneck:**
- 14 chunks × ~25 seconds per chunk = **350 seconds** (5.8 minutes)
- Each chunk waits for previous chunk to complete
- No concurrent API utilization

**Current Chunking Strategy:**
- Max 4096 characters per chunk (OpenAI limit)
- Breaks at sentence boundaries (last 30% of chunk)
- Handles punctuation: `. `, `? `, `! `, `\n\n`

---

## OpenAI TTS API Rate Limits

### Tier-Based Limits

| Tier | Requests/Minute (RPM) | Tokens/Minute (TPM) | Notes |
|------|----------------------|---------------------|-------|
| **Free** | 3 RPM | Limited | Not viable for parallel |
| **Tier 1** | ~10-20 RPM | Unknown | Estimated from community |
| **Tier 2+** | 50+ RPM | Unknown | Based on usage patterns |

**Sources:**
- Community reports: 3 RPM default for new accounts
- Rate limit errors (`429`) include `retry-after` headers
- Limits increase automatically with consistent usage

### Character Limit
- **4096 characters** per request (hard limit)
- Input validation required before API call

### Error Codes
- `429`: Rate limit exceeded → retry with exponential backoff
- `401`: Invalid API key → fail immediately, don't retry
- `5xx`: Server errors → retry with backoff

---

## Parallel Processing Strategies

### 1. **Controlled Concurrency with p-limit**

**Library:** `p-limit` (npm package)

```typescript
import pLimit from 'p-limit';

// Limit to 5 concurrent requests (adjust based on tier)
const limit = pLimit(5);

const chunkPromises = chunks.map((chunk, index) =>
  limit(() => generateChunkAudio(chunk, index))
);

const results = await Promise.allSettled(chunkPromises);
```

**Benefits:**
- Controls max concurrent requests
- Prevents overwhelming the API
- Maintains request order via indexed array
- Compatible with TypeScript

**Configuration:**
- Free tier: `pLimit(2)` (stay under 3 RPM)
- Tier 1: `pLimit(5-10)`
- Tier 2+: `pLimit(20-50)`

### 2. **Dynamic Rate Limiting**

**Pattern:** Track capacity and regenerate over time

```typescript
class RateLimiter {
  private availableRequests: number;
  private requestsPerMinute: number;
  private lastUpdate: number;

  async waitForCapacity() {
    // Regenerate capacity based on elapsed time
    const now = Date.now();
    const elapsed = (now - this.lastUpdate) / 60000; // minutes
    this.availableRequests = Math.min(
      this.requestsPerMinute,
      this.availableRequests + (elapsed * this.requestsPerMinute)
    );
    this.lastUpdate = now;

    // Wait if no capacity
    if (this.availableRequests < 1) {
      await sleep(calculateWaitTime());
    }

    this.availableRequests--;
  }
}
```

**Source:** OpenAI Cookbook parallel processor pattern

**Benefits:**
- Adapts to API response headers
- Prevents rate limit errors proactively
- Smooths request distribution

### 3. **Promise.allSettled() for Error Handling**

**Why not Promise.all()?**
- `Promise.all()` fails fast on first rejection
- Loses all in-flight work when one chunk fails
- Can't recover partial progress

**Why Promise.allSettled()?**
- Waits for ALL promises (success or failure)
- Returns `{status, value, reason}` for each
- Preserves order regardless of completion time
- Enables partial success handling

**Example:**
```typescript
const results = await Promise.allSettled(chunkPromises);

const successfulChunks = results
  .map((result, index) => ({...result, index}))
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);

const failedChunks = results
  .map((result, index) => ({...result, index}))
  .filter(r => r.status === 'rejected');

// Retry failed chunks or show partial audio
```

---

## Error Handling Patterns

### 1. **Retry with Exponential Backoff**

```typescript
async function generateChunkWithRetry(
  chunk: string,
  index: number,
  maxRetries = 3
): Promise<ChunkResult> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateChunk(chunk, index);
    } catch (error: any) {
      lastError = error;

      // Don't retry auth errors
      if (error?.status === 401) {
        throw error;
      }

      // Exponential backoff for rate limits
      if (error?.status === 429) {
        const retryAfter = error.headers?.['retry-after'] ||
                          Math.pow(2, attempt) * 1000; // 2^attempt seconds
        console.log(`Rate limited. Retrying after ${retryAfter}ms`);
        await sleep(retryAfter);
        continue;
      }

      // Retry server errors
      if (error?.status >= 500) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }

      // Don't retry other errors
      throw error;
    }
  }

  throw lastError;
}
```

**Key Principles:**
- **Immediate failure** for auth errors (401)
- **Respect retry-after** header for rate limits (429)
- **Exponential backoff** for server errors (5xx)
- **Max retry limit** to prevent infinite loops

### 2. **Partial Success Handling**

```typescript
interface PartialAudioResult {
  success: boolean;
  completeChunks: AudioChunk[];
  failedIndices: number[];
  totalChunks: number;
  partialAudio?: string; // base64
  error?: string;
}

// Allow user to hear partial audio or retry failed chunks
if (failedChunks.length > 0 && successfulChunks.length > 0) {
  return {
    success: false,
    completeChunks: successfulChunks,
    failedIndices: failedChunks.map(c => c.index),
    totalChunks: chunks.length,
    partialAudio: concatenateChunks(successfulChunks),
    error: `Generated ${successfulChunks.length}/${chunks.length} chunks`,
  };
}
```

**UX Considerations:**
- Show partial audio with gaps
- Offer "Retry Failed Chunks" button
- Display which sections failed
- Allow continuing with partial audio

### 3. **Progress Tracking with Parallel Jobs**

```typescript
let completedChunks = 0;
const totalChunks = chunks.length;

const chunkPromises = chunks.map((chunk, index) =>
  limit(async () => {
    const result = await generateChunkWithRetry(chunk, index);
    completedChunks++;

    const progressPercent = (completedChunks / totalChunks) * 100;
    if (onProgress) {
      onProgress(
        progressPercent,
        `Generated ${completedChunks}/${totalChunks} chunks`
      );
    }

    return result;
  })
);
```

---

## Chunk Ordering and Reassembly

### Challenge
Parallel processing completes chunks out of order, but audio must be reassembled in original sequence.

### Solution: Index-Tracked Promises

```typescript
interface ChunkResult {
  index: number;
  audioBuffer: ArrayBuffer;
  chunkText: string;
}

// Generate with index tracking
const chunkPromises = chunks.map((chunk, index) =>
  limit(() => generateChunk(chunk, index)) // Returns {index, audioBuffer}
);

const results = await Promise.allSettled(chunkPromises);

// Sort by index before concatenation
const orderedBuffers = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)
  .sort((a, b) => a.index - b.index)
  .map(chunk => chunk.audioBuffer);

// Concatenate in order
const combinedAudio = concatenateAudioBuffers(orderedBuffers);
```

**Key Points:**
- `Promise.allSettled()` preserves array order
- Always sort by index before concatenation
- Detect missing indices (failed chunks)

### Handling Missing Chunks

```typescript
// Check for gaps in sequence
const completedIndices = orderedChunks.map(c => c.index);
const missingIndices = chunks
  .map((_, i) => i)
  .filter(i => !completedIndices.includes(i));

if (missingIndices.length > 0) {
  console.warn(`Missing chunks: ${missingIndices.join(', ')}`);
  // Option 1: Insert silence
  // Option 2: Retry missing chunks
  // Option 3: Fail entire generation
}
```

---

## Implementation Recommendations

### Phase 1: Add Parallel Processing (Low Risk)

**Changes to `lib/tts-client.ts`:**

1. Install `p-limit`: `npm install p-limit`
2. Replace serial loop with parallel processing
3. Use conservative concurrency (2-3 concurrent)
4. Keep existing error handling as fallback

**Estimated Time Savings:**
- 14 chunks serialized: ~5-6 minutes
- 14 chunks with 3 concurrent: ~1.5-2 minutes
- 14 chunks with 5 concurrent: ~1 minute

### Phase 2: Add Retry Logic (Medium Risk)

1. Implement exponential backoff for 429 errors
2. Add max retry configuration
3. Track and display retry attempts

### Phase 3: Partial Success Handling (Higher Complexity)

1. Allow partial audio playback
2. UI for retrying failed chunks
3. Gap detection and handling

### Phase 4: Dynamic Rate Limiting (Advanced)

1. Parse `retry-after` and rate limit headers
2. Implement dynamic concurrency adjustment
3. Track usage patterns per user tier

---

## Risk Mitigation

### Rate Limit Risks

| Risk | Mitigation |
|------|------------|
| Hitting 429 errors | Conservative concurrency (2-3), exponential backoff |
| Burning through quota | Track usage, warn user before generation |
| Free tier limits | Detect tier, adjust concurrency dynamically |

### Error Handling Risks

| Risk | Mitigation |
|------|------------|
| All chunks fail | Maintain serial fallback, better error messages |
| Partial failures | Allow partial audio, retry interface |
| Out-of-order chunks | Index tracking, sorting before concatenation |

### UX Risks

| Risk | Mitigation |
|------|------------|
| Slower than expected | Progressive enhancement, show estimated time |
| Confusing errors | Clear error messages with action items |
| Unexpected costs | Cost estimation before generation |

---

## Testing Strategy

### Unit Tests
1. Chunk ordering with various completion orders
2. Error handling for different status codes
3. Retry logic with mocked failures
4. Partial success scenarios

### Integration Tests
1. Full chapter generation with parallel processing
2. Rate limit handling (mock 429 responses)
3. Progress tracking accuracy
4. Audio concatenation integrity

### Load Tests
1. Measure actual time savings with different concurrency
2. Test at API rate limits
3. Validate audio quality after concatenation

---

## Configuration Options

### User-Configurable Settings

```typescript
interface TTSConfig {
  // Concurrency control
  maxConcurrentRequests: number; // 2-50 based on tier

  // Retry behavior
  maxRetries: number; // 3 recommended
  retryBackoffMultiplier: number; // 2 (exponential)

  // Error handling
  allowPartialAudio: boolean; // true recommended
  failOnAnyError: boolean; // false for better UX

  // Rate limiting
  estimatedRPM: number; // Auto-detect or user-configured
  respectRetryAfter: boolean; // true required
}
```

### Tier Detection

```typescript
// Attempt to detect tier by making test request
async function detectTier(): Promise<number> {
  // Start with 3 concurrent requests
  // If no 429, try 5, then 10, etc.
  // Store detected tier for future sessions
}
```

---

## References

### OpenAI Documentation
- Rate limits: https://platform.openai.com/docs/guides/rate-limits
- TTS API: https://platform.openai.com/docs/guides/text-to-speech
- Error codes: https://platform.openai.com/docs/guides/error-codes

### Libraries
- `p-limit`: https://www.npmjs.com/package/p-limit
- OpenAI Cookbook: https://github.com/openai/openai-cookbook/blob/main/examples/api_request_parallel_processor.py

### Patterns
- Promise.allSettled(): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
- Exponential backoff: Industry standard for API retry logic

---

## Appendix: Code Location Reference

### Current Implementation
- `lib/tts-client.ts:107-200` - Main TTS generation function (serial)
- `lib/tts-client.ts:129-169` - Chunking logic
- `lib/tts-client.ts:175-200` - Serial chunk processing loop
- `lib/tts-client.ts:203-210` - Audio concatenation
- `hooks/useAudioGeneration.ts:82-92` - Hook integration

### Key Functions
- `generateTTS()` - Main entry point for TTS generation
- `createOpenAIClient()` - OpenAI client setup
- `arrayBufferToBase64()` - Audio encoding

---

## Next Steps (Implementation Phase)

1. **Add p-limit dependency** and update package.json
2. **Create parallel processing function** in tts-client.ts
3. **Add feature flag** to toggle serial vs parallel
4. **Implement retry logic** with exponential backoff
5. **Add progress tracking** for parallel chunks
6. **Test with various chapter sizes** and concurrency levels
7. **Add user configuration** for concurrency limits
8. **Document performance improvements** with metrics

---

**End of Research Document**
