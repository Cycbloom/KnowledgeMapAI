import { useCallback } from 'react';
import { Node, Edge } from '../../types';
import type { UpdateNodeData } from '@shared/types/api';
import { message } from "../../utils/messageHelper";
import { api } from '../../services/api';
import { isNetworkError, wrapUnknownError } from '../../utils/errors';
import { queryKeys } from '../queries/config';
import { useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  const handleAIGenerate = useCallback(async () => {
    if (!state.nodeForm.title) return;
    state.setLoading(true);
    
    try {
      let prompt = state.aiPrompt;
      
      if (!prompt && selectedNode) {
        const nodeAiPrompt = selectedNode.properties?.ai_prompt;
        if (nodeAiPrompt && typeof nodeAiPrompt === 'string') {
          prompt = nodeAiPrompt.replace(/{主题}/g, selectedNode.title || '');
          
          // 预构建节点索引与「目标节点→边」索引，将嵌套 find 的 O(n*m) 扫描降为 O(1) 查找
          const nodeById = new Map(nodes.map((n) => [n.id, n]));
          const edgeByTarget = new Map<string, Edge>();
          for (const e of edges) {
            if (!edgeByTarget.has(e.target_knowledge_point_id)) {
              edgeByTarget.set(e.target_knowledge_point_id, e);
            }
          }
          const parentEdge = edgeByTarget.get(selectedNode.id);
          const parentNode = parentEdge ? nodeById.get(parentEdge.source_knowledge_point_id) : undefined;
          if (parentNode) {
            prompt = prompt.replace(/{父节点内容}/g, parentNode.content || parentNode.title || '');
          }
          
          // 单趟构建父节点的子节点 id Set，将 filter+some 的 O(n*m) 降为 O(n+m)
          const childIdSet = new Set<string>();
          if (parentNode) {
            for (const e of edges) {
              if (e.source_knowledge_point_id === parentNode.id) {
                childIdSet.add(e.target_knowledge_point_id);
              }
            }
          }
          const siblingNodes = nodes.filter((n) => n.id !== selectedNode.id && childIdSet.has(n.id));
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
      message.success(t('toast.graphAI.content.completed'));
    } catch (err) {
      const appError = wrapUnknownError(err);
      console.error('[handleAIGenerate]', appError);
      const errorMsg = isNetworkError(err) ? t('toast.graphAI.content.networkError') : t('toast.graphAI.content.failed');
      message.error(errorMsg);
    } finally {
      state.setLoading(false);
    }
  }, [state, selectedNode, nodes, edges, t]);

  const handleGenerateNodeContent = useCallback(async () => {
    if (!selectedNode || !id) return;
    state.setLoading(true);
    message.info(t('toast.graphAI.content.started'));

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

        message.success(t('toast.graphAI.content.completed'));
        queryClient.invalidateQueries({ queryKey: queryKeys.graphData(id) });
      }
    } catch (err) {
      console.error(err);
      message.error(t('toast.graphAI.content.failed'));
    } finally {
      state.setLoading(false);
    }
  }, [selectedNode, id, state, mutations, queryClient, t]);

  return {
    handleAIGenerate,
    handleGenerateNodeContent
  };
};
