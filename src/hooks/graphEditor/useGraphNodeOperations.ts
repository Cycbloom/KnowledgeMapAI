import { useCallback, useState } from 'react';
import type { Node, Edge, NodeLevel } from '../../types';
import type { CreateNodeData, UpdateNodeData } from '@shared/types/api';
import { HistoryAction } from '../common/useHistory';
import { GraphEditorState } from './index';
import { message } from '../../utils/messageHelper';
import { levelLabels } from '../../config/graphConfig';
import { createAsyncHandler } from '../../utils/asyncHandler';
import { UseMutationResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

interface GraphNodeMutations {
  createNodeMutation: UseMutationResult<Node, Error, CreateNodeData, unknown>;
  updateNodeMutation: UseMutationResult<Node, Error, { id: string; data: UpdateNodeData; graphId: string }, unknown>;
  deleteNodeMutation: UseMutationResult<{ affected_graphs?: string[] }, Error, { id: string; graphId: string; hardDelete?: boolean }, unknown>;
  createEdgeMutation: UseMutationResult<Edge, Error, { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship_type: string; graphId?: string }, unknown>;
  deleteEdgeMutation: UseMutationResult<unknown, Error, { id: string }, unknown>;
  batchDeleteNodesMutation: UseMutationResult<unknown, Error, { nodeIds: string[]; graphId: string }, unknown>;
}

interface UseGraphNodeOperationsProps {
  id: string;
  nodes: Node[];
  edges: Edge[];
  state: GraphEditorState;
  mutations: GraphNodeMutations;
  record: (action: HistoryAction) => void;
}

export const useGraphNodeOperations = ({
  id,
  nodes,
  edges,
  state,
  mutations,
  record
}: UseGraphNodeOperationsProps) => {
  const asyncHandler = createAsyncHandler();
  const { t } = useTranslation();
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

  const [batchDeleteProgress, setBatchDeleteProgress] = useState<{ completed: number; total: number } | null>(null);

  const handleSaveNode = async (options?: { exitToDetail?: boolean }) => {
    if (!id) return;
    const shouldExitToDetail = options?.exitToDetail ?? false;

    await asyncHandler(
      async () => {
        if (sidebarMode === 'create') {
          const newNode = await createNodeMutation.mutateAsync({
            graph_id: id,
            title: nodeForm.title,
            content: nodeForm.content,
            summary: nodeForm.summary,
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
                relationship_type: 'contains',
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
            summary: selectedNode.summary,
            level: selectedNode.level,
            tags: selectedNode.properties?.tags,
            properties: selectedNode.properties
          };

          const updateData = {
            graph_id: selectedNode.graph_id,
            title: nodeForm.title,
            content: nodeForm.content,
            summary: nodeForm.summary,
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
              relationship_type: 'contains',
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
          if (shouldExitToDetail) {
            setSidebarMode('detail');
          }
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
    state.setFocusedNodeId(null);
    state.setFocusedNodeIds(new Set());
    state.setFocusedLinkIds(new Set());
    state.setForceShowTextIds(new Set());
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
    
    const confirmMessage = hardDelete 
      ? `确定要彻底删除知识点 "${nodeToDelete.title}" 吗？此操作将从所有图谱中移除此知识点，且不可恢复！`
      : `确定要从当前图谱移除节点 "${nodeToDelete.title}" 吗？`;
    
    setConfirmModal({
      isOpen: true,
      title: hardDelete ? '彻底删除知识点' : '移除节点',
      message: confirmMessage,
      onConfirm: () => {
        deleteNodeMutation.mutate({ id: nodeToDelete.id, graphId: id, hardDelete }, {
          onSuccess: (data: { affected_graphs?: string[] }) => {
            record({ 
              type: 'DELETE_NODE', 
              payload: { node: nodeToDelete, edges: connectedEdges } 
            });
            if (selectedNode?.id === nodeToDelete.id) {
              handleCloseSidebar();
            }
            if (hardDelete && data?.affected_graphs?.length) {
              message.success(t('graphEditor.nodeDeletedFromGraphs', { count: data.affected_graphs.length }));
            } else {
              message.success(t('graphEditor.nodeDeleted'));
            }
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
          },
          onError: (err: unknown) => {
            console.error(err);
            message.error(t('graphEditor.nodeDeleteFailed'));
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
        const total = nodeIds.length;
        setBatchDeleteProgress({ completed: 0, total });

        asyncHandler(
          async () => {
            let completed = 0;
            for (const nodeId of nodeIds) {
              try {
                await batchDeleteNodesMutation.mutateAsync({ nodeIds: [nodeId], graphId: id });
              } catch (err) {
                console.error(err);
              }
              completed += 1;
              setBatchDeleteProgress({ completed, total });
            }
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
            onFinally: () => {
              setConfirmModal({ ...state.confirmModal, isOpen: false });
              setBatchDeleteProgress(null);
            }
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
    batchDeleteProgress,
    handleStartCreate: () => {
      setNodeForm({
        title: '',
        content: '',
        summary: '',
        parentNodeIds: selectedNode?.id ? [selectedNode.id] : [],
        level: 'leaf',
        tags: []
      });
      setSidebarMode('create');
    },
    handleHardDelete: (nodeToDelete: Node | null = selectedNode) => handleDeleteNode(nodeToDelete, true)
  };
};
