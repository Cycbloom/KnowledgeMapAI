import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orchestratorApi } from "../../services/api/modules/scheduler/orchestrator";

const DEFAULT_STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 60;

export function useSchedulerOrchestrator() {
  const queryClient = useQueryClient();

  const startLearningLoop = useMutation({
    mutationFn: ({ knowledgePointId, graphId }: { knowledgePointId?: string; graphId?: string }) =>
      orchestratorApi.startLearningLoop(knowledgePointId, graphId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-loops"] });
      queryClient.invalidateQueries({ queryKey: ["scheduler"] });
    },
  });

  const advanceLearningLoop = useMutation({
    mutationFn: (loopId: string) => orchestratorApi.advanceLearningLoop(loopId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-loops"] });
      queryClient.invalidateQueries({ queryKey: ["scheduler"] });
    },
  });

  const activeLoop = useQuery({
    queryKey: ["learning-loops", "active"],
    queryFn: () => orchestratorApi.getActiveLearningLoop(),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: GC_TIME,
  });

  const startLearningWithTask = useMutation({
    mutationFn: ({ knowledgePointId, graphId }: { knowledgePointId: string; graphId?: string }) =>
      orchestratorApi.startLearningWithTask(knowledgePointId, graphId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-loops"] });
      queryClient.invalidateQueries({ queryKey: ["scheduler"] });
    },
  });

  return {
    startLearningLoop,
    advanceLearningLoop,
    activeLoop,
    startLearningWithTask,
  };
}
