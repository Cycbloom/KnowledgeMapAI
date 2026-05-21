import { withClient, withClientAndUser, withClientOptionalUser } from "../utils/clientHelper";
import type {
  UserTask,
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
  UserTaskDetail,
  TaskDependency,
  TaskExecution,
  TaskSubtask,
} from "@shared/types";

export const createTask = async (data: CreateUserTaskData) => {
  return withClientAndUser(async (client, userId) => {
    const { data: result, error } = await (client.from("user_tasks") as any)
      .insert({
        user_id: userId,
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
  });
};

export const getTasks = async (filters?: UserTaskFilters): Promise<UserTask[]> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return [];
    }

    let query = (client.from("user_tasks") as any)
      .select("*")
      .eq("user_id", userId)
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
  });
};

export const getTask = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
    const { data, error } = await (client.from("user_tasks") as any)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as UserTask;
  });
};

export const getTaskDetail = async (id: string): Promise<UserTaskDetail> => {
  return withClient(async (client) => {
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
  });
};

export const updateTask = async (id: string, data: UpdateUserTaskData): Promise<UserTask> => {
  return withClient(async (client) => {
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
  });
};

export const deleteTask = async (id: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await (client.from("user_tasks") as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  });
};

export const startTask = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
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
  });
};

export const pauseTask = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
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
  });
};

export const completeTask = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
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
  });
};

export const demoteTask = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
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
  });
};

export const moveTask = async (id: string, targetQueue: number | string): Promise<UserTask> => {
  return withClient(async (client) => {
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
  });
};

export const reorderTasks = async (_queueLevel: number, taskIds: string[]): Promise<void> => {
  return withClient(async (client) => {
    for (let i = 0; i < taskIds.length; i++) {
      await (client.from("user_tasks") as any)
        .update({ position: i, updated_at: new Date().toISOString() })
        .eq("id", taskIds[i]);
    }
  });
};

export const generateTaskDetails = async (title: string, context?: string) => {
  return {
    description: context || `Task: ${title}`,
    tags: [],
    estimated_duration: 30,
    priority: 0,
    suggested_queue: 0,
  };
};

export const updateNotes = async (taskId: string, notes: string): Promise<UserTask> => {
  return withClient(async (client) => {
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
  });
};

export const getSmartRecommendation = async () => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return { task: null, reason: "No user" };
    }

    const { data: tasks } = await (client.from("user_tasks") as any)
      .select("*")
      .eq("user_id", userId)
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
  });
};

export const getDynamicPriority = async (taskId: string) => {
  return withClient(async (client) => {
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
  });
};

export const checkTaskDependencies = async (taskId: string) => {
  return withClient(async (client) => {
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
  });
};
