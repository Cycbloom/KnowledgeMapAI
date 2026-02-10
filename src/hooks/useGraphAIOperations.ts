import { Node, Edge, NodeLevel, BranchSuggestion } from '../types';
import { getLevel } from '../lib/graphUtils';
import { HistoryAction } from './useHistory';
import { GraphEditorState } from './useGraphEditorState';
import { useMessageStore } from '../store/useMessageStore';
import { api } from '../services/api';
import { useStore } from '../store/useStore';
import { queryKeys } from './useQueries';
import { useQueryClient } from '@tanstack/react-query';

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
  const { 
    nodeForm, setNodeForm, 
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

  const getNextLevel = (parentLevel: string): NodeLevel => {
    switch (parentLevel) {
      case 'root': return 'core';
      case 'core': return 'sub';
      case 'sub': return 'normal';
      case 'normal': return 'leaf';
      default: return 'leaf';
    }
  };

  const getLevelColor = (level: NodeLevel): string => {
    switch (level) {
      case 'root': return '#8B5CF6';
      case 'core': return '#EF4444';
      case 'sub': return '#F59E0B';
      case 'normal': return '#3B82F6';
      case 'leaf': return '#10B981';
      default: return '#3B82F6';
    }
  };

  const handleAIGenerate = async () => {
    if (!nodeForm.title) return;
    setLoading(true);
    
    try {
      let prompt = aiPrompt;
      
      if (!prompt && selectedNode) {
        const nodeAiPrompt = selectedNode.properties?.ai_prompt;
        if (nodeAiPrompt) {
          prompt = nodeAiPrompt.replace(/{主题}/g, selectedNode.title);
          
          const parentNode = nodes.find(n => n.id === edges.find(e => e.target_node_id === selectedNode.id)?.source_node_id);
          if (parentNode) {
            prompt = prompt.replace(/{父节点内容}/g, parentNode.content || parentNode.title);
          }
          
          const siblingNodes = nodes.filter(n => 
            n.id !== selectedNode.id && 
            edges.some(e => 
              e.source_node_id === parentNode?.id && 
              e.target_node_id === n.id
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
      addMessage({ content: 'AI 内容生成完成', type: 'success' });
    } catch (err) {
      console.error(err);
      addMessage({ content: 'AI 生成失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAIExpand = async () => {
    if (!selectedNode || !id) return;
    setLoading(true);
    try {
      const parentLevel = getLevel(selectedNode, edges);
      const newLevel = getNextLevel(parentLevel);

      const existingTitles = nodes.map(n => n.title);
      
      const currentChildrenIds = edges
        .filter(e => e.source_node_id === selectedNode.id)
        .map(e => e.target_node_id);
      const currentChildrenTitles = nodes
        .filter(n => currentChildrenIds.includes(n.id))
        .map(n => n.title);

      let expandPrompt = aiPrompt;
      
      if (!expandPrompt) {
        expandPrompt = `请为 ${selectedNode.title} 生成 3-5 个相关的子主题，每个子主题应该简洁明确`;
      }

      const res = await aiExpandMutation.mutateAsync({ 
        node_title: selectedNode.title,
        node_content: selectedNode.content,
        node_level: parentLevel,
        existing_titles: existingTitles,
        current_children: currentChildrenTitles,
        expand_prompt: expandPrompt,
      });
      
      const suggestions = res.suggestions;
      
      let newNodesCount = 0;
      let newEdgesCount = 0;

      for (const s of suggestions) {
        // Check if node already exists
        const existingNode = nodes.find(n => n.title === s.title);
        
        if (existingNode) {
          // Check if edge already exists
          const edgeExists = edges.some(e => 
            (e.source_node_id === selectedNode.id && e.target_node_id === existingNode.id) ||
            (e.source_node_id === existingNode.id && e.target_node_id === selectedNode.id)
          );
          
          if (!edgeExists && existingNode.id !== selectedNode.id) {
             const newEdge = await createEdgeMutation.mutateAsync({
              source_node_id: selectedNode.id,
              target_node_id: existingNode.id,
              relationship_type: 'related',
              graphId: id
            });
            record({ type: 'CREATE_EDGE', payload: newEdge });
            newEdgesCount++;
          }
        } else {
          // Generate new nodes in a semi-random position
          const angle = Math.random() * Math.PI * 2;
          const radius = 4 + Math.random() * 4; // Distance from parent
          const x = Math.round(selectedNode.x_position + Math.cos(angle) * radius);
          const y = Math.round(selectedNode.y_position + Math.sin(angle) * radius);
          
          const newNode = await createNodeMutation.mutateAsync({
            graph_id: id,
            title: s.title,
            content: s.content,
            x_position: x,
            y_position: y,
            color: getLevelColor(newLevel), 
            level: newLevel,
            properties: {}
          });
          
          record({ type: 'CREATE_NODE', payload: newNode });

          const newEdge = await createEdgeMutation.mutateAsync({
            source_node_id: selectedNode.id,
            target_node_id: newNode.id,
            relationship_type: 'related',
            graphId: id
          });
          record({ type: 'CREATE_EDGE', payload: newEdge });
          newNodesCount++;
          newEdgesCount++;
        }
      }

      if (newNodesCount > 0 || newEdgesCount > 0) {
        addMessage({ type: 'success', content: `拓展完成：新增 ${newNodesCount} 个节点，${newEdgesCount} 条连线` });
      } else {
        addMessage({ type: 'info', content: '未发现新的关联' });
      }
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '拓展失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerateCards = async () => {
    if (!selectedNode || !id) return;
    setLoading(true);
    try {
      // 1. Generate Cards
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
        return;
      }

      // 2. Save Cards
      await createCardsBatchMutation.mutateAsync(cards);
      addMessage({ type: 'success', content: `成功生成并保存了 ${cards.length} 张复习卡片！` });
      
      // Invalidate status to update mastery
      queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(id) });
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '生成卡片失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleBackgroundTask = async (type: 'generate_questions' | 'expand_graph' | 'batch_generate_questions' | 'deep_analysis') => {
    // If it's a batch generate success notification, just show the message
    if (type === 'batch_generate_questions') {
      addMessage({
        type: 'success',
        content: '批量生成任务已提交',
        duration: 3000,
        action: { label: '查看任务', onClick: () => navigate('/tasks') }
      });
      return;
    }

    // If no nodes selected, do nothing
    if (selectedNodeIds.size === 0 && !selectedNode) return;
    if (!id) return;
    
    // Determine which nodes to process
    const nodesToProcess = selectedNodeIds.size > 0 
      ? Array.from(selectedNodeIds).map(nid => nodes.find(n => n.id === nid)).filter(Boolean)
      : [selectedNode];

    if (nodesToProcess.length === 0) return;

    try {
      const { user } = useStore.getState();
      const aiConfig = user?.profile?.settings?.ai_config?.text;
      const provider = aiConfig?.provider;
      const model = aiConfig?.model;

      for (const node of nodesToProcess) {
        if (!node) continue;
        
        const payload: any = {
          graph_id: id,
          node_id: node.id,
          node_title: node.title,
          node_content: node.content,
          provider,
          model
        };

        if (type === 'expand_graph') {
          // Collect existing node titles for context
          const existingTitles = nodes.map(n => n.title);
          
          // Get current direct children titles
          const currentChildrenIds = edges
            .filter(e => e.source_node_id === node.id)
            .map(e => e.target_node_id);
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
      
      addMessage({
        type: 'success',
        content: '任务提交成功',
        duration: 3000,
        action: { label: '查看任务', onClick: () => navigate('/tasks') }
      });
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '任务提交失败' });
    }
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
    try {
      const res = await api.nodes.getRelated(selectedNode.id);
      state.setRelatedNodes(res || []);
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '获取相关节点失败' });
    } finally {
      state.setIsRelatedLoading(false);
    }
  };

  const handleGetBranchSuggestions = async () => {
    if (!selectedNode || !id) return;
    setLoading(true);
    try {
      const parentLevel = getLevel(selectedNode, edges);
      
      const existingTitles = nodes.map(n => n.title);
      
      const currentChildrenIds = edges
        .filter(e => e.source_node_id === selectedNode.id)
        .map(e => e.target_node_id);
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
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '获取分支建议失败' });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async (suggestion: BranchSuggestion, isAccepted: boolean = true) => {
    if (!selectedNode || !id) return;
    setLoading(true);
    try {
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
        color: getLevelColor(newLevel),
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
        source_node_id: selectedNode.id,
        target_node_id: newNode.id,
        relationship_type: 'branch',
        graphId: id
      });
      record({ type: 'CREATE_EDGE', payload: newEdge });
      addMessage({ type: 'success', content: `已创建分支：${suggestion.title}` });
      return newNode;
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '创建分支失败' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchBranch = async (pathItem: any, suggestion: BranchSuggestion) => {
    if (!id) return;
    setLoading(true);
    try {
      const parentNode = nodes.find(n => n.id === pathItem.parentNodeId);
      if (!parentNode) return;

      const branches = pathItem.alternativeBranches || [];
      const createdNodes: any[] = [];

      for (const branch of branches) {
        const isAccepted = branch.id === suggestion.id;
        const newNode = await createNodeMutation.mutateAsync({
          graph_id: id,
          title: branch.title,
          content: branch.description,
          x_position: parentNode.x_position + (Math.random() - 0.5) * 8,
          y_position: parentNode.y_position + (Math.random() - 0.5) * 8,
          color: getLevelColor(getLevel(parentNode, edges)),
          level: getLevel(parentNode, edges),
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
          source_node_id: parentNode.id,
          target_node_id: newNode.id,
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
            branches: branches,
            selectedBranchId: suggestion.id
          }
        ]);

        addMessage({ type: 'success', content: `已切换分支：${suggestion.title}` });
      }
    } catch (err) {
      console.error(err);
      addMessage({ type: 'error', content: '切换分支失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateNodeContent = async () => {
    if (!selectedNode || !id) return;
    setLoading(true);
    addMessage({ content: 'AI 内容生成任务已开始...', type: 'info' });
    
    try {
      let prompt = `请详细解释 ${selectedNode.title} 的核心概念、特点和应用。\n\n请直接输出 Markdown 格式的正文内容，严禁包含任何开场白（如“好的”、“作为...”）、结束语或无关的对话内容。`;
      
      let generatedContent = '';
      
      await api.ai.generateContentStream(
        { 
          topic: selectedNode.title, 
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
        
        // Update local state if needed, though react-query should handle it
        addMessage({ content: 'AI 内容生成完成', type: 'success' });
        
        // Invalidate queries to ensure UI updates
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
      }
    } catch (err) {
      console.error(err);
      addMessage({ content: 'AI 生成失败', type: 'error' });
    } finally {
      setLoading(false);
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
    handleGenerateNodeContent
  };
};
