/**
 * Test script for sentence synchronization data pipeline
 *
 * Run with: npx tsx test-sentence-sync.ts
 */

import { parseChapterIntoSentences, validateParsedSentences } from './lib/sentence-parser.js';
import { generateSentenceTimestamps, validateSentenceTimestamps } from './lib/duration-estimator.js';

// Test text with various edge cases
const testText = `
Dr. Smith examined the patient carefully. He noted three symptoms: fever,
cough, and fatigue. The diagnosis was clear... influenza!

"How are you feeling?" asked the nurse.

The patient replied, "Much better, thank you." He smiled weakly.

The treatment plan included rest, fluids, and medication. Dr. Smith prescribed
antiviral drugs at 3.5 mg dosage. Follow-up in 48 hours was recommended.
`;

console.log('=== Sentence Parsing Test ===\n');
console.log('Input text length:', testText.length, 'characters\n');

// Test 1: Parse sentences
console.log('Step 1: Parsing sentences...');
const sentences = parseChapterIntoSentences(testText);
console.log(`✓ Parsed ${sentences.length} sentences\n`);

// Display parsed sentences
sentences.forEach((s, i) => {
  console.log(`Sentence ${i + 1}:`);
  console.log(`  Text: "${s.text.substring(0, 60)}${s.text.length > 60 ? '...' : ''}"`);
  console.log(`  Position: ${s.startChar}-${s.endChar} (${s.charCount} chars)\n`);
});

// Test 2: Validate sentence positions
console.log('Step 2: Validating sentence positions...');
const isValid = validateParsedSentences(testText, sentences);
if (isValid) {
  console.log('✓ All sentence positions are valid\n');
} else {
  console.log('✗ Sentence validation failed\n');
  process.exit(1);
}

// Test 3: Generate timestamps
console.log('Step 3: Generating timestamps...');
const totalDuration = 30.0; // Mock 30-second audio
const metadata = generateSentenceTimestamps(sentences, totalDuration);
console.log(`✓ Generated timestamps for ${metadata.length} sentences\n`);

// Display timestamps
metadata.forEach((s, i) => {
  const duration = s.endTime - s.startTime;
  console.log(`Sentence ${i + 1}:`);
  console.log(`  Time: ${s.startTime.toFixed(2)}s - ${s.endTime.toFixed(2)}s (${duration.toFixed(2)}s)`);
  console.log(`  Text: "${s.text.substring(0, 50)}${s.text.length > 50 ? '...' : ''}"\n`);
});

// Test 4: Validate timestamps
console.log('Step 4: Validating timestamps...');
const timestampsValid = validateSentenceTimestamps(metadata, totalDuration);
if (timestampsValid) {
  console.log('✓ All timestamps are valid\n');
} else {
  console.log('✗ Timestamp validation failed\n');
  process.exit(1);
}

// Summary
console.log('=== Test Summary ===');
console.log(`✓ Parsed ${sentences.length} sentences`);
console.log(`✓ Total character count: ${sentences.reduce((sum, s) => sum + s.charCount, 0)}`);
console.log(`✓ Total duration: ${totalDuration}s`);
console.log(`✓ Average sentence duration: ${(totalDuration / sentences.length).toFixed(2)}s`);
console.log('\n✓ All tests passed!');
