import { useState, useCallback } from 'react';
import { api } from '../../services/api';
import { frontendEventBus } from '../../services/timer/FrontendEventBus';
import { createAsyncHandler } from '../../utils/asyncHandler';
import type { 
  SimilarKnowledgePoint, 
  KnowledgePointVisibility,
  Node,
  GraphNode
} from '../../types';

interface UseKnowledgePointOperationsProps {
  graphId: string;
  onNodeCreated?: (node: Node | GraphNode) => void;
  onNodeDeleted?: (nodeId: string) => void;
}

export const useKnowledgePointOperations = ({
  graphId,
  onNodeCreated,
  onNodeDeleted
}: UseKnowledgePointOperationsProps) => {
  const asyncHandler = createAsyncHandler();
  const [similarPoints, setSimilarPoints] = useState<SimilarKnowledgePoint[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showReuseDialog, setShowReuseDialog] = useState(false);
  const [pendingNodeData, setPendingNodeData] = useState<{
    title: string;
    content?: string;
    level?: string;
    x_position?: number;
    y_position?: number;
  } | null>(null);

  const searchSimilarKnowledgePoints = useCallback(async (
    title: string,
    content?: string,
    threshold: number = 0.8,
    limit: number = 5
  ) => {
    const result = await asyncHandler(
      async () => {
        const results = await api.knowledgePoints.searchSimilar({
          query: `${title}${content ? ` ${content}` : ''}`,
          threshold,
          limit
        });
        setSimilarPoints(results);
        return results;
      },
      {
        loadingSetter: setIsSearching,
        errorMessage: '搜索相似知识点失败'
      }
    );
    
    return result || [];
  }, [asyncHandler]);

  const createNodeWithReuseCheck = useCallback(async (data: {
    title: string;
    content?: string;
    level?: string;
    x_position?: number;
    y_position?: number;
    learning_material?: string;
    properties?: Record<string, unknown>;
    autoReuse?: boolean;
  }) => {
    const { autoReuse = true, ...nodeData } = data;
    
    if (autoReuse) {
      const similar = await searchSimilarKnowledgePoints(data.title, data.content);
      
      if (similar.length > 0 && similar[0].similarity >= 0.85) {
        setPendingNodeData(nodeData);
        setShowReuseDialog(true);
        return { needsConfirmation: true, similarPoints: similar };
      }
    }
    
    const node = await api.nodes.create({
      graph_id: graphId,
      ...nodeData
    });
    
    onNodeCreated?.(node);
    return { needsConfirmation: false, node };
  }, [graphId, searchSimilarKnowledgePoints, onNodeCreated]);

  const confirmReuse = useCallback(async (knowledgePointId: string) => {
    if (!pendingNodeData) return null;
    
    const result = await asyncHandler(
      async () => {
        const node = await api.graphNodes.addExistingKnowledgePoint({
          graph_id: graphId,
          knowledge_point_id: knowledgePointId,
          x_position: pendingNodeData.x_position,
          y_position: pendingNodeData.y_position,
          level: pendingNodeData.level
        });
        
        onNodeCreated?.(node);
        setShowReuseDialog(false);
        setPendingNodeData(null);
        setSimilarPoints([]);
        return node;
      },
      {
        successMessage: '已复用现有知识点',
        errorMessage: '复用知识点失败'
      }
    );
    
    return result;
  }, [graphId, pendingNodeData, onNodeCreated, asyncHandler]);

  const createNewAnyway = useCallback(async () => {
    if (!pendingNodeData) return null;
    
    const result = await asyncHandler(
      async () => {
        const node = await api.nodes.create({
          graph_id: graphId,
          ...pendingNodeData,
          reuse_existing: false
        });
        
        onNodeCreated?.(node);
        setShowReuseDialog(false);
        setPendingNodeData(null);
        setSimilarPoints([]);
        return node;
      },
      {
        errorMessage: '创建节点失败'
      }
    );
    
    return result;
  }, [graphId, pendingNodeData, onNodeCreated, asyncHandler]);

  const deleteNodeWithOption = useCallback(async (
    nodeId: string,
    options: { hardDelete: boolean }
  ) => {
    const result = await asyncHandler(
      async () => {
        if (options.hardDelete) {
          const result = await api.nodes.delete(nodeId, true);
          
          if (result.affected_graphs && result.affected_graphs.length > 1) {
            frontendEventBus.publish("message_show", { 
              type: 'warning', 
              content: `此知识点已在 ${result.affected_graphs.length} 个图谱中删除` 
            });
          }
        } else {
          await api.nodes.delete(nodeId, false);
        }
        
        onNodeDeleted?.(nodeId);
        return { success: true };
      },
      {
        successMessage: options.hardDelete ? '知识点已彻底删除' : '已从当前图谱移除',
        errorMessage: '删除失败'
      }
    );
    
    return result || { success: false };
  }, [onNodeDeleted, asyncHandler]);

  const getKnowledgePointGraphs = useCallback(async (nodeId: string) => {
    const result = await asyncHandler(
      async () => {
        const graphs = await api.nodes.getKnowledgePointGraphs(nodeId);
        return graphs;
      },
      {
        errorMessage: '获取知识点图谱列表失败'
      }
    );
    
    return result || [];
  }, [asyncHandler]);

  const updateKnowledgePointVisibility = useCallback(async (
    knowledgePointId: string,
    visibility: KnowledgePointVisibility
  ) => {
    const result = await asyncHandler(
      async () => {
        await api.knowledgePoints.update(knowledgePointId, { visibility });
        return { success: true };
      },
      {
        successMessage: visibility === 'public' ? '知识点已设为公开' : '知识点已设为私有',
        errorMessage: '更新可见性失败'
      }
    );
    
    return result || { success: false };
  }, [asyncHandler]);

  return {
    similarPoints,
    isSearching,
    showReuseDialog,
    pendingNodeData,
    searchSimilarKnowledgePoints,
    createNodeWithReuseCheck,
    confirmReuse,
    createNewAnyway,
    deleteNodeWithOption,
    getKnowledgePointGraphs,
    updateKnowledgePointVisibility,
    cancelReuse: () => {
      setShowReuseDialog(false);
      setPendingNodeData(null);
      setSimilarPoints([]);
    }
  };
};
