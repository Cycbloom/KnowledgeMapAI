import { requestData } from "../../client";
import type { GoalMetric, GoalPeriodType, LearningGoal } from "@shared/types";

export const goalsApi = {
  /** 当前目标列表（含周期进度） */
  listGoals: async () => {
    return requestData<LearningGoal[]>("/scheduler/goals");
  },

  /** 创建 / 更新目标（按 period_type + metric upsert） */
  upsertGoal: async (input: {
    period_type: GoalPeriodType;
    metric: GoalMetric;
    target_value: number;
  }) => {
    return requestData<LearningGoal>("/scheduler/goals", {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /** 删除目标 */
  deleteGoal: async (id: string) => {
    return requestData<{ success: boolean }>(`/scheduler/goals/${id}`, {
      method: "DELETE",
    });
  },
};
