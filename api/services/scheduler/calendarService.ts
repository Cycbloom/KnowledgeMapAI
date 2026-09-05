import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { toIcsUtcTimestamp } from "@shared/utils/dateFormat";
import { resolveLocalizedText } from "../../../shared/utils/localization";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { notDeleted } from '../common/softDeleteHelper';

/** 复习投影估时：每张到期卡片约需的复习分钟数 */
export const REVIEW_MINUTES_PER_CARD = 2;

/** 统一 YYYY-MM-DD 本地日期字符串（到期时间戳投影到本地日，避免 UTC 偏移） */
function toDateStringLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface CalendarTask {
  id: string;
  title: string;
  scheduled_start?: string;
  scheduled_end?: string;
  deadline?: string;
  created_at: string;
  estimated_duration?: number;
  description?: string;
  priority?: string;
  status?: string;
  tags?: string[];
}

interface CalendarExecution {
  id: string;
  task_id: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  task_title?: string;
  status?: string;
  user_tasks?: {
    title: string;
  };
}

class CalendarService {
  async exportICS(supabase: SupabaseClient, userId: string) {
    const { data: tasks, error: tasksError } = await notDeleted(supabase
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      )
      .order("scheduled_start", { ascending: true });

    if (tasksError) {
      logger.error("Failed to fetch tasks for ICS export:", tasksError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: "Failed to fetch tasks" });
    }

    const { data: executions, error: execError } = await supabase
      .from("task_executions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: true })
      .limit(100);

    if (execError) {
      logger.error("Failed to fetch executions for ICS export:", execError);
    }

    const content = this.generateICSContent(tasks || [], executions || []);
    const filename = `knowledgemap-calendar-${new Date().toISOString().split("T")[0]}.ics`;

    logger.info(`ICS calendar exported for user ${userId}`);

    return { content, filename };
  }

  async subscribeICS(supabase: SupabaseClient, userId: string) {
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      throw new AppError(ErrorCodes.RESOURCE_USER_NOT_FOUND, { message: "User not found" });
    }

    const { data: tasks, error: tasksError } = await notDeleted(supabase
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      )
      .order("scheduled_start", { ascending: true });

    if (tasksError) {
      logger.error("Failed to fetch tasks for WebCal:", tasksError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: "Failed to fetch tasks" });
    }

    const { data: executions, error: execError } = await supabase
      .from("task_executions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: true })
      .limit(100);

    if (execError) {
      logger.error("Failed to fetch executions for WebCal:", execError);
    }

    const content = this.generateICSContent(tasks || [], executions || []);

    logger.info(`WebCal subscription accessed for user ${userId}`);

    return { content };
  }

  async getEvents(
    supabase: SupabaseClient,
    userId: string,
    start?: string,
    end?: string,
  ) {
    let tasksQuery = notDeleted(supabase
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      );

    if (start) {
      tasksQuery = tasksQuery.gte("scheduled_start", start);
    }
    if (end) {
      tasksQuery = tasksQuery.lte("scheduled_end", end);
    }

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) {
      logger.error("Failed to fetch calendar events:", tasksError);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: "Failed to fetch events" });
    }

    const events = (tasks || []).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      start: task.scheduled_start || task.deadline,
      end: task.scheduled_end,
      allDay: !task.scheduled_start,
      type: task.tags?.includes("study") ? "study"
        : task.tags?.includes("review") ? "review"
        : "task",
      color: task.priority === 4 ? "red" : task.priority === 3 ? "orange" : "blue",
      estimated_duration: task.estimated_duration,
      status: task.status,
    }));

    // 路径排课图层：学习路径知识点排期（learning_path_schedule）
    const scheduleEvents = await this.getScheduleEvents(
      supabase,
      userId,
      start,
      end,
    );
    if (scheduleEvents.length > 0) events.push(...scheduleEvents);

    return events;
  }

  /**
   * 路径排课事件（只含 learning_path_schedule，供前端日历「路径排课」图层）。
   * 同一知识库按日期聚合，事件携带 knowledgePointId / scheduledDate 供跳转与去重。
   */
  async getScheduleEvents(
    supabase: SupabaseClient,
    userId: string,
    start?: string,
    end?: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      start: string;
      end: string;
      allDay: boolean;
      type: "path_schedule";
      color: string;
      status: string | null;
      estimated_duration: undefined;
      knowledgePointId: string | null;
      scheduledDate: string | null;
    }
  >> {
    const scheduleStart = start ? start.slice(0, 10) : undefined;
    const scheduleEnd = end ? end.slice(0, 10) : undefined;

    let scheduleQuery = supabase
      .from("learning_path_schedule")
      .select("id, knowledge_point_id, scheduled_date, source_path_ids, status, knowledge_points(title)")
      .eq("user_id", userId);

    if (scheduleStart) {
      scheduleQuery = scheduleQuery.gte("scheduled_date", scheduleStart);
    }
    if (scheduleEnd) {
      scheduleQuery = scheduleQuery.lte("scheduled_date", scheduleEnd);
    }

    const { data: schedule, error: scheduleError } = await scheduleQuery;
    if (scheduleError) return [];
    if (!schedule || schedule.length === 0) return [];

    return schedule.map((row) => {
      const kp = (
        row as unknown as {
          knowledge_points?: { title?: string | Record<string, string> } | null;
        }
      ).knowledge_points;
      return {
        id: `schedule-${row.id}`,
        title: resolveLocalizedText(kp?.title),
        description: i18next.t("scheduler.calendarService.pathScheduleDesc", {
          count:
            row.source_path_ids && row.source_path_ids.length > 0
              ? row.source_path_ids.length
              : 1,
        }),
        start: `${row.scheduled_date}T00:00:00.000Z`,
        end: `${row.scheduled_date}T23:59:59.000Z`,
        allDay: true,
        type: "path_schedule",
        color: "purple",
        status: row.status,
        estimated_duration: undefined,
        knowledgePointId: row.knowledge_point_id,
        scheduledDate: row.scheduled_date,
      };
    });
  }

  /**
   * 复习到期预测事件（P3 复习入历）。
   * FSRS 的 next_review 随每次评分自变 —— 投影按需计算、不落库，天然自愈。
   * 按（知识点 × 到期日）聚合，估时 = 卡片数 × REVIEW_MINUTES_PER_CARD。
   */
  async getReviewProjections(
    supabase: SupabaseClient,
    userId: string,
    start?: string,
    end?: string,
  ): Promise<
    Array<{
      id: string;
      title: string;
      description: string;
      start: string;
      end: string;
      allDay: boolean;
      type: "review_projection";
      color: string;
      status: string | null;
      estimated_duration: number;
      knowledgePointId: string | null;
      scheduledDate: string;
    }>
  > {
    const startStr = start ? start.slice(0, 10) : undefined;
    const endStr = end ? end.slice(0, 10) : undefined;

    let query = supabase
      .from("study_cards")
      .select("id, knowledge_point_id, next_review, knowledge_points(title)")
      .eq("user_id", userId)
      .not("knowledge_point_id", "is", null);

    if (startStr) {
      query = query.gte("next_review", `${startStr}T00:00:00.000Z`);
    }
    if (endStr) {
      query = query.lte("next_review", `${endStr}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) {
      logger.warn("[CalendarService] fetch review projections failed", {
        userId,
        error: error.message,
      });
      return [];
    }
    if (!data || data.length === 0) return [];

    // 按（知识点 × 本地到期日）聚合
    const byKey = new Map<
      string,
      { kpId: string; title: string | null; date: string; count: number }
    >();
    for (const row of data as Array<{
      id: string;
      knowledge_point_id: string | null;
      next_review: string | null;
      knowledge_points?: { title?: string | Record<string, string> } | null;
    }>) {
      if (!row.knowledge_point_id || !row.next_review) continue;
      const d = new Date(row.next_review);
      if (Number.isNaN(d.getTime())) continue;
      const date = toDateStringLocal(d);
      const key = `${row.knowledge_point_id}|${date}`;
      const entry = byKey.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        byKey.set(key, {
          kpId: row.knowledge_point_id,
          title:
            resolveLocalizedText(row.knowledge_points?.title) ?? "",
          date,
          count: 1,
        });
      }
    }

    return Array.from(byKey.values()).map((entry) => {
      const minutes = entry.count * REVIEW_MINUTES_PER_CARD;
      return {
        id: `review-${entry.kpId}-${entry.date}`,
        title:
          entry.title ||
          i18next.t("scheduler.calendarService.reviewProjection"),
        description: i18next.t(
          "scheduler.calendarService.reviewProjectionDesc",
          { count: entry.count, minutes },
        ),
        start: `${entry.date}T00:00:00.000Z`,
        end: `${entry.date}T23:59:59.000Z`,
        allDay: true,
        type: "review_projection" as const,
        color: "orange",
        status: null,
        estimated_duration: minutes,
        knowledgePointId: entry.kpId,
        scheduledDate: entry.date,
      };
    });
  }

  private generateICSContent(tasks: CalendarTask[], executions: CalendarExecution[]): string {
    const now = new Date();
    const timestamp = toIcsUtcTimestamp(now);

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KnowledgeMap//Calendar//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${i18next.t("scheduler.calendarService.calName")}
X-WR-TIMEZONE:Asia/Shanghai
X-WR-CALDESC:${i18next.t("scheduler.calendarService.calDesc")}
`;

    tasks.forEach((task) => {
      const startDate = task.scheduled_start
        ? new Date(task.scheduled_start)
        : task.deadline
          ? new Date(task.deadline)
          : new Date(task.created_at);

      const endDate = task.scheduled_end
        ? new Date(task.scheduled_end)
        : new Date(startDate.getTime() + (task.estimated_duration || 30) * 60000);

      const status = task.status === "completed" ? "COMPLETED" : "CONFIRMED";
      const priorityNum = task.priority ? parseInt(task.priority) : 0;
      const priority = priorityNum >= 4 ? "1" : priorityNum >= 3 ? "5" : "9";

      const category = task.tags?.includes("study") ? i18next.t("scheduler.calendarService.categories.study")
        : task.tags?.includes("review") ? i18next.t("scheduler.calendarService.categories.review")
        : task.tags?.includes("work") ? i18next.t("scheduler.calendarService.categories.work")
        : i18next.t("scheduler.calendarService.categories.task");

      ics += `BEGIN:VEVENT
UID:${task.id}@knowledgemap
DTSTAMP:${timestamp}
DTSTART:${toIcsUtcTimestamp(startDate)}
DTEND:${toIcsUtcTimestamp(endDate)}
SUMMARY:${task.title}
DESCRIPTION:${task.description || ""}
STATUS:${status}
PRIORITY:${priority}
CATEGORIES:${category}
`;

      if (task.tags && task.tags.length > 0) {
        ics += `X-TAGS:${task.tags.join(",")}
`;
      }

      if (task.deadline) {
        ics += `X-DEADLINE:${toIcsUtcTimestamp(new Date(task.deadline))}
`;
      }

      ics += `END:VEVENT
`;
    });

    executions.forEach((exec) => {
      if (!exec.started_at) return;

      const startDate = new Date(exec.started_at);
      const endDate = exec.ended_at
        ? new Date(exec.ended_at)
        : new Date(startDate.getTime() + (exec.duration || 30) * 60000);

      ics += `BEGIN:VEVENT
UID:exec-${exec.id}@knowledgemap
DTSTAMP:${timestamp}
DTSTART:${toIcsUtcTimestamp(startDate)}
DTEND:${toIcsUtcTimestamp(endDate)}
SUMMARY:${i18next.t("scheduler.calendarService.executionSummary", { title: exec.task_title || i18next.t("scheduler.calendarService.categories.execution") })}
DESCRIPTION:${i18next.t("scheduler.calendarService.executionDescription", { minutes: Math.round((exec.duration || 0) / 60) })}
STATUS:CONFIRMED
CATEGORIES:${i18next.t("scheduler.calendarService.categories.execution")}
X-STATUS:${exec.status || "completed"}
END:VEVENT
`;
    });

    ics += `END:VCALENDAR`;

    return ics;
  }
}

export const calendarService = new CalendarService();
