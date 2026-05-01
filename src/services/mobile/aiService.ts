import { useStore } from "../../store/useStore";
import {
  createMobileAIClient,
  MobileAIClient,
  isValidProvider,
} from "./aiClient";
import type { AIProviderType } from "@shared/types";
import type { StudyCard } from "@shared/types/common";
import { getMobileSupabaseClient } from "./client";
import { mobilePromptService } from "./promptService";

const MOBILE_AI_CONFIG_KEY = "mobile_ai_config";

export interface MobileAIUserConfig {
  provider: AIProviderType;
  model?: string;
  apiKey: string;
}

const ENV_API_KEYS: Record<AIProviderType, string | undefined> = {
  deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
  volcengine: import.meta.env.VITE_VOLCENGINE_API_KEY,
  aliyun: import.meta.env.VITE_ALIYUN_API_KEY,
  openai: import.meta.env.VITE_OPENAI_API_KEY,
  zhipu: import.meta.env.VITE_ZHIPU_API_KEY,
  moonshot: import.meta.env.VITE_MOONSHOT_API_KEY,
};

function getStoredAIConfig(): MobileAIUserConfig | null {
  try {
    const stored = localStorage.getItem(MOBILE_AI_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("[MobileAIService] 加载本地存储配置失败:", e);
  }
  return null;
}

function storeAIConfig(config: MobileAIUserConfig): void {
  try {
    localStorage.setItem(MOBILE_AI_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("[MobileAIService] 保存配置到本地存储失败:", e);
  }
}

function getAIConfigFromEnv(): MobileAIUserConfig | null {
  const { user } = useStore.getState();
  const aiConfig = user?.profile?.settings?.ai_config?.text;

  const provider = (aiConfig?.provider || "deepseek") as AIProviderType;
  const apiKey = ENV_API_KEYS[provider];

  if (!apiKey) {
    return null;
  }

  return {
    provider,
    model: aiConfig?.model,
    apiKey,
  };
}

function getAIConfigFromUserSettings(): MobileAIUserConfig | null {
  const envConfig = getAIConfigFromEnv();
  if (envConfig) {
    return envConfig;
  }

  const { user } = useStore.getState();
  const aiConfig = user?.profile?.settings?.ai_config?.text;
  const storedConfig = getStoredAIConfig();

  if (
    storedConfig &&
    storedConfig.apiKey &&
    storedConfig.apiKey.trim() !== ""
  ) {
    const provider = (aiConfig?.provider ||
      storedConfig.provider) as AIProviderType;

    if (!isValidProvider(provider)) {
      console.error("[MobileAIService] 无效的 Provider:", provider);
      return null;
    }

    return {
      provider,
      model: aiConfig?.model || storedConfig.model,
      apiKey: storedConfig.apiKey,
    };
  }

  return null;
}

function createAIClient(): MobileAIClient | null {
  const config = getAIConfigFromUserSettings();
  if (!config || !config.apiKey || config.apiKey.trim() === "") {
    console.warn("[MobileAIService] AI 服务未配置");
    return null;
  }

  try {
    return createMobileAIClient(config);
  } catch (error) {
    console.error("[MobileAIService] 创建 AI 客户端失败:", error);
    return null;
  }
}

interface GeneratedCard {
  type: "qa" | "choice" | "true_false" | "multi_choice" | "fill_in_the_blank";
  question: string;
  answer: string;
  explanation?: string;
  options?: string[];
  correct_indices?: number[];
}

interface GenerateCardsResult {
  cards: GeneratedCard[];
}

export type AICardGenErrorType =
  | "api_key_missing"
  | "api_key_invalid"
  | "quota_exceeded"
  | "rate_limited"
  | "network_error"
  | "timeout"
  | "invalid_response"
  | "database_error"
  | "unknown";

export interface AICardGenError {
  type: AICardGenErrorType;
  message: string;
  suggestion: string;
  retryable: boolean;
}

function classifyError(error: unknown): AICardGenError {
  const errorMessage =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  const originalMessage =
    error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes("api key") ||
    errorMessage.includes("api_key") ||
    errorMessage.includes("未配置")
  ) {
    return {
      type: "api_key_missing",
      message: "AI 服务未配置",
      suggestion: "请前往设置页面配置 AI API Key",
      retryable: false,
    };
  }

  if (
    (errorMessage.includes("invalid") && errorMessage.includes("key")) ||
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("401") ||
    errorMessage.includes("403")
  ) {
    return {
      type: "api_key_invalid",
      message: "API Key 无效",
      suggestion: "请检查您的 API Key 是否正确，或前往设置页面重新配置",
      retryable: false,
    };
  }

  if (
    errorMessage.includes("quota") ||
    errorMessage.includes("exceeded") ||
    errorMessage.includes("limit") ||
    errorMessage.includes("insufficient")
  ) {
    return {
      type: "quota_exceeded",
      message: "API 配额已用尽",
      suggestion: "您的 API 配额已用尽，请检查账户余额或等待配额重置",
      retryable: false,
    };
  }

  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests") ||
    errorMessage.includes("429")
  ) {
    return {
      type: "rate_limited",
      message: "请求过于频繁",
      suggestion: "请稍后再试，或减少单次生成的题目数量",
      retryable: true,
    };
  }

  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("enotfound") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("offline")
  ) {
    return {
      type: "network_error",
      message: "网络连接失败",
      suggestion: "请检查网络连接后重试",
      retryable: true,
    };
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return {
      type: "timeout",
      message: "请求超时",
      suggestion: "服务器响应超时，请稍后重试",
      retryable: true,
    };
  }

  if (
    errorMessage.includes("json") ||
    errorMessage.includes("parse") ||
    errorMessage.includes("invalid response") ||
    errorMessage.includes("format")
  ) {
    return {
      type: "invalid_response",
      message: "AI 响应格式错误",
      suggestion: "AI 返回的数据格式不正确，请重试",
      retryable: true,
    };
  }

  if (
    errorMessage.includes("database") ||
    errorMessage.includes("supabase") ||
    errorMessage.includes("insert") ||
    errorMessage.includes("save") ||
    errorMessage.includes("保存")
  ) {
    return {
      type: "database_error",
      message: "数据库写入失败",
      suggestion: "题目生成成功但保存失败，请检查数据库连接后重试",
      retryable: true,
    };
  }

  return {
    type: "unknown",
    message: `生成失败: ${originalMessage}`,
    suggestion: "请稍后重试，如问题持续请联系技术支持",
    retryable: true,
  };
}

interface Keyword {
  term: string;
  importance: number;
  category: string;
  explanation: string;
}

interface GenerateLearningMaterialResult {
  content: string;
  keywords: Keyword[];
}

const TYPE_PROMPTS: Record<string, string> = {
  qa: "For 'qa' type: Create thought-provoking open-ended questions that test deep understanding.",
  choice:
    "For 'choice' type: Create multiple-choice questions with 4 plausible options. Mark the correct answer index.",
  true_false:
    "For 'true_false' type: Create statements focusing on common misconceptions.",
  multi_choice:
    "For 'multi_choice' type: Create multiple-choice questions where ONE OR MORE options can be correct. Return correct_indices array.",
  fill_in_the_blank:
    "For 'fill_in_the_blank' type: Create a sentence with '___' as blanks.",
};

const DIFFICULTY_PROMPTS: Record<string, string> = {
  easy: `Difficulty Level: EASY
- Focus on basic concept recognition and memory recall
- Questions should directly test knowledge point definitions and basic facts
- Use straightforward language without complex scenarios`,
  medium: `Difficulty Level: MEDIUM
- Focus on understanding and application of concepts
- Questions should require comprehension, not just memorization
- Include simple scenarios or examples to test understanding`,
  hard: `Difficulty Level: HARD
- Focus on analysis, synthesis, and complex problem-solving
- Questions should require deep understanding and connecting multiple concepts
- Include complex scenarios, edge cases, or require multi-step reasoning`,
};

const getLearningMaterialSystemPrompt = (language?: string): string => {
  const isEnglish = language === "en-US" || language === "en";

  if (isEnglish) {
    return `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

Target Audience: University students or professionals learning this concept.

Structure:
1. **Introduction (Hook)**: Briefly explain what this is and why it matters.
2. **Core Concepts (Deep Dive)**: Explain the theoretical foundations. Use analogies.
3. **Key Mechanisms/Details**: Technical details, 'how it works', or step-by-step logic.
4. **Real-world Examples**: Concrete use cases or historical context.
5. **Summary**: Key takeaways.

Formatting:
- Use Markdown headers (##, ###).
- Use bolding for key terms.
- **IMPORTANT**: Wrap ALL mathematical formulas in LaTeX: $inline$ or $$block$$.
- Use lists and bullet points for readability.
- Length: Comprehensive (approx 800-1500 words).

You must respond with a JSON object containing:
1. 'content': The learning material in Markdown format (as a string)
2. 'keywords': An array of 5-15 keywords extracted from the content

Each keyword object must have:
- 'term': The keyword text (string)
- 'importance': Importance level 1-5 (number, where 5 is most important)
- 'category': Category type - one of: 'Definition', 'Concept', 'Method', 'Conclusion', 'Principle', 'Application', 'Terminology' (string)
- 'explanation': Brief explanation of the keyword (string, max 50 chars)

IMPORTANT: All keyword fields (term, category, explanation) must be in English.

Please respond in English.`;
  }

  return `你是一位杰出的教材作者和教育家。请为给定的主题编写一个全面、结构化的学习模块。

目标受众：大学生或正在学习这一概念的专业人士。

结构要求：
1. **引言（吸引点）**：简要解释这是什么以及为什么重要。
2. **核心概念（深入探讨）**：解释理论基础。使用类比。
3. **关键机制/细节**：技术细节、"如何工作"或逐步逻辑。
4. **现实世界示例**：具体用例或历史背景。
5. **总结**：关键要点。

格式要求：
- 使用 Markdown 标题（##, ###）。
- 对关键术语使用粗体。
- **重要**：将所有数学公式用 LaTeX 包裹：$行内$ 或 $$块级$$。
- 使用列表和项目符号提高可读性。
- 长度：全面（约 800-1500 字）。

你必须返回一个 JSON 对象，包含：
1. 'content'：Markdown 格式的学习内容（字符串）
2. 'keywords'：从内容中提取的 5-15 个关键词数组

每个关键词对象必须包含：
- 'term'：关键词文本（字符串）
- 'importance'：重要性级别 1-5（数字，5 最重要）
- 'category'：类别类型 - 以下之一：'定义', '概念', '方法', '结论', '原理', '应用', '术语'（字符串）
- 'explanation'：关键词的简要解释（字符串，最多 50 字符）

IMPORTANT: All keyword fields (term, category, explanation) must be in Chinese.

请用中文回答。`;
};

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
      console.error("[MobileAIService.setConfig] API Key 不能为空");
      throw new Error("API Key 不能为空");
    }
    if (!isValidProvider(config.provider)) {
      console.error(
        "[MobileAIService.setConfig] 无效的 Provider:",
        config.provider,
      );
      throw new Error(`不支持的 AI 服务商: ${config.provider}`);
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

    const typeInstructions = types
      .map((t) => TYPE_PROMPTS[t] || "")
      .filter((p) => p.length > 0)
      .join("\n\n");

    const defaultSystemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.

${typeRestriction}

${DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.medium}

${typeInstructions}

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
          typeInstructions,
          difficultyPrompt:
            DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.medium,
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
        console.warn(
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
      console.error("[MobileAIService.generateCards] 生成题目失败:", error);
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
      fsrs_state: 0,
      fsrs_stability: 0,
      fsrs_difficulty: 0,
      fsrs_elapsed_days: 0,
      fsrs_scheduled_days: 0,
      fsrs_retrievability: 0,
    }));

    const { data, error } = await (client.from("study_cards") as any)
      .insert(cardsToInsert)
      .select();

    if (error) {
      console.error(
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
        console.warn(
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
      console.error(
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
      console.error("[MobileAIService.generateLearningMaterial] AI 服务未配置");
      throw new Error("AI 服务未配置，请先在设置中配置 API Key");
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
      console.error(
        "[MobileAIService.generateLearningMaterial] 生成学习资料失败:",
        error,
      );
      throw new Error(
        `生成学习资料失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
      throw new Error("AI 服务未配置，请先在设置中配置 API Key");
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
      console.error(
        "[MobileAIService.expandKnowledge] 扩展知识节点失败:",
        error,
      );
      throw new Error(
        `扩展知识节点失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  },
};
