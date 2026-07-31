import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { message } from '../../utils/messageHelper';
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
  const { t } = useTranslation();
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
        errorMessage: t('learning.knowledgePoint.searchSimilarFailed')
      }
    );
    
    return result || [];
  }, [asyncHandler, t]);

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
        successMessage: t('learning.knowledgePoint.reuseSuccess'),
        errorMessage: t('learning.knowledgePoint.reuseFailed')
      }
    );
    
    return result;
  }, [graphId, pendingNodeData, onNodeCreated, asyncHandler, t]);

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
        errorMessage: t('learning.knowledgePoint.createFailed')
      }
    );
    
    return result;
  }, [graphId, pendingNodeData, onNodeCreated, asyncHandler, t]);

  const deleteNodeWithOption = useCallback(async (
    nodeId: string,
    options: { hardDelete: boolean }
  ) => {
    const result = await asyncHandler(
      async () => {
        if (options.hardDelete) {
          const result = await api.nodes.delete(nodeId, true);
          
          if (result.affected_graphs && result.affected_graphs.length > 1) {
            message.warning(t('learning.knowledgePoint.deletedFromMultipleGraphs', { count: result.affected_graphs.length }));
          }
        } else {
          await api.nodes.delete(nodeId, false);
        }
        
        onNodeDeleted?.(nodeId);
        return { success: true };
      },
      {
        successMessage: options.hardDelete ? t('learning.knowledgePoint.hardDeleteSuccess') : t('learning.knowledgePoint.softDeleteSuccess'),
        errorMessage: t('learning.knowledgePoint.deleteFailed')
      }
    );
    
    return result || { success: false };
  }, [onNodeDeleted, asyncHandler, t]);

  const getKnowledgePointGraphs = useCallback(async (nodeId: string) => {
    const result = await asyncHandler(
      async () => {
        const graphs = await api.nodes.getKnowledgePointGraphs(nodeId);
        return graphs;
      },
      {
        errorMessage: t('learning.knowledgePoint.getGraphsFailed')
      }
    );
    
    return result || [];
  }, [asyncHandler, t]);

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
        successMessage: visibility === 'public' ? t('learning.knowledgePoint.visibilityPublicSuccess') : t('learning.knowledgePoint.visibilityPrivateSuccess'),
        errorMessage: t('learning.knowledgePoint.visibilityUpdateFailed')
      }
    );
    
    return result || { success: false };
  }, [asyncHandler, t]);

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
