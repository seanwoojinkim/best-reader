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

export type Theme = keyof typeof THEME_COLORS;
export type FontFamily = 'serif' | 'sans-serif';
