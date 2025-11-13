// Theme color values (exact research-backed colors)
export const THEME_COLORS = {
  light: {
    bg: '#F9F9F9',
    text: '#1A1A1A',
  },
  dark: {
    bg: '#121212', // NOT pure black - prevents OLED smearing
    text: '#E0E0E0',
  },
  sepia: {
    bg: '#FBF0D9', // Kindle standard
    text: '#5F4B32',
  },
} as const;

// Typography defaults from research
export const TYPOGRAPHY_DEFAULTS = {
  fontSize: 18, // px
  lineHeight: 1.5,
  fontFamily: 'serif' as const,
  maxWidthDesktop: '65ch',
  maxWidthMobile: '40ch',
  marginDesktop: 2, // rem
  marginMobile: 1, // rem
} as const;

// Typography ranges
export const TYPOGRAPHY_RANGES = {
  fontSize: { min: 14, max: 24, step: 1 },
  lineHeight: { min: 1.2, max: 1.8, step: 0.1 },
  margins: { min: 1, max: 4, step: 0.5 },
} as const;

// Tap zone configuration
export const TAP_ZONES = {
  left: 0.15, // Left 15% = previous page
  right: 0.15, // Right 15% = next page
  center: 0.70, // Center 70% = next page (or show menu)
} as const;

// UI behavior constants
export const UI_CONSTANTS = {
  controlsAutoHideDelay: 3000, // milliseconds - how long to wait before hiding controls
} as const;

// Highlight colors (exact research-backed values)
export const HIGHLIGHT_COLORS = {
  yellow: '#FEF3C7',  // Default
  blue: '#DBEAFE',
  orange: '#FED7AA',
  pink: '#FCE7F3',
} as const;

// Curated system fonts for Phase 1
export const SYSTEM_FONTS = [
  {
    id: 'serif',
    name: 'Serif',
    family: 'Georgia, "Times New Roman", serif',
    category: 'serif',
  },
  {
    id: 'sans-serif',
    name: 'Sans-serif',
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'charter',
    name: 'Charter',
    family: 'Charter, Georgia, serif',
    category: 'serif',
  },
  {
    id: 'iowan',
    name: 'Iowan Old Style',
    family: '"Iowan Old Style", "Palatino Linotype", Palatino, serif',
    category: 'serif',
  },
  {
    id: 'palatino',
    name: 'Palatino',
    family: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    category: 'serif',
  },
  {
    id: 'baskerville',
    name: 'Baskerville',
    family: 'Baskerville, "Baskerville Old Face", "Garamond", serif',
    category: 'serif',
  },
  {
    id: 'garamond',
    name: 'Garamond',
    family: 'Garamond, "Apple Garamond", "Adobe Garamond Pro", serif',
    category: 'serif',
  },
  {
    id: 'sf-pro',
    name: 'SF Pro',
    family: '"SF Pro Text", -apple-system, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'helvetica',
    name: 'Helvetica',
    family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'arial',
    name: 'Arial',
    family: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    category: 'sans-serif',
  },
  {
    id: 'open-dyslexic',
    name: 'OpenDyslexic',
    family: 'OpenDyslexic, sans-serif',
    category: 'accessibility',
  },
] as const;

// Font-related constants (Phase 2: Custom Fonts)
export const FONT_CONSTANTS = {
  /** Maximum font file size in megabytes */
  MAX_FILE_SIZE_MB: 5,
  /** Maximum font file size in bytes (5MB) */
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
  /** Maximum number of fonts to cache in memory (LRU eviction) */
  CACHE_SIZE_LIMIT: 10,
  /**
   * Delay in milliseconds to wait after @font-face injection before re-displaying
   * Ensures browser has time to parse and load the font face
   */
  FONT_LOAD_TIMEOUT_MS: 200,
  /**
   * Base64 encoding overhead factor (33% size increase)
   * Base64 represents 3 bytes with 4 characters, adding ~33% overhead
   */
  BASE64_OVERHEAD_FACTOR: 1.33,
} as const;

export type Theme = keyof typeof THEME_COLORS;
export type FontFamily = 'serif' | 'sans-serif';
export type SystemFontId = typeof SYSTEM_FONTS[number]['id'];
export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;
