import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCloudOnlyResource } from '../localClient';

describe('localClient', () => {
  describe('isCloudOnlyResource', () => {
    it('should identify cloud-only resources', () => {
      expect(isCloudOnlyResource('ai')).toBe(true);
      expect(isCloudOnlyResource('rag')).toBe(true);
      expect(isCloudOnlyResource('search')).toBe(true);
      expect(isCloudOnlyResource('agent')).toBe(true);
      expect(isCloudOnlyResource('embeddings')).toBe(true);
      expect(isCloudOnlyResource('literature')).toBe(true);
      expect(isCloudOnlyResource('auto_graph')).toBe(true);
      expect(isCloudOnlyResource('story')).toBe(true);
      expect(isCloudOnlyResource('podcast')).toBe(true);
    });

    it('should not flag local-capable resources', () => {
      expect(isCloudOnlyResource('graphs')).toBe(false);
      expect(isCloudOnlyResource('nodes')).toBe(false);
      expect(isCloudOnlyResource('edges')).toBe(false);
      expect(isCloudOnlyResource('study')).toBe(false);
      expect(isCloudOnlyResource('tasks')).toBe(false);
    });
  });

  describe('localQuery', () => {
    it('should return null when electronAPI is not available', async () => {
      // In test environment, window.electronAPI is not available
      const { localQuery } = await import('../localClient');
      const result = await localQuery({ resource: 'graphs', method: 'findAll', params: {} });
      expect(result).toBeNull();
    });
  });

  describe('isLocalDbAvailable', () => {
    it('should return false when not in Electron', async () => {
      const { isLocalDbAvailable } = await import('../localClient');
      const available = await isLocalDbAvailable();
      expect(available).toBe(false);
    });
  });
});
