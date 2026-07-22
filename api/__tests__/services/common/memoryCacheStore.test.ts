import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCacheStore } from '../../../services/common/cacheStore';

/**
 * MemoryCacheStore 单元测试。
 *
 * 覆盖：
 * - set/get 基本存取
 * - TTL 过期（vi.useFakeTimers）
 * - tag 索引 delByTags
 * - getOrSet 请求去重（并发同 key 只触发一次 fetchFn）
 * - LRU 淘汰（超过 MAX_CACHE_KEYS=1000 时淘汰）
 * - has/clear/keys
 */
describe('MemoryCacheStore', () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set/get 基本存取', () => {
    it('set 后 get 返回相同值', async () => {
      await store.set('key1', { name: 'alice' });
      const value = await store.get<{ name: string }>('key1');
      expect(value).toEqual({ name: 'alice' });
    });

    it('get 不存在的 key 返回 undefined', async () => {
      const value = await store.get('missing_key');
      expect(value).toBeUndefined();
    });

    it('set 原始类型值可正确存取', async () => {
      await store.set('str_key', 'hello');
      await store.set('num_key', 42);
      await store.set('bool_key', true);
      expect(await store.get<string>('str_key')).toBe('hello');
      expect(await store.get<number>('num_key')).toBe(42);
      expect(await store.get<boolean>('bool_key')).toBe(true);
    });

    it('set 覆盖已存在的 key', async () => {
      await store.set('key1', 'old');
      await store.set('key1', 'new');
      expect(await store.get<string>('key1')).toBe('new');
    });

    it('set 支持 falsy 值（0、false、空字符串、null）', async () => {
      await store.set('zero', 0);
      await store.set('false', false);
      await store.set('empty', '');
      await store.set('null', null);

      expect(await store.get<number>('zero')).toBe(0);
      expect(await store.get<boolean>('false')).toBe(false);
      expect(await store.get<string>('empty')).toBe('');
      expect(await store.get<null>('null')).toBeNull();
    });
  });

  describe('TTL 过期', () => {
    it('key 在 TTL 到期后返回 undefined', async () => {
      // lru-cache v11 在模块加载时捕获全局 performance 引用，vi.useFakeTimers
      // 会替换 performance 对象导致 spy 失效；且 lru-cache 用 ttlResolution(=1ms)
      // debounce 缓存 now 值。故用 spyOn 控制 performance.now，并在推进时间后
      // 等待 debounce 失效。
      const startPerf = 1_000_000;
      const perfSpy = vi.spyOn(performance, 'now');
      perfSpy.mockReturnValue(startPerf);

      await store.set('ttl_key', 'value', 100);
      expect(await store.get<string>('ttl_key')).toBe('value');

      // stochasticTTL 在 100s 上下浮动 ±20%（80~120s），推进 200s 确保过期
      perfSpy.mockReturnValue(startPerf + 200 * 1000);
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(await store.get<string>('ttl_key')).toBeUndefined();

      perfSpy.mockRestore();
    });

    it('未过期的 key 仍可读取', async () => {
      vi.useFakeTimers();

      await store.set('ttl_key', 'value', 100);

      // 推进 50s，仍在 TTL 范围内（80~120s）
      vi.advanceTimersByTime(50 * 1000);

      expect(await store.get<string>('ttl_key')).toBe('value');
    });

    it('使用默认 TTL 的 key 也会过期', async () => {
      // lru-cache v11 在模块加载时捕获全局 performance 引用，vi.useFakeTimers
      // 会替换 performance 对象导致 spy 失效；且 lru-cache 用 ttlResolution(=1ms)
      // debounce 缓存 now 值。故用 spyOn 控制 performance.now，并在推进时间后
      // 等待 debounce 失效。
      const startPerf = 1_000_000;
      const perfSpy = vi.spyOn(performance, 'now');
      perfSpy.mockReturnValue(startPerf);

      // 不传 ttl，使用 DEFAULT_TTL=300，stochasticTTL 范围 240~360s
      await store.set('default_ttl_key', 'value');

      // 推进 400s，超过最大方差
      perfSpy.mockReturnValue(startPerf + 400 * 1000);
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(await store.get<string>('default_ttl_key')).toBeUndefined();

      perfSpy.mockRestore();
    });
  });

  describe('tag 索引 delByTags', () => {
    it('set with tags 后 delByTags 删除关联 key', async () => {
      await store.set('key1', 'value1', 300, ['user:123', 'graph:456']);
      await store.set('key2', 'value2', 300, ['user:123']);
      await store.set('key3', 'value3', 300, ['graph:456']);

      await store.delByTags(['user:123']);

      expect(await store.get('key1')).toBeUndefined();
      expect(await store.get('key2')).toBeUndefined();
      expect(await store.get('key3')).toBe('value3');
    });

    it('delByTags 返回删除计数', async () => {
      await store.set('key1', 'value1', 300, ['user:123']);
      await store.set('key2', 'value2', 300, ['user:123']);
      await store.set('key3', 'value3', 300, ['graph:456']);

      const count = await store.delByTagsWithCount(['user:123']);
      expect(count).toBe(2);
    });

    it('delByTags 对无匹配 tag 返回 0', async () => {
      await store.set('key1', 'value1', 300, ['user:123']);
      const count = await store.delByTagsWithCount(['user:nonexistent']);
      expect(count).toBe(0);
      expect(await store.get('key1')).toBe('value1');
    });

    it('delByTags 支持多 tag 联合删除', async () => {
      await store.set('key1', 'value1', 300, ['user:1']);
      await store.set('key2', 'value2', 300, ['graph:2']);
      await store.set('key3', 'value3', 300, ['template:3']);

      await store.delByTags(['user:1', 'graph:2']);

      expect(await store.get('key1')).toBeUndefined();
      expect(await store.get('key2')).toBeUndefined();
      expect(await store.get('key3')).toBe('value3');
    });

    it('del 单个 key 后其 tag 索引被清理', async () => {
      await store.set('key1', 'value1', 300, ['user:123']);
      await store.del('key1');

      // 重新 set 同 key 不应残留旧 tag 关联
      await store.set('key1', 'value2', 300, ['user:456']);
      await store.delByTags(['user:123']);
      expect(await store.get('key1')).toBe('value2');
    });
  });

  describe('getOrSet 请求去重', () => {
    it('首次调用执行 fetchFn 并缓存结果', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fetched_value');

      const result = await store.getOrSet('key1', fetchFn, 300);

      expect(result).toBe('fetched_value');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('缓存命中时不调用 fetchFn', async () => {
      const fetchFn = vi.fn().mockResolvedValue('fetched_value');

      await store.getOrSet('key1', fetchFn, 300);
      const result = await store.getOrSet('key1', fetchFn, 300);

      expect(result).toBe('fetched_value');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('并发调用同一 key 时 fetchFn 只执行一次', async () => {
      const fetchFn = vi.fn().mockImplementation(async () => {
        // 模拟异步耗时，确保第二个调用进入时 pending 已存在
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'concurrent_value';
      });

      const [result1, result2] = await Promise.all([
        store.getOrSet('concurrent_key', fetchFn, 300),
        store.getOrSet('concurrent_key', fetchFn, 300),
      ]);

      expect(result1).toBe('concurrent_value');
      expect(result2).toBe('concurrent_value');
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('fetchFn 抛错后 pending 被清理，下次调用可重试', async () => {
      let callCount = 0;
      const fetchFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('first attempt failed');
        }
        return 'retry_value';
      });

      await expect(store.getOrSet('error_key', fetchFn, 300)).rejects.toThrow(
        'first attempt failed',
      );

      const result = await store.getOrSet('error_key', fetchFn, 300);
      expect(result).toBe('retry_value');
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('缓存 falsy 值（空数组）后不再调用 fetchFn', async () => {
      const fetchFn = vi.fn().mockResolvedValue([]);

      await store.getOrSet('empty_arr', fetchFn, 300);
      await store.getOrSet('empty_arr', fetchFn, 300);

      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('LRU 淘汰', () => {
    it('超过 MAX_CACHE_KEYS 时总 key 数不超过上限', async () => {
      // MAX_CACHE_KEYS = 5000 (defined in cacheStore.ts)
      const MAX_CACHE_KEYS = 5000;
      for (let i = 0; i < MAX_CACHE_KEYS; i++) {
        await store.set(`lru_key_${i}`, `value_${i}`, 300);
      }

      const keysBefore = await store.keys();
      expect(keysBefore.length).toBe(MAX_CACHE_KEYS);

      // 添加第 MAX_CACHE_KEYS+1 个 key，触发 LRU 淘汰
      await store.set('lru_overflow', 'overflow_value', 300);

      const keysAfter = await store.keys();
      expect(keysAfter.length).toBeLessThanOrEqual(MAX_CACHE_KEYS);
      expect(await store.get('lru_overflow')).toBe('overflow_value');
    });

    it('LRU 淘汰后新 key 可正常访问', async () => {
      const MAX_CACHE_KEYS = 5000;
      for (let i = 0; i < MAX_CACHE_KEYS; i++) {
        await store.set(`lru_key_${i}`, `value_${i}`, 300);
      }

      await store.set('new_key', 'new_value', 300);

      expect(await store.get('new_key')).toBe('new_value');
    });
  });

  describe('has', () => {
    it('存在的 key 返回 true', async () => {
      await store.set('exists', 'value');
      expect(await store.has('exists')).toBe(true);
    });

    it('不存在的 key 返回 false', async () => {
      expect(await store.has('not_exists')).toBe(false);
    });

    it('del 后 has 返回 false', async () => {
      await store.set('temp', 'value');
      expect(await store.has('temp')).toBe(true);
      await store.del('temp');
      expect(await store.has('temp')).toBe(false);
    });
  });

  describe('clear', () => {
    it('清空所有 key', async () => {
      await store.set('key1', 'value1');
      await store.set('key2', 'value2');
      await store.set('key3', 'value3', 300, ['tag1']);

      await store.clear();

      expect(await store.get('key1')).toBeUndefined();
      expect(await store.get('key2')).toBeUndefined();
      expect(await store.get('key3')).toBeUndefined();
      expect(await store.keys()).toEqual([]);
    });

    it('clear 后 tag 索引被重置', async () => {
      await store.set('key1', 'value1', 300, ['user:123']);
      await store.clear();

      // 重新 set 同 key，delByTags 旧 tag 不应影响
      await store.set('key1', 'value2', 300, ['user:456']);
      await store.delByTags(['user:123']);
      expect(await store.get('key1')).toBe('value2');
    });
  });

  describe('keys', () => {
    it('返回所有已设置的 key', async () => {
      await store.set('key1', 'value1');
      await store.set('key2', 'value2');
      await store.set('key3', 'value3');

      const keys = await store.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('空缓存返回空数组', async () => {
      const keys = await store.keys();
      expect(keys).toEqual([]);
    });

    it('del 后 keys 不再包含该 key', async () => {
      await store.set('key1', 'value1');
      await store.set('key2', 'value2');

      await store.del('key1');

      const keys = await store.keys();
      expect(keys).toEqual(['key2']);
    });
  });

  describe('del', () => {
    it('删除存在的 key', async () => {
      await store.set('key1', 'value1');
      await store.del('key1');
      expect(await store.get('key1')).toBeUndefined();
    });

    it('delMany 返回删除计数', async () => {
      await store.set('key1', 'value1');
      await store.set('key2', 'value2');
      await store.set('key3', 'value3');

      const count = await store.delMany(['key1', 'key2', 'key3']);
      expect(count).toBe(3);
    });

    it('delMany 对不存在的 key 不计入', async () => {
      await store.set('key1', 'value1');
      const count = await store.delMany(['key1', 'nonexistent']);
      expect(count).toBe(1);
    });
  });
});
