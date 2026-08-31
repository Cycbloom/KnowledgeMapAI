import { appEventBus } from "../core/eventBus";
import { graphTaskService } from "./graphTaskService";
import { logger } from "../../utils/logger";
import { getSupabaseAdmin } from "../../supabase";
import type {
  AppEvent,
  NodeCreatedPayload,
  NodeDeletedPayload,
} from "../../../shared/types/events";

class GraphTaskEventHandler {
  initialize(): void {
    logger.info("[GraphTaskEventHandler] Initializing graph task event handlers");

    appEventBus.subscribe("node_created", this.handleNodeCreated.bind(this));
    appEventBus.subscribe("node_deleted", this.handleNodeDeleted.bind(this));
    // 注意：不再订阅 graph_created 建任务——这会造成与 smartTaskLinker 的
    // graph_created 订阅竞态，产生「一满一空」两个重复任务。
    // 图谱任务的唯一创建入口是 smartTaskLinker.subscribeToGraphCreatedEvents
    // → getOrCreateTaskForGraph（会一并创建每知识点子任务）。

    logger.info("[GraphTaskEventHandler] Event handlers registered");
  }

  private async handleNodeCreated(event: AppEvent): Promise<void> {
    const payload = event.payload as NodeCreatedPayload;
    const { graphId, userId } = payload;

    logger.info("[GraphTaskEventHandler] Node created, syncing task:", {
      graphId,
      userId,
    });

    try {
      await graphTaskService.syncTaskWithGraphChanges(
        getSupabaseAdmin(),
        graphId,
      );
    } catch (error) {
      logger.error("[GraphTaskEventHandler] Failed to sync task after node creation:", error);
    }
  }

  private async handleNodeDeleted(event: AppEvent): Promise<void> {
    const payload = event.payload as NodeDeletedPayload;
    const { graphId } = payload;

    logger.info("[GraphTaskEventHandler] Node deleted, syncing task:", {
      graphId,
    });

    try {
      await graphTaskService.syncTaskWithGraphChanges(
        getSupabaseAdmin(),
        graphId,
      );
    } catch (error) {
      logger.error("[GraphTaskEventHandler] Failed to sync task after node deletion:", error);
    }
  }
}

export const graphTaskEventHandler = new GraphTaskEventHandler();
