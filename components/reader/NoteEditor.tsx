'use client';

import React, { useState, useEffect, useRef } from 'react';

interface NoteEditorProps {
  initialNote?: string;
  highlightText: string;
  onSave: (note: string) => void;
  onCancel: () => void;
}

export default function NoteEditor({
  initialNote = '',
  highlightText,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [note, setNote] = useState(initialNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autofocus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = () => {
    onSave(note.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add Note
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 italic">
            &ldquo;{highlightText.length > 80 ? `${highlightText.slice(0, 80)}...` : highlightText}&rdquo;
          </p>
        </div>

        {/* Note input */}
        <div className="px-6 py-4">
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add your thoughts, questions, or observations..."
            className="w-full h-32 px-3 py-2 text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Press Cmd/Ctrl + Enter to save, Escape to cancel
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded transition-colors"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}
