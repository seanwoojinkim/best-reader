/**
 * Logging Utility
 *
 * Environment-aware logging that suppresses debug logs in production.
 * Provides structured logging with different severity levels.
 *
 * Usage:
 * import { logger } from '@/lib/logger';
 *
 * logger.debug('Detailed information', { context: 'value' });
 * logger.info('General information');
 * logger.warn('Warning message');
 * logger.error('Error message', error);
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

type LogContext = Record<string, any>;

/**
 * Format log message with timestamp and context
 */
function formatMessage(level: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }

  return `${prefix} ${message}`;
}

export const logger = {
  /**
   * Debug-level logging
   * Only shown in development environment
   */
  debug: (message: string, context?: LogContext) => {
    if (isDevelopment || isTest) {
      console.log(formatMessage('debug', message, context));
    }
  },

  /**
   * Info-level logging
   * Shown in all environments
   */
  info: (message: string, context?: LogContext) => {
    console.info(formatMessage('info', message, context));
  },

  /**
   * Warning-level logging
   * Shown in all environments
   */
  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage('warn', message, context));
  },

  /**
   * Error-level logging
   * Shown in all environments
   * Accepts Error object as second parameter
   */
  error: (message: string, error?: Error | LogContext) => {
    if (error instanceof Error) {
      console.error(formatMessage('error', message, {
        error: error.message,
        stack: error.stack,
      }));
    } else {
      console.error(formatMessage('error', message, error));
    }
  },

  /**
   * Group related log messages
   * Only in development
   */
  group: (label: string, callback: () => void) => {
    if (isDevelopment || isTest) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  },
};

/**
 * Create a scoped logger with automatic context
 */
export function createScopedLogger(scope: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`[${scope}] ${message}`, context),
    info: (message: string, context?: LogContext) =>
      logger.info(`[${scope}] ${message}`, context),
    warn: (message: string, context?: LogContext) =>
      logger.warn(`[${scope}] ${message}`, context),
    error: (message: string, error?: Error | LogContext) =>
      logger.error(`[${scope}] ${message}`, error),
  };
}
