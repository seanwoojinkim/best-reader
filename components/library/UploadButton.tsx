'use client';

import React, { useRef, useState } from 'react';
import { addBook } from '@/lib/db';
import { extractEpubMetadata, isValidEpubFile } from '@/lib/epub-utils';

interface UploadButtonProps {
  onUploadComplete?: () => void;
}

type UploadStatus = 'idle' | 'validating' | 'processing' | 'saving';

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setError(null);

    // Validate file
    setUploadStatus('validating');
    if (!isValidEpubFile(file)) {
      setError('Please select a valid EPUB file (.epub)');
      setUploadStatus('idle');
      return;
    }

    try {
      // Extract metadata from EPUB
      setUploadStatus('processing');
      const metadata = await extractEpubMetadata(file);

      // Convert file to blob for storage
      const blob = new Blob([await file.arrayBuffer()], { type: 'application/epub+zip' });

      // Add book to database
      setUploadStatus('saving');
      await addBook({
        title: metadata.title,
        author: metadata.author,
        filePath: '', // Will store blob directly
        coverUrl: metadata.coverUrl,
        fileBlob: blob,
      });

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Notify parent
      onUploadComplete?.();
      setUploadStatus('idle');
    } catch (error) {
      console.error('Error uploading EPUB:', error);
      setError('Failed to upload EPUB file. Please try again.');
      setUploadStatus('idle');
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'validating':
        return 'Validating...';
      case 'processing':
        return 'Extracting metadata...';
      case 'saving':
        return 'Saving book...';
      default:
        return 'Upload EPUB';
    }
  };

  const isUploading = uploadStatus !== 'idle';

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload EPUB file"
      />
      <button
        onClick={handleClick}
        disabled={isUploading}
        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {isUploading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
            {getStatusText()}
          </>
        ) : (
          <>
            <svg
              className="-ml-1 mr-3 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Upload EPUB
          </>
        )}
      </button>

      {/* Inline error display */}
      {error && (
        <div className="absolute top-full mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 shadow-lg z-10 min-w-[300px]">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
