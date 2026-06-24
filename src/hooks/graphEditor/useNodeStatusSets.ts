import { useMemo } from 'react';
import type { NodeStatus } from '@shared/types/graph';

interface UseNodeStatusSetsReturn {
  lockedNodeIds: Set<string>;
  masteredNodeIds: Set<string>;
  dueTodayNodeIds: Set<string>;
  graphStats: {
    nodeCount: number;
    edgeCount: number;
    masteredCount: number;
    lockedCount: number;
    dueTodayCount: number;
  };
}

export const useNodeStatusSets = (
  nodeStatus: Record<string, NodeStatus> | undefined,
  nodes: unknown[],
  edges: unknown[],
): UseNodeStatusSetsReturn => {
  return useMemo(() => {
    const locked = new Set<string>();
    const mastered = new Set<string>();
    const dueToday = new Set<string>();

    if (nodeStatus) {
      Object.entries(nodeStatus).forEach(([id, status]) => {
        if (status.locked) locked.add(id);
        if (status.mastered) mastered.add(id);
        if (status.due_today || status.due) dueToday.add(id);
      });
    }

    return {
      lockedNodeIds: locked,
      masteredNodeIds: mastered,
      dueTodayNodeIds: dueToday,
      graphStats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        masteredCount: mastered.size,
        lockedCount: locked.size,
        dueTodayCount: dueToday.size,
      },
    };
  }, [nodeStatus, nodes.length, edges.length]);
};
