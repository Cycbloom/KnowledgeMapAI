import { LRUCache } from 'lru-cache';
import { logger } from '../../utils/logger';

/**
 * 缓存后端抽象接口。
 *
 * 定义一套与底层存储无关的缓存操作契约，便于在内存（MemoryCacheStore）
 * 与未来 Redis 后端之间切换。cacheService 通过此接口委托所有底层操作。
 */
export interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
}
export interface CacheHealthInfo {
  tagCount: number;
  pendingCount: number;
}

export interface CacheInterface {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;
  del(key: string): Promise<void>;
  delByTags(tags: string[]): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number, tags?: string[]): Promise<T>;
  /** 批量删除多个 key，返回实际删除条目数 */
  delMany(keys: string[]): Promise<number>;
  /** 按 tag 批量删除并返回删除条目数 */
  delByTagsWithCount(tags: string[]): Promise<number>;
  /** 返回 key 的剩余 TTL 毫秒数，0 表示无 TTL 或不存在 */
  getRemainingTTL(key: string): Promise<number>;
  /** 返回缓存命中/未命中统计 */
  getStats(): Promise<CacheStats>;
  /** 返回 tag 索引和 pending 请求数量 */
  getHealthInfo(): Promise<CacheHealthInfo>;
}

const MAX_CACHE_KEYS = 5000;
const DEFAULT_TTL = 300;

/**
 * TTL 随机化防雪崩：在基准值上下浮动 ±20%，避免大量 key 同时过期导致缓存击穿。
 */
const stochasticTTL = (baseTTL: number): number => {
  const variance = baseTTL * 0.2;
  return Math.floor(baseTTL + (Math.random() * variance * 2 - variance));
};

interface CacheEntry {
  value: unknown;
}

/**
 * 基于进程内存的缓存实现，封装 LRUCache + tag 索引。
 *
 * - LRUCache 同时提供 TTL 自动过期（lazy 检查）与 O(1) LRU 淘汰（max 上限）
 * - tagIndex / keyTags 提供按 tag 批量失效索引
 * - pendingRequests 实现 getOrSet 请求去重（同 key 并发只触发一次 fetchFn）
 *
 * 除 CacheInterface 规定的方法外，本类还公开若干内省方法（getTtl / getStatsInternal /
 * getTagCount / getPendingCount / delMany / delByTagsWithCount），供 cacheService
 * 在需要返回删除计数或剩余 TTL 时通过 instanceof 检查后调用，保持向后兼容。
 */
export class MemoryCacheStore implements CacheInterface {
  private readonly localCache: LRUCache<string, CacheEntry>;
  private readonly tagIndex: Map<string, Set<string>>;
  private readonly keyTags: Map<string, Set<string>>;
  private readonly pendingRequests: Map<string, Promise<unknown>>;
  private hits = 0;
  private misses = 0;

  constructor() {
    this.localCache = new LRUCache<string, CacheEntry>({
      max: MAX_CACHE_KEYS,
      ttl: DEFAULT_TTL * 1000,
      // 自动淘汰/过期时清理 tag 索引；显式 delete/overwrite 由调用方手动清理
      dispose: (_value, key, reason) => {
        if (reason === 'evict' || reason === 'expire') {
          this.cleanupTagsForKey(key);
        }
      },
    });
    this.tagIndex = new Map();
    this.keyTags = new Map();
    this.pendingRequests = new Map();
    logger.info('📦 In-Memory Cache initialized');
  }

  private cleanupTagsForKey(key: string): void {
    const tags = this.keyTags.get(key);
    if (tags) {
      for (const tag of tags) {
        const tagKeys = this.tagIndex.get(tag);
        if (tagKeys) {
          tagKeys.delete(key);
          if (tagKeys.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
      this.keyTags.delete(key);
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.localCache.get(key);
    const value = entry?.value;
    if (value !== undefined) {
      this.hits++;
      logger.debug(`[Cache] HIT: ${key}`);
    } else {
      this.misses++;
      logger.debug(`[Cache] MISS: ${key}`);
    }
    return value as T | undefined;
  }

  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const effectiveTTL = stochasticTTL(ttl ?? DEFAULT_TTL);
    // LRU 淘汰由 lru-cache 的 max 选项自动处理（O(1)）
    this.localCache.set(key, { value }, { ttl: effectiveTTL * 1000 });

    if (tags && tags.length > 0) {
      const tagSet = new Set(tags);
      this.keyTags.set(key, tagSet);

      for (const tag of tagSet) {
        const existing = this.tagIndex.get(tag);
        if (existing) {
          existing.add(key);
        } else {
          this.tagIndex.set(tag, new Set([key]));
        }
      }
    }
    logger.debug(`[Cache] SET: ${key} (TTL: ${effectiveTTL}s)`);
  }

  async del(key: string): Promise<void> {
    this.delInternal(key);
  }

  /**
   * 同步删除单个 key 并清理 tag 索引。
   * 返回被删除的条目数（0 或 1）。
   */
  private delInternal(key: string): number {
    const existed = this.localCache.has(key);
    this.localCache.delete(key);
    this.cleanupTagsForKey(key);
    return existed ? 1 : 0;
  }

  /**
   * 批量删除多个 key，返回实际删除条目数。
   */
  async delMany(keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      count += this.delInternal(k);
    }
    return count;
  }

  async delByTags(tags: string[]): Promise<void> {
    await this.delByTagsWithCount(tags);
  }

  /**
   * 按 tag 批量删除并返回删除条目数。
   */
  async delByTagsWithCount(tags: string[]): Promise<number> {
    const keysToDelete = new Set<string>();
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          keysToDelete.add(key);
        }
      }
    }

    if (keysToDelete.size > 0) {
      return this.delMany(Array.from(keysToDelete));
    }

    return 0;
  }

  async has(key: string): Promise<boolean> {
    return this.localCache.has(key);
  }

  async clear(): Promise<void> {
    this.localCache.clear();
    this.tagIndex.clear();
    this.keyTags.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async keys(): Promise<string[]> {
    return [...this.localCache.keys()];
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number,
    tags?: string[],
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = this.pendingRequests.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const fetchPromise = fetchFn();
    this.pendingRequests.set(key, fetchPromise);

    try {
      const data = await fetchPromise;
      await this.set(key, data, ttl ?? DEFAULT_TTL, tags);
      return data;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  async getRemainingTTL(key: string): Promise<number> {
    const remaining = this.localCache.getRemainingTTL(key);
    return remaining === Infinity ? 0 : remaining;
  }

  async getStats(): Promise<CacheStats> {
    return {
      keys: this.localCache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }

  async getHealthInfo(): Promise<CacheHealthInfo> {
    return {
      tagCount: this.tagIndex.size,
      pendingCount: this.pendingRequests.size,
    };
  }

  // ---- 向后兼容方法（保留供外部直接调用） ----

  /**
   * 返回 key 的 TTL 到期时间戳（ms）。0 表示无 TTL 或不存在。
   * 供 cacheService.getOrSetWithRefresh 判断是否触发后台刷新。
   */
  getTtl(key: string): number {
    const remaining = this.localCache.getRemainingTTL(key);
    if (remaining === 0 || remaining === Infinity) return 0;
    return Date.now() + remaining;
  }

  /**
   * 返回缓存统计信息（key 数、命中、未命中）。
   * 供 cacheService.getStats 向后兼容返回。
   */
  getStatsInternal(): { keys: number; hits: number; misses: number } {
    return {
      keys: this.localCache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /**
   * 返回当前 tag 索引中不同 tag 的数量。
   * 供 cacheService.getCacheHealth 向后兼容返回。
   */
  getTagCount(): number {
    return this.tagIndex.size;
  }

  /**
   * 返回当前 pending 请求（getOrSet 去重）的数量。
   * 供 cacheService.getCacheHealth 向后兼容返回。
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

/**
 * 缓存后端工厂：根据 CACHE_BACKEND 环境变量返回对应实现。
 *
 * - memory（默认）：返回 MemoryCacheStore 实例
 * - redis：抛错（未来 Web 多实例部署时实现 RedisCacheStore）
 */
export function createCacheStore(): CacheInterface {
  const backend = process.env.CACHE_BACKEND ?? 'memory';
  switch (backend) {
    case 'memory':
      return new MemoryCacheStore();
    case 'redis':
      throw new Error('Redis cache backend not yet implemented. Set CACHE_BACKEND=memory');
    default:
      return new MemoryCacheStore();
  }
}
