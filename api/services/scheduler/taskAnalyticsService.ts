import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { notDeleted } from '../common/softDeleteHelper';

interface UserTaskRow {
  status: string;
  completed_at: string | null;
  created_at: string;
  queue_level: number;
  tags: string[] | null;
  priority: number;
  deadline: string | null;
}

interface TaskExecutionRow {
  duration: number | null;
  started_at: string | null;
}

interface TaskAnalytics {
  overview: {
    todayCompleted: number;
    weekCompleted: number;
    monthCompleted: number;
    avgDuration: number;
    totalTasks: number;
    completionRate: number;
  };
  completionTrend: Array<{
    date: string;
    completed: number;
    total: number;
    cumulative: number;
  }>;
  timeDistribution: Array<{
    day: number;
    hour: number;
    value: number;
  }>;
  queueStats: Array<{
    queueLevel: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgDuration: number;
  }>;
  tagStats: Array<{
    tag: string;
    count: number;
    completedCount: number;
    completionRate: number;
  }>;
  priorityStats: Array<{
    priority: number;
    label: string;
    count: number;
    completedCount: number;
    completionRate: number;
    avgDelay: number;
  }>;
  comparison: {
    previousPeriod: {
      completed: number;
      completionRate: number;
      avgDuration: number;
    };
    change: {
      completedChange: number;
      completionRateChange: number;
      avgDurationChange: number;
    };
  };
}

interface Insight {
  type: "positive" | "negative" | "neutral";
  title: string;
  description: string;
  recommendation?: string;
}

export class TaskAnalyticsService {
  async getAnalytics(
    client: SupabaseClient,
    userId: string,
  ): Promise<TaskAnalytics> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const { data: tasks } = await notDeleted(client
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      );

    const { data: executions } = await client
      .from("task_executions")
      .select("*")
      .eq("user_id", userId);

    const allTasks = tasks || [];
    const allExecutions = executions || [];

    const completedTasks = allTasks.filter((t) => t.status === "completed");

    // 单趟遍历同时统计三档，避免 3 次 O(n) filter
    let todayCompleted = 0;
    let weekCompleted = 0;
    let monthCompleted = 0;
    for (const t of completedTasks) {
      const completedAt = new Date(t.completed_at);
      if (completedAt >= today) todayCompleted++;
      if (completedAt >= weekAgo) weekCompleted++;
      if (completedAt >= monthAgo) monthCompleted++;
    }

    const durations = allExecutions
      .filter((e) => e.duration)
      .map((e) => e.duration);
    const avgDuration =
      durations.length > 0
        ? Math.round(
            durations.reduce((a, b) => a + b, 0) / durations.length / 60,
          )
        : 0;

    const completionRate =
      allTasks.length > 0
        ? Math.round((completedTasks.length / allTasks.length) * 100)
        : 0;

    const completionTrend = this.calculateCompletionTrend(allTasks, 30);

    const timeDistribution = this.calculateTimeDistribution(allExecutions);

    const queueStats = this.calculateQueueStats(allTasks);

    const tagStats = this.calculateTagStats(allTasks);

    const priorityStats = this.calculatePriorityStats(allTasks);

    const comparison = await this.calculateComparison(
      client,
      userId,
      allTasks,
      weekAgo,
    );

    return {
      overview: {
        todayCompleted,
        weekCompleted,
        monthCompleted,
        avgDuration,
        totalTasks: allTasks.length,
        completionRate,
      },
      completionTrend,
      timeDistribution,
      queueStats,
      tagStats,
      priorityStats,
      comparison,
    };
  }

  private calculateCompletionTrend(tasks: UserTaskRow[], days: number) {
    const trend: Array<{
      date: string;
      completed: number;
      total: number;
      cumulative: number;
    }> = [];
    const now = new Date();
    let cumulative = 0;

    // 预建日期索引，将内层 O(days) 的按天 filter 降为 O(1) 查询
    const createdByDate = new Map<string, number>();
    const completedByDate = new Map<string, number>();
    for (const t of tasks) {
      const createdDate = new Date(t.created_at).toISOString().split("T")[0];
      createdByDate.set(createdDate, (createdByDate.get(createdDate) || 0) + 1);
      if (t.status === "completed" && t.completed_at) {
        const completedDate = new Date(t.completed_at)
          .toISOString()
          .split("T")[0];
        completedByDate.set(
          completedDate,
          (completedByDate.get(completedDate) || 0) + 1,
        );
      }
    }

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const dayCompleted = completedByDate.get(dateStr) || 0;
      cumulative += dayCompleted;

      trend.push({
        date: dateStr,
        completed: dayCompleted,
        total: createdByDate.get(dateStr) || 0,
        cumulative,
      });
    }

    return trend;
  }

  private calculateTimeDistribution(executions: TaskExecutionRow[]) {
    const distribution: Array<{ day: number; hour: number; value: number }> =
      [];
    const map: Record<string, number> = {};

    executions.forEach((e) => {
      if (!e.started_at) return;
      const date = new Date(e.started_at);
      const day = date.getDay();
      const hour = date.getHours();
      const key = `${day === 0 ? 6 : day - 1}-${hour}`;
      map[key] = (map[key] || 0) + 1;
    });

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        distribution.push({
          day,
          hour,
          value: map[key] || 0,
        });
      }
    }

    return distribution;
  }

  private calculateQueueStats(tasks: UserTaskRow[]) {
    const stats: Array<{
      queueLevel: number;
      totalTasks: number;
      completedTasks: number;
      completionRate: number;
      avgDuration: number;
    }> = [];

    // 单趟分组统计，避免每个队列各 filter 一次（O(3×n) → O(n)）
    const counts: Array<{ total: number; completed: number }> = [
      { total: 0, completed: 0 },
      { total: 0, completed: 0 },
      { total: 0, completed: 0 },
    ];
    for (const t of tasks) {
      if (t.queue_level >= 0 && t.queue_level <= 2) {
        counts[t.queue_level].total++;
        if (t.status === "completed") counts[t.queue_level].completed++;
      }
    }

    for (let level = 0; level <= 2; level++) {
      const c = counts[level];
      stats.push({
        queueLevel: level,
        totalTasks: c.total,
        completedTasks: c.completed,
        completionRate:
          c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
        avgDuration: 0,
      });
    }

    return stats;
  }

  private calculateTagStats(tasks: UserTaskRow[]) {
    const tagMap: Record<string, { count: number; completed: number }> = {};

    tasks.forEach((task) => {
      const tags = task.tags || [];
      tags.forEach((tag: string) => {
        if (!tagMap[tag]) {
          tagMap[tag] = { count: 0, completed: 0 };
        }
        tagMap[tag].count++;
        if (task.status === "completed") {
          tagMap[tag].completed++;
        }
      });
    });

    return Object.entries(tagMap)
      .map(([tag, data]) => ({
        tag,
        count: data.count,
        completedCount: data.completed,
        completionRate: Math.round((data.completed / data.count) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculatePriorityStats(tasks: UserTaskRow[]) {
    const priorityLabels = [
      i18next.t("scheduler.taskAnalytics.priorityLow"),
      i18next.t("scheduler.taskAnalytics.priorityMedium"),
      i18next.t("scheduler.taskAnalytics.priorityHigh"),
      i18next.t("scheduler.taskAnalytics.priorityUrgent"),
    ];
    const stats: Array<{
      priority: number;
      label: string;
      count: number;
      completedCount: number;
      completionRate: number;
      avgDelay: number;
    }> = [];

    // 单趟分组统计，避免每个优先级各 filter 两次（O(4×n) → O(n)）
    const buckets: Array<{
      count: number;
      completed: number;
      totalDelay: number;
      delayCount: number;
    }> = [
      { count: 0, completed: 0, totalDelay: 0, delayCount: 0 },
      { count: 0, completed: 0, totalDelay: 0, delayCount: 0 },
      { count: 0, completed: 0, totalDelay: 0, delayCount: 0 },
      { count: 0, completed: 0, totalDelay: 0, delayCount: 0 },
    ];

    for (const task of tasks) {
      if (task.priority < 1 || task.priority > 4) continue;
      const bucket = buckets[task.priority - 1];
      bucket.count++;
      if (task.status !== "completed") continue;
      bucket.completed++;
      if (task.deadline && task.completed_at) {
        const deadline = new Date(task.deadline);
        const completedAt = new Date(task.completed_at);
        const delay =
          (completedAt.getTime() - deadline.getTime()) / (1000 * 60 * 60);
        if (delay > 0) {
          bucket.totalDelay += delay;
          bucket.delayCount++;
        }
      }
    }

    for (let p = 1; p <= 4; p++) {
      const bucket = buckets[p - 1];
      stats.push({
        priority: p,
        label: priorityLabels[p - 1],
        count: bucket.count,
        completedCount: bucket.completed,
        completionRate:
          bucket.count > 0
            ? Math.round((bucket.completed / bucket.count) * 100)
            : 0,
        avgDelay:
          bucket.delayCount > 0
            ? Math.round(bucket.totalDelay / bucket.delayCount)
            : 0,
      });
    }

    return stats;
  }

  private async calculateComparison(
    _client: SupabaseClient,
    _userId: string,
    currentTasks: UserTaskRow[],
    weekAgo: Date,
  ) {
    const twoWeeksAgo = new Date(weekAgo);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);

    const previousCompleted = currentTasks.filter((t) => {
      if (t.status !== "completed" || !t.completed_at) return false;
      const completedAt = new Date(t.completed_at);
      return completedAt >= twoWeeksAgo && completedAt < weekAgo;
    });

    const currentCompleted = currentTasks.filter((t) => {
      if (t.status !== "completed" || !t.completed_at) return false;
      return new Date(t.completed_at) >= weekAgo;
    });

    const previousCount = previousCompleted.length || 1;
    const currentCount = currentCompleted.length || 1;

    const completedChange =
      previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 100)
        : 0;

    return {
      previousPeriod: {
        completed: previousCount,
        completionRate: 0,
        avgDuration: 0,
      },
      change: {
        completedChange,
        completionRateChange: 0,
        avgDurationChange: 0,
      },
    };
  }

  async generateInsights(
    client: SupabaseClient,
    userId: string,
  ): Promise<Insight[]> {
    const analytics = await this.getAnalytics(client, userId);
    const insights: Insight[] = [];

    if (analytics.overview.completionRate >= 80) {
      insights.push({
        type: "positive",
        title: i18next.t("scheduler.taskAnalytics.insightCompletionRateExcellent"),
        description: i18next.t("scheduler.taskAnalytics.insightCompletionRateExcellentDesc", { rate: analytics.overview.completionRate }),
        recommendation: i18next.t("scheduler.taskAnalytics.insightCompletionRateExcellentRec"),
      });
    } else if (analytics.overview.completionRate < 50) {
      insights.push({
        type: "negative",
        title: i18next.t("scheduler.taskAnalytics.insightCompletionRateLow"),
        description: i18next.t("scheduler.taskAnalytics.insightCompletionRateLowDesc", { rate: analytics.overview.completionRate }),
        recommendation: i18next.t("scheduler.taskAnalytics.insightCompletionRateLowRec"),
      });
    }

    const peakHours = this.findPeakHours(analytics.timeDistribution);
    if (peakHours.length > 0) {
      insights.push({
        type: "neutral",
        title: i18next.t("scheduler.taskAnalytics.insightPeakHours"),
        description: i18next.t("scheduler.taskAnalytics.insightPeakHoursDesc", { hours: peakHours.map((h) => `${h}:00`).join("、") }),
        recommendation: i18next.t("scheduler.taskAnalytics.insightPeakHoursRec"),
      });
    }

    const bestQueue = analytics.queueStats.reduce((best, q) =>
      q.completionRate > best.completionRate ? q : best,
    );
    if (bestQueue.completionRate > 0) {
      insights.push({
        type: "positive",
        title: i18next.t("scheduler.taskAnalytics.insightQueueEfficiency", { queue: bestQueue.queueLevel }),
        description: i18next.t("scheduler.taskAnalytics.insightQueueEfficiencyDesc", { rate: bestQueue.completionRate }),
        recommendation:
          bestQueue.queueLevel === 0
            ? i18next.t("scheduler.taskAnalytics.insightQueueEfficiencyRec")
            : undefined,
      });
    }

    const highPriorityTasks = analytics.priorityStats.find(
      (p) => p.priority === 4,
    );

    if (highPriorityTasks && highPriorityTasks.completionRate < 70) {
      insights.push({
        type: "negative",
        title: i18next.t("scheduler.taskAnalytics.insightUrgentCompletionLow"),
        description: i18next.t("scheduler.taskAnalytics.insightUrgentCompletionLowDesc", { rate: highPriorityTasks.completionRate }),
        recommendation: i18next.t("scheduler.taskAnalytics.insightUrgentCompletionLowRec"),
      });
    }

    if (analytics.tagStats.length > 0) {
      const bestTag = analytics.tagStats[0];
      if (bestTag.completionRate >= 70) {
        insights.push({
          type: "positive",
          title: i18next.t("scheduler.taskAnalytics.insightTagExcellent", { tag: bestTag.tag }),
          description: i18next.t("scheduler.taskAnalytics.insightTagExcellentDesc", { rate: bestTag.completionRate }),
        });
      }

      const worstTag = analytics.tagStats[analytics.tagStats.length - 1];
      if (worstTag.completionRate < 50) {
        insights.push({
          type: "negative",
          title: i18next.t("scheduler.taskAnalytics.insightTagNeedsAttention", { tag: worstTag.tag }),
          description: i18next.t("scheduler.taskAnalytics.insightTagNeedsAttentionDesc", { rate: worstTag.completionRate }),
          recommendation: i18next.t("scheduler.taskAnalytics.insightTagNeedsAttentionRec"),
        });
      }
    }

    return insights;
  }

  private findPeakHours(
    distribution: Array<{ day: number; hour: number; value: number }>,
  ): number[] {
    const hourTotals: Record<number, number> = {};

    distribution.forEach((d) => {
      hourTotals[d.hour] = (hourTotals[d.hour] || 0) + d.value;
    });

    const sorted = Object.entries(hourTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return sorted;
  }
}

export const taskAnalyticsService = new TaskAnalyticsService();
