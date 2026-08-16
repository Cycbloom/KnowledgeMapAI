import { useMemo } from 'react';
import { Node, Edge, NodeStatus } from '../../types';

interface UseGraphComputedProps {
  nodes: Node[];
  edges: Edge[];
  nodeStatus: Record<string, NodeStatus> | null | undefined;
}

export const useGraphComputed = ({ nodes, edges, nodeStatus }: UseGraphComputedProps) => {
  const lockedNodeIds = useMemo(() => {
    // 单趟遍历构建 Set，替代 filter+map 的两次扫描与中间数组分配（O(2×n) → O(n)）
    const set = new Set<string>();
    if (!nodeStatus) return set;
    for (const [id, status] of Object.entries(nodeStatus)) {
      if (status.locked) set.add(id);
    }
    return set;
  }, [nodeStatus]);

  const masteredNodeIds = useMemo(() => {
    // 单趟遍历构建 Set，替代 filter+map 的两次扫描与中间数组分配（O(2×n) → O(n)）
    const set = new Set<string>();
    if (!nodeStatus) return set;
    for (const [id, status] of Object.entries(nodeStatus)) {
      if (status.mastered) set.add(id);
    }
    return set;
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
