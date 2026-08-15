import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { UserTask } from "./taskService";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

export interface TaskRecommendation {
  task: UserTask;
  score: number;
  reasons: string[];
  urgencyLevel: "low" | "medium" | "high" | "critical";
  suggestedTimeSlot?: TimeSlot;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  label: string;
  type: "morning" | "afternoon" | "evening" | "night";
}

export interface NextSubtaskInfo {
  id: string;
  title: string;
  learning_state: string;
  mastery_level: number;
  position: number;
  estimated_duration?: number;
}

export interface SubtaskProgressInfo {
  total: number;
  completed: number;
}

export interface EfficiencyData {
  hourlyEfficiency: Record<number, number>;
  tagEfficiency: Record<
    string,
    { avgDuration: number; completionRate: number }
  >;
  queueEfficiency: Record<
    number,
    { avgDuration: number; completionRate: number }
  >;
  peakHours: number[];
  lowHours: number[];
}

export interface RecommendationContext {
  currentTime: Date;
  userPreferences?: {
    workStartTime?: number;
    workEndTime?: number;
    preferredTaskTypes?: string[];
  };
}

export interface PrioritySuggestion {
  suggestedPriority: number;
  suggestedQueue: number;
  confidence: number;
  reasons: string[];
  keywords: string[];
}

const TIME_SLOT_CONFIG = {
  morning: {
    start: 6,
    end: 12,
    label: i18next.t("scheduler.taskRecommendation.timeSlotMorning"),
    recommendedTypes: ["学习", "编程", "写作", "阅读"],
  },
  afternoon: {
    start: 12,
    end: 18,
    label: i18next.t("scheduler.taskRecommendation.timeSlotAfternoon"),
    recommendedTypes: ["工作", "会议", "项目", "复习"],
  },
  evening: {
    start: 18,
    end: 22,
    label: i18next.t("scheduler.taskRecommendation.timeSlotEvening"),
    recommendedTypes: ["复习", "阅读", "运动", "休息"],
  },
  night: {
    start: 22,
    end: 6,
    label: i18next.t("scheduler.taskRecommendation.timeSlotNight"),
    recommendedTypes: ["休息", "阅读", "学习"],
  },
};

const PRIORITY_KEYWORDS = {
  critical: {
    keywords: [
      "紧急",
      "urgent",
      "asap",
      "立即",
      "马上",
      "紧急处理",
      "紧急修复",
      "critical",
      "火急",
      "急",
    ],
    priority: 4,
    queue: 0,
  },
  high: {
    keywords: [
      "重要",
      "important",
      "优先",
      "关键",
      "核心",
      "必须",
      "high",
      "今天",
      "今日",
      "deadline",
      "截止",
    ],
    priority: 3,
    queue: 0,
  },
  medium: {
    keywords: ["需要", "待办", "计划", "本周", "安排", "medium", "中等"],
    priority: 2,
    queue: 1,
  },
  low: {
    keywords: ["有空", "闲时", "不急", "慢慢", "low", "以后", "稍后", "可选"],
    priority: 1,
    queue: 2,
  },
};

export class TaskRecommendationService {
  calculateUrgencyScore(task: UserTask, now: Date = new Date()): number {
    let score = 0;

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const timeUntilDeadline = deadline.getTime() - now.getTime();
      const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);

      if (hoursUntilDeadline < 0) {
        score += 100;
      } else if (hoursUntilDeadline < 4) {
        score += 90;
      } else if (hoursUntilDeadline < 24) {
        score += 70;
      } else if (hoursUntilDeadline < 72) {
        score += 50;
      } else if (hoursUntilDeadline < 168) {
        score += 30;
      } else {
        score += 10;
      }
    } else {
      score += 20;
    }

    score += (task.priority || 1) * 15;

    score += (3 - task.queue_level) * 10;

    if (task.estimated_duration) {
      if (task.estimated_duration <= 25) {
        score += 15;
      } else if (task.estimated_duration <= 60) {
        score += 10;
      } else {
        score += 5;
      }
    }

    return Math.min(100, score);
  }

  getUrgencyLevel(score: number): "low" | "medium" | "high" | "critical" {
    if (score >= 80) return "critical";
    if (score >= 60) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  async calculateEfficiencyData(
    client: SupabaseClient,
    userId: string,
    days: number = 30,
  ): Promise<EfficiencyData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: executions, error } = await client
      .from("task_executions")
      .select(
        `
        *,
        user_tasks!inner(tags, queue_level)
      `,
      )
      .eq("user_id", userId)
      .gte("started_at", startDate.toISOString())
      .not("duration", "is", null);

    if (error) {
      logger.error("Failed to fetch executions for efficiency data:", error);
      return this.getDefaultEfficiencyData();
    }

    const hourlyEfficiency: Record<number, number[]> = {};
    const tagEfficiency: Record<
      string,
      { durations: number[]; completed: number; total: number }
    > = {};
    const queueEfficiency: Record<
      number,
      { durations: number[]; completed: number; total: number }
    > = {};

    for (let i = 0; i < 24; i++) {
      hourlyEfficiency[i] = [];
    }

    for (const exec of executions || []) {
      const hour = new Date(exec.started_at).getHours();
      const duration = exec.duration || 0;

      hourlyEfficiency[hour].push(duration);

      const task = exec.user_tasks as {
        tags?: string[];
        queue_level?: number;
      };
      if (task?.tags) {
        for (const tag of task.tags) {
          if (!tagEfficiency[tag]) {
            tagEfficiency[tag] = { durations: [], completed: 0, total: 0 };
          }
          tagEfficiency[tag].durations.push(duration);
          tagEfficiency[tag].total++;
          if (exec.status === "completed") {
            tagEfficiency[tag].completed++;
          }
        }
      }

      if (task?.queue_level !== undefined) {
        const qLevel = task.queue_level;
        if (!queueEfficiency[qLevel]) {
          queueEfficiency[qLevel] = { durations: [], completed: 0, total: 0 };
        }
        queueEfficiency[qLevel].durations.push(duration);
        queueEfficiency[qLevel].total++;
        if (exec.status === "completed") {
          queueEfficiency[qLevel].completed++;
        }
      }
    }

    const avgHourlyEfficiency: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      const durations = hourlyEfficiency[i];
      avgHourlyEfficiency[i] =
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;
    }

    const processedTagEfficiency: Record<
      string,
      { avgDuration: number; completionRate: number }
    > = {};
    for (const [tag, data] of Object.entries(tagEfficiency)) {
      processedTagEfficiency[tag] = {
        avgDuration:
          data.durations.length > 0
            ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
            : 0,
        completionRate: data.total > 0 ? data.completed / data.total : 0,
      };
    }

    const processedQueueEfficiency: Record<
      number,
      { avgDuration: number; completionRate: number }
    > = {};
    for (const [level, data] of Object.entries(queueEfficiency)) {
      processedQueueEfficiency[Number(level)] = {
        avgDuration:
          data.durations.length > 0
            ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
            : 0,
        completionRate: data.total > 0 ? data.completed / data.total : 0,
      };
    }

    const sortedHours = Object.entries(avgHourlyEfficiency).sort(
      ([, a], [, b]) => b - a,
    );

    const peakHours = sortedHours.slice(0, 4).map(([h]) => Number(h));
    const lowHours = sortedHours.slice(-4).map(([h]) => Number(h));

    return {
      hourlyEfficiency: avgHourlyEfficiency,
      tagEfficiency: processedTagEfficiency,
      queueEfficiency: processedQueueEfficiency,
      peakHours,
      lowHours,
    };
  }

  private getDefaultEfficiencyData(): EfficiencyData {
    const hourlyEfficiency: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyEfficiency[i] = 0;
    }
    return {
      hourlyEfficiency,
      tagEfficiency: {},
      queueEfficiency: {},
      peakHours: [9, 10, 14, 15],
      lowHours: [0, 1, 2, 3],
    };
  }

  getCurrentTimeSlot(now: Date = new Date()): TimeSlot {
    const hour = now.getHours();

    for (const [type, config] of Object.entries(TIME_SLOT_CONFIG)) {
      if (type === "night") {
        if (hour >= config.start || hour < config.end) {
          return {
            start: new Date(now),
            end: new Date(now),
            label: config.label,
            type: type as TimeSlot["type"],
          };
        }
      } else {
        if (hour >= config.start && hour < config.end) {
          return {
            start: new Date(now),
            end: new Date(now),
            label: config.label,
            type: type as TimeSlot["type"],
          };
        }
      }
    }

    return {
      start: new Date(now),
      end: new Date(now),
      label: i18next.t("scheduler.taskRecommendation.timeSlotMorning"),
      type: "morning",
    };
  }

  getTimeSlotRecommendations(
    tasks: UserTask[],
    timeSlot: TimeSlot,
  ): UserTask[] {
    const config = TIME_SLOT_CONFIG[timeSlot.type];
    if (!config) return tasks;

    // 预构建 Set 并用 Map 缓存每个 task 的匹配结果，避免 sort 比较器内重复 some×includes 的 O(n·log n) 扫描
    const recommendedTypeSet = new Set(config.recommendedTypes);
    const matchCache = new Map<UserTask, boolean>();
    const hasRecommendedType = (task: UserTask): boolean => {
      const cached = matchCache.get(task);
      if (cached !== undefined) return cached;
      const matched = (task.tags || []).some((tag) => recommendedTypeSet.has(tag));
      matchCache.set(task, matched);
      return matched;
    };

    return tasks.sort((a, b) => (hasRecommendedType(b) ? 1 : 0) - (hasRecommendedType(a) ? 1 : 0));
  }

  async getTaskRecommendations(
    client: SupabaseClient,
    userId: string,
    context?: RecommendationContext,
  ): Promise<TaskRecommendation[]> {
    const now = context?.currentTime || new Date();

    const { data: tasks, error } = await notDeleted(client
      .from("user_tasks")
      .select(
        `
        *,
        knowledge_graphs!left(
          id,
          deleted_at
        )
      `,
      )
      .eq("user_id", userId)
      .in("status", ["pending", "paused"])
      )
      .order("priority", { ascending: false });

    if (error || !tasks) {
      return [];
    }

    // 过滤掉关联了已删除图谱的任务
    const validTasks = tasks.filter((task) => {
      // 非图谱学习任务，直接保留
      if (task.task_type !== "graph_learning") {
        return true;
      }

      // 图谱学习任务，检查图谱是否被删除
      const graphData = task.knowledge_graphs;
      if (!graphData || (Array.isArray(graphData) && graphData.length === 0)) {
        // 没有关联图谱，可能是数据不一致，但仍然保留
        return true;
      }

      // 检查图谱是否被软删除
      const graph = Array.isArray(graphData) ? graphData[0] : graphData;
      return !graph.deleted_at;
    });

    const efficiencyData = await this.calculateEfficiencyData(client, userId);
    const currentTimeSlot = this.getCurrentTimeSlot(now);

    // 预构建 Set 与小时值，替代 map 内层对 recommendedTypes/peakHours 的 O(n) includes 扫描
    const recommendedTypeSet = new Set(
      TIME_SLOT_CONFIG[currentTimeSlot.type].recommendedTypes,
    );
    const peakHourSet = new Set(efficiencyData.peakHours);
    const currentHour = now.getHours();

    const recommendations: TaskRecommendation[] = validTasks.map((task) => {
      const urgencyScore = this.calculateUrgencyScore(task, now);
      const urgencyLevel = this.getUrgencyLevel(urgencyScore);
      const reasons: string[] = [];

      if (task.deadline) {
        const deadline = new Date(task.deadline);
        const hoursUntil = Math.round(
          (deadline.getTime() - now.getTime()) / (1000 * 60 * 60),
        );
        if (hoursUntil < 0) {
          reasons.push(i18next.t("scheduler.taskRecommendation.deadlinePassed"));
        } else if (hoursUntil < 24) {
          reasons.push(i18next.t("scheduler.taskRecommendation.deadlineApproachingHours", { hours: hoursUntil }));
        } else if (hoursUntil < 72) {
          reasons.push(i18next.t("scheduler.taskRecommendation.deadlineWithinDays", { days: Math.round(hoursUntil / 24) }));
        }
      }

      if (task.priority >= 3) {
        reasons.push(i18next.t("scheduler.taskRecommendation.highPriorityTask"));
      }

      if (task.queue_level === 0) {
        reasons.push(i18next.t("scheduler.taskRecommendation.inUrgentQueue"));
      }

      if (task.tags && task.tags.length > 0) {
        const matchingTags = task.tags.filter((tag: string) =>
          recommendedTypeSet.has(tag),
        );
        if (matchingTags.length > 0) {
          reasons.push(
            i18next.t("scheduler.taskRecommendation.suitableForTimeSlot", { label: currentTimeSlot.label, tags: matchingTags.join(", ") }),
          );
        }
      }

      const tagEfficiencies = (task.tags || [])
        .map(
          (tag: string) =>
            efficiencyData.tagEfficiency[tag]?.completionRate || 0,
        )
        .filter((rate: number) => rate > 0);

      if (tagEfficiencies.length > 0) {
        const avgEfficiency =
          tagEfficiencies.reduce((a: number, b: number) => a + b, 0) /
          tagEfficiencies.length;
        if (avgEfficiency > 0.7) {
          reasons.push(i18next.t("scheduler.taskRecommendation.highHistoricalCompletionRate"));
        }
      }

      let adjustedScore = urgencyScore;
      if (peakHourSet.has(currentHour)) {
        adjustedScore *= 1.1;
      }

      return {
        task: task as UserTask,
        score: Math.min(100, adjustedScore),
        reasons,
        urgencyLevel,
        suggestedTimeSlot: currentTimeSlot,
      };
    });

    return recommendations.sort((a, b) => b.score - a.score);
  }

  analyzePriorityFromText(
    title: string,
    description?: string,
  ): PrioritySuggestion {
    const text = `${title} ${description || ""}`.toLowerCase();
    const foundKeywords: string[] = [];
    let matchedLevel: "critical" | "high" | "medium" | "low" | null = null;

    for (const [level, config] of Object.entries(PRIORITY_KEYWORDS)) {
      for (const keyword of config.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          foundKeywords.push(keyword);
          if (!matchedLevel || level === "critical") {
            matchedLevel = level as "critical" | "high" | "medium" | "low";
          }
        }
      }
    }

    if (matchedLevel) {
      const config = PRIORITY_KEYWORDS[matchedLevel];
      const reasons: string[] = [];

      if (matchedLevel === "critical") {
        reasons.push(i18next.t("scheduler.taskRecommendation.detectedCriticalKeyword"));
      } else if (matchedLevel === "high") {
        reasons.push(i18next.t("scheduler.taskRecommendation.detectedHighPriorityKeyword"));
      } else if (matchedLevel === "medium") {
        reasons.push(i18next.t("scheduler.taskRecommendation.detectedMediumPriorityKeyword"));
      } else {
        reasons.push(i18next.t("scheduler.taskRecommendation.detectedLowPriorityKeyword"));
      }

      if (foundKeywords.length > 0) {
        reasons.push(i18next.t("scheduler.taskRecommendation.matchedKeywords", { keywords: foundKeywords.slice(0, 3).join(", ") }));
      }

      return {
        suggestedPriority: config.priority,
        suggestedQueue: config.queue,
        confidence: Math.min(0.95, 0.6 + foundKeywords.length * 0.1),
        reasons,
        keywords: foundKeywords,
      };
    }

    return {
      suggestedPriority: 2,
      suggestedQueue: 1,
      confidence: 0.5,
      reasons: [i18next.t("scheduler.taskRecommendation.noPriorityKeywordDefault")],
      keywords: [],
    };
  }

  async getSmartSuggestions(
    client: SupabaseClient,
    userId: string,
    context?: RecommendationContext,
  ): Promise<{
    topTasks: TaskRecommendation[];
    timeBasedSuggestions: string[];
    efficiencyTips: string[];
  }> {
    const recommendations = await this.getTaskRecommendations(
      client,
      userId,
      context,
    );
    const efficiencyData = await this.calculateEfficiencyData(client, userId);
    const now = context?.currentTime || new Date();
    const currentHour = now.getHours();

    const topTasks = recommendations.slice(0, 5);

    const timeBasedSuggestions: string[] = [];
    const currentTimeSlot = this.getCurrentTimeSlot(now);

    if (efficiencyData.peakHours.includes(currentHour)) {
      timeBasedSuggestions.push(i18next.t("scheduler.taskRecommendation.peakHourSuggestImportantTask"));
    } else if (efficiencyData.lowHours.includes(currentHour)) {
      timeBasedSuggestions.push(i18next.t("scheduler.taskRecommendation.lowHourSuggestSimpleTask"));
    }

    const config = TIME_SLOT_CONFIG[currentTimeSlot.type];
    if (config) {
      timeBasedSuggestions.push(
        i18next.t("scheduler.taskRecommendation.timeSlotSuitableFor", { label: config.label, types: config.recommendedTypes.join("、") }),
      );
    }

    const efficiencyTips: string[] = [];

    const bestQueue = Object.entries(efficiencyData.queueEfficiency).sort(
      ([, a], [, b]) => b.completionRate - a.completionRate,
    )[0];
    if (bestQueue && bestQueue[1].completionRate > 0.7) {
      efficiencyTips.push(
        i18next.t("scheduler.taskRecommendation.queueHighestCompletionRate", { queue: bestQueue[0], rate: Math.round(bestQueue[1].completionRate * 100) }),
      );
    }

    const bestTags = Object.entries(efficiencyData.tagEfficiency)
      .filter(([, data]) => data.completionRate > 0.6)
      .sort(([, a], [, b]) => b.completionRate - a.completionRate)
      .slice(0, 3);

    if (bestTags.length > 0) {
      efficiencyTips.push(
        i18next.t("scheduler.taskRecommendation.performWellInTags", { tags: bestTags.map(([tag]) => tag).join("、") }),
      );
    }

    if (efficiencyData.peakHours.length > 0) {
      const formatHour = (h: number) => `${h}:00`;
      efficiencyTips.push(
        i18next.t("scheduler.taskRecommendation.peakHoursList", { hours: efficiencyData.peakHours.map(formatHour).join("、") }),
      );
    }

    return {
      topTasks,
      timeBasedSuggestions,
      efficiencyTips,
    };
  }

  calculateOptimalTaskOrder(
    tasks: UserTask[],
    efficiencyData: EfficiencyData,
    now: Date = new Date(),
  ): UserTask[] {
    // 预构建 Set 与小时值，替代 map 内层对 peakHours/lowHours 的 O(n) includes 扫描
    const peakHourSet = new Set(efficiencyData.peakHours);
    const lowHourSet = new Set(efficiencyData.lowHours);
    const currentHour = now.getHours();

    const scoredTasks = tasks.map((task) => {
      let score = 0;

      const urgencyScore = this.calculateUrgencyScore(task, now);
      score += urgencyScore * 0.4;

      if (task.tags && task.tags.length > 0) {
        const avgTagEfficiency =
          task.tags
            .map(
              (tag) => efficiencyData.tagEfficiency[tag]?.completionRate || 0.5,
            )
            .reduce((a, b) => a + b, 0) / task.tags.length;
        score += avgTagEfficiency * 20;
      }

      const queueEfficiency = efficiencyData.queueEfficiency[task.queue_level];
      if (queueEfficiency) {
        score += queueEfficiency.completionRate * 10;
      }

      if (
        peakHourSet.has(currentHour) &&
        task.priority >= 3
      ) {
        score += 15;
      } else if (
        lowHourSet.has(currentHour) &&
        task.priority < 3
      ) {
        score += 10;
      }

      return { task, score };
    });

    return scoredTasks
      .sort((a, b) => b.score - a.score)
      .map((item) => item.task);
  }

  async checkTaskDependencies(
    client: SupabaseClient,
    taskId: string,
    _userId: string,
  ): Promise<{
    canStart: boolean;
    blockedBy: Array<{ id: string; title: string; status: string }>;
    softBlockedBy: Array<{ id: string; title: string; status: string }>;
  }> {
    const { data: dependencies, error } = await client
      .from("task_dependencies")
      .select(
        `
        dependency_type,
        depends_on_task_id,
        user_tasks!task_dependencies_depends_on_task_id_fkey(id, title, status)
      `,
      )
      .eq("task_id", taskId);

    if (error || !dependencies) {
      return { canStart: true, blockedBy: [], softBlockedBy: [] };
    }

    const blockedBy: Array<{ id: string; title: string; status: string }> = [];
    const softBlockedBy: Array<{ id: string; title: string; status: string }> =
      [];

    for (const dep of dependencies) {
      const taskData = Array.isArray(dep.user_tasks)
        ? dep.user_tasks[0]
        : dep.user_tasks;
      if (taskData && taskData.status !== "completed") {
        const taskItem = {
          id: taskData.id,
          title: taskData.title,
          status: taskData.status,
        };
        if (dep.dependency_type === "strict") {
          blockedBy.push(taskItem);
        } else {
          softBlockedBy.push(taskItem);
        }
      }
    }

    return {
      canStart: blockedBy.length === 0,
      blockedBy,
      softBlockedBy,
    };
  }

  async getSmartRecommendation(
    client: SupabaseClient,
    userId: string,
    context?: RecommendationContext,
  ): Promise<{
    recommendedTask: TaskRecommendation | null;
    alternativeTasks: TaskRecommendation[];
    reasons: string[];
    currentContext: {
      timeSlot: TimeSlot;
      isPeakHour: boolean;
      efficiencyLevel: "high" | "medium" | "low";
    };
  }> {
    const now = context?.currentTime || new Date();
    const recommendations = await this.getTaskRecommendations(
      client,
      userId,
      context,
    );
    const efficiencyData = await this.calculateEfficiencyData(client, userId);
    const currentTimeSlot = this.getCurrentTimeSlot(now);
    const currentHour = now.getHours();

    const isPeakHour = efficiencyData.peakHours.includes(currentHour);
    const efficiencyLevel: "high" | "medium" | "low" = isPeakHour
      ? "high"
      : efficiencyData.lowHours.includes(currentHour)
        ? "low"
        : "medium";

    const reasons: string[] = [];
    let recommendedTask: TaskRecommendation | null = null;
    const alternativeTasks: TaskRecommendation[] = [];

    for (const rec of recommendations) {
      const depCheck = await this.checkTaskDependencies(
        client,
        rec.task.id,
        userId,
      );

      if (!depCheck.canStart) {
        rec.reasons.push(
          i18next.t("scheduler.taskRecommendation.blockedByTask", { title: depCheck.blockedBy[0].title }),
        );
        rec.score *= 0.3;
        alternativeTasks.push(rec);
        continue;
      }

      if (depCheck.softBlockedBy.length > 0) {
        rec.reasons.push(
          i18next.t("scheduler.taskRecommendation.suggestCompleteFirst", { title: depCheck.softBlockedBy[0].title }),
        );
        rec.score *= 0.8;
      }

      if (!recommendedTask) {
        recommendedTask = rec;
      } else {
        alternativeTasks.push(rec);
      }
    }

    if (recommendedTask) {
      // 查询该任务的子任务信息
      const { data: subtasks } = await client
        .from("task_subtasks")
        .select(
          "id, title, status, learning_state, position, estimated_duration, knowledge_points(mastery_level)",
        )
        .eq("task_id", recommendedTask.task.id)
        .order("position", { ascending: true });

      const pendingSubtasks =
        subtasks?.filter((s) => s.status !== "completed") || [];
      const completedSubtasks =
        subtasks?.filter((s) => s.status === "completed") || [];

      // 附加到 task 对象上
      recommendedTask.task.nextSubtask =
        pendingSubtasks.length > 0
          ? {
              id: pendingSubtasks[0].id,
              title: pendingSubtasks[0].title,
              learning_state: pendingSubtasks[0].learning_state,
              mastery_level:
                (
                  pendingSubtasks[0] as {
                    knowledge_points?: { mastery_level: number | null }[] | null;
                  }
                ).knowledge_points?.[0]?.mastery_level ?? 0,
              position: pendingSubtasks[0].position,
              estimated_duration: pendingSubtasks[0].estimated_duration,
            }
          : null;

      recommendedTask.task.subtaskProgress =
        subtasks && subtasks.length > 0
          ? {
              total: subtasks.length,
              completed: completedSubtasks.length,
            }
          : null;

      reasons.push(
        ...this.generateRecommendationReasons(
          recommendedTask,
          currentTimeSlot,
          isPeakHour,
          efficiencyData,
        ),
      );
    }

    return {
      recommendedTask,
      alternativeTasks: alternativeTasks.slice(0, 3),
      reasons,
      currentContext: {
        timeSlot: currentTimeSlot,
        isPeakHour,
        efficiencyLevel,
      },
    };
  }

  private generateRecommendationReasons(
    recommendation: TaskRecommendation,
    timeSlot: TimeSlot,
    isPeakHour: boolean,
    efficiencyData: EfficiencyData,
  ): string[] {
    const reasons: string[] = [];
    const task = recommendation.task;

    if (recommendation.urgencyLevel === "critical") {
      reasons.push(i18next.t("scheduler.taskRecommendation.urgentTaskHandleNow"));
    } else if (recommendation.urgencyLevel === "high") {
      reasons.push(i18next.t("scheduler.taskRecommendation.highPriorityTaskShort"));
    }

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const hoursUntil = Math.round(
        (deadline.getTime() - Date.now()) / (1000 * 60 * 60),
      );
      if (hoursUntil > 0) {
        if (hoursUntil < 24) {
          reasons.push(
            i18next.t("scheduler.taskRecommendation.deadlineTodayTime", { time: `${deadline.getHours()}:${String(deadline.getMinutes()).padStart(2, "0")}` }),
          );
        } else {
          reasons.push(i18next.t("scheduler.taskRecommendation.deadlineDate", { date: deadline.toLocaleDateString("zh-CN") }));
        }
      }
    }

    const config = TIME_SLOT_CONFIG[timeSlot.type];
    if (task.tags && task.tags.length > 0) {
      const matchingTags = task.tags.filter((tag) =>
        config.recommendedTypes.includes(tag),
      );
      if (matchingTags.length > 0) {
        reasons.push(
          i18next.t("scheduler.taskRecommendation.suitableForTimeSlot", { label: timeSlot.label, tags: matchingTags.join("、") }),
        );
      }
    }

    if (isPeakHour && task.priority >= 3) {
      reasons.push(i18next.t("scheduler.taskRecommendation.peakHourForImportantTask"));
    }

    if (task.estimated_duration) {
      const duration = task.estimated_duration;
      if (duration <= 30) {
        reasons.push(i18next.t("scheduler.taskRecommendation.estimatedDurationQuick", { duration }));
      } else if (duration <= 60) {
        reasons.push(i18next.t("scheduler.taskRecommendation.estimatedDurationMinutes", { duration }));
      } else {
        reasons.push(i18next.t("scheduler.taskRecommendation.estimatedDurationHours", { hours: Math.round(duration / 60) }));
      }
    }

    if (task.tags && task.tags.length > 0) {
      const tagEfficiencies = task.tags
        .map((tag) => efficiencyData.tagEfficiency[tag]?.completionRate)
        .filter(Boolean);

      if (tagEfficiencies.length > 0) {
        const avgRate =
          tagEfficiencies.reduce((a, b) => a + b, 0) / tagEfficiencies.length;
        if (avgRate > 0.7) {
          reasons.push(i18next.t("scheduler.taskRecommendation.excellentPerformance"));
        }
      }
    }

    return reasons;
  }

  calculateDynamicPriority(
    task: UserTask,
    now: Date = new Date(),
  ): {
    score: number;
    factors: Array<{ name: string; impact: number; description: string }>;
  } {
    const factors: Array<{
      name: string;
      impact: number;
      description: string;
    }> = [];
    let totalScore = 50;

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const hoursUntil =
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < 0) {
        totalScore += 40;
        factors.push({
          name: i18next.t("scheduler.taskRecommendation.factorOverdue"),
          impact: 40,
          description: i18next.t("scheduler.taskRecommendation.factorOverdueDesc"),
        });
      } else if (hoursUntil < 4) {
        totalScore += 35;
        factors.push({
          name: i18next.t("scheduler.taskRecommendation.factorDueSoon"),
          impact: 35,
          description: i18next.t("scheduler.taskRecommendation.factorDueSoonDesc", { hours: Math.round(hoursUntil) }),
        });
      } else if (hoursUntil < 24) {
        totalScore += 25;
        factors.push({
          name: i18next.t("scheduler.taskRecommendation.factorDueToday"),
          impact: 25,
          description: i18next.t("scheduler.taskRecommendation.factorDueTodayDesc"),
        });
      } else if (hoursUntil < 72) {
        totalScore += 15;
        factors.push({
          name: i18next.t("scheduler.taskRecommendation.factorDueSoonish"),
          impact: 15,
          description: i18next.t("scheduler.taskRecommendation.factorDueSoonishDesc", { days: Math.round(hoursUntil / 24) }),
        });
      }
    }

    const priorityImpact = (task.priority || 1) * 8;
    totalScore += priorityImpact;
    factors.push({
      name: i18next.t("scheduler.taskRecommendation.factorPriority"),
      impact: priorityImpact,
      description: i18next.t("scheduler.taskRecommendation.factorPriorityDesc", { priority: task.priority }),
    });

    const queueImpact = (3 - task.queue_level) * 5;
    totalScore += queueImpact;
    factors.push({
      name: i18next.t("scheduler.taskRecommendation.factorQueue"),
      impact: queueImpact,
      description: i18next.t("scheduler.taskRecommendation.factorQueueDesc", { queue: task.queue_level }),
    });

    if (task.estimated_duration && task.estimated_duration <= 30) {
      totalScore += 10;
      factors.push({
        name: i18next.t("scheduler.taskRecommendation.factorQuickTask"),
        impact: 10,
        description: i18next.t("scheduler.taskRecommendation.factorQuickTaskDesc"),
      });
    }

    return {
      score: Math.min(100, Math.max(0, totalScore)),
      factors,
    };
  }

  async getTaskById(
    client: SupabaseClient,
    taskId: string,
    userId: string,
  ): Promise<UserTask | null> {
    const { data: task, error } = await notDeleted(client
      .from("user_tasks")
      .select("*")
      .eq("id", taskId)
      .eq("user_id", userId)
      )
      .single();

    if (error || !task) return null;
    return task as UserTask;
  }
}

export const taskRecommendationService = new TaskRecommendationService();
