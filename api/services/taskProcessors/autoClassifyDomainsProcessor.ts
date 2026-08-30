import { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskProcessor,
  registerProcessor,
  UpdateTaskStatusFunction,
  TaskControl,
  TaskAbortError,
} from "./index";
import { domainService } from "../graph/domainService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";

interface AutoClassifyDomainsPayload {
  graph_ids?: string[];
  max_domains?: number;
  [key: string]: unknown;
}

/**
 * 图谱自动分类领域的后台任务处理器。
 *
 * 与旧的同步接口不同，接入任务中心后可获得进度展示、终止/暂停控制与失败重试。
 * AI 聚类结果（候选领域 + 图谱信息）通过 updateTaskStatus 的 result 写入任务
 * output_data，前端在任务完成后拉取任务详情回填候选领域，供用户确认后创建。
 */
export class AutoClassifyDomainsProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: AutoClassifyDomainsPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void> {
    logger.info(
      `Starting auto classify domains task ${taskId} for user ${userId}`,
      { payload },
    );

    try {
      control.throwIfAborted();

      await updateTaskStatus(
        supabase,
        taskId,
        "in_progress",
        {
          stage: "clustering",
          progress: 10,
          current_step: "正在读取并聚类全部图谱...",
        },
        undefined,
        undefined,
        userId,
      );

      control.throwIfAborted();

      const result = await domainService.autoClassifyGraphs(supabase, userId, {
        graph_ids: Array.isArray(payload?.graph_ids)
          ? payload.graph_ids
          : undefined,
        max_domains:
          typeof payload?.max_domains === "number"
            ? payload.max_domains
            : undefined,
      });

      control.throwIfAborted();

      logger.info(
        `Auto classify domains task ${taskId} completed: ${result.domains.length} candidate domains`,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "completed",
        { progress: 100 },
        { domains: result.domains, graphs: result.graphs },
        undefined,
        userId,
      );
    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Auto classify domains task ${taskId} ${error.reason}`);
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
      if (error instanceof AppError) {
        logger.error(`Auto classify domains task ${taskId} failed:`, {
          code: error.code,
          message: error.message,
        });
        await updateTaskStatus(
          supabase,
          taskId,
          "failed",
          null,
          undefined,
          error.message,
          userId,
        );
        return;
      }
      logger.error(`Auto classify domains task ${taskId} failed:`, error);
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
  "auto_classify_domains",
  new AutoClassifyDomainsProcessor(),
);