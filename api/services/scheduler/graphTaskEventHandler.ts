import { appEventBus } from "../core/eventBus";
import { graphTaskService } from "./graphTaskService";
import { logger } from "../../utils/logger";
import { getSupabaseAdmin } from "../../supabase";
import type {
  AppEvent,
  NodeCreatedPayload,
  NodeDeletedPayload,
  GraphCreatedPayload,
} from "../../../shared/types/events";

class GraphTaskEventHandler {
  initialize(): void {
    logger.info("[GraphTaskEventHandler] Initializing graph task event handlers");

    appEventBus.subscribe("node_created", this.handleNodeCreated.bind(this));
    appEventBus.subscribe("node_deleted", this.handleNodeDeleted.bind(this));
    appEventBus.subscribe("graph_created", this.handleGraphCreated.bind(this));

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
    const { graphId, userId } = payload;

    logger.info("[GraphTaskEventHandler] Node deleted, syncing task:", {
      graphId,
      userId,
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

  private async handleGraphCreated(event: AppEvent): Promise<void> {
    const payload = event.payload as GraphCreatedPayload;
    const { graphId, userId } = payload;

    logger.info("[GraphTaskEventHandler] Graph created, checking if task creation is needed:", {
      graphId,
      userId,
    });

    try {
      // 为图谱创建任务
      await graphTaskService.createOrUpdateTaskForGraph(
        getSupabaseAdmin(),
        userId,
        graphId,
      );
    } catch (error) {
      logger.error("[GraphTaskEventHandler] Failed to create task for new graph:", error);
    }
  }
}

export const graphTaskEventHandler = new GraphTaskEventHandler();
