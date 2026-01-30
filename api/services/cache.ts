import NodeCache from 'node-cache';

// Standard TTL 5 minutes, check for expired keys every 1 minute
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const CacheKeys = {
  GRAPH_NODES: (graphId: string) => `graph_nodes_${graphId}`,
  USER_GRAPHS: (userId: string) => `user_graphs_${userId}`,
  STUDY_CARDS: (graphId: string) => `study_cards_${graphId}`,
};

export const cacheService = {
  get: <T>(key: string): T | undefined => {
    return cache.get<T>(key);
  },

  set: <T>(key: string, value: T, ttl?: number): boolean => {
    return cache.set(key, value, ttl || 300);
  },

  del: (key: string | string[]): number => {
    return cache.del(key);
  },

  delByPrefix: (prefix: string): number => {
    const keys = cache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(prefix));
    if (keysToDelete.length > 0) {
      return cache.del(keysToDelete);
    }
    return 0;
  },

  flush: (): void => {
    cache.flushAll();
  },
  
  // Helper to get or set
  getOrSet: async <T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> => {
    const cached = cache.get<T>(key);
    if (cached) {
      return cached;
    }

    const data = await fetchFn();
    cache.set(key, data, ttl || 300);
    return data;
  }
};
