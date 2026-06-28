import { SupabaseClient } from "@supabase/supabase-js";
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
      type: task.tags?.includes("学习") ? "study"
        : task.tags?.includes("复习") ? "review"
        : "task",
      color: task.priority === 4 ? "red" : task.priority === 3 ? "orange" : "blue",
      estimated_duration: task.estimated_duration,
      status: task.status,
    }));

    return events;
  }

  private generateICSContent(tasks: CalendarTask[], executions: CalendarExecution[]): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//KnowledgeMap//Calendar//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:KnowledgeMap 任务日历
X-WR-TIMEZONE:Asia/Shanghai
X-WR-CALDESC:KnowledgeMap 任务调度系统的日历同步
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

      const formatDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      const status = task.status === "completed" ? "COMPLETED" : "CONFIRMED";
      const priorityNum = task.priority ? parseInt(task.priority) : 0;
      const priority = priorityNum >= 4 ? "1" : priorityNum >= 3 ? "5" : "9";

      const category = task.tags?.includes("学习") ? "学习"
        : task.tags?.includes("复习") ? "复习"
        : task.tags?.includes("工作") ? "工作"
        : "任务";

      ics += `BEGIN:VEVENT
UID:${task.id}@knowledgemap
DTSTAMP:${timestamp}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
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
        ics += `X-DEADLINE:${formatDate(new Date(task.deadline))}
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

      const formatDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      ics += `BEGIN:VEVENT
UID:exec-${exec.id}@knowledgemap
DTSTAMP:${timestamp}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:✓ ${exec.task_title || "执行记录"}
DESCRIPTION:实际执行时间: ${Math.round((exec.duration || 0) / 60)} 分钟
STATUS:CONFIRMED
CATEGORIES:执行记录
X-STATUS:${exec.status || "completed"}
END:VEVENT
`;
    });

    ics += `END:VCALENDAR`;

    return ics;
  }
}

export const calendarService = new CalendarService();
