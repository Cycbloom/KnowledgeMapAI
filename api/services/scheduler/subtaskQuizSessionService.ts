/** @schedule decision - 练习/测验会话生命周期：启动、完成结算（FSRS 单一权威源）、推荐活动、独立记录 */
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { StudyCard } from "../../../shared/types/common";
import type { QuizSetConfig } from "../../../shared/types/quiz";
import { subtaskStateMachine } from "./subtaskStateMachine";
import { subtaskKnowledgeSyncService } from "./subtaskKnowledgeSync";
import { studyService } from "../study/studyService";
import { masteryCalculationService } from "../study/masteryCalculationService";
import { transactionExecutor } from "../../database/transactionExecutor";
import type { SubtaskQuizQueryService } from "./subtaskQuizQueryService";
import type { SubtaskQuizGenerationService } from "./subtaskQuizGenerationService";
import {
  PRACTICE_WEIGHT,
  PRACTICE_MAX_IMPROVEMENT,
  QUIZ_WEIGHT,
  QUIZ_MAX_IMPROVEMENT,
  LEARNING_SESSIONS_TABLE,
  LEARNING_SESSION_RESULTS_TABLE,
  type PracticeSession,
  type PracticeResult,
  type QuizSession,
  type QuizResult,
  type PracticeCompletionResult,
  type QuizCompletionResult,
  type QuizSetCardWithStudyCard,
} from "./subtaskQuizShared";

/**
 * 练习/测验会话服务：会话启动/完成（含 FSRS 掌握度结算与状态机推进）、
 * 推荐活动、独立测验记录。
 */
export class SubtaskQuizSessionService {
  constructor(
    private readonly queryService: SubtaskQuizQueryService,
    private readonly generationService: SubtaskQuizGenerationService,
  ) {}

  async startPracticeSession(
    supabase: SupabaseClient,
    subtaskId: string,
    knowledgePointId: string,
  ): Promise<PracticeSession> {
    logger.info("Starting practice session", {
      subtaskId,
      knowledgePointId,
    });

    const subtask = await this.queryService.getSubtaskData(supabase, subtaskId);

    const cards = await this.queryService.getPracticeCards(supabase, knowledgePointId);

    if (cards.length === 0) {
      const generatedCards = await this.generationService.generatePracticeCards(
        supabase,
        knowledgePointId,
        5,
      );

      if (generatedCards.length === 0) {
        throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
          message:
            "No practice cards available and failed to generate new ones",
        });
      }

      cards.push(...generatedCards);
    }

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from(LEARNING_SESSIONS_TABLE)
      .insert({
        id: sessionId,
        session_type: "practice",
        subtask_id: subtaskId,
        knowledge_point_id: knowledgePointId,
        user_id: subtask.user_id,
        card_ids: cards.map((c) => c.id),
        started_at: now,
        status: "in_progress",
      });

    if (insertError) {
      logger.error("Failed to create practice session", {
        subtaskId,
        error: insertError.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: insertError.message },
      });
    }

    logger.info("Practice session created", {
      sessionId,
      subtaskId,
      cardCount: cards.length,
    });

    return {
      id: sessionId,
      subtask_id: subtaskId,
      knowledge_point_id: knowledgePointId,
      cards,
      started_at: new Date(now),
      user_id: subtask.user_id,
    };
  }

  async completePractice(
    supabase: SupabaseClient,
    subtaskId: string,
    results: PracticeResult[],
  ): Promise<PracticeCompletionResult> {
    logger.info("Completing practice", {
      subtaskId,
      resultCount: results.length,
    });

    const subtask = await this.queryService.getSubtaskData(supabase, subtaskId);

    const { data: session, error: sessionError } = await supabase
      .from(LEARNING_SESSIONS_TABLE)
      .select("*")
      .eq("session_type", "practice")
      .eq("subtask_id", subtaskId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "No active practice session found",
      });
    }

    const correctCount = results.filter((r) => r.correct).length;
    const totalCount = results.length;
    const accuracy = totalCount > 0 ? correctCount / totalCount : 0;

    // 报告用作答正确率指标（不再作为掌握度增量来源，掌握度统一走 FSRS）
    const improvement = Math.min(
      accuracy * PRACTICE_WEIGHT,
      PRACTICE_MAX_IMPROVEMENT,
    );

    const now = new Date().toISOString();

    const resultsToInsert = results.map((r) => ({
      session_id: session.id,
      card_id: r.card_id,
      correct: r.correct,
      time_spent: r.time_spent,
      user_answer: r.user_answer,
      created_at: now,
    }));

    const { error: resultsError } = await supabase
      .from(LEARNING_SESSION_RESULTS_TABLE)
      .insert(resultsToInsert);

    if (resultsError) {
      logger.error("Failed to save practice results", {
        subtaskId,
        error: resultsError.message,
      });
    }

    await supabase
      .from(LEARNING_SESSIONS_TABLE)
      .update({
        status: "completed",
        completed_at: now,
        score: accuracy,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .eq("id", session.id);

    // 先更新作答卡片的 FSRS 状态，再基于 FSRS 重算掌握度（单一权威源）
    await this.updateCardReviewStats(supabase, results, subtask.user_id);

    /** @mastery display - 掌握度单一权威源：基于 study_cards FSRS 重算 */
    const mastery = await masteryCalculationService.updateKnowledgePointMastery(
      supabase,
      subtask.knowledge_point_id,
    );

    /** @schedule decision - FSRS next_state：状态机基于 learning_state + mastery 计算下一阶段 */
    const newState = subtaskStateMachine.getNextState(
      subtask.learning_state,
      mastery,
    );

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      newState,
      mastery,
    );

    logger.info("Practice completed", {
      subtaskId,
      accuracy,
      masteryBefore: subtask.mastery_level,
      masteryAfter: mastery,
      newState,
    });

    return {
      masteryLevel: mastery,
      newState,
      correctCount,
      totalCount,
      accuracy,
      improvement,
    };
  }

  async startQuizSession(
    supabase: SupabaseClient,
    subtaskId: string,
    knowledgePointId: string,
  ): Promise<QuizSession> {
    logger.info("Starting quiz session", {
      subtaskId,
      knowledgePointId,
    });

    const subtask = await this.queryService.getSubtaskData(supabase, subtaskId);

    let quizSet = await this.queryService.getQuizSet(supabase, knowledgePointId);

    if (!quizSet) {
      quizSet = await this.generationService.generateQuizSet(supabase, knowledgePointId, {
        cardTypes: ["qa", "choice", "true_false"],
        difficulty: "medium",
        knowledgePointIds: [knowledgePointId],
      });
    }

    const { data: quizSetCards, error: cardsError } = await supabase
      .from("quiz_set_cards")
      .select(
        `
        display_order,
        study_cards (
          id,
          knowledge_point_id,
          user_id,
          graph_id,
          source_graph_id,
          question,
          answer,
          card_type,
          options,
          explanation,
          difficulty,
          last_reviewed,
          next_review,
          review_count,
          fsrs_state,
          fsrs_stability,
          fsrs_difficulty,
          fsrs_elapsed_days,
          fsrs_scheduled_days,
          fsrs_retrievability,
          fsrs_last_review,
          created_at
        )
      `,
      )
      .eq("quiz_set_id", quizSet.id)
      .order("display_order", { ascending: true });

    if (cardsError) {
      logger.error("Failed to fetch quiz set cards", {
        quizSetId: quizSet.id,
        error: cardsError.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: cardsError.message },
      });
    }

    const cards: StudyCard[] = (quizSetCards ?? [])
      .flatMap((item: QuizSetCardWithStudyCard) => item.study_cards ?? []);

    if (cards.length === 0) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "No cards available in quiz set",
      });
    }

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from(LEARNING_SESSIONS_TABLE)
      .insert({
        id: sessionId,
        session_type: "quiz",
        subtask_id: subtaskId,
        knowledge_point_id: knowledgePointId,
        quiz_set_id: quizSet.id,
        user_id: subtask.user_id,
        card_ids: cards.map((c) => c.id),
        started_at: now,
        status: "in_progress",
      });

    if (insertError) {
      logger.error("Failed to create quiz session", {
        subtaskId,
        error: insertError.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: insertError.message },
      });
    }

    logger.info("Quiz session created", {
      sessionId,
      subtaskId,
      quizSetId: quizSet.id,
      cardCount: cards.length,
    });

    return {
      id: sessionId,
      subtask_id: subtaskId,
      knowledge_point_id: knowledgePointId,
      quiz_set_id: quizSet.id,
      cards,
      started_at: new Date(now),
      user_id: subtask.user_id,
    };
  }

  async completeQuiz(
    supabase: SupabaseClient,
    subtaskId: string,
    results: QuizResult[],
  ): Promise<QuizCompletionResult> {
    logger.info("Completing quiz", {
      subtaskId,
      resultCount: results.length,
    });

    const subtask = await this.queryService.getSubtaskData(supabase, subtaskId);

    const { data: session, error: sessionError } = await supabase
      .from(LEARNING_SESSIONS_TABLE)
      .select("*")
      .eq("session_type", "quiz")
      .eq("subtask_id", subtaskId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "No active quiz session found",
      });
    }

    const correctCount = results.filter((r) => r.correct).length;
    const totalCount = results.length;
    const score = totalCount > 0 ? correctCount / totalCount : 0;

    // 报告用作答得分率指标（不再作为掌握度增量来源，掌握度统一走 FSRS）
    const improvement = Math.min(score * QUIZ_WEIGHT, QUIZ_MAX_IMPROVEMENT);

    const now = new Date().toISOString();

    const resultsToInsert = results.map((r) => ({
      session_id: session.id,
      card_id: r.card_id,
      correct: r.correct,
      user_answer: r.answer,
      time_spent: r.time_spent,
      created_at: now,
    }));

    const { error: resultsError } = await supabase
      .from(LEARNING_SESSION_RESULTS_TABLE)
      .insert(resultsToInsert);

    if (resultsError) {
      logger.error("Failed to save quiz results", {
        subtaskId,
        error: resultsError.message,
      });
    }

    await supabase
      .from(LEARNING_SESSIONS_TABLE)
      .update({
        status: "completed",
        completed_at: now,
        score,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .eq("id", session.id);

    // 先更新作答卡片的 FSRS 状态，再基于 FSRS 重算掌握度（单一权威源）
    await this.updateCardReviewStats(
      supabase,
      results.map((r) => ({
        card_id: r.card_id,
        correct: r.correct,
        time_spent: r.time_spent,
      })),
      subtask.user_id,
    );

    /** @mastery display - 掌握度单一权威源：基于 study_cards FSRS 重算 */
    const mastery = await masteryCalculationService.updateKnowledgePointMastery(
      supabase,
      subtask.knowledge_point_id,
    );

    /** @schedule decision - FSRS next_state：状态机基于 learning_state + mastery 计算下一阶段 */
    const newState = subtaskStateMachine.getNextState(
      subtask.learning_state,
      mastery,
    );

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      newState,
      mastery,
    );

    logger.info("Quiz completed", {
      subtaskId,
      score,
      masteryBefore: subtask.mastery_level,
      masteryAfter: mastery,
      newState,
    });

    return {
      masteryLevel: mastery,
      newState,
      score,
      correctCount,
      totalCount,
      improvement,
    };
  }

  async getRecommendedActivity(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<{
    type: "practice" | "quiz" | "review";
    reason: string;
    availableCards: number;
  }> {
    const subtask = await this.queryService.getSubtaskData(supabase, subtaskId);
    const { learning_state } = subtask;
    /** @schedule decision - mastery_level READ：推荐活动分支判定（mastery >= 0.5 才触发 quiz） */
    const { mastery_level } = subtask;

    const cards = await this.queryService.getPracticeCards(
      supabase,
      subtask.knowledge_point_id,
    );
    const quizSet = await this.queryService.getQuizSet(supabase, subtask.knowledge_point_id);

    if (learning_state === "learning" || learning_state === "review") {
      return {
        type: "practice",
        reason: `当前处于${learning_state === "learning" ? "学习" : "复习"}阶段，建议进行练习巩固`,
        availableCards: cards.length,
      };
    }

    if (learning_state === "practice") {
      if (mastery_level >= 0.5 && quizSet) {
        return {
          type: "quiz",
          reason: "练习达标，可以开始测验检验学习成果",
          availableCards: quizSet.card_count,
        };
      }
      return {
        type: "practice",
        reason: "继续练习提升掌握度",
        availableCards: cards.length,
      };
    }

    if (learning_state === "quiz") {
      if (quizSet) {
        return {
          type: "quiz",
          reason: "进入测验阶段，检验学习成果",
          availableCards: quizSet.card_count,
        };
      }
      return {
        type: "practice",
        reason: "暂无测验题目，先进行练习",
        availableCards: cards.length,
      };
    }

    return {
      type: "practice",
      reason: "开始练习",
      availableCards: cards.length,
    };
  }

  /**
   * 记录一次独立的测验作答（面向用户测验页，不依赖调度子任务）。
   * 写入 learning_sessions(session_type='quiz') + learning_session_results。
   */
  async recordQuizAttempt(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    results: Array<{
      card_id: string;
      correct: boolean;
      user_answer?: string;
      time_spent?: number;
    }>,
  ): Promise<{ sessionId: string; score: number; correctCount: number; totalCount: number }> {
    const { data: quizSet } = await supabase
      .from("quiz_sets")
      .select("id, config")
      .eq("id", quizSetId)
      .eq("user_id", userId)
      .single();

    const { data: cardRows } = await supabase
      .from("quiz_set_cards")
      .select("card_id")
      .eq("quiz_set_id", quizSetId);

    const cardIds = (cardRows ?? []).map((r) => r.card_id as string);
    const config = (quizSet?.config ?? {}) as QuizSetConfig;
    const knowledgePointId = config.knowledgePointIds?.[0] ?? null;

    const totalCount = cardIds.length;
    const correctCount = results.filter((r) => r.correct).length;
    const score = totalCount > 0 ? correctCount / totalCount : 0;
    const totalTime = results.reduce((sum, r) => sum + (r.time_spent ?? 0), 0);

    const sessionId = await transactionExecutor.executeInTransaction(
      async (client) => {
        const sessionInsert = await client.query(
          `INSERT INTO learning_sessions (session_type, knowledge_point_id, quiz_set_id, user_id, card_ids, started_at, completed_at, status, score, correct_count, total_count, total_time_spent)
           VALUES ('quiz', $1, $2, $3, $4, NOW(), NOW(), 'completed', $5, $6, $7, $8)
           RETURNING id`,
          [
            knowledgePointId,
            quizSetId,
            userId,
            cardIds,
            score,
            correctCount,
            totalCount,
            totalTime,
          ],
        );

        const sid = sessionInsert.rows[0]?.id as string;

        for (const r of results) {
          await client.query(
            `INSERT INTO learning_session_results (session_id, card_id, correct, user_answer, time_spent)
             VALUES ($1, $2, $3, $4, $5)`,
            [sid, r.card_id, r.correct, r.user_answer ?? null, r.time_spent ?? 0],
          );
        }

        return sid;
      },
    );

    logger.info("Quiz attempt recorded", {
      quizSetId,
      sessionId,
      score,
      correctCount,
      totalCount,
    });

    return { sessionId, score, correctCount, totalCount };
  }

  private async updateCardReviewStats(
    supabase: SupabaseClient,
    results: Array<{ card_id: string; correct: boolean; time_spent: number }>,
    userId: string,
  ): Promise<void> {
    for (const result of results) {
      try {
        const quality = result.correct ? 3 : 1;
        await studyService.updateProgress(
          supabase,
          result.card_id,
          quality,
          userId,
        );
      } catch (error) {
        logger.error("Failed to update card FSRS progress", {
          cardId: result.card_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
