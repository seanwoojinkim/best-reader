/**
 * API Key Management
 *
 * Centralized management for API keys stored securely using Capacitor Preferences.
 * Keys are stored in iOS Keychain and Android EncryptedSharedPreferences.
 */

import { Preferences } from '@capacitor/preferences';

const OPENAI_API_KEY = 'openai_api_key';
const ANNAS_ARCHIVE_API_KEY = 'annas_archive_api_key';

/**
 * OpenAI API Key Management
 */
export async function getOpenAIApiKey(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: OPENAI_API_KEY });
    return value;
  } catch (error) {
    console.error('[API Keys] Error retrieving OpenAI API key:', error);
    return null;
  }
}

export async function setOpenAIApiKey(apiKey: string): Promise<void> {
  try {
    await Preferences.set({ key: OPENAI_API_KEY, value: apiKey });
  } catch (error) {
    console.error('[API Keys] Error storing OpenAI API key:', error);
    throw error;
  }
}

export async function removeOpenAIApiKey(): Promise<void> {
  try {
    await Preferences.remove({ key: OPENAI_API_KEY });
  } catch (error) {
    console.error('[API Keys] Error removing OpenAI API key:', error);
    throw error;
  }
}

export async function hasOpenAIApiKey(): Promise<boolean> {
  const key = await getOpenAIApiKey();
  return !!key;
}

/**
 * Anna's Archive API Key Management
 */
export async function getAnnasArchiveApiKey(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: ANNAS_ARCHIVE_API_KEY });
    return value;
  } catch (error) {
    console.error('[API Keys] Error retrieving Anna\'s Archive API key:', error);
    return null;
  }
}

export async function setAnnasArchiveApiKey(apiKey: string): Promise<void> {
  try {
    await Preferences.set({ key: ANNAS_ARCHIVE_API_KEY, value: apiKey });
  } catch (error) {
    console.error('[API Keys] Error storing Anna\'s Archive API key:', error);
    throw error;
  }
}

export async function removeAnnasArchiveApiKey(): Promise<void> {
  try {
    await Preferences.remove({ key: ANNAS_ARCHIVE_API_KEY });
  } catch (error) {
    console.error('[API Keys] Error removing Anna\'s Archive API key:', error);
    throw error;
  }
}

export async function hasAnnasArchiveApiKey(): Promise<boolean> {
  const key = await getAnnasArchiveApiKey();
  return !!key;
}
