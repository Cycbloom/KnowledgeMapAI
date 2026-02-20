import { useState, useCallback } from 'react';
import { api } from '../services/api';
import { useMessageStore } from '../store/useMessageStore';
import type { 
  SimilarKnowledgePoint, 
  DeleteKnowledgePointResult,
  KnowledgePointVisibility 
} from '../types';

interface UseKnowledgePointOperationsProps {
  graphId: string;
  onNodeCreated?: (node: any) => void;
  onNodeDeleted?: (nodeId: string) => void;
}

export const useKnowledgePointOperations = ({
  graphId,
  onNodeCreated,
  onNodeDeleted
}: UseKnowledgePointOperationsProps) => {
  const { addMessage } = useMessageStore();
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
    setIsSearching(true);
    try {
      const results = await api.knowledgePoints.searchSimilar({
        query: `${title}${content ? ' ' + content : ''}`,
        threshold,
        limit
      });
      setSimilarPoints(results);
      return results;
    } catch (err) {
      console.error('Search similar knowledge points failed:', err);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

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
    
    try {
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
      addMessage({ type: 'success', content: '已复用现有知识点' });
      return node;
    } catch (err) {
      console.error('Failed to reuse knowledge point:', err);
      addMessage({ type: 'error', content: '复用知识点失败' });
      return null;
    }
  }, [graphId, pendingNodeData, onNodeCreated, addMessage]);

  const createNewAnyway = useCallback(async () => {
    if (!pendingNodeData) return null;
    
    try {
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
    } catch (err) {
      console.error('Failed to create node:', err);
      addMessage({ type: 'error', content: '创建节点失败' });
      return null;
    }
  }, [graphId, pendingNodeData, onNodeCreated, addMessage]);

  const deleteNodeWithOption = useCallback(async (
    nodeId: string,
    options: { hardDelete: boolean }
  ) => {
    try {
      if (options.hardDelete) {
        const result = await api.nodes.delete(nodeId, { hard_delete: true });
        
        if (result.affected_graphs && result.affected_graphs > 1) {
          addMessage({ 
            type: 'warning', 
            content: `此知识点已在 ${result.affected_graphs} 个图谱中删除` 
          });
        }
      } else {
        await api.nodes.delete(nodeId, { hard_delete: false });
      }
      
      onNodeDeleted?.(nodeId);
      addMessage({ 
        type: 'success', 
        content: options.hardDelete ? '知识点已彻底删除' : '已从当前图谱移除' 
      });
      return { success: true };
    } catch (err) {
      console.error('Failed to delete node:', err);
      addMessage({ type: 'error', content: '删除失败' });
      return { success: false };
    }
  }, [onNodeDeleted, addMessage]);

  const getKnowledgePointGraphs = useCallback(async (nodeId: string) => {
    try {
      const graphs = await api.nodes.getKnowledgePointGraphs(nodeId);
      return graphs;
    } catch (err) {
      console.error('Failed to get knowledge point graphs:', err);
      return [];
    }
  }, []);

  const updateKnowledgePointVisibility = useCallback(async (
    knowledgePointId: string,
    visibility: KnowledgePointVisibility
  ) => {
    try {
      await api.knowledgePoints.update(knowledgePointId, { visibility });
      addMessage({ 
        type: 'success', 
        content: visibility === 'public' ? '知识点已设为公开' : '知识点已设为私有' 
      });
      return { success: true };
    } catch (err) {
      console.error('Failed to update visibility:', err);
      addMessage({ type: 'error', content: '更新可见性失败' });
      return { success: false };
    }
  }, [addMessage]);

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
