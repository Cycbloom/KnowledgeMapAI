import { useMemo } from 'react';
import { Node, Edge } from '../types';

interface UseGraphComputedProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus: Record<string, any> | null | undefined;
}

export const useGraphComputed = ({ nodes, edges, nodeStatus }: UseGraphComputedProps) => {
  const lockedNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    return new Set(
      Object.entries(nodeStatus)
        .filter(([_, status]: [string, any]) => status.locked)
        .map(([id]) => id)
    );
  }, [nodeStatus]);

  const masteredNodeIds = useMemo(() => {
    if (!nodeStatus) return new Set<string>();
    return new Set(
      Object.entries(nodeStatus)
        .filter(([_, status]: [string, any]) => status.mastered)
        .map(([id]) => id)
    );
  }, [nodeStatus]);

  const graphStats = useMemo(() => {
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      masteredCount: masteredNodeIds.size,
      lockedCount: lockedNodeIds.size
    };
  }, [nodes.length, edges.length, masteredNodeIds.size, lockedNodeIds.size]);

  return {
    lockedNodeIds,
    masteredNodeIds,
    graphStats
  };
};
