import { getMobileSupabaseClient } from "@/lib/supabase";
import type {
  QuizSet,
  QuizSetWithCards,
  CreateQuizSetData,
  UpdateQuizSetData,
  QuizGenerationProgress,
  GenerateQuizData,
  RegenerateCardData,
} from "@shared/types/quiz";
import type { StudyCard } from "@shared/types/common";


export const mobileQuizApi = {
  list: async (): Promise<QuizSet[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await client
      .from("quiz_sets")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as QuizSet[];
  },

  get: async (id: string): Promise<QuizSetWithCards> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: quizSet, error: quizError } = await client
      .from("quiz_sets")
      .select("*")
      .eq("id", id)
      .single();

    if (quizError) {
      throw new Error(quizError.message);
    }

    const { data: quizSetCards, error: cardsError } = await client
      .from("quiz_set_cards")
      .select(
        `
        card_id,
        display_order,
        study_cards (
          id,
          knowledge_point_id,
          user_id,
          graph_id,
          source_graph_id,
          question,
          answer,
          explanation,
          card_type,
          options,
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
      .eq("quiz_set_id", id)
      .order("display_order", { ascending: true });

    if (cardsError) {
      throw new Error(cardsError.message);
    }

    const cards: StudyCard[] = (quizSetCards || [])
      .filter((item) => item.study_cards && item.study_cards.length > 0)
      .map((item) => item.study_cards![0]) as StudyCard[];

    return {
      ...(quizSet as QuizSet),
      cards,
    } as QuizSetWithCards;
  },

  create: async (data: CreateQuizSetData): Promise<QuizSet> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: result, error } = await client
      .from("quiz_sets")
      .insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        graph_id: data.graph_id,
        config: data.config,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as QuizSet;
  },

  update: async (id: string, data: UpdateQuizSetData): Promise<QuizSet> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await client
      .from("quiz_sets")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as QuizSet;
  },

  delete: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await client.from("quiz_sets").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  },

  generate: async (
    _data: GenerateQuizData,
  ): Promise<{ quiz_set_id: string; task_id: string }> => {
    throw new Error("Quiz generation is not supported on mobile yet");
  },

  getGenerationProgress: async (
    _taskId: string,
  ): Promise<QuizGenerationProgress> => {
    return {
      status: "failed",
      total: 0,
      completed: 0,
      error: "Quiz generation is not supported on mobile yet",
    };
  },

  regenerateCard: async (
    _quizSetId: string,
    _cardId: string,
    _data?: RegenerateCardData,
  ): Promise<{ card_id: string; question: string; answer: string }> => {
    throw new Error("Card regeneration is not supported on mobile yet");
  },

  addCard: async (
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await client.from("quiz_set_cards").insert({
      quiz_set_id: quizSetId,
      card_id: cardId,
      display_order: 0,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { count } = await client
      .from("quiz_set_cards")
      .select("*", { count: "exact", head: true })
      .eq("quiz_set_id", quizSetId);

    await client
      .from("quiz_sets")
      .update({
        card_count: count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quizSetId);

    return { success: true, message: "Card added successfully" };
  },

  removeCard: async (
    quizSetId: string,
    cardId: string,
  ): Promise<{ success: boolean; message: string }> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await client
      .from("quiz_set_cards")
      .delete()
      .eq("quiz_set_id", quizSetId)
      .eq("card_id", cardId);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, message: "Card removed successfully" };
  },
};
