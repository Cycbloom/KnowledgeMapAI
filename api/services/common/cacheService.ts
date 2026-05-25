import NodeCache from 'node-cache';
import { logger } from '../../utils/logger';

const localCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

logger.info('📦 In-Memory Cache initialized');

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
  USER_FAVORITES: (userId: string) => `user_favorites_${userId}`,
  USER_RECENT_GRAPHS: (userId: string) => `user_recent_graphs_${userId}`,
  GRAPH_COLLABORATORS: (graphId: string) => `graph_collaborators_${graphId}`,
  CONCEPT_ANALYSIS: (graphId: string, jobId: string) => `concept_analysis_${graphId}_${jobId}`,
};

export const CacheTTL = {
  STATIC: 3600,
  DYNAMIC: 300,
  REALTIME: 60,
  SHORT: 120,
  MEDIUM: 600,
  LONG: 1800,
  VERY_LONG: 7200,
  TEMPLATES: 3600,
  USER_SETTINGS: 1800,
  GRAPH_METADATA: 600,
  GRAPH_NODES: 300,
  STUDY_DATA: 120,
  AI_RESULTS: 1800,
  LEARNING_PATH: 600,
};

const DEFAULT_TTL = CacheTTL.DYNAMIC;
const pendingRequests = new Map<string, Promise<unknown>>();
const lazyLoadQueue: Array<{ key: string; fetchFn: () => Promise<unknown>; ttl?: number }> = [];
let lazyLoadInterval: ReturnType<typeof setInterval> | null = null;

const stochasticTTL = (baseTTL: number): number => {
  const variance = baseTTL * 0.2;
  return Math.floor(baseTTL + (Math.random() * variance * 2 - variance));
};

const generateTags = (options?: { userId?: string; graphId?: string; templateId?: string }): string[] => {
  const tags: string[] = [];
  if (options?.userId) tags.push(`user:${options.userId}`);
  if (options?.graphId) tags.push(`graph:${options.graphId}`);
  if (options?.templateId) tags.push(`template:${options.templateId}`);
  return tags;
};

export const cacheService = {
  get: async <T>(key: string): Promise<T | undefined> => {
    const value = localCache.get<T>(key);
    if (value !== undefined) {
      logger.debug(`[Cache] HIT: ${key}`);
    } else {
      logger.debug(`[Cache] MISS: ${key}`);
    }
    return value;
  },

  set: async <T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<boolean> => {
    const effectiveTTL = stochasticTTL(ttl || DEFAULT_TTL);
    
    const success = localCache.set(key, value, effectiveTTL);
    
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
    
    logger.debug(`[Cache] SET: ${key} (TTL: ${effectiveTTL}s)`);
    return success;
  },

  setWithTags: async <T>(
    key: string,
    value: T,
    ttl: number,
    options?: { userId?: string; graphId?: string; templateId?: string }
  ): Promise<boolean> => {
    const tags = generateTags(options);
    return cacheService.set(key, value, ttl, tags);
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
    
    return localCache.del(keys);
  },

  delByPrefix: async (prefix: string): Promise<number> => {
    const keys = localCache.keys();
    const keysToDelete = keys.filter(key => key.startsWith(prefix));
    if (keysToDelete.length > 0) {
      return localCache.del(keysToDelete);
    }
    return 0;
  },

  flush: async (): Promise<void> => {
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

  warmupUserData: async (
    userId: string,
    fetchFns: {
      getUserGraphs: () => Promise<unknown>;
      getUserSettings: () => Promise<unknown>;
      getUserFavorites?: () => Promise<unknown>;
    }
  ): Promise<void> => {
    logger.info(`[Cache] Starting user data warmup for user ${userId}`);
    
    const warmupTasks: Array<{ key: string; fetchFn: () => Promise<unknown>; ttl: number }> = [
      { key: CacheKeys.USER_GRAPHS(userId), fetchFn: fetchFns.getUserGraphs, ttl: CacheTTL.DYNAMIC },
      { key: CacheKeys.USER_SETTINGS(userId), fetchFn: fetchFns.getUserSettings, ttl: CacheTTL.USER_SETTINGS },
    ];

    if (fetchFns.getUserFavorites) {
      warmupTasks.push({
        key: CacheKeys.USER_FAVORITES(userId),
        fetchFn: fetchFns.getUserFavorites,
        ttl: CacheTTL.DYNAMIC,
      });
    }

    await cacheService.warmup(warmupTasks);
    logger.info(`[Cache] User data warmup complete for user ${userId}`);
  },

  queueLazyLoad: (key: string, fetchFn: () => Promise<unknown>, ttl?: number): void => {
    if (!lazyLoadQueue.find(item => item.key === key)) {
      lazyLoadQueue.push({ key, fetchFn, ttl });
      logger.debug(`[Cache] Queued lazy load for key: ${key}`);
    }
  },

  startLazyLoadProcessor: (intervalMs: number = 5000): void => {
    if (lazyLoadInterval) {
      logger.warn('[Cache] Lazy load processor already running');
      return;
    }

    lazyLoadInterval = setInterval(async () => {
      if (lazyLoadQueue.length === 0) return;

      const batch = lazyLoadQueue.splice(0, 5);
      logger.debug(`[Cache] Processing ${batch.length} lazy load items`);

      for (const item of batch) {
        try {
          const cached = await cacheService.get(item.key);
          if (!cached) {
            const data = await item.fetchFn();
            await cacheService.set(item.key, data, item.ttl || DEFAULT_TTL);
          }
        } catch (error) {
          logger.warn(`[Cache] Lazy load failed for key ${item.key}:`, error);
        }
      }
    }, intervalMs);

    logger.info(`[Cache] Lazy load processor started (interval: ${intervalMs}ms)`);
  },

  stopLazyLoadProcessor: (): void => {
    if (lazyLoadInterval) {
      clearInterval(lazyLoadInterval);
      lazyLoadInterval = null;
      logger.info('[Cache] Lazy load processor stopped');
    }
  },

  backgroundRefresh: async <T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<void> => {
    try {
      const data = await fetchFn();
      await cacheService.set(key, data, ttl || DEFAULT_TTL);
      logger.debug(`[Cache] Background refresh complete for key: ${key}`);
    } catch (error) {
      logger.warn(`[Cache] Background refresh failed for key ${key}:`, error);
    }
  },

  getOrSetWithRefresh: async <T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number,
    refreshThreshold: number = 0.8
  ): Promise<T> => {
    const cached = await cacheService.get<T>(key);
    if (cached !== undefined) {
      const ttlRemaining = localCache.getTtl(key);
      const ttlTotal = ttl * 1000;
      
      if (ttlRemaining && (ttlRemaining - Date.now()) < ttlTotal * refreshThreshold) {
        cacheService.backgroundRefresh(key, fetchFn, ttl).catch(() => {});
      }
      
      return cached;
    }

    return cacheService.getOrSet(key, fetchFn, ttl);
  },

  getStats: async (): Promise<{
    keys: number;
    hits: number;
    misses: number;
    kps: number;
  }> => {
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
      CacheKeys.GRAPH_COLLABORATORS(graphId),
    ];
    const deleted = await cacheService.del(keys);
    logger.debug(`[Cache] Invalidated graph cache for user ${userId}, graph ${graphId}: ${deleted} keys deleted`);
  },

  invalidateUserGraphsCache: async (userId: string): Promise<void> => {
    const keys = [
      CacheKeys.USER_GRAPHS(userId),
      CacheKeys.USER_FAVORITES(userId),
      CacheKeys.USER_RECENT_GRAPHS(userId),
    ];
    const deleted = await cacheService.del(keys);
    logger.debug(`[Cache] Invalidated user graphs cache for user ${userId}: ${deleted} keys deleted`);
  },

  invalidateStudyCache: async (graphId: string): Promise<void> => {
    const keys = [
      CacheKeys.STUDY_CARDS(graphId),
      CacheKeys.LEARNING_PATH(graphId),
    ];
    const deleted = await cacheService.del(keys);
    logger.debug(`[Cache] Invalidated study cache for graph ${graphId}: ${deleted} keys deleted`);
  },
  
  invalidateByGraphId: async (graphId: string): Promise<void> => {
    const deleted = await cacheService.delByTags([`graph:${graphId}`]);
    logger.debug(`[Cache] Invalidated cache by graph ID ${graphId}: ${deleted} keys deleted`);
  },
  
  invalidateByUserId: async (userId: string): Promise<void> => {
    const deleted = await cacheService.delByTags([`user:${userId}`]);
    logger.debug(`[Cache] Invalidated cache by user ID ${userId}: ${deleted} keys deleted`);
  },
  
  invalidateByTemplateId: async (templateId: string): Promise<void> => {
    const deleted = await cacheService.delByTags([`template:${templateId}`]);
    logger.debug(`[Cache] Invalidated cache by template ID ${templateId}: ${deleted} keys deleted`);
  },

  invalidateAllGraphRelated: async (userId: string, graphId: string): Promise<void> => {
    await Promise.all([
      cacheService.invalidateGraphCache(userId, graphId),
      cacheService.invalidateUserGraphsCache(userId),
      cacheService.invalidateByGraphId(graphId),
    ]);
    logger.info(`[Cache] Invalidated all graph-related cache for user ${userId}, graph ${graphId}`);
  },

  invalidateUserSession: async (userId: string): Promise<void> => {
    await Promise.all([
      cacheService.invalidateByUserId(userId),
      cacheService.del(CacheKeys.USER_SETTINGS(userId)),
    ]);
    logger.info(`[Cache] Invalidated user session cache for user ${userId}`);
  },

  getCacheHealth: async (): Promise<{
    totalKeys: number;
    hitRate: number;
    tagCount: number;
    pendingRequests: number;
    lazyLoadQueueSize: number;
  }> => {
    const stats = await cacheService.getStats();
    const totalRequests = stats.hits + stats.misses;
    
    return {
      totalKeys: stats.keys,
      hitRate: totalRequests > 0 ? stats.hits / totalRequests : 0,
      tagCount: tagIndex.size,
      pendingRequests: pendingRequests.size,
      lazyLoadQueueSize: lazyLoadQueue.length,
    };
  },
};
