/**
 * Font Validation Utilities
 *
 * Provides comprehensive validation for uploaded font files including:
 * - Magic number (file signature) validation
 * - MIME type validation
 * - FontFace API validation
 * - File size validation
 */

/**
 * Font file magic numbers (first 4 bytes)
 * Used to verify actual file format regardless of extension
 */
const MAGIC_NUMBERS = {
  WOFF2: [0x77, 0x4F, 0x46, 0x32], // "wOF2"
  WOFF: [0x77, 0x4F, 0x46, 0x46],  // "wOFF"
  TTF_1: [0x00, 0x01, 0x00, 0x00], // TrueType version 1.0
  TTF_TRUE: [0x74, 0x72, 0x75, 0x65], // "true" (TrueType)
  OTF: [0x4F, 0x54, 0x54, 0x4F],   // "OTTO"
} as const;

import { FontValidationError } from './fontErrors';

/**
 * Validates font file extension
 */
function validateExtension(fileName: string): string {
  const validExtensions = ['.woff2', '.woff', '.ttf', '.otf'];
  const fileExt = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));

  if (!validExtensions.includes(fileExt)) {
    throw new FontValidationError(
      `Invalid file extension: ${fileExt}. Only .woff2, .woff, .ttf, and .otf files are supported.`,
      'INVALID_EXTENSION'
    );
  }

  return fileExt;
}

/**
 * Validates file size
 */
function validateFileSize(size: number, maxSize: number): void {
  if (size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(1);
    const actualMB = (size / (1024 * 1024)).toFixed(1);
    throw new FontValidationError(
      `Font file is too large: ${actualMB}MB. Maximum size is ${maxMB}MB.`,
      'FILE_TOO_LARGE'
    );
  }
}

/**
 * Checks if byte array matches a magic number pattern
 */
function matchesMagicNumber(bytes: Uint8Array, pattern: readonly number[]): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (bytes[i] !== pattern[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Validates font file format by checking magic numbers (file signature)
 * This prevents file extension spoofing attacks
 */
function validateMagicNumbers(buffer: ArrayBuffer, expectedExtension: string): void {
  const bytes = new Uint8Array(buffer);

  // Need at least 4 bytes to check magic numbers
  if (bytes.length < 4) {
    throw new FontValidationError(
      'File is too small to be a valid font file.',
      'FILE_TOO_SMALL'
    );
  }

  // Check magic numbers based on expected format
  // Check more specific formats first (WOFF2, WOFF, OTF) before generic TTF
  let isValid = false;
  let detectedFormat = '';

  if (matchesMagicNumber(bytes, MAGIC_NUMBERS.WOFF2)) {
    isValid = true;
    detectedFormat = 'WOFF2';
  } else if (matchesMagicNumber(bytes, MAGIC_NUMBERS.WOFF)) {
    isValid = true;
    detectedFormat = 'WOFF';
  } else if (matchesMagicNumber(bytes, MAGIC_NUMBERS.OTF)) {
    isValid = true;
    detectedFormat = 'OTF';
  } else if (matchesMagicNumber(bytes, MAGIC_NUMBERS.TTF_1) || matchesMagicNumber(bytes, MAGIC_NUMBERS.TTF_TRUE)) {
    isValid = true;
    detectedFormat = 'TTF';
  }

  if (!isValid) {
    // Show first 8 bytes for debugging
    const hexBytes = Array.from(bytes.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    throw new FontValidationError(
      `File does not appear to be a valid font file. Header bytes: ${hexBytes}`,
      'INVALID_MAGIC_NUMBER'
    );
  }

  // Verify detected format matches expected extension
  const formatExtensionMap: Record<string, string> = {
    'WOFF2': '.woff2',
    'WOFF': '.woff',
    'TTF': '.ttf',
    'OTF': '.otf',
  };

  const expectedFormat = formatExtensionMap[detectedFormat];

  // Allow TTF/OTF interchangeability (both are TrueType-based)
  const isTtfOtfMatch = (expectedExtension === '.ttf' && detectedFormat === 'OTF') ||
                        (expectedExtension === '.otf' && detectedFormat === 'TTF');

  if (expectedExtension !== expectedFormat && !isTtfOtfMatch) {
    throw new FontValidationError(
      `File extension ${expectedExtension} does not match detected format ${detectedFormat}.`,
      'FORMAT_MISMATCH'
    );
  }
}

/**
 * Validates font by attempting to load it with FontFace API
 * This is the most reliable validation as it uses the browser's font parser
 */
async function validateWithFontFaceAPI(
  buffer: ArrayBuffer,
  format: 'woff2' | 'woff' | 'truetype' | 'opentype',
  fontFamily: string
): Promise<void> {
  // Create a blob URL for the font
  const mimeType = format === 'woff2' ? 'font/woff2' :
                  format === 'woff' ? 'font/woff' :
                  format === 'truetype' ? 'font/ttf' : 'font/otf';

  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);

  try {
    // Attempt to load the font with FontFace API
    const fontFace = new FontFace(fontFamily, `url(${url})`, {
      style: 'normal',
      weight: 'normal',
    });

    // This will throw if the font is invalid or corrupted
    await fontFace.load();

    console.log('[fontValidation] Font validated successfully with FontFace API');
  } catch (error) {
    throw new FontValidationError(
      `Font validation failed: ${error instanceof Error ? error.message : 'Unknown error'}. The file may be corrupted or not a valid font.`,
      'FONTFACE_VALIDATION_FAILED'
    );
  } finally {
    // Clean up blob URL
    URL.revokeObjectURL(url);
  }
}

/**
 * Validates MIME type matches expected format
 */
function validateMimeType(file: File, expectedExtension: string): void {
  const validMimeTypes: Record<string, string[]> = {
    '.woff2': ['font/woff2', 'application/font-woff2'],
    '.woff': ['font/woff', 'application/font-woff'],
    '.ttf': ['font/ttf', 'application/x-font-ttf', 'font/sfnt'],
    '.otf': ['font/otf', 'application/x-font-otf', 'font/sfnt'],
  };

  const expectedMimes = validMimeTypes[expectedExtension];
  if (!expectedMimes) return; // Skip if unknown extension

  // Note: file.type might be empty for some browsers/file systems
  // So we don't fail validation, just warn
  if (file.type && !expectedMimes.includes(file.type)) {
    console.warn(
      `[fontValidation] MIME type mismatch: expected one of ${expectedMimes.join(', ')}, got ${file.type}`
    );
  }
}

/**
 * Comprehensive font file validation
 *
 * Validates:
 * 1. File extension
 * 2. File size
 * 3. MIME type
 * 4. Magic numbers (file signature)
 * 5. FontFace API loading
 *
 * @param file - The uploaded font file
 * @param maxSizeBytes - Maximum allowed file size in bytes
 * @returns Promise that resolves if validation passes
 * @throws FontValidationError if validation fails
 */
export async function validateFontFile(
  file: File,
  maxSizeBytes: number = 5 * 1024 * 1024 // Default 5MB
): Promise<void> {
  // Step 1: Validate extension
  const fileExt = validateExtension(file.name);

  // Step 2: Validate file size
  validateFileSize(file.size, maxSizeBytes);

  // Step 3: Validate MIME type (non-blocking)
  validateMimeType(file, fileExt);

  // Step 4: Read file buffer for further validation
  const buffer = await file.arrayBuffer();

  // Step 5: Validate magic numbers
  validateMagicNumbers(buffer, fileExt);

  // Step 6: Validate with FontFace API
  const format = fileExt === '.woff2' ? 'woff2' :
                fileExt === '.woff' ? 'woff' :
                fileExt === '.ttf' ? 'truetype' : 'opentype';

  const fontFamily = file.name.replace(/\.[^/.]+$/, '');
  await validateWithFontFaceAPI(buffer, format, fontFamily);

  console.log('[fontValidation] All validation checks passed');
}

/**
 * Gets a user-friendly error message for a FontValidationError
 */
export function getFriendlyErrorMessage(error: Error): string {
  if (error instanceof FontValidationError) {
    switch (error.code) {
      case 'INVALID_EXTENSION':
        return 'Please upload a valid font file (.woff2, .woff, .ttf, or .otf).';
      case 'FILE_TOO_LARGE':
        return error.message;
      case 'FILE_TOO_SMALL':
        return 'The selected file is too small to be a valid font.';
      case 'INVALID_MAGIC_NUMBER':
        return 'The file does not appear to be a valid font. It may be corrupted or the wrong file type.';
      case 'FORMAT_MISMATCH':
        return 'The file extension does not match the actual font format. Please ensure you have the correct file.';
      case 'FONTFACE_VALIDATION_FAILED':
        return 'The font file appears to be corrupted or invalid. Please try a different font.';
      default:
        return `Font validation failed: ${error.message}`;
    }
  }

  return `An unexpected error occurred: ${error.message}`;
}
