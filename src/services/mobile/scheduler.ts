import { getMobileSupabaseClient } from "./client";
import type {
  UserTask,
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
  UserTaskDetail,
  TaskSubtask,
  TaskExecution,
  TaskDependency,
  Queue,
  CreateQueueData,
  UpdateQueueData,
  QueueData,
  TaskSettings,
  UpdateTaskSettingsData,
  UserTaskStats,
  HeatmapData,
  FocusSession,
  CreateFocusSessionData,
  UserFocusStats,
  DailyFocusStats,
  WeeklyFocusStats,
  MonthlyFocusStats,
  Achievement,
  UserAchievement,
  AchievementCheckResult,
  TaskLink,
  TaskKnowledgePoint,
} from "@shared/types";

export const mobileSchedulerApi: any = {
  createTask: async (data: CreateUserTaskData) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: result, error } = await (client.from("user_tasks") as any)
      .insert({
        user_id: user.id,
        title: data.title,
        description: data.description,
        queue_level: data.queue_level ?? 0,
        estimated_duration: data.estimated_duration,
        deadline: data.deadline,
        tags: data.tags || [],
        knowledge_point_id: data.knowledge_point_id,
        priority: data.priority ?? 0,
        task_type: data.task_type || "one_time",
        total_duration: data.total_duration,
        progress_mode: data.progress_mode,
        context: data.context,
        parent_task_id: data.parent_task_id,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  getTasks: async (filters?: UserTaskFilters): Promise<UserTask[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    let query = (client.from("user_tasks") as any)
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.queue_level !== undefined) {
      query = query.eq("queue_level", filters.queue_level);
    }
    if (filters?.tags?.length) {
      query = query.contains("tags", filters.tags);
    }
    if (filters?.from_date) {
      query = query.gte("created_at", filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte("created_at", filters.to_date);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as UserTask[];
  },

  getTask: async (id: string): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await (client.from("user_tasks") as any)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as UserTask;
  },

  getTaskDetail: async (id: string): Promise<UserTaskDetail> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: task, error: taskError } = await (client.from("user_tasks") as any)
      .select("*")
      .eq("id", id)
      .single();

    if (taskError) {
      throw new Error(taskError.message);
    }

    const [dependenciesResult, dependentsResult, executionsResult, subtasksResult] =
      await Promise.all([
        (client.from("task_dependencies") as any)
          .select(
            "id, task_id, depends_on_task_id, dependency_type, created_at, depends_on_task:user_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)"
          )
          .eq("task_id", id),
        (client.from("task_dependencies") as any)
          .select(
            "id, task_id, depends_on_task_id, dependency_type, created_at, depends_on_task:user_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)"
          )
          .eq("depends_on_task_id", id),
        (client.from("task_executions") as any)
          .select("*")
          .eq("task_id", id)
          .order("started_at", { ascending: false }),
        (client.from("task_subtasks") as any)
          .select("*")
          .eq("task_id", id)
          .order("position", { ascending: true }),
      ]);

    const subtaskCount = subtasksResult.data?.length || 0;
    const subtaskCompleted =
      subtasksResult.data?.filter((s: any) => s.status === "completed").length || 0;

    return {
      ...(task as UserTask),
      dependencies: (dependenciesResult.data || []) as TaskDependency[],
      dependents: (dependentsResult.data || []) as TaskDependency[],
      progress_plans: [],
      executions: (executionsResult.data || []) as TaskExecution[],
      subtasks: (subtasksResult.data || []) as TaskSubtask[],
      links: [],
      knowledge_points: [],
      subtask_count: subtaskCount,
      subtask_completed: subtaskCompleted,
      has_subtasks: subtaskCount > 0,
    } as UserTaskDetail;
  },

  updateTask: async (id: string, data: UpdateUserTaskData): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("user_tasks") as any)
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  deleteTask: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await (client.from("user_tasks") as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  },

  startTask: async (id: string): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("user_tasks") as any)
      .update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  pauseTask: async (id: string): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("user_tasks") as any)
      .update({
        status: "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  completeTask: async (id: string): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("user_tasks") as any)
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  demoteTask: async (id: string): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: task } = await (client.from("user_tasks") as any)
      .select("queue_level")
      .eq("id", id)
      .single();

    const currentLevel = (task as any)?.queue_level ?? 0;
    const newLevel = Math.min(currentLevel + 1, 2);

    const { data: result, error } = await (client.from("user_tasks") as any)
      .update({
        queue_level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  moveTask: async (id: string, targetQueue: number | string): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const targetLevel = typeof targetQueue === "number" ? targetQueue : parseInt(targetQueue, 10);

    const { data: result, error } = await (client.from("user_tasks") as any)
      .update({
        queue_level: targetLevel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  reorderTasks: async (_queueLevel: number, taskIds: string[]): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    for (let i = 0; i < taskIds.length; i++) {
      await (client.from("user_tasks") as any)
        .update({ position: i, updated_at: new Date().toISOString() })
        .eq("id", taskIds[i]);
    }
  },

  generateTaskDetails: async (title: string, context?: string) => {
    return {
      description: context || `Task: ${title}`,
      tags: [],
      estimated_duration: 30,
      priority: 0,
      suggested_queue: 0,
    };
  },

  updateNotes: async (taskId: string, notes: string): Promise<UserTask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("user_tasks") as any)
      .update({
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as UserTask;
  },

  getSmartRecommendation: async () => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { task: null, reason: "No user" };
    }

    const { data: tasks } = await (client.from("user_tasks") as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1);

    if (!tasks || tasks.length === 0) {
      return { task: null, reason: "No pending tasks" };
    }

    return {
      task: tasks[0],
      reason: "Highest priority pending task",
    };
  },

  getDynamicPriority: async (taskId: string) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: task } = await (client.from("user_tasks") as any)
      .select("priority, deadline, created_at")
      .eq("id", taskId)
      .single();

    if (!task) {
      return { priority: 0, factors: {} };
    }

    let dynamicPriority = (task as any).priority || 0;
    const factors: Record<string, number> = {};

    if ((task as any).deadline) {
      const deadline = new Date((task as any).deadline);
      const now = new Date();
      const daysUntilDeadline = Math.max(
        0,
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      factors.deadline_urgency = Math.max(0, 10 - daysUntilDeadline);
      dynamicPriority += factors.deadline_urgency;
    }

    return { priority: dynamicPriority, factors };
  },

  checkTaskDependencies: async (taskId: string) => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: dependencies } = await (client.from("task_dependencies") as any)
      .select("depends_on_task_id, dependency_type")
      .eq("task_id", taskId);

    if (!dependencies || dependencies.length === 0) {
      return { can_start: true, blocked_by: [] };
    }

    const dependentIds = dependencies.map((d: any) => d.depends_on_task_id);

    const { data: dependentTasks } = await (client.from("user_tasks") as any)
      .select("id, title, status")
      .in("id", dependentIds);

    const blockedBy = (dependentTasks || [])
      .filter((t: any) => t.status !== "completed")
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
      }));

    return {
      can_start: blockedBy.length === 0,
      blocked_by: blockedBy,
    };
  },

  getQueues: async (): Promise<Queue[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await (client.from("queues") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("priority", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Queue[];
  },

  createQueue: async (data: CreateQueueData): Promise<Queue> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: result, error } = await (client.from("queues") as any)
      .insert({
        user_id: user.id,
        name: data.name,
        color: data.color || "#3b82f6",
        time_slice: data.time_slice || 25,
        priority: data.priority,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Queue;
  },

  updateQueue: async (id: string, data: UpdateQueueData): Promise<Queue> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("queues") as any)
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as Queue;
  },

  deleteQueue: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await (client.from("queues") as any).delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  },

  getQueueData: async (): Promise<QueueData> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return { q0: [], q1: [], q2: [] };
    }

    const { data, error } = await (client.from("user_tasks") as any)
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("position", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const tasks = (data || []) as UserTask[];
    return {
      q0: tasks.filter((t) => t.queue_level === 0),
      q1: tasks.filter((t) => t.queue_level === 1),
      q2: tasks.filter((t) => t.queue_level === 2),
    };
  },

  getExecutions: async (filters?: {
    task_id?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<TaskExecution[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    let query = (client.from("task_executions") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (filters?.task_id) {
      query = query.eq("task_id", filters.task_id);
    }
    if (filters?.from_date) {
      query = query.gte("started_at", filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte("started_at", filters.to_date);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as TaskExecution[];
  },

  createExecution: async (data: {
    task_id: string;
    started_at: string;
    queue_level: number;
  }): Promise<TaskExecution> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: result, error } = await (client.from("task_executions") as any)
      .insert({
        user_id: user.id,
        task_id: data.task_id,
        started_at: data.started_at,
        queue_level: data.queue_level,
        status: "completed",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskExecution;
  },

  getSettings: async (): Promise<TaskSettings> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return {
        id: "",
        user_id: "",
        q0_time_slice: 25,
        q1_time_slice: 45,
        q2_time_slice: 90,
        break_duration: 5,
        sound_enabled: true,
        notification_enabled: true,
      };
    }

    const { data, error } = await (client.from("task_settings") as any)
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return (data as TaskSettings) || {
      id: "",
      user_id: user.id,
      q0_time_slice: 25,
      q1_time_slice: 45,
      q2_time_slice: 90,
      break_duration: 5,
      sound_enabled: true,
      notification_enabled: true,
    };
  },

  updateSettings: async (data: UpdateTaskSettingsData): Promise<TaskSettings> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: result, error } = await (client.from("task_settings") as any)
      .upsert({
        user_id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskSettings;
  },

  getStats: async (): Promise<UserTaskStats> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return {
        total_tasks: 0,
        completed_tasks: 0,
        total_duration: 0,
        avg_duration: 0,
        completion_rate: 0,
        tasks_by_queue: { q0: 0, q1: 0, q2: 0 },
        tasks_by_status: {},
      };
    }

    const { data: tasks } = await (client.from("user_tasks") as any)
      .select("status, queue_level, actual_duration")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const totalTasks = tasks?.length || 0;
    const completedTasks = tasks?.filter((t: any) => t.status === "completed").length || 0;
    const totalDuration =
      tasks?.reduce((sum: number, t: any) => sum + (t.actual_duration || 0), 0) || 0;

    const tasksByQueue = { q0: 0, q1: 0, q2: 0 };
    const tasksByStatus: Record<string, number> = {};

    (tasks || []).forEach((t: any) => {
      if (t.queue_level === 0) tasksByQueue.q0++;
      else if (t.queue_level === 1) tasksByQueue.q1++;
      else if (t.queue_level === 2) tasksByQueue.q2++;

      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    });

    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      total_duration: totalDuration,
      avg_duration: totalTasks > 0 ? totalDuration / totalTasks : 0,
      completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      tasks_by_queue: tasksByQueue,
      tasks_by_status: tasksByStatus,
    };
  },

  getHeatmap: async (): Promise<HeatmapData[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data: executions } = await (client.from("task_executions") as any)
      .select("started_at, duration")
      .eq("user_id", user.id);

    const heatmapMap = new Map<string, { count: number; duration: number }>();

    (executions || []).forEach((e: any) => {
      const date = e.started_at?.split("T")[0];
      if (date) {
        const existing = heatmapMap.get(date) || { count: 0, duration: 0 };
        heatmapMap.set(date, {
          count: existing.count + 1,
          duration: existing.duration + (e.duration || 0),
        });
      }
    });

    return Array.from(heatmapMap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      duration: data.duration,
    }));
  },

  getFocusSessions: async (): Promise<FocusSession[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await (client.from("focus_sessions") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as FocusSession[];
  },

  createFocusSession: async (data: CreateFocusSessionData): Promise<FocusSession> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: result, error } = await (client.from("focus_sessions") as any)
      .insert({
        user_id: user.id,
        task_id: data.task_id,
        started_at: data.started_at,
        ended_at: data.ended_at,
        duration: data.duration,
        pomodoro_count: data.pomodoro_count || 1,
        white_noise_type: data.white_noise_type,
        is_break: data.is_break || false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as FocusSession;
  },

  getUserFocusStats: async (): Promise<UserFocusStats | null> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await (client.from("user_focus_stats") as any)
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    return data as UserFocusStats | null;
  },

  getDailyFocusStats: async (): Promise<DailyFocusStats[]> => {
    return [];
  },

  getWeeklyFocusStats: async (): Promise<WeeklyFocusStats[]> => {
    return [];
  },

  getMonthlyFocusStats: async (): Promise<MonthlyFocusStats[]> => {
    return [];
  },

  getAllAchievements: async (): Promise<Achievement[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await (client.from("achievements") as any).select("*");

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as Achievement[];
  },

  getUserAchievements: async (): Promise<UserAchievement[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await (client.from("user_achievements") as any)
      .select("*, achievement:achievements(*)")
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as UserAchievement[];
  },

  checkAchievements: async (): Promise<AchievementCheckResult> => {
    return {
      unlocked: [],
      progress: [],
    };
  },

  getSubtasks: async (taskId: string): Promise<TaskSubtask[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await (client.from("task_subtasks") as any)
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as TaskSubtask[];
  },

  createSubtask: async (data: {
    task_id: string;
    title: string;
    description?: string;
  }): Promise<TaskSubtask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("task_subtasks") as any)
      .insert({
        task_id: data.task_id,
        title: data.title,
        description: data.description,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskSubtask;
  },

  updateSubtask: async (
    id: string,
    data: { title?: string; status?: string }
  ): Promise<TaskSubtask> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const updateData: any = { ...data };
    if (data.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: result, error } = await (client.from("task_subtasks") as any)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskSubtask;
  },

  deleteSubtask: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await (client.from("task_subtasks") as any).delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  },

  getDependencies: async (taskId: string): Promise<TaskDependency[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await (client.from("task_dependencies") as any)
      .select("*")
      .eq("task_id", taskId);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as TaskDependency[];
  },

  createDependency: async (data: {
    task_id: string;
    depends_on_task_id: string;
    dependency_type?: string;
  }): Promise<TaskDependency> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("task_dependencies") as any)
      .insert({
        task_id: data.task_id,
        depends_on_task_id: data.depends_on_task_id,
        dependency_type: data.dependency_type || "soft",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskDependency;
  },

  deleteDependency: async (id: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await (client.from("task_dependencies") as any).delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  },

  getLinks: async (taskId: string): Promise<TaskLink[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await (client.from("task_links") as any)
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as TaskLink[];
  },

  createLink: async (
    _taskId: string,
    data: {
      link_type?: string;
      title?: string;
      url: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<TaskLink> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("task_links") as any)
      .insert({
        task_id: _taskId,
        link_type: data.link_type || "web",
        title: data.title,
        url: data.url,
        description: data.description,
        icon: data.icon,
        metadata: data.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskLink;
  },

  updateLink: async (
    _taskId: string,
    linkId: string,
    data: {
      title?: string;
      description?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<TaskLink> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("task_links") as any)
      .update(data)
      .eq("id", linkId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskLink;
  },

  deleteLink: async (_taskId: string, linkId: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await (client.from("task_links") as any).delete().eq("id", linkId);

    if (error) {
      throw new Error(error.message);
    }
  },

  getTaskKnowledgePoints: async (taskId: string): Promise<TaskKnowledgePoint[]> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await (client.from("task_knowledge_points") as any)
      .select("*")
      .eq("task_id", taskId);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []) as TaskKnowledgePoint[];
  },

  addTaskKnowledgePoint: async (
    _taskId: string,
    data: {
      knowledge_point_id: string;
      relevance_score?: number;
      is_primary?: boolean;
      notes?: string;
    }
  ): Promise<TaskKnowledgePoint> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("task_knowledge_points") as any)
      .insert({
        task_id: _taskId,
        knowledge_point_id: data.knowledge_point_id,
        relevance_score: data.relevance_score || 0,
        is_primary: data.is_primary || false,
        notes: data.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskKnowledgePoint;
  },

  updateTaskKnowledgePoint: async (
    _taskId: string,
    kpId: string,
    data: {
      relevance_score?: number;
      is_primary?: boolean;
      notes?: string;
    }
  ): Promise<TaskKnowledgePoint> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { data: result, error } = await (client.from("task_knowledge_points") as any)
      .update(data)
      .eq("id", kpId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return result as TaskKnowledgePoint;
  },

  removeTaskKnowledgePoint: async (_taskId: string, kpId: string): Promise<void> => {
    const client = getMobileSupabaseClient();
    if (!client) {
      throw new Error("Supabase client not initialized");
    }

    const { error } = await (client.from("task_knowledge_points") as any)
      .delete()
      .eq("id", kpId);

    if (error) {
      throw new Error(error.message);
    }
  },

  getTaskAnalytics: async () => {
    return {
      total_tasks: 0,
      completed_tasks: 0,
      total_duration: 0,
      avg_duration: 0,
      completion_rate: 0,
      tasks_by_queue: { q0: 0, q1: 0, q2: 0 },
      tasks_by_status: {},
    };
  },

  generateInsights: async () => {
    return { insights: [] };
  },

  getTimeSlots: async () => {
    return [];
  },

  createTimeSlot: async (_data: any) => {
    return {};
  },

  updateTimeSlot: async (_id: string, _data: any) => {
    return {};
  },

  deleteTimeSlot: async (_id: string) => {
    return;
  },

  getSchedules: async () => {
    return [];
  },

  createSchedule: async (_data: any) => {
    return {};
  },

  updateSchedule: async (_id: string, _data: any) => {
    return {};
  },

  deleteSchedule: async (_id: string) => {
    return;
  },

  createProgressPlan: async (_taskId: string, _data: any) => {
    return {};
  },

  updateProgressPlan: async (_taskId: string, _data: any) => {
    return {};
  },

  getProgressPlan: async (_taskId: string) => {
    return [];
  },

  updateProgress: async (_taskId: string, _data: any) => {
    return {};
  },

  getYearlyHeatmap: async (_year?: number) => {
    return [];
  },

  updateFocusSession: async (_id: string, _data: any) => {
    return {};
  },
};
