import { useState, useCallback } from 'react';
import { Node, Edge } from '../types';

const SNAPSHOT_PREFIX = 'km_snapshot_';

interface GraphSnapshot {
  timestamp: number;
  graphId: string;
  nodes: Node[];
  edges: Edge[];
}

export const useLocalSnapshot = (graphId: string) => {
  const getKey = () => `${SNAPSHOT_PREFIX}${graphId}`;

  const saveSnapshot = useCallback((nodes: Node[], edges: Edge[]) => {
    try {
      const snapshot: GraphSnapshot = {
        timestamp: Date.now(),
        graphId,
        nodes,
        edges
      };
      localStorage.setItem(getKey(), JSON.stringify(snapshot));
      return true;
    } catch (e) {
      console.error('Failed to save snapshot', e);
      return false;
    }
  }, [graphId]);

  const getSnapshot = useCallback((): GraphSnapshot | null => {
    try {
      const item = localStorage.getItem(getKey());
      if (!item) return null;
      return JSON.parse(item);
    } catch (e) {
      return null;
    }
  }, [graphId]);

  const clearSnapshot = useCallback(() => {
    localStorage.removeItem(getKey());
  }, [graphId]);

  const hasSnapshot = useCallback(() => {
    return !!localStorage.getItem(getKey());
  }, [graphId]);

  return {
    saveSnapshot,
    getSnapshot,
    clearSnapshot,
    hasSnapshot
  };
};
