'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { TYPOGRAPHY_RANGES } from '@/lib/constants';
import ThemeToggle from '../shared/ThemeToggle';
import AudioSettingsPanel from './AudioSettingsPanel';
import UsageDashboard from './UsageDashboard';
import { useAudioUsage } from '@/hooks/useAudioUsage';
import { getAudioSettings, saveAudioSettings, getDefaultAudioSettings } from '@/lib/db';
import type { AudioSettings } from '@/types';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: number;
}

export default function SettingsDrawer({ isOpen, onClose, bookId }: SettingsDrawerProps) {
  const {
    fontSize,
    fontFamily,
    lineHeight,
    margins,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setMargins,
    resetSettings,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'typography' | 'audio' | 'usage'>('typography');
  const [audioSettings, setAudioSettings] = useState<AudioSettings | null>(null);
  const audioUsage = useAudioUsage({ bookId });

  // Load audio settings when drawer opens
  useEffect(() => {
    const loadAudioSettings = async () => {
      const settings = await getAudioSettings(bookId) || getDefaultAudioSettings(bookId);
      setAudioSettings(settings);
    };

    if (isOpen) {
      loadAudioSettings();
    }
  }, [bookId, isOpen]);

  const handleAudioSettingsChange = async (updates: Partial<AudioSettings>) => {
    if (!audioSettings) return;

    const newSettings = { ...audioSettings, ...updates };
    setAudioSettings(newSettings);
    await saveAudioSettings(newSettings);
  };

  const handleReset = () => {
    if (confirm('Reset all typography settings to defaults?')) {
      resetSettings();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`
          fixed right-0 top-0 h-full w-full md:w-80 bg-white dark:bg-gray-900 shadow-xl
          transform transition-transform duration-300 ease-out z-50
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
              <button
                onClick={() => setActiveTab('typography')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'typography'
                    ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Typography
              </button>
              <button
                onClick={() => setActiveTab('audio')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'audio'
                    ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Audio
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'usage'
                    ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Usage
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'typography' && (
                <div className="space-y-6">
                  {/* Theme */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Theme
                    </label>
                    <ThemeToggle />
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Size: {fontSize}px
                    </label>
                    <input
                      type="range"
                      min={TYPOGRAPHY_RANGES.fontSize.min}
                      max={TYPOGRAPHY_RANGES.fontSize.max}
                      step={TYPOGRAPHY_RANGES.fontSize.step}
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-900 dark:accent-gray-100"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>{TYPOGRAPHY_RANGES.fontSize.min}px</span>
                      <span>{TYPOGRAPHY_RANGES.fontSize.max}px</span>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Family
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFontFamily('serif')}
                        className={`flex-1 px-4 py-2 rounded border transition-colors ${
                          fontFamily === 'serif'
                            ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-900 dark:border-gray-100'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        style={{ fontFamily: 'Georgia, serif' }}
                      >
                        Serif
                      </button>
                      <button
                        onClick={() => setFontFamily('sans-serif')}
                        className={`flex-1 px-4 py-2 rounded border transition-colors ${
                          fontFamily === 'sans-serif'
                            ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 border-gray-900 dark:border-gray-100'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        style={{ fontFamily: '-apple-system, sans-serif' }}
                      >
                        Sans
                      </button>
                    </div>
                  </div>

                  {/* Line Height */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Line Height: {lineHeight.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min={TYPOGRAPHY_RANGES.lineHeight.min}
                      max={TYPOGRAPHY_RANGES.lineHeight.max}
                      step={TYPOGRAPHY_RANGES.lineHeight.step}
                      value={lineHeight}
                      onChange={(e) => setLineHeight(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-900 dark:accent-gray-100"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>{TYPOGRAPHY_RANGES.lineHeight.min}</span>
                      <span>{TYPOGRAPHY_RANGES.lineHeight.max}</span>
                    </div>
                  </div>

                  {/* Margins */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Margins: {margins}rem
                    </label>
                    <input
                      type="range"
                      min={TYPOGRAPHY_RANGES.margins.min}
                      max={TYPOGRAPHY_RANGES.margins.max}
                      step={TYPOGRAPHY_RANGES.margins.step}
                      value={margins}
                      onChange={(e) => setMargins(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-900 dark:accent-gray-100"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>{TYPOGRAPHY_RANGES.margins.min}rem</span>
                      <span>{TYPOGRAPHY_RANGES.margins.max}rem</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'audio' && audioSettings && (
                <AudioSettingsPanel
                  settings={audioSettings}
                  onChange={handleAudioSettingsChange}
                />
              )}

              {activeTab === 'usage' && (
                <UsageDashboard
                  stats={audioUsage.stats}
                  loading={audioUsage.loading}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleReset}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
