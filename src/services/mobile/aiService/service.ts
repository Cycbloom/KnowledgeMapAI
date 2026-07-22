import { getMobileSupabaseClient } from "@/lib/supabase";
import { mobilePromptService } from "../prompt/index";
import type { StudyCard } from "@shared/types/common";
import {
  MOBILE_AI_CONFIG_KEY,
  MobileAIUserConfig,
  getAIConfigFromUserSettings,
  storeAIConfig,
  createAIClient,
} from "./config";
import {
  GeneratedCard,
  GenerateCardsResult,
  AICardGenError,
  classifyError,
} from "./errors";
import {
  GenerateLearningMaterialResult,
  getLearningMaterialSystemPrompt,
} from "./prompts";
import { isValidProvider } from "../aiClient";
import { logger } from "@/utils/logger";
import { AppError, SharedErrorCodes } from "@/utils/errors";

export const mobileAIService = {
  isConfigured: (): boolean => {
    const config = getAIConfigFromUserSettings();
    return !!(config && config.apiKey && config.apiKey.trim() !== "");
  },

  getConfig: (): MobileAIUserConfig | null => {
    return getAIConfigFromUserSettings();
  },

  setConfig: (config: MobileAIUserConfig): void => {
    if (!config.apiKey || config.apiKey.trim() === "") {
      logger.error("[MobileAIService.setConfig] API Key 不能为空");
      throw new AppError("API Key cannot be empty", SharedErrorCodes.AI_PROVIDER_NOT_CONFIGURED, 500);
    }
    if (!isValidProvider(config.provider)) {
      logger.error(
        "[MobileAIService.setConfig] 无效的 Provider:",
        config.provider,
      );
      throw new AppError(`Unsupported AI provider: ${config.provider}`, SharedErrorCodes.VALIDATION_ERROR, 400);
    }
    storeAIConfig(config);
  },

  clearConfig: (): void => {
    localStorage.removeItem(MOBILE_AI_CONFIG_KEY);
  },

  generateCards: async (
    topic: string,
    content: string,
    options: {
      types?: string[];
      count?: number;
      difficulty?: "easy" | "medium" | "hard";
      userId?: string;
      graphId?: string;
    } = {},
  ): Promise<GenerateCardsResult> => {
    const client = createAIClient();
    if (!client) {
      const aiError: AICardGenError = {
        type: "api_key_missing",
        message: "AI 服务未配置",
        suggestion: "请前往设置页面配置 AI API Key",
        retryable: false,
      };
      throw aiError;
    }

    const supabase = getMobileSupabaseClient();
    const types = options.types || ["qa", "choice"];
    const count = options.count || 3;
    const difficulty = options.difficulty || "medium";
    const userId = options.userId;
    const graphId = options.graphId;

    const typeRestriction =
      types.length === 1
        ? `CRITICAL: ONLY generate cards of type '${types[0]}'. DO NOT generate any other types.`
        : `Allowed card types: ${types.join(", ")}. Only generate these types.`;

    const defaultSystemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.

${typeRestriction}

Output format (JSON):
{
  "cards": [
    {
      "type": "qa|choice|true_false|multi_choice|fill_in_the_blank",
      "question": "The question text",
      "answer": "The answer text",
      "explanation": "Optional explanation",
      "options": ["option1", "option2", "option3", "option4"],
      "correct_indices": [0]
    }
  ]
}

Important:
- For 'qa' type: question and answer are required
- For 'choice' type: options array with 4 options, correct_indices with single index
- For 'true_false' type: answer should be "true" or "false"
- For 'multi_choice' type: correct_indices can have multiple values
- For 'fill_in_the_blank' type: use '___' for blanks in question`;

    let systemPrompt = defaultSystemPrompt;

    if (supabase && userId && graphId) {
      try {
        const promptCode =
          types.length === 1
            ? `generate_cards_${types[0].replace("fill_in_the_blank", "fill_blank")}`
            : "generate_cards";
        const context = {
          topic,
          content: content || "No detailed content provided.",
          types: types.join(", "),
          count,
          difficulty,
          typeRestriction,
        };

        const renderedPrompt = await mobilePromptService.getRenderedPrompt(
          supabase,
          promptCode,
          context,
          userId,
          graphId,
        );

        if (renderedPrompt && renderedPrompt.trim()) {
          systemPrompt = renderedPrompt;
        }
      } catch (error) {
        logger.warn(
          "[MobileAIService.generateCards] 获取 Prompt 模板失败，使用默认模板:",
          error,
        );
      }
    }

    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: `Topic: ${topic}\nContent: ${content || "No detailed content provided."}`,
      },
    ];

    try {
      const result = await client.chatWithJson<GenerateCardsResult>(messages);

      let cards = result.cards || [];

      cards = cards.filter((card: GeneratedCard) => {
        return types.includes(card.type);
      });

      return { cards };
    } catch (error) {
      logger.error("[MobileAIService.generateCards] 生成题目失败:", error);
      const classifiedError = classifyError(error);
      throw classifiedError;
    }
  },

  saveCardsToStudyCards: async (
    cards: GeneratedCard[],
    knowledgePointId: string,
    graphId: string,
  ): Promise<{ success: boolean; count: number }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      const dbError: AICardGenError = {
        type: "database_error",
        message: "数据库客户端未初始化",
        suggestion: "请刷新页面后重试",
        retryable: true,
      };
      throw dbError;
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      const authError: AICardGenError = {
        type: "api_key_invalid",
        message: "用户未登录",
        suggestion: "请重新登录后再试",
        retryable: false,
      };
      throw authError;
    }

    const cardsToInsert = cards.map((card) => ({
      user_id: user.id,
      knowledge_point_id: knowledgePointId,
      graph_id: graphId,
      source_graph_id: graphId,
      question: card.question,
      answer: card.answer,
      explanation: card.explanation || null,
      card_type: card.type,
      options: card.options || null,
      next_review: new Date().toISOString(),
      difficulty: 1,
      fsrs_state: "New",
      fsrs_stability: 0,
      fsrs_difficulty: 0,
      fsrs_elapsed_days: 0,
      fsrs_scheduled_days: 0,
      fsrs_retrievability: 0,
    }));

    const { data, error } = await client
      .from("study_cards")
      .insert(cardsToInsert)
      .select();

    if (error) {
      logger.error(
        "[MobileAIService.saveCardsToStudyCards] 数据库写入失败:",
        error,
      );
      const dbError: AICardGenError = {
        type: "database_error",
        message: "数据库写入失败",
        suggestion: `题目生成成功但保存失败: ${error.message}`,
        retryable: true,
      };
      throw dbError;
    }

    return { success: true, count: (data as StudyCard[]).length };
  },

  generateAndSaveCards: async (
    topic: string,
    content: string,
    knowledgePointId: string,
    graphId: string,
    options: {
      types?: string[];
      count?: number;
      difficulty?: "easy" | "medium" | "hard";
    } = {},
  ): Promise<{
    success: boolean;
    cards: GeneratedCard[];
    savedCount: number;
  }> => {
    const supabase = getMobileSupabaseClient();
    let userId: string | undefined;

    if (supabase) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        logger.warn(
          "[MobileAIService.generateAndSaveCards] 获取用户信息失败:",
          error,
        );
      }
    }

    const result = await mobileAIService.generateCards(topic, content, {
      ...options,
      userId,
      graphId,
    });

    if (result.cards.length === 0) {
      return { success: false, cards: [], savedCount: 0 };
    }

    try {
      const saveResult = await mobileAIService.saveCardsToStudyCards(
        result.cards,
        knowledgePointId,
        graphId,
      );

      return {
        success: saveResult.success,
        cards: result.cards,
        savedCount: saveResult.count,
      };
    } catch (saveError) {
      logger.error(
        "[MobileAIService.generateAndSaveCards] 保存失败:",
        saveError,
      );
      const dbError: AICardGenError = {
        type: "database_error",
        message: "数据库写入失败",
        suggestion: `题目已生成 ${result.cards.length} 道，但保存失败。请检查网络后重试。`,
        retryable: true,
      };
      throw dbError;
    }
  },

  generateLearningMaterial: async (
    topic: string,
    context: string,
    options: {
      level?: string;
      language?: string;
    } = {},
  ): Promise<GenerateLearningMaterialResult> => {
    const client = createAIClient();
    if (!client) {
      logger.error("[MobileAIService.generateLearningMaterial] AI 服务未配置");
      throw new AppError("AI service not configured, please configure API Key in settings first", SharedErrorCodes.AI_PROVIDER_NOT_CONFIGURED, 500);
    }

    const isEnglish = options.language === "en-US" || options.language === "en";
    const userPrompt = isEnglish
      ? `Topic: ${topic}
Context/Background: ${context || "General knowledge"}
${options.level ? `Knowledge Level: ${options.level}` : ""}

Please generate the learning material based on the instructions above.`
      : `主题：${topic}
背景/上下文：${context || "通用知识"}
${options.level ? `知识水平：${options.level}` : ""}

请根据上述要求生成学习资料。`;

    const messages = [
      { role: "system" as const, content: getLearningMaterialSystemPrompt(options.language) },
      { role: "user" as const, content: userPrompt },
    ];

    try {
      const result =
        await client.chatWithJson<GenerateLearningMaterialResult>(messages);

      const normalizedKeywords = Array.isArray(result.keywords)
        ? result.keywords.map((k) => ({
            term: k.term || "",
            importance: Math.min(5, Math.max(1, k.importance || 3)),
            category: k.category || (isEnglish ? "Concept" : "概念"),
            explanation: k.explanation || "",
          }))
        : [];

      return {
        content: result.content || "",
        keywords: normalizedKeywords,
      };
    } catch (error) {
      logger.error(
        "[MobileAIService.generateLearningMaterial] 生成学习资料失败:",
        error,
      );
      throw new AppError(
        `Failed to generate learning material: ${error instanceof Error ? error.message : "unknown error"}`,
        SharedErrorCodes.AI_INVALID_RESPONSE,
        502,
      );
    }
  },

  expandKnowledge: async (
    nodeTitle: string,
    nodeContent?: string,
    existingNodes?: string[],
    childNodes?: string[],
    options: {
      contextLevel?: string;
      expandPrompt?: string;
    } = {},
  ): Promise<{ suggestions: Array<{ title: string; content: string }> }> => {
    const client = createAIClient();
    if (!client) {
      throw new AppError("AI service not configured, please configure API Key in settings first", SharedErrorCodes.AI_PROVIDER_NOT_CONFIGURED, 500);
    }

    const existingNodesContext =
      existingNodes && existingNodes.length > 0
        ? `\nExisting Nodes in Graph: ${existingNodes.slice(0, 300).join(", ")}`
        : "";

    const childrenContext =
      childNodes && childNodes.length > 0
        ? `\nCurrent Direct Children (DO NOT suggest these): ${childNodes.join(", ")}`
        : "";

    const contextLevel = options.contextLevel || "normal";

    const systemPrompt = `You are an expert knowledge architect. Your task is to suggest child nodes for a given knowledge node.

${options.expandPrompt ? `Custom Instructions: ${options.expandPrompt}` : ""}

Guidelines:
- Suggest 3-5 child nodes that are specific, non-overlapping subtopics
- Each child should be a meaningful subdivision of the parent topic
- Avoid suggesting nodes that already exist in the graph
- Consider the node's position in the hierarchy:
  ${contextLevel === "root" || contextLevel === "core" ? "- This is a root/core node: suggest foundational subtopics" : ""}
  ${contextLevel === "leaf" ? "- This is a leaf node: suggest detailed, specific aspects" : ""}
- Provide clear, educational content for each suggestion

Return a JSON object with a 'suggestions' array. Each object in the array must have 'title' and 'content' fields.
Example format: { "suggestions": [{ "title": "Example Title", "content": "Example content" }] }
Please respond in Chinese.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: `Node Title: ${nodeTitle}\nNode Content: ${nodeContent || ""}${existingNodesContext}${childrenContext}`,
      },
    ];

    try {
      const result = await client.chatWithJson<{
        suggestions: Array<{ title: string; content: string }>;
      }>(messages);

      return {
        suggestions: Array.isArray(result.suggestions)
          ? result.suggestions.map((s) => ({
              title: s.title || "",
              content: s.content || "",
            }))
          : [],
      };
    } catch (error) {
      logger.error(
        "[MobileAIService.expandKnowledge] 扩展知识节点失败:",
        error,
      );
      throw new AppError(
        `Failed to expand knowledge node: ${error instanceof Error ? error.message : "unknown error"}`,
        SharedErrorCodes.AI_INVALID_RESPONSE,
        502,
      );
    }
  },
};
