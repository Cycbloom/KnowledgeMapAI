import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/config';
import { graphsApi } from '../../services/api/graphs';
import { message } from '../../utils/messageHelper';
import type { NodeRelationSuggestion } from '@shared/types/graph';

interface UseNodeRelationDiscoveryOptions {
  graphId: string;
}

/**
 * AI 节点关系发现 hook。
 *
 * 负责调用后端 AI 发现图谱内节点间的非层级关系建议，并支持批量应用建议建边。
 * 应用成功后失效 graphData 缓存，驱动画布刷新连线。
 */
export function useNodeRelationDiscovery({ graphId }: UseNodeRelationDiscoveryOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<NodeRelationSuggestion[]>([]);
  const [appliedPairKeys, setAppliedPairKeys] = useState<Set<string>>(new Set());

  const discoverMutation = useMutation({
    mutationFn: (maxSuggestions?: number) =>
      graphsApi.discoverNodeRelations(graphId, { max_suggestions: maxSuggestions }),
    onSuccess: (data) => {
      setSuggestions(data?.suggestions || []);
      if ((data?.suggestions || []).length > 0) {
        message.success(
          t('graphEditor.graphAnalysis.nodeRelationDiscovery.discoveredToast', {
            count: data?.suggestions?.length ?? 0,
          }),
        );
      }
    },
    onError: (error: Error) => {
      setSuggestions([]);
      message.error(
        t('graphEditor.graphAnalysis.nodeRelationDiscovery.discoverFailed', { error: error.message }),
      );
    },
  });

  const applyMutation = useMutation({
    mutationFn: (targetSuggestions: NodeRelationSuggestion[]) =>
      graphsApi.applyNodeRelations(graphId, targetSuggestions),
    onSuccess: (result, variables) => {
      const skippedKeys = new Set(
        result.skipped.map((item) => `${item.source_id}-${item.target_id}`),
      );
      // 仅把真正建边成功的建议标记为已应用
      setAppliedPairKeys((prev) => {
        const next = new Set(prev);
        for (const suggestion of variables) {
          if (!skippedKeys.has(`${suggestion.source_id}-${suggestion.target_id}`)) {
            next.add(`${suggestion.source_id}-${suggestion.target_id}`);
          }
        }
        return next;
      });
      if (result.applied > 0) {
        message.success(
          t('graphEditor.graphAnalysis.nodeRelationDiscovery.appliedToast', {
            count: result.applied,
          }),
        );
      }
      if (result.skipped.length > 0) {
        message.warning(
          t('graphEditor.graphAnalysis.nodeRelationDiscovery.skippedToast', {
            count: result.skipped.length,
          }),
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
    },
    onError: (error: Error) => {
      message.error(
        t('graphEditor.graphAnalysis.nodeRelationDiscovery.applyFailed', { error: error.message }),
      );
    },
  });

  const discover = useCallback(
    async (maxSuggestions?: number) => {
      setSuggestions([]);
      setAppliedPairKeys(new Set());
      return discoverMutation.mutateAsync(maxSuggestions);
    },
    [discoverMutation],
  );

  const applyAll = useCallback(
    async (targetSuggestions: NodeRelationSuggestion[]) => {
      if (targetSuggestions.length === 0) return;
      return applyMutation.mutateAsync(targetSuggestions);
    },
    [applyMutation],
  );

  const isApplying = applyMutation.isPending;

  return {
    suggestions,
    setSuggestions,
    isDiscovering: discoverMutation.isPending,
    isApplying,
    appliedPairKeys,
    discover,
    applyAll,
  };
}
