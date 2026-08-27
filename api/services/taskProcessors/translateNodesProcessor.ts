import { SupabaseClient } from "@supabase/supabase-js";
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction, TaskControl, TaskAbortError } from "./index";
import { nodeTranslationService } from "../ai/nodeTranslationService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { notDeleted } from "../common/softDeleteHelper";
import {
  resolveLocalizedText,
  mergeLocalizedTranslation,
  BASE_CONTENT_LANG,
} from "../../../shared/utils/localization";

interface TranslateNodesPayload {
  node_ids: string[];
  graph_id?: string;
  target_language: string;
  /** 只翻译缺失的目标语言（去重）。true：某节点目标语言已存在则跳过 */
  only_missing?: boolean;
  /** 参与翻译的字段，默认 title/content/summary，空数组视为全部 */
  fields?: string[];
}

// 每个词译者定位为：源文本取基础语言(zh-CN)，写回时合并到 target_language
const TRANSLATABLE_FIELDS = ["title", "content", "summary"] as const;
const BATCH_NODE_LIMIT = 20;

export class TranslateNodesProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: TranslateNodesPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void> {
    logger.info(`Starting translate nodes task ${taskId} for user ${userId}`, {
      payload,
    });

    try {
      const { node_ids, target_language, only_missing = true } = payload;
      const fields = (payload.fields?.length
        ? payload.fields
        : [...TRANSLATABLE_FIELDS]
      ).filter((f) => (TRANSLATABLE_FIELDS as readonly string[]).includes(f));

      if (!node_ids || node_ids.length === 0 || !target_language) {
        throw new AppError(
          "缺少 node_ids 或 target_language",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const { data: graphNodes, error: gnError } = await notDeleted(supabase
        .from("graph_nodes")
        .select(
          `
          id,
          graph_id,
          knowledge_point_id,
          knowledge_points (
            id,
            title,
            content,
            summary
          )
        `,
        )
        .in("knowledge_point_id", node_ids));

      if (gnError || !graphNodes || graphNodes.length === 0) {
        throw new AppError(
          "未找到待翻译的节点",
          500,
          ErrorCodes.SYSTEM_INTERNAL_ERROR,
        );
      }

      // 把每个节点整理为：源文本(基础语言) + 原始语言映射(用于合并写回)
      const pendingNodes: {
        id: string;
        title: string;
        content?: string;
        summary?: string;
        titleMap: string | Record<string, string>;
        contentMap: string | Record<string, string>;
        summaryMap: string | Record<string, string>;
      }[] = [];

      for (const gn of graphNodes as Array<{
        knowledge_point_id: string;
        knowledge_points?: Array<{
          id: string;
          title: unknown;
          content: unknown;
          summary: unknown;
        }> | null;
      }>) {
        const kp = gn.knowledge_points?.[0];
        if (!kp) continue;

        const titleMap = (kp.title || "") as string | Record<string, string>;
        const contentMap = (kp.content || "") as string | Record<string, string>;
        const summaryMap = (kp.summary || "") as string | Record<string, string>;

        // 去重：若所有选中字段在目标语言下均已有非空翻译，则跳过该节点
        if (only_missing) {
          const allPresent = fields.every((f) => {
            const map = f === "title" ? titleMap : f === "content" ? contentMap : summaryMap;
            if (!map || typeof map !== "object") return false;
            const v = map[target_language];
            return typeof v === "string" && v.trim() !== "";
          });
          if (allPresent) {
            continue;
          }
        }

        pendingNodes.push({
          id: kp.id,
          title: resolveLocalizedText(titleMap, BASE_CONTENT_LANG),
          content: resolveLocalizedText(contentMap, BASE_CONTENT_LANG) || undefined,
          summary: resolveLocalizedText(summaryMap, BASE_CONTENT_LANG) || undefined,
          titleMap,
          contentMap,
          summaryMap,
        });
      }

      if (pendingNodes.length === 0) {
        await updateTaskStatus(
          supabase, taskId, "completed",
          { stage: "done", progress: 100, translated: 0, skipped: node_ids.length, total: node_ids.length },
          { success: true, translated: 0, skipped: node_ids.length, total: node_ids.length },
          undefined, userId,
        );
        return;
      }

      const total = pendingNodes.length;
      let completed = 0;

      // 分批翻译 + 写回，批次间检查协作式中断
      for (let i = 0; i < pendingNodes.length; i += BATCH_NODE_LIMIT) {
        control.throwIfAborted();
        const chunk = pendingNodes.slice(i, i + BATCH_NODE_LIMIT);
        const source = chunk.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          summary: n.summary,
        }));

        const result = await nodeTranslationService.translateNodes(
          source,
          target_language,
        );

        // 逐个合并写回 knowledge_points
        for (const tr of result.translations) {
          const node = chunk.find((c) => c.id === tr.node_id);
          if (!node) continue;
          control.throwIfAborted();

          const update: {
            title?: Record<string, string>;
            content?: Record<string, string>;
            summary?: Record<string, string>;
            updated_at?: string;
          } = { updated_at: new Date().toISOString() };

          if (
            fields.includes("title") &&
            typeof tr.title === "string" &&
            tr.title.trim() !== ""
          ) {
            update.title = mergeLocalizedTranslation(node.titleMap, target_language, tr.title);
          }
          if (
            fields.includes("content") &&
            typeof tr.content === "string" &&
            tr.content.trim() !== "" &&
            node.content
          ) {
            update.content = mergeLocalizedTranslation(node.contentMap, target_language, tr.content);
          }
          if (
            fields.includes("summary") &&
            typeof tr.summary === "string" &&
            tr.summary.trim() !== "" &&
            node.summary
          ) {
            update.summary = mergeLocalizedTranslation(node.summaryMap, target_language, tr.summary);
          }

          if (Object.keys(update).length > 1) {
            await supabase.from("knowledge_points").update(update).eq("id", node.id);
          }
          completed++;
        }

        if (chunk.length > 0) {
          await updateTaskStatus(supabase, taskId, "in_progress", {
            stage: "translating",
            stageLabel: `翻译节点进度 ${completed}/${total}`,
            progress: Math.round((completed / total) * 100),
            completed,
            total,
          }, undefined, undefined, userId);
        }
      }

      logger.info(`Translate nodes task ${taskId} completed for user ${userId}`);
      await updateTaskStatus(
        supabase, taskId, "completed",
        { stage: "done", progress: 100, completed: total, total },
        { success: true, translated: total, skipped: node_ids.length - total, total: node_ids.length },
        undefined, userId,
      );
    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Translate nodes task ${taskId} ${error.reason}`);
        await updateTaskStatus(supabase, taskId, error.reason, undefined, undefined, undefined, userId);
        return;
      }
      logger.error(`Translate nodes task ${taskId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateTaskStatus(supabase, taskId, "failed", null, undefined, errorMessage, userId);
    }
  }
}

registerProcessor("translate_nodes", new TranslateNodesProcessor());