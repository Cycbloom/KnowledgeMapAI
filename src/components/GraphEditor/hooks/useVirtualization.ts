import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type { LayoutNode, LayoutLink } from '../../../types';

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface SpatialGrid {
  cells: Map<string, LayoutNode[]>;
  cellSize: number;
}

interface VirtualizationConfig {
  bufferSize: number;
  cellSize: number;
  largeGraphThreshold: number;
  updateThrottleMs: number;
}

const DEFAULT_CONFIG: VirtualizationConfig = {
  bufferSize: 200,
  cellSize: 300,
  largeGraphThreshold: 100,
  updateThrottleMs: 16,
};

export function useSpatialGrid(
  nodes: LayoutNode[],
  cellSize: number = DEFAULT_CONFIG.cellSize
): SpatialGrid | null {
  return useMemo(() => {
    if (nodes.length <= DEFAULT_CONFIG.largeGraphThreshold) {
      return null;
    }
    
    const cells = new Map<string, LayoutNode[]>();
    
    nodes.forEach(node => {
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);
      const key = `${cellX},${cellY}`;
      
      if (!cells.has(key)) {
        cells.set(key, []);
      }
      cells.get(key)!.push(node);
    });
    
    return { cells, cellSize };
  }, [nodes, cellSize]);
}

export function useViewportBounds(
  transform: { x: number; y: number; k: number },
  containerSize: { width: number; height: number },
  bufferSize: number = DEFAULT_CONFIG.bufferSize,
  viewportVersion?: number
): ViewportBounds {
  return useMemo(() => {
    const { x, y, k } = transform;
    
    return {
      minX: (-x - bufferSize) / k,
      maxX: (-x + containerSize.width + bufferSize) / k,
      minY: (-y - bufferSize) / k,
      maxY: (-y + containerSize.height + bufferSize) / k,
    };
  }, [transform, containerSize, bufferSize, viewportVersion]);
}

export function useVisibleNodes(
  nodes: LayoutNode[],
  spatialGrid: SpatialGrid | null,
  viewportBounds: ViewportBounds,
  isExplorationMode: boolean
): LayoutNode[] {
  return useMemo(() => {
    let filteredNodes = nodes;
    
    if (!isExplorationMode) {
      filteredNodes = nodes.filter(node => node.is_accepted !== false);
    }
    
    if (filteredNodes.length === 0) return [];
    
    if (spatialGrid) {
      const result: LayoutNode[] = [];
      const { minX, maxX, minY, maxY } = viewportBounds;
      
      const startCellX = Math.floor(minX / spatialGrid.cellSize);
      const endCellX = Math.floor(maxX / spatialGrid.cellSize);
      const startCellY = Math.floor(minY / spatialGrid.cellSize);
      const endCellY = Math.floor(maxY / spatialGrid.cellSize);
      
      for (let x = startCellX; x <= endCellX; x++) {
        for (let y = startCellY; y <= endCellY; y++) {
          const key = `${x},${y}`;
          const cellNodes = spatialGrid.cells.get(key);
          if (cellNodes) {
            for (const node of cellNodes) {
              if (
                node.x >= minX &&
                node.x <= maxX &&
                node.y >= minY &&
                node.y <= maxY
              ) {
                result.push(node);
              }
            }
          }
        }
      }
      
      return result;
    }
    
    const { minX, maxX, minY, maxY } = viewportBounds;
    return filteredNodes.filter(node => 
      node.x >= minX &&
      node.x <= maxX &&
      node.y >= minY &&
      node.y <= maxY
    );
  }, [nodes, spatialGrid, viewportBounds, isExplorationMode]);
}

export function useVisibleEdges(
  links: LayoutLink[],
  allNodes: LayoutNode[],
  visibleNodeIds: Set<string>,
  viewportBounds: ViewportBounds
): LayoutLink[] {
  return useMemo(() => {
    if (links.length === 0) return [];
    
    const nodePositionMap = new Map(
      allNodes.map(n => [String(n.id).trim(), { x: n.x, y: n.y }])
    );
    
    const { minX, maxX, minY, maxY } = viewportBounds;
    
    const isPointInViewport = (x: number, y: number) => 
      x >= minX && x <= maxX && y >= minY && y <= maxY;
    
    return links.filter(link => {
      const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
      const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
      
      if (visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)) {
        return true;
      }
      
      const sourcePos = nodePositionMap.get(sourceId);
      const targetPos = nodePositionMap.get(targetId);
      
      if (!sourcePos || !targetPos) return false;
      
      if (isPointInViewport(sourcePos.x, sourcePos.y)) return true;
      if (isPointInViewport(targetPos.x, targetPos.y)) return true;
      
      return false;
    });
  }, [links, allNodes, visibleNodeIds, viewportBounds]);
}

export function useViewportUpdate(
  throttleMs: number = DEFAULT_CONFIG.updateThrottleMs
): {
  viewportVersion: number;
  scheduleViewportUpdate: () => void;
  forceUpdate: () => void;
} {
  const [viewportVersion, setViewportVersion] = useState(0);
  const updateFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  
  const scheduleViewportUpdate = useCallback(() => {
    if (updateFrameRef.current !== null) {
      return;
    }
    
    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    
    if (timeSinceLastUpdate >= throttleMs) {
      lastUpdateTimeRef.current = now;
      setViewportVersion(v => v + 1);
    } else {
      updateFrameRef.current = requestAnimationFrame(() => {
        lastUpdateTimeRef.current = performance.now();
        setViewportVersion(v => v + 1);
        updateFrameRef.current = null;
      });
    }
  }, [throttleMs]);
  
  const forceUpdate = useCallback(() => {
    if (updateFrameRef.current !== null) {
      cancelAnimationFrame(updateFrameRef.current);
      updateFrameRef.current = null;
    }
    lastUpdateTimeRef.current = performance.now();
    setViewportVersion(v => v + 1);
  }, []);
  
  useEffect(() => {
    return () => {
      if (updateFrameRef.current !== null) {
        cancelAnimationFrame(updateFrameRef.current);
      }
    };
  }, []);
  
  return { viewportVersion, scheduleViewportUpdate, forceUpdate };
}

export function useNodePositionCache(
  nodes: LayoutNode[]
): Map<string, { x: number; y: number }> {
  return useMemo(() => {
    return new Map(
      nodes.map(n => [String(n.id).trim(), { x: n.x, y: n.y }])
    );
  }, [nodes]);
}

export function useVisibleNodeSet(visibleNodes: LayoutNode[]): Set<string> {
  return useMemo(() => {
    return new Set(visibleNodes.map(n => String(n.id).trim()));
  }, [visibleNodes]);
}

export function usePerformanceMetrics() {
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  
  const recordFrame = useCallback(() => {
    const now = performance.now();
    if (lastFrameTimeRef.current > 0) {
      const frameTime = now - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
    }
    lastFrameTimeRef.current = now;
  }, []);
  
  const getMetrics = useCallback(() => {
    const times = frameTimesRef.current;
    if (times.length === 0) return { avgFps: 0, avgFrameTime: 0 };
    
    const avgFrameTime = times.reduce((a, b) => a + b, 0) / times.length;
    const avgFps = 1000 / avgFrameTime;
    
    return { avgFps, avgFrameTime };
  }, []);
  
  return { recordFrame, getMetrics };
}
