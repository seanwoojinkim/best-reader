'use client';

import React from 'react';
import { TAP_ZONES } from '@/lib/constants';

interface TapZonesProps {
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleControls: () => void;
  children: React.ReactNode;
}

export default function TapZones({
  onPrevPage,
  onNextPage,
  onToggleControls,
  children,
}: TapZonesProps) {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, currentTarget } = event;
    const { left, width } = currentTarget.getBoundingClientRect();
    const clickX = clientX - left;
    const percentage = clickX / width;

    // Stop event from bubbling to prevent double-handling
    event.stopPropagation();

    if (percentage < TAP_ZONES.left) {
      // Left zone - previous page
      onPrevPage();
    } else if (percentage > 1 - TAP_ZONES.right) {
      // Right zone - next page
      onNextPage();
    } else {
      // Center zone - toggle controls
      onToggleControls();
    }
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          onPrevPage();
          break;
        case 'ArrowRight':
        case 'PageDown':
        case ' ': // Spacebar
          event.preventDefault();
          onNextPage();
          break;
        case 'Escape':
          onToggleControls();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevPage, onNextPage, onToggleControls]);

  return (
    <div
      onClick={handleClick}
      className="w-full h-full cursor-pointer select-none"
      role="button"
      tabIndex={0}
      aria-label="Reading area - swipe or click left to go back, right to go forward, center to show menu"
    >
      {children}
    </div>
  );
}
