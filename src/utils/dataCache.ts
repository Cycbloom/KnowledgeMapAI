interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 5 * 60 * 1000
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
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
      this.set(key, data, ttl);
      return data;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  getStats(): {
    size: number;
    keys: string[];
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: 0,
    };
  }
}

export const dataCache = new DataCache();

export const CacheKeys = {
  GRAPH: (id: string) => `graph:${id}`,
  GRAPH_NODES: (id: string) => `graph:${id}:nodes`,
  GRAPH_EDGES: (id: string) => `graph:${id}:edges`,
  USER_PROFILE: (id: string) => `user:${id}:profile`,
  USER_GRAPHS: (id: string) => `user:${id}:graphs`,
  TEMPLATES: () => 'templates:all',
  TEMPLATE: (id: string) => `template:${id}`,
  STUDY_CARDS: (graphId: string) => `study:${graphId}:cards`,
  LEARNING_PATH: (graphId: string) => `learning:${graphId}:path`,
};

export const useCacheInvalidation = () => {
  const invalidateGraph = (graphId: string) => {
    dataCache.deleteByPrefix(`graph:${graphId}`);
    dataCache.delete(CacheKeys.STUDY_CARDS(graphId));
    dataCache.delete(CacheKeys.LEARNING_PATH(graphId));
  };

  const invalidateUser = (userId: string) => {
    dataCache.deleteByPrefix(`user:${userId}`);
  };

  const invalidateAll = () => {
    dataCache.clear();
  };

  return {
    invalidateGraph,
    invalidateUser,
    invalidateAll,
  };
};

export const createCachedQuery = <T>(
  keyFn: (...args: unknown[]) => string,
  queryFn: (...args: unknown[]) => Promise<T>,
  ttl: number = 5 * 60 * 1000
) => {
  return async (...args: unknown[]): Promise<T> => {
    const key = keyFn(...args);
    return dataCache.getOrFetch(key, () => queryFn(...args), ttl);
  };
};
