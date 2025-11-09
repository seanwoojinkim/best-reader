'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * Onboarding flow for first-time users
 * Shows welcome screen and quick feature tour
 */
export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Adaptive Reader',
      description: 'A serene, intelligent e-reading experience designed for deep focus and comprehension.',
      icon: (
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
    {
      title: 'Beautiful Reading Experience',
      description:
        'Choose from Light, Dark, or Sepia themes. Customize font size, line height, and margins for optimal readability.',
      icon: (
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      ),
    },
    {
      title: 'Highlight & Annotate',
      description:
        'Select text to highlight in 4 colors. Add notes to remember your thoughts. All your highlights are saved automatically.',
      icon: (
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      ),
    },
    {
      title: 'Track Your Progress',
      description:
        'See how much you have read, your reading speed, and estimated time remaining. Your reading sessions are tracked for insights.',
      icon: (
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete();
    } else {
      setStep((prev) => prev + 1);
    }
  }, [isLastStep, onComplete]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowRight') {
        if (!isLastStep) setStep(step + 1);
      } else if (e.key === 'ArrowLeft') {
        if (step > 0) setStep(step - 1);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [step, isLastStep, onSkip, handleNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-lg w-full p-8 animate-slideUp">
        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-8" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={steps.length}>
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setStep(index)}
              className={`h-2 rounded-full transition-all ${
                index === step
                  ? 'w-8 bg-gray-900 dark:bg-gray-100'
                  : 'w-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-gray-900 dark:text-gray-100 mb-6">{currentStep.icon}</div>

        {/* Content */}
        <div className="text-center mb-8">
          <h2 id="onboarding-title" className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-4">
            {currentStep.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{currentStep.description}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-700 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 dark:focus:ring-gray-100"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 px-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 dark:focus:ring-gray-100"
            autoFocus
          >
            {isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>

        {/* Keyboard Hints */}
        <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-4">
          Use arrow keys to navigate • Press Enter to continue • Press Escape to skip
        </p>
      </div>
    </div>
  );
}
