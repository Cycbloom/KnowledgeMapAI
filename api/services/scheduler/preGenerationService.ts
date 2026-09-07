import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { getSupabaseAdmin } from "../../supabase";
import { asyncTaskService } from "../asyncTaskService";
import {
  resolveLocalizedText,
  BASE_CONTENT_LANG,
  type LocalizedText,
} from "@shared/utils/localization";

export type PreGenCardDifficulty = "easy" | "medium" | "hard" | "mixed";
export type PreGenCardCoverage =
  | "current_only"
  | "with_children"
  | "with_siblings"
  | "graph";

export interface PreGenerationSettings {
  enabled: boolean;
  lead_days: number;
  max_knowledge_points_per_run: number;
  learning_material: boolean;
  generate_cards: boolean;
  cards_per_knowledge_point: number;
  card_types: string[];
  card_difficulty: PreGenCardDifficulty;
  card_coverage: PreGenCardCoverage;
  languages: string[];
}

export const PRE_GENERATION_DEFAULTS: PreGenerationSettings = {
  enabled: true,
  lead_days: 3,
  max_knowledge_points_per_run: 10,
  learning_material: true,
  generate_cards: true,
  cards_per_knowledge_point: 20,
  card_types: ["qa", "choice", "true_false"],
  card_difficulty: "mixed",
  card_coverage: "current_only",
  languages: ["zh-CN"],
};

const PREGEN_TASK_TYPES = ["generate_learning_material", "generate_questions"] as const;
const ACTIVE_TASK_STATUSES = ["pending", "in_progress", "running", "paused"] as const;

interface UpcomingKnowledgePoint {
  knowledge_point_id: string;
  scheduled_at: string;
}

interface EnqueuedTask {
  knowledge_point_id: string;
  type: string;
  taskId: string;
  language?: string;
}

export interface PreGenerationRunResult {
  enabled: boolean;
  candidatesFound: number;
  knowledgePointsProcessed: number;
  tasksEnqueued: number;
  skipped: {
    materialExists: number;
    cardsExists: number;
    taskInFlight: number;
    noContent: number;
  };
  enqueued: EnqueuedTask[];
}

/**
 * AI 预生成调度服务。
 *
 * 核心思路：借助排课/日历系统的排期（learning_path_schedule 按知识点按日排期、
 * 带 scheduled_start 的关联知识点任务），找出「未来 N 天内要学习」的知识点，
 * 提前为缺失学习资料/题目的知识点入队后台 AI 任务（system_tasks）。
 * 用户真正学到该知识点时内容已就绪，无需同步等待 AI。
 *
 * 配置存于 users.settings.pre_generation（JSONB），由设置页读写。
 */
class PreGenerationService {
  async getSettings(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<PreGenerationSettings> {
    const { data, error } = await supabase
      .from("users")
      .select("settings")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      logger.warn(`preGenerationService.getSettings failed for ${userId}:`, error.message);
      return { ...PRE_GENERATION_DEFAULTS };
    }

    const raw = (data?.settings as Record<string, unknown> | undefined)?.["pre_generation"];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ...PRE_GENERATION_DEFAULTS };
    }

    return {
      ...PRE_GENERATION_DEFAULTS,
      ...(raw as Partial<PreGenerationSettings>),
    };
  }

  /**
   * 收集未来 lead_days 内要学习的知识点（按排期日期升序，全局去重）：
   * ① 排课日历 learning_path_schedule（scheduled 状态，只排日）
   * ② 带 scheduled_start 且关联知识点的用户任务
   */
  private async findUpcomingKnowledgePoints(
    supabase: SupabaseClient,
    userId: string,
    settings: PreGenerationSettings,
  ): Promise<UpcomingKnowledgePoint[]> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const end = new Date(today);
    end.setDate(end.getDate() + settings.lead_days);
    const endStr = end.toISOString().slice(0, 10);
    const endIso = end.toISOString();

    const collected = new Map<string, UpcomingKnowledgePoint>();

    const add = (id: string | null | undefined, at: string | null | undefined) => {
      if (!id || !at) return;
      const existing = collected.get(id);
      if (!existing || at < existing.scheduled_at) {
        collected.set(id, { knowledge_point_id: id, scheduled_at: at });
      }
    };

    const [{ data: scheduleRows }, { data: taskRows }] = await Promise.all([
      supabase
        .from("learning_path_schedule")
        .select("knowledge_point_id, scheduled_date")
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .gte("scheduled_date", todayStr)
        .lte("scheduled_date", endStr),
      supabase
        .from("user_tasks")
        .select("knowledge_point_id, scheduled_start")
        .eq("user_id", userId)
        .not("knowledge_point_id", "is", null)
        .not("scheduled_start", "is", null)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "paused"])
        .gte("scheduled_start", now.toISOString())
        .lte("scheduled_start", endIso),
    ]);

    for (const row of scheduleRows ?? []) add(row.knowledge_point_id, row.scheduled_date);
    for (const row of taskRows ?? []) add(row.knowledge_point_id, row.scheduled_start);

    return [...collected.values()]
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, settings.max_knowledge_points_per_run);
  }

  /**
   * 对指定用户执行一轮预生成。
   * 学习资料：目标语言缺失时入队 generate_learning_material；
   * 题目：该知识点完全没有卡片时入队 generate_questions。
   * 已存在/在途任务自动跳过（去重）。
   */
  async runPreGeneration(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<PreGenerationRunResult> {
    const settings = await this.getSettings(supabase, userId);
    const result: PreGenerationRunResult = {
      enabled: settings.enabled,
      candidatesFound: 0,
      knowledgePointsProcessed: 0,
      tasksEnqueued: 0,
      skipped: { materialExists: 0, cardsExists: 0, taskInFlight: 0, noContent: 0 },
      enqueued: [],
    };

    if (!settings.enabled) {
      logger.info(`[PreGeneration] skipped for user ${userId}: feature disabled`);
      return result;
    }

    const upcoming = await this.findUpcomingKnowledgePoints(supabase, userId, settings);
    result.candidatesFound = upcoming.length;
    if (upcoming.length === 0) return result;

    const ids = upcoming.map((u) => u.knowledge_point_id);

    const [{ data: kps }, { data: graphNodes }] = await Promise.all([
      supabase
        .from("knowledge_points")
        .select("id, title, content, learning_material")
        .in("id", ids),
      supabase
        .from("graph_nodes")
        .select("knowledge_point_id, graph_id")
        .in("knowledge_point_id", ids),
    ]);

    if (!kps || kps.length === 0) return result;

    const graphIdByKp = new Map<string, string>();
    for (const gn of graphNodes ?? []) {
      if (!graphIdByKp.has(gn.knowledge_point_id)) {
        graphIdByKp.set(gn.knowledge_point_id, gn.graph_id);
      }
    }

    // 该用户当前在途的预生成任务（标题=processor 类型，便于精确去重）
    const { data: activeTasks } = await supabase
      .from("system_tasks")
      .select("id, title, input_data, status")
      .eq("user_id", userId)
      .in("title", [...PREGEN_TASK_TYPES])
      .in("status", [...ACTIVE_TASK_STATUSES])
      .limit(100);

    const inFlight = new Set<string>();
    for (const t of activeTasks ?? []) {
      const kpId = (t.input_data as Record<string, unknown> | null)?.knowledge_point_id;
      if (typeof kpId === "string") inFlight.add(`${t.title}:${kpId}`);
    }

    const kpById = new Map(kps.map((k) => [k.id, k]));

    for (const upcomingKp of upcoming) {
      const kp = kpById.get(upcomingKp.knowledge_point_id);
      if (!kp) continue;

      result.knowledgePointsProcessed += 1;
      const graphId = graphIdByKp.get(kp.id);
      const title = resolveLocalizedText(kp.title as LocalizedText, BASE_CONTENT_LANG);
      const content = resolveLocalizedText(kp.content as LocalizedText, BASE_CONTENT_LANG);

      if (!title.trim() && !content.trim()) {
        result.skipped.noContent += 1;
        continue;
      }

      if (settings.learning_material) {
        const material = (kp.learning_material as Record<string, string> | null) ?? {};
        for (const language of settings.languages) {
          const existing = material[language];
          if (existing && existing.trim().length > 0) {
            result.skipped.materialExists += 1;
            continue;
          }
          if (inFlight.has(`generate_learning_material:${kp.id}`)) {
            result.skipped.taskInFlight += 1;
            continue;
          }
          const task = await asyncTaskService.createTask(
            userId,
            "generate_learning_material",
            { knowledge_point_id: kp.id, language, graph_id: graphId },
            // title 必须等于 processor 类型 key：asyncTaskService 恢复依赖
            // getOriginalTaskType 用 title 反查 processor，展示标签由前端 getTypeLabel 本地化
            "generate_learning_material",
          );
          inFlight.add(`generate_learning_material:${kp.id}`);
          result.tasksEnqueued += 1;
          result.enqueued.push({
            knowledge_point_id: kp.id,
            type: "generate_learning_material",
            taskId: task.id,
            language,
          });
        }
      }

      if (settings.generate_cards) {
        const { count } = await supabase
          .from("study_cards")
          .select("id", { count: "exact", head: true })
          .eq("knowledge_point_id", kp.id);

        if ((count ?? 0) > 0) {
          result.skipped.cardsExists += 1;
        } else if (inFlight.has(`generate_questions:${kp.id}`)) {
          result.skipped.taskInFlight += 1;
        } else {
          const task = await asyncTaskService.createTask(
            userId,
            "generate_questions",
            {
              knowledge_point_id: kp.id,
              node_title: title,
              node_content: content,
              graph_id: graphId,
              config: {
                count: settings.cards_per_knowledge_point,
                types: settings.card_types,
                difficulty: settings.card_difficulty,
                coverage: settings.card_coverage,
              },
            },
            "generate_questions",
          );
          inFlight.add(`generate_questions:${kp.id}`);
          result.tasksEnqueued += 1;
          result.enqueued.push({
            knowledge_point_id: kp.id,
            type: "generate_questions",
            taskId: task.id,
          });
        }
      }
    }

    logger.info(
      `[PreGeneration] user=${userId} candidates=${result.candidatesFound} ` +
        `processed=${result.knowledgePointsProcessed} enqueued=${result.tasksEnqueued}`,
    );
    return result;
  }

  /**
   * 为所有「未来有排期知识点」的用户执行一轮预生成（cron 使用，admin client）。
   */
  async runForAllUsers(): Promise<void> {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    // 粗筛窗口（取默认 lead_days）；实际按各用户设置在其 runPreGeneration 内过滤
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    const endStr = end.toISOString().slice(0, 10);
    const endIso = end.toISOString();

    const userIds = new Set<string>();

    const [schedRes, taskRes] = await Promise.all([
      supabase
        .from("learning_path_schedule")
        .select("user_id")
        .eq("status", "scheduled")
        .gte("scheduled_date", todayStr)
        .lte("scheduled_date", endStr),
      supabase
        .from("user_tasks")
        .select("user_id")
        .not("knowledge_point_id", "is", null)
        .not("scheduled_start", "is", null)
        .is("deleted_at", null)
        .in("status", ["pending", "in_progress", "paused"])
        .gte("scheduled_start", now.toISOString())
        .lte("scheduled_start", endIso),
    ]);

    for (const r of schedRes.data ?? []) userIds.add(r.user_id);
    for (const r of taskRes.data ?? []) userIds.add(r.user_id);

    logger.info(`[PreGeneration] running for ${userIds.size} user(s)`);

    for (const userId of userIds) {
      try {
        await this.runPreGeneration(supabase, userId);
      } catch (error) {
        logger.error(`[PreGeneration] failed for user ${userId}:`, error);
      }
    }
  }

  /**
   * 预生成任务状态查询（设置页「立即运行」反馈 / 学习模式在途检测使用）。
   * 传 knowledge_point_id 时返回该知识点是否有在途预生成任务。
   */
  async getStatus(
    supabase: SupabaseClient,
    userId: string,
    knowledgePointId?: string,
  ) {
    let query = supabase
      .from("system_tasks")
      .select("id, title, status, created_at, updated_at, runtime_progress, error_message")
      .eq("user_id", userId)
      .in("title", [...PREGEN_TASK_TYPES])
      .order("created_at", { ascending: false })
      .limit(50);

    if (knowledgePointId) {
      query = query.contains("input_data", { knowledge_point_id: knowledgePointId });
    }

    const { data, error } = await query;
    if (error) {
      logger.warn(`preGenerationService.getStatus failed:`, error.message);
      return { active: 0, completed: 0, hasActiveTaskForKnowledgePoint: false, recent: [] };
    }

    const tasks = data ?? [];
    const active = tasks.filter((t) =>
      ACTIVE_TASK_STATUSES.includes(t.status as (typeof ACTIVE_TASK_STATUSES)[number]),
    ).length;
    const completed = tasks.filter((t) => t.status === "completed").length;

    return {
      active,
      completed,
      hasActiveTaskForKnowledgePoint:
        knowledgePointId !== undefined
          ? tasks.some((t) =>
              ACTIVE_TASK_STATUSES.includes(t.status as (typeof ACTIVE_TASK_STATUSES)[number]),
            )
          : false,
      recent: tasks.slice(0, 20),
    };
  }
}

export const preGenerationService = new PreGenerationService();
