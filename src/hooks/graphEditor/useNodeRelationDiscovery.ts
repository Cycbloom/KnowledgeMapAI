import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/config';
import { graphsApi } from '../../services/api/graphs';
import { tasksApi } from '../../services/api/tasks';
import { api } from '../../services/api';
import { message } from '../../utils/messageHelper';
import { frontendEventBus } from '../../services/timer/FrontendEventBus';
import type { SSEMessagePayload } from '../../services/FrontendEventTypes';
import type { NodeRelationSuggestion } from '@shared/types/graph';

interface UseNodeRelationDiscoveryOptions {
  graphId: string;
}

const WATCHDOG_MS = 10 * 60 * 1000;

/**
 * AI 节点关系发现 hook（任务中心版）。
 *
 * 点击「发现关系」后创建 discover_node_relations 后台任务，任务进入任务中心展示进度，
 * 支持终止/暂停/重试。前端通过 SSE task_update + 初始对账 + 看门狗跟踪任务，
 * 完成后从任务 output_data 读取 AI 建议列表并回填；应用建议仍走同步批量建边。
 */
export function useNodeRelationDiscovery({ graphId }: UseNodeRelationDiscoveryOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<NodeRelationSuggestion[]>([]);
  const [appliedPairKeys, setAppliedPairKeys] = useState<Set<string>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const taskIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const watchdogRef = useRef<number>(0);

  const stopTracking = useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (watchdogRef.current) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = 0;
    }
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

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

  // 任务终态后拉取任务详情，回填建议列表
  const settleTask = useCallback(
    async (id: string) => {
      try {
        const task = (await api.ai.getTaskStatus(id)) as {
          status?: string;
          output_data?: { suggestions?: NodeRelationSuggestion[] };
        };
        const found = Array.isArray(task?.output_data?.suggestions)
          ? (task.output_data.suggestions as NodeRelationSuggestion[])
          : [];
        setSuggestions(found);
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
      } finally {
        stopTracking();
        setIsDiscovering(false);
      }
    },
    [t, stopTracking],
  );

  const discover = useCallback(
    async (maxSuggestions?: number) => {
      setSuggestions([]);
      setAppliedPairKeys(new Set());
      setIsDiscovering(true);
      setTaskId(null);
      stopTracking();

      try {
        const task = await tasksApi.create({
          type: 'discover_node_relations',
          payload: { graph_id: graphId, max_suggestions: maxSuggestions },
        });
        const id = task.id;
        taskIdRef.current = id;
        setTaskId(id);
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

        const handleSse = (payload: SSEMessagePayload) => {
          if (payload.type !== 'task_update') return;
          if (typeof payload.taskId !== 'string' || payload.taskId !== taskIdRef.current) {
            return;
          }
          const status = typeof payload.status === 'string' ? payload.status : '';
          if (status === 'completed') {
            void settleTask(id);
          } else if (status === 'failed') {
            stopTracking();
            setIsDiscovering(false);
            message.error(
              t('graphEditor.connectionSuggestions.nodeRelationDiscovery.discoverFailed', {
                error: typeof payload.error === 'string' ? payload.error : '',
              }),
            );
          } else if (status === 'cancelled') {
            stopTracking();
            setIsDiscovering(false);
          }
        };
        unsubscribeRef.current = frontendEventBus.subscribe('sse_message', handleSse);

        // 初始对账：避免订阅前任务已完成的竞态
        const seed = (await api.ai.getTaskStatus(id).catch(() => null)) as
          | { status?: string }
          | null;
        if (seed?.status === 'completed') {
          await settleTask(id);
          return;
        }
        if (seed?.status === 'failed') {
          stopTracking();
          setIsDiscovering(false);
          message.error(
            t('graphEditor.connectionSuggestions.nodeRelationDiscovery.discoverFailed', {
              error: '',
            }),
          );
          return;
        }
        if (seed?.status === 'cancelled') {
          stopTracking();
          setIsDiscovering(false);
          return;
        }

        // 看门狗：SSE 断连等导致事件缺失时做一次最终对账
        watchdogRef.current = window.setTimeout(async () => {
          try {
            const current = (await api.ai.getTaskStatus(id).catch(() => null)) as
              | { status?: string }
              | null;
            if (current?.status === 'completed') {
              await settleTask(id);
            } else {
              stopTracking();
              setIsDiscovering(false);
            }
          } catch {
            stopTracking();
            setIsDiscovering(false);
          }
        }, WATCHDOG_MS);
      } catch (error: unknown) {
        stopTracking();
        setIsDiscovering(false);
        message.error(
          t('graphEditor.connectionSuggestions.nodeRelationDiscovery.discoverFailed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
    [graphId, t, settleTask, stopTracking],
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
