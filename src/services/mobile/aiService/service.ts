import { getMobileSupabaseClient } from "@/utils/supabase";
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
import {
  cardDifficultyToFsrsInitial,
  normalizeCardDifficulty,
} from "@shared/types/quiz";

/**
 * 方案C：移动端任务分派（对齐后端 buildTasksToRun 优先级）
 * countMatrix > cardsPerType > countPerDifficulty > types×count
 * 每个任务 = 一个「单题型 + 单难度」的独立 AI 调用（消除混合生成的格式/数量错误）。
 */
function buildMobileTasks(options: {
  types?: string[];
  count?: number;
  countMatrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
  cardsPerType?: Record<string, number>;
  countPerDifficulty?: Record<string, number>;
  difficulty?: "easy" | "medium" | "hard" | "mixed";
}): Array<{ type: string; count: number; difficulty: "easy" | "medium" | "hard" }> {
  const VALID_TYPES = new Set(["qa", "choice", "true_false", "multi_choice", "fill_in_the_blank", "essay"]);
  const DIFFS: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
  const typesRaw = options.types && options.types.length > 0 ? options.types : ["qa", "choice"];
  const types = typesRaw.filter((t) => VALID_TYPES.has(t));
  const baseCount = options.count && options.count > 0 ? options.count : 3;

  // 0) count_matrix：每个非零格子 = 一个独立任务
  if (options.countMatrix && typeof options.countMatrix === "object") {
    const tasks: Array<{ type: string; count: number; difficulty: "easy" | "medium" | "hard" }> = [];
    for (const [type, cell] of Object.entries(options.countMatrix)) {
      if (!VALID_TYPES.has(type) || !cell || typeof cell !== "object") continue;
      for (const d of DIFFS) {
        const v = cell[d];
        if (typeof v === "number" && v > 0) tasks.push({ type, count: v, difficulty: d });
      }
    }
    if (tasks.length > 0) return tasks;
  }

  // 1) cards_per_type
  if (options.cardsPerType && typeof options.cardsPerType === "object") {
    const entries: Array<{ type: string; count: number; difficulty: "easy" | "medium" | "hard" }> = [];
    for (const t of types) {
      const v = options.cardsPerType[t];
      if (typeof v === "number" && v > 0) entries.push({ type: t, count: v, difficulty: "medium" });
    }
    if (entries.length > 0) return entries;
  }

  // 2) count_per_difficulty：每个难度总数按题型均分（最大余数法），不膨胀
  if (options.countPerDifficulty && typeof options.countPerDifficulty === "object") {
    const diffs: Array<{ d: "easy" | "medium" | "hard"; n: number }> = [];
    for (const d of DIFFS) {
      const v = options.countPerDifficulty[d];
      if (typeof v === "number" && v > 0) diffs.push({ d, n: v });
    }
    if (diffs.length > 0) {
      const tasks: Array<{ type: string; count: number; difficulty: "easy" | "medium" | "hard" }> = [];
      for (const { d, n } of diffs) {
        const base = Math.floor(n / types.length);
        const remainder = n - base * types.length;
        types.forEach((t, idx) => {
          const c = base + (idx < remainder ? 1 : 0);
          if (c > 0) tasks.push({ type: t, count: c, difficulty: d });
        });
      }
      if (tasks.length > 0) return tasks;
    }
  }

  // 3) 回退：types × count 均分
  const diff = options.difficulty === "easy" || options.difficulty === "hard" ? options.difficulty : "medium";
  let remaining = baseCount;
  const tasks: Array<{ type: string; count: number; difficulty: "easy" | "medium" | "hard" }> = [];
  for (let i = 0; i < types.length; i++) {
    const c = Math.ceil(remaining / (types.length - i));
    remaining -= c;
    if (c > 0) tasks.push({ type: types[i], count: c, difficulty: diff });
  }
  return tasks;
}

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
      difficulty?: "easy" | "medium" | "hard" | "mixed";
      coverage?: "current_only" | "with_children" | "with_siblings" | "graph";
      customPrompt?: string;
      userId?: string;
      graphId?: string;
      cardsPerType?: Record<string, number>;
      countPerDifficulty?: Record<string, number>;
      /** 题型×难度二维矩阵：优先于上面两个一维投影，输出精确的目标分布 */
      countMatrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
      /** 方案A：该知识点已存在的题题干，注入提示词防重复 */
      existingQuestions?: string[];
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
    const coverage = options.coverage || "current_only";
    const userId = options.userId;
    const graphId = options.graphId;
    const cardsPerType = options.cardsPerType;
    const countPerDifficulty = options.countPerDifficulty;
    const countMatrix = options.countMatrix;

    const typeRestriction =
      types.length === 1
        ? `CRITICAL: ONLY generate cards of type '${types[0]}'. DO NOT generate any other types.`
        : `Allowed card types: ${types.join(", ")}. Only generate these types.`;

    // 矩阵分布信息：优先输出完整二维矩阵（精确），否则退化到一维投影
    let matrixInfo = "";
    if (countMatrix && Object.keys(countMatrix).length > 0) {
      // 只保留非零格，给模型一个干净的分布表
      const clean: Record<string, { easy?: number; medium?: number; hard?: number }> = {};
      for (const [t, d] of Object.entries(countMatrix)) {
        const cell: { easy?: number; medium?: number; hard?: number } = {};
        if ((d.easy ?? 0) > 0) cell.easy = d.easy;
        if ((d.medium ?? 0) > 0) cell.medium = d.medium;
        if ((d.hard ?? 0) > 0) cell.hard = d.hard;
        if (Object.keys(cell).length > 0) clean[t] = cell;
      }
      if (Object.keys(clean).length > 0) {
        matrixInfo += `Exact type×difficulty target (authoritative, generate EXACTLY these counts):\n${JSON.stringify(clean)}\n`;
      }
    }
    if (!matrixInfo && cardsPerType && Object.keys(cardsPerType).length > 0) {
      matrixInfo += `Per-type count target: ${JSON.stringify(cardsPerType)}\n`;
    }
    if (!matrixInfo && countPerDifficulty && Object.keys(countPerDifficulty).length > 0) {
      matrixInfo += `Per-difficulty count target: ${JSON.stringify(countPerDifficulty)}\n`;
    }

    const defaultSystemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.

Difficulty: ${difficulty}
Coverage: ${coverage}
${matrixInfo}
${typeRestriction}

Output format (JSON):
{
  "cards": [
    {
      "type": "qa|choice|true_false|multi_choice|fill_in_the_blank|essay",
      "question": "The question text",
      "answer": "The answer text",
      "explanation": "Optional explanation",
      "difficulty": "easy|medium|hard",
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
- For 'fill_in_the_blank' type: use '___' for blanks in question
- For 'essay' type: question is the prompt, answer is the reference rubric`;

    let systemPrompt = defaultSystemPrompt;

    if (options.customPrompt && options.customPrompt.trim()) {
      systemPrompt = options.customPrompt
        .replaceAll("{{types}}", types.join(", "))
        .replaceAll("{{count}}", String(count))
        .replaceAll("{{difficulty}}", difficulty)
        .replaceAll("{{coverage}}", coverage)
        .replaceAll("{{topic}}", topic)
        .replaceAll("{{content}}", content || "No detailed content provided.")
        .replaceAll("{{matrix}}", matrixInfo.trim());
    } else if (supabase && userId && graphId) {
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
          coverage,
          typeRestriction,
          matrix: matrixInfo.trim(),
          customPrompt: "",
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

    // 方案A：库内已有题题干 → 注入 anti-duplicate 约束，降低与已有题重复概率
    const existingQuestions = (options.existingQuestions || []).filter(
      (q) => typeof q === "string" && q.trim().length > 0,
    );
    if (existingQuestions.length > 0) {
      const listText = existingQuestions
        .map((q) => `- ${q.replace(/\s+/g, " ").trim()}`)
        .join("\n");
      systemPrompt += `\n\nCRITICAL ANTI-DUPLICATION: The following questions already exist for this topic. DO NOT generate a card that is the same or nearly the same question. Avoid restating the same fact or concept in the same wording.\n${listText}`;
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

    const cardsToInsert = cards.map((card) => {
      // 方案B：入库前用 AI 自评难度做 sanity check，非法/缺失回退 medium
      const diff = normalizeCardDifficulty(card.difficulty);
      return {
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
        difficulty:
          diff === "easy" ? 1 : diff === "hard" ? 3 : 2,
        // 方案B：FSRS 初始难度种子（易=3 / 中=5 / 难=7），复习时由 FSRS 自适应更新
        fsrs_state: "New",
        fsrs_stability: 0,
        fsrs_difficulty: cardDifficultyToFsrsInitial(diff),
        fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0,
        fsrs_retrievability: 0,
      };
    });

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
      difficulty?: "easy" | "medium" | "hard" | "mixed";
      coverage?: "current_only" | "with_children" | "with_siblings" | "graph";
      customPrompt?: string;
      /** 题型 -> 数量，移动端按这组数值分派任务并传进提示词 */
      cardsPerType?: Record<string, number>;
      /** 难度 -> 数量，移动端作为 prompt 上下文与分派依据 */
      countPerDifficulty?: Record<string, number>;
      /** 题型×难度二维矩阵：优先于上面两个一维投影（透传给 generateCards） */
      countMatrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
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

    // 方案A：库内该知识点已有题题干 → 传给每个生成单元做 anti-duplicate 约束
    let existingQuestions: string[] = [];
    if (supabase) {
      try {
        const { data: existingRows, error: qError } = await supabase
          .from("study_cards")
          .select("question")
          .eq("knowledge_point_id", knowledgePointId)
          .limit(30);
        if (!qError) {
          existingQuestions = (existingRows || [])
            .map((r) => (r as { question?: string }).question)
            .filter((q): q is string => typeof q === "string" && q.trim().length > 0);
        }
      } catch (error) {
        logger.warn(
          "[MobileAIService.generateAndSaveCards] 查询已有题目失败:",
          error,
        );
      }
    }

    // 方案C：按题型×难度拆分为多个独立 AI 调用（消除混合生成的格式/数量错误），
    // 客户端并发 2 执行，每个任务使用「单题型 + 单难度」
    const tasks = buildMobileTasks(options);
    const CONCURRENCY = 2;
    const allCards: GeneratedCard[] = [];
    const errors: string[] = [];

    const runTask = async (t: { type: string; count: number; difficulty: "easy" | "medium" | "hard" }) => {
      try {
        const r = await mobileAIService.generateCards(topic, content, {
          types: [t.type],
          count: t.count,
          difficulty: t.difficulty,
          coverage: options.coverage,
          customPrompt: options.customPrompt,
          userId,
          graphId,
          existingQuestions,
        });
        if (r.cards && r.cards.length > 0) allCards.push(...r.cards);
      } catch (e) {
        logger.warn(`[MobileAIService.generateAndSaveCards] 生成 ${t.type}[${t.difficulty}] 失败:`, e);
        errors.push(`${t.type}[${t.difficulty}]`);
      }
    };

    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const chunk = tasks.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(runTask));
    }

    if (allCards.length === 0) {
      const generateError: AICardGenError = {
        type: "invalid_response",
        message: "AI 未能生成任何题目",
        suggestion: `已尝试 ${tasks.length} 个生成单元。请检查内容与配置后重试。`,
        retryable: true,
      };
      throw generateError;
    }

    try {
      const saveResult = await mobileAIService.saveCardsToStudyCards(
        allCards,
        knowledgePointId,
        graphId,
      );

      return {
        success: saveResult.success,
        cards: allCards,
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
        suggestion: `题目已生成 ${allCards.length} 道，但保存失败。请检查网络后重试。`,
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

    const supabase = getMobileSupabaseClient();
    let systemPrompt = getLearningMaterialSystemPrompt(options.language);

    if (supabase) {
      try {
        const renderedPrompt = await mobilePromptService.getRenderedPrompt(
          supabase,
          "learning_material",
          {
            topic,
            context: context || "General knowledge",
            level: options.level,
          },
          undefined,
          undefined,
          options.language,
        );

        if (renderedPrompt && renderedPrompt.trim()) {
          systemPrompt = renderedPrompt;
        }
      } catch (error) {
        logger.warn(
          "[MobileAIService.generateLearningMaterial] 获取 Prompt 模板失败，使用默认模板:",
          error,
        );
      }
    }

    const messages = [
      { role: "system" as const, content: systemPrompt },
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
    const isRootOrCore = contextLevel === "root" || contextLevel === "core";
    const isLeaf = contextLevel === "leaf";
    const isCustom = !!options.expandPrompt;

    const defaultSystemPrompt = `You are an expert knowledge architect. Your task is to suggest child nodes for a given knowledge node.

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

    const supabase = getMobileSupabaseClient();
    let systemPrompt = defaultSystemPrompt;

    if (supabase) {
      try {
        const renderedPrompt = await mobilePromptService.getRenderedPrompt(
          supabase,
          "expand_knowledge",
          {
            isRootOrCore,
            isLeaf,
            isCustom,
            customPrompt: options.expandPrompt,
          },
        );

        if (renderedPrompt && renderedPrompt.trim()) {
          systemPrompt = renderedPrompt;
        }
      } catch (error) {
        logger.warn(
          "[MobileAIService.expandKnowledge] 获取 Prompt 模板失败，使用默认模板:",
          error,
        );
      }
    }

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
