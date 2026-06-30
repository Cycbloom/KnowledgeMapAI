import NodeCache from 'node-cache';
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

/**
 * 基于进程内存的缓存实现，封装 NodeCache + LRU + tag 索引。
 *
 * - NodeCache 提供 TTL 自动过期与 lazy 过期检查
 * - LRUCache 提供 O(1) 淘汰追踪（lruTracker.pop() 取最旧 key）
 * - tagIndex / keyTags 提供按 tag 批量失效索引
 * - pendingRequests 实现 getOrSet 请求去重（同 key 并发只触发一次 fetchFn）
 *
 * 除 CacheInterface 规定的方法外，本类还公开若干内省方法（getTtl / getStatsInternal /
 * getTagCount / getPendingCount / delMany / delByTagsWithCount），供 cacheService
 * 在需要返回删除计数或剩余 TTL 时通过 instanceof 检查后调用，保持向后兼容。
 */
export class MemoryCacheStore implements CacheInterface {
  private readonly localCache: NodeCache;
  // LRU tracker: O(1) eviction via lru-cache, replacing O(N) Map scan.
  // Value stores the key itself so pop() returns the evicted key for O(1) cleanup.
  private readonly lruTracker: LRUCache<string, string>;
  private readonly tagIndex: Map<string, Set<string>>;
  private readonly keyTags: Map<string, Set<string>>;
  private readonly pendingRequests: Map<string, Promise<unknown>>;

  constructor() {
    this.localCache = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: 60 });
    this.lruTracker = new LRUCache<string, string>({ max: MAX_CACHE_KEYS });
    this.tagIndex = new Map();
    this.keyTags = new Map();
    this.pendingRequests = new Map();
    logger.info('📦 In-Memory Cache initialized');
  }

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.localCache.get<T>(key);
    if (value !== undefined) {
      // lru-cache get updates access order in O(1); re-add if evicted from tracker
      if (this.lruTracker.get(key) === undefined) {
        this.lruTracker.set(key, key);
      }
      logger.debug(`[Cache] HIT: ${key}`);
    } else {
      logger.debug(`[Cache] MISS: ${key}`);
    }
    return value;
  }

  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const effectiveTTL = stochasticTTL(ttl ?? DEFAULT_TTL);

    // LRU eviction: O(1) via lruTracker.pop() instead of O(N) Map scan
    this.lruTracker.set(key, key);
    if (this.localCache.keys().length >= MAX_CACHE_KEYS && !this.localCache.has(key)) {
      const poppedKey = this.lruTracker.pop();
      if (poppedKey !== undefined) {
        this.delInternal(poppedKey);
        logger.debug(`[Cache] LRU evicted: ${poppedKey}`);
      }
    }

    const success = this.localCache.set(key, value, effectiveTTL);

    if (success) {
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
    }

    logger.debug(`[Cache] SET: ${key} (TTL: ${effectiveTTL}s)`);
  }

  async del(key: string): Promise<void> {
    this.delInternal(key);
  }

  /**
   * 同步删除单个 key 并清理 tag/LRU 索引。
   * 返回被删除的条目数（0 或 1），与 NodeCache.del 行为一致。
   */
  private delInternal(key: string): number {
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
    this.lruTracker.delete(key);
    return this.localCache.del(key);
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
    this.localCache.flushAll();
    this.lruTracker.clear();
    this.tagIndex.clear();
    this.keyTags.clear();
  }

  async keys(): Promise<string[]> {
    return this.localCache.keys();
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
    const ttl = this.localCache.getTtl(key);
    if (ttl === undefined) return 0;
    return Math.max(0, ttl - Date.now());
  }

  async getStats(): Promise<CacheStats> {
    const stats = this.localCache.getStats();
    return {
      keys: this.localCache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
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
    return this.localCache.getTtl(key) ?? 0;
  }

  /**
   * 返回缓存统计信息（key 数、命中、未命中）。
   * 供 cacheService.getStats 向后兼容返回。
   */
  getStatsInternal(): { keys: number; hits: number; misses: number } {
    const stats = this.localCache.getStats();
    return {
      keys: this.localCache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
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
