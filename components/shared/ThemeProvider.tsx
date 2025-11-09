'use client';

import React, { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    // Apply theme class to body
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    document.body.classList.add(`theme-${theme}`);

    // Also update Tailwind's dark mode class on html element
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return <>{children}</>;
}
