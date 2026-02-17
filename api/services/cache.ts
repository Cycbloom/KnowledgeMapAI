import NodeCache from 'node-cache';
import redisClient from '../utils/redis.js';
import { logger } from '../utils/logger.js';

const useRedis = !!redisClient;

let localCache: NodeCache | null = null;

if (!useRedis) {
  logger.warn('⚠️ Redis not available, using In-Memory Cache');
  localCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
}

export const CacheKeys = {
  GRAPH_NODES: (userId: string, graphId: string) => `graph_nodes_${userId}_${graphId}`,
  USER_GRAPHS: (userId: string) => `user_graphs_${userId}`,
  GRAPH: (graphId: string) => `graph_${graphId}`,
  STUDY_CARDS: (graphId: string) => `study_cards_${graphId}`,
  TEMPLATES: (category: string) => `templates_${category}`,
  TEMPLATE: (id: string) => `template_${id}`,
  PROMPT_TEMPLATE: (code: string, userId: string = 'system', graphId: string = 'none') => `prompt_template_${code}_${userId}_${graphId}`,
  AI_EXPAND: (title: string, level: string) => `ai_expand_${title}_${level}`,
  AI_CARDS: (topic: string, types: string[], count: number) => `ai_cards_${topic}_${types.sort().join('_')}_${count}`,
  LEARNING_PATH: (graphId: string) => `learning_path_${graphId}`,
};

const DEFAULT_TTL = 300;
const pendingRequests = new Map<string, Promise<unknown>>();

const stochasticTTL = (baseTTL: number): number => {
  const variance = baseTTL * 0.2;
  return Math.floor(baseTTL + (Math.random() * variance * 2 - variance));
};

export const cacheService = {
  get: async <T>(key: string): Promise<T | undefined> => {
    if (redisClient) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : undefined;
    }
    return localCache?.get<T>(key);
  },

  set: async <T>(key: string, value: T, ttl?: number): Promise<boolean> => {
    const effectiveTTL = stochasticTTL(ttl || DEFAULT_TTL);
    if (redisClient) {
      const result = await redisClient.set(key, JSON.stringify(value), 'EX', effectiveTTL);
      return result === 'OK';
    }
    return localCache?.set(key, value, effectiveTTL) || false;
  },

  del: async (key: string | string[]): Promise<number> => {
    if (redisClient) {
      if (Array.isArray(key)) {
        if (key.length === 0) return 0;
        return await redisClient.del(...key);
      }
      return await redisClient.del(key);
    }
    return localCache?.del(key) || 0;
  },

  delByPrefix: async (prefix: string): Promise<number> => {
    if (redisClient) {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length > 0) {
        return await redisClient.del(...keys);
      }
      return 0;
    }
    
    if (localCache) {
      const keys = localCache.keys();
      const keysToDelete = keys.filter(key => key.startsWith(prefix));
      if (keysToDelete.length > 0) {
        return localCache.del(keysToDelete);
      }
    }
    return 0;
  },

  flush: async (): Promise<void> => {
    if (redisClient) {
      await redisClient.flushdb();
    } else {
      localCache?.flushAll();
    }
  },
  
  getOrSet: async <T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> => {
    const cached = await cacheService.get<T>(key);
    if (cached) {
      return cached;
    }

    const pending = pendingRequests.get(key) as Promise<T> | undefined;
    if (pending) {
      return pending;
    }

    const fetchPromise = fetchFn();
    pendingRequests.set(key, fetchPromise);

    try {
      const data = await fetchPromise;
      await cacheService.set(key, data, ttl || DEFAULT_TTL);
      return data;
    } finally {
      pendingRequests.delete(key);
    }
  },

  warmup: async (keys: Array<{ key: string; fetchFn: () => Promise<unknown>; ttl?: number }>): Promise<void> => {
    logger.info(`Starting cache warmup for ${keys.length} keys...`);
    
    const results = await Promise.allSettled(
      keys.map(async ({ key, fetchFn, ttl }) => {
        const cached = await cacheService.get(key);
        if (!cached) {
          const data = await fetchFn();
          await cacheService.set(key, data, ttl || DEFAULT_TTL);
          return { key, status: 'warmed' };
        }
        return { key, status: 'already_cached' };
      })
    );

    const warmed = results.filter(r => r.status === 'fulfilled' && (r.value as { status: string }).status === 'warmed').length;
    const skipped = results.filter(r => r.status === 'fulfilled' && (r.value as { status: string }).status === 'already_cached').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    logger.info(`Cache warmup complete: ${warmed} warmed, ${skipped} skipped, ${failed} failed`);
  },

  getStats: async (): Promise<{
    keys: number;
    hits: number;
    misses: number;
    kps: number;
  }> => {
    if (redisClient) {
      const info = await redisClient.info('stats');
      const keysMatch = info.match(/keys=(\d+)/);
      const hitsMatch = info.match(/keyspace_hits=(\d+)/);
      const missesMatch = info.match(/keyspace_misses=(\d+)/);
      const kpsMatch = info.match(/instantaneous_ops_per_sec=(\d+)/);
      
      return {
        keys: keysMatch ? parseInt(keysMatch[1], 10) : 0,
        hits: hitsMatch ? parseInt(hitsMatch[1], 10) : 0,
        misses: missesMatch ? parseInt(missesMatch[1], 10) : 0,
        kps: kpsMatch ? parseInt(kpsMatch[1], 10) : 0,
      };
    }
    
    if (localCache) {
      const stats = localCache.getStats();
      return {
        keys: localCache.keys().length,
        hits: stats.hits,
        misses: stats.misses,
        kps: 0,
      };
    }
    
    return { keys: 0, hits: 0, misses: 0, kps: 0 };
  },
};
