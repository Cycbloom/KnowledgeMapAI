import { frontendEventBus } from "./timer/FrontendEventBus";
import type { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | null = null;
let unsubscribers: (() => void)[] = [];

export function initializeEventSubscribers(qc: QueryClient): void {
  queryClient = qc;

  const unsub1 = frontendEventBus.subscribe("sse_task_completed", () => {
    queryClient?.invalidateQueries({ queryKey: ["scheduler"] });
  });

  const unsub2 = frontendEventBus.subscribe("sse_focus_session_ended", () => {
    queryClient?.invalidateQueries({ queryKey: ["scheduler"] });
  });

  const unsub3 = frontendEventBus.subscribe("sse_review_completed", () => {
    queryClient?.invalidateQueries({ queryKey: ["scheduler"] });
  });

  const unsub4 = frontendEventBus.subscribe("scheduler_task_changed", (payload) => {
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "tasks"] });
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "queues"] });
    if (payload?.taskId) {
      queryClient?.invalidateQueries({ queryKey: ["scheduler", "task", payload.taskId] });
    }
  });

  const unsub5 = frontendEventBus.subscribe("scheduler_task_completed", (payload) => {
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "tasks"] });
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "queues"] });
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "stats"] });
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "heatmap"] });
    if (payload?.taskId) {
      queryClient?.invalidateQueries({ queryKey: ["scheduler", "task", payload.taskId] });
    }
  });

  const unsub6 = frontendEventBus.subscribe("scheduler_stats_changed", () => {
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "stats"] });
    queryClient?.invalidateQueries({ queryKey: ["scheduler", "heatmap"] });
  });

  const unsub7 = frontendEventBus.subscribe("graph_data_changed", (payload) => {
    if (payload?.graphId) {
      queryClient?.invalidateQueries({ queryKey: ["graphData", payload.graphId] });
      queryClient?.invalidateQueries({ queryKey: ["graphNodeStatus", payload.graphId] });
      queryClient?.invalidateQueries({ queryKey: ["graphLearningPath", payload.graphId] });
      queryClient?.invalidateQueries({ queryKey: ["graph", payload.graphId] });
      queryClient?.invalidateQueries({ queryKey: ["graphs"] });
    } else {
      queryClient?.invalidateQueries({ queryKey: ["graphData"] });
      queryClient?.invalidateQueries({ queryKey: ["graphNodeStatus"] });
      queryClient?.invalidateQueries({ queryKey: ["graphLearningPath"] });
      queryClient?.invalidateQueries({ queryKey: ["graphs"] });
    }
  });

  const unsub8 = frontendEventBus.subscribe("graph_list_changed", (payload) => {
    queryClient?.invalidateQueries({ queryKey: ["graphs"] });
    if (payload?.changeType !== "graph_created" && payload?.changeType !== "graph_updated") {
      queryClient?.invalidateQueries({ queryKey: ["graphs", "trash"] });
    }
    if (payload?.graphId) {
      queryClient?.invalidateQueries({ queryKey: ["graph", payload.graphId] });
    }
  });

  unsubscribers = [unsub1, unsub2, unsub3, unsub4, unsub5, unsub6, unsub7, unsub8];
}

export function cleanupEventSubscribers(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  queryClient = null;
}
