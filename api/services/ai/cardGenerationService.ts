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
} from "../../utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import {
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";

export type CardDifficulty = "easy" | "medium" | "hard" | "mixed";

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
      easy: `Difficulty Level: EASY
- Focus on basic concept recognition and memory recall
- Questions should directly test knowledge point definitions and basic facts
- Use straightforward language without complex scenarios
- For choice questions: distractors should be clearly distinguishable from the correct answer
- For QA questions: answers should be brief and directly stated in the source material`,
      medium: `Difficulty Level: MEDIUM
- Focus on understanding and application of concepts
- Questions should require comprehension, not just memorization
- Include simple scenarios or examples to test understanding
- For choice questions: distractors should be plausible but distinguishable with good understanding
- For QA questions: answers may require synthesizing information from multiple parts`,
      hard: `Difficulty Level: HARD
- Focus on analysis, synthesis, and complex problem-solving
- Questions should require deep understanding and connecting multiple concepts
- Include complex scenarios, edge cases, or require multi-step reasoning
- For choice questions: all options should be plausible, requiring careful analysis
- For QA questions: answers should demonstrate comprehensive understanding with examples`,
      mixed: `Difficulty Level: MIXED
- Generate questions with varying difficulty levels (easy, medium, hard)
- Distribute difficulty evenly across the generated cards
- Include a mix of memory recall, understanding, and analytical questions`,
    };

    const difficulty = options.difficulty || "medium";

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

            let systemPrompt = promptParts
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
            } else {
              const typeRestriction =
                types.length === 1
                  ? `CRITICAL: ONLY generate cards of type '${types[0]}'. DO NOT generate any other types.`
                  : `Allowed card types: ${types.join(", ")}. Only generate these types.`;

              systemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.

${typeRestriction}

${difficultyInstruction}

Context: ${context || "None"}\n\n${systemPrompt}

Please respond with a valid JSON object.`;
            }

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
                  response_format: { type: "json_object" },
                }),
              {
                timeout: LONG_TIMEOUT,
                maxRetries: 3,
                onRetry: (attempt, error) => {
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

            let cards = parsed.cards || [];
            const originalCount = cards.length;

            if (originalCount > 0) {
              cards = cards.filter((card: any) => {
                const cardType = card.type;
                return types.includes(cardType);
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
