/**
 * Rate Limiting Utility
 *
 * Simple in-memory rate limiter for API routes.
 * Tracks request counts per client within a time window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp when the limit resets
}

// In-memory storage for rate limits
// Key: clientIdentifier, Value: rate limit entry
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Check if a client has exceeded their rate limit
 *
 * @param identifier - Unique client identifier (e.g., IP address)
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed status and optional retry-after time
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // Clean up expired entry
  if (entry && entry.resetAt < now) {
    rateLimitMap.delete(identifier);
  }

  const currentEntry = rateLimitMap.get(identifier);

  if (!currentEntry || currentEntry.resetAt < now) {
    // First request in window or window expired
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true };
  }

  if (currentEntry.count >= maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((currentEntry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment count
  currentEntry.count++;
  return { allowed: true };
}

/**
 * Get a unique identifier for the client making the request
 *
 * @param request - Next.js request object
 * @returns Client identifier (IP address or 'unknown')
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers (for proxied requests)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, use the first one
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback for development/unknown
  return 'unknown';
}

/**
 * Clean up old entries from the rate limit map
 * Should be called periodically to prevent memory leaks
 */
export function cleanupRateLimitMap(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  rateLimitMap.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => rateLimitMap.delete(key));
}

// Run cleanup every 5 minutes
if (typeof window === 'undefined') {
  // Only run in server environment
  setInterval(cleanupRateLimitMap, 5 * 60 * 1000);
}
