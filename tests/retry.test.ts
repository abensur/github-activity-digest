import { describe, test, expect, mock } from 'bun:test';
import { withRetry } from '../lib/retry';

describe('Retry Logic', () => {
  test('should succeed on first attempt', async () => {
    const fn = mock(() => Promise.resolve('success'));
    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should retry on failure and eventually succeed', async () => {
    let attempts = 0;
    const fn = mock(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Temporary error'));
      }
      return Promise.resolve('success');
    });

    const result = await withRetry(fn, { maxRetries: 3, initialDelay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('should not retry on 404 errors', async () => {
    const error = { status: 404, message: 'Not found' };
    const fn = mock(() => Promise.reject(error));

    await expect(withRetry(fn)).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should not retry on 401 errors', async () => {
    const error = { status: 401, message: 'Unauthorized' };
    const fn = mock(() => Promise.reject(error));

    await expect(withRetry(fn)).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should not retry on permission denied 403 errors', async () => {
    const error = { status: 403, message: 'Forbidden', response: { headers: {} } };
    const fn = mock(() => Promise.reject(error));

    await expect(withRetry(fn)).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('should handle rate limit 403 with x-ratelimit-remaining: 0', async () => {
    let attempts = 0;
    const resetTime = Math.floor(Date.now() / 1000) + 1; // 1 second from now
    const error = {
      status: 403,
      message: 'Rate limit exceeded',
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetTime)
        }
      }
    };
    const fn = mock(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(error);
      }
      return Promise.resolve('success');
    });

    const result = await withRetry(fn, { maxRetries: 3, initialDelay: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('should exhaust retries and throw last error', async () => {
    const error = new Error('Persistent error');
    const fn = mock(() => Promise.reject(error));

    await expect(withRetry(fn, { maxRetries: 2, initialDelay: 10 })).rejects.toThrow('Persistent error');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  test('should use exponential backoff', async () => {
    const startTime = Date.now();
    let attempts = 0;

    const fn = mock(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Fail'));
      }
      return Promise.resolve('ok');
    });

    await withRetry(fn, { maxRetries: 3, initialDelay: 100 });
    const elapsed = Date.now() - startTime;

    // First retry: 100ms, second retry: 200ms = ~300ms total minimum
    expect(elapsed).toBeGreaterThanOrEqual(250);
  });
});
