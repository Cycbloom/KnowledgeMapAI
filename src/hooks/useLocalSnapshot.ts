import { useCallback } from 'react';
import { Node, Edge } from '../types';

const SNAPSHOT_PREFIX = 'km_snapshot_';

interface GraphSnapshot {
  timestamp: number;
  graphId: string;
  nodes: Node[];
  edges: Edge[];
}

export const useLocalSnapshot = (graphId: string) => {
  const saveSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    const key = `${SNAPSHOT_PREFIX}${graphId}`;
    try {
      const snapshot: GraphSnapshot = {
        timestamp: Date.now(),
        graphId,
        nodes,
        edges
      };
      localStorage.setItem(key, JSON.stringify(snapshot));
      return true;
    } catch (e) {
      console.error('Failed to save snapshot', e);
      return false;
    }
  }, [graphId]);

  const getSnapshot = useCallback((): GraphSnapshot | null => {
    const key = `${SNAPSHOT_PREFIX}${graphId}`;
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;
      return JSON.parse(item);
    } catch {
      return null;
    }
  }, [graphId]);

  const clearSnapshot = useCallback(() => {
    const key = `${SNAPSHOT_PREFIX}${graphId}`;
    localStorage.removeItem(key);
  }, [graphId]);

  const hasSnapshot = useCallback(() => {
    const key = `${SNAPSHOT_PREFIX}${graphId}`;
    return !!localStorage.getItem(key);
  }, [graphId]);

  return {
    saveSnapshot,
    getSnapshot,
    clearSnapshot,
    hasSnapshot
  };
};
