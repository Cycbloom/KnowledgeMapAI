import { useEffect, useRef, useCallback, useState } from 'react';
import * as Comlink from 'comlink';

interface WorkerState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export const useWorker = <T, P extends unknown[]>(
  workerFactory: () => Worker,
  methodName: string
) => {
  const workerRef = useRef<Worker | null>(null);
  const proxyRef = useRef<unknown>(null);
  const [state, setState] = useState<WorkerState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    workerRef.current = workerFactory();
    proxyRef.current = Comlink.wrap(workerRef.current);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [workerFactory]);

  const execute = useCallback(async (...args: P): Promise<T | null> => {
    if (!proxyRef.current) {
      setState(prev => ({ ...prev, error: new Error('Worker not initialized') }));
      return null;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const method = (proxyRef.current as Record<string, (...args: P) => Promise<T>>)[methodName];
      const result = await method(...args);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, loading: false, error: err }));
      return null;
    }
  }, [methodName]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
};

interface GraphWorkerApi {
  calculateForceDirectedLayout: (
    nodes: Array<{ id: string; x?: number; y?: number }>,
    edges: Array<{ source: string; target: string }>,
    options: { width: number; height: number; iterations?: number }
  ) => Promise<Array<{ id: string; x: number; y: number }>>;
  calculateNodeImportance: (
    nodeId: string,
    nodes: Array<{ id: string }>,
    edges: Array<{ source: string; target: string }>,
    pageRanks?: Map<string, number>
  ) => Promise<number>;
  calculatePageRank: (
    nodes: Array<{ id: string }>,
    edges: Array<{ source: string; target: string }>,
    iterations?: number
  ) => Promise<Map<string, number>>;
  filterNodes: (
    nodes: Array<{ id: string; [key: string]: unknown }>,
    query: string,
    searchFields?: string[]
  ) => Promise<Array<{ id: string; [key: string]: unknown }>>;
  sortNodes: (
    nodes: Array<{ id: string; [key: string]: unknown }>,
    sortBy: string,
    ascending?: boolean
  ) => Promise<Array<{ id: string; [key: string]: unknown }>>;
  calculateMindMapLayout: (
    nodes: Array<{
      id: string;
      x?: number;
      y?: number;
      level?: string;
      properties?: Record<string, unknown>;
    }>,
    edges: Array<Record<string, unknown>>,
    options: {
      width: number;
      height: number;
      chargeStrength?: number;
      linkDistance?: number;
      centerForce?: number;
      domainGroups?: Map<string, string[]>;
      initialPositions?: Map<string, { x: number; y: number }>;
    }
  ) => Promise<{
    nodes: Array<{
      id: string;
      x: number;
      y: number;
      level?: string;
      properties?: Record<string, unknown>;
    }>;
    links: Array<Record<string, unknown> & { source: string; target: string }>;
  }>;
  calculateSemanticLayout: (
    nodes: Array<{
      id: string;
      x?: number;
      y?: number;
      level?: string;
      properties?: Record<string, unknown>;
    }>,
    edges: Array<Record<string, unknown>>,
    embeddings: Record<string, number[]>,
    options: {
      width: number;
      height: number;
      nNeighbors?: number;
      minDist?: number;
      nEpochs?: number;
      initialPositions?: Map<string, { x: number; y: number }>;
    }
  ) => Promise<{
    nodes: Array<{
      id: string;
      x: number;
      y: number;
      level?: string;
      properties?: Record<string, unknown>;
    }>;
    links: Array<Record<string, unknown> & { source: string; target: string }>;
  } | null>;
}

export const useGraphWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const proxyRef = useRef<GraphWorkerApi | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../workers/graphCalculator.worker.ts', import.meta.url),
      { type: 'module' }
    );
    proxyRef.current = Comlink.wrap<GraphWorkerApi>(workerRef.current);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const calculateLayout = useCallback(async (
    nodes: Array<{ id: string; x?: number; y?: number }>,
    edges: Array<{ source: string; target: string }>,
    options: { width: number; height: number; iterations?: number }
  ) => {
    if (!proxyRef.current) return null;
    return proxyRef.current.calculateForceDirectedLayout(nodes, edges, options);
  }, []);

  const calculateImportance = useCallback(async (
    nodeId: string,
    nodes: Array<{ id: string }>,
    edges: Array<{ source: string; target: string }>,
    pageRanks?: Map<string, number>
  ) => {
    if (!proxyRef.current) return null;
    return proxyRef.current.calculateNodeImportance(nodeId, nodes, edges, pageRanks);
  }, []);

  const calculatePageRank = useCallback(async (
    nodes: Array<{ id: string }>,
    edges: Array<{ source: string; target: string }>,
    iterations?: number
  ) => {
    if (!proxyRef.current) return null;
    return proxyRef.current.calculatePageRank(nodes, edges, iterations);
  }, []);

  const filterNodes = useCallback(async (
    nodes: Array<{ id: string; [key: string]: unknown }>,
    query: string,
    searchFields?: string[]
  ) => {
    if (!proxyRef.current) return null;
    return proxyRef.current.filterNodes(nodes, query, searchFields);
  }, []);

  const sortNodes = useCallback(async (
    nodes: Array<{ id: string; [key: string]: unknown }>,
    sortBy: string,
    ascending?: boolean
  ) => {
    if (!proxyRef.current) return null;
    return proxyRef.current.sortNodes(nodes, sortBy, ascending);
  }, []);

  const calculateMindMapLayout = useCallback(async (
    nodes: Array<{
      id: string;
      x?: number;
      y?: number;
      level?: string;
      properties?: Record<string, unknown>;
    }>,
    edges: Array<Record<string, unknown>>,
    options: {
      width: number;
      height: number;
      chargeStrength?: number;
      linkDistance?: number;
      centerForce?: number;
      domainGroups?: Map<string, string[]>;
      initialPositions?: Map<string, { x: number; y: number }>;
    }
  ) => {
    if (!proxyRef.current) return null;
    return proxyRef.current.calculateMindMapLayout(nodes, edges, options);
  }, []);

  const calculateSemanticLayout = useCallback(async (
    nodes: Array<{
      id: string;
      x?: number;
      y?: number;
      level?: string;
      properties?: Record<string, unknown>;
    }>,
    edges: Array<Record<string, unknown>>,
    embeddings: Record<string, number[]>,
    options: {
      width: number;
      height: number;
      nNeighbors?: number;
      minDist?: number;
      nEpochs?: number;
      initialPositions?: Map<string, { x: number; y: number }>;
    }
  ) => {
    if (!proxyRef.current) return null;
    return proxyRef.current.calculateSemanticLayout(nodes, edges, embeddings, options);
  }, []);

  return {
    calculateLayout,
    calculateImportance,
    calculatePageRank,
    filterNodes,
    sortNodes,
    calculateMindMapLayout,
    calculateSemanticLayout,
  };
};

export const useDebouncedValue = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useThrottledCallback = <T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T => {
  const lastCallRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    if (timeSinceLastCall >= delay) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delay - timeSinceLastCall);
    }
  }, [callback, delay]) as T;
};
