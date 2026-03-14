import { Node, Edge } from '../../types';
import { getLevel } from '../../lib/graphUtils';
import { useMessageStore } from '../../store/useMessageStore';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { queryKeys } from '../queries/config';
import { useAIExpandMutation, useAIGenerateCardsMutation, useCreateCardsBatchMutation, useCreateNodeMutation, useCreateEdgeMutation, useUpdateNodeMutation } from '../mutations';
import { useQueryClient } from '@tanstack/react-query';
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
  
  const { addMessage } = useMessageStore();
  const queryClient = useQueryClient();
  const asyncHandler = createAsyncHandler(addMessage);
  
  const aiExpandMutation = useAIExpandMutation();
  const aiGenerateCardsMutation = useAIGenerateCardsMutation();
  const createCardsBatchMutation = useCreateCardsBatchMutation();
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
      addMessage({ type: 'error', content: '请先选择一个节点' });
      return null;
    }
    
    const currentGraphId = getCurrentGraphId();
    if (!currentGraphId) {
      addMessage({ type: 'error', content: '无法确定节点所属图谱' });
      return null;
    }
    
    if (!selectedNode.title) {
      addMessage({ type: 'error', content: '节点标题不能为空' });
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
            addMessage({ type: 'success', content: `拓展完成：新增 ${result.newNodesCount} 个节点，${result.newEdgesCount} 条连线` });
          } else {
            addMessage({ type: 'info', content: '未发现新的关联' });
          }
        },
        errorMessage: '拓展失败'
      }
    );
  };
  
  const handleGenerateContent = async (prompt?: string) => {
    if (!selectedNode) {
      addMessage({ type: 'error', content: '请先选择一个节点' });
      return null;
    }
    
    const currentGraphId = getCurrentGraphId();
    if (!currentGraphId) {
      addMessage({ type: 'error', content: '无法确定节点所属图谱' });
      return null;
    }
    
    addMessage({ content: 'AI 内容生成任务已开始...', type: 'info' });
    
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
        successMessage: 'AI 内容生成完成',
        errorMessage: 'AI 生成失败'
      }
    );
  };
  
  const handleGenerateCards = async () => {
    if (!selectedNode) {
      addMessage({ type: 'error', content: '请先选择一个节点' });
      return null;
    }
    
    const currentGraphId = getCurrentGraphId();
    if (!currentGraphId) {
      addMessage({ type: 'error', content: '无法确定节点所属图谱' });
      return null;
    }
    
    return await asyncHandler(
      async () => {
        const res = await aiGenerateCardsMutation.mutateAsync({
          node_title: selectedNode.title,
          node_content: selectedNode.content || ''
        });
        
        const cards = res.cards.map((c: { question: string; answer: string; type: string; options?: string[] }) => ({
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
        queryClient.invalidateQueries({ queryKey: queryKeys.graphNodeStatus(currentGraphId) });
        
        return cards.length;
      },
      {
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
  
  const handleStartLevelTest = () => {
    if (!selectedNode) {
      addMessage({ type: 'error', content: '请先选择一个节点' });
      return;
    }
    
    const currentGraphId = getCurrentGraphId();
    window.location.href = `/study?node_id=${selectedNode.id}&graph_id=${currentGraphId || ''}`;
  };
  
  const handleStartLearningMode = () => {
    if (!selectedNode) {
      addMessage({ type: 'error', content: '请先选择一个节点' });
      return;
    }
    
    const currentGraphId = getCurrentGraphId();
    window.location.href = `/learning?node_id=${selectedNode.id}&graph_id=${currentGraphId || ''}`;
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
        successMessage: '跨图谱连接分析完成',
        errorMessage: '跨图谱连接分析失败'
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
