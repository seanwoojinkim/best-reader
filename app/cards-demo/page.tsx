'use client';

import React, { useState } from 'react';
import AspirationCard from '@/components/reader/AspirationCard';
import { getSampleCards } from '@/lib/mockAspirationCards';
import type { AspirationCardContent } from '@/types';

export default function CardsDemo() {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedCard, setSelectedCard] = useState<AspirationCardContent | null>(null);
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const cards = getSampleCards();

  const handleToggleExpanded = (cardId: string) => {
    setExpandedStates(prev => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const handleDismiss = () => {
    setSelectedCard(null);
  };

  // Get card type color for grid display
  const getCardTypeColor = (type: AspirationCardContent['type']) => {
    switch (type) {
      case 'context': return 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700';
      case 'comprehension': return 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700';
      case 'reflection': return 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700';
      case 'connection': return 'bg-fuchsia-100 dark:bg-fuchsia-900/30 border-fuchsia-300 dark:border-fuchsia-700';
      default: return 'bg-violet-100 dark:bg-violet-900/30 border-violet-300 dark:border-violet-700';
    }
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Aspirational Reading Cards</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Preview of all card types with purple/violet theme
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <button
                    onClick={() => setViewMode('desktop')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      viewMode === 'desktop'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Desktop
                  </button>
                  <button
                    onClick={() => setViewMode('mobile')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      viewMode === 'mobile'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Mobile
                  </button>
                </div>

                {/* Dark Mode Toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                >
                  {darkMode ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span className="text-sm">Light</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      <span className="text-sm">Dark</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              About These Cards
            </h2>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• <strong>Purple/violet theme</strong> - Distinct from AI features (sky blue)</li>
              <li>• <strong>Compass icon</strong> - Not sparkle (reserved for AI)</li>
              <li>• <strong>Expandable</strong> - 300ms smooth animations</li>
              <li>• <strong>Context cards</strong> - Show before reading</li>
              <li>• <strong>Other cards</strong> - Show after reading (comprehension, reflection, connection)</li>
            </ul>
          </div>
        </div>

        {/* Card Grid */}
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`p-6 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg ${getCardTypeColor(card.type)}`}
                onClick={() => setSelectedCard(card)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-white/50 dark:bg-black/20 mb-2">
                      {card.type}
                    </span>
                    <h3 className="text-lg font-bold">{card.title}</h3>
                  </div>
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                  {card.body.split('\n\n')[0]}
                </p>
                <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  Timing: <strong>{card.timing}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview Area */}
        {selectedCard && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/30 z-30 transition-opacity"
              onClick={handleDismiss}
            />

            {/* Card Preview */}
            <div className={viewMode === 'mobile' ? 'block md:hidden' : 'hidden md:block'}>
              <AspirationCard
                content={selectedCard}
                isExpanded={expandedStates[selectedCard.id] ?? true}
                onToggleExpanded={() => handleToggleExpanded(selectedCard.id)}
                onDismiss={handleDismiss}
                position={viewMode === 'mobile' ? 'bottom' : 'floating'}
              />
            </div>

            {viewMode === 'mobile' && (
              <div className="block md:hidden">
                <AspirationCard
                  content={selectedCard}
                  isExpanded={expandedStates[selectedCard.id] ?? true}
                  onToggleExpanded={() => handleToggleExpanded(selectedCard.id)}
                  onDismiss={handleDismiss}
                  position="bottom"
                />
              </div>
            )}

            {viewMode === 'desktop' && (
              <div className="hidden md:block">
                <AspirationCard
                  content={selectedCard}
                  isExpanded={expandedStates[selectedCard.id] ?? true}
                  onToggleExpanded={() => handleToggleExpanded(selectedCard.id)}
                  onDismiss={handleDismiss}
                  position="floating"
                />
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className="max-w-7xl mx-auto px-4 pb-12">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Card Types</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="w-full h-12 rounded bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-700"></div>
                <p className="text-sm font-semibold">Context</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Before reading - provides background</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 rounded bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700"></div>
                <p className="text-sm font-semibold">Comprehension</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">After reading - check understanding</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 rounded bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700"></div>
                <p className="text-sm font-semibold">Reflection</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">After reading - deeper thinking</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-12 rounded bg-fuchsia-100 dark:bg-fuchsia-900/30 border border-fuchsia-300 dark:border-fuchsia-700"></div>
                <p className="text-sm font-semibold">Connection</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">After reading - personal relevance</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
