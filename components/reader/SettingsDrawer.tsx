'use client';

import React, { useState, useEffect } from 'react';
import ThemeToggle from '../shared/ThemeToggle';
import TypographySettings from '../shared/TypographySettings';
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

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleAudioSettingsChange = async (updates: Partial<AudioSettings>) => {
    if (!audioSettings) return;

    const newSettings = { ...audioSettings, ...updates };
    setAudioSettings(newSettings);
    await saveAudioSettings(newSettings);
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
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 safe-area-top">
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
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
              <button
                onClick={() => setActiveTab('typography')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'typography'
                    ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Typography
              </button>
              <button
                onClick={() => setActiveTab('audio')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'audio'
                    ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Audio
              </button>
              <button
                onClick={() => setActiveTab('usage')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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

                  {/* Typography Settings */}
                  <TypographySettings />
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

        </div>
      </div>
    </>
  );
}
