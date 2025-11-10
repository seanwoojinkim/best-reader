'use client';

import React from 'react';
import type { AudioUsageStats } from '@/hooks/useAudioUsage';
import { formatCost, formatFileSize } from '@/lib/epub-utils';

interface UsageDashboardProps {
  stats: AudioUsageStats;
  loading: boolean;
}

export default function UsageDashboard({ stats, loading }: UsageDashboardProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Loading usage statistics...
      </div>
    );
  }

  const storageMB = (stats.storageBytes / 1024 / 1024).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Total Cost
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {formatCost(stats.totalCost)}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Generations
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {stats.totalGenerations}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Storage
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {storageMB} MB
          </div>
        </div>
      </div>

      {/* Usage by Voice */}
      {Object.keys(stats.usageByVoice).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Usage by Voice
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.usageByVoice).map(([voice, data]) => (
              <div
                key={voice}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                    {voice}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {data.count} generation{data.count !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatCost(data.cost)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Usage */}
      {stats.recentUsage.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Generations
          </h3>
          <div className="space-y-2">
            {stats.recentUsage.slice(0, 5).map((usage) => (
              <div
                key={usage.id}
                className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded-lg p-2"
              >
                <div className="text-gray-700 dark:text-gray-300">
                  {new Date(usage.timestamp).toLocaleDateString()} •{' '}
                  <span className="capitalize">{usage.voice}</span> •{' '}
                  {usage.charCount.toLocaleString()} chars
                </div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {formatCost(usage.cost)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.totalGenerations === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No audio generated yet
        </div>
      )}
    </div>
  );
}
