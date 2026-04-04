import { SupabaseClient } from "@supabase/supabase-js";
import { efficiencyService } from "./efficiencyService";
import { sm2Service, ReviewTaskData } from "./sm2Service";
import { ScheduledTask } from "./taskService";
import { logger } from "../../utils/logger";

export interface TimeSlotRecommendation {
  startHour: number;
  endHour: number;
  label: string;
  efficiency: number;
  recommended: boolean;
  reason: string;
}

export interface MasteryBasedPriority {
  taskId: string;
  knowledgePointId: string | null;
  masteryLevel: number;
  adjustedPriority: number;
  originalPriority: number;
  reason: string;
}

export interface DependencyAwareTask {
  task: ScheduledTask;
  dependencies: string[];
  dependents: string[];
  canStart: boolean;
  order: number;
}

export interface TaskTypeTimeMatch {
  taskType: string;
  bestTimeSlots: TimeSlotRecommendation[];
  matchScore: number;
}

export interface SmartRecommendation {
  taskId: string;
  task: ScheduledTask;
  overallScore: number;
  timeSlotScore: number;
  masteryScore: number;
  dependencyScore: number;
  typeMatchScore: number;
  recommendedTimeSlot: TimeSlotRecommendation | null;
  reasons: string[];
  priority: "high" | "medium" | "low";
}

export interface SmartSchedulerResult {
  recommendations: SmartRecommendation[];
  timeSlotInsights: TimeSlotRecommendation[];
  efficiencyTips: string[];
  bestTimeForTask: Record<string, TimeSlotRecommendation>;
}

const TASK_TYPE_PREFERRED_HOURS: Record<string, number[]> = {
  学习: [9, 10, 11, 14, 15],
  编程: [9, 10, 11, 14, 15, 16],
  写作: [8, 9, 10, 20, 21],
  阅读: [7, 8, 20, 21, 22],
  复习: [8, 9, 18, 19, 20],
  工作: [9, 10, 11, 14, 15, 16, 17],
  会议: [10, 11, 14, 15, 16],
  项目: [9, 10, 11, 14, 15, 16, 17],
  运动: [6, 7, 18, 19],
  休息: [12, 13, 18, 19, 22, 23],
};

export class SmartSchedulerService {
  async getTimeSlotRecommendations(
    client: SupabaseClient,
    userId: string,
  ): Promise<TimeSlotRecommendation[]> {
    const profile = await efficiencyService.getUserEfficiencyProfile(client, userId);
    const recommendations: TimeSlotRecommendation[] = [];

    if (!profile) {
      return this.getDefaultTimeSlotRecommendations();
    }

    const hourlyEfficiency = profile.hourly_efficiency;
    const peakHours = profile.peak_hours || [];

    for (let hour = 0; hour < 24; hour++) {
      const efficiency = hourlyEfficiency[hour] || 0;
      const isPeak = peakHours.includes(hour);
      const label = this.getTimeSlotLabel(hour);

      recommendations.push({
        startHour: hour,
        endHour: hour + 1,
        label,
        efficiency,
        recommended: isPeak || efficiency > 0.7,
        reason: this.getTimeSlotReason(hour, efficiency, isPeak),
      });
    }

    return recommendations;
  }

  private getDefaultTimeSlotRecommendations(): TimeSlotRecommendation[] {
    const recommendations: TimeSlotRecommendation[] = [];
    const defaultPeakHours = [9, 10, 14, 15];

    for (let hour = 0; hour < 24; hour++) {
      const isPeak = defaultPeakHours.includes(hour);
      recommendations.push({
        startHour: hour,
        endHour: hour + 1,
        label: this.getTimeSlotLabel(hour),
        efficiency: isPeak ? 0.8 : 0.5,
        recommended: isPeak,
        reason: isPeak ? "默认高峰时段" : "普通时段",
      });
    }

    return recommendations;
  }

  private getTimeSlotLabel(hour: number): string {
    if (hour >= 6 && hour < 12) return "上午";
    if (hour >= 12 && hour < 18) return "下午";
    if (hour >= 18 && hour < 22) return "傍晚";
    return "夜间";
  }

  private getTimeSlotReason(_hour: number, efficiency: number, isPeak: boolean): string {
    if (isPeak) {
      return "您的效率高峰时段";
    }
    if (efficiency > 0.7) {
      return "高效时段";
    }
    if (efficiency < 0.3) {
      return "低效时段，建议休息或处理简单任务";
    }
    return "普通时段";
  }

  async calculateMasteryBasedPriority(
    client: SupabaseClient,
    _userId: string,
    tasks: ScheduledTask[],
  ): Promise<MasteryBasedPriority[]> {
    const results: MasteryBasedPriority[] = [];

    const knowledgePointIds = tasks
      .filter((t) => t.knowledge_point_id)
      .map((t) => t.knowledge_point_id as string);

    const masteryLevels: Record<string, number> = {};

    if (knowledgePointIds.length > 0) {
      const { data: reviewTasks } = await client
        .from("review_tasks")
        .select("knowledge_point_id, ease_factor, repetitions, interval_days")
        .in("knowledge_point_id", knowledgePointIds);

      if (reviewTasks) {
        for (const rt of reviewTasks) {
          const reviewTask = rt as ReviewTaskData;
          masteryLevels[reviewTask.knowledge_point_id] = sm2Service.estimateMasteryLevel(
            reviewTask.ease_factor,
            reviewTask.repetitions,
            reviewTask.interval_days,
          );
        }
      }
    }

    for (const task of tasks) {
      let masteryLevel = 0.5;
      let reason = "无关联知识点，使用默认掌握度";

      if (task.knowledge_point_id) {
        masteryLevel = masteryLevels[task.knowledge_point_id] ?? 0.5;
        reason = this.getMasteryReason(masteryLevel);
      }

      const masteryAdjustment = (1 - masteryLevel) * 2;
      const adjustedPriority = Math.min(4, Math.max(1, task.priority + masteryAdjustment));

      results.push({
        taskId: task.id,
        knowledgePointId: task.knowledge_point_id ?? null,
        masteryLevel,
        adjustedPriority: Math.round(adjustedPriority * 10) / 10,
        originalPriority: task.priority,
        reason,
      });
    }

    return results;
  }

  private getMasteryReason(masteryLevel: number): string {
    if (masteryLevel < 0.3) {
      return "掌握度较低，建议优先学习";
    }
    if (masteryLevel < 0.5) {
      return "掌握度中等偏下，建议加强复习";
    }
    if (masteryLevel < 0.7) {
      return "掌握度中等，保持复习节奏";
    }
    return "掌握度较好，可适当降低优先级";
  }

  async getDependencyAwareOrder(
    client: SupabaseClient,
    _userId: string,
    tasks: ScheduledTask[],
  ): Promise<DependencyAwareTask[]> {
    const taskMap = new Map<string, ScheduledTask>();
    for (const task of tasks) {
      taskMap.set(task.id, task);
    }

    const { data: dependencies } = await client
      .from("task_dependencies")
      .select("task_id, depends_on_task_id, dependency_type")
      .in(
        "task_id",
        tasks.map((t) => t.id),
      );

    const dependencyMap = new Map<string, string[]>();
    const dependentMap = new Map<string, string[]>();

    for (const task of tasks) {
      dependencyMap.set(task.id, []);
      dependentMap.set(task.id, []);
    }

    if (dependencies) {
      for (const dep of dependencies) {
        const taskId = dep.task_id as string;
        const dependsOnId = dep.depends_on_task_id as string;

        const deps = dependencyMap.get(taskId) || [];
        deps.push(dependsOnId);
        dependencyMap.set(taskId, deps);

        const dependents = dependentMap.get(dependsOnId) || [];
        dependents.push(taskId);
        dependentMap.set(dependsOnId, dependents);
      }
    }

    const visited = new Set<string>();
    const order: Map<string, number> = new Map();

    const visit = (taskId: string, depth: number) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const deps = dependencyMap.get(taskId) || [];
      for (const depId of deps) {
        if (taskMap.has(depId)) {
          visit(depId, depth + 1);
        }
      }

      order.set(taskId, depth);
    };

    for (const task of tasks) {
      visit(task.id, 0);
    }

    const results: DependencyAwareTask[] = [];
    for (const task of tasks) {
      const deps = dependencyMap.get(task.id) || [];
      const validDeps = deps.filter((d) => taskMap.has(d));
      const completedDeps = validDeps.filter((d) => {
        const depTask = taskMap.get(d);
        return depTask && depTask.status === "completed";
      });

      results.push({
        task,
        dependencies: validDeps,
        dependents: dependentMap.get(task.id) || [],
        canStart: validDeps.length === 0 || completedDeps.length === validDeps.length,
        order: order.get(task.id) || 0,
      });
    }

    return results.sort((a, b) => a.order - b.order);
  }

  matchTaskTypeToTimeSlot(
    task: ScheduledTask,
    timeSlots: TimeSlotRecommendation[],
  ): TaskTypeTimeMatch[] {
    const results: TaskTypeTimeMatch[] = [];
    const tags = task.tags || [];

    for (const tag of tags) {
      const preferredHours = TASK_TYPE_PREFERRED_HOURS[tag] || [];
      const bestSlots: TimeSlotRecommendation[] = [];

      for (const slot of timeSlots) {
        if (preferredHours.includes(slot.startHour)) {
          bestSlots.push(slot);
        }
      }

      const matchScore = bestSlots.length > 0
        ? bestSlots.reduce((sum, s) => sum + s.efficiency, 0) / bestSlots.length
        : 0;

      results.push({
        taskType: tag,
        bestTimeSlots: bestSlots,
        matchScore,
      });
    }

    return results;
  }

  async generateSmartRecommendations(
    client: SupabaseClient,
    userId: string,
  ): Promise<SmartSchedulerResult> {
    const { data: tasksData, error } = await client
      .from("scheduled_tasks")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "paused"])
      .is("deleted_at", null);

    if (error || !tasksData) {
      logger.error("Failed to fetch tasks for smart recommendations", { error });
      return {
        recommendations: [],
        timeSlotInsights: [],
        efficiencyTips: [],
        bestTimeForTask: {},
      };
    }

    const tasks = tasksData as ScheduledTask[];

    const timeSlots = await this.getTimeSlotRecommendations(client, userId);
    const masteryPriorities = await this.calculateMasteryBasedPriority(client, userId, tasks);
    const dependencyOrder = await this.getDependencyAwareOrder(client, userId, tasks);

    const masteryMap = new Map<string, MasteryBasedPriority>();
    for (const mp of masteryPriorities) {
      masteryMap.set(mp.taskId, mp);
    }

    const dependencyMap = new Map<string, DependencyAwareTask>();
    for (const dep of dependencyOrder) {
      dependencyMap.set(dep.task.id, dep);
    }

    const recommendations: SmartRecommendation[] = [];
    const bestTimeForTask: Record<string, TimeSlotRecommendation> = {};

    for (const task of tasks) {
      const masteryPriority = masteryMap.get(task.id);
      const dependencyInfo = dependencyMap.get(task.id);
      const typeMatches = this.matchTaskTypeToTimeSlot(task, timeSlots);

      const timeSlotScore = this.calculateTimeSlotScore(task, timeSlots);
      const masteryScore = masteryPriority ? (1 - masteryPriority.masteryLevel) * 100 : 50;
      const dependencyScore = dependencyInfo ? this.calculateDependencyScore(dependencyInfo) : 50;
      const typeMatchScore = typeMatches.length > 0
        ? typeMatches.reduce((sum, m) => sum + m.matchScore, 0) / typeMatches.length * 100
        : 50;

      const overallScore = this.calculateOverallScore(
        timeSlotScore,
        masteryScore,
        dependencyScore,
        typeMatchScore,
        task,
      );

      const bestSlot = this.findBestTimeSlot(task, timeSlots, typeMatches);
      if (bestSlot) {
        bestTimeForTask[task.id] = bestSlot;
      }

      const reasons = this.generateReasons(
        task,
        masteryPriority,
        dependencyInfo,
        typeMatches,
        bestSlot,
      );

      recommendations.push({
        taskId: task.id,
        task,
        overallScore,
        timeSlotScore,
        masteryScore,
        dependencyScore,
        typeMatchScore,
        recommendedTimeSlot: bestSlot,
        reasons,
        priority: this.getPriorityLevel(overallScore),
      });
    }

    recommendations.sort((a, b) => b.overallScore - a.overallScore);

    const efficiencyTips = this.generateEfficiencyTips(timeSlots, recommendations);

    return {
      recommendations,
      timeSlotInsights: timeSlots.filter((s) => s.recommended),
      efficiencyTips,
      bestTimeForTask,
    };
  }

  private calculateTimeSlotScore(
    task: ScheduledTask,
    timeSlots: TimeSlotRecommendation[],
  ): number {
    const now = new Date();
    const currentHour = now.getHours();
    const currentSlot = timeSlots.find((s) => s.startHour === currentHour);

    if (!currentSlot) return 50;

    const tags = task.tags || [];
    const preferredHours = tags.flatMap((t) => TASK_TYPE_PREFERRED_HOURS[t] || []);

    if (preferredHours.includes(currentHour)) {
      return 80 + currentSlot.efficiency * 20;
    }

    return currentSlot.efficiency * 60;
  }

  private calculateDependencyScore(depInfo: DependencyAwareTask): number {
    if (depInfo.canStart) {
      return 100 - depInfo.order * 10;
    }
    return 20;
  }

  private calculateOverallScore(
    timeSlotScore: number,
    masteryScore: number,
    dependencyScore: number,
    typeMatchScore: number,
    task: ScheduledTask,
  ): number {
    const weights = {
      timeSlot: 0.2,
      mastery: 0.25,
      dependency: 0.25,
      typeMatch: 0.15,
      priority: 0.15,
    };

    const priorityScore = task.priority * 20;

    return (
      timeSlotScore * weights.timeSlot +
      masteryScore * weights.mastery +
      dependencyScore * weights.dependency +
      typeMatchScore * weights.typeMatch +
      priorityScore * weights.priority
    );
  }

  private findBestTimeSlot(
    task: ScheduledTask,
    timeSlots: TimeSlotRecommendation[],
    _typeMatches: TaskTypeTimeMatch[],
  ): TimeSlotRecommendation | null {
    const tags = task.tags || [];
    const preferredHours = new Set<number>();

    for (const tag of tags) {
      const hours = TASK_TYPE_PREFERRED_HOURS[tag] || [];
      for (const h of hours) {
        preferredHours.add(h);
      }
    }

    let bestSlot: TimeSlotRecommendation | null = null;
    let bestScore = -1;

    for (const slot of timeSlots) {
      let score = slot.efficiency;

      if (preferredHours.has(slot.startHour)) {
        score += 0.3;
      }

      if (slot.recommended) {
        score += 0.2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  private generateReasons(
    task: ScheduledTask,
    masteryPriority: MasteryBasedPriority | undefined,
    dependencyInfo: DependencyAwareTask | undefined,
    typeMatches: TaskTypeTimeMatch[],
    bestSlot: TimeSlotRecommendation | null,
  ): string[] {
    const reasons: string[] = [];

    if (masteryPriority && masteryPriority.masteryLevel < 0.5) {
      reasons.push(`知识点掌握度较低 (${Math.round(masteryPriority.masteryLevel * 100)}%)，建议优先学习`);
    }

    if (dependencyInfo) {
      if (!dependencyInfo.canStart) {
        reasons.push(`任务被阻塞，需要先完成 ${dependencyInfo.dependencies.length} 个前置任务`);
      } else if (dependencyInfo.order === 0) {
        reasons.push("无依赖任务，可立即开始");
      }
    }

    if (typeMatches.length > 0) {
      const goodMatches = typeMatches.filter((m) => m.matchScore > 0.5);
      if (goodMatches.length > 0) {
        reasons.push(`任务类型 ${goodMatches.map((m) => m.taskType).join("、")} 与当前时段匹配度较高`);
      }
    }

    if (bestSlot) {
      reasons.push(`推荐在 ${bestSlot.label} ${bestSlot.startHour}:00-${bestSlot.endHour}:00 执行`);
    }

    if (task.priority >= 3) {
      reasons.push("高优先级任务");
    }

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const hoursUntil = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 24) {
        reasons.push("截止日期临近");
      }
    }

    return reasons;
  }

  private getPriorityLevel(score: number): "high" | "medium" | "low" {
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  private generateEfficiencyTips(
    timeSlots: TimeSlotRecommendation[],
    recommendations: SmartRecommendation[],
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

    const lowMasteryTasks = recommendations.filter(
      (r) => r.reasons.some((reason) => reason.includes("掌握度较低")),
    );
    if (lowMasteryTasks.length > 0) {
      tips.push(`有 ${lowMasteryTasks.length} 个任务关联的知识点掌握度较低，建议优先学习`);
    }

    return tips;
  }

  async getOptimalScheduleForDay(
    client: SupabaseClient,
    userId: string,
    _date: Date = new Date(),
  ): Promise<{
    schedule: Array<{
      hour: number;
      tasks: SmartRecommendation[];
      efficiency: number;
    }>;
    summary: {
      totalTasks: number;
      highPriorityCount: number;
      estimatedDuration: number;
    };
  }> {
    const smartResult = await this.generateSmartRecommendations(client, userId);
    const profile = await efficiencyService.getUserEfficiencyProfile(client, userId);

    const schedule: Array<{
      hour: number;
      tasks: SmartRecommendation[];
      efficiency: number;
    }> = [];

    const hourlyEfficiency = profile?.hourly_efficiency || {};

    for (let hour = 6; hour < 23; hour++) {
      const efficiency = hourlyEfficiency[hour] || 0.5;
      const hourTasks = smartResult.recommendations.filter((r) => {
        const bestSlot = r.recommendedTimeSlot;
        return bestSlot && bestSlot.startHour === hour;
      });

      schedule.push({
        hour,
        tasks: hourTasks,
        efficiency,
      });
    }

    const totalTasks = smartResult.recommendations.length;
    const highPriorityCount = smartResult.recommendations.filter(
      (r) => r.priority === "high",
    ).length;
    const estimatedDuration = smartResult.recommendations.reduce(
      (sum, r) => sum + (r.task.estimated_duration || 30),
      0,
    );

    return {
      schedule,
      summary: {
        totalTasks,
        highPriorityCount,
        estimatedDuration,
      },
    };
  }
}

export const smartSchedulerService = new SmartSchedulerService();
