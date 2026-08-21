import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
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

    const typePrompts: Record<string, string> = {
      qa: "For 'qa' type: Create thought-provoking open-ended questions that test deep understanding.",
      choice:
        "For 'choice' type: Create multiple-choice questions with 4 plausible options.",
      true_false:
        "For 'true_false' type: Create statements focusing on common misconceptions.",
      multi_choice:
        "For 'multi_choice' type: Create multiple-choice questions where ONE OR MORE options can be correct.",
      fill_in_the_blank:
        "For 'fill_in_the_blank' type: Create a sentence with '___' as blanks. Return valid JSON.",
      essay:
        "For 'essay' type: Create complex questions requiring a long-form structured answer.",
      cloze:
        "For 'cloze' type: Create a sentence with one or more '___' blanks. The 'answer' MUST be a JSON array like [{\"blank\":\"correct word\"},...], one entry per blank in order. Return valid JSON.",
      select_from_options:
        "For 'select_from_options' type: Create a sentence with exactly one '___' blank and 4 candidate words in 'options'. The 'answer' MUST be the correct word string. Return valid JSON.",
      matching:
        "For 'matching' type: Create a two-column matching question. Put left items in 'options'. The 'answer' MUST be a JSON array like [{\"left\":\"A\",\"right\":\"matching definition\"},...] pairing every left item to its correct right item. Return valid JSON.",
      ordering:
        "For 'ordering' type: Create a sequence question. Put shuffled items in 'options'. The 'answer' MUST be a JSON array of items in correct order. Return valid JSON.",
    };

    const difficultyPrompts: Record<string, string> = {
      easy: `Difficulty Level: EASY (Bloom Level 1-2: Remembering / Understanding)
Use the source material as the only required knowledge — do NOT import outside facts.
Anchor criteria (a question is EASY if ANY apply):
- Remembering: asks to recall a definition, name, term, list, or a directly-stated fact verbatim from the material.
- Understanding: asks to identify the correct meaning, paraphrase a concept, or pick the statement that correctly restates a sentence in the material.
Question design:
- Draw the answer almost verbatim from a single sentence in the source.
- Use short, plain language; avoid scenario setups longer than one sentence.
- For choice: distractors must be clearly wrong (wrong term, wrong definition, mis-ordered facts), so the correct answer stands out to a careful recall.
- For QA/fill-blank: answers should be a term or one short sentence taken directly from the text.
Do NOT reuse the same sentence for every question in a batch.`,
      medium: `Difficulty Level: MEDIUM (Bloom Level 3-4: Applying / Analyzing)
Use the source material as the context; answers may require combining 2-3 facts from different parts of the material.
Anchor criteria (a question is MEDIUM if ANY apply):
- Applying: needs using a concept or formula in a slightly novel but concrete example provided in the material.
- Analyzing: asks to explain cause→effect, compare/contrast two ideas, order steps, or identify why a statement about the material is true/false.
Question design:
- Combine information from at least 2 related sentences/sections.
- Introduce a short concrete scenario (1-3 sentences) that is NOT a verbatim restatement.
- For choice: distractors should be plausible but break one concept; correct answer requires real understanding to pick.
- For QA/fill-blank: answers need 1-2 sentences that synthesize across parts of the material.`,
      hard: `Difficulty Level: HARD (Bloom Level 5-6: Evaluating / Creating)
Use the source material as the base, but demand higher-order reasoning and multi-step connections.
Anchor criteria (a question is HARD if ANY apply):
- Evaluating: asks to judge/critique a claim, weigh trade-offs, or assess which approach is correct given constraints in the material.
- Creating: asks to design, propose, hypothesize, or apply the material to a novel/unseen case or edge case.
Question design:
- Require connecting 3+ ideas across the material, or reasoning about an edge case / boundary condition.
- Present a realistic complex scenario with implicit distractors (all options plausible at first glance).
- For choice: all options should look correct; only careful multi-step analysis distinguishes the best answer.
- For QA/essay: require a structured, multi-part answer (define, reason, example) demonstrating synthesis.`,
      mixed: `Difficulty Level: MIXED (Bloom Level 1-6, spanning a full cognitive range)
Generate questions whose difficulty varies across easy / medium / hard.
- Roughly distribute: easy (remember/understand) ~1/3, medium (apply/analyze) ~1/3, hard (evaluate/create) ~1/3, unless a count target is given.
- Do not label them all the same difficulty; intentionally span the taxonomy.
- Anchor each card's difficulty using the rubrics above and ONLY assign the difficulty you actually hit.`,
    };

    // 方案B：要求 AI 对每一题自评难度（sanity check 依据）。对所有非 custom prompt 分支统一追加。
    const difficultySelfAssessmentInstruction = `For EVERY card you generate, YOU MUST include a "difficulty" field with one of "easy" | "medium" | "hard", self-assessed against this anchored rubric:
- easy  = Bloom Remembering/Understanding (verbatim recall or direct restatement from the material)
- medium = Bloom Applying/Analyzing (combines 2-3 facts, short concrete scenario)
- hard  = Bloom Evaluating/Creating (multi-step connection, edge case, or novel application)
Assign the difficulty that the card's question ACTUALLY requires to answer — do not force all cards to the same level. The "difficulty" you return is what will be stored, so calibrate it honestly. Provide exactly one of "easy" | "medium" | "hard"; never use other values.`;

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
            const typeRestriction =
              types.length === 1
                ? `CRITICAL: ONLY generate cards of type '${types[0]}'. DO NOT generate any other types.`
                : `Allowed card types: ${types.join(", ")}. Only generate these types.`;

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

            // FOCUS TOPIC INSTRUCTION：每卡必须返回 focus_topic 字段
            systemPrompt += `\n\nFOCUS TOPIC INSTRUCTION: Every card MUST include a "focus_topic" field: a short string (≤30 Chinese characters) that describes the specific fine-grained knowledge point being tested. It MUST NOT be the same as the overall node/topic name. Examples: "损失函数·交叉熵" (not "监督学习"), "变量提升·var机制" (not "JavaScript基础"), "useEffect依赖数组" (not "React Hooks"). Be specific and granular.`;

            // 方案E：grounding —— 每题必须携带「原文依据」evidence，并限制拼接进 explanation
            systemPrompt += `\n\nGROUNDING: Every card MUST include an "evidence" field: the shortest verbatim phrase or sentence from the provided source material that directly supports / contains the answer. If the answer is not grounded in the source, revise the question or answer until it is. Never fabricate facts not present in the source.`;

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
