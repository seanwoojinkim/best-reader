'use client';

import React from 'react';
import type { OpenAIVoice, AudioSettings } from '@/types';

interface AudioSettingsPanelProps {
  settings: AudioSettings;
  onChange: (settings: Partial<AudioSettings>) => void;
}

const VOICES: { value: OpenAIVoice; label: string; description: string }[] = [
  { value: 'alloy', label: 'Alloy', description: 'Neutral, versatile voice' },
  { value: 'echo', label: 'Echo', description: 'Warm, engaging voice' },
  { value: 'fable', label: 'Fable', description: 'Clear, storytelling voice' },
  { value: 'onyx', label: 'Onyx', description: 'Deep, authoritative voice' },
  { value: 'nova', label: 'Nova', description: 'Energetic, youthful voice' },
  { value: 'shimmer', label: 'Shimmer', description: 'Soft, gentle voice' },
];

const PLAYBACK_SPEEDS = [
  { value: 0.75, label: '0.75x' },
  { value: 1.0, label: '1x (Normal)' },
  { value: 1.25, label: '1.25x' },
  { value: 1.5, label: '1.5x' },
  { value: 2.0, label: '2x' },
];

export default function AudioSettingsPanel({ settings, onChange }: AudioSettingsPanelProps) {
  return (
    <div className="space-y-6">
      {/* Voice Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Default Voice
        </label>
        <div className="grid grid-cols-2 gap-2">
          {VOICES.map((voice) => (
            <button
              key={voice.value}
              onClick={() => onChange({ voice: voice.value })}
              className={`p-3 text-left rounded-lg border transition-colors ${
                settings.voice === voice.value
                  ? 'bg-sky-50 dark:bg-sky-950 border-sky-600 dark:border-sky-400'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {voice.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {voice.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Playback Speed */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Default Playback Speed
        </label>
        <div className="flex gap-2">
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              key={speed.value}
              onClick={() => onChange({ playbackSpeed: speed.value })}
              className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                settings.playbackSpeed === speed.value
                  ? 'bg-sky-50 dark:bg-sky-950 border-sky-600 dark:border-sky-400 text-sky-700 dark:text-sky-300'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {speed.label}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-play */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Auto-play Next Chapter
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Automatically play next chapter when current finishes
          </p>
        </div>
        <button
          onClick={() => onChange({ autoPlay: !settings.autoPlay })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.autoPlay
              ? 'bg-sky-600 dark:bg-sky-500'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
          role="switch"
          aria-checked={settings.autoPlay}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.autoPlay ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
