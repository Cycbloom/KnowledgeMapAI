import { useMemo } from 'react';
import {
  SEMANTIC_ZOOM_CONFIG,
  getSemanticZoomLevel,
  type SemanticZoomLevel,
} from '../../config/graphConfig';
import type { NodeLevel, Node, Edge } from '../../types';

export interface NodeDisplayStrategy {
  visible: boolean;
  showText: boolean;
  maxTitleLength: number;
  showContentPreview: boolean;
  showLearningStatus: boolean;
  showReviewCount: boolean;
  isAggregated: boolean;
  childCount: number;
}

export interface UseSemanticZoomResult {
  semanticLevel: SemanticZoomLevel;
  semanticLevelLabel: string;
  nodeStrategies: Map<string, NodeDisplayStrategy>;
  shouldShowEdges: boolean;
  shouldShowEdgeLabels: boolean;
  semanticVisibleEdgeIds: Set<string>;
}

interface UseSemanticZoomProps {
  zoomK: number;
  nodes: Node[];
  edges: Edge[];
}

export const useSemanticZoom = ({
  zoomK,
  nodes,
  edges,
}: UseSemanticZoomProps): UseSemanticZoomResult => {
  const semanticLevel = useMemo(
    () => getSemanticZoomLevel(zoomK),
    [zoomK],
  );

  const config = SEMANTIC_ZOOM_CONFIG;

  const semanticLevelLabel = useMemo(() => {
    const levelConfig = config.levels[semanticLevel];
    return levelConfig.labelKey;
  }, [semanticLevel]);

  const nodeStrategies = useMemo(() => {
    const strategies = new Map<string, NodeDisplayStrategy>();
    const visibleLevels = config.visibleLevels[semanticLevel];
    const textRules = config.textRules[semanticLevel];

    const coreNodes = nodes.filter((n) => n.level === 'core');

    // Build parent-child map from edges for accurate descendant counting
    const childMap = new Map<string, string[]>();
    edges.forEach((edge) => {
      const parentId = edge.source_knowledge_point_id;
      const childId = edge.target_knowledge_point_id;
      const children = childMap.get(parentId);
      if (children) {
        children.push(childId);
      } else {
        childMap.set(parentId, [childId]);
      }
    });

    // Count actual hidden descendants for each core node using BFS
    const coreDescendantCounts = new Map<string, number>();
    if (semanticLevel === 'overview') {
      const hiddenLevelSet = new Set<string>();
      (['normal', 'leaf', 'sub'] as const).forEach((lvl) => hiddenLevelSet.add(lvl));

      coreNodes.forEach((coreNode) => {
        let count = 0;
        const visited = new Set<string>();
        const queue = childMap.get(coreNode.id) || [];
        while (queue.length > 0) {
          const currentId = queue.shift();
          if (!currentId) break;
          if (visited.has(currentId)) continue;
          visited.add(currentId);
          const currentNode = nodes.find((n) => n.id === currentId);
          const currentLevel = (currentNode?.level || 'normal') as NodeLevel;
          if (hiddenLevelSet.has(currentLevel)) {
            count++;
          }
          const grandchildren = childMap.get(currentId);
          if (grandchildren) {
            queue.push(...grandchildren);
          }
        }
        coreDescendantCounts.set(coreNode.id, count);
      });
    }

    nodes.forEach((node) => {
      const nodeLevel = (node.level || 'normal') as NodeLevel;
      const visible = (visibleLevels as readonly string[]).includes(nodeLevel);

      // In overview mode, sub/normal/leaf nodes are aggregated into their parent
      const isAggregated =
        semanticLevel === 'overview' &&
        (nodeLevel === 'normal' || nodeLevel === 'leaf' || nodeLevel === 'sub');

      // Count actual hidden descendants for aggregate display
      const childCount =
        semanticLevel === 'overview' && nodeLevel === 'core'
          ? coreDescendantCounts.get(node.id) || 0
          : 0;

      strategies.set(node.id, {
        visible,
        showText: textRules.showText,
        maxTitleLength: textRules.maxTitleLength,
        showContentPreview:
          semanticLevel === 'detail' && config.detailInfo.showContentPreview,
        showLearningStatus:
          semanticLevel === 'detail' && config.detailInfo.showLearningStatus,
        showReviewCount:
          semanticLevel === 'detail' && config.detailInfo.showReviewCount,
        isAggregated,
        childCount,
      });
    });

    return strategies;
  }, [nodes, edges, semanticLevel]);

  const shouldShowEdges = semanticLevel !== 'overview';
  const shouldShowEdgeLabels =
    semanticLevel === 'node' || semanticLevel === 'detail';

  const semanticVisibleEdgeIds = useMemo(() => {
    const visibleLevelSet = new Set<string>(
      config.visibleLevels[semanticLevel],
    );
    const nodeLevelMap = new Map<string, string>();
    nodes.forEach((node) => {
      nodeLevelMap.set(node.id, node.level || 'normal');
    });

    const visibleEdgeIds = new Set<string>();
    edges.forEach((edge) => {
      const sourceLevel = nodeLevelMap.get(edge.source_knowledge_point_id);
      const targetLevel = nodeLevelMap.get(edge.target_knowledge_point_id);

      if (
        sourceLevel &&
        targetLevel &&
        visibleLevelSet.has(sourceLevel) &&
        visibleLevelSet.has(targetLevel)
      ) {
        visibleEdgeIds.add(edge.id);
      }
    });

    return visibleEdgeIds;
  }, [edges, nodes, semanticLevel]);

  return {
    semanticLevel,
    semanticLevelLabel,
    nodeStrategies,
    shouldShowEdges,
    shouldShowEdgeLabels,
    semanticVisibleEdgeIds,
  };
};
