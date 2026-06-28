import type { AgentTool, ToolContext } from "../types";
import { createKnowledgePointWithGraphNode } from "../../../utils/nodeHelpers";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { notDeleted } from '../../common/softDeleteHelper';

const createNodeTool: AgentTool = {
  name: "create_node",
  description: "在指定图谱中创建知识点节点",
  category: "write",
  riskLevel: "low",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      graph_id: {
        type: "string",
        description: "目标图谱ID",
      },
      title: {
        type: "string",
        description: "知识点标题",
      },
      content: {
        type: "string",
        description: "知识点内容",
      },
      level: {
        type: "string",
        description: "节点级别（root/core/sub/normal/leaf），默认normal",
      },
    },
    required: ["graph_id", "title"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graph_id as string;
    const title = params.title as string;
    const content = (params.content as string) || "";
    const level = (params.level as string) || "normal";

    const { data: graph, error: graphError } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("id", graphId)
      .eq("user_id", userId)
      )
      .single();

    if (graphError) {
      throw new Error(`Failed to verify graph ownership: ${graphError.message}`);
    }

    if (!graph) {
      throw new Error("Graph not found or access denied");
    }

    const result = await createKnowledgePointWithGraphNode(supabase, userId, {
      graph_id: graphId,
      title,
      content,
      level,
    });

    if (!result) {
      throw new AppError(
        "创建知识点节点失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    return { success: true, node: { id: result.knowledge_point_id, title, level }, graph_id: graphId };
  },
};

const createEdgeTool: AgentTool = {
  name: "create_edge",
  description: "在指定图谱中创建知识关系边",
  category: "write",
  riskLevel: "low",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      graph_id: {
        type: "string",
        description: "目标图谱ID",
      },
      source_knowledge_point_id: {
        type: "string",
        description: "源知识点ID",
      },
      target_knowledge_point_id: {
        type: "string",
        description: "目标知识点ID",
      },
      relationship_type: {
        type: "string",
        description: "关系类型（如 prerequisite/contains/related 等）",
      },
    },
    required: ["graph_id", "source_knowledge_point_id", "target_knowledge_point_id", "relationship_type"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graph_id as string;
    const sourceKnowledgePointId = params.source_knowledge_point_id as string;
    const targetKnowledgePointId = params.target_knowledge_point_id as string;
    const relationshipType = params.relationship_type as string;

    const { data: graph, error: graphError } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("id", graphId)
      .eq("user_id", userId)
      )
      .single();

    if (graphError) {
      throw new Error(`Failed to verify graph ownership: ${graphError.message}`);
    }

    if (!graph) {
      throw new Error("Graph not found or access denied");
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("graph_nodes")
      .select("knowledge_point_id")
      .eq("graph_id", graphId)
      .in("knowledge_point_id", [sourceKnowledgePointId, targetKnowledgePointId]);

    if (nodesError) {
      throw new Error(`Failed to verify knowledge points: ${nodesError.message}`);
    }

    const foundIds = new Set((nodes || []).map((n) => n.knowledge_point_id));
    if (!foundIds.has(sourceKnowledgePointId)) {
      throw new Error("Source knowledge point not found in this graph");
    }
    if (!foundIds.has(targetKnowledgePointId)) {
      throw new Error("Target knowledge point not found in this graph");
    }

    const { data: edge, error: edgeError } = await supabase
      .from("edges")
      .insert({
        graph_id: graphId,
        source_knowledge_point_id: sourceKnowledgePointId,
        target_knowledge_point_id: targetKnowledgePointId,
        relationship_type: relationshipType,
      })
      .select("id")
      .single();

    if (edgeError) {
      throw new Error(`Failed to create edge: ${edgeError.message}`);
    }

    return {
      success: true,
      edge: { id: edge.id, source: sourceKnowledgePointId, target: targetKnowledgePointId, relationship_type: relationshipType },
      graph_id: graphId,
    };
  },
};

const createGraphRelationTool: AgentTool = {
  name: "create_graph_relation",
  description: "创建两个图谱之间的关系",
  category: "write",
  riskLevel: "medium",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      source_graph_id: {
        type: "string",
        description: "源图谱ID",
      },
      target_graph_id: {
        type: "string",
        description: "目标图谱ID",
      },
      relation_type: {
        type: "string",
        description: "关系类型（prerequisite/extension/related/cross_domain）",
      },
      context: {
        type: "string",
        description: "关系描述或理由",
      },
    },
    required: ["source_graph_id", "target_graph_id", "relation_type"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const sourceGraphId = params.source_graph_id as string;
    const targetGraphId = params.target_graph_id as string;
    const relationType = params.relation_type as string;
    const contextDesc = params.context as string | undefined;

    const { data: graphs, error: graphsError } = await notDeleted(supabase
      .from("knowledge_graphs")
      .select("id")
      .eq("user_id", userId)
      )
      .in("id", [sourceGraphId, targetGraphId]);

    if (graphsError) {
      throw new Error(`Failed to verify graph ownership: ${graphsError.message}`);
    }

    const foundIds = new Set((graphs || []).map((g) => g.id));
    if (!foundIds.has(sourceGraphId)) {
      throw new Error("Source graph not found or access denied");
    }
    if (!foundIds.has(targetGraphId)) {
      throw new Error("Target graph not found or access denied");
    }

    const { data: relation, error: relationError } = await supabase
      .from("graph_relations")
      .insert({
        source_graph_id: sourceGraphId,
        target_graph_id: targetGraphId,
        relation_type: relationType,
        context: contextDesc,
        source: "ai_agent",
      })
      .select("id")
      .single();

    if (relationError) {
      throw new Error(`Failed to create graph relation: ${relationError.message}`);
    }

    return {
      success: true,
      relation: { id: relation.id, source_graph_id: sourceGraphId, target_graph_id: targetGraphId, relation_type: relationType },
    };
  },
};

const createStudyCardTool: AgentTool = {
  name: "create_study_card",
  description: "为知识点创建学习卡片",
  category: "write",
  riskLevel: "low",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      knowledge_point_id: {
        type: "string",
        description: "关联的知识点ID",
      },
      question: {
        type: "string",
        description: "卡片问题",
      },
      answer: {
        type: "string",
        description: "卡片答案",
      },
      card_type: {
        type: "string",
        description: "卡片类型（qa/multiple_choice/true_false），默认qa",
      },
    },
    required: ["knowledge_point_id", "question", "answer"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const knowledgePointId = params.knowledge_point_id as string;
    const question = params.question as string;
    const answer = params.answer as string;
    const cardType = (params.card_type as string) || "qa";

    const { data: graphNode, error: gnError } = await supabase
      .from("graph_nodes")
      .select("graph_id, knowledge_graphs!graph_id (user_id)")
      .eq("knowledge_point_id", knowledgePointId)
      .single();

    if (gnError) {
      throw new Error(`Failed to verify knowledge point access: ${gnError.message}`);
    }

    if (!graphNode) {
      throw new Error("Knowledge point not found or access denied");
    }

    const graphData = graphNode.knowledge_graphs as unknown as { user_id: string };
    if (graphData.user_id !== userId) {
      throw new Error("Knowledge point not found or access denied");
    }

    const { data: card, error: cardError } = await supabase
      .from("study_cards")
      .insert({
        user_id: userId,
        knowledge_point_id: knowledgePointId,
        question,
        answer,
        card_type: cardType,
      })
      .select("id")
      .single();

    if (cardError) {
      throw new Error(`Failed to create study card: ${cardError.message}`);
    }

    return { success: true, card: { id: card.id, question, card_type: cardType } };
  },
};

const updateNodeTool: AgentTool = {
  name: "update_node",
  description: "更新知识点的内容或标题",
  category: "write",
  riskLevel: "medium",
  requiresConfirmation: true,
  parameters: {
    type: "object",
    properties: {
      knowledge_point_id: {
        type: "string",
        description: "要更新的知识点ID",
      },
      title: {
        type: "string",
        description: "新标题（可选）",
      },
      content: {
        type: "string",
        description: "新内容（可选）",
      },
    },
    required: ["knowledge_point_id"],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const knowledgePointId = params.knowledge_point_id as string;
    const title = params.title as string | undefined;
    const content = params.content as string | undefined;

    const { data: graphNode, error: gnError } = await supabase
      .from("graph_nodes")
      .select("graph_id, knowledge_graphs!graph_id (user_id)")
      .eq("knowledge_point_id", knowledgePointId)
      .single();

    if (gnError) {
      throw new Error(`Failed to verify knowledge point access: ${gnError.message}`);
    }

    if (!graphNode) {
      throw new Error("Knowledge point not found or access denied");
    }

    const graphData = graphNode.knowledge_graphs as unknown as { user_id: string };
    if (graphData.user_id !== userId) {
      throw new Error("Knowledge point not found or access denied");
    }

    const updateData: Record<string, string> = {};
    const updatedFields: string[] = [];

    if (title) {
      updateData.title = title;
      updatedFields.push("title");
    }
    if (content) {
      updateData.content = content;
      updatedFields.push("content");
    }

    if (updatedFields.length === 0) {
      throw new Error("No fields to update. Provide at least one of: title, content");
    }

    const { data: updated, error: updateError } = await supabase
      .from("knowledge_points")
      .update(updateData)
      .eq("id", knowledgePointId)
      .select("id, title, content")
      .single();

    if (updateError) {
      throw new Error(`Failed to update knowledge point: ${updateError.message}`);
    }

    return { success: true, node: { id: updated.id, title: updated.title, content: updated.content }, updated_fields: updatedFields };
  },
};

export const writeTools: AgentTool[] = [
  createNodeTool,
  createEdgeTool,
  createGraphRelationTool,
  createStudyCardTool,
  updateNodeTool,
];
