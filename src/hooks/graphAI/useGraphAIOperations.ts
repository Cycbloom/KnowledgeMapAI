import { Node, Edge, BranchSuggestion, ExplorationPathItem } from '../../types';
import type { CreateNodeData, UpdateNodeData } from '@shared/types/api';
import type { AIAction } from '@shared/types/ai';
import type { BatchGenerateConfig } from '../../components/GraphEditor/modals/BatchGenerateDialog';
import type { RelatedNode } from '../graphEditor/useMiscState';
import { getLevel, getNextLevel, getLevelColorHex } from '../../lib/graphUtils';
import { HistoryAction } from '../common/useHistory';
import { GraphEditorState } from '../graphEditor';
import { message } from '../../utils/messageHelper';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { queryKeys } from '../queries/config';
import { useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { createAsyncHandler } from '../../utils/asyncHandler';
import { useTranslation } from 'react-i18next';
import {
  processExpandSuggestions,
  getExistingTitles,
  getCurrentChildrenTitles,
  buildDefaultExpandPrompt
} from '../utils/nodeExpansionUtils';

interface AIGeneratedCard {
  question: string;
  answer: string;
  type: string;
  options?: string[];
}

interface AIExpandResult {
  suggestions: Array<{
    title: string;
    description?: string;
    level?: string;
  }>;
}

interface AIExpandVariables {
  node_title: string;
  node_content?: string;
  existing_titles?: string[];
  current_children?: string[];
  node_level?: string;
  expand_prompt?: string;
  graph_id?: string;
  provider?: string;
  model?: string;
  language?: string;
}

interface AIGenerateCardsVariables {
  node_title: string;
  node_content?: string;
  count?: number;
  types?: string[];
  provider?: string;
  model?: string;
  language?: string;
}

interface RecommendConnectionsVariables {
  graph_id: string;
  node_title: string;
  node_content?: string;
}

interface GraphAIMutations {
  aiExpandMutation: UseMutationResult<AIExpandResult, Error, AIExpandVariables, unknown>;
  aiGenerateCardsMutation: UseMutationResult<{ cards: AIGeneratedCard[] }, Error, AIGenerateCardsVariables, unknown>;
  createCardsBatchMutation: UseMutationResult<unknown, Error, unknown[], unknown>;
  createTaskMutation: UseMutationResult<unknown, Error, { type: string; payload: unknown }, unknown>;
  createNodeMutation: UseMutationResult<Node, Error, CreateNodeData, unknown>;
  createEdgeMutation: UseMutationResult<Edge, Error, { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship_type: string; graphId?: string }, unknown>;
  updateNodeMutation: UseMutationResult<Node, Error, { id: string; data: UpdateNodeData; graphId: string }, unknown>;
  recommendConnectionsMutation: UseMutationResult<unknown, Error, RecommendConnectionsVariables, unknown>;
}

interface UseGraphAIOperationsProps {
  id: string;
  nodes: Node[];
  edges: Edge[];
  state: GraphEditorState;
  mutations: GraphAIMutations;
  record: (action: HistoryAction) => void;
  navigate: (path: string) => void;
  token?: string | null;
  onActionResult: (result: { title: string; content: string } | null) => void;
}

export const useGraphAIOperations = ({
  id,
  nodes,
  edges,
  state,
  mutations,
  record,
  navigate,
  onActionResult
}: UseGraphAIOperationsProps) => {
  const queryClient = useQueryClient();
  const asyncHandler = createAsyncHandler();
  const { t } = useTranslation();
  const {
    nodeForm,
    selectedNode,
    selectedNodeIds,
    setLoading,
    aiPrompt, setAiPrompt
  } = state;
  const {
    aiExpandMutation,
    aiGenerateCardsMutation,
    createCardsBatchMutation,
    createTaskMutation,
    createNodeMutation,
    createEdgeMutation,
    updateNodeMutation
  } = mutations;

  const handleAIGenerate = async () => {
    if (!nodeForm.title) return;

    await asyncHandler(
      async () => {
        let prompt = aiPrompt;

        if (!prompt && selectedNode) {
          const nodeAiPrompt = selectedNode.properties?.ai_prompt;
          if (nodeAiPrompt && typeof nodeAiPrompt === 'string') {
            prompt = nodeAiPrompt.replace(/{主题}/g, selectedNode.title || '');

            const parentNode = nodes.find(n => n.id === edges.find(e => e.target_knowledge_point_id === selectedNode.id)?.source_knowledge_point_id);
            if (parentNode) {
              prompt = prompt.replace(/{父节点内容}/g, parentNode.content || parentNode.title || '');
            }

            const siblingNodes = nodes.filter(n =>
              n.id !== selectedNode.id &&
              edges.some(e =>
                e.source_knowledge_point_id === parentNode?.id &&
                e.target_knowledge_point_id === n.id
              )
            );
            if (siblingNodes.length > 0) {
              const siblingContent = siblingNodes.map(n => `- ${n.title}: ${n.content || ''}`).join('\n');
              prompt = prompt.replace(/{兄弟节点内容}/g, siblingContent);
            }
          }
        }

        if (!prompt) {
          prompt = `请详细解释 ${nodeForm.title} 的核心概念、特点和应用`;
        }

        setAiPrompt(prompt);

        await api.ai.generateContentStream(
          {
            topic: nodeForm.title,
            context: prompt,
            level: nodeForm.level
          },
          (chunk) => {
            state.setNodeForm(prev => ({
              ...prev,
              content: (prev.content || '') + chunk
            }));
          }
        );
        setAiPrompt('');
        return true;
      },
      {
        loadingSetter: setLoading,
        successMessage: t('toast.graphAI.generateContent.completed'),
        errorMessage: t('toast.graphAI.generateContent.failed')
      }
    );
  };

  const handleAIExpand = async () => {
    if (!selectedNode || !id) return;

    if (!selectedNode.title) {
      message.error(t('toast.graphAI.nodeTitleRequired'));
      return;
    }

    await asyncHandler(
      async () => {
        const parentLevel = getLevel(selectedNode, edges);

        const existingTitles = getExistingTitles(nodes);
        const currentChildrenTitles = getCurrentChildrenTitles(selectedNode.id, nodes, edges);

        const expandPrompt = aiPrompt || buildDefaultExpandPrompt(selectedNode.title);

        const res = await aiExpandMutation.mutateAsync({
          node_title: selectedNode.title,
          node_content: selectedNode.content,
          node_level: parentLevel,
          existing_titles: existingTitles,
          current_children: currentChildrenTitles,
          expand_prompt: expandPrompt,
        });

        const result = await processExpandSuggestions({
          selectedNode,
          nodes,
          edges,
          suggestions: res.suggestions,
          graphId: id,
          createNode: async (data) => {
            const node = await createNodeMutation.mutateAsync(data);
            record({ type: 'CREATE_NODE', payload: node });
            return node;
          },
          createEdge: async (data) => {
            const edge = await createEdgeMutation.mutateAsync(data);
            record({ type: 'CREATE_EDGE', payload: edge });
            return edge;
          }
        });

        return result;
      },
      {
        loadingSetter: setLoading,
        onSuccess: (result) => {
          if (result && (result.newNodesCount > 0 || result.newEdgesCount > 0)) {
            message.success(t('toast.graphAI.expandComplete'));
          } else {
            message.info(t('toast.graphAI.noNewRelations'));
          }
        },
        errorMessage: t('toast.graphAI.expandFailed')
      }
    );
  };

  const handleAIGenerateCards = async () => {
    if (!selectedNode || !id) return;

    await asyncHandler(
      async () => {
        const res = await aiGenerateCardsMutation.mutateAsync({
          node_title: selectedNode.title,
          node_content: selectedNode.content
        });

        const cards = res.cards.map((c: AIGeneratedCard) => ({
          node_id: selectedNode.id,
          question: c.question,
          answer: c.answer,
          type: c.type,
          options: c.options
        }));

        if (cards.length === 0) {
          message.error(t('toast.graphAI.cardGenerateFailed'));
          return null;
        }

        await createCardsBatchMutation.mutateAsync(cards);
        queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(id) });
        return cards.length;
      },
      {
        loadingSetter: setLoading,
        errorMessage: t('toast.graphAI.cardGenerateFailed'),
        onSuccess: (result) => {
          if (result && typeof result === 'number') {
            message.success(t('toast.graphAI.cardGenerateSuccess', { count: result }));
          }
        }
      }
    );
  };

  const handleBackgroundTask = async (type: 'generate_questions' | 'expand_graph' | 'batch_generate_questions' | 'deep_analysis', params?: BatchGenerateConfig | Record<string, unknown>) => {
    if (selectedNodeIds.size === 0 && !selectedNode) return;
    if (!id) return;

    const nodesToProcess = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds).map(nid => nodes.find(n => n.id === nid)).filter((n): n is NonNullable<typeof n> => Boolean(n))
      : [selectedNode].filter((n): n is NonNullable<typeof n> => Boolean(n));

    if (nodesToProcess.length === 0) return;

    await asyncHandler(
      async () => {
        const { user } = useStore.getState();
        const aiConfig = user?.profile?.settings?.ai_config?.text;
        const provider = aiConfig?.provider;
        const model = aiConfig?.model;

        if (type === 'batch_generate_questions') {
          message.info(t('toast.graphAI.submitting'), { duration: 2000 });

          const nodeIds = nodesToProcess.map(n => n.id);

          const batchParams = params as BatchGenerateConfig | undefined;
          await api.ai.batchGenerateCards(nodeIds, {
            types: batchParams?.types,
            count: batchParams?.count,
            pack_template: batchParams?.pack_template ?? undefined,
            provider,
            model
          });

          message.success(t('toast.graphAI.submitSuccess'), { duration: 3000 });
          return true;
        }

        for (const node of nodesToProcess) {
          if (!node) continue;

          const payload: Record<string, unknown> = {
            graph_id: id,
            node_id: node.id,
            node_title: node.title,
            node_content: node.content,
            provider,
            model,
            ...params
          };

          if (type === 'expand_graph') {
            const existingTitles = nodes.map(n => n.title);

            const currentChildrenIds = edges
              .filter(e => e.source_knowledge_point_id === node.id)
              .map(e => e.target_knowledge_point_id);
            const currentChildrenTitles = nodes
              .filter(n => currentChildrenIds.includes(n.id))
              .map(n => n.title);

            payload.existing_nodes = existingTitles;
            payload.child_nodes = currentChildrenTitles;
          }

          await createTaskMutation.mutateAsync({
            type,
            payload
          });
        }

        return true;
      },
      {
        successMessage: t('toast.graphAI.submitSuccess'),
        errorMessage: t('toast.graphAI.actionFailed'),
        onSuccess: () => {
          message.success(t('toast.graphAI.submitSuccess'), { duration: 3000 });
        }
      }
    );
  };

  const handleStartLevelTest = () => {
    if (!selectedNode) return;
    navigate(`/study?node_id=${selectedNode.id}`);
  };

  const handleStartLearningMode = () => {
    if (!selectedNode) return;
    navigate(`/learning?node_id=${selectedNode.id}&graph_id=${id}`);
  };

  const handleFetchRelatedNodes = async () => {
    if (!selectedNode) return;
    state.setIsRelatedLoading(true);
    state.setShowRelatedSection(true);

    await asyncHandler(
      async () => {
        const res = await api.nodes.getRelated(selectedNode.id);
        state.setRelatedNodes((res as RelatedNode[]) || []);
        return res;
      },
      {
        errorMessage: t('common.aiOperations.fetchRelatedNodesFailed'),
        onFinally: () => state.setIsRelatedLoading(false)
      }
    );
  };

  const handleGetBranchSuggestions = async () => {
    if (!selectedNode || !id) return [];

    const result = await asyncHandler(
      async () => {
        const parentLevel = getLevel(selectedNode, edges);

        const existingTitles = nodes.map(n => n.title);

        const currentChildrenIds = edges
          .filter(e => e.source_knowledge_point_id === selectedNode.id)
          .map(e => e.target_knowledge_point_id);
        const currentChildrenTitles = nodes
          .filter(n => currentChildrenIds.includes(n.id))
          .map(n => n.title);

        const res = await api.ai.getBranchSuggestions({
          node_title: selectedNode.title,
          node_content: selectedNode.content,
          existing_nodes: existingTitles,
          child_nodes: currentChildrenTitles,
          context_level: parentLevel
        });

        return res.suggestions || [];
      },
      {
        loadingSetter: setLoading,
        errorMessage: t('toast.graphAI.branch.getSuggestionsFailed')
      }
    );

    return result || [];
  };

  const handleCreateBranch = async (suggestion: BranchSuggestion, isAccepted: boolean = true) => {
    if (!selectedNode || !id) return null;

    return await asyncHandler(
      async () => {
        const parentLevel = getLevel(selectedNode, edges);
        const newLevel = getNextLevel(parentLevel);

        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 4;
        const x = Math.round(selectedNode.x_position + Math.cos(angle) * radius);
        const y = Math.round(selectedNode.y_position + Math.sin(angle) * radius);

        const newNode = await createNodeMutation.mutateAsync({
          graph_id: id,
          title: suggestion.title,
          content: suggestion.description,
          x_position: x,
          y_position: y,
          color: getLevelColorHex(newLevel),
          level: newLevel,
          is_accepted: isAccepted,
          properties: {
            branchSuggestionId: suggestion.id,
            priority: suggestion.priority,
            estimatedDifficulty: suggestion.estimatedDifficulty,
            relatedTopics: suggestion.relatedTopics
          }
        });

        record({ type: 'CREATE_NODE', payload: newNode });
        const newEdge = await createEdgeMutation.mutateAsync({
          source_knowledge_point_id: selectedNode.id,
          target_knowledge_point_id: newNode.id,
          relationship_type: 'branch',
          graphId: id
        });
        record({ type: 'CREATE_EDGE', payload: newEdge });
        return newNode;
      },
      {
        loadingSetter: setLoading,
        successMessage: t('toast.graphAI.branchSwitched'),
        errorMessage: t('toast.graphAI.expandFailed')
      }
    );
  };

  const handleSwitchBranch = async (pathItem: ExplorationPathItem, suggestion: BranchSuggestion) => {
    if (!id) return;

    await asyncHandler(
      async () => {
        const parentNode = nodes.find(n => n.id === pathItem.parentNodeId);
        if (!parentNode) return null;

        const branches = pathItem.alternativeBranches || [];
        const createdNodes: Array<{ node: Node; suggestion: BranchSuggestion; isAccepted: boolean }> = [];

        for (const branch of branches) {
          const isAccepted = branch.id === suggestion.id;
      const parentLevel = getLevel(parentNode, edges);
      const newLevel = getNextLevel(parentLevel);

      const newNode = await createNodeMutation.mutateAsync({
        graph_id: id,
        title: branch.title,
        content: branch.description,
        x_position: parentNode.x_position + (Math.random() - 0.5) * 8,
        y_position: parentNode.y_position + (Math.random() - 0.5) * 8,
        color: getLevelColorHex(newLevel),
        level: newLevel,
            is_accepted: isAccepted,
            properties: {
              branchSuggestionId: branch.id,
              priority: branch.priority,
              estimatedDifficulty: branch.estimatedDifficulty,
              relatedTopics: branch.relatedTopics
            }
          });

          record({ type: 'CREATE_NODE', payload: newNode });
          const newEdge = await createEdgeMutation.mutateAsync({
            source_knowledge_point_id: parentNode.id,
            target_knowledge_point_id: newNode.id,
            relationship_type: 'branch',
            graphId: id
          });
          record({ type: 'CREATE_EDGE', payload: newEdge });
          createdNodes.push({ node: newNode, suggestion: branch, isAccepted });
        }

        const selectedNodeData = createdNodes.find(n => n.isAccepted);
        if (selectedNodeData) {
          const { setExplorationPath } = state;
          const { setCurrentPathIndex } = state;
          const { setHistoricalAlternativeBranches } = state;

          setExplorationPath(prev => {
            const newPath = [...prev];
            const currentIndex = newPath.findIndex(item => item.nodeId === pathItem.parentNodeId);
            if (currentIndex !== -1) {
              newPath[currentIndex] = {
                nodeId: selectedNodeData.node.id,
                nodeTitle: selectedNodeData.node.title,
                timestamp: new Date(),
                branchChoice: selectedNodeData.suggestion.title,
                parentNodeId: parentNode.id,
                branchSuggestionId: selectedNodeData.suggestion.id,
                alternativeBranches: branches
              };
              setCurrentPathIndex(currentIndex);
            }
            return newPath;
          });

          setHistoricalAlternativeBranches(prev => [
            ...prev.filter(item => item.nodeId !== parentNode.id),
            {
              nodeId: parentNode.id,
              branches,
              selectedBranchId: suggestion.id
            }
          ]);
        }

        return selectedNodeData;
      },
      {
        loadingSetter: setLoading,
        errorMessage: t('toast.graphAI.branch.switchFailed'),
        onSuccess: (result) => {
          if (result) {
            message.success(t('toast.graphAI.branchSwitched'));
          }
        }
      }
    );
  };

  const handleGenerateNodeContent = async () => {
    if (!selectedNode || !id) return;

    const loadingId = message.loading(t('toast.graphAI.generateContent.started'));

    await asyncHandler(
      async () => {
        const prompt = `请详细解释 ${selectedNode.title} 的核心概念、特点和应用。\n\n请直接输出 Markdown 格式的正文内容，严禁包含任何开场白（如"好的"、"作为..."）、结束语或无关的对话内容。`;

        let generatedContent = '';

        await api.ai.generateContentStream(
          {
            topic: selectedNode.title || '',
            context: prompt,
            level: selectedNode.level
          },
          (chunk) => {
            generatedContent += chunk;
          }
        );

        if (generatedContent) {
          await updateNodeMutation.mutateAsync({
              id: selectedNode.id,
              graphId: id,
              data: { content: generatedContent }
          });

          queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
        }

        return generatedContent;
      },
      {
        loadingSetter: setLoading,
        successMessage: t('toast.graphAI.generateContent.completed'),
        errorMessage: t('toast.graphAI.generateContent.failed'),
        onFinally: () => {
          message.dismiss(loadingId);
        }
      }
    );
  };

  const handleExecuteAction = async (action: AIAction, nodeId: string) => {
    try {
      message.info(t('toast.graphAI.submitting'));
      const res = await api.aiActions.execute({
        action_id: action.id,
        node_id: nodeId,
        graph_id: id,
      });

      if (action.target_mode === "show_result" || typeof res.data === "string") {
        onActionResult({
          title: action.name,
          content: typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2),
        });
        message.success(t('toast.graphAI.actionSuccess'));
      } else {
        await queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(id) });

        let feedback = `${t('toast.graphAI.actionSuccess')}: ${action.name}`;
        if (res.message) feedback += ` (${res.message})`;

        if (action.target_mode === "update_node" && res.data?.updatedFields) {
          feedback += t('common.aiOperations.fieldsUpdated', { fields: res.data.updatedFields.join(", ") });
        } else if (action.target_mode === "spawn_children" && res.data?.createdCount) {
          feedback += t('common.aiOperations.childrenSpawned', { count: res.data.createdCount });
        }

        message.success(feedback);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('common.aiOperations.unknownError');
      message.error(`${t('toast.graphAI.actionFailed')}: ${errorMessage}`);
    }
  };

  return {
    handleAIGenerate,
    handleAIExpand,
    handleAIGenerateCards,
    handleBackgroundTask,
    handleStartLevelTest,
    handleStartLearningMode,
    handleFetchRelatedNodes,
    handleGetBranchSuggestions,
    handleCreateBranch,
    handleSwitchBranch,
    handleGenerateNodeContent,
    handleExecuteAction
  };
};
