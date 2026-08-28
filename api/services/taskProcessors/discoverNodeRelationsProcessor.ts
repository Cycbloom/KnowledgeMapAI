import { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskProcessor,
  registerProcessor,
  UpdateTaskStatusFunction,
  TaskControl,
  TaskAbortError,
} from "./index";
import { nodeRelationDiscoveryService } from "../graph/nodeRelationDiscoveryService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface DiscoverNodeRelationsPayload {
  graph_id?: string;
  max_suggestions?: number;
  provider?: string;
  model?: string;
  language?: string;
  [key: string]: unknown;
}

/**
 * 节点关系发现的后台任务处理器。
 *
 * 与旧的同步接口不同，接入任务中心后可获得进度展示、终止/暂停控制与失败重试。
 * AI 分析结果（建议列表）通过 updateTaskStatus 的 result 写入任务 output_data，
 * 前端在任务完成后拉取任务详情回填建议列表供用户确认应用。
 */
export class DiscoverNodeRelationsProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: DiscoverNodeRelationsPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void> {
    logger.info(`Starting discover node relations task ${taskId} for user ${userId}`, {
      payload,
    });

    try {
      const graphId = payload.graph_id;
      if (!graphId) {
        throw new AppError(
          "discover_node_relations: missing graph_id",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      control.throwIfAborted();

      await updateTaskStatus(
        supabase,
        taskId,
        "in_progress",
        {
          stage: "discovering",
          progress: 10,
          current_node: "正在分析图谱节点关系...",
        },
        undefined,
        undefined,
        userId,
      );

      control.throwIfAborted();

      const suggestions = await nodeRelationDiscoveryService.discoverNodeRelations(
        supabase,
        userId,
        graphId,
        {
          max_suggestions:
            typeof payload.max_suggestions === "number"
              ? payload.max_suggestions
              : undefined,
          language:
            typeof payload.language === "string" ? payload.language : undefined,
        },
      );

      control.throwIfAborted();

      logger.info(
        `Discover node relations task ${taskId} completed: ${suggestions.length} suggestions`,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "completed",
        { progress: 100 },
        { suggestions },
        undefined,
        userId,
      );
    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Discover node relations task ${taskId} ${error.reason}`);
        await updateTaskStatus(
          supabase,
          taskId,
          error.reason,
          undefined,
          undefined,
          undefined,
          userId,
        );
        return;
      }
      logger.error(`Discover node relations task ${taskId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateTaskStatus(
        supabase,
        taskId,
        "failed",
        null,
        undefined,
        errorMessage,
        userId,
      );
    }
  }
}

registerProcessor("discover_node_relations", new DiscoverNodeRelationsProcessor());
