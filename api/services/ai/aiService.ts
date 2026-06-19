// AIService - 门面类，委托给各领域子服务
import { embeddingOps } from "./embeddingOps";
import { chatService } from "./chatService";
import { cardGenerationService } from "./cardGenerationService";
import { knowledgeExpansionService } from "./knowledgeExpansionService";
import { contentGenerationService } from "./contentGenerationService";
import { analysisService } from "./analysisService";
import { logger } from "../../utils/logger";

interface GraphNode {
  id: string;
  title: string;
  content?: string | null;
}

interface GraphEdge {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship?: string | null;
}

interface BuildGraphContextOptions {
  contextNodeIds?: string[];
  maxContextLength?: number;
  graphId?: string;
}

interface TutorContext {
  mode: string;
  graphId?: string;
  existingNodes?: string[];
  currentNodeId?: string;
  currentNodeTitle?: string;
  currentNodeContent?: string;
}

// Re-export types from 子服务，保持外部 API 不变
export type { CardDifficulty, GenerateCardsOptions } from "./cardGenerationService";
export type { GenerateLearningMaterialResult } from "./contentGenerationService";

export class AIService {
  // === 嵌入向量 (EmbeddingOps) ===
  async generateEmbedding(text: string) {
    return embeddingOps.generateEmbedding(text);
  }

  async generateEmbeddingsBatch(texts: string[]) {
    return embeddingOps.generateEmbeddingsBatch(texts);
  }

  // === 对话与辅导 (ChatService) ===
  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      timeout?: number;
      sessionId?: string;
      operation?: string;
    },
  ) {
    return chatService.chat(messages, options);
  }

  async tutorChat(
    messages: Array<{ role: string; content: string }>,
    context?: {
      graphId?: string;
      currentNodeId?: string;
      currentNodeTitle?: string;
      currentNodeContent?: string;
      existingNodes?: string[];
      userProgress?: { masteredCount?: number; dueCount?: number };
      mode?: "free" | "guided";
      learningPath?: string[];
    },
    options?: { provider?: import("@shared/types").AIProviderType; model?: string },
  ) {
    return chatService.tutorChat(messages, context, options);
  }

  // === 学习卡片生成 (CardGenerationService) ===
  async generateCards(
    topic: string,
    content: string,
    options?: import("./cardGenerationService").GenerateCardsOptions,
  ) {
    return cardGenerationService.generateCards(topic, content, options);
  }

  // === 知识扩展与推荐 (KnowledgeExpansionService) ===
  async expandKnowledge(
    nodeTitle: string,
    nodeContent?: string,
    existingNodes?: string[],
    childNodes?: string[],
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      contextLevel?: string;
      expandPrompt?: string;
      userId?: string;
      graphId?: string;
      language?: string;
    },
  ) {
    return knowledgeExpansionService.expandKnowledge(nodeTitle, nodeContent, existingNodes, childNodes, options);
  }

  async getBranchSuggestions(
    nodeTitle: string,
    nodeContent?: string,
    existingNodes?: string[],
    childNodes?: string[],
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      contextLevel?: string;
      userId?: string;
      graphId?: string;
      language?: string;
    },
  ) {
    return knowledgeExpansionService.getBranchSuggestions(nodeTitle, nodeContent, existingNodes, childNodes, options);
  }

  async suggestNextTopic(
    nodeTitle: string,
    nodeContent?: string,
    _existingNodes?: string[],
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      userProgress?: { masteredCount?: number; currentLevel?: string };
    },
  ) {
    return knowledgeExpansionService.suggestNextTopic(nodeTitle, nodeContent, _existingNodes, options);
  }

  // === 内容生成 (ContentGenerationService) ===
  async generatePodcastScript(context: string, language?: string) {
    return contentGenerationService.generatePodcastScript(context, language);
  }

  async generateLearningMaterial(
    topic: string,
    context: string,
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      level?: string;
      userId?: string;
      graphId?: string;
      language?: string;
    },
  ) {
    return contentGenerationService.generateLearningMaterial(topic, context, options);
  }

  async generateTaskDetails(
    title: string,
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      context?: string;
      userId?: string;
      language?: string;
    },
  ) {
    return contentGenerationService.generateTaskDetails(title, options);
  }

  // === 图谱上下文构建 ===

  buildGraphContext(
    nodes: (GraphNode | null)[],
    edges: GraphEdge[],
    options: BuildGraphContextOptions = {},
  ): string {
    const {
      contextNodeIds,
      maxContextLength = 15000,
      graphId,
    } = options;

    const validNodes = nodes.filter(
      (n): n is NonNullable<typeof n> => n !== null,
    );

    let contextText = "";

    if (contextNodeIds && contextNodeIds.length > 0) {
      const selectedNodes = validNodes.filter((n) =>
        contextNodeIds.includes(n.id),
      );
      const nodesText = selectedNodes
        .map((n) => `[Node] ${n.title}: ${n.content || "(No content)"}`)
        .join("\n");

      const relatedEdges = edges.filter(
        (e) =>
          contextNodeIds.includes(e.source_knowledge_point_id) &&
          contextNodeIds.includes(e.target_knowledge_point_id),
      );

      const nodeTitleMap = new Map(validNodes.map((n) => [n.id, n.title]));

      const edgesText = relatedEdges
        .map((e) => {
          const source =
            nodeTitleMap.get(e.source_knowledge_point_id) || "Unknown";
          const target =
            nodeTitleMap.get(e.target_knowledge_point_id) || "Unknown";
          return `[Edge] ${source} -> ${target} (${e.relationship || "related"})`;
        })
        .join("\n");

      contextText = `Selected Nodes:\n${nodesText}\n\nRelationships:\n${edgesText}`;
    } else {
      const nodeTitleMap = new Map(validNodes.map((n) => [n.id, n.title]));

      if (validNodes.length > 100) {
        const nodesText = validNodes.map((n) => `- ${n.title}`).join("\n");
        contextText = `Graph Overview (Nodes Only):\n${nodesText}`;
      } else {
        const nodesText = validNodes
          .map((n) => `[Node] ${n.title}: ${n.content || "(No content)"}`)
          .join("\n");
        const edgesText = edges
          .map((e) => {
            const source =
              nodeTitleMap.get(e.source_knowledge_point_id) || "Unknown";
            const target =
              nodeTitleMap.get(e.target_knowledge_point_id) || "Unknown";
            return `[Edge] ${source} -> ${target} (${e.relationship || "related"})`;
          })
          .join("\n");

        contextText = `All Nodes:\n${nodesText}\n\nAll Relationships:\n${edgesText}`;
      }
    }

    if (contextText.length > maxContextLength) {
      contextText = `${contextText.substring(0, maxContextLength)}...(truncated)`;
      logger.warn("Graph context truncated due to length", {
        graph_id: graphId,
        length: contextText.length,
      });
    }

    return contextText;
  }

  buildTutorContext(
    nodes: (GraphNode | null)[],
    currentNodeId?: string,
    mode: string = "free",
    graphId?: string,
  ): TutorContext {
    const validNodes = nodes.filter(
      (n): n is NonNullable<typeof n> => n !== null,
    );

    const context: TutorContext = { mode };

    if (graphId) {
      context.graphId = graphId;
      context.existingNodes = validNodes.map((n) => n.title);

      if (currentNodeId) {
        const currentNode = validNodes.find((n) => n.id === currentNodeId);
        if (currentNode) {
          context.currentNodeId = currentNode.id;
          context.currentNodeTitle = currentNode.title;
          context.currentNodeContent = currentNode.content ?? undefined;
        }
      }
    }

    return context;
  }

  // === 分析与提取 (AnalysisService) ===
  async extractConcepts(
    text: string,
    existingNodes?: string[],
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      maxConcepts?: number;
    },
  ) {
    return analysisService.extractConcepts(text, existingNodes, options);
  }

  async generateGraphFromImage(
    imageBase64: string,
    options?: { provider?: import("@shared/types").AIProviderType; model?: string },
  ) {
    return analysisService.generateGraphFromImage(imageBase64, options);
  }

  async analyzeCrossGraphConnections(
    graph1: { id: string; title?: string; nodes: Array<{ id: string; title: string; content?: string }> },
    graph2: { id: string; title?: string; nodes: Array<{ id: string; title: string; content?: string }> },
    options?: {
      provider?: import("@shared/types").AIProviderType;
      model?: string;
      userId?: string;
      language?: string;
    },
  ) {
    return analysisService.analyzeCrossGraphConnections(graph1, graph2, options);
  }
}

export const aiService = new AIService();
