import { useMemo } from 'react';
import { 
  useCreateNodeMutation, 
  useUpdateNodeOptimisticMutation, 
  useDeleteNodeMutation, 
  useBatchDeleteNodesMutation, 
  useCreateEdgeMutation, 
  useDeleteEdgeMutation, 
  useAIGenerateMutation, 
  useAIExpandMutation, 
  useAIGenerateCardsMutation, 
  useCreateCardsBatchMutation, 
  useRecommendConnectionsMutation, 
  useDeleteGraphMutation, 
  useCreateTaskMutation 
} from './useQueries';

export const useGraphMutations = () => {
  const createNodeMutation = useCreateNodeMutation();
  const updateNodeMutation = useUpdateNodeOptimisticMutation();
  const deleteNodeMutation = useDeleteNodeMutation();
  const batchDeleteNodesMutation = useBatchDeleteNodesMutation();
  const createEdgeMutation = useCreateEdgeMutation();
  const deleteEdgeMutation = useDeleteEdgeMutation();
  const aiGenerateMutation = useAIGenerateMutation();
  const aiExpandMutation = useAIExpandMutation();
  const aiGenerateCardsMutation = useAIGenerateCardsMutation();
  const createCardsBatchMutation = useCreateCardsBatchMutation();
  const recommendConnectionsMutation = useRecommendConnectionsMutation();
  const deleteGraphMutation = useDeleteGraphMutation();
  const createTaskMutation = useCreateTaskMutation();

  return useMemo(() => ({
    createNodeMutation,
    updateNodeMutation,
    deleteNodeMutation,
    batchDeleteNodesMutation,
    createEdgeMutation,
    deleteEdgeMutation,
    aiGenerateMutation,
    aiExpandMutation,
    aiGenerateCardsMutation,
    createCardsBatchMutation,
    recommendConnectionsMutation,
    deleteGraphMutation,
    createTaskMutation
  }), [
    createNodeMutation,
    updateNodeMutation,
    deleteNodeMutation,
    batchDeleteNodesMutation,
    createEdgeMutation,
    deleteEdgeMutation,
    aiGenerateMutation,
    aiExpandMutation,
    aiGenerateCardsMutation,
    createCardsBatchMutation,
    recommendConnectionsMutation,
    deleteGraphMutation,
    createTaskMutation
  ]);
};
