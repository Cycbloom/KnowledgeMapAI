import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";

interface TemplateNode {
  title: string;
  level?: string;
  x_position?: number;
  y_position?: number;
  aiPrompt?: string;
  color?: string;
  backboneModule?: string;
  needsRefinement?: boolean;
  suggestedContent?: string;
}

interface TemplateEdge {
  source: string;
  target: string;
  relationship_type?: string;
}

class TemplateRouteService {
  async createFromTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateNodes: TemplateNode[],
    templateEdges: TemplateEdge[] | undefined,
    graphId: string,
  ): Promise<void> {
    if (!templateNodes || templateNodes.length === 0) return;

    const { data: knowledgePoints, error: kpError } = await supabase
      .from("knowledge_points")
      .insert(
        templateNodes.map((node) => ({
          user_id: userId,
          title: node.title,
          level: node.level || "core",
          properties: {
            ...(node.aiPrompt && { aiPrompt: node.aiPrompt }),
            ...(node.color && { color: node.color }),
            ...(node.backboneModule && { backboneModule: node.backboneModule }),
            ...(node.needsRefinement !== undefined && {
              needsRefinement: node.needsRefinement,
            }),
            ...(node.suggestedContent && {
              suggestedContent: node.suggestedContent,
            }),
          },
        })),
      )
      .select("id, title");

    if (kpError) {
      logger.error("Failed to create knowledge points from template:", kpError);
      return;
    }

    if (!knowledgePoints || knowledgePoints.length === 0) return;

    const nodeTitleToId = new Map(
      knowledgePoints.map((kp) => [kp.title, kp.id]),
    );

    const graphNodesData = templateNodes
      .map((node) => {
        const kpId = nodeTitleToId.get(node.title);
        return {
          graph_id: graphId,
          knowledge_point_id: kpId,
          x: node.x_position || Math.random() * 400 - 200,
          y: node.y_position || Math.random() * 400 - 200,
        };
      })
      .filter((gn) => gn.knowledge_point_id);

    if (graphNodesData.length === 0) return;

    const { data: insertedNodes, error: gnError } = await supabase
      .from("graph_nodes")
      .insert(graphNodesData)
      .select("id, knowledge_point_id");

    if (gnError) {
      logger.error("Failed to create graph nodes from template:", gnError);
      return;
    }

    if (
      !insertedNodes ||
      insertedNodes.length === 0 ||
      !templateEdges ||
      templateEdges.length === 0
    ) {
      return;
    }

    const kpIdToNodeId = new Map(
      insertedNodes.map((gn) => [gn.knowledge_point_id, gn.id]),
    );

    const edgesData: Array<{
      graph_id: string;
      source_node_id: string;
      target_node_id: string;
      relationship_type: string;
    }> = [];

    for (const edge of templateEdges) {
      const sourceNode = templateNodes.find((n) => n.title === edge.source);
      const targetNode = templateNodes.find((n) => n.title === edge.target);

      if (sourceNode && targetNode) {
        const sourceKpId = nodeTitleToId.get(sourceNode.title);
        const targetKpId = nodeTitleToId.get(targetNode.title);
        const sourceNodeId = kpIdToNodeId.get(sourceKpId);
        const targetNodeId = kpIdToNodeId.get(targetKpId);

        if (sourceNodeId && targetNodeId) {
          edgesData.push({
            graph_id: graphId,
            source_node_id: sourceNodeId,
            target_node_id: targetNodeId,
            relationship_type: edge.relationship_type || "contains",
          });
        }
      }
    }

    if (edgesData.length > 0) {
      const { error: edgeError } = await supabase
        .from("edges")
        .insert(edgesData);

      if (edgeError) {
        logger.error("Failed to create edges from template:", edgeError);
      }
    }
  }
}

export const templateRouteService = new TemplateRouteService();
