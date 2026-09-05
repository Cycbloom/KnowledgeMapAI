import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { LearningPathService, LearningPathNode, LearningPlan } from "./learningPathService";
import { topologicalSortNodes } from "./learningPathAlgorithms";
import i18next from "i18next";

export class LearningPathDailyPlan {
  private learningPathService: LearningPathService;

  constructor(learningPathService: LearningPathService) {
    this.learningPathService = learningPathService;
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
    const { data: path, error: pathError } = await supabase
      .from("learning_paths")
      .select("id, daily_minutes_target")
      .eq("id", pathId)
      .eq("user_id", userId)
      .single();

    if (pathError || !path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { data, error } = await supabase
      .from("learning_path_progress")
      .upsert(
        {
          user_id: userId,
          path_id: pathId,
          node_id: input.planned_nodes[0],
          started_at: input.plan_date,
          planned_nodes: input.planned_nodes,
          planned_duration: input.planned_duration || path.daily_minutes_target,
          notes: input.notes || null,
          status: "pending",
          progress_percentage: 0,
          time_spent: 0,
        },
        { onConflict: "user_id,path_id,node_id" },
      )
      .select()
      .single();

    if (error) {
      logger.error("createDailyPlan error:", error);
      throw error;
    }

    return data;
  }

  async getDailyPlan(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    planDate: string,
  ): Promise<LearningPlan | null> {
    // 统一日计划（P1）：优先由排期表（learning_path_schedule）派生；
    // 当日无排期时回退到手动计划行（learning_path_progress）
    const schedulePlan = await this.getSchedulePlanForDate(
      supabase,
      pathId,
      userId,
      planDate,
    );
    if (schedulePlan) return schedulePlan;

    const { data, error } = await supabase
      .from("learning_path_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .gte("started_at", `${planDate}T00:00:00Z`)
      .lt("started_at", `${planDate}T23:59:59Z`)
      .maybeSingle();

    if (error) {
      logger.error("getDailyPlan error:", error);
      throw error;
    }

    return data;
  }

  async getDailyPlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<LearningPlan[]> {
    let query = supabase
      .from("learning_path_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("path_id", pathId)
      .order("started_at", { ascending: true });

    if (startDate) {
      query = query.gte("started_at", startDate);
    }
    if (endDate) {
      query = query.lte("started_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("getDailyPlans error:", error);
      throw error;
    }

    // 统一日计划（P1）：排期表是日历的事实源；有排期的日期以排期派生计划为准，
    // 手动计划行仅覆盖没有排期的日期
    const schedulePlans = await this.getSchedulePlans(
      supabase,
      pathId,
      userId,
      startDate,
      endDate,
    );
    const scheduleDates = new Set(schedulePlans.map((p) => p.started_at));
    const manualPlans = (data || []).filter(
      (p: LearningPlan) =>
        Array.isArray(p.planned_nodes) &&
        p.planned_nodes.length > 0 &&
        !scheduleDates.has(p.started_at),
    );

    return [...schedulePlans, ...manualPlans].sort((a, b) =>
      (a.started_at ?? "").localeCompare(b.started_at ?? ""),
    );
  }

  /** 从排期表构建某日期的派生日计划（无排期返回 null） */
  private async getSchedulePlanForDate(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    planDate: string,
  ): Promise<LearningPlan | null> {
    const plans = await this.getSchedulePlans(
      supabase,
      pathId,
      userId,
      planDate,
      planDate,
    );
    return plans[0] ?? null;
  }

  /**
   * 从 learning_path_schedule 派生日计划列表。
   * 排期主体是知识点（跨路径合并），这里把知识点映射回本路径的节点 id；
   * 只统计本路径发起或参与的排期（path_id 或 source_path_ids 命中）。
   */
  private async getSchedulePlans(
    supabase: SupabaseClient,
    pathId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<LearningPlan[]> {
    let query = supabase
      .from("learning_path_schedule")
      .select("id, knowledge_point_id, scheduled_date, estimated_time, status")
      .eq("user_id", userId)
      .in("status", ["scheduled", "completed"])
      .or(`path_id.eq.${pathId},source_path_ids.cs.{${pathId}}`)
      .order("scheduled_date", { ascending: true });

    if (startDate) {
      query = query.gte("scheduled_date", startDate);
    }
    if (endDate) {
      query = query.lte("scheduled_date", endDate);
    }

    const { data: scheduleRows, error } = await query;
    if (error) {
      logger.warn("getSchedulePlans error:", { error: error.message });
      return [];
    }
    if (!scheduleRows || scheduleRows.length === 0) return [];

    // 知识点 → 本路径节点 id 映射（同一知识点可能对应多个节点，全部纳入）
    const { data: nodes, error: nodesError } = await supabase
      .from("learning_path_nodes")
      .select("id, knowledge_point_id")
      .eq("path_id", pathId);
    if (nodesError) {
      logger.warn("getSchedulePlans nodes error:", { error: nodesError.message });
    }
    const nodesByKp = new Map<string, string[]>();
    for (const n of nodes ?? []) {
      if (!n.knowledge_point_id) continue;
      const list = nodesByKp.get(n.knowledge_point_id) ?? [];
      list.push(n.id as string);
      nodesByKp.set(n.knowledge_point_id, list);
    }

    const byDate = new Map<string, typeof scheduleRows>();
    for (const row of scheduleRows) {
      const date = row.scheduled_date as string;
      const list = byDate.get(date) ?? [];
      list.push(row);
      byDate.set(date, list);
    }

    const now = new Date().toISOString();
    const plans: LearningPlan[] = [];
    for (const [date, rows] of byDate) {
      const nodeIds = rows.flatMap((r) => {
        const kpId = r.knowledge_point_id as string;
        return nodesByKp.get(kpId) ?? [kpId];
      });
      const allCompleted = rows.every((r) => r.status === "completed");
      plans.push({
        id: `schedule-${pathId}-${date}`,
        user_id: userId,
        path_id: pathId,
        node_id: nodeIds[0],
        status: allCompleted ? "completed" : "pending",
        progress_percentage: 0,
        time_spent: 0,
        planned_nodes: nodeIds,
        planned_duration: rows.reduce(
          (sum, r) => sum + (Number(r.estimated_time) || 0),
          0,
        ),
        started_at: date,
        created_at: now,
        updated_at: now,
      });
    }
    return plans;
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
    const { data: plan, error: checkError } = await supabase
      .from("learning_path_progress")
      .select("id, path_id")
      .eq("id", planId)
      .eq("user_id", userId)
      .single();

    if (checkError || !plan) {
      throw new AppError(i18next.t("learningPath.api.errors.planNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const updateData: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("learning_path_progress")
      .update(updateData)
      .eq("id", planId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error("updatePlanStatus error:", error);
      throw error;
    }

    return data;
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
    const path = await this.learningPathService.getLearningPath(supabase, pathId, userId);

    if (!path) {
      throw new AppError(i18next.t("learningPath.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (!path.target_date) {
      throw new AppError(
        i18next.t("learningPath.api.errors.targetDateRequired"),
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const nodes = path.nodes || [];
    if (nodes.length === 0) {
      return [];
    }

    const startDate = options?.start_date
      ? new Date(options.start_date)
      : new Date();
    startDate.setHours(0, 0, 0, 0);

    const targetDate = new Date(path.target_date);
    const daysUntilTarget = Math.ceil(
      (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilTarget <= 0) {
      throw new AppError(
        i18next.t("learningPath.api.errors.targetDatePassed"),
        400,
        ErrorCodes.VALIDATION_ERROR,
      );
    }

    const pendingNodes = nodes.filter(
      (n) => n.status === "pending" || n.status === "in_progress",
    );

    if (pendingNodes.length === 0) {
      return [];
    }

    let orderedNodes: LearningPathNode[];
    if (options?.respect_prerequisites !== false) {
      orderedNodes = topologicalSortNodes(pendingNodes);
    } else {
      orderedNodes = [...pendingNodes].sort(
        (a, b) => a.order_index - b.order_index,
      );
    }

    const dailyMinutesTarget = path.daily_minutes_target || 180;
    const plans: LearningPlan[] = [];
    const nodeQueue = [...orderedNodes];
    const now = new Date().toISOString();

    for (let day = 0; day < daysUntilTarget && nodeQueue.length > 0; day++) {
      const planDate = new Date(startDate);
      planDate.setDate(planDate.getDate() + day);
      const planDateStr = planDate.toISOString().split("T")[0];

      const plannedNodesForDay: string[] = [];
      let plannedDuration = 0;

      while (nodeQueue.length > 0) {
        const node = nodeQueue[0];
        const nodeTime = node.estimated_time || 30;

        if (plannedDuration + nodeTime <= dailyMinutesTarget) {
          plannedNodesForDay.push(node.id);
          plannedDuration += nodeTime;
          nodeQueue.shift();
        } else {
          break;
        }
      }

      if (plannedNodesForDay.length > 0) {
        plans.push({
          id: "",
          user_id: userId,
          path_id: pathId,
          node_id: plannedNodesForDay[0],
          status: "pending",
          progress_percentage: 0,
          time_spent: 0,
          planned_nodes: plannedNodesForDay,
          planned_duration: plannedDuration,
          started_at: planDateStr,
          created_at: now,
          updated_at: now,
        });
      }
    }

    if (plans.length > 0) {
      const plansToInsert = plans.map((p) => ({
        user_id: p.user_id,
        path_id: p.path_id,
        node_id: p.node_id,
        started_at: p.started_at,
        planned_nodes: p.planned_nodes,
        planned_duration: p.planned_duration,
        status: p.status,
        progress_percentage: p.progress_percentage,
        time_spent: p.time_spent,
      }));

      const { data: insertedPlans, error: insertError } = await supabase
        .from("learning_path_progress")
        .upsert(plansToInsert, { onConflict: "user_id,path_id,node_id" })
        .select();

      if (insertError) {
        logger.error("generateDailyPlans insert error:", insertError);
        throw insertError;
      }

      return (insertedPlans || []) as LearningPlan[];
    }

    return [];
  }
}
