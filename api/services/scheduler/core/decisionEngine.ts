import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { logger } from "../../../utils/logger";
import { efficiencyService } from "../efficiencyService";
import { notDeleted } from '../../common/softDeleteHelper';

interface DecisionFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

interface TaskRecommendation {
  taskId: string;
  title: string;
  queueLevel: number;
  priority: number;
  totalScore: number;
  factors: DecisionFactor[];
  reason: string;
}

interface DecisionContext {
  userId: string;
  currentHour: number;
  userTimeSlots: Array<{
    day_of_week: number | null;
    start_time: string;
    end_time: string;
    is_available: boolean;
  }>;
  efficiencyProfile?: {
    hourly_efficiency: Record<number, number>;
    peak_hours: number[];
    low_hours: number[];
  };
}

class SchedulerDecisionEngine {
  async getRecommendations(
    supabase: SupabaseClient,
    userId: string,
    limit: number = 5,
  ): Promise<TaskRecommendation[]> {
    const context = await this.buildContext(supabase, userId);
    const tasks = await this.getEligibleTasks(supabase, userId);

    if (tasks.length === 0) return [];

    const scored = tasks.map((task) => {
      const factors = this.scoreTask(task, context);
      const totalScore =
        factors.reduce((sum, f) => sum + f.score * f.weight, 0) /
        factors.reduce((sum, f) => sum + f.weight, 0);
      const reason = this.generateReason(factors, task);

      return {
        taskId: task.id as string,
        title: task.title as string,
        queueLevel: (task.queue_level as number) ?? 2,
        priority: (task.priority as number) ?? 0,
        totalScore,
        factors,
        reason,
      };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);

    return scored.slice(0, limit);
  }

  private async buildContext(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<DecisionContext> {
    const currentHour = new Date().getHours();

    const { data: timeSlots } = await supabase
      .from("user_time_slots")
      .select("*")
      .eq("user_id", userId);

    let efficiencyProfile: DecisionContext["efficiencyProfile"];

    try {
      const profile = await efficiencyService.getUserEfficiencyProfile(
        supabase,
        userId,
      );
      if (profile) {
        efficiencyProfile = {
          hourly_efficiency: profile.hourly_efficiency ?? {},
          peak_hours: profile.peak_hours ?? [],
          low_hours: profile.low_hours ?? [],
        };
      }
    } catch (error) {
      logger.error("[DecisionEngine] Failed to get efficiency profile:", error);
    }

    return {
      userId,
      currentHour,
      userTimeSlots: timeSlots ?? [],
      efficiencyProfile,
    };
  }

  private async getEligibleTasks(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<Array<Record<string, unknown>>> {
    const { data: tasks, error } = await notDeleted(supabase
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "paused"])
      )
      .order("priority", { ascending: false })
      .limit(50);

    if (error || !tasks) return [];

    const taskIds = tasks.map((t) => t.id as string);

    // 单次批量查询全部任务依赖，替代逐任务查询 isTaskBlocked（N 次 → 1 次）
    const depsByTaskId = new Map<
      string,
      Array<{
        dependency_type: string;
        depends_on_task: { status?: string } | null;
      }>
    >();
    if (taskIds.length > 0) {
      const { data: allDeps } = await supabase
        .from("task_dependencies")
        .select(
          "task_id, dependency_type, depends_on_task:user_tasks!task_dependencies_depends_on_task_id_fkey(status)",
        )
        .in("task_id", taskIds);

      for (const dep of allDeps ?? []) {
        const list = depsByTaskId.get(dep.task_id) ?? [];
        list.push({
          dependency_type: dep.dependency_type,
          depends_on_task: dep.depends_on_task as { status?: string } | null,
        });
        depsByTaskId.set(dep.task_id, list);
      }
    }

    const eligibleTasks: Array<Record<string, unknown>> = [];
    for (const task of tasks) {
      const deps = depsByTaskId.get(task.id as string) ?? [];
      const blocked = deps.some(
        (dep) =>
          dep.depends_on_task?.status !== "completed" &&
          dep.dependency_type === "strict",
      );
      if (!blocked) {
        eligibleTasks.push(task as Record<string, unknown>);
      }
    }

    return eligibleTasks;
  }

  private scoreTask(
    task: Record<string, unknown>,
    context: DecisionContext,
  ): DecisionFactor[] {
    const factors: DecisionFactor[] = [];

    factors.push(this.scoreUrgency(task));
    factors.push(this.scoreTimeEfficiency(task, context));
    factors.push(this.scoreMastery(task));
    factors.push(this.scoreDependency(task));
    factors.push(this.scoreTaskTypeTimeMatch(task, context));
    factors.push(this.scoreUserAvailability(task, context));

    return factors;
  }

  private scoreUrgency(task: Record<string, unknown>): DecisionFactor {
    const deadline = task.deadline as string | undefined;
    const priority = (task.priority as number) ?? 0;
    const queueLevel = (task.queue_level as number) ?? 2;

    let score = 0;
    const descriptions: string[] = [];

    if (deadline) {
      const hoursUntilDeadline =
        (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilDeadline < 0) {
        score = 100;
        descriptions.push(i18next.t("scheduler.decisionEngine.factorOverdue"));
      } else if (hoursUntilDeadline < 24) {
        score = 80;
        descriptions.push(i18next.t("scheduler.decisionEngine.factorDueSoon"));
      } else if (hoursUntilDeadline < 72) {
        score = 60;
        descriptions.push(i18next.t("scheduler.decisionEngine.factorDueIn3Days"));
      } else {
        score = 30;
      }
    }

    score += priority * 5;
    score += (2 - queueLevel) * 15;

    return {
      name: "urgency",
      weight: 3,
      score: Math.min(100, score),
      description:
        descriptions.join(", ") || i18next.t("scheduler.decisionEngine.factorUrgencyDefault", { priority, queue: queueLevel }),
    };
  }

  private scoreTimeEfficiency(
    task: Record<string, unknown>,
    context: DecisionContext,
  ): DecisionFactor {
    if (!context.efficiencyProfile) {
      return {
        name: "time_efficiency",
        weight: 2,
        score: 50,
        description: i18next.t("scheduler.decisionEngine.noEfficiencyData"),
      };
    }

    const currentHour = context.currentHour;
    const hourlyEff = context.efficiencyProfile.hourly_efficiency;
    const efficiency = hourlyEff[currentHour] ?? 0.5;

    const queueLevel = (task.queue_level as number) ?? 2;
    const isHighPriorityTask = queueLevel === 0;

    let score: number;
    let description: string;

    if (isHighPriorityTask && efficiency > 0.7) {
      score = 90;
      description = i18next.t("scheduler.decisionEngine.peakHourForImportantTask");
    } else if (isHighPriorityTask && efficiency <= 0.7) {
      score = 30;
      description = i18next.t("scheduler.decisionEngine.lowHourNotForImportantTask");
    } else if (!isHighPriorityTask && efficiency <= 0.5) {
      score = 70;
      description = i18next.t("scheduler.decisionEngine.lowHourForSimpleTask");
    } else {
      score = 50;
      description = i18next.t("scheduler.decisionEngine.currentEfficiency", { percent: Math.round(efficiency * 100) });
    }

    return { name: "time_efficiency", weight: 2, score, description };
  }

  private scoreMastery(task: Record<string, unknown>): DecisionFactor {
    const knowledgePointId = task.knowledge_point_id as string | undefined;
    if (!knowledgePointId) {
      return {
        name: "mastery",
        weight: 1,
        score: 50,
        description: i18next.t("scheduler.decisionEngine.noLinkedKnowledgePoint"),
      };
    }

    return { name: "mastery", weight: 2, score: 50, description: i18next.t("scheduler.decisionEngine.hasLinkedKnowledgePoint") };
  }

  private scoreDependency(_task: Record<string, unknown>): DecisionFactor {
    return {
      name: "dependency",
      weight: 1,
      score: 70,
      description: i18next.t("scheduler.decisionEngine.noBlockingDependency"),
    };
  }

  private scoreTaskTypeTimeMatch(
    task: Record<string, unknown>,
    context: DecisionContext,
  ): DecisionFactor {
    const taskType = (task.task_type as string) ?? "one_time";
    const currentHour = context.currentHour;

    const typeTimeMap: Record<
      string,
      { best: number[]; ok: number[] }
    > = {
      learning: {
        best: [9, 10, 11, 14, 15],
        ok: [8, 12, 13, 16],
      },
      one_time: {
        best: [10, 11, 14, 15, 16],
        ok: [9, 12, 13, 17],
      },
      periodic: { best: [8, 9, 17, 18], ok: [10, 16, 19] },
      long_term: {
        best: [9, 10, 11, 14, 15],
        ok: [8, 12, 13, 16],
      },
    };

    const match = typeTimeMap[taskType] ?? typeTimeMap.one_time;

    if (match.best.includes(currentHour)) {
      return {
        name: "task_type_match",
        weight: 1,
        score: 80,
        description: i18next.t("scheduler.decisionEngine.bestTimeSlotForType", { type: taskType }),
      };
    } else if (match.ok.includes(currentHour)) {
      return {
        name: "task_type_match",
        weight: 1,
        score: 50,
        description: i18next.t("scheduler.decisionEngine.okTimeSlotForType", { type: taskType }),
      };
    }

    return {
      name: "task_type_match",
      weight: 1,
      score: 20,
      description: i18next.t("scheduler.decisionEngine.notBestTimeSlot"),
    };
  }

  private scoreUserAvailability(
    _task: Record<string, unknown>,
    context: DecisionContext,
  ): DecisionFactor {
    if (context.userTimeSlots.length === 0) {
      return {
        name: "availability",
        weight: 1,
        score: 50,
        description: i18next.t("scheduler.decisionEngine.noAvailableTimeSlots"),
      };
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const isAvailable = context.userTimeSlots.some((slot) => {
      if (slot.day_of_week !== null && slot.day_of_week !== currentDay)
        {return false;}
      return (
        slot.is_available &&
        currentTime >= slot.start_time &&
        currentTime <= slot.end_time
      );
    });

    if (isAvailable) {
      return {
        name: "availability",
        weight: 2,
        score: 80,
        description: i18next.t("scheduler.decisionEngine.inAvailableTimeSlot"),
      };
    }

    return {
      name: "availability",
      weight: 2,
      score: 10,
      description: i18next.t("scheduler.decisionEngine.notInAvailableTimeSlot"),
    };
  }

  private generateReason(
    factors: DecisionFactor[],
    _task: Record<string, unknown>,
  ): string {
    const topFactors = factors
      .filter((f) => f.score > 50)
      .sort((a, b) => b.score * b.weight - a.score * a.weight)
      .slice(0, 3);

    if (topFactors.length === 0) {
      return i18next.t("scheduler.decisionEngine.recommendExecuteTask");
    }

    return topFactors.map((f) => f.description).join("；");
  }
}

export const schedulerDecisionEngine = new SchedulerDecisionEngine();
export { SchedulerDecisionEngine };
export type {
  TaskRecommendation as DecisionTaskRecommendation,
  DecisionFactor,
  DecisionContext,
};
