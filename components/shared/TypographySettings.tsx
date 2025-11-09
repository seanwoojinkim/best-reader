'use client';

import React from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { TYPOGRAPHY_RANGES } from '@/lib/constants';

export default function TypographySettings() {
  const {
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    lineHeight,
    setLineHeight,
    resetSettings,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      {/* Font Family */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Font Family
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setFontFamily('serif')}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                fontFamily === 'serif'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
            style={{ fontFamily: 'Georgia, serif' }}
          >
            Serif
          </button>
          <button
            onClick={() => setFontFamily('sans-serif')}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${
                fontFamily === 'sans-serif'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
            style={{ fontFamily: '-apple-system, sans-serif' }}
          >
            Sans-serif
          </button>
        </div>
      </div>

      {/* Font Size */}
      <div>
        <label htmlFor="font-size" className="block text-sm font-medium text-gray-700 mb-2">
          Font Size: {fontSize}px
        </label>
        <input
          id="font-size"
          type="range"
          min={TYPOGRAPHY_RANGES.fontSize.min}
          max={TYPOGRAPHY_RANGES.fontSize.max}
          step={TYPOGRAPHY_RANGES.fontSize.step}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{TYPOGRAPHY_RANGES.fontSize.min}px</span>
          <span>{TYPOGRAPHY_RANGES.fontSize.max}px</span>
        </div>
      </div>

      {/* Line Height */}
      <div>
        <label htmlFor="line-height" className="block text-sm font-medium text-gray-700 mb-2">
          Line Height: {lineHeight.toFixed(1)}
        </label>
        <input
          id="line-height"
          type="range"
          min={TYPOGRAPHY_RANGES.lineHeight.min}
          max={TYPOGRAPHY_RANGES.lineHeight.max}
          step={TYPOGRAPHY_RANGES.lineHeight.step}
          value={lineHeight}
          onChange={(e) => setLineHeight(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{TYPOGRAPHY_RANGES.lineHeight.min}</span>
          <span>{TYPOGRAPHY_RANGES.lineHeight.max}</span>
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={resetSettings}
        className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
      >
        Reset to Defaults
      </button>
    </div>
  );
}
