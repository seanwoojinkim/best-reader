'use client';

import React, { useEffect, useState } from 'react';
import { getAllBooks } from '@/lib/db';
import type { Book } from '@/types';
import BookGrid from '@/components/library/BookGrid';
import EmptyState from '@/components/library/EmptyState';
import UploadButton from '@/components/library/UploadButton';
import SearchButton from '@/components/library/SearchButton';
import SearchModal from '@/components/library/SearchModal';
import OnboardingFlow from '@/components/library/OnboardingFlow';
import GlobalSettings from '@/components/settings/GlobalSettings';
import { useOnboarding } from '@/hooks/useOnboarding';

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Phase 3: Onboarding flow
  const { showOnboarding, isChecking, completeOnboarding, skipOnboarding } = useOnboarding();

  const loadBooks = async () => {
    try {
      const allBooks = await getAllBooks();
      setBooks(allBooks);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleUploadComplete = () => {
    loadBooks();
  };

  return (
    <>
      {/* Phase 3: Onboarding Flow */}
      {!isChecking && showOnboarding && (
        <OnboardingFlow onComplete={completeOnboarding} onSkip={skipOnboarding} />
      )}

      <div className="min-h-screen">
        {/* Header */}
        <header className="border-b border-gray-200 dark:border-gray-700 safe-area-top">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 dark:text-gray-100">Library</h1>
              <div className="flex gap-2 sm:gap-3">
                {/* View Toggle */}
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
                >
                  {viewMode === 'grid' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  )}
                </button>
                <SearchButton onClick={() => setShowSearchModal(true)} />
                <UploadButton onUploadComplete={handleUploadComplete} />
                {/* Settings Button */}
                <button
                  onClick={() => setShowGlobalSettings(true)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Open settings"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <svg
                  className="animate-spin h-12 w-12 text-gray-400 mx-auto mb-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <p className="text-gray-500">Loading library...</p>
              </div>
            </div>
          ) : books.length === 0 ? (
            <EmptyState />
          ) : (
            <BookGrid books={books} onBookDeleted={loadBooks} viewMode={viewMode} />
          )}
        </main>

        {/* Search Modal */}
        <SearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onBookDownloaded={loadBooks}
        />

        {/* Global Settings */}
        <GlobalSettings
          isOpen={showGlobalSettings}
          onClose={() => setShowGlobalSettings(false)}
        />
      </div>
    </>
  );
}
