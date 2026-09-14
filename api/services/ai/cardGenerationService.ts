import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse, normalizeGeneratedCardAnswers } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import { getMockCards } from "./mock";
import { embeddingOps } from "./embeddingOps";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import {
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";
import type { GraphDisambiguationContext } from "../graph/graphDisambiguationContext";
import {
  TYPE_PROMPTS,
  DIFFICULTY_PROMPTS,
  DIFFICULTY_SELF_ASSESSMENT_INSTRUCTION,
  buildTypeRestriction,
  FOCUS_TOPIC_INSTRUCTION,
  GROUNDING_INSTRUCTION,
} from "@shared/template/injections";
import { formatGraphContextBlock } from "@shared/template/formatGraphContextBlock";

export type CardDifficulty = "easy" | "medium" | "hard" | "mixed";

type CardGenProvider = Awaited<ReturnType<typeof getAIProviderForTask>>;
type CardGenClient = CardGenProvider["client"];

// 方案D1：生成后向量去重阈值（余弦相似度，>= 视为重复/近似重复）
const DEDUP_THRESHOLD = 0.92;

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface GeneratedCard {
  type: string;
  focus_topic?: unknown;
  [key: string]: unknown;
}

export type GenerateCardsCoverage = 'current_only' | 'with_children' | 'with_siblings' | 'graph';

export interface GenerateCardsOptions {
  type?: string;
  types?: string[];
  count?: number;
  context?: string;
  provider?: AIProviderType;
  model?: string;
  userId?: string;
  graphId?: string;
  pack_type?: string;
  difficulty?: CardDifficulty;
  language?: string;
  customPrompt?: string;
  coverage?: GenerateCardsCoverage;
  /**
   * 方案A：库内该知识点已存在的题目题干，注入 prompt 作为 anti-duplicate 约束，
   * 降低与已有题重复的概率。
   */
  existingQuestions?: string[];
  /** 方案F：兄弟节点（同父）内容，仅用于选择题干扰项生成 */
  siblingNodes?: { knowledgePointId: string; title: string; content: string | null }[];
  /** 子节点内容，用于 with_children / graph 时作为背景知识注入 */
  childrenNodes?: { knowledgePointId: string; title: string; content: string | null }[];
  /** 方案F：兄弟节点经 AI 相关性筛选后最多注入的干扰项数量（默认 3） */
  maxSiblingDistractors?: number;
  /**
   * 方案G：消歧上下文（图谱元数据 + 祖先链 + 直接子节点）。
   * 解决同一知识点名称在不同知识图谱中含义不同的问题，代码级追加，不依赖模板内容。
   */
  disambiguation?: GraphDisambiguationContext;
}

class CardGenerationService {
  async generateCards(
    topic: string,
    content: string,
    options: GenerateCardsOptions = {},
  ) {
    const types = options.type
      ? [options.type]
      : options.types || ["qa", "choice"];
    const count = options.count || 3;
    const context = options.context;

    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return { cards: getMockCards(topic, types, count) };
    }

    const requestKey = generateRequestKey("generateCards", {
      topic: topic.slice(0, 100),
      types: types.sort(),
      count,
      difficulty: options.difficulty || "medium",
      model: options.model || provider.model,
    });

    // 各题型兜底一句话描述（DB per-type 模板缺失时使用；统一注册于 shared/template/injections）
    const typePrompts = TYPE_PROMPTS;

    // 难度 rubric（统一注册于 shared/template/injections）
    const difficultyPrompts = DIFFICULTY_PROMPTS;
    // 每卡自评难度指令（统一注册于 shared/template/injections）
    const difficultySelfAssessmentInstruction =
      DIFFICULTY_SELF_ASSESSMENT_INSTRUCTION;

    const difficulty = options.difficulty || "medium";
    const customPrompt = options.customPrompt ? options.customPrompt.trim() : "";

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withAIMonitoring(
          {
            operation: "generateCards",
            provider: provider.providerType,
            model,
            metadata: {
              graphId: options.graphId,
              userId: options.userId,
            },
          },
          async () => {
            // 若传入自定义提示词，优先使用（允许占位符替换）
            const renderContext: Record<string, unknown> = {
              types: types.join(", "),
              allowedTypes: types.join(", "),
              count,
              difficulty,
              context: context ? `Parent/Context Info: ${context}` : "",
              topic,
              content: content || "No detailed content provided.",
            };
            const typeRestriction = buildTypeRestriction(types);

            let systemPrompt = "";

            if (customPrompt.length > 0) {
              // 用户自定义提示词：渲染占位符，追加类型约束、难度指令、JSON schema 与语言提示
              let base = customPrompt;
              for (const [k, v] of Object.entries(renderContext)) {
                base = base.split(`{{${k}}}`).join(String(v ?? ""));
              }
              const difficultyInstruction =
                difficultyPrompts[difficulty] || difficultyPrompts.medium;
              systemPrompt = `${base}

${typeRestriction}

${difficultyInstruction}

${difficultySelfAssessmentInstruction}

Please respond with a valid JSON object.`;
            } else {
              const typeToPromptCode: Record<string, string> = {
                qa: "generate_cards_qa",
                choice: "generate_cards_choice",
                true_false: "generate_cards_true_false",
                multi_choice: "generate_cards_multi_choice",
                fill_in_the_blank: "generate_cards_fill_blank",
                essay: "generate_cards_essay",
                cloze: "generate_cards_cloze",
                select_from_options: "generate_cards_select_from_options",
                matching: "generate_cards_matching",
                ordering: "generate_cards_ordering",
              };
              const promptParts = await Promise.all(
                types.map(async (type) => {
                  const code = typeToPromptCode[type] ?? `generate_cards_${type}`;
                  const rendered = await promptService.getRenderedPrompt(
                    getSupabaseAdmin(),
                    code,
                    { count: Math.ceil(count / types.length), difficulty },
                    options.userId,
                    options.graphId,
                    options.language,
                  );

                  if (rendered && rendered.trim().length > 0) {
                    return rendered;
                  }

                  return typePrompts[type] || "";
                }),
              );

              systemPrompt = promptParts
                .filter((p) => p.length > 0)
                .join("\n\n---\n\n");

              const difficultyInstruction =
                difficultyPrompts[difficulty] || difficultyPrompts.medium;

              if (!systemPrompt.trim()) {
                systemPrompt = await promptService.getRenderedPrompt(
                  getSupabaseAdmin(),
                  "generate_cards",
                  {
                    count,
                    allowedTypes: types.join(", "),
                    context: context ? `Parent/Context Info: ${context}` : "",
                    difficulty,
                  },
                  options.userId,
                  options.graphId,
                  options.language,
                );
                if (systemPrompt && systemPrompt.trim().length > 0) {
                  systemPrompt = `${systemPrompt.trim()}

${difficultySelfAssessmentInstruction}

Please respond with a valid JSON object.`;
                }
              } else {
                systemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.

${typeRestriction}

${difficultyInstruction}

${difficultySelfAssessmentInstruction}

Context: ${context || "None"}\n\n${systemPrompt}

Please respond with a valid JSON object.`;
              }
            }

            // 方案A：anti-duplicate —— 库内已有题题干作为约束（统一注入点，三个分支共用）
            const existingQuestions = (options.existingQuestions || []).filter(
              (q) => typeof q === "string" && q.trim().length > 0,
            );
            if (existingQuestions.length > 0) {
              const listText = existingQuestions
                .map((q) => `- ${q.replace(/\s+/g, " ").trim()}`)
                .join("\n");
              systemPrompt += `\n\nCRITICAL ANTI-DUPLICATION: The following questions already exist in the user's vault for this topic. DO NOT generate a card that is the same or nearly the same question. Avoid restating the same fact, misconception, or concept in the same wording.\n${listText}`;
            }

            // 子节点作为背景知识注入 prompt
            const childrenContext =
              (options.coverage === 'with_children' || options.coverage === 'graph') &&
              options.childrenNodes && options.childrenNodes.length > 0
                ? options.childrenNodes
                    .filter((c) => c.title && c.title.trim().length > 0)
                    .map((c, i) => `## 子节点 ${i + 1}：${c.title}\n${c.content ? c.content.slice(0, 200) : '（无正文）'}`)
                    .join('\n\n')
                : '';
            if (childrenContext) {
              systemPrompt += `
## CHILDREN OUTLINE（当前知识节点的直接子节点 · 仅作为背景知识）
以下为当前节点的直接子节点概念摘要，仅供扩展题目背景、关联解释、例证对比时参考。
⚠️ 约束：
1. 正确答案必须仍以当前节点内容为准，不能被子节点概念替换。
2. 可以在题目题干/解释/例证中引用子节点，但不得将题目主题偷换为子节点。

${childrenContext}
`;
            }

            // 方案F：兄弟节点作为选择题干扰项来源注入 prompt
            const siblingNodes = (options.siblingNodes || []).filter(
              (n) => n && n.title,
            );
            const usesChoice =
              types.includes("choice") || types.includes("multi_choice");
            const maxSiblingDistractors = options.maxSiblingDistractors ?? 3;
            let relevantSiblings: typeof siblingNodes = [];
            if ((options.coverage === 'with_siblings' || options.coverage === 'graph') && usesChoice && siblingNodes.length > 0) {
              relevantSiblings = await this.filterRelevantSiblings(
                provider.client,
                model,
                topic,
                content,
                siblingNodes,
                maxSiblingDistractors,
              );
              systemPrompt += `\n\nDISCRIMINATOR OPTIONS (choice/multi_choice ONLY): The following are SIBLING nodes (distractor candidates) of the current topic — they are related concepts that can look plausible but are NOT the focus of this question set.
Use each sibling's "title" to craft 1 distract(e) option for choice/multi_choice questions. Distractor options MUST:
- Be reworded so they look plausible and correct to a careful reader (not obviously wrong).
- Represent the sibling concept, NOT the current topic's correct answer.
- NEVER mark the current topic's content itself as the sibling; the single correct option(s) must uniquely reflect the current topic.
- For choice: exactly one option is correct (the current topic). For multi_choice: correct options are the current topic aspects; sibling options are wrong.
Sibling reference candidates:
${relevantSiblings.map((n) => `- ${n.title}${n.content ? `: ${n.content}` : ""}`).join("\n")}`;
            }

            // FOCUS TOPIC INSTRUCTION：每卡必须返回 focus_topic 字段（shared/template/injections）
            systemPrompt += `\n\n${FOCUS_TOPIC_INSTRUCTION}`;

            // 方案E：grounding —— 每题必须携带「原文依据」evidence（shared/template/injections）
            systemPrompt += `\n\n${GROUNDING_INSTRUCTION}`;

            // 方案G：代码级追加「消歧上下文」——不依赖模板内容（用户自定义模板同样生效），
            // 解决同一知识点名称在不同知识图谱中含义不同的歧义问题。
            const disambiguationBlock = this.buildGraphContextBlock(options.disambiguation);
            if (disambiguationBlock) {
              systemPrompt += `\n\n${disambiguationBlock}`;
            }

            // 方案D：重试次数引用（onRetry 递增，驱动温度退火）
            const attemptRef = { current: 0 };
            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: `Topic: ${topic}\nContent: ${
                        content || "No detailed content provided."
                      }`,
                    },
                  ],
                  model,
                  // 方案D：失败重试温度退火，打破低方差重复失败
                  temperature: 0.4 + attemptRef.current * 0.25,
                  response_format: { type: "json_object" },
                }),
              {
                timeout: LONG_TIMEOUT,
                maxRetries: 3,
                onRetry: (attempt, error) => {
                  attemptRef.current = attempt;
                  logger.warn(
                    `Generate Cards retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const result = completion.choices[0].message.content || "";
            const trimmed = result.trim();

            // 方案D2：JSON 自愈 —— 首次解析失败（常见于 max_tokens 截断）时，带残片回改一次，
            // 而不是直接整批失败返回 422。
            let parsed: { cards?: unknown[] };
            let parseSource = "Generate Cards";
            try {
              parsed = parseAIResponse<{ cards: unknown[] }>(
                result,
                parseSource,
              );
            } catch (firstErr) {
              const repaired = await this.tryRepairRawJson(
                provider.client,
                model,
                topic,
                content,
                trimmed,
              );
              if (!repaired) {
                throw firstErr;
              }
              parsed = repaired;
              parseSource += " (repaired)";
            }

            let cards = (parsed.cards || []) as GeneratedCard[];
            const originalCount = cards.length;

            if (originalCount > 0) {
              // 预构建 Set，避免 filter 内层对 types 数组 includes 线性扫描（O(cards×types)→O(cards)）
              const typeSet = new Set(types);
              cards = cards.filter((card) => {
                const cardType = card.type;
                return typeSet.has(cardType);
              });

              const filteredCount = cards.length;
              if (filteredCount !== originalCount) {
                logger.warn(
                  `[Generate Cards] Filtered cards: requested types [${types.join(", ")}], ` +
                    `got ${originalCount}, kept ${filteredCount}`,
                );
              }
            }

            // 方案D1：生成后向量相似度去重 —— 与库内已有题及同批题目做余弦去重，
            // 复用现有 embedding 基建；embedding 不可用或失败时静默跳过不拦截生成。
            cards = await this.dedupeGeneratedCardsBySimilarity(cards, existingQuestions);

            cards = normalizeGeneratedCardAnswers(cards);

            return { result: { cards }, usage: completion.usage };
          },
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI card generation failed",
      });
    }
  }

  /**
   * 组装「消歧上下文」prompt 块：图谱元数据 + 祖先链 + 直接子节点。
   * 任一字段存在时返回非空块；全部缺失返回空串（零输出、无回归）。
   */
  private buildGraphContextBlock(
    disambiguation?: GraphDisambiguationContext,
  ): string {
    return formatGraphContextBlock(disambiguation ?? {});
  }

  /**
   * 方案D2：JSON 自愈 —— 把截断/损坏的 JSON 交给 AI 补齐修复，返回完整对象。
   * 修复本身失败时返回 null，调用方回退到原始解析错误。
   */
  private async tryRepairRawJson(
    client: CardGenClient,
    model: string,
    topic: string,
    content: string,
    broken: string,
  ): Promise<{ cards?: unknown[] } | null> {
    if (!broken) return null;
    try {
      const repair = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              'You repair truncated or slightly malformed JSON. Return ONLY the complete, valid JSON object with a "cards" array. Do NOT add explanations, markdown fences, or any text outside the JSON.',
          },
          {
            role: "user",
            content: `Topic: ${topic}\nContent: ${content || "No detailed content provided."}\n\nBroken or incomplete JSON to fix (may be cut off at the end):\n${broken}`,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      });
      const repaired = repair.choices[0]?.message?.content || "";
      if (!repaired.trim()) return null;
      return parseAIResponse<{ cards?: unknown[] }>(
        repaired,
        "Generate Cards repair",
      );
    } catch (error) {
      logger.warn("[Generate Cards] JSON self-heal failed:", error);
      return null;
    }
  }

  /**
   * 方案F：AI 相关性筛选 —— 候选兄弟节点过多时，挑选与当前主题语义最相近、
   * 最容易混淆、最值得辨析的若干节点作为选择题干扰项，降低 prompt 体积、提升干扰项质量。
   * 兄弟数量不超过 maxCount 时直接返回（不调用 AI，省 token）；
   * 任何异常（含超时、无 key、解析/匹配失败）都回退前 maxCount 个兄弟，绝不中断生成。
   */
  private async filterRelevantSiblings(
    client: CardGenClient,
    model: string,
    topic: string,
    content: string,
    siblings: Array<{
      knowledgePointId: string;
      title: string;
      content: string | null;
    }>,
    maxCount: number,
  ): Promise<Array<{ knowledgePointId: string; title: string; content: string | null }>> {
    if (siblings.length <= maxCount) {
      return siblings;
    }

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You select sibling distractor candidates for a knowledge topic. From the candidate sibling nodes below, pick at most ${maxCount} whose semantics are closest to the current topic, most easily confused with it, and most worth distinguishing in a multiple-choice question. Return ONLY a JSON object: {"selected": ["title 1", "title 2"]}. Every element in "selected" MUST exactly match the candidate sibling "title" field verbatim (character-for-character); never invent or reword titles.`,
          },
          {
            role: "user",
            content: `Topic: ${topic}\nContent: ${content || "No detailed content provided."}\n\nCandidate sibling nodes (titles):\n${siblings
              .map((n) => `- ${n.title}`)
              .join("\n")}`,
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content || "";
      const parsed = parseAIResponse<{ selected?: unknown }>(
        raw,
        "Generate Cards sibling filter",
      );
      const selectedTitles = Array.isArray(parsed.selected)
        ? parsed.selected
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim())
        : [];

      const titleSet = new Set(selectedTitles);
      const picked: Array<{
        knowledgePointId: string;
        title: string;
        content: string | null;
      }> = [];
      const pickedIds = new Set<string>();

      // 按兄弟原顺序映射回节点，去重，最多取 maxCount 个
      for (const sib of siblings) {
        if (picked.length >= maxCount) break;
        if (pickedIds.has(sib.knowledgePointId)) continue;
        if (titleSet.has(sib.title)) {
          picked.push(sib);
          pickedIds.add(sib.knowledgePointId);
        }
      }

      // 不足 maxCount 时，从未选中的兄弟中按原顺序补足
      for (const sib of siblings) {
        if (picked.length >= maxCount) break;
        if (pickedIds.has(sib.knowledgePointId)) continue;
        picked.push(sib);
        pickedIds.add(sib.knowledgePointId);
      }

      if (picked.length > 0) {
        return picked;
      }
      return siblings.slice(0, maxCount);
    } catch (error) {
      logger.warn(
        "[Generate Cards] 兄弟节点相关性筛选失败，回退前 N 个兄弟:",
        error,
      );
      return siblings.slice(0, maxCount);
    }
  }

  /**
   * 方案D1：生成后向量相似度去重。
   * 与库内已有题（existingQuestions）+ 同批已接受的题做余弦对比，超过阈值则剔除。
   * embedding 无 key / 失败时静默跳过（null 向量一律保留，不做删减）。
   */
  private async dedupeGeneratedCardsBySimilarity(
    cards: GeneratedCard[],
    existingQuestions: string[],
  ): Promise<GeneratedCard[]> {
    if (cards.length <= 1) return cards;

    const refQueries = existingQuestions
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => q.trim());
    if (refQueries.length === 0) return cards;

    const candidateQueries = cards.map((c) => String(c.question ?? "").trim());
    const texts = [...refQueries, ...candidateQueries];

    let vectors: (number[] | null)[];
    try {
      vectors = await embeddingOps.generateEmbeddingsBatch(texts);
    } catch (error) {
      logger.warn("[Generate Cards] 向量去重失败，跳过:", error);
      return cards;
    }

    // embedding 不可用（如未配置 key）时，全部返回 null → 不删减
    if (vectors.some((v) => v === null)) return cards;

    const refVecs = refQueries.map((_, i) => vectors[i]).filter(
      (v): v is number[] => Array.isArray(v),
    );

    const running = refVecs.slice();
    const accepted: GeneratedCard[] = [];
    for (let idx = 0; idx < cards.length; idx++) {
      const vec = vectors[refQueries.length + idx];
      if (!vec) {
        accepted.push(cards[idx]);
        continue;
      }
      const isDuplicate = running.some(
        (rv) => cosineSimilarity(vec, rv) >= DEDUP_THRESHOLD,
      );
      if (!isDuplicate) {
        accepted.push(cards[idx]);
        running.push(vec);
      }
    }

    if (accepted.length !== cards.length) {
      logger.warn(
        `[Generate Cards] 向量去重：保留 ${accepted.length}/${cards.length} 道`,
      );
    }
    return accepted.length > 0 ? accepted : cards;
  }
}

export const cardGenerationService = new CardGenerationService();
