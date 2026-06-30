import { SupabaseClient } from "@supabase/supabase-js";
import type { LearningPlan } from "./learningPathService";
import { LearningPathDailyPlan } from "./learningPathDailyPlan";

export class LearningPathPlanService {
  private dailyPlan: LearningPathDailyPlan;

  constructor(dailyPlan: LearningPathDailyPlan) {
    this.dailyPlan = dailyPlan;
  }

  async createDailyPlan(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    input: {
      plan_date: string;
      planned_nodes: string[];
      planned_duration?: number;
      notes?: string;
    },
  ): Promise<LearningPlan> {
    return this.dailyPlan.createDailyPlan(supabase, pathId, userId, input);
  }

  async getDailyPlan(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    planDate: string,
  ): Promise<LearningPlan | null> {
    return this.dailyPlan.getDailyPlan(supabase, pathId, userId, planDate);
  }

  async getDailyPlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<LearningPlan[]> {
    return this.dailyPlan.getDailyPlans(supabase, pathId, userId, startDate, endDate);
  }

  async updatePlanStatus(
    supabase: SupabaseClient,
    planId: string,
    userId: string,
    input: {
      status?: string;
      time_spent?: number;
      notes?: string;
      progress_percentage?: number;
    },
  ): Promise<LearningPlan> {
    return this.dailyPlan.updatePlanStatus(supabase, planId, userId, input);
  }

  async generateDailyPlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    options?: {
      start_date?: string;
      respect_prerequisites?: boolean;
    },
  ): Promise<LearningPlan[]> {
    return this.dailyPlan.generateDailyPlans(supabase, pathId, userId, options);
  }
}
