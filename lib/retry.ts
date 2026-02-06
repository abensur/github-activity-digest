import { logger } from './logger';

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 second

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
}

function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as any).status;
    if (status === 429) return true;
    if (status === 403) {
      // Check if it's a rate limit 403 (not a permission denied 403)
      const remaining = (error as any).response?.headers?.['x-ratelimit-remaining'];
      return remaining === '0' || remaining === 0;
    }
  }
  return false;
}

function getRateLimitResetTime(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const resetTime = (error as any).response?.headers?.['x-ratelimit-reset'];
    if (resetTime) {
      return Math.max(0, parseInt(resetTime) * 1000 - Date.now());
    }
    // Secondary rate limit - wait 60 seconds
    const retryAfter = (error as any).response?.headers?.['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter) * 1000;
    }
  }
  return null;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const initialDelay = options.initialDelay ?? INITIAL_DELAY;

  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Handle rate limit errors specially - wait for reset
      if (isRateLimitError(error)) {
        const waitTime = getRateLimitResetTime(error);
        if (waitTime !== null) {
          logger.warn(`Rate limit hit, waiting ${Math.ceil(waitTime / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
          // Don't count this as a retry attempt
          attempt--;
          continue;
        }
      }

      // Don't retry on 404 or authentication errors
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status === 404 || status === 401) {
          throw error;
        }
        // Permission denied 403 (not rate limit) - don't retry
        if (status === 403 && !isRateLimitError(error)) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        logger.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

export async function withRateLimit<T>(
  _octokit: unknown,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Check if it's a rate limit error
    if (isRateLimitError(error)) {
      const waitTime = getRateLimitResetTime(error);
      if (waitTime !== null) {
        logger.warn(`Rate limit hit, waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
        return await fn();
      }
    }
    throw error;
  }
}
