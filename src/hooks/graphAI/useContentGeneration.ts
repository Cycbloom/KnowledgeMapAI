import { useCallback } from 'react';
import { Node, Edge } from '../../types';
import type { UpdateNodeData } from '@shared/types/api';
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { api } from '../../services/api';
import { isNetworkError, wrapUnknownError } from '../../utils/errors';
import { queryKeys } from '../queries/config';
import { useQueryClient, UseMutationResult } from '@tanstack/react-query';

interface UseContentGenerationOptions {
  id: string;
  nodes: Node[];
  edges: Edge[];
  selectedNode: Node | null;
  state: {
    nodeForm: { title: string; content?: string; level?: string };
    setNodeForm: (updater: (prev: { title: string; content?: string; level?: string }) => { title: string; content?: string; level?: string }) => void;
    aiPrompt: string;
    setAiPrompt: (prompt: string) => void;
    setLoading: (loading: boolean) => void;
  };
  mutations: {
    updateNodeMutation: UseMutationResult<Node, Error, { id: string; data: UpdateNodeData; graphId: string }, unknown>;
  };
}

export const useContentGeneration = (options: UseContentGenerationOptions) => {
  const { id, nodes, edges, selectedNode, state, mutations } = options;
  const queryClient = useQueryClient();

  const handleAIGenerate = useCallback(async () => {
    if (!state.nodeForm.title) return;
    state.setLoading(true);
    
    try {
      let prompt = state.aiPrompt;
      
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
        prompt = `请详细解释 ${state.nodeForm.title} 的核心概念、特点和应用`;
      }
      
      state.setAiPrompt(prompt);
      
      await api.ai.generateContentStream(
        { 
          topic: state.nodeForm.title, 
          context: prompt,
          level: state.nodeForm.level
        },
        (chunk) => {
          state.setNodeForm(prev => ({ 
            ...prev, 
            content: (prev.content || '') + chunk 
          }));
        }
      );
      state.setAiPrompt('');
      frontendEventBus.publish("message_show", { content: 'AI 内容生成完成', type: 'success' });
    } catch (err) {
      const appError = wrapUnknownError(err);
      console.error('[handleAIGenerate]', appError);
      const errorMsg = isNetworkError(err) ? '网络连接失败，请检查网络' : 'AI 生成失败';
      frontendEventBus.publish("message_show", { content: errorMsg, type: 'error' });
    } finally {
      state.setLoading(false);
    }
  }, [state, selectedNode, nodes, edges]);

  const handleGenerateNodeContent = useCallback(async () => {
    if (!selectedNode || !id) return;
    state.setLoading(true);
    frontendEventBus.publish("message_show", { content: 'AI 内容生成任务已开始...', type: 'info' });
    
    try {
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
        await mutations.updateNodeMutation.mutateAsync({
          id: selectedNode.id,
          graphId: id,
          data: { content: generatedContent }
        });
        
        frontendEventBus.publish("message_show", { content: 'AI 内容生成完成', type: 'success' });
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
      }
    } catch (err) {
      console.error(err);
      frontendEventBus.publish("message_show", { content: 'AI 生成失败', type: 'error' });
    } finally {
      state.setLoading(false);
    }
  }, [selectedNode, id, state, mutations, queryClient]);

  return {
    handleAIGenerate,
    handleGenerateNodeContent
  };
};
