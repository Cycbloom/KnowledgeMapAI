import { appEventBus } from "../core/eventBus";
import { graphTaskService } from "./graphTaskService";
import { logger } from "../../utils/logger";
import { supabaseAdmin } from "../../supabase";
import type {
  AppEvent,
  NodeCreatedPayload,
  NodeDeletedPayload,
  GraphCreatedPayload,
} from "../../../shared/types/events";

class GraphTaskEventHandler {
  initialize(): void {
    logger.info("[GraphTaskEventHandler] Initializing graph task event handlers");

    appEventBus.subscribe("node_created", this.handleNodeCreated.bind(this) as any);
    appEventBus.subscribe("node_deleted", this.handleNodeDeleted.bind(this) as any);
    appEventBus.subscribe("graph_created", this.handleGraphCreated.bind(this) as any);

    logger.info("[GraphTaskEventHandler] Event handlers registered");
  }

  private async handleNodeCreated(event: AppEvent<NodeCreatedPayload>): Promise<void> {
    const { graphId, userId } = event.payload;

    logger.info("[GraphTaskEventHandler] Node created, syncing task:", {
      graphId,
      userId,
    });

    try {
      await graphTaskService.syncTaskWithGraphChanges(
        supabaseAdmin,
        graphId,
      );
    } catch (error) {
      logger.error("[GraphTaskEventHandler] Failed to sync task after node creation:", error);
    }
  }

  private async handleNodeDeleted(event: AppEvent<NodeDeletedPayload>): Promise<void> {
    const { graphId, userId } = event.payload;

    logger.info("[GraphTaskEventHandler] Node deleted, syncing task:", {
      graphId,
      userId,
    });

    try {
      await graphTaskService.syncTaskWithGraphChanges(
        supabaseAdmin,
        graphId,
      );
    } catch (error) {
      logger.error("[GraphTaskEventHandler] Failed to sync task after node deletion:", error);
    }
  }

  private async handleGraphCreated(event: AppEvent<GraphCreatedPayload>): Promise<void> {
    const { graphId, userId } = event.payload;

    logger.info("[GraphTaskEventHandler] Graph created, creating task:", {
      graphId,
      userId,
    });

    try {
      await graphTaskService.createOrUpdateTaskForGraph(
        supabaseAdmin,
        userId,
        graphId,
      );
    } catch (error) {
      logger.error("[GraphTaskEventHandler] Failed to create task for new graph:", error);
    }
  }
}

export const graphTaskEventHandler = new GraphTaskEventHandler();
