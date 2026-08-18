import { frontendEventBus } from "./timer/FrontendEventBus";
import { queryKeys } from "../hooks/queries/config";
import type { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;
let unsubscribers: (() => void)[] = [];

export function initializeEventSubscribers(qc: QueryClient): void {
  queryClient = qc;

  const unsub1 = frontendEventBus.subscribe("sse_task_completed", () => {
    queryClient?.invalidateQueries({ queryKey: queryKeys.scheduler() });
  });

  const unsub2 = frontendEventBus.subscribe("sse_focus_session_ended", () => {
    queryClient?.invalidateQueries({ queryKey: queryKeys.scheduler() });
  });

  const unsub3 = frontendEventBus.subscribe("sse_review_completed", () => {
    queryClient?.invalidateQueries({ queryKey: queryKeys.scheduler() });
  });

  const unsub4 = frontendEventBus.subscribe("graph_data_changed", (payload) => {
    if (payload?.graphId) {
      queryClient?.invalidateQueries({
        queryKey: queryKeys.graphData(payload.graphId),
      });
      queryClient?.invalidateQueries({
        queryKey: queryKeys.graphDataWithEmbedding(payload.graphId),
      });
      queryClient?.invalidateQueries({
        queryKey: queryKeys.graphNodeStatus(payload.graphId),
      });
      queryClient?.invalidateQueries({
        queryKey: queryKeys.graphLearningPath(payload.graphId),
      });
      queryClient?.invalidateQueries({ queryKey: queryKeys.graph(payload.graphId) });
      queryClient?.invalidateQueries({ queryKey: queryKeys.graphs });
    } else {
      queryClient?.invalidateQueries({ queryKey: ["graphData"] });
      queryClient?.invalidateQueries({ queryKey: ["graphDataWithEmbedding"] });
      queryClient?.invalidateQueries({ queryKey: queryKeys.graphNodeStatusPrefix });
      queryClient?.invalidateQueries({ queryKey: ["graphLearningPath"] });
      queryClient?.invalidateQueries({ queryKey: queryKeys.graphs });
    }
  });

  const unsub5 = frontendEventBus.subscribe("graph_list_changed", (payload) => {
    queryClient?.invalidateQueries({ queryKey: queryKeys.graphs });
    if (
      payload?.changeType !== "graph_created" &&
      payload?.changeType !== "graph_updated"
    ) {
      queryClient?.invalidateQueries({ queryKey: queryKeys.trashGraphs });
    }
    if (payload?.graphId) {
      queryClient?.invalidateQueries({ queryKey: queryKeys.graph(payload.graphId) });
    }
  });

  const unsub6 = frontendEventBus.subscribe("achievement_unlocked", () => {
    queryClient?.invalidateQueries({ queryKey: queryKeys.achievements() });
  });

  unsubscribers = [
    unsub1,
    unsub2,
    unsub3,
    unsub4,
    unsub5,
    unsub6,
  ];
}

export function cleanupEventSubscribers(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  queryClient = null;
}
