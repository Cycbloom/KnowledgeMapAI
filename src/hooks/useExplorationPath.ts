import { useState, useCallback } from 'react';
import { ExplorationPathItem } from '../types';

export const useExplorationPath = () => {
  const [explorationPath, setExplorationPath] = useState<ExplorationPathItem[]>([]);
  const [currentPathIndex, setCurrentPathIndex] = useState<number>(-1);

  const addToPath = useCallback((item: Omit<ExplorationPathItem, 'timestamp'>) => {
    const pathItem: ExplorationPathItem = {
      ...item,
      timestamp: new Date()
    };
    setExplorationPath(prev => [...prev, pathItem]);
    setCurrentPathIndex(prev => prev + 1);
  }, []);

  const removeFromPath = useCallback((index: number) => {
    setExplorationPath(prev => prev.filter((_, i) => i !== index));
    if (index < currentPathIndex) {
      setCurrentPathIndex(prev => prev - 1);
    }
  }, [currentPathIndex]);

  const clearPath = useCallback(() => {
    setExplorationPath([]);
    setCurrentPathIndex(-1);
  }, []);

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
    addToPath,
    removeFromPath,
    clearPath,
    goToPathIndex,
    getCurrentPathItem,
    getRemainingPath,
    canGoBack,
    canGoForward,
    goBack,
    goForward
  };
};