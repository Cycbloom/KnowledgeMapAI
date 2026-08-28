import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/config';
import { graphsApi } from '../../services/api/graphs';
import { tasksApi } from '../../services/api/tasks';
import { api } from '../../services/api';
import { message } from '../../utils/messageHelper';
import { useRelationDiscoveryNotificationStore } from '../../store/useRelationDiscoveryNotificationStore';
import type { NodeRelationSuggestion } from '@shared/types/graph';

interface UseNodeRelationDiscoveryOptions {
  graphId: string;
  /** 从任务中心/通知跳回时携带的已完成任务 ID，用于恢复建议列表 */
  initialTaskId?: string | null;
}

/**
 * AI 节点关系发现 hook（任务中心版）。
 *
 * 点击「发现关系」创建 discover_node_relations 后台任务，任务进入任务中心展示进度。
 * 任务的全局跟踪（SSE + 对账 + 看门狗）与「完成右下角通知」由全局 store 承担，
 * 即使关闭面板/离开图谱也不丢失结果；本 hook 消费 store 状态，任务完成后拉取
 * 建议回填，支持通过 initialTaskId 从通知/任务中心恢复。应用建议仍走同步批量建边。
 */
export function useNodeRelationDiscovery({
  graphId,
  initialTaskId,
}: UseNodeRelationDiscoveryOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<NodeRelationSuggestion[]>([]);
  const [appliedPairKeys, setAppliedPairKeys] = useState<Set<string>>(new Set());
  const loadedInitialTaskRef = useRef<string | null>(null);

  const notice = useRelationDiscoveryNotificationStore((s) => s.notice);
  const relevantNotice = notice?.graphId === graphId ? notice : null;
  const isDiscovering = relevantNotice?.status === 'generating';
  const taskId = relevantNotice?.taskId ?? null;

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
          t('graphEditor.connectionSuggestions.nodeRelationDiscovery.appliedToast', {
            count: result.applied,
          }),
        );
      }
      if (result.skipped.length > 0) {
        message.warning(
          t('graphEditor.connectionSuggestions.nodeRelationDiscovery.skippedToast', {
            count: result.skipped.length,
          }),
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.graphData(graphId) });
    },
    onError: (error: Error) => {
      message.error(
        t('graphEditor.connectionSuggestions.nodeRelationDiscovery.applyFailed', { error: error.message }),
      );
    },
  });

  const applyAll = useCallback(
    async (targetSuggestions: NodeRelationSuggestion[]) => {
      if (targetSuggestions.length === 0) return;
      return applyMutation.mutateAsync(targetSuggestions);
    },
    [applyMutation],
  );

  // 从任务详情回填建议列表
  const loadSuggestionsFromTask = useCallback(
    async (id: string, { silent = false } = {}) => {
      try {
        const task = (await api.ai.getTaskStatus(id)) as {
          status?: string;
          output_data?: { suggestions?: NodeRelationSuggestion[] };
        };
        const found = Array.isArray(task?.output_data?.suggestions)
          ? (task.output_data.suggestions as NodeRelationSuggestion[])
          : [];
        setSuggestions(found);
        if (!silent) {
          if (found.length > 0) {
            message.success(
              t('graphEditor.connectionSuggestions.nodeRelationDiscovery.discoveredToast', {
                count: found.length,
              }),
            );
          } else {
            message.info(
              t('graphEditor.connectionSuggestions.nodeRelationDiscovery.noSuggestions'),
            );
          }
        }
      } catch (error: unknown) {
        if (!silent) {
          message.error(
            t('graphEditor.connectionSuggestions.nodeRelationDiscovery.discoverFailed', {
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
    },
    [t],
  );

  // 监听全局通知 store：任务成功则回填建议，失败给出提示
  useEffect(() => {
    if (relevantNotice?.status === 'success' && relevantNotice.taskId) {
      void loadSuggestionsFromTask(relevantNotice.taskId);
    } else if (relevantNotice?.status === 'error') {
      message.error(
        t('graphEditor.connectionSuggestions.nodeRelationDiscovery.discoverFailed', {
          error: '',
        }),
      );
    }
  }, [relevantNotice, loadSuggestionsFromTask, t]);

  // 从通知/任务中心跳回时恢复指定任务的建议（静默加载，不重复弹 toast）
  useEffect(() => {
    if (!initialTaskId) return;
    if (loadedInitialTaskRef.current === initialTaskId) return;
    loadedInitialTaskRef.current = initialTaskId;
    void loadSuggestionsFromTask(initialTaskId, { silent: true });
  }, [initialTaskId, loadSuggestionsFromTask]);

  const discover = useCallback(
    async (maxSuggestions?: number) => {
      setSuggestions([]);
      setAppliedPairKeys(new Set());

      try {
        const task = await tasksApi.create({
          type: 'discover_node_relations',
          payload: { graph_id: graphId, max_suggestions: maxSuggestions },
        });
        // 全局跟踪 + 右下角完成通知（跨路由存活）
        useRelationDiscoveryNotificationStore
          .getState()
          .startTracking(task.id, graphId);
        message.success(
          t('graphEditor.connectionSuggestions.nodeRelationDiscovery.submitted'),
          {
            duration: 5000,
            action: {
              label: t('graphMap.cards.viewTasks'),
              onClick: () => navigate('/tasks'),
            },
          },
        );
      } catch (error: unknown) {
        message.error(
          t('graphEditor.connectionSuggestions.nodeRelationDiscovery.discoverFailed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    [graphId, t, navigate],
  );

  return {
    suggestions,
    setSuggestions,
    isDiscovering,
    isApplying: applyMutation.isPending,
    appliedPairKeys,
    taskId,
    discover,
    applyAll,
  };
}
