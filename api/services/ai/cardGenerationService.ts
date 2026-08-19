import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import { getMockCards } from "./mock";
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

export interface GeneratedCard {
  type: string;
  [key: string]: unknown;
}

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
  /**
   * 方案A：库内该知识点已存在的题目题干，注入 prompt 作为 anti-duplicate 约束，
   * 降低与已有题重复的概率。
   */
  existingQuestions?: string[];
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
            const parsed = parseAIResponse<{ cards: unknown[] }>(
              result,
              "Generate Cards",
            );

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
}

export const cardGenerationService = new CardGenerationService();
