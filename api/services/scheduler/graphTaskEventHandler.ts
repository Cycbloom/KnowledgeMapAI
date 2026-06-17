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
        getSupabaseAdmin(),
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
        getSupabaseAdmin(),
        graphId,
      );
    } catch (error) {
      logger.error("[GraphTaskEventHandler] Failed to sync task after node deletion:", error);
    }
  }

  private async handleGraphCreated(event: AppEvent<GraphCreatedPayload>): Promise<void> {
    const { graphId, userId } = event.payload;

    logger.info("[GraphTaskEventHandler] Graph created, checking if task creation is needed:", {
      graphId,
      userId,
    });

    try {
      // 查询图谱的模板类型
      const { data: graph, error } = await getSupabaseAdmin()
        .from("knowledge_graphs")
        .select("template_type, title")
        .eq("id", graphId)
        .single();

      if (error) {
        logger.error("[GraphTaskEventHandler] Failed to fetch graph info:", error);
        return;
      }

      // 故事创作类型的图谱不需要任务调度
      if (graph?.template_type === "story_creation") {
        logger.info("[GraphTaskEventHandler] Skipping task creation for story_creation graph:", {
          graphId,
          title: graph.title,
        });
        return;
      }

      // 其他类型的图谱创建任务
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
