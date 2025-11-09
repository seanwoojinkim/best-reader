import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TYPOGRAPHY_DEFAULTS } from '@/lib/constants';
import type { ReaderSettings } from '@/types';

interface SettingsStore extends ReaderSettings {
  currentBookId: number | null;
  isReading: boolean;
  showControls: boolean;

  // Actions
  setTheme: (theme: ReaderSettings['theme']) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: ReaderSettings['fontFamily']) => void;
  setLineHeight: (height: number) => void;
  setMargins: (margins: number) => void;
  setCurrentBook: (bookId: number | null) => void;
  setIsReading: (isReading: boolean) => void;
  toggleControls: () => void;
  setShowControls: (show: boolean) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // Default settings from research
      theme: 'light',
      fontSize: TYPOGRAPHY_DEFAULTS.fontSize,
      fontFamily: TYPOGRAPHY_DEFAULTS.fontFamily,
      lineHeight: TYPOGRAPHY_DEFAULTS.lineHeight,
      margins: TYPOGRAPHY_DEFAULTS.marginDesktop,
      currentBookId: null,
      isReading: false,
      showControls: false,

      // Actions
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setMargins: (margins) => set({ margins }),
      setCurrentBook: (currentBookId) => set({ currentBookId }),
      setIsReading: (isReading) => set({ isReading }),
      toggleControls: () => set((state) => ({ showControls: !state.showControls })),
      setShowControls: (showControls) => set({ showControls }),
      resetSettings: () =>
        set({
          theme: 'light',
          fontSize: TYPOGRAPHY_DEFAULTS.fontSize,
          fontFamily: TYPOGRAPHY_DEFAULTS.fontFamily,
          lineHeight: TYPOGRAPHY_DEFAULTS.lineHeight,
          margins: TYPOGRAPHY_DEFAULTS.marginDesktop,
        }),
    }),
    {
      name: 'reader-settings',
      // Only persist user preferences, not runtime state
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        lineHeight: state.lineHeight,
        margins: state.margins,
      }),
    }
  )
);
