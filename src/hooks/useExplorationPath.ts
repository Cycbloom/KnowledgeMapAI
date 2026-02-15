import { useState, useCallback, useEffect } from 'react';
import { ExplorationPathItem } from '../types';
import { api } from '../services/api';

interface UseExplorationPathOptions {
  graphId?: string;
  initialPath?: ExplorationPathItem[];
}

export const useExplorationPath = (options: UseExplorationPathOptions = {}) => {
  const { graphId, initialPath = [] } = options;
  const [explorationPath, setExplorationPath] = useState<ExplorationPathItem[]>(initialPath);
  const [currentPathIndex, setCurrentPathIndex] = useState<number>(-1);
  const [isLoaded, setIsLoaded] = useState(false);

  const savePath = useCallback(async (path: ExplorationPathItem[]) => {
    if (!graphId) return;
    try {
      await api.graphs.update(graphId, {
        settings: {
          explorationPath: path
        }
      });
    } catch (error) {
      console.error('Failed to save exploration path:', error);
    }
  }, [graphId]);

  const loadPath = useCallback(async () => {
    if (!graphId) {
      setIsLoaded(true);
      return;
    }
    try {
      const graph = await api.graphs.get(graphId);
      const savedPath = graph?.settings?.explorationPath || [];
      const parsedPath = savedPath.map((item: any) => ({
        ...item,
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
      }));
      setExplorationPath(parsedPath);
      setCurrentPathIndex(parsedPath.length > 0 ? parsedPath.length - 1 : -1);
    } catch (error) {
      console.error('Failed to load exploration path:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [graphId]);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  const addToPath = useCallback((item: Omit<ExplorationPathItem, 'timestamp'>) => {
    const pathItem: ExplorationPathItem = {
      ...item,
      timestamp: new Date()
    };
    setExplorationPath(prev => {
      const newPath = [...prev, pathItem];
      savePath(newPath);
      return newPath;
    });
    setCurrentPathIndex(prev => prev + 1);
  }, [savePath]);

  const removeFromPath = useCallback((index: number) => {
    setExplorationPath(prev => {
      const newPath = prev.filter((_, i) => i !== index);
      savePath(newPath);
      return newPath;
    });
    if (index < currentPathIndex) {
      setCurrentPathIndex(prev => prev - 1);
    }
  }, [currentPathIndex, savePath]);

  const clearPath = useCallback(() => {
    setExplorationPath([]);
    setCurrentPathIndex(-1);
    savePath([]);
  }, [savePath]);

  const goToPathIndex = useCallback((index: number) => {
    if (index >= 0 && index < explorationPath.length) {
      setCurrentPathIndex(index);
    }
  }, [explorationPath.length]);

  const getCurrentPathItem = useCallback(() => {
    if (currentPathIndex >= 0 && currentPathIndex < explorationPath.length) {
      return explorationPath[currentPathIndex];
    }
    return null;
  }, [currentPathIndex, explorationPath]);

  const getRemainingPath = useCallback(() => {
    if (currentPathIndex >= 0) {
      return explorationPath.slice(currentPathIndex + 1);
    }
    return explorationPath;
  }, [currentPathIndex, explorationPath]);

  const canGoBack = useCallback(() => {
    return currentPathIndex > 0;
  }, [currentPathIndex]);

  const canGoForward = useCallback(() => {
    return currentPathIndex < explorationPath.length - 1;
  }, [currentPathIndex, explorationPath]);

  const goBack = useCallback(() => {
    if (canGoBack()) {
      setCurrentPathIndex(prev => prev - 1);
    }
  }, [canGoBack]);

  const goForward = useCallback(() => {
    if (canGoForward()) {
      setCurrentPathIndex(prev => prev + 1);
    }
  }, [canGoForward]);

  return {
    explorationPath,
    currentPathIndex,
    isLoaded,
    addToPath,
    removeFromPath,
    clearPath,
    goToPathIndex,
    getCurrentPathItem,
    getRemainingPath,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    loadPath
  };
};
