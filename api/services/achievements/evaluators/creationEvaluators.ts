import type { AchievementConditionEvaluator } from "../types"
import type { AppEvent } from "@shared/types/events"
import { getSupabaseAdmin } from "../../../supabase"
import { notDeleted } from '../../common/softDeleteHelper';

const graphsCreatedEvaluator: AchievementConditionEvaluator = {
  conditionType: "graphs_created",
  relevantEvents: ["graph_created"],
  async getCurrentValue(userId: string): Promise<number> {
    const { count, error } = await notDeleted(getSupabaseAdmin()
      .from("knowledge_graphs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      )
    if (error) return 0
    return count ?? 0
  },
  getIncrementalDelta(_event: AppEvent): number {
    return 1
  },
}

const nodesCreatedEvaluator: AchievementConditionEvaluator = {
  conditionType: "nodes_created",
  relevantEvents: ["node_created", "graph_created"],
  async getCurrentValue(userId: string): Promise<number> {
    const { count, error } = await notDeleted(getSupabaseAdmin()
      .from("graph_nodes")
      .select("id, knowledge_graphs!inner(user_id)", { count: "exact", head: true })
      .eq("knowledge_graphs.user_id", userId)
      )
    if (error) return 0
    return count ?? 0
  },
  getIncrementalDelta(_event: AppEvent): number {
    return 1
  },
}

export const creationEvaluators: AchievementConditionEvaluator[] = [
  graphsCreatedEvaluator,
  nodesCreatedEvaluator,
]
