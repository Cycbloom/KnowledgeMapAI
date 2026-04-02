interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class DataCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, Promise<unknown>>();
  private tagIndex = new Map<string, Set<string>>();
  private keyTags = new Map<string, Set<string>>();
  private hits = 0;
  private misses = 0;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000, tags?: string[]): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    
    if (tags && tags.length > 0) {
      const tagSet = new Set(tags);
      this.keyTags.set(key, tagSet);
      
      for (const tag of tagSet) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }
  }

  delete(key: string): boolean {
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
    
    return this.cache.delete(key);
  }
  
  deleteByTags(tags: string | string[]): number {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const keysToDelete = new Set<string>();
    
    for (const tag of tagList) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          keysToDelete.add(key);
        }
      }
    }
    
    let count = 0;
    for (const key of keysToDelete) {
      if (this.delete(key)) {
        count++;
      }
    }
    
    return count;
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
    this.tagIndex.clear();
    this.keyTags.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 5 * 60 * 1000,
    tags?: string[]
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
      this.set(key, data, ttl, tags);
      return data;
    } finally {
      this.pendingRequests.delete(key);
    }
  }

  getStats(): {
    size: number;
    keys: string[];
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hits: this.hits,
      misses: this.misses,
      hitRate: parseFloat(hitRate.toFixed(2)),
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
