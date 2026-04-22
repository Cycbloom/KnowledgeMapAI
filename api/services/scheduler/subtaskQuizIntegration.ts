import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { StudyCard } from "../../../shared/types/common";
import type { LearningState } from "../../../shared/types/scheduler";
import type { QuizSet, QuizSetConfig } from "../../../shared/types/quiz";
import { subtaskStateMachine } from "./subtaskStateMachine";
import { subtaskKnowledgeSyncService } from "./subtaskKnowledgeSync";
import { aiService, type CardDifficulty } from "../ai/index";

export interface PracticeSession {
  id: string;
  subtask_id: string;
  knowledge_point_id: string;
  cards: StudyCard[];
  started_at: Date;
  user_id: string;
}

export interface PracticeResult {
  card_id: string;
  correct: boolean;
  time_spent: number;
  user_answer?: string;
}

export interface QuizSession {
  id: string;
  subtask_id: string;
  knowledge_point_id: string;
  quiz_set_id: string;
  cards: StudyCard[];
  started_at: Date;
  user_id: string;
}

export interface QuizResult {
  card_id: string;
  correct: boolean;
  answer?: string;
  time_spent: number;
}

export interface PracticeCompletionResult {
  masteryLevel: number;
  newState: LearningState;
  correctCount: number;
  totalCount: number;
  accuracy: number;
  improvement: number;
}

export interface QuizCompletionResult {
  masteryLevel: number;
  newState: LearningState;
  score: number;
  correctCount: number;
  totalCount: number;
  improvement: number;
}

interface SubtaskData {
  id: string;
  task_id: string;
  knowledge_point_id: string;
  learning_state: LearningState;
  mastery_level: number;
  user_id: string;
}

interface KnowledgePointData {
  id: string;
  title: string;
  content?: string;
  graph_id?: string;
}

interface AIGeneratedCard {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  options?: string[];
}

const PRACTICE_WEIGHT = 0.1;
const PRACTICE_MAX_IMPROVEMENT = 0.3;
const QUIZ_WEIGHT = 0.2;
const QUIZ_MAX_IMPROVEMENT = 0.4;

const PRACTICE_SESSIONS_TABLE = "practice_sessions";
const QUIZ_SESSIONS_TABLE = "quiz_sessions";
const PRACTICE_RESULTS_TABLE = "practice_results";
const QUIZ_RESULTS_TABLE = "quiz_results";

export class SubtaskQuizIntegrationService {
  async getPracticeCards(
    supabase: SupabaseClient,
    knowledgePointId: string,
    difficulty?: 1 | 2,
  ): Promise<StudyCard[]> {
    logger.info("Getting practice cards for knowledge point", {
      knowledgePointId,
      difficulty,
    });

    let query = supabase
      .from("study_cards")
      .select("*")
      .eq("knowledge_point_id", knowledgePointId)
      .order("created_at", { ascending: false });

    if (difficulty !== undefined) {
      const difficultyRange = difficulty === 1 ? [1, 2, 3] : [3, 4, 5];
      query = query.in("difficulty", difficultyRange);
    }

    const { data: cards, error } = await query.limit(20);

    if (error) {
      logger.error("Failed to fetch practice cards", {
        knowledgePointId,
        error: error.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    logger.info("Found practice cards", {
      knowledgePointId,
      count: cards?.length ?? 0,
    });

    return (cards as StudyCard[]) ?? [];
  }

  async getQuizSet(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<QuizSet | null> {
    logger.info("Getting quiz set for knowledge point", {
      knowledgePointId,
    });

    const { data: quizSets, error } = await supabase
      .from("quiz_sets")
      .select(
        `
        id,
        user_id,
        graph_id,
        title,
        description,
        config,
        status,
        card_count,
        created_at,
        updated_at
      `,
      )
      .contains("config->knowledgePointIds", JSON.stringify([knowledgePointId]))
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      logger.error("Failed to fetch quiz set", {
        knowledgePointId,
        error: error.message,
      });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        details: { originalError: error.message },
      });
    }

    if (!quizSets || quizSets.length === 0) {
      logger.info("No quiz set found for knowledge point", {
        knowledgePointId,
      });
      return null;
    }

    logger.info("Found quiz set for knowledge point", {
      knowledgePointId,
      quizSetId: quizSets[0].id,
    });

    return quizSets[0] as QuizSet;
  }

  async startPracticeSession(
    supabase: SupabaseClient,
    subtaskId: string,
    knowledgePointId: string,
  ): Promise<PracticeSession> {
    logger.info("Starting practice session", {
      subtaskId,
      knowledgePointId,
    });

    const subtask = await this.getSubtaskData(supabase, subtaskId);

    const cards = await this.getPracticeCards(supabase, knowledgePointId);

    if (cards.length === 0) {
      const generatedCards = await this.generatePracticeCards(
        supabase,
        knowledgePointId,
        5,
      );

      if (generatedCards.length === 0) {
        throw new AppError(ErrorCodes.NOT_FOUND, {
          message:
            "No practice cards available and failed to generate new ones",
        });
      }

      cards.push(...generatedCards);
    }

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from(PRACTICE_SESSIONS_TABLE)
      .insert({
        id: sessionId,
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

    const subtask = await this.getSubtaskData(supabase, subtaskId);

    const { data: session, error: sessionError } = await supabase
      .from(PRACTICE_SESSIONS_TABLE)
      .select("*")
      .eq("subtask_id", subtaskId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "No active practice session found",
      });
    }

    const correctCount = results.filter((r) => r.correct).length;
    const totalCount = results.length;
    const accuracy = totalCount > 0 ? correctCount / totalCount : 0;

    const improvement = Math.min(
      accuracy * PRACTICE_WEIGHT,
      PRACTICE_MAX_IMPROVEMENT,
    );

    const currentMastery = subtask.mastery_level;
    const newMastery = Math.min(1, currentMastery + improvement);

    const newState = subtaskStateMachine.getNextState(
      subtask.learning_state,
      newMastery,
    );

    const now = new Date().toISOString();

    const resultsToInsert = results.map((r) => ({
      practice_session_id: session.id,
      card_id: r.card_id,
      correct: r.correct,
      time_spent: r.time_spent,
      user_answer: r.user_answer,
      created_at: now,
    }));

    const { error: resultsError } = await supabase
      .from(PRACTICE_RESULTS_TABLE)
      .insert(resultsToInsert);

    if (resultsError) {
      logger.error("Failed to save practice results", {
        subtaskId,
        error: resultsError.message,
      });
    }

    await supabase
      .from(PRACTICE_SESSIONS_TABLE)
      .update({
        status: "completed",
        completed_at: now,
        accuracy,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .eq("id", session.id);

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      newState,
      newMastery,
    );

    await this.updateCardReviewStats(supabase, results);

    logger.info("Practice completed", {
      subtaskId,
      accuracy,
      masteryBefore: currentMastery,
      masteryAfter: newMastery,
      newState,
    });

    return {
      masteryLevel: newMastery,
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

    const subtask = await this.getSubtaskData(supabase, subtaskId);

    let quizSet = await this.getQuizSet(supabase, knowledgePointId);

    if (!quizSet) {
      quizSet = await this.generateQuizSet(supabase, knowledgePointId, {
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
      .map((item: any) => item.study_cards)
      .filter(Boolean);

    if (cards.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "No cards available in quiz set",
      });
    }

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from(QUIZ_SESSIONS_TABLE)
      .insert({
        id: sessionId,
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

    const subtask = await this.getSubtaskData(supabase, subtaskId);

    const { data: session, error: sessionError } = await supabase
      .from(QUIZ_SESSIONS_TABLE)
      .select("*")
      .eq("subtask_id", subtaskId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (sessionError || !session) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "No active quiz session found",
      });
    }

    const correctCount = results.filter((r) => r.correct).length;
    const totalCount = results.length;
    const score = totalCount > 0 ? correctCount / totalCount : 0;

    const improvement = Math.min(score * QUIZ_WEIGHT, QUIZ_MAX_IMPROVEMENT);

    const currentMastery = subtask.mastery_level;
    const newMastery = Math.min(1, currentMastery + improvement);

    const newState = subtaskStateMachine.getNextState(
      subtask.learning_state,
      newMastery,
    );

    const now = new Date().toISOString();

    const resultsToInsert = results.map((r) => ({
      quiz_session_id: session.id,
      card_id: r.card_id,
      correct: r.correct,
      answer: r.answer,
      time_spent: r.time_spent,
      created_at: now,
    }));

    const { error: resultsError } = await supabase
      .from(QUIZ_RESULTS_TABLE)
      .insert(resultsToInsert);

    if (resultsError) {
      logger.error("Failed to save quiz results", {
        subtaskId,
        error: resultsError.message,
      });
    }

    await supabase
      .from(QUIZ_SESSIONS_TABLE)
      .update({
        status: "completed",
        completed_at: now,
        score,
        correct_count: correctCount,
        total_count: totalCount,
      })
      .eq("id", session.id);

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      newState,
      newMastery,
    );

    await this.updateCardReviewStats(
      supabase,
      results.map((r) => ({
        card_id: r.card_id,
        correct: r.correct,
        time_spent: r.time_spent,
      })),
    );

    logger.info("Quiz completed", {
      subtaskId,
      score,
      masteryBefore: currentMastery,
      masteryAfter: newMastery,
      newState,
    });

    return {
      masteryLevel: newMastery,
      newState,
      score,
      correctCount,
      totalCount,
      improvement,
    };
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

    const knowledgePoint = await this.getKnowledgePointData(
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
      const aiResult = await aiService.generateCards(
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
      const cardsToInsert: any[] = [];

      for (const card of aiResult.cards as AIGeneratedCard[]) {
        if (existingQuestions.has(card.question)) {
          continue;
        }

        cardsToInsert.push({
          knowledge_point_id: knowledgePointId,
          question: card.question,
          answer: card.answer,
          explanation: card.explanation,
          card_type: card.type || "qa",
          difficulty: 1,
          options: card.options ? JSON.stringify(card.options) : null,
          next_review: new Date().toISOString(),
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
            newCards.push({
              id: insertedCards[i].id,
              knowledge_point_id: knowledgePointId,
              question: cardsToInsert[i].question,
              answer: cardsToInsert[i].answer,
              card_type: cardsToInsert[i].card_type,
              options: cardsToInsert[i].options,
              explanation: cardsToInsert[i].explanation,
              difficulty: cardsToInsert[i].difficulty,
              next_review: cardsToInsert[i].next_review,
            } as StudyCard);
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

    const knowledgePoint = await this.getKnowledgePointData(
      supabase,
      knowledgePointId,
    );

    const userId = await this.getUserIdForKnowledgePoint(
      supabase,
      knowledgePointId,
    );

    const quizSetId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: quizSetError } = await supabase.from("quiz_sets").insert({
      id: quizSetId,
      user_id: userId,
      title: `测验: ${knowledgePoint.title}`,
      description: `针对知识点 "${knowledgePoint.title}" 的综合测验`,
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
      const difficultyMap: Record<string, CardDifficulty> = {
        easy: "easy",
        medium: "medium",
        hard: "hard",
        mixed: "mixed",
      };

      const aiResult = await aiService.generateCards(
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

      const cardsToInsert = aiResult.cards.map((card: any) => ({
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
        next_review: new Date().toISOString(),
      }));

      const { data: insertedCards, error: insertError } = await supabase
        .from("study_cards")
        .insert(cardsToInsert)
        .select("id");

      if (insertError) {
        throw insertError;
      }

      const quizSetCardsToInsert = insertedCards.map(
        (card: any, index: number) => ({
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

  async getRecommendedActivity(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<{
    type: "practice" | "quiz" | "review";
    reason: string;
    availableCards: number;
  }> {
    const subtask = await this.getSubtaskData(supabase, subtaskId);
    const { learning_state, mastery_level } = subtask;

    const cards = await this.getPracticeCards(
      supabase,
      subtask.knowledge_point_id,
    );
    const quizSet = await this.getQuizSet(supabase, subtask.knowledge_point_id);

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

  private async getSubtaskData(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<SubtaskData> {
    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .select("id, task_id, knowledge_point_id, learning_state, mastery_level")
      .eq("id", subtaskId)
      .single();

    if (error || !subtask) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "Subtask not found",
        details: { subtaskId },
      });
    }

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("user_id")
      .eq("id", (subtask as any).task_id)
      .single();

    return {
      ...subtask,
      user_id: task?.user_id ?? "",
    } as SubtaskData;
  }

  private async getKnowledgePointData(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<KnowledgePointData> {
    const { data: kp, error } = await supabase
      .from("knowledge_points")
      .select("id, title, content")
      .eq("id", knowledgePointId)
      .single();

    if (error || !kp) {
      throw new AppError(ErrorCodes.NOT_FOUND, {
        message: "Knowledge point not found",
        details: { knowledgePointId },
      });
    }

    const { data: graphNode } = await supabase
      .from("graph_nodes")
      .select("graph_id")
      .eq("knowledge_point_id", knowledgePointId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    return {
      ...kp,
      graph_id: graphNode?.graph_id,
    } as KnowledgePointData;
  }

  private async getUserIdForKnowledgePoint(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<string> {
    const { data: subtask } = await supabase
      .from("task_subtasks")
      .select("task_id")
      .eq("knowledge_point_id", knowledgePointId)
      .limit(1)
      .single();

    if (subtask) {
      const { data: task } = await supabase
        .from("scheduled_tasks")
        .select("user_id")
        .eq("id", (subtask as any).task_id)
        .single();

      if (task?.user_id) {
        return task.user_id;
      }
    }

    const { data: graphNode } = await supabase
      .from("graph_nodes")
      .select("graph_id")
      .eq("knowledge_point_id", knowledgePointId)
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (graphNode?.graph_id) {
      const { data: graph } = await supabase
        .from("knowledge_graphs")
        .select("owner_id")
        .eq("id", graphNode.graph_id)
        .single();

      if (graph?.owner_id) {
        return graph.owner_id;
      }
    }

    throw new AppError(ErrorCodes.NOT_FOUND, {
      message: "Could not determine user for knowledge point",
    });
  }

  private async updateCardReviewStats(
    supabase: SupabaseClient,
    results: Array<{ card_id: string; correct: boolean; time_spent: number }>,
  ): Promise<void> {
    const now = new Date().toISOString();

    for (const result of results) {
      const { data: card } = await supabase
        .from("study_cards")
        .select("review_count")
        .eq("id", result.card_id)
        .single();

      const newReviewCount = (card?.review_count ?? 0) + 1;

      await supabase
        .from("study_cards")
        .update({
          last_reviewed: now,
          review_count: newReviewCount,
        })
        .eq("id", result.card_id);
    }
  }

  private getRandomDifficulty(): number {
    const difficulties = [1, 2, 3, 4, 5];
    return difficulties[Math.floor(Math.random() * difficulties.length)];
  }
}

export const subtaskQuizIntegrationService =
  new SubtaskQuizIntegrationService();
