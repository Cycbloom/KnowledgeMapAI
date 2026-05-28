import { SupabaseClient } from "@supabase/supabase-js";
import { efficiencyService } from "./efficiencyService";
import { logger } from "../../utils/logger";
import type { UserTask } from "./taskService";

export interface SchedulerWeights {
  timeSlot: number;
  mastery: number;
  dependency: number;
  typeMatch: number;
  priority: number;
  urgency: number;
  availability: number;
}

export const DEFAULT_SCHEDULER_WEIGHTS: SchedulerWeights = {
  timeSlot: 0.15,
  mastery: 0.2,
  dependency: 0.2,
  typeMatch: 0.1,
  priority: 0.15,
  urgency: 0.1,
  availability: 0.1,
};

export interface TaskTypeTimeMap {
  [taskType: string]: {
    best: number[];
    ok: number[];
  };
}

export const DEFAULT_TASK_TYPE_TIME_MAP: TaskTypeTimeMap = {
  learning: { best: [9, 10, 11, 14, 15], ok: [8, 12, 13, 16] },
  one_time: { best: [10, 11, 14, 15, 16], ok: [9, 12, 13, 17] },
  periodic: { best: [8, 9, 17, 18], ok: [10, 16, 19] },
  long_term: { best: [9, 10, 11, 14, 15], ok: [8, 12, 13, 16] },
  review: { best: [8, 9, 18, 19, 20], ok: [7, 10, 21] },
  exercise: { best: [6, 7, 18, 19], ok: [8, 17] },
};

export interface AdaptiveRecommendation {
  taskId: string;
  task: UserTask;
  overallScore: number;
  factorScores: Record<string, number>;
  recommendedTimeSlot: {
    startHour: number;
    endHour: number;
    label: string;
    efficiency: number;
  } | null;
  reasons: string[];
  priority: "high" | "medium" | "low";
}

export interface AdaptiveSchedulerResult {
  recommendations: AdaptiveRecommendation[];
  timeSlotInsights: Array<{
    startHour: number;
    endHour: number;
    label: string;
    efficiency: number;
    recommended: boolean;
    reason: string;
  }>;
  efficiencyTips: string[];
}

export class AdaptiveSchedulerService {
  private weights: SchedulerWeights;
  private taskTypeTimeMap: TaskTypeTimeMap;

  constructor(
    weights?: Partial<SchedulerWeights>,
    taskTypeTimeMap?: TaskTypeTimeMap,
  ) {
    this.weights = { ...DEFAULT_SCHEDULER_WEIGHTS, ...weights };
    this.taskTypeTimeMap = { ...DEFAULT_TASK_TYPE_TIME_MAP, ...taskTypeTimeMap };
  }

  getWeights(): SchedulerWeights {
    return { ...this.weights };
  }

  setWeights(weights: Partial<SchedulerWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  getTaskTypeTimeMap(): TaskTypeTimeMap {
    return { ...this.taskTypeTimeMap };
  }

  setTaskTypeTimeMap(map: TaskTypeTimeMap): void {
    this.taskTypeTimeMap = { ...this.taskTypeTimeMap, ...map };
  }

  async loadUserWeights(client: SupabaseClient, userId: string): Promise<void> {
    const { data } = await client
      .from("scheduler_weight_profiles")
      .select("weights, task_type_time_map")
      .eq("user_id", userId)
      .single();

    if (data?.weights) {
      this.setWeights(data.weights as Partial<SchedulerWeights>);
    }

    if (data?.task_type_time_map) {
      this.setTaskTypeTimeMap(data.task_type_time_map as TaskTypeTimeMap);
    }

    if (!data) {
      const { data: userData } = await client
        .from("users")
        .select("settings")
        .eq("id", userId)
        .single();

      if (userData?.settings?.scheduler_weights) {
        this.setWeights(userData.settings.scheduler_weights);
      }

      if (userData?.settings?.task_type_time_map) {
        this.setTaskTypeTimeMap(userData.settings.task_type_time_map);
      }
    }
  }

  async autoAdjustWeights(
    client: SupabaseClient,
    userId: string,
  ): Promise<SchedulerWeights> {
    const { data: profile } = await client
      .from("scheduler_weight_profiles")
      .select("weights, last_auto_adjusted_at, auto_adjust_enabled")
      .eq("user_id", userId)
      .single();

    if (!profile?.auto_adjust_enabled) {
      return this.weights;
    }

    const lastAdjusted = profile.last_auto_adjusted_at
      ? new Date(profile.last_auto_adjusted_at)
      : null;
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    if (lastAdjusted && lastAdjusted > twoWeeksAgo) {
      return profile.weights as SchedulerWeights;
    }

    const { data: completedTasks } = await client
      .from("user_tasks")
      .select("id, tags, estimated_duration, priority, created_at, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", twoWeeksAgo.toISOString());

    if (!completedTasks || completedTasks.length < 50) {
      return (profile.weights as SchedulerWeights) ?? this.weights;
    }

    const currentWeights = (profile.weights as SchedulerWeights) ?? { ...DEFAULT_SCHEDULER_WEIGHTS };
    const adjustedWeights = { ...currentWeights };

    const completionRateByHour: Record<number, { total: number; completed: number }> = {};
    for (const task of completedTasks) {
      if (task.completed_at) {
        const hour = new Date(task.completed_at).getHours();
        if (!completionRateByHour[hour]) {
          completionRateByHour[hour] = { total: 0, completed: 0 };
        }
        completionRateByHour[hour].total++;
        completionRateByHour[hour].completed++;
      }
    }

    const highCompletionHours = Object.entries(completionRateByHour)
      .filter(([_, data]) => data.completed / Math.max(1, data.total) > 0.7)
      .map(([hour]) => parseInt(hour));

    if (highCompletionHours.length > 0) {
      adjustedWeights.timeSlot = this.clampAdjustment(
        adjustedWeights.timeSlot,
        adjustedWeights.timeSlot * 1.1,
      );
    }

    const lowMasteryCompleted = completedTasks.filter((t) =>
      (t.tags || []).includes("学习") || (t.tags || []).includes("复习"),
    );
    if (lowMasteryCompleted.length > completedTasks.length * 0.3) {
      adjustedWeights.mastery = this.clampAdjustment(
        adjustedWeights.mastery,
        adjustedWeights.mastery * 1.1,
      );
    }

    const totalWeight = Object.values(adjustedWeights).reduce((sum, w) => sum + w, 0);
    for (const key of Object.keys(adjustedWeights) as (keyof SchedulerWeights)[]) {
      adjustedWeights[key] = Math.round((adjustedWeights[key] / totalWeight) * 100) / 100;
    }

    await client
      .from("scheduler_weight_profiles")
      .upsert({
        user_id: userId,
        weights: adjustedWeights,
        last_auto_adjusted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    this.setWeights(adjustedWeights);
    return adjustedWeights;
  }

  private clampAdjustment(current: number, proposed: number): number {
    const maxChange = current * 0.1;
    if (proposed > current) {
      return Math.min(proposed, current + maxChange);
    }
    return Math.max(proposed, current - maxChange);
  }

  async initializeChronotypeProfile(
    client: SupabaseClient,
    userId: string,
    chronotype: "early_bird" | "night_owl" | "balanced",
  ): Promise<void> {
    const chronotypeProfiles: Record<string, {
      weights: Partial<SchedulerWeights>;
      hourlyEfficiency: Record<number, number>;
      peakHours: number[];
    }> = {
      early_bird: {
        weights: { timeSlot: 0.2, mastery: 0.2 },
        hourlyEfficiency: {
          6: 0.9, 7: 0.95, 8: 0.9, 9: 0.85, 10: 0.8,
          11: 0.7, 12: 0.5, 13: 0.6, 14: 0.7, 15: 0.65,
          16: 0.6, 17: 0.5, 18: 0.4, 19: 0.35, 20: 0.3,
          21: 0.25, 22: 0.2,
        },
        peakHours: [7, 8, 9, 10],
      },
      night_owl: {
        weights: { timeSlot: 0.15, mastery: 0.2 },
        hourlyEfficiency: {
          6: 0.2, 7: 0.25, 8: 0.35, 9: 0.5, 10: 0.6,
          11: 0.65, 12: 0.6, 13: 0.55, 14: 0.6, 15: 0.65,
          16: 0.7, 17: 0.75, 18: 0.8, 19: 0.85, 20: 0.9,
          21: 0.95, 22: 0.9,
        },
        peakHours: [19, 20, 21, 22],
      },
      balanced: {
        weights: { timeSlot: 0.15, mastery: 0.2 },
        hourlyEfficiency: {
          6: 0.4, 7: 0.5, 8: 0.7, 9: 0.85, 10: 0.9,
          11: 0.85, 12: 0.5, 13: 0.6, 14: 0.8, 15: 0.85,
          16: 0.75, 17: 0.6, 18: 0.5, 19: 0.55, 20: 0.6,
          21: 0.55, 22: 0.4,
        },
        peakHours: [9, 10, 14, 15],
      },
    };

    const profile = chronotypeProfiles[chronotype];
    if (!profile) return;

    const weights = { ...DEFAULT_SCHEDULER_WEIGHTS, ...profile.weights };

    await client
      .from("scheduler_weight_profiles")
      .upsert({
        user_id: userId,
        weights,
        chronotype,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    const { data: existingProfile } = await client
      .from("user_efficiency_profile")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      await client
        .from("user_efficiency_profile")
        .update({
          hourly_efficiency: profile.hourlyEfficiency,
          peak_hours: profile.peakHours,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id);
    } else {
      await client
        .from("user_efficiency_profile")
        .insert({
          user_id: userId,
          hourly_efficiency: profile.hourlyEfficiency,
          peak_hours: profile.peakHours,
          tag_efficiency: {},
          queue_efficiency: {},
        });
    }

    this.setWeights(weights);
  }

  async generateRecommendations(
    client: SupabaseClient,
    userId: string,
  ): Promise<AdaptiveSchedulerResult> {
    const { data: tasksData, error } = await client
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "paused", "in_progress"])
      .is("deleted_at", null);

    if (error || !tasksData) {
      logger.error("Failed to fetch tasks for adaptive recommendations", { error });
      return { recommendations: [], timeSlotInsights: [], efficiencyTips: [] };
    }

    const tasks = tasksData as UserTask[];
    const timeSlots = await this.getTimeSlotInsights(client, userId);
    const masteryMap = await this.getMasteryLevels(client, tasks);
    const dependencyInfo = await this.getDependencyInfo(client, tasks);
    const userTimeSlots = await this.getUserTimeSlots(client, userId);

    const recommendations: AdaptiveRecommendation[] = [];

    for (const task of tasks) {
      const factorScores: Record<string, number> = {};
      factorScores.timeSlot = this.calculateTimeSlotScore(task, timeSlots);
      factorScores.mastery = this.calculateMasteryScore(task, masteryMap);
      factorScores.dependency = this.calculateDependencyScore(task, dependencyInfo);
      factorScores.typeMatch = this.calculateTypeMatchScore(task, timeSlots);
      factorScores.priority = task.priority * 20;
      factorScores.urgency = this.calculateUrgencyScore(task);
      factorScores.availability = this.calculateAvailabilityScore(task, userTimeSlots);

      const overallScore = this.calculateOverallScore(factorScores);
      const bestSlot = this.findBestTimeSlot(task, timeSlots);
      const reasons = this.generateReasons(task, factorScores, masteryMap, dependencyInfo, bestSlot);

      recommendations.push({
        taskId: task.id,
        task,
        overallScore,
        factorScores,
        recommendedTimeSlot: bestSlot,
        reasons,
        priority: this.getPriorityLevel(overallScore),
      });
    }

    recommendations.sort((a, b) => b.overallScore - a.overallScore);

    return {
      recommendations,
      timeSlotInsights: timeSlots.filter((s) => s.recommended),
      efficiencyTips: this.generateEfficiencyTips(timeSlots, recommendations),
    };
  }

  private async getTimeSlotInsights(
    client: SupabaseClient,
    userId: string,
  ): Promise<Array<{
    startHour: number;
    endHour: number;
    label: string;
    efficiency: number;
    recommended: boolean;
    reason: string;
  }>> {
    const profile = await efficiencyService.getUserEfficiencyProfile(client, userId);
    const defaultPeakHours = [9, 10, 14, 15];
    const recommendations = [];

    for (let hour = 0; hour < 24; hour++) {
      const efficiency = profile?.hourly_efficiency?.[hour] ?? (defaultPeakHours.includes(hour) ? 0.8 : 0.5);
      const isPeak = profile?.peak_hours?.includes(hour) ?? defaultPeakHours.includes(hour);
      const label = this.getTimeSlotLabel(hour);

      recommendations.push({
        startHour: hour,
        endHour: hour + 1,
        label,
        efficiency,
        recommended: isPeak || efficiency > 0.7,
        reason: isPeak ? "效率高峰时段" : efficiency > 0.7 ? "高效时段" : efficiency < 0.3 ? "低效时段" : "普通时段",
      });
    }

    return recommendations;
  }

  private async getMasteryLevels(
    client: SupabaseClient,
    tasks: UserTask[],
  ): Promise<Map<string, number>> {
    const masteryMap = new Map<string, number>();
    const knowledgePointIds = tasks
      .filter((t) => t.knowledge_point_id)
      .map((t) => t.knowledge_point_id as string);

    if (knowledgePointIds.length > 0) {
      const { data: studyCards } = await client
        .from("study_cards")
        .select("knowledge_point_id, fsrs_stability")
        .in("knowledge_point_id", knowledgePointIds);

      if (studyCards) {
        for (const card of studyCards) {
          const stability = card.fsrs_stability ?? 0;
          masteryMap.set(card.knowledge_point_id, Math.min(1, stability / 30));
        }
      }
    }

    return masteryMap;
  }

  private async getDependencyInfo(
    client: SupabaseClient,
    tasks: UserTask[],
  ): Promise<Map<string, { canStart: boolean; order: number; blockedBy: string[] }>> {
    const taskMap = new Map<string, UserTask>();
    for (const task of tasks) {
      taskMap.set(task.id, task);
    }

    const { data: dependencies } = await client
      .from("task_dependencies")
      .select("task_id, depends_on_task_id")
      .in("task_id", tasks.map((t) => t.id));

    const depMap = new Map<string, string[]>();
    for (const task of tasks) {
      depMap.set(task.id, []);
    }

    if (dependencies) {
      for (const dep of dependencies) {
        const deps = depMap.get(dep.task_id as string) || [];
        deps.push(dep.depends_on_task_id as string);
        depMap.set(dep.task_id as string, deps);
      }
    }

    const result = new Map<string, { canStart: boolean; order: number; blockedBy: string[] }>();
    const visited = new Set<string>();
    const orderMap = new Map<string, number>();

    const visit = (taskId: string, depth: number) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      for (const depId of depMap.get(taskId) || []) {
        if (taskMap.has(depId)) visit(depId, depth + 1);
      }
      orderMap.set(taskId, depth);
    };

    for (const task of tasks) {
      visit(task.id, 0);
    }

    for (const task of tasks) {
      const deps = (depMap.get(task.id) || []).filter((d) => taskMap.has(d));
      const completedDeps = deps.filter((d) => {
        const depTask = taskMap.get(d);
        return depTask && depTask.status === "completed";
      });

      result.set(task.id, {
        canStart: deps.length === 0 || completedDeps.length === deps.length,
        order: orderMap.get(task.id) || 0,
        blockedBy: deps.filter((d) => {
          const depTask = taskMap.get(d);
          return !depTask || depTask.status !== "completed";
        }),
      });
    }

    return result;
  }

  private async getUserTimeSlots(
    client: SupabaseClient,
    userId: string,
  ): Promise<Array<{ day_of_week: number; start_time: string; end_time: string; is_available: boolean }>> {
    const { data } = await client
      .from("user_time_slots")
      .select("day_of_week, start_time, end_time, is_available")
      .eq("user_id", userId);

    return (data as Array<{ day_of_week: number; start_time: string; end_time: string; is_available: boolean }>) || [];
  }

  private calculateTimeSlotScore(task: UserTask, timeSlots: Array<{ startHour: number; efficiency: number }>): number {
    const currentHour = new Date().getHours();
    const currentSlot = timeSlots.find((s) => s.startHour === currentHour);
    if (!currentSlot) return 50;

    const taskType = this.mapTaskToType(task);
    const typeConfig = this.taskTypeTimeMap[taskType];
    if (typeConfig) {
      if (typeConfig.best.includes(currentHour)) return 80 + currentSlot.efficiency * 20;
      if (typeConfig.ok.includes(currentHour)) return 60 + currentSlot.efficiency * 20;
    }

    return currentSlot.efficiency * 60;
  }

  private calculateMasteryScore(task: UserTask, masteryMap: Map<string, number>): number {
    if (!task.knowledge_point_id) return 50;
    const mastery = masteryMap.get(task.knowledge_point_id) ?? 0.5;
    return (1 - mastery) * 100;
  }

  private calculateDependencyScore(
    task: UserTask,
    dependencyInfo: Map<string, { canStart: boolean; order: number; blockedBy: string[] }>,
  ): number {
    const info = dependencyInfo.get(task.id);
    if (!info) return 50;
    if (!info.canStart) return 20;
    return 100 - info.order * 10;
  }

  private calculateTypeMatchScore(_task: UserTask, _timeSlots: Array<{ startHour: number; efficiency: number }>): number {
    const taskType = this.mapTaskToType(_task);
    const typeConfig = this.taskTypeTimeMap[taskType];
    if (!typeConfig) return 50;

    const currentHour = new Date().getHours();
    if (typeConfig.best.includes(currentHour)) return 90;
    if (typeConfig.ok.includes(currentHour)) return 60;
    return 30;
  }

  private calculateUrgencyScore(task: UserTask): number {
    let score = 0;

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const hoursUntil = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 0) score += 100;
      else if (hoursUntil < 4) score += 90;
      else if (hoursUntil < 24) score += 70;
      else if (hoursUntil < 72) score += 50;
      else if (hoursUntil < 168) score += 30;
      else score += 10;
    } else {
      score += 20;
    }

    score += (task.priority ?? 2) * 15;

    return Math.min(100, score);
  }

  private calculateAvailabilityScore(
    _task: UserTask,
    userTimeSlots: Array<{ day_of_week: number; start_time: string; end_time: string; is_available: boolean }>,
  ): number {
    if (userTimeSlots.length === 0) return 70;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentSlot = userTimeSlots.find(
      (s) => s.day_of_week === dayOfWeek && s.is_available,
    );

    return currentSlot ? 80 : 30;
  }

  private calculateOverallScore(factorScores: Record<string, number>): number {
    let score = 0;
    let totalWeight = 0;

    for (const [factor, weight] of Object.entries(this.weights)) {
      const factorScore = factorScores[factor] ?? 50;
      score += factorScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  private findBestTimeSlot(
    task: UserTask,
    timeSlots: Array<{ startHour: number; endHour: number; label: string; efficiency: number; recommended: boolean }>,
  ): { startHour: number; endHour: number; label: string; efficiency: number } | null {
    const taskType = this.mapTaskToType(task);
    const typeConfig = this.taskTypeTimeMap[taskType];

    let bestSlot: { startHour: number; endHour: number; label: string; efficiency: number } | null = null;
    let bestScore = -1;

    for (const slot of timeSlots) {
      let score = slot.efficiency;

      if (typeConfig) {
        if (typeConfig.best.includes(slot.startHour)) score += 0.3;
        else if (typeConfig.ok.includes(slot.startHour)) score += 0.15;
      }

      if (slot.recommended) score += 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  private mapTaskToType(task: UserTask): string {
    const taskType = task.task_type;
    if (taskType === "learning" || taskType === "graph_learning") return "learning";
    if (taskType === "one_time") return "one_time";
    if (taskType === "periodic") return "periodic";
    if (taskType === "long_term") return "long_term";

    const tags = task.tags || [];
    const tagTypeMap: Record<string, string> = {
      "学习": "learning",
      "复习": "review",
      "编程": "one_time",
      "写作": "one_time",
      "阅读": "long_term",
      "工作": "one_time",
      "会议": "one_time",
      "项目": "long_term",
      "运动": "exercise",
      "休息": "exercise",
    };

    for (const tag of tags) {
      if (tagTypeMap[tag]) return tagTypeMap[tag];
    }

    return "one_time";
  }

  private getTimeSlotLabel(hour: number): string {
    if (hour >= 6 && hour < 12) return "上午";
    if (hour >= 12 && hour < 18) return "下午";
    if (hour >= 18 && hour < 22) return "傍晚";
    return "夜间";
  }

  private generateReasons(
    task: UserTask,
    factorScores: Record<string, number>,
    masteryMap: Map<string, number>,
    dependencyInfo: Map<string, { canStart: boolean; order: number; blockedBy: string[] }>,
    bestSlot: { startHour: number; endHour: number; label: string; efficiency: number } | null,
  ): string[] {
    const reasons: string[] = [];

    if (task.knowledge_point_id) {
      const mastery = masteryMap.get(task.knowledge_point_id) ?? 0.5;
      if (mastery < 0.3) {
        reasons.push(`知识点掌握度较低 (${Math.round(mastery * 100)}%)，建议优先学习`);
      } else if (mastery < 0.5) {
        reasons.push(`知识点掌握度中等偏下 (${Math.round(mastery * 100)}%)，建议加强复习`);
      }
    }

    const depInfo = dependencyInfo.get(task.id);
    if (depInfo && !depInfo.canStart) {
      reasons.push(`任务被阻塞，需要先完成 ${depInfo.blockedBy.length} 个前置任务`);
    }

    if (factorScores.urgency > 70) {
      reasons.push("紧急度高，建议尽快处理");
    }

    if (bestSlot) {
      reasons.push(`推荐在 ${bestSlot.label} ${bestSlot.startHour}:00-${bestSlot.endHour}:00 执行`);
    }

    if (task.priority >= 3) {
      reasons.push("高优先级任务");
    }

    return reasons;
  }

  private getPriorityLevel(score: number): "high" | "medium" | "low" {
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  private generateEfficiencyTips(
    timeSlots: Array<{ recommended: boolean; efficiency: number; startHour: number }>,
    recommendations: AdaptiveRecommendation[],
  ): string[] {
    const tips: string[] = [];

    const peakSlots = timeSlots.filter((s) => s.recommended && s.efficiency > 0.7);
    if (peakSlots.length > 0) {
      const hours = peakSlots.map((s) => `${s.startHour}:00`).join("、");
      tips.push(`您的效率高峰时段: ${hours}`);
    }

    const highPriorityTasks = recommendations.filter((r) => r.priority === "high");
    if (highPriorityTasks.length > 3) {
      tips.push("当前有较多高优先级任务，建议集中精力处理");
    }

    const blockedTasks = recommendations.filter(
      (r) => r.reasons.some((reason) => reason.includes("被阻塞")),
    );
    if (blockedTasks.length > 0) {
      tips.push(`有 ${blockedTasks.length} 个任务被依赖阻塞，建议先处理前置任务`);
    }

    return tips;
  }
}

export const adaptiveSchedulerService = new AdaptiveSchedulerService();
