import { logger } from '../utils/logger';

/**
 * 速率限制条目。
 */
export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * 速率限制后端抽象接口。
 *
 * 定义一套与底层存储无关的速率限制操作契约，便于在内存
 * （MemoryRateLimitStore）与未来 Redis 后端之间切换。
 * rateLimiter 中间件通过此接口委托所有底层操作。
 */
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitEntry>;
  decrement(key: string): Promise<void>;
  cleanup(): Promise<void>;
  destroy(): void;
}

const CLEANUP_INTERVAL_MS = 60000;

/**
 * 基于进程内存的速率限制存储实现。
 *
 * - store Map 提供 key → { count, resetTime } 计数
 * - 60s 定时清理过期条目，防止内存无限增长
 * - increment 在条目过期时自动重置为新窗口
 *
 * 将原 rateLimiter.ts 中的 localStore + cleanupInterval 逻辑完整迁移到此类。
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, RateLimitEntry>();
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanup().catch((err) => {
        logger.error('Rate limit store cleanup error:', err);
      });
    }, CLEANUP_INTERVAL_MS);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.resetTime > now) {
      existing.count += 1;
      return existing;
    }

    const entry: RateLimitEntry = { count: 1, resetTime: now + windowMs };
    this.store.set(key, entry);
    return entry;
  }

  async decrement(key: string): Promise<void> {
    const existing = this.store.get(key);
    if (existing && existing.count > 0) {
      existing.count -= 1;
    }
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }
}

/**
 * 速率限制后端工厂：根据 RATE_LIMIT_STORE 环境变量返回对应实现。
 *
 * - memory（默认）：返回 MemoryRateLimitStore 实例
 * - redis：抛错（未来 Web 多实例部署时实现 RedisRateLimitStore）
 */
export function createRateLimitStore(): RateLimitStore {
  const backend = process.env.RATE_LIMIT_STORE ?? 'memory';
  switch (backend) {
    case 'memory':
      return new MemoryRateLimitStore();
    case 'redis':
      throw new Error(
        'Redis rate limit store not yet implemented. Set RATE_LIMIT_STORE=memory',
      );
    default:
      return new MemoryRateLimitStore();
  }
}
