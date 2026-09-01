/** @schedule decision - 练习/测验内容生成：AI 生成练习卡与测验集 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { StudyCard } from "../../../shared/types/common";
import type { QuizSet, QuizSetConfig } from "../../../shared/types/quiz";
import type { IAIProviderService } from "./types";
import { formatQuizSetTitle } from "../../../shared/constants/taskTitles";
import { resolveLocalizedText } from "../../../shared/utils/localization";
import type { SubtaskQuizQueryService } from "./subtaskQuizQueryService";
import {
  QUIZ_DIFFICULTY_MAP,
  type AIGeneratedCard,
  type CardToInsert,
} from "./subtaskQuizShared";

/**
 * 练习/测验内容生成服务：基于 AI 生成练习卡与测验集。
 * AI 服务通过 setAIProviderService 注入，避免 scheduler→ai 运行时循环依赖。
 */
export class SubtaskQuizGenerationService {
  private aiProviderService: IAIProviderService | null = null;

  constructor(private readonly queryService: SubtaskQuizQueryService) {}

  /**
   * 注入 AI 服务，用于解耦 scheduler 层对 ai 层的直接运行时依赖。
   * 应在 SubtaskQuizGenerationService 实例化后、使用前调用。
   */
  setAIProviderService(service: IAIProviderService): void {
    this.aiProviderService = service;
  }

  async generatePracticeCards(
    supabase: SupabaseClient,
    knowledgePointId: string,
    count: number = 5,
  ): Promise<StudyCard[]> {
    logger.info("Generating practice cards", {
      knowledgePointId,
      count,
    });

    const knowledgePoint = await this.queryService.getKnowledgePointData(
      supabase,
      knowledgePointId,
    );

    const { data: existingCards } = await supabase
      .from("study_cards")
      .select("question")
      .eq("knowledge_point_id", knowledgePointId);

    const existingQuestions = new Set(
      (existingCards ?? []).map((c) => c.question),
    );

    try {
      if (!this.aiProviderService) {
        throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, { message: "AI provider service not configured" });
      }
      const aiResult = await this.aiProviderService.generateCards(
        knowledgePoint.title,
        knowledgePoint.content || "",
        {
          types: ["qa", "choice"],
          count,
          difficulty: "easy",
          context:
            "Practice mode: Generate simple questions for quick knowledge check",
        },
      );

      const newCards: StudyCard[] = [];
      const cardsToInsert: CardToInsert[] = [];

      for (const card of aiResult.cards as AIGeneratedCard[]) {
        if (existingQuestions.has(card.question)) {
          continue;
        }

        cardsToInsert.push({
          knowledge_point_id: knowledgePointId,
          question: card.question,
          answer: card.answer,
          explanation: card.explanation,
          card_type: card.type ?? "qa",
          difficulty: 1,
          options: card.options ? JSON.stringify(card.options) : null,
          /** @schedule decision - due date：新生成卡首次复习时间 */
          next_review: new Date().toISOString(),
          /** @schedule decision - FSRS CardState 初始 New */
          fsrs_state: "New",
          /** @schedule decision - FSRS Stability (S) 初始值 */
          fsrs_stability: 0,
          /** @schedule decision - FSRS Difficulty (D) 初始值 */
          fsrs_difficulty: 0,
          fsrs_elapsed_days: 0,
          fsrs_scheduled_days: 0,
          /** @schedule decision - FSRS Retrievability (R) 初始快照 */
          fsrs_retrievability: 0,
        });
      }

      if (cardsToInsert.length > 0) {
        const { data: insertedCards, error: insertError } = await supabase
          .from("study_cards")
          .insert(cardsToInsert)
          .select("id");

        if (insertError) {
          logger.error("Failed to insert generated practice cards", {
            knowledgePointId,
            error: insertError.message,
          });
        } else {
          for (let i = 0; i < cardsToInsert.length; i++) {
            const inserted = insertedCards[i];
            if (!inserted) continue;
            newCards.push({
              id: inserted.id,
              knowledge_point_id: knowledgePointId,
              question: cardsToInsert[i].question,
              answer: cardsToInsert[i].answer,
              card_type: cardsToInsert[i].card_type,
              options: cardsToInsert[i].options,
              explanation: cardsToInsert[i].explanation,
              difficulty: cardsToInsert[i].difficulty,
              next_review: cardsToInsert[i].next_review,
              user_id: cardsToInsert[i].user_id ?? "",
              graph_id: cardsToInsert[i].graph_id ?? knowledgePoint.graph_id ?? "",
            } as unknown as StudyCard);
          }
        }
      }

      logger.info("Generated practice cards", {
        knowledgePointId,
        generatedCount: newCards.length,
      });

      return newCards;
    } catch (error) {
      logger.error("Failed to generate practice cards", {
        knowledgePointId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async generateQuizSet(
    supabase: SupabaseClient,
    knowledgePointId: string,
    config: QuizSetConfig,
  ): Promise<QuizSet> {
    logger.info("Generating quiz set", {
      knowledgePointId,
      config,
    });

    const knowledgePoint = await this.queryService.getKnowledgePointData(
      supabase,
      knowledgePointId,
    );

    const userId = await this.queryService.getUserIdForKnowledgePoint(
      supabase,
      knowledgePointId,
    );

    const quizSetId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: quizSetError } = await supabase.from("quiz_sets").insert({
      id: quizSetId,
      user_id: userId,
      title: formatQuizSetTitle(resolveLocalizedText(knowledgePoint.title)),
      description: `针对知识点 "${resolveLocalizedText(knowledgePoint.title)}" 的综合测验`,
      config,
      status: "generating",
      card_count: 0,
      created_at: now,
      updated_at: now,
    });

    if (quizSetError) {
      logger.error("Failed to create quiz set", {
        knowledgePointId,
        error: quizSetError.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: quizSetError.message },
      });
    }

    try {
      if (!this.aiProviderService) {
        throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, { message: "AI provider service not configured" });
      }
      const difficultyMap = QUIZ_DIFFICULTY_MAP;

      const aiResult = await this.aiProviderService.generateCards(
        knowledgePoint.title,
        knowledgePoint.content || "",
        {
          types: config.cardTypes,
          count: config.cardTypes.reduce(
            (sum, type) => sum + (config.cardsPerType?.[type] ?? 3),
            0,
          ),
          difficulty: difficultyMap[config.difficulty] || "medium",
          context: config.customPrompt,
          userId,
          graphId: knowledgePoint.graph_id,
        },
      );

      const cardsToInsert: CardToInsert[] = (aiResult.cards as AIGeneratedCard[]).map((card) => ({
        knowledge_point_id: knowledgePointId,
        user_id: userId,
        graph_id: knowledgePoint.graph_id,
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        card_type: card.type || "qa",
        difficulty:
          config.difficulty === "mixed"
            ? this.getRandomDifficulty()
            : config.difficulty === "easy"
              ? 1
              : config.difficulty === "hard"
                ? 4
                : 2,
        options: card.options ? JSON.stringify(card.options) : null,
        quiz_set_id: quizSetId,
        /** @schedule decision - due date：新卡首次复习时间 */
        next_review: new Date().toISOString(),
        /** @schedule decision - FSRS CardState 初始 New */
        fsrs_state: "New",
        /** @schedule decision - FSRS Stability (S) 初始值 */
        fsrs_stability: 0,
        /** @schedule decision - FSRS Difficulty (D) 初始值 */
        fsrs_difficulty: 0,
        fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0,
        /** @schedule decision - FSRS Retrievability (R) 初始快照 */
        fsrs_retrievability: 0,
      }));

      const { data: insertedCards, error: insertError } = await supabase
        .from("study_cards")
        .insert(cardsToInsert)
        .select("id");

      if (insertError) {
        throw insertError;
      }

      const quizSetCardsToInsert = insertedCards.map(
        (card: { id: string }, index: number) => ({
          quiz_set_id: quizSetId,
          card_id: card.id,
          display_order: index + 1,
        }),
      );

      await supabase.from("quiz_set_cards").insert(quizSetCardsToInsert);

      await supabase
        .from("quiz_sets")
        .update({
          status: "ready",
          card_count: insertedCards.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quizSetId);

      const { data: quizSet, error: fetchError } = await supabase
        .from("quiz_sets")
        .select("*")
        .eq("id", quizSetId)
        .single();

      if (fetchError || !quizSet) {
        throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
          details: { originalError: fetchError?.message },
        });
      }

      logger.info("Quiz set generated", {
        quizSetId,
        cardCount: insertedCards.length,
      });

      return quizSet as QuizSet;
    } catch (error) {
      await supabase
        .from("quiz_sets")
        .update({ status: "draft" })
        .eq("id", quizSetId);

      logger.error("Failed to generate quiz set", {
        knowledgePointId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: "Failed to generate quiz cards",
      });
    }
  }

  private getRandomDifficulty(): number {
    const difficulties = [1, 2, 3, 4, 5];
    return difficulties[Math.floor(Math.random() * difficulties.length)];
  }
}
