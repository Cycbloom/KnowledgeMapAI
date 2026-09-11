import { SupabaseClient } from "@supabase/supabase-js";
import {
  TaskProcessor,
  registerProcessor,
  UpdateTaskStatusFunction,
  TaskControl,
  TaskAbortError,
} from "./index";
import type { AIProviderType } from "@shared/types";
import { generateChildSuggestions } from "../ai/nodeSuggestionService";
import { createKnowledgePointWithGraphNode } from "../../utils/nodeHelpers";
import { getNextLevel } from "../../utils/levelUtils";
import { notDeleted } from "../common/softDeleteHelper";
import { cacheService, CacheKeys } from "../common/cacheService";
import { graphTaskService } from "../scheduler/graphTaskService";
import { getGraphNodeTitleMap, canReuseNode } from "../graph/graphDuplicateService";
import {
  resolveLocalizedText,
  type LocalizedText,
} from "../../../shared/utils/localization";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface ExpandGraphPayload {
  knowledge_point_id?: string;
  node_id?: string;
  node_title?: string;
  node_content?: string;
  graph_id?: string;
  existing_nodes?: string[];
  child_nodes?: string[];
  provider?: string;
  model?: string;
  [key: string]: unknown;
}

interface KPTitleRef {
  knowledge_points?: { title?: string } | { title?: string }[] | null;
}

/**
 * 批量后台拓展（Learning Mode 大纲多选「拓展」）的异步处理器。
 *
 * 复用统一的 generateChildSuggestions（与 AI 制图生成器节点拓展同一套逻辑），
 * 仅负责把生成出的子节点建议落库：新建节点+边，或复用已有节点补边。
 */
export class ExpandGraphProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: ExpandGraphPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl,
  ): Promise<void> {
    logger.info(`Starting expand graph task ${taskId} for user ${userId}`, {
      payload,
    });

    try {
      const nodeId = payload.knowledge_point_id || payload.node_id;
      const nodeTitle = payload.node_title || "";
      const nodeContent = payload.node_content;

      if (!nodeId) {
        throw new AppError(
          "expand_graph: missing node id",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      await updateTaskStatus(
        supabase,
        taskId,
        "in_progress",
        {
          stage: "init",
          progress: 0,
          current_node: nodeTitle ? `准备拓展「${nodeTitle}」...` : "准备拓展...",
        },
        undefined,
        undefined,
        userId,
      );

      const { data: currentGraphNode } = await notDeleted(supabase
        .from("graph_nodes")
        .select("id, graph_id, x_position, y_position, level")
        .eq("knowledge_point_id", nodeId)
        )
        .single();

      if (!currentGraphNode) {
        throw new AppError(
          "expand_graph: source node not found",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const graphId = payload.graph_id || currentGraphNode.graph_id;

      // 图内全部节点（title → {kpId, specificity}），供 AI 提示与复用判定共用：
      // 统一由 graphDuplicateService 查询并按当前语言解析 title。
      const existingNodeByTitle = await getGraphNodeTitleMap(supabase, graphId);

      const { data: childEdges } = await notDeleted(supabase
        .from("edges")
        .select(
          "target_knowledge_point_id, knowledge_points!edges_target_knowledge_point_id_fkey(title)",
        )
        .eq("source_knowledge_point_id", nodeId)
        );

      const existingChildTitles = new Set<string>();
      (childEdges || []).forEach((edge: KPTitleRef) => {
        const kp = Array.isArray(edge.knowledge_points)
          ? edge.knowledge_points[0]
          : edge.knowledge_points;
        // title 为按语言 key 的 JSONB，需解析为字符串再给 AI 提示
        const title = kp?.title
          ? resolveLocalizedText(kp.title as LocalizedText)
          : "";
        if (title) existingChildTitles.add(title);
      });

      control.throwIfAborted();

      await updateTaskStatus(
        supabase,
        taskId,
        "in_progress",
        {
          stage: "expanding",
          progress: 20,
          current_node: `AI 正在为「${nodeTitle || nodeId}」生成子节点...`,
        },
        undefined,
        undefined,
        userId,
      );

      const { children } = await generateChildSuggestions(supabase, {
        nodeTitle: nodeTitle || nodeId,
        nodeContent,
        nodeLevel: currentGraphNode.level || "normal",
        existingChildren: Array.from(existingChildTitles),
        existingNodes: Array.from(existingNodeByTitle.keys()),
        providerType: payload.provider as AIProviderType | undefined,
        model: payload.model,
        userId,
        graphId,
      });

      control.throwIfAborted();

      const newLevel = getNextLevel(currentGraphNode.level || "normal");

      let createdCount = 0;
      let connectedCount = 0;
      const nodeTitles: string[] = [];

      for (let i = 0; i < children.length; i++) {
        control.throwIfAborted();
        const child = children[i];
        const existing = existingNodeByTitle.get(child.title);

        // 泛化名称（specificity === "generic"）不参与本图复用：即使图内已有同名节点，
        // 也应新建独立节点，避免「项目现状」等跨上下文语义不同的节点被误合并。
        const canReuse =
          !!existing && canReuseNode(child.specificity, existing.specificity);

        if (canReuse) {
          const existingKpId = existing.knowledgePointId;
          if (existingKpId && existingKpId !== nodeId) {
            const { data: dupEdge } = await notDeleted(supabase
              .from("edges")
              .select("id")
              .or(
                `and(source_knowledge_point_id.eq.${nodeId},target_knowledge_point_id.eq.${existingKpId}),and(source_knowledge_point_id.eq.${existingKpId},target_knowledge_point_id.eq.${nodeId})`,
              )
              )
              .maybeSingle();

            if (!dupEdge) {
              await supabase.from("edges").insert({
                graph_id: graphId,
                source_knowledge_point_id: nodeId,
                target_knowledge_point_id: existingKpId,
                relationship_type: "contains",
              });
              connectedCount++;
            }
          }
        } else {
          const angle = Math.random() * Math.PI * 2;
          const radius = 4 + Math.random() * 4;
          const x = Math.round(
            (currentGraphNode.x_position || 0) + Math.cos(angle) * radius,
          );
          const y = Math.round(
            (currentGraphNode.y_position || 0) + Math.sin(angle) * radius,
          );

          const newNode = await createKnowledgePointWithGraphNode(
            supabase,
            userId,
            {
              graph_id: graphId,
              title: child.title,
              content: child.content || "",
              level: newLevel,
              x_position: x,
              y_position: y,
              properties: child.specificity
                ? { specificity: child.specificity }
                : undefined,
            },
          );

          if (newNode) {
            createdCount++;
            nodeTitles.push(child.title);
            existingNodeByTitle.set(child.title, {
              knowledgePointId: newNode.knowledge_point_id,
              specificity: child.specificity,
            });

            await supabase.from("edges").insert({
              graph_id: graphId,
              source_knowledge_point_id: nodeId,
              target_knowledge_point_id: newNode.knowledge_point_id,
              relationship_type: "contains",
            });
            connectedCount++;
          }
        }
      }

      if (graphId) {
        await cacheService.del(CacheKeys.GRAPH_NODES(userId, graphId));
        await cacheService.del(CacheKeys.GRAPH_NODES("public", graphId));
      }

      // 深度拓展新建了知识点 → 同步图谱大任务：为每个新知识点补建子任务并重算大任务进度。
      // expand_graph 走 RPC 直建节点不会发 node_created，故此处显式调用同步。
      if (graphId) {
        try {
          await graphTaskService.syncTaskWithGraphChanges(supabase, graphId);
        } catch (err) {
          logger.warn(
            "[ExpandGraphProcessor] sync task after expansion failed",
            {
              graphId,
              error: err instanceof Error ? err.message : String(err),
            },
          );
        }
      }

      logger.info(
        `Expand graph task ${taskId} completed: ${createdCount} nodes, ${connectedCount} edges`,
      );
      await updateTaskStatus(
        supabase,
        taskId,
        "completed",
        {
          nodesCreated: createdCount,
          edgesCreated: connectedCount,
          nodeTitles,
          progress: 100,
        },
        undefined,
        undefined,
        userId,
      );
    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Expand graph task ${taskId} ${error.reason}`);
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
      logger.error(`Expand graph task ${taskId} failed:`, error);
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

registerProcessor("expand_graph", new ExpandGraphProcessor());
