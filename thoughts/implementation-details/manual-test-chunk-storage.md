# Manual Test Script for Audio Chunk Storage

## Prerequisites
1. Run `npm run dev` to start the development server
2. Open the browser console (F12)
3. Navigate to http://localhost:3000

## Test Script

Copy and paste the following script into the browser console:

```javascript
// Import database functions
import {
  saveAudioChunk,
  saveAudioChunks,
  getAudioChunks,
  getAudioChunk,
  getAudioChunksInRange,
  deleteAudioChunks,
  getAudioChunkCount
} from '@/lib/db';

// Test 1: Save a single chunk
console.log('Test 1: Saving single chunk...');
const testChunk = {
  audioFileId: 999,
  chunkIndex: 0,
  blob: new Blob(['test audio data'], { type: 'audio/mpeg' }),
  duration: 10.5,
  textStart: 0,
  textEnd: 4096,
  startTime: 0,
  generatedAt: new Date()
};

const chunkId = await saveAudioChunk(testChunk);
console.log('✅ Saved chunk with ID:', chunkId);

// Test 2: Retrieve the chunk
console.log('\nTest 2: Retrieving chunk...');
const retrieved = await getAudioChunk(999, 0);
console.log('✅ Retrieved chunk:', {
  id: retrieved?.id,
  audioFileId: retrieved?.audioFileId,
  chunkIndex: retrieved?.chunkIndex,
  duration: retrieved?.duration,
  blobSize: retrieved?.blob.size
});

// Test 3: Save multiple chunks in bulk
console.log('\nTest 3: Saving multiple chunks...');
const bulkChunks = [
  {
    audioFileId: 1000,
    chunkIndex: 0,
    blob: new Blob(['chunk 0'], { type: 'audio/mpeg' }),
    duration: 10,
    textStart: 0,
    textEnd: 4096,
    startTime: 0,
    generatedAt: new Date()
  },
  {
    audioFileId: 1000,
    chunkIndex: 1,
    blob: new Blob(['chunk 1'], { type: 'audio/mpeg' }),
    duration: 12,
    textStart: 4096,
    textEnd: 8192,
    startTime: 10,
    generatedAt: new Date()
  },
  {
    audioFileId: 1000,
    chunkIndex: 2,
    blob: new Blob(['chunk 2'], { type: 'audio/mpeg' }),
    duration: 11,
    textStart: 8192,
    textEnd: 12288,
    startTime: 22,
    generatedAt: new Date()
  }
];

const bulkIds = await saveAudioChunks(bulkChunks);
console.log('✅ Saved bulk chunks with IDs:', bulkIds);

// Test 4: Get all chunks for an audio file
console.log('\nTest 4: Getting all chunks...');
const allChunks = await getAudioChunks(1000);
console.log('✅ Retrieved', allChunks.length, 'chunks');
console.log('Chunk indexes:', allChunks.map(c => c.chunkIndex));

// Test 5: Get chunks in range
console.log('\nTest 5: Getting chunks in range...');
const rangeChunks = await getAudioChunksInRange(1000, 0, 1);
console.log('✅ Retrieved', rangeChunks.length, 'chunks in range [0,1]');
console.log('Chunk indexes:', rangeChunks.map(c => c.chunkIndex));

// Test 6: Count chunks
console.log('\nTest 6: Counting chunks...');
const count = await getAudioChunkCount(1000);
console.log('✅ Chunk count:', count);

// Test 7: Delete chunks
console.log('\nTest 7: Deleting chunks...');
await deleteAudioChunks(1000);
const afterDelete = await getAudioChunkCount(1000);
console.log('✅ Chunks after deletion:', afterDelete);

// Cleanup
console.log('\nCleaning up test data...');
await deleteAudioChunks(999);
console.log('✅ Cleanup complete');

console.log('\n🎉 All tests passed!');
```

## Alternative Simple Test (if imports don't work in console)

```javascript
// Access db directly from window (after it's been imported by the app)
const { db } = await import('/lib/db.js');

// Simple test
const testChunk = {
  audioFileId: 999,
  chunkIndex: 0,
  blob: new Blob(['test'], { type: 'audio/mpeg' }),
  duration: 10,
  textStart: 0,
  textEnd: 100,
  startTime: 0,
  generatedAt: new Date()
};

const id = await db.audioChunks.add(testChunk);
console.log('Saved chunk with ID:', id);

const retrieved = await db.audioChunks.get(id);
console.log('Retrieved chunk:', retrieved);

// Cleanup
await db.audioChunks.delete(id);
console.log('Cleanup done');
```

## Expected Results

All tests should pass with green checkmarks (✅) in the console output.

## Verification Checklist

- [ ] Can save a single chunk
- [ ] Can retrieve a chunk by audioFileId and chunkIndex
- [ ] Can save multiple chunks in bulk
- [ ] Can get all chunks for an audio file, sorted by chunkIndex
- [ ] Can get chunks in a specific range
- [ ] Can count chunks for an audio file
- [ ] Can delete all chunks for an audio file

## Success Criteria

If all tests pass, Phase 1 implementation is complete and the database schema is ready for Phase 2 (API streaming).
