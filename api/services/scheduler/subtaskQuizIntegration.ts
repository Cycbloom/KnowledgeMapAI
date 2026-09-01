/** @schedule decision - 练习/测验集成入口：会话、生成、推荐、独立记录 */
import { SupabaseClient } from "@supabase/supabase-js";
import type { StudyCard } from "../../../shared/types/common";
import type { QuizSet, QuizSetConfig } from "../../../shared/types/quiz";
import type { IAIProviderService } from "./types";
import { SubtaskQuizQueryService } from "./subtaskQuizQueryService";
import { SubtaskQuizGenerationService } from "./subtaskQuizGenerationService";
import { SubtaskQuizSessionService } from "./subtaskQuizSessionService";

// 类型 re-export：保持既有调用方从本文件导入类型
export type {
  PracticeSession,
  PracticeResult,
  QuizSession,
  QuizResult,
  PracticeCompletionResult,
  QuizCompletionResult,
} from "./subtaskQuizShared";

/**
 * 练习/测验集成服务：对外聚合入口。
 * 实现按职责拆分为 SubtaskQuizQueryService / SubtaskQuizGenerationService / SubtaskQuizSessionService。
 */
export class SubtaskQuizIntegrationService {
  private queryService: SubtaskQuizQueryService;
  private generationService: SubtaskQuizGenerationService;
  private sessionService: SubtaskQuizSessionService;

  constructor() {
    this.queryService = new SubtaskQuizQueryService();
    this.generationService = new SubtaskQuizGenerationService(this.queryService);
    this.sessionService = new SubtaskQuizSessionService(
      this.queryService,
      this.generationService,
    );
  }

  /**
   * 注入 AI 服务，用于解耦 scheduler 层对 ai 层的直接运行时依赖。
   * 应在 SubtaskQuizIntegrationService 实例化后、使用前调用。
   */
  setAIProviderService(service: IAIProviderService): void {
    this.generationService.setAIProviderService(service);
  }

  // ── Delegated to QueryService ──

  getPracticeCards(
    supabase: SupabaseClient,
    knowledgePointId: string,
    difficulty?: 1 | 2,
  ): Promise<StudyCard[]> {
    return this.queryService.getPracticeCards(supabase, knowledgePointId, difficulty);
  }

  getQuizSet(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<QuizSet | null> {
    return this.queryService.getQuizSet(supabase, knowledgePointId);
  }

  // ── Delegated to GenerationService ──

  generatePracticeCards(
    supabase: SupabaseClient,
    knowledgePointId: string,
    count: number = 5,
  ): Promise<StudyCard[]> {
    return this.generationService.generatePracticeCards(supabase, knowledgePointId, count);
  }

  generateQuizSet(
    supabase: SupabaseClient,
    knowledgePointId: string,
    config: QuizSetConfig,
  ): Promise<QuizSet> {
    return this.generationService.generateQuizSet(supabase, knowledgePointId, config);
  }

  // ── Delegated to SessionService ──

  startPracticeSession(
    supabase: SupabaseClient,
    subtaskId: string,
    knowledgePointId: string,
  ): Promise<import("./subtaskQuizShared").PracticeSession> {
    return this.sessionService.startPracticeSession(supabase, subtaskId, knowledgePointId);
  }

  completePractice(
    supabase: SupabaseClient,
    subtaskId: string,
    results: import("./subtaskQuizShared").PracticeResult[],
  ): Promise<import("./subtaskQuizShared").PracticeCompletionResult> {
    return this.sessionService.completePractice(supabase, subtaskId, results);
  }

  startQuizSession(
    supabase: SupabaseClient,
    subtaskId: string,
    knowledgePointId: string,
  ): Promise<import("./subtaskQuizShared").QuizSession> {
    return this.sessionService.startQuizSession(supabase, subtaskId, knowledgePointId);
  }

  completeQuiz(
    supabase: SupabaseClient,
    subtaskId: string,
    results: import("./subtaskQuizShared").QuizResult[],
  ): Promise<import("./subtaskQuizShared").QuizCompletionResult> {
    return this.sessionService.completeQuiz(supabase, subtaskId, results);
  }

  getRecommendedActivity(
    supabase: SupabaseClient,
    subtaskId: string,
  ): Promise<{
    type: "practice" | "quiz" | "review";
    reason: string;
    availableCards: number;
  }> {
    return this.sessionService.getRecommendedActivity(supabase, subtaskId);
  }

  recordQuizAttempt(
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
    return this.sessionService.recordQuizAttempt(supabase, userId, quizSetId, results);
  }
}

export const subtaskQuizIntegrationService =
  new SubtaskQuizIntegrationService();
