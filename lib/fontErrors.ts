/**
 * Centralized Font Error Handling System
 *
 * Provides consistent error handling across all font-related operations
 * with severity levels and recovery strategies.
 */

/**
 * Error severity levels determine how errors are presented to users
 */
export enum ErrorSeverity {
  /** Log only - no user notification (recoverable errors) */
  SILENT = 'silent',
  /** Show non-intrusive toast notification */
  TOAST = 'toast',
  /** Show blocking alert (critical errors) */
  ALERT = 'alert',
  /** Silent fallback to default font (transparent recovery) */
  FALLBACK = 'fallback',
}

/**
 * Base class for font-related errors
 */
export class FontError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: ErrorSeverity = ErrorSeverity.ALERT
  ) {
    super(message);
    this.name = 'FontError';
  }
}

/**
 * Font validation errors (file format, size, corruption)
 */
export class FontValidationError extends FontError {
  constructor(message: string, code: string) {
    super(message, code, ErrorSeverity.ALERT);
    this.name = 'FontValidationError';
  }
}

/**
 * Font loading errors (DB read, conversion, FontFace API)
 */
export class FontLoadError extends FontError {
  constructor(message: string, code: string, severity: ErrorSeverity = ErrorSeverity.FALLBACK) {
    super(message, code, severity);
    this.name = 'FontLoadError';
  }
}

/**
 * Font application errors (CSS injection, rendition issues)
 */
export class FontApplicationError extends FontError {
  constructor(message: string, code: string) {
    super(message, code, ErrorSeverity.SILENT);
    this.name = 'FontApplicationError';
  }
}

/**
 * Font deletion errors
 */
export class FontDeletionError extends FontError {
  constructor(message: string, code: string) {
    super(message, code, ErrorSeverity.ALERT);
    this.name = 'FontDeletionError';
  }
}

/**
 * Error recovery strategies
 */
interface ErrorRecovery {
  /** Fallback to default system font */
  fallbackToDefault?: () => void;
  /** Retry the operation */
  retry?: () => Promise<void>;
  /** Clear cached data */
  clearCache?: () => void;
}

/**
 * Centralized error handler with severity-based presentation
 *
 * @param error - The error to handle
 * @param context - Context string for logging (e.g., '[useEpubReader]')
 * @param recovery - Optional recovery strategies
 */
export function handleFontError(
  error: Error | unknown,
  context: string,
  recovery?: ErrorRecovery
): void {
  // Determine severity
  let severity: ErrorSeverity;
  let message: string;
  let code: string;

  if (error instanceof FontError) {
    severity = error.severity;
    message = error.message;
    code = error.code;
  } else if (error instanceof Error) {
    severity = ErrorSeverity.ALERT;
    message = error.message;
    code = 'UNKNOWN_ERROR';
  } else {
    severity = ErrorSeverity.ALERT;
    message = String(error);
    code = 'UNKNOWN_ERROR';
  }

  // Log error with context
  const logMessage = `${context} Font error [${code}]: ${message}`;

  switch (severity) {
    case ErrorSeverity.SILENT:
      console.warn(logMessage);
      break;

    case ErrorSeverity.TOAST:
      console.warn(logMessage);
      // Toast notification system not implemented - using console fallback
      console.info(`[User notification]: ${message}`);
      break;

    case ErrorSeverity.ALERT:
      console.error(logMessage, error);
      alert(getUserFriendlyMessage(error));
      break;

    case ErrorSeverity.FALLBACK:
      console.warn(logMessage);
      if (recovery?.fallbackToDefault) {
        console.log(`${context} Falling back to default font`);
        recovery.fallbackToDefault();
      }
      break;
  }

  // Execute recovery strategies
  if (recovery?.clearCache) {
    console.log(`${context} Clearing cache as recovery strategy`);
    recovery.clearCache();
  }
}

/**
 * Gets user-friendly error message for display
 */
function getUserFriendlyMessage(error: Error | unknown): string {
  if (error instanceof FontValidationError) {
    // Validation errors already have user-friendly messages
    return error.message;
  }

  if (error instanceof FontLoadError) {
    switch (error.code) {
      case 'FONT_NOT_FOUND':
        return 'The selected font could not be found. It may have been deleted.';
      case 'CONVERSION_FAILED':
        return 'Failed to load the font file. The file may be corrupted.';
      case 'FONTFACE_LOAD_FAILED':
        return 'Your browser could not load this font. Please try a different font.';
      default:
        return 'Failed to load font. Please try selecting a different font.';
    }
  }

  if (error instanceof FontApplicationError) {
    return 'Failed to apply font to the book. The book may have rendering issues.';
  }

  if (error instanceof FontDeletionError) {
    return 'Failed to delete font. Please try again.';
  }

  if (error instanceof Error) {
    return `An unexpected error occurred: ${error.message}`;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Wraps an async font operation with error handling
 *
 * @param operation - The async operation to execute
 * @param context - Context string for logging
 * @param recovery - Optional recovery strategies
 * @returns Promise that resolves to operation result or undefined on error
 */
export async function withFontErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  recovery?: ErrorRecovery
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    handleFontError(error, context, recovery);
    return undefined;
  }
}
