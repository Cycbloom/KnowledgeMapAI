import type { AppEventType } from "../../../shared/types/events";
import type { Kernel } from "./Kernel";

const coreEventTypes: AppEventType[] = [
  "task_started",
  "task_paused",
  "task_resumed",
  "task_completed",
  "task_demoted",
  "task_moved",
  "focus_session_started",
  "focus_session_ended",
  "review_completed",
  "schedule_executed",
  "learning_progress_updated",
  "graph_created",
  "graph_updated",
  "graph_deleted",
  "node_created",
  "node_updated",
  "node_deleted",
  "edge_created",
  "edge_deleted",
  "ai_task_completed",
  "ai_task_failed",
  "study_session_completed",
  "cache_invalidation_needed",
  "notification_needed",
];

export function registerCoreEventTypes(kernel: Kernel): void {
  for (const eventType of coreEventTypes) {
    kernel.registerEventType(eventType);
  }
}
