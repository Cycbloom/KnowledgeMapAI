import NodeCache from 'node-cache';
import redisClient from '../utils/redis.js';
import { logger } from '../utils/logger.js';

// Determine mode: Use Redis if client exists
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

export const cacheService = {
  get: async <T>(key: string): Promise<T | undefined> => {
    if (redisClient) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : undefined;
    }
    return localCache?.get<T>(key);
  },

  set: async <T>(key: string, value: T, ttl?: number): Promise<boolean> => {
    if (redisClient) {
      const result = await redisClient.set(key, JSON.stringify(value), 'EX', ttl || 300);
      return result === 'OK';
    }
    return localCache?.set(key, value, ttl || 300) || false;
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
