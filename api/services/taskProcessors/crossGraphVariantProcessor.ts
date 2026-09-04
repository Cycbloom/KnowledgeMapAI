/**
 * 目标驱动「生成候选跨图谱学习路径」的后台任务处理器。
 *
 * AI 耗时的变体生成放到任务中心后台执行，避免右侧面板长时间白屏等待。
 * 结果（变体列表）通过 updateTaskStatus 的 result 写入任务 output_data，
 * 前端在任务完成后拉取任务详情回填右侧面板供用户续接（选中变体 → 保存）。
 */
import { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskProcessor,
  registerProcessor,
  UpdateTaskStatusFunction,
  TaskControl,
  TaskAbortError,
} from "./index";
import { goalDrivenPathService } from "../study/goalDrivenPathService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface CrossGraphVariantPayload {
  target_goal: string;
  conversation_transcript?: string;
  daily_time_minutes?: number;
  variant_count?: number;
  provider?: string;
  model?: string;
  selected_graph_ids?: string[];
  selected_domain_ids?: string[];
  [key: string]: unknown;
}

export class CrossGraphVariantProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: CrossGraphVariantPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void> {
    logger.info(`Starting cross-graph variant task ${taskId} for user ${userId}`, {
      payload,
    });

    try {
      const targetGoal = payload.target_goal;
      if (!targetGoal) {
        throw new AppError(
          "cross_graph_path_variants: missing target_goal",
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
          stage: "generating",
          progress: 10,
          current_node: "正在生成候选学习路径...",
        },
        undefined,
        undefined,
        userId,
      );

      control.throwIfAborted();

      const { variants } = await goalDrivenPathService.generateVariants(
        supabase,
        userId,
        {
          targetGoal,
          conversationTranscript:
            typeof payload.conversation_transcript === "string"
              ? payload.conversation_transcript
              : undefined,
          dailyMinutes:
            typeof payload.daily_time_minutes === "number"
              ? payload.daily_time_minutes
              : undefined,
          variantCount:
            typeof payload.variant_count === "number"
              ? payload.variant_count
              : undefined,
          provider:
            typeof payload.provider === "string" ? payload.provider : undefined,
          model: typeof payload.model === "string" ? payload.model : undefined,
          selectedGraphIds: Array.isArray(payload.selected_graph_ids)
            ? payload.selected_graph_ids
            : undefined,
          selectedDomainIds: Array.isArray(payload.selected_domain_ids)
            ? payload.selected_domain_ids
            : undefined,
        },
      );

      control.throwIfAborted();

      logger.info(
        `Cross-graph variant task ${taskId} completed: ${variants.length} variants`,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "completed",
        { progress: 100 },
        { variants },
        undefined,
        userId,
      );
    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Cross-graph variant task ${taskId} ${error.reason}`);
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
      logger.error(`Cross-graph variant task ${taskId} failed:`, error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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

registerProcessor(
  "cross_graph_path_variants",
  new CrossGraphVariantProcessor(),
);