/**
 * Production-safe logging utility
 * Only logs in development mode or when explicitly enabled
 * Works in both server and client components
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  error: (...args: unknown[]) => {
    // Always log errors, even in production (but you might want to send to error tracking service)
    if (isDevelopment) {
      console.error('[ERROR]', ...args);
    } else {
      // In production, you could send to error tracking service like Sentry
      // For now, we'll still log but you should integrate with a proper error tracking service
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  },
  log: (...args: unknown[]) => {
    // Only log in development
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },
};

