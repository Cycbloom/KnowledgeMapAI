import { SupabaseClient } from "@supabase/supabase-js";
import { QuizSetCrudService } from "./quizSetCrudService";
import { QuizSetGenerationService } from "./quizSetGenerationService";
import { QuizSetCardService } from "./quizSetCardService";
import type {
  CreateQuizSetData,
  UpdateQuizSetData,
  GenerateCardsOptions,
} from "./quizSetShared";

/**
 * 测验集服务：对外聚合入口。
 * 实现按职责拆分为 QuizSetCrudService / QuizSetGenerationService / QuizSetCardService。
 */
export class QuizSetsService {
  private crudService: QuizSetCrudService;
  private generationService: QuizSetGenerationService;
  private cardService: QuizSetCardService;

  constructor() {
    this.crudService = new QuizSetCrudService();
    this.generationService = new QuizSetGenerationService();
    this.cardService = new QuizSetCardService();
  }

  // ── Delegated to CrudService ──

  list(
    supabase: SupabaseClient,
    userId: string,
    graphId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.crudService.list(supabase, userId, graphId);
  }

  get(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
  ): Promise<Record<string, unknown>> {
    return this.crudService.get(supabase, userId, quizSetId);
  }

  create(
    supabase: SupabaseClient,
    userId: string,
    data: CreateQuizSetData,
  ): Promise<Record<string, unknown>> {
    return this.crudService.create(supabase, userId, data);
  }

  update(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    data: UpdateQuizSetData,
  ): Promise<Record<string, unknown>> {
    return this.crudService.update(supabase, userId, quizSetId, data);
  }

  delete(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.crudService.delete(supabase, userId, quizSetId);
  }

  // ── Delegated to GenerationService ──

  generateCards(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    options: Omit<GenerateCardsOptions, "quiz_set_id">,
  ): Promise<{ success: boolean; task_id: string; message: string }> {
    return this.generationService.generateCards(supabase, userId, quizSetId, options);
  }

  regenerateCard(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; card: Record<string, unknown>; message: string }> {
    return this.generationService.regenerateCard(supabase, userId, quizSetId, cardId);
  }

  // ── Delegated to CardService ──

  addCard(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.cardService.addCard(supabase, userId, quizSetId, cardId);
  }

  addCardsBatch(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardIds: string[],
  ): Promise<{ success: boolean; added: number; skipped: number; message: string }> {
    return this.cardService.addCardsBatch(supabase, userId, quizSetId, cardIds);
  }

  removeCard(
    supabase: SupabaseClient,
    userId: string,
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.cardService.removeCard(supabase, userId, quizSetId, cardId);
  }
}

export const quizSetsService = new QuizSetsService();
