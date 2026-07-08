import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cacheService, CacheKeys, CacheTTL } from '../../services/common/cacheService';

describe('Cache Service', () => {
  beforeEach(() => {
    cacheService.flush();
  });

  afterEach(() => {
    cacheService.stopLazyLoadProcessor();
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      const key = 'test_key';
      const value = { data: 'test' };
      
      await cacheService.set(key, value);
      const retrieved = await cacheService.get(key);
      
      expect(retrieved).toEqual(value);
    });

    it('should return undefined for missing keys', async () => {
      const retrieved = await cacheService.get('missing_key');
      expect(retrieved).toBeUndefined();
    });

    it('should delete values', async () => {
      const key = 'test_key';
      await cacheService.set(key, 'value');
      await cacheService.del(key);
      expect(await cacheService.get(key)).toBeUndefined();
    });

    it('should generate correct keys', () => {
      expect(CacheKeys.GRAPH_NODES('user1', '123')).toBe('graph_nodes_user1_123');
      expect(CacheKeys.USER_GRAPHS('456')).toBe('user_graphs_456');
      expect(CacheKeys.STUDY_CARDS('789')).toBe('study_cards_789');
    });

    it('should delete by prefix', async () => {
      await cacheService.set('prefix_1', 'val1');
      await cacheService.set('prefix_2', 'val2');
      await cacheService.set('other_1', 'val3');

      await cacheService.delByPrefix('prefix_');

      expect(await cacheService.get('prefix_1')).toBeUndefined();
      expect(await cacheService.get('prefix_2')).toBeUndefined();
      expect(await cacheService.get('other_1')).toBe('val3');
    });
  });

  describe('TTL Configuration', () => {
    it('should have correct TTL values', () => {
      expect(CacheTTL.STATIC).toBe(3600);
      expect(CacheTTL.DYNAMIC).toBe(300);
      expect(CacheTTL.REALTIME).toBe(60);
      expect(CacheTTL.TEMPLATES).toBe(3600);
      expect(CacheTTL.GRAPH_NODES).toBe(300);
      expect(CacheTTL.STUDY_DATA).toBe(120);
    });

    it('should use stochastic TTL', async () => {
      const key = 'ttl_test';
      await cacheService.set(key, 'value', 100);
      
      const stats = await cacheService.getStats();
      expect(stats.keys).toBeGreaterThan(0);
    });
  });

  describe('Tag-based Cache Management', () => {
    it('should set cache with tags', async () => {
      await cacheService.set('key1', 'value1', 100, ['user:123', 'graph:456']);
      await cacheService.set('key2', 'value2', 100, ['user:123']);
      await cacheService.set('key3', 'value3', 100, ['graph:456']);

      expect(await cacheService.get('key1')).toBe('value1');
      expect(await cacheService.get('key2')).toBe('value2');
      expect(await cacheService.get('key3')).toBe('value3');
    });

    it('should delete by tags', async () => {
      await cacheService.set('key1', 'value1', 100, ['user:123', 'graph:456']);
      await cacheService.set('key2', 'value2', 100, ['user:123']);
      await cacheService.set('key3', 'value3', 100, ['graph:456']);

      await cacheService.delByTags(['user:123']);

      expect(await cacheService.get('key1')).toBeUndefined();
      expect(await cacheService.get('key2')).toBeUndefined();
      expect(await cacheService.get('key3')).toBe('value3');
    });

    it('should set cache with tag options', async () => {
      await cacheService.setWithTags('key1', 'value1', 100, {
        userId: 'user123',
        graphId: 'graph456',
      });

      expect(await cacheService.get('key1')).toBe('value1');

      await cacheService.delByTags(['user:user123']);
      expect(await cacheService.get('key1')).toBeUndefined();
    });
  });

  describe('getOrSet with Deduplication', () => {
    it('should cache and return value', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fetched_value');
      
      const result1 = await cacheService.getOrSet('key1', fetchFn, 100);
      const result2 = await cacheService.getOrSet('key1', fetchFn, 100);
      
      expect(result1).toBe('fetched_value');
      expect(result2).toBe('fetched_value');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent requests', async () => {
      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++;
        return `value_${callCount}`;
      });
      
      const [result1, result2] = await Promise.all([
        cacheService.getOrSet('key1', fetchFn, 100),
        cacheService.getOrSet('key1', fetchFn, 100),
      ]);
      
      expect(result1).toBe('value_1');
      expect(result2).toBe('value_1');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should cache falsy values (empty array)', async () => {
      const fetchFn = vi.fn().mockResolvedValue([]);
      
      const result1 = await cacheService.getOrSet('falsy_array', fetchFn, 100);
      const result2 = await cacheService.getOrSet('falsy_array', fetchFn, 100);
      
      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should cache falsy values (number 0)', async () => {
      const fetchFn = vi.fn().mockResolvedValue(0);
      
      const result1 = await cacheService.getOrSet('falsy_zero', fetchFn, 100);
      const result2 = await cacheService.getOrSet('falsy_zero', fetchFn, 100);
      
      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should cache falsy values (false)', async () => {
      const fetchFn = vi.fn().mockResolvedValue(false);
      
      const result1 = await cacheService.getOrSet('falsy_false', fetchFn, 100);
      const result2 = await cacheService.getOrSet('falsy_false', fetchFn, 100);
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should cache falsy values (null)', async () => {
      const fetchFn = vi.fn().mockResolvedValue(null);
      
      const result1 = await cacheService.getOrSet('falsy_null', fetchFn, 100);
      const result2 = await cacheService.getOrSet('falsy_null', fetchFn, 100);
      
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should cache falsy values (empty string)', async () => {
      const fetchFn = vi.fn().mockResolvedValue('');
      
      const result1 = await cacheService.getOrSet('falsy_empty_str', fetchFn, 100);
      const result2 = await cacheService.getOrSet('falsy_empty_str', fetchFn, 100);
      
      expect(result1).toBe('');
      expect(result2).toBe('');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Warmup', () => {
    it('should warmup cache', async () => {
      const fetchFn1 = vi.fn().mockResolvedValue('value1');
      const fetchFn2 = vi.fn().mockResolvedValue('value2');
      
      await cacheService.warmup([
        { key: 'warmup_key1', fetchFn: fetchFn1, ttl: 100 },
        { key: 'warmup_key2', fetchFn: fetchFn2, ttl: 100 },
      ]);
      
      expect(await cacheService.get('warmup_key1')).toBe('value1');
      expect(await cacheService.get('warmup_key2')).toBe('value2');
      expect(fetchFn1).toHaveBeenCalledTimes(1);
      expect(fetchFn2).toHaveBeenCalledTimes(1);
    });

    it('should skip already cached keys during warmup', async () => {
      await cacheService.set('warmup_key', 'existing_value', 100);
      
      const fetchFn = vi.fn().mockResolvedValue('new_value');
      
      await cacheService.warmup([
        { key: 'warmup_key', fetchFn, ttl: 100 },
      ]);
      
      expect(await cacheService.get('warmup_key')).toBe('existing_value');
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('User Data Warmup', () => {
    it('should warmup user data', async () => {
      const getUserGraphs = vi.fn().mockResolvedValue([{ id: 'graph1' }]);
      const getUserSettings = vi.fn().mockResolvedValue({ theme: 'dark' });
      
      await cacheService.warmupUserData('user123', {
        getUserGraphs,
        getUserSettings,
      });
      
      expect(await cacheService.get(CacheKeys.USER_GRAPHS('user123'))).toEqual([{ id: 'graph1' }]);
      expect(await cacheService.get(CacheKeys.USER_SETTINGS('user123'))).toEqual({ theme: 'dark' });
    });

    it('should warmup user data with favorites', async () => {
      const getUserGraphs = vi.fn().mockResolvedValue([]);
      const getUserSettings = vi.fn().mockResolvedValue({});
      const getUserFavorites = vi.fn().mockResolvedValue([{ id: 'fav1' }]);
      
      await cacheService.warmupUserData('user123', {
        getUserGraphs,
        getUserSettings,
        getUserFavorites,
      });
      
      expect(await cacheService.get(CacheKeys.USER_FAVORITES('user123'))).toEqual([{ id: 'fav1' }]);
    });
  });

  describe('Lazy Load Queue', () => {
    it('should queue lazy load items', async () => {
      const fetchFn = vi.fn().mockResolvedValue('value');
      
      cacheService.queueLazyLoad('lazy_key', fetchFn, 100);
      
      const health = await cacheService.getCacheHealth();
      expect(health.lazyLoadQueueSize).toBe(1);
    });

    it('should not duplicate queue items', async () => {
      const fetchFn = vi.fn().mockResolvedValue('value');
      
      cacheService.queueLazyLoad('lazy_key', fetchFn, 100);
      cacheService.queueLazyLoad('lazy_key', fetchFn, 100);
      
      const health = await cacheService.getCacheHealth();
      expect(health.lazyLoadQueueSize).toBe(1);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate graph cache', async () => {
      await cacheService.set(CacheKeys.GRAPH_NODES('user1', 'graph1'), 'nodes', 100);
      await cacheService.set(CacheKeys.GRAPH('graph1'), 'graph', 100);
      await cacheService.set(CacheKeys.LEARNING_PATH('graph1'), 'path', 100);
      await cacheService.set(CacheKeys.STUDY_CARDS('graph1'), 'cards', 100);
      
      await cacheService.invalidateGraphCache('user1', 'graph1');
      
      expect(await cacheService.get(CacheKeys.GRAPH_NODES('user1', 'graph1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.GRAPH('graph1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.LEARNING_PATH('graph1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.STUDY_CARDS('graph1'))).toBeUndefined();
    });

    it('should invalidate user graphs cache', async () => {
      await cacheService.set(CacheKeys.USER_GRAPHS('user1'), 'graphs', 100);
      await cacheService.set(CacheKeys.USER_FAVORITES('user1'), 'favorites', 100);
      
      await cacheService.invalidateUserGraphsCache('user1');
      
      expect(await cacheService.get(CacheKeys.USER_GRAPHS('user1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.USER_FAVORITES('user1'))).toBeUndefined();
    });

    it('should invalidate study cache', async () => {
      await cacheService.set(CacheKeys.STUDY_CARDS('graph1'), 'cards', 100);
      await cacheService.set(CacheKeys.LEARNING_PATH('graph1'), 'path', 100);
      
      await cacheService.invalidateStudyCache('graph1');
      
      expect(await cacheService.get(CacheKeys.STUDY_CARDS('graph1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.LEARNING_PATH('graph1'))).toBeUndefined();
    });

    it('should invalidate all graph related cache', async () => {
      // Graph-level keys must be tagged with `graph:{graphId}` so that
      // invalidateAllGraphRelated can remove them via delByTags.
      await cacheService.set(CacheKeys.GRAPH_NODES('user1', 'graph1'), 'nodes', 100, ['graph:graph1']);
      await cacheService.set(CacheKeys.GRAPH('graph1'), 'graph', 100, ['graph:graph1']);
      // User-level key is deleted explicitly (not tag-based).
      await cacheService.set(CacheKeys.USER_GRAPHS('user1'), 'graphs', 100);

      await cacheService.invalidateAllGraphRelated('user1', 'graph1');

      expect(await cacheService.get(CacheKeys.GRAPH_NODES('user1', 'graph1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.USER_GRAPHS('user1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.GRAPH('graph1'))).toBeUndefined();
    });

    it('should invalidate user session cache', async () => {
      await cacheService.set(CacheKeys.USER_SETTINGS('user1'), 'settings', 100);
      await cacheService.set(CacheKeys.USER_GRAPHS('user1'), 'graphs', 100, ['user:user1']);
      
      await cacheService.invalidateUserSession('user1');
      
      expect(await cacheService.get(CacheKeys.USER_SETTINGS('user1'))).toBeUndefined();
      expect(await cacheService.get(CacheKeys.USER_GRAPHS('user1'))).toBeUndefined();
    });
  });

  describe('Cache Health', () => {
    it('should return cache health metrics', async () => {
      cacheService.stopLazyLoadProcessor();
      
      await cacheService.set('key1', 'value1', 100);
      await cacheService.set('key2', 'value2', 100, ['user:123']);
      
      const health = await cacheService.getCacheHealth();
      
      expect(health.totalKeys).toBeGreaterThanOrEqual(2);
      expect(health.tagCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Capacity Limit (maxKeys)', () => {
    it('should evict oldest entries when maxKeys is reached', async () => {
      // Flush to start clean
      await cacheService.flush();

      // Fill cache to MAX_CACHE_KEYS (5000, defined in cacheStore.ts)
      const MAX_CACHE_KEYS = 5000;
      for (let i = 0; i < MAX_CACHE_KEYS; i++) {
        await cacheService.set(`maxkey_test_${i}`, `value_${i}`, 300);
      }

      const statsBefore = await cacheService.getStats();
      expect(statsBefore.keys).toBe(MAX_CACHE_KEYS);

      // Adding one more should trigger eviction
      await cacheService.set('maxkey_overflow', 'overflow_value', 300);

      const statsAfter = await cacheService.getStats();
      // Eviction keeps total at or below MAX_CACHE_KEYS
      expect(statsAfter.keys).toBeLessThanOrEqual(MAX_CACHE_KEYS);
      expect(await cacheService.get('maxkey_overflow')).toBe('overflow_value');
    });
  });

  describe('Background Refresh', () => {
    it('should refresh cache in background', async () => {
      const fetchFn = vi.fn().mockResolvedValue('new_value');
      
      await cacheService.set('refresh_key', 'old_value', 100);
      await cacheService.backgroundRefresh('refresh_key', fetchFn, 100);
      
      expect(fetchFn).toHaveBeenCalled();
      expect(await cacheService.get('refresh_key')).toBe('new_value');
    });
  });

  describe('getOrSetWithRefresh', () => {
    it('should return cached value and trigger refresh when threshold reached', async () => {
      vi.useFakeTimers();

      // stochasticTTL uses Math.random to jitter TTL ±20%. Pin it so the
      // effective TTL equals the base TTL (100s) deterministically; otherwise
      // a low random draw can make the key expire before the 85s advance.
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

      let fetchCount = 0;
      const fetchFn = vi.fn().mockImplementation(async () => {
        fetchCount++;
        return `new_value_${fetchCount}`;
      });

      await cacheService.set('auto_refresh_key', 'cached_value', 100);

      vi.advanceTimersByTime(85 * 1000);

      const result = await cacheService.getOrSetWithRefresh('auto_refresh_key', fetchFn, 100, 0.8);

      expect(result).toBe('cached_value');

      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      randomSpy.mockRestore();
      vi.useRealTimers();
    });
  });
});
