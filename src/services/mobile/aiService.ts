import { useStore } from "../../store/useStore";
import { createMobileAIClient, MobileAIClient } from "./aiClient";
import type { AIProviderType } from "@shared/types";
import type { StudyCard } from "@shared/types/common";

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
};

function getStoredAIConfig(): MobileAIUserConfig | null {
  try {
    const stored = localStorage.getItem(MOBILE_AI_CONFIG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load mobile AI config:", e);
  }
  return null;
}

function storeAIConfig(config: MobileAIUserConfig): void {
  try {
    localStorage.setItem(MOBILE_AI_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to store mobile AI config:", e);
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

  if (storedConfig && storedConfig.apiKey) {
    const provider = (aiConfig?.provider ||
      storedConfig.provider) as AIProviderType;
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
  if (!config || !config.apiKey) {
    return null;
  }
  return createMobileAIClient(config);
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

export const mobileAIService = {
  isConfigured: (): boolean => {
    const config = getAIConfigFromUserSettings();
    return !!(config && config.apiKey);
  },

  getConfig: (): MobileAIUserConfig | null => {
    return getAIConfigFromUserSettings();
  },

  setConfig: (config: MobileAIUserConfig): void => {
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
    } = {},
  ): Promise<GenerateCardsResult> => {
    const client = createAIClient();
    if (!client) {
      throw new Error("AI 服务未配置，请检查环境变量或手动配置 API Key");
    }

    const types = options.types || ["qa", "choice"];
    const count = options.count || 3;
    const difficulty = options.difficulty || "medium";

    const typeRestriction =
      types.length === 1
        ? `CRITICAL: ONLY generate cards of type '${types[0]}'. DO NOT generate any other types.`
        : `Allowed card types: ${types.join(", ")}. Only generate these types.`;

    const typeInstructions = types
      .map((t) => TYPE_PROMPTS[t] || "")
      .filter((p) => p.length > 0)
      .join("\n\n");

    const systemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.

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
      console.error("Generate cards error:", error);
      throw new Error(
        `生成题目失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  },

  saveCardsToStudyCards: async (
    cards: GeneratedCard[],
    knowledgePointId: string,
    graphId: string,
  ): Promise<{ success: boolean; count: number }> => {
    const { getMobileSupabaseClient } = await import("./client");
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
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
      throw new Error(`保存题目失败: ${error.message}`);
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
    const result = await mobileAIService.generateCards(topic, content, options);

    if (result.cards.length === 0) {
      return { success: false, cards: [], savedCount: 0 };
    }

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
  },

  generateLearningMaterial: async (
    topic: string,
    context: string,
    options: {
      level?: string;
    } = {},
  ): Promise<GenerateLearningMaterialResult> => {
    const client = createAIClient();
    if (!client) {
      throw new Error("AI 服务未配置，请检查环境变量或手动配置 API Key");
    }

    const systemPrompt = `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

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

Topic: ${topic}
Context/Background: ${context || "General knowledge"}
${options.level ? `Knowledge Level: ${options.level}` : ""}

You must respond with a JSON object containing:
1. 'content': The learning material in Markdown format (as a string)
2. 'keywords': An array of 5-15 keywords extracted from the content

Each keyword object must have:
- 'term': The keyword text (string)
- 'importance': Importance level 1-5 (number, where 5 is most important)
- 'category': Category type - one of: '定义', '概念', '方法', '结论', '原理', '应用', '术语' (string)
- 'explanation': Brief explanation of the keyword (string, max 50 chars)

Please respond in Chinese.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content:
          "Please generate the learning material based on the instructions above.",
      },
    ];

    try {
      const result =
        await client.chatWithJson<GenerateLearningMaterialResult>(messages);

      return {
        content: result.content || "",
        keywords: Array.isArray(result.keywords)
          ? result.keywords.map((k) => ({
              term: k.term || "",
              importance: Math.min(5, Math.max(1, k.importance || 3)),
              category: k.category || "概念",
              explanation: k.explanation || "",
            }))
          : [],
      };
    } catch (error) {
      console.error("Generate learning material error:", error);
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
      throw new Error("AI 服务未配置，请检查环境变量或手动配置 API Key");
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
      console.error("Expand knowledge error:", error);
      throw new Error(
        `扩展知识节点失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  },
};
