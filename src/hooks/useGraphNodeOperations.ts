import { useCallback } from 'react';
import { Node, Edge, NodeLevel } from '../types';
import { getLevel } from '../lib/graphUtils';
import { HistoryAction } from './useHistory';
import { GraphEditorState } from './useGraphEditorState';
import { useMessageStore } from '../store/useMessageStore';
import { levelLabels } from '../config/graphConfig';
import { createAsyncHandler } from '../utils/asyncHandler';

interface UseGraphNodeOperationsProps {
  id: string;
  nodes: Node[];
  edges: Edge[];
  state: GraphEditorState;
  mutations: {
    createNodeMutation: any;
    updateNodeMutation: any;
    deleteNodeMutation: any;
    createEdgeMutation: any;
    deleteEdgeMutation: any;
    batchDeleteNodesMutation: any;
  };
  record: (action: HistoryAction) => void;
  addMessage: any;
}

export const useGraphNodeOperations = ({
  id,
  nodes,
  edges,
  state,
  mutations,
  record
}: UseGraphNodeOperationsProps) => {
  const { addMessage } = useMessageStore();
  const asyncHandler = createAsyncHandler(addMessage);
  const { 
    nodeForm, setNodeForm, 
    sidebarMode, setSidebarMode, 
    selectedNode, setSelectedNode, 
    selectedNodeIds, setSelectedNodeIds, 
    setLoading, setConfirmModal 
  } = state;
  const {
    createNodeMutation,
    updateNodeMutation,
    deleteNodeMutation,
    createEdgeMutation,
    deleteEdgeMutation,
    batchDeleteNodesMutation
  } = mutations;

  const handleSaveNode = async () => {
    if (!id) return;
    
    await asyncHandler(
      async () => {
        if (sidebarMode === 'create') {
          const newNode = await createNodeMutation.mutateAsync({
            graph_id: id,
            title: nodeForm.title,
            content: nodeForm.content,
            x_position: Math.round((Math.random() - 0.5) * 20),
            y_position: Math.round((Math.random() - 0.5) * 20),
            level: nodeForm.level,
            tags: nodeForm.tags,
            properties: {}
          });

          for (const parentId of nodeForm.parentNodeIds) {
            if (parentId !== newNode.id) {
              const newEdge = await createEdgeMutation.mutateAsync({
                source_knowledge_point_id: parentId,
                target_knowledge_point_id: newNode.id,
                relationship_type: 'related',
                graphId: id
              });
              record({ type: 'CREATE_EDGE', payload: newEdge });
            }
          }

          record({ type: 'CREATE_NODE', payload: newNode });

          setSelectedNode(newNode);
          setSidebarMode('edit');
          return newNode;
        } else if (sidebarMode === 'edit' && selectedNode) {
          const beforeState = {
            graph_id: selectedNode.graph_id,
            title: selectedNode.title,
            content: selectedNode.content,
            level: selectedNode.level,
            tags: selectedNode.properties?.tags,
            properties: selectedNode.properties
          };

          const updateData = {
            graph_id: selectedNode.graph_id,
            title: nodeForm.title,
            content: nodeForm.content,
            level: nodeForm.level,
            properties: { ...selectedNode.properties, tags: nodeForm.tags }
          };

          const actions: HistoryAction[] = [];

          const updated = await updateNodeMutation.mutateAsync({
            id: selectedNode.id,
            data: updateData,
            graphId: id
          });
          
          actions.push({
            type: 'UPDATE_NODE',
            payload: {
              id: selectedNode.id,
              before: beforeState,
              after: updateData
            }
          });

          const currentParentEdges = edges.filter(e => e.target_knowledge_point_id === selectedNode.id);
          const currentParentIds = currentParentEdges.map(e => e.source_knowledge_point_id);
          const newParentIds = nodeForm.parentNodeIds.filter(id => id !== selectedNode.id);
          
          const parentIdsToRemove = currentParentIds.filter(id => !newParentIds.includes(id));
          const parentIdsToAdd = newParentIds.filter(id => !currentParentIds.includes(id));
          
          for (const parentId of parentIdsToRemove) {
            const edgeToDelete = currentParentEdges.find(e => e.source_knowledge_point_id === parentId);
            if (edgeToDelete) {
              await deleteEdgeMutation.mutateAsync({ id: edgeToDelete.id });
              actions.push({ type: 'DELETE_EDGE', payload: edgeToDelete });
            }
          }
          
          for (const parentId of parentIdsToAdd) {
            const newEdge = await createEdgeMutation.mutateAsync({
              source_knowledge_point_id: parentId,
              target_knowledge_point_id: selectedNode.id,
              relationship_type: 'related',
              graphId: id
            });
            actions.push({ type: 'CREATE_EDGE', payload: newEdge });
          }
          
          if (actions.length === 1) {
            record(actions[0]);
          } else if (actions.length > 1) {
            record({ type: 'BATCH', payload: actions });
          }
          
          setSelectedNode(updated);
          setSidebarMode('edit');
          return updated;
        }
        return null;
      },
      {
        loadingSetter: setLoading,
        successMessage: sidebarMode === 'create' ? '节点创建成功' : '节点保存成功',
        errorMessage: '保存失败，请重试'
      }
    );
  };

  const handleCloseSidebar = useCallback(() => {
    if (state.prevSidebarMode === 'outline') {
      state.setSidebarMode('outline');
      state.setPrevSidebarMode('none');
    } else {
      state.setSidebarMode('none');
    }
    state.setSelectedNode(null);
    state.setSelectedNodeIds(new Set());
  }, [state]);

  const handleToggleCollapse = (nodeId: string) => {
    state.setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleDeleteNode = (nodeToDelete: Node | null = selectedNode, hardDelete: boolean = false) => {
    if (!nodeToDelete || !id) return;
    
    const connectedEdges = edges.filter(e => 
      e.source_knowledge_point_id === nodeToDelete.id || e.target_knowledge_point_id === nodeToDelete.id
    );
    
    const message = hardDelete 
      ? `确定要彻底删除知识点 "${nodeToDelete.title}" 吗？此操作将从所有图谱中移除此知识点，且不可恢复！`
      : `确定要从当前图谱移除节点 "${nodeToDelete.title}" 吗？`;
    
    setConfirmModal({
      isOpen: true,
      title: hardDelete ? '彻底删除知识点' : '移除节点',
      message,
      onConfirm: () => {
        deleteNodeMutation.mutate({ id: nodeToDelete.id, graphId: id, hardDelete }, {
          onSuccess: (data) => {
            record({ 
              type: 'DELETE_NODE', 
              payload: { node: nodeToDelete, edges: connectedEdges } 
            });
            if (selectedNode?.id === nodeToDelete.id) {
              handleCloseSidebar();
            }
            if (hardDelete && data?.affected_graphs?.length) {
              addMessage({ 
                type: 'success', 
                content: `知识点已从 ${data.affected_graphs.length} 个图谱中彻底删除` 
              });
            } else {
              addMessage({ type: 'success', content: '节点已删除' });
            }
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          },
          onError: (err: any) => {
            console.error(err);
            addMessage({ type: 'error', content: '删除失败' });
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
        });
      }
    });
  };

  const handleBatchDelete = () => {
    if (!id || selectedNodeIds.size === 0) return;
    
    const batchAction: HistoryAction = {
      type: 'BATCH',
      payload: []
    };
    
    Array.from(selectedNodeIds).forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        const connectedEdges = edges.filter(e => e.source_knowledge_point_id === nodeId || e.target_knowledge_point_id === nodeId);
        batchAction.payload.push({
          type: 'DELETE_NODE',
          payload: { node, edges: connectedEdges }
        });
      }
    });
    
    setConfirmModal({
      isOpen: true,
      title: '批量删除',
      message: `确定要删除选中的 ${selectedNodeIds.size} 个节点吗?`,
      onConfirm: () => {
        const nodeIds = Array.from(selectedNodeIds);
        
        asyncHandler(
          async () => {
            await batchDeleteNodesMutation.mutateAsync({ nodeIds, graphId: id });
            if (batchAction.payload.length > 0) {
              record(batchAction);
            }
            setSelectedNodeIds(new Set());
            setSelectedNode(null);
            setSidebarMode('none');
            return true;
          },
          {
            loadingSetter: setLoading,
            successMessage: '批量删除成功',
            errorMessage: '批量删除失败',
            onFinally: () => setConfirmModal({ ...state.confirmModal, isOpen: false })
          }
        );
      }
    });
  };

  const handleBatchLevelUpdate = async (level: string) => {
    if (!id || selectedNodeIds.size === 0) return;
    
    const nodeIds = Array.from(selectedNodeIds);
    
    const batchAction: HistoryAction = {
      type: 'BATCH',
      payload: []
    };
    
    nodeIds.forEach(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        batchAction.payload.push({
          type: 'UPDATE_NODE',
          payload: {
            id: nodeId,
            before: { level: node.level },
            after: { level: level as NodeLevel }
          }
        });
      }
    });
    
    await asyncHandler(
      async () => {
        await Promise.all(nodeIds.map(nodeId => 
          updateNodeMutation.mutateAsync({ id: nodeId, graphId: id, data: { level: level as NodeLevel } })
        ));
        if (batchAction.payload.length > 0) {
          record(batchAction);
        }
        return true;
      },
      {
        loadingSetter: setLoading,
        successMessage: `已将 ${selectedNodeIds.size} 个节点等级修改为 ${levelLabels[level] || level}`,
        errorMessage: '批量修改等级失败'
      }
    );
  };

  const handleUpdateNode = async (nodeId: string, updates: Partial<Node>) => {
    if (!id) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    await asyncHandler(
      async () => {
        const beforeState = {
          title: node.title,
          content: node.content,
          level: node.level,
          is_accepted: node.is_accepted,
          properties: node.properties
        };
        
        const afterState = {
          ...beforeState,
          ...updates
        };
        
        await updateNodeMutation.mutateAsync({
          id: nodeId,
          graphId: id,
          data: updates
        });
        
        record({
          type: 'UPDATE_NODE',
          payload: {
            id: nodeId,
            before: beforeState,
            after: afterState
          }
        });
        
        return true;
      },
      {
        loadingSetter: setLoading,
        successMessage: '节点状态已更新',
        errorMessage: '更新节点失败'
      }
    );
  };

  return {
    handleSaveNode,
    handleDeleteNode,
    handleBatchDelete,
    handleBatchLevelUpdate,
    handleUpdateNode,
    handleCloseSidebar,
    handleToggleCollapse,
    handleStartCreate: () => {
      setNodeForm({
        title: '',
        content: '',
        parentNodeIds: selectedNode?.id ? [selectedNode.id] : [],
        level: 'leaf',
        tags: []
      });
      setSidebarMode('create');
    },
    handleHardDelete: (nodeToDelete: Node | null = selectedNode) => handleDeleteNode(nodeToDelete, true)
  };
};
