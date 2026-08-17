import { SupabaseClient } from "@supabase/supabase-js";
import i18next from "i18next";
import { toIcsUtcTimestamp } from "@shared/utils/dateFormat";
import { logger } from "../../utils/logger";
import { notDeleted } from '../common/softDeleteHelper';

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
      throw new Error("Failed to fetch tasks");
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
      throw new Error("User not found");
    }

    const { data: tasks, error: tasksError } = await notDeleted(supabase
      .from("user_tasks")
      .select("*")
      .eq("user_id", userId)
      )
      .order("scheduled_start", { ascending: true });

    if (tasksError) {
      logger.error("Failed to fetch tasks for WebCal:", tasksError);
      throw new Error("Failed to fetch tasks");
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
      throw new Error("Failed to fetch events");
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

    return events;
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
