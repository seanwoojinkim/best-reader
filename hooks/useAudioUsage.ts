import { useState, useEffect, useCallback } from 'react';
import type { AudioUsage } from '@/types';
import { getAudioUsage, getBookAudioStorageSize } from '@/lib/db';

interface UseAudioUsageProps {
  bookId: number;
}

export interface AudioUsageStats {
  totalCost: number;
  totalGenerations: number;
  storageBytes: number;
  usageByVoice: Record<string, { count: number; cost: number }>;
  recentUsage: AudioUsage[];
}

export function useAudioUsage({ bookId }: UseAudioUsageProps) {
  const [stats, setStats] = useState<AudioUsageStats>({
    totalCost: 0,
    totalGenerations: 0,
    storageBytes: 0,
    usageByVoice: {},
    recentUsage: [],
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);

    try {
      const usage = await getAudioUsage(bookId);
      const storageBytes = await getBookAudioStorageSize(bookId);

      // Calculate total cost
      const totalCost = usage.reduce((sum, u) => sum + u.cost, 0);

      // Group by voice
      const usageByVoice: Record<string, { count: number; cost: number }> = {};

      usage.forEach((u) => {
        if (!usageByVoice[u.voice]) {
          usageByVoice[u.voice] = { count: 0, cost: 0 };
        }
        usageByVoice[u.voice].count += 1;
        usageByVoice[u.voice].cost += u.cost;
      });

      setStats({
        totalCost,
        totalGenerations: usage.length,
        storageBytes,
        usageByVoice,
        recentUsage: usage.slice(-10).reverse(), // Last 10, newest first
      });
    } catch (error) {
      console.error('Error loading audio usage stats:', error);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    refresh: loadStats,
  };
}
