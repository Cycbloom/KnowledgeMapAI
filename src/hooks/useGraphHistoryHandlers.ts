import { useCallback } from 'react';
import { Node, Edge } from '../types';
import { useHistory } from './useHistory';

interface UseGraphHistoryHandlersProps {
  mutations: any; // Ideally typed to ReturnType<typeof useGraphMutations>
}

export const useGraphHistoryHandlers = ({ mutations }: UseGraphHistoryHandlersProps) => {
  const {
    createNodeMutation,
    updateNodeMutation,
    deleteNodeMutation,
    createEdgeMutation,
    deleteEdgeMutation
  } = mutations;

  const handleCreateNodeHistory = useCallback((payload: Node) => {
    deleteNodeMutation.mutate({ id: payload.id });
  }, [deleteNodeMutation]);

  const handleUpdateNodeHistory = useCallback((payload: { before: any, after: any }) => {
    updateNodeMutation.mutate({
      id: payload.before.id,
      data: {
        title: payload.before.title,
        content: payload.before.content,
        color: payload.before.color,
        level: payload.before.level
      }
    });
  }, [updateNodeMutation]);

  const handleDeleteNodeHistory = useCallback((payload: any) => {
    const { node, edges: nodeEdges } = payload;
    createNodeMutation.mutate(node);
    if (nodeEdges && Array.isArray(nodeEdges)) {
      nodeEdges.forEach((edge: Edge) => createEdgeMutation.mutate(edge));
    }
  }, [createNodeMutation, createEdgeMutation]);

  const handleCreateEdgeHistory = useCallback((payload: Edge) => {
    deleteEdgeMutation.mutate(payload.id);
  }, [deleteEdgeMutation]);

  const handleDeleteEdgeHistory = useCallback((payload: Edge) => {
    createEdgeMutation.mutate(payload);
  }, [createEdgeMutation]);

  const handleBatchHistory = useCallback((payload: any[]) => {
    // Reverse batch operations
    [...payload].reverse().forEach(action => {
      switch (action.type) {
        case 'CREATE_NODE': handleCreateNodeHistory(action.payload); break;
        case 'UPDATE_NODE': handleUpdateNodeHistory(action.payload); break;
        case 'DELETE_NODE': handleDeleteNodeHistory(action.payload); break;
        case 'CREATE_EDGE': handleCreateEdgeHistory(action.payload); break;
        case 'DELETE_EDGE': handleDeleteEdgeHistory(action.payload); break;
      }
    });
  }, [handleCreateNodeHistory, handleUpdateNodeHistory, handleDeleteNodeHistory, handleCreateEdgeHistory, handleDeleteEdgeHistory]);

  const history = useHistory({
    createNode: (node) => createNodeMutation.mutateAsync(node),
    updateNode: (params) => updateNodeMutation.mutateAsync(params),
    deleteNode: (params) => deleteNodeMutation.mutateAsync(params),
    createEdge: (edge) => createEdgeMutation.mutateAsync(edge),
    deleteEdge: (params) => deleteEdgeMutation.mutateAsync(params),
  });

  return history;
};
