import { useCallback } from 'react';
import { Node, Edge, NodeLevel } from '../types';
import { getLevel } from '../lib/graphUtils';
import { HistoryAction } from './useHistory';
import { GraphEditorState } from './useGraphEditorState';
import { useMessageStore } from '../store/useMessageStore';
import { levelLabels } from '../config/graphConfig';

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
    setLoading(true);
    try {
      if (sidebarMode === 'create') {
        const newNode = await createNodeMutation.mutateAsync({
          graph_id: id,
          title: nodeForm.title,
          content: nodeForm.content,
          x_position: Math.round((Math.random() - 0.5) * 20),
          y_position: Math.round((Math.random() - 0.5) * 20),
          color: nodeForm.color,
          level: nodeForm.level,
          tags: nodeForm.tags,
          properties: {}
        });

        if (nodeForm.parentNodeId) {
          const newEdge = await createEdgeMutation.mutateAsync({
            source_node_id: nodeForm.parentNodeId,
            target_node_id: newNode.id,
            relationship_type: 'related',
            graphId: id
          });
          record({ type: 'CREATE_EDGE', payload: newEdge });
        }

        record({ type: 'CREATE_NODE', payload: newNode });

        setSelectedNode(newNode);
        setSidebarMode('edit');
      } else if (sidebarMode === 'edit' && selectedNode) {
        const beforeState = {
          graph_id: selectedNode.graph_id,
          title: selectedNode.title,
          content: selectedNode.content,
          color: selectedNode.color,
          level: selectedNode.level,
          tags: selectedNode.tags,
          properties: selectedNode.properties
        };

        const updateData = {
          graph_id: selectedNode.graph_id,
          title: nodeForm.title,
          content: nodeForm.content,
          color: nodeForm.color,
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

        const currentParentEdge = edges.find(e => e.target_node_id === selectedNode.id);
        const newParentId = nodeForm.parentNodeId;
        
        if (currentParentEdge && currentParentEdge.source_node_id !== newParentId) {
          await deleteEdgeMutation.mutateAsync({ id: currentParentEdge.id });
          actions.push({ type: 'DELETE_EDGE', payload: currentParentEdge });
        }
        
        if (newParentId && (!currentParentEdge || currentParentEdge.source_node_id !== newParentId)) {
          if (newParentId !== selectedNode.id) {
            const newEdge = await createEdgeMutation.mutateAsync({
              source_node_id: newParentId,
              target_node_id: selectedNode.id,
              relationship_type: 'related',
              graphId: id
            });
            actions.push({ type: 'CREATE_EDGE', payload: newEdge });
          }
        }
        
        if (actions.length === 1) {
          record(actions[0]);
        } else if (actions.length > 1) {
          record({ type: 'BATCH', payload: actions });
        }
        
        setSelectedNode(updated);
        setSidebarMode('edit');
      }
      addMessage({ type: 'success', content: sidebarMode === 'create' ? '节点创建成功' : '节点保存成功' });
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '保存失败，请重试' });
    } finally {
      setLoading(false);
    }
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

  const handleDeleteNode = (nodeToDelete: Node | null = selectedNode) => {
    if (!nodeToDelete || !id) return;
    
    const connectedEdges = edges.filter(e => 
      e.source_node_id === nodeToDelete.id || e.target_node_id === nodeToDelete.id
    );
    
    setConfirmModal({
      isOpen: true,
      title: '删除节点',
      message: `确定要删除节点 "${nodeToDelete.title}" 吗?`,
      onConfirm: () => {
        deleteNodeMutation.mutate({ id: nodeToDelete.id, graphId: id }, {
          onSuccess: () => {
            record({ 
              type: 'DELETE_NODE', 
              payload: { node: nodeToDelete, edges: connectedEdges } 
            });
            if (selectedNode?.id === nodeToDelete.id) {
              handleCloseSidebar();
            }
            addMessage({ type: 'success', content: '节点已删除' });
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
        const connectedEdges = edges.filter(e => e.source_node_id === nodeId || e.target_node_id === nodeId);
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
        setLoading(true);
        const nodeIds = Array.from(selectedNodeIds);
        
        batchDeleteNodesMutation.mutateAsync({ nodeIds, graphId: id })
          .then(() => {
            if (batchAction.payload.length > 0) {
              record(batchAction);
            }
            setSelectedNodeIds(new Set());
            setSelectedNode(null);
            setSidebarMode('none');
            addMessage({ content: '批量删除成功', type: 'success' });
          }).catch((err: any) => {
            console.error(err);
            addMessage({ content: '批量删除失败', type: 'error' });
          }).finally(() => {
            setLoading(false);
            setConfirmModal({ ...state.confirmModal, isOpen: false });
          });
      }
    });
  };

  const handleBatchColorUpdate = async (color: string) => {
    if (!id || selectedNodeIds.size === 0) return;
    
    setLoading(true);
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
            before: { color: node.color },
            after: { color }
          }
        });
      }
    });
    
    try {
      await Promise.all(nodeIds.map(nodeId => 
        updateNodeMutation.mutateAsync({ id: nodeId, graphId: id, data: { color } })
      ));
      if (batchAction.payload.length > 0) {
        record(batchAction);
      }
      addMessage({ content: `已将 ${selectedNodeIds.size} 个节点颜色修改为 ${color}`, type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: '批量修改颜色失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleBatchLevelUpdate = async (level: string) => {
    if (!id || selectedNodeIds.size === 0) return;
    
    setLoading(true);
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
    
    try {
      await Promise.all(nodeIds.map(nodeId => 
        updateNodeMutation.mutateAsync({ id: nodeId, graphId: id, data: { level: level as NodeLevel } })
      ));
      if (batchAction.payload.length > 0) {
        record(batchAction);
      }
      addMessage({ content: `已将 ${selectedNodeIds.size} 个节点等级修改为 ${levelLabels[level] || level}`, type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: '批量修改等级失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNode = async (nodeId: string, updates: Partial<Node>) => {
    if (!id) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setLoading(true);
    try {
      const beforeState = {
        title: node.title,
        content: node.content,
        color: node.color,
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
      
      addMessage({ type: 'success', content: '节点状态已更新' });
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '更新节点失败' });
    } finally {
      setLoading(false);
    }
  };

  return {
    handleSaveNode,
    handleDeleteNode,
    handleBatchDelete,
    handleBatchColorUpdate,
    handleBatchLevelUpdate,
    handleUpdateNode,
    handleCloseSidebar,
    handleToggleCollapse,
    handleStartCreate: () => {
      setNodeForm({
        title: '',
        content: '',
        color: '#3B82F6',
        parentNodeId: selectedNode?.id || '',
        level: 'leaf',
        tags: []
      });
      setSidebarMode('create');
    }
  };
};
