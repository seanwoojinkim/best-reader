import HighlightList from '@/components/library/HighlightList';

export default function HighlightsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-gray-100">
              Highlights
            </h1>
            <a
              href="/"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              ← Library
            </a>
          </div>
        </div>
      </header>

      <main>
        <HighlightList />
      </main>
    </div>
  );
}
