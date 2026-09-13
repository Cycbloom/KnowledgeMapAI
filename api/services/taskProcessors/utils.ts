import { SupabaseClient } from "@supabase/supabase-js";
import { createKnowledgePointWithGraphNode } from "../../utils/nodeHelpers";
import { logger } from "../../utils/logger";
import { getNextLevel } from "../../utils/levelUtils";
import { notDeleted } from '../common/softDeleteHelper';
import type { AIProvider } from "@shared/types";
import {
  generateChildSuggestions,
  generateGraphSkeleton,
} from "../ai/nodeSuggestionService";
import { graphNodeService } from "../graph/graphNodeService";
import { findReusableKnowledgePointId } from "../../utils/similaritySearch";
import { getGraphNodeTitleMap, canReuseNode } from "../graph/graphDuplicateService";
import { buildGraphDisambiguationContext } from "../graph/graphDisambiguationContext";
import type { NodeLevel, NodeSpecificity } from "@shared/types/graph";
import {
  resolveLocalizedText,
  type LocalizedText,
} from "../../../shared/utils/localization";

interface KPTitleRef {
  knowledge_points?: { title?: string } | { title?: string }[] | null;
}

interface CreatedNodeRef {
  id: string;
}

/**
 * 带跨图谱复用的建节点：命中本人已有的同义知识点则复用（仅新增 graph_nodes 关联），
 * 否则按原逻辑新建知识点节点。返回值 id 统一为 knowledge_point_id，供边关系引用。
 *
 * 特异性防护：泛化名称（specificity === "generic"）跳过跨图谱复用直接新建，
 * 避免「项目现状」「未来展望」这类跨上下文语义不同的同名节点被误合并。
 */
export async function createNodeWithCrossGraphReuse(
  supabase: SupabaseClient,
  userId: string | undefined,
  graphId: string,
  data: {
    title: string;
    content: string;
    level: string;
    x_position: number;
    y_position: number;
    specificity?: NodeSpecificity;
  },
): Promise<CreatedNodeRef | null> {
  if (userId && data.specificity !== "generic") {
    const reusedId = await findReusableKnowledgePointId(supabase, userId, data.title, {
      excludeGraphId: graphId,
    });
    if (reusedId) {
      const graphNode = await graphNodeService.addToGraph(supabase, {
        graph_id: graphId,
        knowledge_point_id: reusedId,
        x_position: data.x_position,
        y_position: data.y_position,
        level: data.level as NodeLevel,
        is_accepted: true,
      });
      return { id: graphNode.knowledge_point_id };
    }
  }

  return createKnowledgePointWithGraphNode(supabase, userId || "", {
    graph_id: graphId,
    title: data.title,
    content: data.content,
    level: data.level,
    x_position: data.x_position,
    y_position: data.y_position,
    properties: data.specificity ? { specificity: data.specificity } : undefined,
  });
}

export async function generateNodesForGraph(
  supabase: SupabaseClient,
  graphId: string,
  topic: string,
  description: string | undefined,
  depth: number,
  provider: AIProvider,
  userId?: string,
  sessionId?: string,
): Promise<number> {
  try {
    let totalNodes = 0;
    const effectiveSessionId = sessionId || crypto.randomUUID();

    // 图内已有节点（title → {kpId, specificity}）：
    // 复用判定仅当双方均为 specific（精确专名）才成立，泛化名称（generic）
    // 即使同名也新建独立节点，避免「项目现状」「未来展望」等跨上下文语义串味。
    const existingNodeTitles = await getGraphNodeTitleMap(supabase, graphId);

    const { root, coreNodes } = await generateGraphSkeleton(supabase, {
      topic,
      description,
      style: "academic",
      provider,
      userId,
      graphId,
      sessionId: effectiveSessionId,
    });

    if (root) {
      const rootNodeResult = await createNodeWithCrossGraphReuse(
        supabase,
        userId,
        graphId,
        {
          title: root.title || topic,
          content: root.content || "",
          level: "root",
          x_position: 400,
          y_position: 300,
          specificity: root.specificity,
        },
      );

      if (rootNodeResult) {
        totalNodes++;

        const coreNodeIds: string[] = [];

        for (let i = 0; i < coreNodes.length; i++) {
          const coreNode = coreNodes[i];

          const existing = existingNodeTitles.get(coreNode.title);
          if (existing && canReuseNode(coreNode.specificity, existing.specificity)) {
            logger.warn(
              `[GraphTaskService] Skipping duplicate node: ${coreNode.title}`,
            );
            continue;
          }

          const angle = (2 * Math.PI * i) / coreNodes.length;
          const radius = 200;

          const childNodeResult = await createNodeWithCrossGraphReuse(
            supabase,
            userId,
            graphId,
            {
              title: coreNode.title,
              content: coreNode.content || "",
              level: "core",
              x_position: 400 + radius * Math.cos(angle),
              y_position: 300 + radius * Math.sin(angle),
              specificity: coreNode.specificity,
            },
          );

          if (childNodeResult) {
            totalNodes++;
            coreNodeIds.push(childNodeResult.id);
            existingNodeTitles.set(coreNode.title, {
              knowledgePointId: childNodeResult.id,
              specificity: coreNode.specificity,
            });

            await supabase.from("edges").insert({
              graph_id: graphId,
              source_knowledge_point_id: rootNodeResult.id,
              target_knowledge_point_id: childNodeResult.id,
              relationship_type: "contains",
            });
          }
        }

        if (depth > 1 && coreNodeIds.length > 0) {
          for (let i = 0; i < coreNodes.length; i++) {
            const coreNode = coreNodes[i];
            const coreNodeId = coreNodeIds[i];

            if (coreNodeId) {
              const expandCount = await expandNodeForGraph(
                supabase,
                graphId,
                coreNodeId,
                coreNode.title,
                coreNode.content,
                "core",
                depth - 1,
                provider,
                userId,
                effectiveSessionId,
              );
              totalNodes += expandCount;
            }
          }
        }
      }
    }

    return totalNodes;
  } catch (error) {
    logger.warn(`Failed to generate nodes for ${topic}:`, error);
    return 0;
  }
}

export async function expandNodeForGraph(
  supabase: SupabaseClient,
  graphId: string,
  parentNodeId: string,
  parentNodeTitle: string,
  parentNodeContent: string | undefined,
  parentLevel: string,
  remainingDepth: number,
  provider: AIProvider,
  userId?: string,
  sessionId?: string,
): Promise<number> {
  try {
    let totalNodes = 0;
    const effectiveSessionId = sessionId || crypto.randomUUID();

    // 图内已有节点（title → {kpId, specificity}），复用判定与 AI 提示共用：
    // 泛化名称（generic）即使同名也新建独立节点，避免跨上下文语义串味。
    const existingNodeTitles = await getGraphNodeTitleMap(supabase, graphId);

    const { data: existingChildEdges } = await notDeleted(supabase
      .from("edges")
      .select(
        "target_knowledge_point_id, knowledge_points!edges_target_knowledge_point_id_fkey(title)",
      )
      .eq("source_knowledge_point_id", parentNodeId)
      );

    // 直接子节点标题（已解析为字符串），供 AI 提示「已有的子节点」去重
    const existingChildTitles = new Set<string>();
    existingChildEdges?.forEach((edge: KPTitleRef) => {
      const kp = Array.isArray(edge.knowledge_points)
        ? edge.knowledge_points[0]
        : edge.knowledge_points;
      const title = kp?.title
        ? resolveLocalizedText(kp.title as LocalizedText)
        : "";
      if (title) existingChildTitles.add(title);
    });

    // 消歧上下文：图谱元数据 + 祖先链 + 直接子节点，best-effort（失败返回空字段，不阻断展开）
    const disambiguation = await buildGraphDisambiguationContext(
      supabase,
      graphId,
      parentNodeId,
    );

    const { children } = await generateChildSuggestions(supabase, {
      nodeTitle: parentNodeTitle,
      nodeContent: parentNodeContent,
      nodeLevel: parentLevel,
      existingChildren: Array.from(existingChildTitles),
      style: "academic",
      provider,
      userId,
      graphId,
      sessionId: effectiveSessionId,
      disambiguation,
    });

    if (children.length > 0) {
      const childNodeIds: string[] = [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        const existing = existingNodeTitles.get(child.title);
        if (existing && canReuseNode(child.specificity, existing.specificity)) {
          logger.warn(
            `[GraphTaskService] Skipping duplicate child node: ${child.title}, parent: ${parentNodeTitle}`,
          );
          continue;
        }

        const angle = (2 * Math.PI * i) / children.length;
        const radius = 150;

        const childNodeResult = await createNodeWithCrossGraphReuse(
          supabase,
          userId,
          graphId,
          {
            title: child.title,
            content: child.content || "",
            level: getNextLevel(parentLevel),
            x_position: 400 + radius * Math.cos(angle),
            y_position: 300 + radius * Math.sin(angle),
            specificity: child.specificity,
          },
        );

        if (childNodeResult) {
          totalNodes++;
          childNodeIds.push(childNodeResult.id);
          existingNodeTitles.set(child.title, {
            knowledgePointId: childNodeResult.id,
            specificity: child.specificity,
          });

          await supabase.from("edges").insert({
            graph_id: graphId,
            source_knowledge_point_id: parentNodeId,
            target_knowledge_point_id: childNodeResult.id,
            relationship_type: "contains",
          });
        }
      }

      if (remainingDepth > 1) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const childNodeId = childNodeIds[i];

          if (childNodeId) {
            const expandCount = await expandNodeForGraph(
              supabase,
              graphId,
              childNodeId,
              child.title,
              child.content,
              getNextLevel(parentLevel),
              remainingDepth - 1,
              provider,
              userId,
              effectiveSessionId,
            );
            totalNodes += expandCount;
          }
        }
      }
    }

    return totalNodes;
  } catch (error) {
    logger.warn(`Failed to expand node ${parentNodeTitle}:`, error);
    return 0;
  }
}
