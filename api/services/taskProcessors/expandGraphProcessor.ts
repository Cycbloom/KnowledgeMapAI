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

      const { data: allGraphNodes } = await notDeleted(supabase
        .from("graph_nodes")
        .select("knowledge_points(title)")
        .eq("graph_id", graphId)
        );

      const existingNodeTitles = new Set<string>();
      (allGraphNodes || []).forEach((gn: KPTitleRef) => {
        const kp = Array.isArray(gn.knowledge_points)
          ? gn.knowledge_points[0]
          : gn.knowledge_points;
        if (kp?.title) existingNodeTitles.add(kp.title);
      });

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
        if (kp?.title) existingChildTitles.add(kp.title);
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
        existingNodes: Array.from(existingNodeTitles),
        providerType: payload.provider as AIProviderType | undefined,
        model: payload.model,
        userId,
        graphId,
      });

      control.throwIfAborted();

      const { data: allExistingNodes } = await notDeleted(supabase
        .from("graph_nodes")
        .select("id, knowledge_point_id, knowledge_points(id, title)")
        .eq("graph_id", graphId)
        );

      const existingNodeByTitle = new Map<
        string,
        { kpId?: string; knowledge_point_id: string | null }
      >();
      for (const gn of allExistingNodes ?? []) {
        const kp = Array.isArray(gn.knowledge_points)
          ? gn.knowledge_points[0]
          : gn.knowledge_points;
        const title = kp?.title;
        if (title) {
          existingNodeByTitle.set(title, {
            kpId: kp?.id,
            knowledge_point_id: gn.knowledge_point_id,
          });
        }
      }

      const newLevel = getNextLevel(currentGraphNode.level || "normal");

      let createdCount = 0;
      let connectedCount = 0;
      const nodeTitles: string[] = [];

      for (let i = 0; i < children.length; i++) {
        control.throwIfAborted();
        const child = children[i];
        const existing = existingNodeByTitle.get(child.title);

        if (existing) {
          const existingKpId = existing.kpId || existing.knowledge_point_id;
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
            },
          );

          if (newNode) {
            createdCount++;
            nodeTitles.push(child.title);
            existingNodeByTitle.set(child.title, {
              kpId: newNode.knowledge_point_id,
              knowledge_point_id: newNode.knowledge_point_id,
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
