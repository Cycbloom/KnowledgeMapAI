import { useRef, useState } from 'react';
import { Node, Edge, BranchSuggestion, ExplorationPathItem, StudyCard } from '../../types';
import type { GenerateCardsFullConfig } from '../../components/Learning/GenerateCardsModal';
import type { CreateNodeData, UpdateNodeData } from '@shared/types/api';
import type { AIAction } from '@shared/types/ai';
import { getLevel, getNextLevel, getLevelColorHex } from '../../utils/graph/graphUtils';
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

interface AIExpandResult {
  suggestions: Array<{
    title: string;
    description?: string;
    level?: string;
  }>;
}

const TASK_TERMINAL_STATUSES = ["completed", "failed", "cancelled"];
const LEVEL_TEST_PROGRESS_MSG_ID = "level-test-generation-progress";

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

interface RecommendConnectionsVariables {
  graph_id: string;
  node_title: string;
  node_content?: string;
}

interface GraphAIMutations {
  aiExpandMutation: UseMutationResult<AIExpandResult, Error, AIExpandVariables, unknown>;
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

            // 预构建父节点出边目标集合，替代 nodes.filter 内 edges.some 的 O(nodes×edges) 扫描（降为 O(nodes)）
            const parentOutTargets = new Set<string>(
              edges
                .filter(e => e.source_knowledge_point_id === parentNode?.id)
                .map(e => e.target_knowledge_point_id),
            );
            const siblingNodes = nodes.filter(n =>
              n.id !== selectedNode.id &&
              parentOutTargets.has(n.id)
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

  const [isChallengeGenOpen, setIsChallengeGenOpen] = useState(false);
  const challengePendingRef = useRef(false);

  const startLevelTestSession = () => {
    if (!selectedNode || !id) return;
    navigate(`/study?node_id=${selectedNode.id}&graph_id=${id}&mode=quiz&from=graph`);
  };

  const handleStartLevelTest = async () => {
    if (!selectedNode || !id) return;
    try {
      const result = await api.study.getCards({ knowledge_point_id: selectedNode.id });
      const cards = Array.isArray(result)
        ? result
        : ((result as unknown as { cards?: StudyCard[] }).cards ?? []);
      if (cards.length === 0) {
        challengePendingRef.current = true;
        setIsChallengeGenOpen(true);
        message.info(t('nodeDetail.levelTestNoCards'));
        return;
      }
    } catch (error) {
      console.error("Failed to check node cards:", error);
    }
    startLevelTestSession();
  };

  const handleCloseChallengeGen = () => {
    setIsChallengeGenOpen(false);
    challengePendingRef.current = false;
  };

  const showLevelTestProgress = (done: number, total: number) => {
    message.loading(t('nodeDetail.levelTestGeneratingProgress', { current: done, total }), {
      id: LEVEL_TEST_PROGRESS_MSG_ID,
    });
  };

  const pollGenerationTasksThenStartTest = async (taskIds: string[]) => {
    showLevelTestProgress(0, taskIds.length);
    const intervalMs = 3000;
    const maxAttempts = 200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      if (!challengePendingRef.current) {
        message.dismiss(LEVEL_TEST_PROGRESS_MSG_ID);
        return;
      }
      const statuses = await Promise.all(
        taskIds.map((taskId) => api.ai.getTaskStatus(taskId).catch(() => null)),
      );
      const fetched = statuses.filter((s): s is { status: string } => !!s);
      const completedCount = fetched.filter((s) => s.status === "completed").length;
      showLevelTestProgress(completedCount, taskIds.length);
      const allSettled =
        fetched.length === taskIds.length &&
        fetched.every((s) => TASK_TERMINAL_STATUSES.includes(s.status));
      if (allSettled) {
        message.dismiss(LEVEL_TEST_PROGRESS_MSG_ID);
        challengePendingRef.current = false;
        if (completedCount === taskIds.length) {
          message.success(t('nodeDetail.levelTestReady'));
          setIsChallengeGenOpen(false);
          startLevelTestSession();
        } else {
          message.error(t('nodeDetail.levelTestGenerateFailed'));
        }
        return;
      }
    }
    message.dismiss(LEVEL_TEST_PROGRESS_MSG_ID);
    challengePendingRef.current = false;
    message.info(t('nodeDetail.levelTestGenerateTimeout'));
  };

  const handleChallengeGenerate = async (
    config: GenerateCardsFullConfig & { targetNodeIds: string[] },
  ) => {
    if (!selectedNode || !id) return;
    const targetIds = config.targetNodeIds?.length
      ? config.targetNodeIds
      : [selectedNode.id];
    if (
      targetIds.length === 0 ||
      config.types.length === 0 ||
      config.count <= 0
    ) {
      return;
    }

    try {
      const cardsPerTypeNum =
        config.cardsPerType && Object.keys(config.cardsPerType).length > 0
          ? Object.fromEntries(
              Object.entries(config.cardsPerType).map(([k, v]) => [k, Number(v ?? 0)]),
            )
          : undefined;
      const countPerDiffNum =
        config.countPerDifficulty && Object.keys(config.countPerDifficulty).length > 0
          ? Object.fromEntries(
              Object.entries(config.countPerDifficulty).map(([k, v]) => [k, Number(v ?? 0)]),
            )
          : undefined;
      const countMatrix =
        config.countMatrix && Object.keys(config.countMatrix).length > 0
          ? Object.fromEntries(
              Object.entries(config.countMatrix).map(([k, v]) => [
                k,
                {
                  easy: Number(v.easy ?? 0),
                  medium: Number(v.medium ?? 0),
                  hard: Number(v.hard ?? 0),
                },
              ]),
            )
          : undefined;

      const result = await api.ai.batchGenerateCards(targetIds, {
        count: config.count,
        types: config.types,
        difficulty: config.difficulty,
        coverage: config.coverage,
        custom_prompt: config.customPrompt || undefined,
        cards_per_type: cardsPerTypeNum,
        count_per_difficulty: countPerDiffNum as
          | { easy?: number; medium?: number; hard?: number }
          | undefined,
        count_matrix: countMatrix,
      });

      if (result.success && result.taskIds?.length && challengePendingRef.current) {
        await pollGenerationTasksThenStartTest(result.taskIds);
        return;
      }
      if (result.success) {
        message.success(t('toast.graphAI.submitSuccess'), {
          duration: 5000,
          action: {
            label: t('graphMap.cards.viewTasks'),
            onClick: () => navigate("/tasks"),
          },
        });
      }
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : t('nodeDetail.levelTestGenerateFailed');
      message.error(errMsg);
    }
  };

  const handleStartLearningMode = () => {
    if (!selectedNode) return;
    navigate(`/learning?node_id=${selectedNode.id}&graph_id=${id}`);
  };

  const handleManageCards = () => {
    if (!selectedNode || !id) return;
    navigate(`/study?node_id=${selectedNode.id}&graph_id=${id}&view=bank`);
  };

  const handleBackgroundTask = async (type: 'expand_graph' | 'batch_generate_questions', params?: Record<string, unknown>) => {
    if (selectedNodeIds.size === 0 && !selectedNode) return;
    if (!id) return;

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const nodesToProcess = selectedNodeIds.size > 0
      ? Array.from(selectedNodeIds).map(nid => nodeById.get(nid)).filter((n): n is NonNullable<typeof n> => Boolean(n))
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

          const targetNodeIdsFromParams = Array.isArray(params?.targetNodeIds)
            ? (params.targetNodeIds as string[]).filter((x): x is string => typeof x === "string")
            : [];
          const nodeIds = targetNodeIdsFromParams.length > 0 ? targetNodeIdsFromParams : nodesToProcess.map(n => n.id);

          const p = params ?? {};
          const types = Array.isArray(p.types) ? (p.types as string[]).filter((x): x is string => typeof x === "string") : undefined;
          const count = typeof p.count === "number" ? p.count : undefined;
          await api.ai.batchGenerateCards(nodeIds, {
            ...p,
            types,
            count,
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

            // 单趟收集子节点 ID 集合，替代 filter+map 两次扫描
            const currentChildrenIds = new Set<string>();
            for (const e of edges) {
              if (e.source_knowledge_point_id === node.id) {
                currentChildrenIds.add(e.target_knowledge_point_id);
              }
            }
            // 用 Set 查找替代 currentChildrenIds.includes 的线性扫描
            const currentChildrenTitles: string[] = [];
            for (const n of nodes) {
              if (currentChildrenIds.has(n.id)) currentChildrenTitles.push(n.title);
            }

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

  const handleGetBranchSuggestions = async () => {
    if (!selectedNode || !id) return [];

    const result = await asyncHandler(
      async () => {
        const parentLevel = getLevel(selectedNode, edges);

        const existingTitles = nodes.map(n => n.title);

        // 单趟收集子节点 ID 集合，替代 filter+map 两次扫描
        const currentChildrenIds = new Set<string>();
        for (const e of edges) {
          if (e.source_knowledge_point_id === selectedNode.id) {
            currentChildrenIds.add(e.target_knowledge_point_id);
          }
        }
        // 用 Set 查找替代 currentChildrenIds.includes 的线性扫描
        const currentChildrenTitles: string[] = [];
        for (const n of nodes) {
          if (currentChildrenIds.has(n.id)) currentChildrenTitles.push(n.title);
        }

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

        // getLevel scans all edges; hoist it out of the branch loop since the
        // parent node is identical for every branch.
        const parentLevel = getLevel(parentNode, edges);
        const newLevel = getNextLevel(parentLevel);

        for (const branch of branches) {
          const isAccepted = branch.id === suggestion.id;

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
    handleBackgroundTask,
    handleStartLevelTest,
    handleStartLearningMode,
    handleManageCards,
    isChallengeGenOpen,
    handleCloseChallengeGen,
    handleChallengeGenerate,
    handleGetBranchSuggestions,
    handleCreateBranch,
    handleSwitchBranch,
    handleGenerateNodeContent,
    handleExecuteAction
  };
};
