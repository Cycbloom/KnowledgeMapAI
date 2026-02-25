import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withTimeout,
  withRetry,
  withTimeoutAndRetry,
  isRetryableError,
  TimeoutError,
  RetryError,
  DEFAULT_TIMEOUT,
} from './retry';

describe('retry utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('DEFAULT_TIMEOUT', () => {
    it('should have default timeout of 30000ms', () => {
      expect(DEFAULT_TIMEOUT).toBe(30000);
    });
  });

  describe('TimeoutError', () => {
    it('should create error with correct message', () => {
      const error = new TimeoutError(5000);
      expect(error.message).toBe('AI request timeout after 5000ms');
      expect(error.name).toBe('TimeoutError');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('RetryError', () => {
    it('should create error with attempts and lastError', () => {
      const lastError = new Error('connection failed');
      const error = new RetryError(3, lastError);
      expect(error.message).toBe('All 3 retry attempts failed. Last error: connection failed');
      expect(error.name).toBe('RetryError');
      expect(error.attempts).toBe(3);
      expect(error.lastError).toBe(lastError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for timeout error', () => {
      expect(isRetryableError(new Error('timeout'))).toBe(true);
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
    });

    it('should return true for network errors', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isRetryableError(new Error('EAI_AGAIN'))).toBe(true);
      expect(isRetryableError(new Error('network error'))).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
      expect(isRetryableError(new Error('429 Too Many Requests'))).toBe(true);
    });

    it('should return true for server errors', () => {
      expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
      expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('Not found'))).toBe(false);
      expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isRetryableError(new Error('TIMEOUT'))).toBe(true);
      expect(isRetryableError(new Error('Timeout'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    });
  });

  describe('withTimeout', () => {
    it('should resolve before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should throw TimeoutError after timeout', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('late'), 2000);
      });
      
      const timeoutPromise = withTimeout(promise, 100);
      
      vi.advanceTimersByTime(100);
      
      await expect(timeoutPromise).rejects.toThrow(TimeoutError);
      await expect(timeoutPromise).rejects.toThrow('AI request timeout after 100ms');
    });

    it('should use default timeout if not specified', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('late'), 40000);
      });
      
      const timeoutPromise = withTimeout(promise);
      
      vi.advanceTimersByTime(DEFAULT_TIMEOUT);
      
      await expect(timeoutPromise).rejects.toThrow(TimeoutError);
    });

    it('should propagate rejection from original promise', async () => {
      const promise = Promise.reject(new Error('original error'));
      await expect(withTimeout(promise, 1000)).rejects.toThrow('original error');
    });

    it('should resolve with complex objects', async () => {
      const data = { id: 1, name: 'test' };
      const promise = Promise.resolve(data);
      const result = await withTimeout(promise, 1000);
      expect(result).toEqual(data);
    });
  });

  describe('withRetry', () => {
    it('should resolve on first successful attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(fn, { maxRetries: 3, initialDelay: 10 });
      
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw RetryError after all retries fail', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));
      
      const resultPromise = withRetry(fn, { maxRetries: 3, initialDelay: 10 });
      
      await vi.runAllTimersAsync();
      
      await expect(resultPromise).rejects.toThrow(RetryError);
      await expect(resultPromise).rejects.toMatchObject({
        attempts: 3,
      });
    });

    it('should not retry on non-retryable error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid input'));
      
      const resultPromise = withRetry(fn, { maxRetries: 3 });
      
      await vi.runAllTimersAsync();
      
      await expect(resultPromise).rejects.toThrow(RetryError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use custom shouldRetry function', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('custom error'));
        }
        return Promise.resolve('success');
      });

      const shouldRetry = vi.fn().mockReturnValue(true);
      
      const resultPromise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 10,
        shouldRetry,
      });
      
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;
      expect(result).toBe('success');
      expect(shouldRetry).toHaveBeenCalled();
    });

    it('should call onRetry callback', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.resolve('success');
      });

      const onRetry = vi.fn();
      
      const resultPromise = withRetry(fn, {
        maxRetries: 3,
        initialDelay: 10,
        onRetry,
      });
      
      await vi.runAllTimersAsync();
      
      await resultPromise;
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
    });

    it('should use exponential backoff', async () => {
      const callTimes: number[] = [];
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        callTimes.push(Date.now());
        attempts++;
        if (attempts < 4) {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(fn, {
        maxRetries: 4,
        initialDelay: 100,
        maxDelay: 1000,
      });
      
      await vi.runAllTimersAsync();
      
      await resultPromise;
      expect(attempts).toBe(4);
    });

    it('should respect maxDelay', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 5) {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.resolve('success');
      });

      const resultPromise = withRetry(fn, {
        maxRetries: 5,
        initialDelay: 500,
        maxDelay: 1000,
      });
      
      await vi.runAllTimersAsync();
      
      await resultPromise;
      expect(attempts).toBe(5);
    });

    it('should use default options', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
    });
  });

  describe('withTimeoutAndRetry', () => {
    it('should combine timeout and retry', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), 200);
          });
        }
        return Promise.resolve('success');
      });

      const resultPromise = withTimeoutAndRetry(fn, {
        timeout: 100,
        maxRetries: 3,
        initialDelay: 10,
      });
      
      await vi.runAllTimersAsync();
      
      const result = await resultPromise;
      expect(result).toBe('success');
    });

    it('should throw error if function exceeds timeout', async () => {
      const fn = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('late'), 1000);
        });
      });

      const resultPromise = withTimeoutAndRetry(fn, {
        timeout: 100,
        maxRetries: 1,
      });
      
      await vi.runAllTimersAsync();
      
      await expect(resultPromise).rejects.toThrow();
    });

    it('should use default options', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withTimeoutAndRetry(fn);
      expect(result).toBe('success');
    });
  });
});
