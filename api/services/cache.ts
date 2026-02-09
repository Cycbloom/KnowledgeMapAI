import NodeCache from 'node-cache';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Determine mode: Use Redis if REDIS_URL is set, otherwise fallback to in-memory
const useRedis = !!process.env.REDIS_URL;

let redis: Redis | null = null;
let localCache: NodeCache | null = null;

if (useRedis) {
  console.log('🚀 Using Redis Cache');
  redis = new Redis(process.env.REDIS_URL!);
  redis.on('error', (err) => console.error('Redis Client Error', err));
} else {
  console.log('⚠️  Redis URL not found, using In-Memory Cache');
  localCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
}

export const CacheKeys = {
  GRAPH_NODES: (userId: string, graphId: string) => `graph_nodes_${userId}_${graphId}`,
  USER_GRAPHS: (userId: string) => `user_graphs_${userId}`,
  STUDY_CARDS: (graphId: string) => `study_cards_${graphId}`,
  TEMPLATES: (category: string) => `templates_${category}`,
  TEMPLATE: (id: string) => `template_${id}`,
  PROMPT_TEMPLATE: (code: string, userId: string = 'system', graphId: string = 'none') => `prompt_template_${code}_${userId}_${graphId}`,
};

export const cacheService = {
  get: async <T>(key: string): Promise<T | undefined> => {
    if (redis) {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : undefined;
    }
    return localCache?.get<T>(key);
  },

  set: async <T>(key: string, value: T, ttl?: number): Promise<boolean> => {
    if (redis) {
      const result = await redis.set(key, JSON.stringify(value), 'EX', ttl || 300);
      return result === 'OK';
    }
    return localCache?.set(key, value, ttl || 300) || false;
  },

  del: async (key: string | string[]): Promise<number> => {
    if (redis) {
      if (Array.isArray(key)) {
        if (key.length === 0) return 0;
        return await redis.del(...key);
      }
      return await redis.del(key);
    }
    return localCache?.del(key) || 0;
  },

  delByPrefix: async (prefix: string): Promise<number> => {
    if (redis) {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        return await redis.del(...keys);
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
    if (redis) {
      await redis.flushdb();
    } else {
      localCache?.flushAll();
    }
  },
  
  // Helper to get or set
  getOrSet: async <T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> => {
    const cached = await cacheService.get<T>(key);
    if (cached) {
      return cached;
    }

    const data = await fetchFn();
    await cacheService.set(key, data, ttl || 300);
    return data;
  }
};
