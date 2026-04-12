import NodeCache from 'node-cache';
import redisClient, { isRedisAvailable } from '../../utils/redis';
import { logger } from '../../utils/logger';

const localCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const checkRedisAndLog = (): boolean => {
  if (isRedisAvailable && redisClient) {
    return true;
  }
  if (redisClient && !isRedisAvailable) {
    logger.debug('Redis not available, using in-memory cache');
  }
  return false;
};

if (checkRedisAndLog()) {
  logger.info('📦 Redis Cache initialized');
} else {
  logger.info('📦 In-Memory Cache initialized');
}

const tagIndex = new Map<string, Set<string>>();
const keyTags = new Map<string, Set<string>>();

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
  KNOWLEDGE_POINT: (id: string) => `knowledge_point_${id}`,
  USER_SETTINGS: (userId: string) => `user_settings_${userId}`,
};

const DEFAULT_TTL = 300;
const pendingRequests = new Map<string, Promise<unknown>>();

const scanKeys = async (pattern: string, maxKeys: number = 5000): Promise<string[]> => {
  if (!redisClient) return [];

  const keys: string[] = [];
  let cursor = '0';

  do {
    const result = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 1000);
    cursor = result[0];
    const batch = result[1] ?? [];
    keys.push(...batch);
  } while (cursor !== '0' && keys.length < maxKeys);

  if (keys.length > maxKeys) {
    return keys.slice(0, maxKeys);
  }

  return keys;
};

const stochasticTTL = (baseTTL: number): number => {
  const variance = baseTTL * 0.2;
  return Math.floor(baseTTL + (Math.random() * variance * 2 - variance));
};

export const cacheService = {
  get: async <T>(key: string): Promise<T | undefined> => {
    if (checkRedisAndLog()) {
      try {
        const data = await redisClient!.get(key);
        return data ? JSON.parse(data) : undefined;
      } catch (error) {
        logger.warn('Redis get failed, falling back to local cache:', error);
      }
    }
    return localCache.get<T>(key);
  },

  set: async <T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean> => {
    const effectiveTTL = stochasticTTL(ttl || DEFAULT_TTL);
    
    let success = false;
    if (checkRedisAndLog()) {
      try {
        const result = await redisClient!.set(key, JSON.stringify(value), 'EX', effectiveTTL);
        success = result === 'OK';
      } catch (error) {
        logger.warn('Redis set failed, falling back to local cache:', error);
      }
    }
    
    if (!success) {
      success = localCache.set(key, value, effectiveTTL);
    }
    
    if (success && tags && tags.length > 0) {
      const tagSet = new Set(tags);
      keyTags.set(key, tagSet);
      
      for (const tag of tagSet) {
        if (!tagIndex.has(tag)) {
          tagIndex.set(tag, new Set());
        }
        tagIndex.get(tag)!.add(key);
      }
    }
    
    return success;
  },

  del: async (key: string | string[]): Promise<number> => {
    const keys = Array.isArray(key) ? key : [key];
    
    for (const k of keys) {
      const tags = keyTags.get(k);
      if (tags) {
        for (const tag of tags) {
          const tagKeys = tagIndex.get(tag);
          if (tagKeys) {
            tagKeys.delete(k);
            if (tagKeys.size === 0) {
              tagIndex.delete(tag);
            }
          }
        }
        keyTags.delete(k);
      }
    }
    
    if (checkRedisAndLog()) {
      try {
        if (Array.isArray(key)) {
          if (key.length === 0) return 0;
          return await redisClient!.del(...key);
        }
        return await redisClient!.del(key);
      } catch (error) {
        logger.warn('Redis del failed, falling back to local cache:', error);
      }
    }
    
    return localCache.del(keys);
  },

  delByPrefix: async (prefix: string): Promise<number> => {
    if (checkRedisAndLog()) {
      try {
        const keys = await scanKeys(`${prefix}*`, 20000);
        if (keys.length > 0) {
          return await redisClient!.del(...keys);
        }
        return 0;
      } catch (error) {
        logger.warn('Redis delByPrefix failed, falling back to local cache:', error);
      }
    }
    
    const keys = localCache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(prefix));
    if (keysToDelete.length > 0) {
      return localCache.del(keysToDelete);
    }
    return 0;
  },

  flush: async (): Promise<void> => {
    if (checkRedisAndLog()) {
      try {
        await redisClient!.flushdb();
      } catch (error) {
        logger.warn('Redis flush failed, falling back to local cache:', error);
      }
    }
    localCache.flushAll();
    tagIndex.clear();
    keyTags.clear();
  },
  
  delByTags: async (tags: string | string[]): Promise<number> => {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const keysToDelete = new Set<string>();
    
    for (const tag of tagList) {
      const keys = tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          keysToDelete.add(key);
        }
      }
    }
    
    if (keysToDelete.size > 0) {
      return await cacheService.del(Array.from(keysToDelete));
    }
    
    return 0;
  },
  
  getOrSet: async <T>(key: string, fetchFn: () => Promise<T>, ttl?: number, tags?: string[]): Promise<T> => {
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
      await cacheService.set(key, data, ttl || DEFAULT_TTL, tags);
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
    if (checkRedisAndLog()) {
      try {
        const info = await redisClient!.info('stats');
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
      } catch (error) {
        logger.warn('Redis getStats failed, falling back to local cache stats:', error);
      }
    }
    
    const stats = localCache.getStats();
    return {
      keys: localCache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
      kps: 0,
    };
  },

  invalidateGraphCache: async (userId: string, graphId: string): Promise<void> => {
    const keys = [
      CacheKeys.GRAPH_NODES(userId, graphId),
      CacheKeys.GRAPH(graphId),
      CacheKeys.LEARNING_PATH(graphId),
      CacheKeys.STUDY_CARDS(graphId),
    ];
    await cacheService.del(keys);
  },

  invalidateUserGraphsCache: async (userId: string): Promise<void> => {
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
  },

  invalidateStudyCache: async (graphId: string): Promise<void> => {
    const keys = [
      CacheKeys.STUDY_CARDS(graphId),
      CacheKeys.LEARNING_PATH(graphId),
    ];
    await cacheService.del(keys);
  },
  
  invalidateByGraphId: async (graphId: string): Promise<void> => {
    await cacheService.delByTags([`graph:${graphId}`]);
  },
  
  invalidateByUserId: async (userId: string): Promise<void> => {
    await cacheService.delByTags([`user:${userId}`]);
  },
  
  invalidateByTemplateId: async (templateId: string): Promise<void> => {
    await cacheService.delByTags([`template:${templateId}`]);
  },
};
