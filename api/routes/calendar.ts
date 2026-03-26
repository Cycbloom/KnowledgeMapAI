import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

const generateICSContent = (tasks: any[], executions: any[]): string => {
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
    const priority = task.priority && task.priority >= 4 ? "1" : task.priority >= 3 ? "5" : "9";
    
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
};

router.get(
  "/export/ics",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    try {
      const { data: tasks, error: tasksError } = await supabase
        .from("scheduled_tasks")
        .select("*")
        .eq("user_id", req.user.id)
        .is("deleted_at", null)
        .order("scheduled_start", { ascending: true });

      if (tasksError) {
        logger.error("Failed to fetch tasks for ICS export:", tasksError);
        return res.status(500).json({ error: "Failed to fetch tasks" });
      }

      const { data: executions, error: execError } = await supabase
        .from("task_executions")
        .select("*")
        .eq("user_id", req.user.id)
        .order("started_at", { ascending: true })
        .limit(100);

      if (execError) {
        logger.error("Failed to fetch executions for ICS export:", execError);
      }

      const icsContent = generateICSContent(tasks || [], executions || []);

      const filename = `knowledgemap-calendar-${new Date().toISOString().split("T")[0]}.ics`;

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(icsContent);

      logger.info(`ICS calendar exported for user ${req.user.id}`);
    } catch (error) {
      logger.error("ICS export error:", error);
      res.status(500).json({ error: "Failed to export calendar" });
    }
  }
);

router.get(
  "/subscribe/:userId",
  async (req, res: Response) => {
    const { userId } = req.params;
    const supabase = (req as any).supabase;

    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    try {
      const { data: user, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (userError || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { data: tasks, error: tasksError } = await supabase
        .from("scheduled_tasks")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("scheduled_start", { ascending: true });

      if (tasksError) {
        logger.error("Failed to fetch tasks for WebCal:", tasksError);
        return res.status(500).json({ error: "Failed to fetch tasks" });
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

      const icsContent = generateICSContent(tasks || [], executions || []);

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.send(icsContent);

      logger.info(`WebCal subscription accessed for user ${userId}`);
    } catch (error) {
      logger.error("WebCal subscription error:", error);
      res.status(500).json({ error: "Failed to generate calendar feed" });
    }
  }
);

router.get(
  "/events",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { start, end } = req.query;

    try {
      let tasksQuery = supabase
        .from("scheduled_tasks")
        .select("*")
        .eq("user_id", req.user.id)
        .is("deleted_at", null);

      if (start) {
        tasksQuery = tasksQuery.gte("scheduled_start", start as string);
      }
      if (end) {
        tasksQuery = tasksQuery.lte("scheduled_end", end as string);
      }

      const { data: tasks, error: tasksError } = await tasksQuery;

      if (tasksError) {
        logger.error("Failed to fetch calendar events:", tasksError);
        return res.status(500).json({ error: "Failed to fetch events" });
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

      res.json({ success: true, data: events });
    } catch (error) {
      logger.error("Calendar events fetch error:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  }
);

export default router;
