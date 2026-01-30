import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheService, CacheKeys } from './cache.js';

describe('Cache Service', () => {
  beforeEach(() => {
    cacheService.flush();
  });

  it('should set and get values', () => {
    const key = 'test_key';
    const value = { data: 'test' };
    
    cacheService.set(key, value);
    const retrieved = cacheService.get(key);
    
    expect(retrieved).toEqual(value);
  });

  it('should return undefined for missing keys', () => {
    const retrieved = cacheService.get('missing_key');
    expect(retrieved).toBeUndefined();
  });

  it('should delete values', () => {
    const key = 'test_key';
    cacheService.set(key, 'value');
    cacheService.del(key);
    expect(cacheService.get(key)).toBeUndefined();
  });

  it('should generate correct keys', () => {
    expect(CacheKeys.GRAPH_NODES('123')).toBe('graph_nodes_123');
    expect(CacheKeys.USER_GRAPHS('456')).toBe('user_graphs_456');
    expect(CacheKeys.STUDY_CARDS('789')).toBe('study_cards_789');
  });

  it('should delete by prefix', () => {
    cacheService.set('prefix_1', 'val1');
    cacheService.set('prefix_2', 'val2');
    cacheService.set('other_1', 'val3');

    cacheService.delByPrefix('prefix_');

    expect(cacheService.get('prefix_1')).toBeUndefined();
    expect(cacheService.get('prefix_2')).toBeUndefined();
    expect(cacheService.get('other_1')).toBe('val3');
  });
});
