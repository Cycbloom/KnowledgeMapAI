import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheService, CacheKeys } from '../../services/cache';

describe('Cache Service', () => {
  beforeEach(() => {
    cacheService.flush();
  });

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
