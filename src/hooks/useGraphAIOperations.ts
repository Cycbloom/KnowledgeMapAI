import { Node, Edge, BranchSuggestion } from '../types';
import { getLevel, getNextLevel, getLevelColorHex } from '../lib/graphUtils';
import { HistoryAction } from './useHistory';
import { GraphEditorState } from './useGraphEditorState';
import { useMessageStore } from '../store/useMessageStore';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { queryKeys } from './useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { createAsyncHandler } from '../utils/asyncHandler';
import {
  processExpandSuggestions,
  getExistingTitles,
  getCurrentChildrenTitles,
  buildDefaultExpandPrompt
} from './utils/nodeExpansionUtils';

interface UseGraphAIOperationsProps {
  id: string;
  nodes: Node[];
  edges: Edge[];
  state: GraphEditorState;
  mutations: {
    aiExpandMutation: any;
    aiGenerateCardsMutation: any;
    createCardsBatchMutation: any;
    createTaskMutation: any;
    createNodeMutation: any;
    createEdgeMutation: any;
    updateNodeMutation: any;
    recommendConnectionsMutation: any;
  };
  record: (action: HistoryAction) => void;
  navigate: (path: string) => void;
  token?: string | null;
}

export const useGraphAIOperations = ({
  id,
  nodes,
  edges,
  state,
  mutations,
  record,
  navigate
}: UseGraphAIOperationsProps) => {
  const { addMessage } = useMessageStore();
  const queryClient = useQueryClient();
  const asyncHandler = createAsyncHandler(addMessage);
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
        successMessage: 'AI 内容生成完成',
        errorMessage: 'AI 生成失败'
      }
    );
  };

  const handleAIExpand = async () => {
    if (!selectedNode || !id) return;
    
    if (!selectedNode.title) {
      addMessage({ type: 'error', content: '节点标题不能为空' });
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
            addMessage({ type: 'success', content: `拓展完成：新增 ${result.newNodesCount} 个节点，${result.newEdgesCount} 条连线` });
          } else {
            addMessage({ type: 'info', content: '未发现新的关联' });
          }
        },
        errorMessage: '拓展失败'
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
        
        const cards = res.cards.map((c: any) => ({
          node_id: selectedNode.id,
          question: c.question,
          answer: c.answer,
          type: c.type,
          options: c.options
        }));

        if (cards.length === 0) {
          addMessage({ type: 'error', content: 'AI 未能生成有效的卡片' });
          return null;
        }

        await createCardsBatchMutation.mutateAsync(cards);
        queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(id) });
        return cards.length;
      },
      {
        loadingSetter: setLoading,
        successMessage: '成功生成并保存了复习卡片！',
        errorMessage: '生成卡片失败',
        onSuccess: (result) => {
          if (result && typeof result === 'number') {
            addMessage({ type: 'success', content: `成功生成并保存了 ${result} 张复习卡片！` });
          }
        }
      }
    );
  };

  const handleBackgroundTask = async (type: 'generate_questions' | 'expand_graph' | 'batch_generate_questions' | 'deep_analysis', params?: any) => {
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
          addMessage({
              type: 'info',
              content: `正在提交 ${nodesToProcess.length} 个节点的题目生成任务...`,
              duration: 2000
          });

          const nodeIds = nodesToProcess.map(n => n.id);
          
          await api.ai.batchGenerateCards(nodeIds, {
            ...params,
            provider,
            model
          });

          addMessage({
            type: 'success',
            content: `成功提交 ${nodesToProcess.length} 个生成任务，请在任务列表中查看进度`,
            duration: 3000,
            action: { label: '查看任务', onClick: () => navigate('/tasks') }
          });
          return true;
        }

        for (const node of nodesToProcess) {
          if (!node) continue;
          
          const payload: any = {
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
        successMessage: '任务提交成功',
        errorMessage: '任务提交失败',
        onSuccess: () => {
          addMessage({
            type: 'success',
            content: '任务提交成功',
            duration: 3000,
            action: { label: '查看任务', onClick: () => navigate('/tasks') }
          });
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
        state.setRelatedNodes(res || []);
        return res;
      },
      {
        errorMessage: '获取相关节点失败',
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
        errorMessage: '获取分支建议失败'
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
        successMessage: `已创建分支：${suggestion.title}`,
        errorMessage: '创建分支失败'
      }
    );
  };

  const handleSwitchBranch = async (pathItem: any, suggestion: BranchSuggestion) => {
    if (!id) return;
    
    await asyncHandler(
      async () => {
        const parentNode = nodes.find(n => n.id === pathItem.parentNodeId);
        if (!parentNode) return null;

        const branches = pathItem.alternativeBranches || [];
        const createdNodes: any[] = [];

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
        errorMessage: '切换分支失败',
        onSuccess: (result) => {
          if (result) {
            addMessage({ type: 'success', content: `已切换分支：${suggestion.title}` });
          }
        }
      }
    );
  };

  const handleGenerateNodeContent = async () => {
    if (!selectedNode || !id) return;
    
    addMessage({ content: 'AI 内容生成任务已开始...', type: 'info' });
    
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
        successMessage: 'AI 内容生成完成',
        errorMessage: 'AI 生成失败'
      }
    );
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
    handleGenerateNodeContent
  };
};
