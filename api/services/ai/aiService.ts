// AIService - 门面类，委托给各领域子服务
import { embeddingOps } from "./embeddingOps";
import { chatService } from "./chatService";
import { cardGenerationService } from "./cardGenerationService";
import { knowledgeExpansionService } from "./knowledgeExpansionService";
import { contentGenerationService } from "./contentGenerationService";
import { analysisService } from "./analysisService";

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
