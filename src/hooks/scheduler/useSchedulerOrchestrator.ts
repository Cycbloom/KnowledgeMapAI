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

  return {
    startLearningLoop,
    advanceLearningLoop,
    activeLoop,
    startLearningWithTask,
  };
}
