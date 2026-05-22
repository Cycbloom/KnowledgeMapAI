import { getMobileSupabaseClient } from "@/lib/supabase";
import type { StudyCardRow } from "@shared/types/database";

export const mobileDashboardApi = {
  getStats: async () => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return {
        total_graphs: 0,
        total_nodes: 0,
        total_edges: 0,
        total_study_cards: 0,
        study_streak: 0,
        today_reviews: 0,
      };
    }

    const [
      { count: graphCount },
      { count: nodeCount },
      { count: edgeCount },
      { count: cardCount },
      { data: cards },
    ] = await Promise.all([
      client
        .from("knowledge_graphs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null),
      client
        .from("graph_nodes")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      client
        .from("edges")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),
      client
        .from("study_cards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      client
        .from("study_cards")
        .select("next_review, last_reviewed")
        .eq("user_id", user.id),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let todayReviews = 0;
    ((cards || []) as Pick<StudyCardRow, "last_reviewed">[]).forEach((card) => {
      if (card.last_reviewed) {
        const lastReviewed = new Date(card.last_reviewed);
        if (lastReviewed >= today && lastReviewed < tomorrow) {
          todayReviews++;
        }
      }
    });

    return {
      total_graphs: graphCount || 0,
      total_nodes: nodeCount || 0,
      total_edges: edgeCount || 0,
      total_study_cards: cardCount || 0,
      study_streak: 0,
      today_reviews: todayReviews,
    };
  },
};
