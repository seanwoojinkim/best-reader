'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { TYPOGRAPHY_RANGES, SYSTEM_FONTS, FONT_CONSTANTS } from '@/lib/constants';
import { uploadFont, listFonts, deleteFont as deleteFontFromDb } from '@/lib/db';
import type { CustomFont } from '@/types';
import { validateFontFile, getFriendlyErrorMessage } from '@/lib/fontValidation';
import { invalidateFontCache } from '@/hooks/useEpubReader';
import { FontDeletionError, handleFontError } from '@/lib/fontErrors';

export default function TypographySettings() {
  const {
    fontSize,
    setFontSize,
    systemFontId,
    customFontId,
    setSystemFont,
    setCustomFont,
    lineHeight,
    setLineHeight,
    resetSettings,
  } = useSettingsStore();

  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomFontsExpanded, setIsCustomFontsExpanded] = useState(false);

  // Load custom fonts on mount
  useEffect(() => {
    loadCustomFonts();
  }, []);

  const loadCustomFonts = async () => {
    try {
      const fonts = await listFonts();
      setCustomFonts(fonts);
    } catch (error) {
      console.error('Error loading custom fonts:', error);
    }
  };

  const handleFontChange = (value: string) => {
    if (value.startsWith('custom-')) {
      const customId = parseInt(value.replace('custom-', ''));
      setCustomFont(customId);
    } else {
      setSystemFont(value);
    }
  };

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Comprehensive validation: extension, size, magic numbers, FontFace API
      await validateFontFile(file, FONT_CONSTANTS.MAX_FILE_SIZE_BYTES);

      // If validation passes, proceed with upload
      const buffer = await file.arrayBuffer();

      // Determine format from extension
      const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      const format = fileExt === '.woff2' ? 'woff2' :
                    fileExt === '.woff' ? 'woff' :
                    fileExt === '.ttf' ? 'truetype' : 'opentype';

      // Extract font family name (use filename without extension as fallback)
      const fontName = file.name.replace(/\.[^/.]+$/, '');

      const customFont: CustomFont = {
        name: fontName,
        family: fontName, // Will be the CSS font-family name
        buffer,
        format,
        uploadDate: new Date(),
        size: file.size,
      };

      const fontId = await uploadFont(customFont);
      await loadCustomFonts();

      // Auto-select the newly uploaded font
      setCustomFont(fontId);

      console.log('[TypographySettings] Font uploaded successfully:', fontId);
    } catch (error) {
      console.error('[TypographySettings] Error uploading font:', error);
      // Use friendly error message from validation utility
      const message = getFriendlyErrorMessage(error as Error);
      alert(message);
    } finally {
      setIsUploading(false);
      // Reset the input
      e.target.value = '';
    }
  };

  const handleDeleteFont = async (fontId: number) => {
    if (!confirm('Are you sure you want to delete this font?')) return;

    try {
      await deleteFontFromDb(fontId);
      await loadCustomFonts();

      // Invalidate cache for deleted font
      invalidateFontCache(fontId);

      // If the deleted font was selected, switch to default
      if (customFontId === fontId) {
        setSystemFont('serif');
      }
    } catch (error) {
      // Use centralized error handler
      const deletionError = new FontDeletionError(
        `Failed to delete font: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FONT_DELETION_FAILED'
      );
      handleFontError(deletionError, '[TypographySettings]');
    }
  };

  // Determine current selection value
  const currentValue = customFontId ? `custom-${customFontId}` : (systemFontId || 'serif');

  return (
    <div className="space-y-6">
      {/* Font Family Selector */}
      <div>
        <label htmlFor="font-selector" className="block text-sm font-medium text-gray-700 mb-2">
          Font Family
        </label>
        <select
          id="font-selector"
          value={currentValue}
          onChange={(e) => handleFontChange(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        >
          <optgroup label="System Fonts">
            {SYSTEM_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.name}
              </option>
            ))}
          </optgroup>
          {customFonts.length > 0 && (
            <optgroup label="Custom Fonts">
              {customFonts.map((font) => (
                <option key={`custom-${font.id}`} value={`custom-${font.id}`}>
                  {font.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Custom Fonts Section - Collapsible */}
      <div>
        <button
          onClick={() => setIsCustomFontsExpanded(!isCustomFontsExpanded)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-2 hover:text-gray-900"
        >
          <span>Custom Fonts</span>
          <svg
            className={`w-4 h-4 transition-transform ${isCustomFontsExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isCustomFontsExpanded && (
          <div className="space-y-4 pl-2">
            {/* Font Upload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Upload Font
              </label>
              <div className="flex gap-2">
                <label className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors cursor-pointer text-center">
                  {isUploading ? 'Uploading...' : 'Choose Font File'}
                  <input
                    type="file"
                    accept=".woff2,.woff,.ttf,.otf"
                    onChange={handleFontUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Supported formats: WOFF2, WOFF, TTF, OTF (max 5MB)
              </p>
            </div>

            {/* Custom Fonts List */}
            {customFonts.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  Manage Fonts ({customFonts.length})
                </label>
                <div className="space-y-2">
                  {customFonts.map((font) => (
                    <div
                      key={font.id}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md"
                    >
                      <span className="text-sm text-gray-700">{font.name}</span>
                      <button
                        onClick={() => handleDeleteFont(font.id!)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
