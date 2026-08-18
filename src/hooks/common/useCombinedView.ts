import { useState, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import i18n from '../../i18n';
import type { 
  CombinedViewData, 
  CombinedViewLayoutMode,
  GraphNodeWithKnowledgePoint,
  Edge,
  KnowledgePoint
} from '../../types';

interface UseCombinedViewProps {
  initialGraphIds?: string[];
}

const GRAPH_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16'
];

export const useCombinedView = (props?: UseCombinedViewProps) => {
  const [graphIds, setGraphIds] = useState<string[]>(props?.initialGraphIds || []);
  const [data, setData] = useState<CombinedViewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [layoutMode, setLayoutMode] = useState<CombinedViewLayoutMode>('grouped');
  const [highlightedGraphId, setHighlightedGraphId] = useState<string | null>(null);
  const [hiddenGraphIds, setHiddenGraphIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const graphColors = useMemo(() => {
    const colorMap: Record<string, string> = {};
    graphIds.forEach((id, index) => {
      colorMap[id] = GRAPH_COLORS[index % GRAPH_COLORS.length];
    });
    return colorMap;
  }, [graphIds]);

  const loadData = useCallback(async () => {
    if (graphIds.length === 0) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.combinedView.getData(graphIds);
      setData(result);
    } catch (err) {
      console.error('Failed to load combined view data:', err);
      setError(i18n.t('combinedViewPage.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [graphIds]);

  const addGraph = useCallback((graphId: string) => {
    setGraphIds(prev => {
      if (prev.includes(graphId)) return prev;
      return [...prev, graphId];
    });
  }, []);

  const removeGraph = useCallback((graphId: string) => {
    setGraphIds(prev => prev.filter(id => id !== graphId));
    setHiddenGraphIds(prev => {
      const next = new Set(prev);
      next.delete(graphId);
      return next;
    });
  }, []);

  const toggleGraphVisibility = useCallback((graphId: string) => {
    setHiddenGraphIds(prev => {
      const next = new Set(prev);
      if (next.has(graphId)) {
        next.delete(graphId);
      } else {
        next.add(graphId);
      }
      return next;
    });
  }, []);

  const visibleData = useMemo(() => {
    if (!data) return null;

    return {
      graphs: data.graphs.filter(g => !hiddenGraphIds.has(g.graph_id)),
      shared_knowledge_points: data.shared_knowledge_points
    };
  }, [data, hiddenGraphIds]);

  const mergedNodes = useMemo(() => {
    if (!visibleData) return [];
    
    const nodeMap = new Map<string, {
      knowledgePoint: KnowledgePoint;
      graphNodes: GraphNodeWithKnowledgePoint[];
      graphIds: string[];
    }>();

    visibleData.graphs.forEach(graph => {
      graph.nodes.forEach(gn => {
        const kpId = gn.knowledge_point_id;
        if (nodeMap.has(kpId)) {
          const existing = nodeMap.get(kpId);
          if (existing) {
            existing.graphNodes.push(gn);
            existing.graphIds.push(graph.graph_id);
          }
        } else {
          nodeMap.set(kpId, {
            knowledgePoint: gn,
            graphNodes: [gn],
            graphIds: [graph.graph_id]
          });
        }
      });
    });

    return Array.from(nodeMap.values()).map(item => ({
      ...item.knowledgePoint,
      id: item.knowledgePoint.id,
      graphNodes: item.graphNodes,
      graphIds: item.graphIds,
      isShared: item.graphIds.length > 1,
      primaryColor: graphColors[item.graphIds[0]],
      colors: item.graphIds.map(gid => graphColors[gid])
    }));
  }, [visibleData, graphColors]);

  const mergedEdges = useMemo(() => {
    if (!visibleData) return [];
    
    const allEdges: Array<Edge & { graphId: string; color: string }> = [];
    
    visibleData.graphs.forEach(graph => {
      graph.edges.forEach(edge => {
        allEdges.push({
          ...edge,
          graphId: graph.graph_id,
          color: graphColors[graph.graph_id]
        });
      });
    });

    return allEdges;
  }, [visibleData, graphColors]);

  const getGraphColor = useCallback((graphId: string) => {
    return graphColors[graphId] || '#6B7280';
  }, [graphColors]);

  const getNodeColors = useCallback((graphIds: string[]) => {
    // 单趟收集存在的颜色，替代 map+filter 两次扫描
    const colors: string[] = [];
    for (const id of graphIds) {
      const c = graphColors[id];
      if (c) colors.push(c);
    }
    return colors;
  }, [graphColors]);

  return {
    graphIds,
    data: visibleData,
    mergedNodes,
    mergedEdges,
    isLoading,
    error,
    layoutMode,
    setLayoutMode,
    highlightedGraphId,
    setHighlightedGraphId,
    hiddenGraphIds,
    graphColors,
    loadData,
    addGraph,
    removeGraph,
    toggleGraphVisibility,
    getGraphColor,
    getNodeColors
  };
};
