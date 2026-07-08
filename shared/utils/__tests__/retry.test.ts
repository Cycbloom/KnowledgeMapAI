import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMEOUT,
  LONG_TIMEOUT,
  TimeoutError,
  RetryError,
  isRetryableError,
} from '../retry';

describe('retry', () => {
  describe('常量', () => {
    it('DEFAULT_TIMEOUT 为 60000ms', () => {
      expect(DEFAULT_TIMEOUT).toBe(60000);
    });

    it('LONG_TIMEOUT 为 180000ms（3 分钟）', () => {
      expect(LONG_TIMEOUT).toBe(180000);
    });
  });

  describe('TimeoutError', () => {
    it('包含超时毫秒数信息', () => {
      const err = new TimeoutError(5000);
      expect(err.message).toContain('5000');
      expect(err.message).toContain('timeout');
      expect(err.name).toBe('TimeoutError');
    });

    it('是 Error 的实例', () => {
      const err = new TimeoutError(1000);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TimeoutError);
    });
  });

  describe('RetryError', () => {
    it('包含重试次数与最后一次错误', () => {
      const lastErr = new Error('连接失败');
      const err = new RetryError(3, lastErr);
      expect(err.attempts).toBe(3);
      expect(err.lastError).toBe(lastErr);
      expect(err.name).toBe('RetryError');
    });

    it('消息包含重试次数与最后错误信息', () => {
      const lastErr = new Error('连接失败');
      const err = new RetryError(5, lastErr);
      expect(err.message).toContain('5');
      expect(err.message).toContain('连接失败');
    });

    it('是 Error 的实例', () => {
      const err = new RetryError(1, new Error('x'));
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(RetryError);
    });
  });

  describe('isRetryableError', () => {
    it('timeout 错误可重试', () => {
      expect(isRetryableError(new Error('Request timeout'))).toBe(true);
    });

    it('ECONNRESET 错误可重试', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
    });

    it('ENOTFOUND 错误可重试', () => {
      expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
    });

    it('ECONNREFUSED 错误可重试', () => {
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('ETIMEDOUT 错误可重试', () => {
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('rate limit 错误可重试', () => {
      expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true);
    });

    it('429 错误可重试', () => {
      expect(isRetryableError(new Error('HTTP 429 Too Many Requests'))).toBe(true);
    });

    it('503 错误可重试', () => {
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
    });

    it('502 错误可重试', () => {
      expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true);
    });

    it('500 错误可重试', () => {
      expect(isRetryableError(new Error('500 Internal Server Error'))).toBe(true);
    });

    it('network 错误可重试', () => {
      expect(isRetryableError(new Error('network error'))).toBe(true);
    });

    it('EAI_AGAIN 错误可重试', () => {
      expect(isRetryableError(new Error('EAI_AGAIN'))).toBe(true);
    });

    it('大小写不敏感（TIMEOUT 也可重试）', () => {
      expect(isRetryableError(new Error('REQUEST TIMEOUT'))).toBe(true);
      expect(isRetryableError(new Error('Network Error'))).toBe(true);
    });

    it('普通业务错误不可重试', () => {
      expect(isRetryableError(new Error('Validation failed'))).toBe(false);
    });

    it('404 错误不可重试', () => {
      expect(isRetryableError(new Error('404 Not Found'))).toBe(false);
    });

    it('401 错误不可重试', () => {
      expect(isRetryableError(new Error('401 Unauthorized'))).toBe(false);
    });

    it('参数校验错误不可重试', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
    });

    it('空消息错误不可重试', () => {
      expect(isRetryableError(new Error(''))).toBe(false);
    });
  });
});
