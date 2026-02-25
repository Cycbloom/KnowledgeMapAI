import { useHistory } from './useHistory';

interface UseGraphHistoryHandlersProps {
  mutations: any;
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
    createNode: (node) => createNodeMutation.mutateAsync(node),
    updateNode: (params) => updateNodeMutation.mutateAsync(params),
    deleteNode: (params) => deleteNodeMutation.mutateAsync(params),
    createEdge: (edge) => createEdgeMutation.mutateAsync(edge),
    deleteEdge: (params) => deleteEdgeMutation.mutateAsync(params),
  });

  return history;
};
