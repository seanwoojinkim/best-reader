'use client';

import React, { useState, useEffect } from 'react';
import {
  getAnnasArchiveApiKey,
  setAnnasArchiveApiKey,
  removeAnnasArchiveApiKey,
  hasAnnasArchiveApiKey,
} from '@/lib/api-keys';

export default function AnnasArchiveApiKeySettings() {
  const [apiKey, setApiKeyInput] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Load API key status on mount
  useEffect(() => {
    const loadKeyStatus = async () => {
      const configured = await hasAnnasArchiveApiKey();
      setIsConfigured(configured);

      if (configured) {
        const key = await getAnnasArchiveApiKey();
        if (key) {
          // Show masked version
          setApiKeyInput(maskApiKey(key));
        }
      }
    };

    loadKeyStatus();
  }, []);

  const maskApiKey = (key: string): string => {
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 7) + '•'.repeat(key.length - 11) + key.substring(key.length - 4);
  };

  const handleSave = async () => {
    if (!apiKey || apiKey.trim().length === 0) {
      setMessage({ type: 'error', text: 'Please enter an API key' });
      return;
    }

    // Don't save if it's the masked version
    if (apiKey.includes('•')) {
      setMessage({ type: 'error', text: 'Please enter a new API key to update' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await setAnnasArchiveApiKey(apiKey.trim());
      setIsConfigured(true);
      setShowKey(false);
      // Mask the key after saving
      setApiKeyInput(maskApiKey(apiKey.trim()));
      setMessage({ type: 'success', text: 'API key saved successfully!' });

      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save API key. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to remove your API key?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await removeAnnasArchiveApiKey();
      setApiKeyInput('');
      setIsConfigured(false);
      setShowKey(false);
      setMessage({ type: 'success', text: 'API key removed successfully' });

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove API key' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeyInput(e.target.value);
    // Clear any previous messages when user starts typing
    setMessage(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          Anna&apos;s Archive API Key
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter your Anna&apos;s Archive API key to enable book downloads. Your key is stored
          securely on your device.
        </p>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center space-x-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div
          className={`w-3 h-3 rounded-full ${
            isConfigured ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {isConfigured ? 'API Key Configured' : 'No API Key'}
        </span>
      </div>

      {/* API Key Input */}
      <div>
        <label
          htmlFor="annas-api-key"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          API Key
        </label>
        <div className="relative">
          <input
            id="annas-api-key"
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={handleInputChange}
            placeholder="Enter your Anna's Archive API key"
            className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent
                     placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600
                     dark:hover:text-gray-300 transition-colors"
            aria-label={showKey ? 'Hide API key' : 'Show API key'}
          >
            {showKey ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Get your API key from{' '}
          <a
            href="https://annas-archive.org/account"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 dark:text-gray-100 underline hover:no-underline"
          >
            annas-archive.org/account
          </a>
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}
        >
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          disabled={saving || !apiKey || apiKey.trim().length === 0}
          className="flex-1 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900
                   rounded-md font-medium hover:bg-gray-800 dark:hover:bg-gray-200
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : isConfigured ? 'Update Key' : 'Save Key'}
        </button>

        {isConfigured && (
          <button
            onClick={handleClear}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-md font-medium
                     hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex">
          <svg
            className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">Secure Storage</p>
            <p className="text-xs">
              Your API key is stored securely on your device using Capacitor Preferences
              (iOS Keychain / Android EncryptedSharedPreferences) and is only used for book downloads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
