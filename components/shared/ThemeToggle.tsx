'use client';

import React from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ReaderSettings } from '@/types';

export default function ThemeToggle() {
  const { theme, setTheme } = useSettingsStore();

  const themes: Array<{ value: ReaderSettings['theme']; label: string; icon: string }> = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'sepia', label: 'Sepia', icon: '📜' },
  ];

  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {themes.map((t) => (
        <button
          key={t.value}
          onClick={() => setTheme(t.value)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${
              theme === t.value
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }
          `}
          aria-label={`Switch to ${t.label} theme`}
          aria-pressed={theme === t.value}
        >
          <span className="text-lg" aria-hidden="true">
            {t.icon}
          </span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
