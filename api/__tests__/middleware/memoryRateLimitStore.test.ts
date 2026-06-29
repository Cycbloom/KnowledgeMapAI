import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRateLimitStore } from '../../middleware/rateLimitStore';

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithRequest: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * MemoryRateLimitStore 单元测试。
 *
 * 覆盖：
 * - increment 计数递增（同一 key 多次调用，count 递增）
 * - windowMs 过期后重置（用 vi.useFakeTimers，advance 时间超过 windowMs 后再次 increment，count 重置为 1）
 * - decrement 回退（count-- 后再 increment，count 正确）
 * - cleanup 清理过期项（advance 时间超过 resetTime，cleanup 后 store 为空）
 * - destroy 停止定时器（destroy 后不再执行 cleanup）
 */
describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    store = new MemoryRateLimitStore();
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
  });

  describe('increment 计数递增', () => {
    it('首次 increment 返回 count=1', async () => {
      const entry = await store.increment('key1', 60000);

      expect(entry.count).toBe(1);
      expect(entry.resetTime).toBe(Date.now() + 60000);
    });

    it('同一 key 多次 increment，count 递增', async () => {
      // increment 返回的是 store 中条目的引用（与原 rateLimiter 行为一致），
      // 因此每次 increment 后立即检查 count，避免后续 increment 修改前一次引用
      const e1 = await store.increment('key1', 60000);
      expect(e1.count).toBe(1);

      const e2 = await store.increment('key1', 60000);
      expect(e2.count).toBe(2);

      const e3 = await store.increment('key1', 60000);
      expect(e3.count).toBe(3);
    });

    it('同一窗口内 resetTime 保持首次设置的值', async () => {
      const resetTime1 = (await store.increment('key1', 60000)).resetTime;
      const resetTime2 = (await store.increment('key1', 60000)).resetTime;

      expect(resetTime1).toBe(resetTime2);
    });

    it('不同 key 的计数相互独立', async () => {
      await store.increment('key1', 60000);
      await store.increment('key1', 60000);

      const entry2 = await store.increment('key2', 60000);
      expect(entry2.count).toBe(1);
    });

    it('不同 windowMs 的 resetTime 计算正确', async () => {
      const entry = await store.increment('key1', 30000);
      expect(entry.resetTime).toBe(Date.now() + 30000);
    });
  });

  describe('windowMs 过期后重置', () => {
    it('windowMs 过期后再次 increment，count 重置为 1', async () => {
      await store.increment('key1', 1000);
      await store.increment('key1', 1000);
      expect((await store.increment('key1', 1000)).count).toBe(3);

      // 推进时间超过 windowMs
      vi.advanceTimersByTime(1500);

      // 应创建新条目
      const entry = await store.increment('key1', 1000);
      expect(entry.count).toBe(1);
      expect(entry.resetTime).toBe(Date.now() + 1000);
    });

    it('未过期内 increment 继续 count 递增', async () => {
      await store.increment('key1', 10000);

      // 推进 5s，仍在窗口内
      vi.advanceTimersByTime(5000);

      const entry = await store.increment('key1', 10000);
      expect(entry.count).toBe(2);
    });

    it('恰好到达 resetTime 时视为过期（resetTime 不 > now）', async () => {
      await store.increment('key1', 1000);

      // 推进恰好 1000ms，resetTime === now，不满足 resetTime > now
      vi.advanceTimersByTime(1000);

      const entry = await store.increment('key1', 1000);
      expect(entry.count).toBe(1);
    });
  });

  describe('decrement 回退', () => {
    it('decrement 后 count 递减', async () => {
      await store.increment('key1', 60000);
      await store.increment('key1', 60000);
      await store.increment('key1', 60000);
      // count = 3

      await store.decrement('key1');
      // count = 2

      const entry = await store.increment('key1', 60000);
      expect(entry.count).toBe(3);
    });

    it('decrement 后再 increment，count 正确', async () => {
      await store.increment('key1', 60000);
      await store.increment('key1', 60000);
      // count = 2

      await store.decrement('key1');
      // count = 1

      const entry = await store.increment('key1', 60000);
      expect(entry.count).toBe(2);
    });

    it('decrement 不存在的 key 不报错', async () => {
      await expect(store.decrement('nonexistent')).resolves.toBeUndefined();
    });

    it('decrement 后 count 不会小于 0', async () => {
      await store.increment('key1', 60000);
      // count = 1

      await store.decrement('key1');
      // count = 0

      await store.decrement('key1');
      // 仍为 0，不变为负

      const entry = await store.increment('key1', 60000);
      expect(entry.count).toBe(1);
    });

    it('多次 decrement 累计减少 count', async () => {
      await store.increment('key1', 60000);
      await store.increment('key1', 60000);
      await store.increment('key1', 60000);
      // count = 3

      await store.decrement('key1');
      await store.decrement('key1');
      // count = 1

      const entry = await store.increment('key1', 60000);
      expect(entry.count).toBe(2);
    });
  });

  describe('cleanup 清理过期项', () => {
    it('cleanup 清理过期项，保留未过期项', async () => {
      await store.increment('expired', 1000);
      await store.increment('active', 60000);

      // 推进时间超过 expired 的 resetTime
      vi.advanceTimersByTime(2000);

      await store.cleanup();

      // expired 应被清理，重新 increment 应返回 count=1
      const expiredEntry = await store.increment('expired', 1000);
      expect(expiredEntry.count).toBe(1);

      // active 仍有效，increment 应返回 count=2
      const activeEntry = await store.increment('active', 60000);
      expect(activeEntry.count).toBe(2);
    });

    it('cleanup 对空 store 不报错', async () => {
      await expect(store.cleanup()).resolves.toBeUndefined();
    });

    it('cleanup 后所有过期项都被删除', async () => {
      await store.increment('expired1', 1000);
      await store.increment('expired2', 1000);
      await store.increment('expired3', 1000);
      await store.increment('active', 60000);

      vi.advanceTimersByTime(2000);

      await store.cleanup();

      // 所有过期项都应被清理
      expect((await store.increment('expired1', 1000)).count).toBe(1);
      expect((await store.increment('expired2', 1000)).count).toBe(1);
      expect((await store.increment('expired3', 1000)).count).toBe(1);
      // 未过期项保留
      expect((await store.increment('active', 60000)).count).toBe(2);
    });

    it('cleanup 在没有过期项时不删除任何条目', async () => {
      await store.increment('key1', 60000);
      await store.increment('key2', 60000);

      // 推进时间但未过期
      vi.advanceTimersByTime(1000);

      await store.cleanup();

      // 计数应继续递增（未被清理）
      expect((await store.increment('key1', 60000)).count).toBe(2);
      expect((await store.increment('key2', 60000)).count).toBe(2);
    });
  });

  describe('定时器自动 cleanup', () => {
    it('每 60s 定时器自动触发 cleanup', async () => {
      await store.increment('expired', 1000);

      // 推进 60s 触发定时器
      vi.advanceTimersByTime(60000);

      // 定时器应已清理过期项，重新 increment 应返回 count=1
      const entry = await store.increment('expired', 1000);
      expect(entry.count).toBe(1);
    });
  });

  describe('destroy 停止定时器', () => {
    it('destroy 后定时器不再触发 cleanup', async () => {
      const cleanupSpy = vi.spyOn(store, 'cleanup');

      // 先验证定时器正常触发 cleanup
      cleanupSpy.mockClear();
      vi.advanceTimersByTime(60000);
      expect(cleanupSpy).toHaveBeenCalled();

      // destroy 后再推进时间，定时器不应再触发
      cleanupSpy.mockClear();
      store.destroy();
      vi.advanceTimersByTime(120000);
      expect(cleanupSpy).not.toHaveBeenCalled();
    });

    it('destroy 后再次调用 destroy 不报错', () => {
      store.destroy();
      expect(() => store.destroy()).not.toThrow();
    });

    it('destroy 后手动 cleanup 仍可调用', async () => {
      store.destroy();
      await expect(store.cleanup()).resolves.toBeUndefined();
    });

    it('destroy 后 increment/decrement 仍可正常使用', async () => {
      store.destroy();
      const entry = await store.increment('key1', 60000);
      expect(entry.count).toBe(1);

      await store.decrement('key1');
      const entry2 = await store.increment('key1', 60000);
      expect(entry2.count).toBe(1);
    });
  });

  describe('createRateLimitStore 工厂', () => {
    it('默认返回 MemoryRateLimitStore 实例', async () => {
      // 通过动态 import 避免污染顶层 store
      const { createRateLimitStore, MemoryRateLimitStore } = await import(
        '../../middleware/rateLimitStore'
      );
      const store = createRateLimitStore();
      expect(store).toBeInstanceOf(MemoryRateLimitStore);
      store.destroy();
    });

    it('RATE_LIMIT_STORE=memory 返回 MemoryRateLimitStore 实例', async () => {
      const original = process.env.RATE_LIMIT_STORE;
      process.env.RATE_LIMIT_STORE = 'memory';
      try {
        const { createRateLimitStore, MemoryRateLimitStore } = await import(
          '../../middleware/rateLimitStore'
        );
        const store = createRateLimitStore();
        expect(store).toBeInstanceOf(MemoryRateLimitStore);
        store.destroy();
      } finally {
        process.env.RATE_LIMIT_STORE = original;
      }
    });

    it('RATE_LIMIT_STORE=redis 抛出未实现错误', async () => {
      const original = process.env.RATE_LIMIT_STORE;
      process.env.RATE_LIMIT_STORE = 'redis';
      try {
        const { createRateLimitStore } = await import(
          '../../middleware/rateLimitStore'
        );
        expect(() => createRateLimitStore()).toThrow(
          'Redis rate limit store not yet implemented. Set RATE_LIMIT_STORE=memory',
        );
      } finally {
        process.env.RATE_LIMIT_STORE = original;
      }
    });

    it('未知 RATE_LIMIT_STORE 值回退到 memory', async () => {
      const original = process.env.RATE_LIMIT_STORE;
      process.env.RATE_LIMIT_STORE = 'unknown-backend';
      try {
        const { createRateLimitStore, MemoryRateLimitStore } = await import(
          '../../middleware/rateLimitStore'
        );
        const store = createRateLimitStore();
        expect(store).toBeInstanceOf(MemoryRateLimitStore);
        store.destroy();
      } finally {
        process.env.RATE_LIMIT_STORE = original;
      }
    });
  });
});
