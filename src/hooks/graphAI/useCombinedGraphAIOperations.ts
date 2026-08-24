import { Node, Edge } from '../../types';
import { getLevel } from '../../utils/graph/graphUtils';
import { message } from '../../utils/messageHelper';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { queryKeys } from '../queries/config';
import { useAIExpandMutation, useCreateNodeMutation, useCreateEdgeMutation, useUpdateNodeMutation } from '../mutations';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createAsyncHandler } from '../../utils/asyncHandler';
import {
  processExpandSuggestions,
  getExistingTitles,
  getCurrentChildrenTitles,
  buildDefaultExpandPrompt
} from '../utils/nodeExpansionUtils';

interface UseCombinedGraphAIOperationsProps {
  graph1Id: string;
  graph2Id: string;
  selectedNode: Node | null;
  nodes1: Node[];
  nodes2: Node[];
  edges1: Edge[];
  edges2: Edge[];
  onRefresh: () => void;
}

export function useCombinedGraphAIOperations(props: UseCombinedGraphAIOperationsProps) {
  const { graph1Id, graph2Id, selectedNode, nodes1, nodes2, edges1, edges2, onRefresh } = props;
  
  const queryClient = useQueryClient();
  const asyncHandler = createAsyncHandler();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const aiExpandMutation = useAIExpandMutation();
  const createNodeMutation = useCreateNodeMutation();
  const createEdgeMutation = useCreateEdgeMutation();
  const updateNodeMutation = useUpdateNodeMutation();
  
  const getNodesForGraph = (graphId: string): Node[] => {
    if (graphId === graph1Id) return nodes1;
    if (graphId === graph2Id) return nodes2;
    return [];
  };
  
  const getEdgesForGraph = (graphId: string): Edge[] => {
    if (graphId === graph1Id) return edges1;
    if (graphId === graph2Id) return edges2;
    return [];
  };
  
  const getCurrentGraphId = (): string | null => {
    if (!selectedNode) return null;
    return selectedNode.graph_id || null;
  };
  
  const handleExpandNode = async (prompt?: string) => {
    if (!selectedNode) {
      message.error(t('toast.graphAI.mergeGraphs.selectNodeFirst'));
      return null;
    }

    const currentGraphId = getCurrentGraphId();
    if (!currentGraphId) {
      message.error(t('toast.graphAI.mergeGraphs.cannotDetermineGraph'));
      return null;
    }

    if (!selectedNode.title) {
      message.error(t('toast.graphAI.mergeGraphs.nodeTitleEmpty'));
      return null;
    }

    return await asyncHandler(
      async () => {
        const nodes = getNodesForGraph(currentGraphId);
        const edges = getEdgesForGraph(currentGraphId);

        const parentLevel = getLevel(selectedNode, edges);

        const existingTitles = getExistingTitles(nodes);
        const currentChildrenTitles = getCurrentChildrenTitles(selectedNode.id, nodes, edges);

        const expandPrompt = prompt || buildDefaultExpandPrompt(selectedNode.title);

        const res = await aiExpandMutation.mutateAsync({
          node_title: selectedNode.title,
          node_content: selectedNode.content,
          node_level: parentLevel,
          existing_titles: existingTitles,
          current_children: currentChildrenTitles,
          expand_prompt: expandPrompt,
          graph_id: currentGraphId
        });

        const result = await processExpandSuggestions({
          selectedNode,
          nodes,
          edges,
          suggestions: res.suggestions,
          graphId: currentGraphId,
          createNode: async (data) => {
            const node = await createNodeMutation.mutateAsync(data);
            return node;
          },
          createEdge: async (data) => {
            const edge = await createEdgeMutation.mutateAsync(data);
            return edge;
          }
        });

        onRefresh();

        return result;
      },
      {
        onSuccess: (result) => {
          if (result && (result.newNodesCount > 0 || result.newEdgesCount > 0)) {
            message.success(t('toast.graphAI.mergeGraphs.expandComplete', { nodesCount: result.newNodesCount, edgesCount: result.newEdgesCount }));
          } else {
            message.info(t('toast.graphAI.mergeGraphs.noNewRelations'));
          }
        },
        errorMessage: t('toast.graphAI.mergeGraphs.expandFailed')
      }
    );
  };
  
  const handleGenerateContent = async (prompt?: string) => {
    if (!selectedNode) {
      message.error(t('toast.graphAI.mergeGraphs.selectNodeFirst'));
      return null;
    }

    const currentGraphId = getCurrentGraphId();
    if (!currentGraphId) {
      message.error(t('toast.graphAI.mergeGraphs.cannotDetermineGraph'));
      return null;
    }

    message.info(t('toast.graphAI.content.started'));

    return await asyncHandler(
      async () => {
        const contextPrompt = prompt || `请详细解释 ${selectedNode.title} 的核心概念、特点和应用。\n\n请直接输出 Markdown 格式的正文内容，严禁包含任何开场白（如"好的"、"作为..."）、结束语或无关的对话内容。`;

        let generatedContent = '';

        await api.ai.generateContentStream(
          {
            topic: selectedNode.title || '',
            context: contextPrompt,
            level: selectedNode.level
          },
          (chunk) => {
            generatedContent += chunk;
          }
        );

        if (generatedContent) {
          await updateNodeMutation.mutateAsync({
            id: selectedNode.id,
            data: { content: generatedContent }
          });

          queryClient.invalidateQueries({ queryKey: queryKeys.graphData(currentGraphId) });
          onRefresh();
        }

        return generatedContent;
      },
      {
        successMessage: t('toast.graphAI.content.completed'),
        errorMessage: t('toast.graphAI.content.failed')
      }
    );
  };
  
  const handleGenerateCards = () => {
    if (!selectedNode) {
      message.error(t('toast.graphAI.mergeGraphs.selectNodeFirst'));
      return;
    }

    const currentGraphId = getCurrentGraphId();
    navigate(`/study?node_id=${selectedNode.id}&graph_id=${currentGraphId || ''}&view=bank`);
  };
  
  const handleStartLevelTest = () => {
    if (!selectedNode) {
      message.error(t('toast.graphAI.mergeGraphs.selectNodeFirst'));
      return;
    }

    const currentGraphId = getCurrentGraphId();
    navigate(`/study?node_id=${selectedNode.id}&graph_id=${currentGraphId || ''}`);
  };

  const handleStartLearningMode = () => {
    if (!selectedNode) {
      message.error(t('toast.graphAI.mergeGraphs.selectNodeFirst'));
      return;
    }

    const currentGraphId = getCurrentGraphId();
    navigate(`/learning?node_id=${selectedNode.id}&graph_id=${currentGraphId || ''}`);
  };

  const handleAnalyzeCrossGraphConnections = async () => {
    return await asyncHandler(
      async () => {
        const { user } = useStore.getState();
        const aiConfig = user?.profile?.settings?.ai_config?.text;
        const provider = aiConfig?.provider;
        const model = aiConfig?.model;

        const allNodes1 = nodes1.map(n => ({ id: n.id, title: n.title, content: n.content }));
        const allNodes2 = nodes2.map(n => ({ id: n.id, title: n.title, content: n.content }));

        const result = await api.ai.analyzeCrossGraphConnections({
          graph1_id: graph1Id,
          graph1_nodes: allNodes1,
          graph2_id: graph2Id,
          graph2_nodes: allNodes2,
          provider,
          model
        });

        return result;
      },
      {
        successMessage: t('toast.graphAI.analyzeCrossDomain.analysisComplete'),
        errorMessage: t('toast.graphAI.analyzeCrossDomain.analysisFailed')
      }
    );
  };
  
  return {
    handleExpandNode,
    handleGenerateContent,
    handleGenerateCards,
    handleStartLevelTest,
    handleStartLearningMode,
    handleAnalyzeCrossGraphConnections,
    getCurrentGraphId
  };
}
