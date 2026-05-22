import { useHistory } from '../common/useHistory';
import type { CreateNodeData, UpdateNodeData } from '@shared/types/api';
import type { Node, Edge } from '../../types';

interface GraphHistoryMutations {
  createNodeMutation: {
    mutateAsync: (data: CreateNodeData) => Promise<Node>;
  };
  updateNodeMutation: {
    mutateAsync: (params: { id: string; data: UpdateNodeData; graphId?: string }) => Promise<Node>;
  };
  deleteNodeMutation: {
    mutateAsync: (params: { id: string; graphId: string; hardDelete?: boolean }) => Promise<{ affected_graphs?: string[] }>;
  };
  createEdgeMutation: {
    mutateAsync: (data: { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship_type: string; graphId?: string }) => Promise<Edge>;
  };
  deleteEdgeMutation: {
    mutateAsync: (params: { id: string }) => Promise<void>;
  };
}

interface UseGraphHistoryHandlersProps {
  mutations: GraphHistoryMutations;
}

export const useGraphHistoryHandlers = ({ mutations }: UseGraphHistoryHandlersProps) => {
  const {
    createNodeMutation,
    updateNodeMutation,
    deleteNodeMutation,
    createEdgeMutation,
    deleteEdgeMutation
  } = mutations;

  const history = useHistory({
    createNode: (node) => createNodeMutation.mutateAsync({
      graph_id: node.graph_id,
      title: node.title || '',
      content: node.content,
      level: node.level,
      x_position: node.x_position,
      y_position: node.y_position,
      learning_material: node.learning_material,
      properties: node.properties,
    }),
    updateNode: (params) => updateNodeMutation.mutateAsync(params),
    deleteNode: async (params) => {
      await deleteNodeMutation.mutateAsync(params);
    },
    createEdge: (edge) => createEdgeMutation.mutateAsync({
      source_knowledge_point_id: edge.source_knowledge_point_id,
      target_knowledge_point_id: edge.target_knowledge_point_id,
      relationship_type: edge.relationship_type || 'related',
      graphId: edge.graph_id,
    }),
    deleteEdge: (params) => deleteEdgeMutation.mutateAsync(params),
  });

  return history;
};
