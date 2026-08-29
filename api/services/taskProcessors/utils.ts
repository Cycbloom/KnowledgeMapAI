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
import type { NodeLevel } from "@shared/types/graph";

interface KPTitleRef {
  knowledge_points?: { title?: string } | { title?: string }[] | null;
}

interface CreatedNodeRef {
  id: string;
}

/**
 * 带跨图谱复用的建节点：命中本人已有的同义知识点则复用（仅新增 graph_nodes 关联），
 * 否则按原逻辑新建知识点节点。返回值 id 统一为 knowledge_point_id，供边关系引用。
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
  },
): Promise<CreatedNodeRef | null> {
  if (userId) {
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

    const { data: existingNodes } = await notDeleted(supabase
      .from("graph_nodes")
      .select("knowledge_points(title)")
      .eq("graph_id", graphId)
      );

    const existingNodeTitles = new Set<string>();
    existingNodes?.forEach((gn: KPTitleRef) => {
      const kp = Array.isArray(gn.knowledge_points)
        ? gn.knowledge_points[0]
        : gn.knowledge_points;
      if (kp?.title) existingNodeTitles.add(kp.title);
    });

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
        },
      );

      if (rootNodeResult) {
        totalNodes++;

        const coreNodeIds: string[] = [];

        for (let i = 0; i < coreNodes.length; i++) {
          const coreNode = coreNodes[i];

          if (existingNodeTitles.has(coreNode.title)) {
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
            },
          );

          if (childNodeResult) {
            totalNodes++;
            coreNodeIds.push(childNodeResult.id);
            existingNodeTitles.add(coreNode.title);

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

    const { data: existingChildEdges } = await notDeleted(supabase
      .from("edges")
      .select(
        "target_knowledge_point_id, knowledge_points!edges_target_knowledge_point_id_fkey(title)",
      )
      .eq("source_knowledge_point_id", parentNodeId)
      );

    const existingChildTitles = new Set<string>();
    existingChildEdges?.forEach((edge: KPTitleRef) => {
      const kp = Array.isArray(edge.knowledge_points)
        ? edge.knowledge_points[0]
        : edge.knowledge_points;
      if (kp?.title) existingChildTitles.add(kp.title);
    });

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
    });

    if (children.length > 0) {
      const childNodeIds: string[] = [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (existingChildTitles.has(child.title)) {
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
          },
        );

        if (childNodeResult) {
          totalNodes++;
          childNodeIds.push(childNodeResult.id);
          existingChildTitles.add(child.title);

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
