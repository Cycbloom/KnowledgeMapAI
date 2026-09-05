import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orchestratorApi } from "../../services/api/modules/scheduler/orchestrator";
import { queryKeys } from "../queries/config";

const DEFAULT_STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 60;

export function useSchedulerOrchestrator() {
  const queryClient = useQueryClient();

  const startLearningLoop = useMutation({
    mutationFn: ({ knowledgePointId, graphId }: { knowledgePointId?: string; graphId?: string }) =>
      orchestratorApi.startLearningLoop(knowledgePointId, graphId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.learningLoops() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler() });
    },
  });

  const advanceLearningLoop = useMutation({
    mutationFn: (loopId: string) => orchestratorApi.advanceLearningLoop(loopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.learningLoops() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler() });
    },
  });

  const activeLoop = useQuery({
    queryKey: queryKeys.activeLearningLoop(),
    queryFn: () => orchestratorApi.getActiveLearningLoop(),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: GC_TIME,
  });

  const startLearningWithTask = useMutation({
    mutationFn: ({ knowledgePointId, graphId }: { knowledgePointId: string; graphId?: string }) =>
      orchestratorApi.startLearningWithTask(knowledgePointId, graphId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.learningLoops() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler() });
    },
  });

  /** 统一「开始学习图谱」入口 */
  const startLearningForGraph = useMutation({
    mutationFn: ({ graphId, dailyMinutes }: { graphId: string; dailyMinutes?: number }) =>
      orchestratorApi.startLearningForGraph(graphId, dailyMinutes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduler() });
      queryClient.invalidateQueries({ queryKey: queryKeys.graphLearningPath(variables.graphId) });
    },
  });

  /** 调度决策：现在最该做的下一步 */
  const nextStep = useQuery({
    queryKey: queryKeys.schedulerNextStep(),
    queryFn: () => orchestratorApi.getNextStep(),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  /** 今日概览（P4 今日卡片）：今日排期 + 容量 + 到期复习 + 大循环决策 + 滞后窗口 */
  const todayBrief = useQuery({
    queryKey: queryKeys.schedulerTodayBrief(),
    queryFn: () => orchestratorApi.getTodayBrief(),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });

  return {
    startLearningLoop,
    advanceLearningLoop,
    activeLoop,
    startLearningWithTask,
    startLearningForGraph,
    nextStep,
    todayBrief,
  };
}
