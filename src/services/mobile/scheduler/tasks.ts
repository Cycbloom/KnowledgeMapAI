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
import type {
  UserTaskRow,
  TaskDependencyRow,
  TaskExecutionRow,
  TaskSubtaskRow,
} from "@shared/types/database";
import { toUserTask } from "@shared/types/database";

export const create = async (data: CreateUserTaskData) => {
  return withClientAndUser(async (client, userId) => {
    const { data: result, error } = await client
      .from("user_tasks")
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
        context: data.context ? JSON.parse(data.context) : null,
        parent_task_id: data.parent_task_id,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return toUserTask(result as UserTaskRow);
  });
};

export const list = async (filters?: UserTaskFilters): Promise<UserTask[]> => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return [];
    }

    let query = client
      .from("user_tasks")
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

    return (data || []).map((row) => toUserTask(row as UserTaskRow));
  });
};

export const get = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
    const { data, error } = await client
      .from("user_tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return toUserTask(data as UserTaskRow);
  });
};

interface TaskDependencyWithTask extends TaskDependencyRow {
  depends_on_task: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    queue_level: number;
    priority: number;
  }[] | null;
}

export const getDetail = async (id: string): Promise<UserTaskDetail> => {
  return withClient(async (client) => {
    const { data: task, error: taskError } = await client
      .from("user_tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (taskError) {
      throw new Error(taskError.message);
    }

    const taskRow = task as UserTaskRow;

    const [dependenciesResult, dependentsResult, executionsResult, subtasksResult] =
      await Promise.all([
        client
          .from("task_dependencies")
          .select(
            "id, task_id, depends_on_task_id, dependency_type, created_at, depends_on_task:user_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)"
          )
          .eq("task_id", id),
        client
          .from("task_dependencies")
          .select(
            "id, task_id, depends_on_task_id, dependency_type, created_at, depends_on_task:user_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)"
          )
          .eq("depends_on_task_id", id),
        client
          .from("task_executions")
          .select("*")
          .eq("task_id", id)
          .order("started_at", { ascending: false }),
        client
          .from("task_subtasks")
          .select("*, knowledge_points(mastery_level)")
          .eq("task_id", id)
          .order("position", { ascending: true }),
      ]);

    const subtaskRows = (subtasksResult.data || []) as Array<
      TaskSubtaskRow & {
        knowledge_points: { mastery_level: number | null }[] | null;
      }
    >;
    const subtaskCount = subtaskRows.length;
    const subtaskCompleted = subtaskRows.filter((s) => s.status === "completed").length;

    return {
      ...toUserTask(taskRow),
      dependencies: (dependenciesResult.data || []).map((d) => {
        const row = d as TaskDependencyWithTask;
        const dependsOnTask = row.depends_on_task?.[0];
        return {
          id: row.id,
          task_id: row.task_id,
          depends_on_task_id: row.depends_on_task_id,
          dependency_type: row.dependency_type as TaskDependency["dependency_type"],
          created_at: row.created_at,
          depends_on_task: dependsOnTask
            ? {
                id: dependsOnTask.id,
                title: dependsOnTask.title,
                description: dependsOnTask.description ?? undefined,
                status: dependsOnTask.status,
                queue_level: dependsOnTask.queue_level,
                priority: dependsOnTask.priority,
              }
            : undefined,
        };
      }),
      dependents: (dependentsResult.data || []).map((d) => {
        const row = d as TaskDependencyWithTask;
        const dependsOnTask = row.depends_on_task?.[0];
        return {
          id: row.id,
          task_id: row.task_id,
          depends_on_task_id: row.depends_on_task_id,
          dependency_type: row.dependency_type as TaskDependency["dependency_type"],
          created_at: row.created_at,
          depends_on_task: dependsOnTask
            ? {
                id: dependsOnTask.id,
                title: dependsOnTask.title,
                description: dependsOnTask.description ?? undefined,
                status: dependsOnTask.status,
                queue_level: dependsOnTask.queue_level,
                priority: dependsOnTask.priority,
              }
            : undefined,
        };
      }),
      progress_plans: [],
      executions: (executionsResult.data || []).map((e) => {
        const row = e as TaskExecutionRow;
        return {
          id: row.id,
          task_id: row.task_id,
          user_id: row.user_id,
          started_at: row.started_at,
          ended_at: row.ended_at ?? undefined,
          duration: row.duration ?? undefined,
          queue_level: row.queue_level ?? 0,
          status: row.status as TaskExecution["status"],
        };
      }),
      subtasks: subtaskRows.map((s) => ({
        id: s.id,
        task_id: s.task_id,
        title: s.title,
        description: s.description ?? undefined,
        status: s.status as TaskSubtask["status"],
        priority: s.priority,
        position: s.position,
        estimated_duration: s.estimated_duration ?? undefined,
        actual_duration: s.actual_duration ?? undefined,
        due_date: s.due_date ?? undefined,
        completed_at: s.completed_at ?? undefined,
        learning_path_node_id: s.learning_path_node_id ?? undefined,
        knowledge_point_id: s.knowledge_point_id,
        learning_state: s.learning_state as TaskSubtask["learning_state"],
        mastery_level: s.knowledge_points?.[0]?.mastery_level ?? 0,
        last_state_change_at: s.last_state_change_at,
        state_history: s.state_history as unknown as TaskSubtask["state_history"],
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      links: [],
      knowledge_points: [],
      subtask_count: subtaskCount,
      subtask_completed: subtaskCompleted,
      has_subtasks: subtaskCount > 0,
    } as UserTaskDetail;
  });
};

export const update = async (id: string, data: UpdateUserTaskData): Promise<UserTask> => {
  return withClient(async (client) => {
    const { context, ...restData } = data;
    const updateData: Partial<UserTaskRow> = {
      ...restData,
      updated_at: new Date().toISOString(),
    };
    if (context !== undefined) {
      updateData.context = context ? JSON.parse(context) : null;
    }

    const { data: result, error } = await client
      .from("user_tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return toUserTask(result as UserTaskRow);
  });
};

export const deleteTask = async (id: string): Promise<void> => {
  return withClient(async (client) => {
    const { error } = await client
      .from("user_tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  });
};

export const start = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("user_tasks")
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

    return toUserTask(result as UserTaskRow);
  });
};

export const pause = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("user_tasks")
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

    return toUserTask(result as UserTaskRow);
  });
};

export const complete = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
    const { data: result, error } = await client
      .from("user_tasks")
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

    return toUserTask(result as UserTaskRow);
  });
};

export const demote = async (id: string): Promise<UserTask> => {
  return withClient(async (client) => {
    const { data: task } = await client
      .from("user_tasks")
      .select("queue_level")
      .eq("id", id)
      .single();

    const currentLevel = (task as UserTaskRow | null)?.queue_level ?? 0;
    const newLevel = Math.min(currentLevel + 1, 2);

    const { data: result, error } = await client
      .from("user_tasks")
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

    return toUserTask(result as UserTaskRow);
  });
};

export const move = async (id: string, targetQueue: number | string): Promise<UserTask> => {
  return withClient(async (client) => {
    const targetLevel = typeof targetQueue === "number" ? targetQueue : parseInt(targetQueue, 10);

    const { data: result, error } = await client
      .from("user_tasks")
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

    return toUserTask(result as UserTaskRow);
  });
};

export const reorder = async (_queueLevel: number, taskIds: string[]): Promise<void> => {
  return withClient(async (client) => {
    for (let i = 0; i < taskIds.length; i++) {
      await client
        .from("user_tasks")
        .update({ position: i, updated_at: new Date().toISOString() })
        .eq("id", taskIds[i]);
    }
  });
};

export const generateDetails = async (title: string, context?: string) => {
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
    const { data: result, error } = await client
      .from("user_tasks")
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

    return toUserTask(result as UserTaskRow);
  });
};

export const getSmartRecommendation = async () => {
  return withClientOptionalUser(async (client, userId) => {
    if (!userId) {
      return { task: null, reason: "No user" };
    }

    const { data: tasks } = await client
      .from("user_tasks")
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
      task: toUserTask(tasks[0] as UserTaskRow),
      reason: "Highest priority pending task",
    };
  });
};

export const getDynamicPriority = async (taskId: string) => {
  return withClient(async (client) => {
    const { data: task } = await client
      .from("user_tasks")
      .select("priority, deadline, created_at")
      .eq("id", taskId)
      .single();

    if (!task) {
      return { priority: 0, factors: {} };
    }

    const taskRow = task as Pick<UserTaskRow, "priority" | "deadline" | "created_at">;
    let dynamicPriority = taskRow.priority || 0;
    const factors: Record<string, number> = {};

    if (taskRow.deadline) {
      const deadline = new Date(taskRow.deadline);
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

interface DependencyCheckRow {
  depends_on_task_id: string;
  dependency_type: string;
}

interface DependentTaskRow {
  id: string;
  title: string;
  status: string;
}

export const checkDependencies = async (taskId: string) => {
  return withClient(async (client) => {
    const { data: dependencies } = await client
      .from("task_dependencies")
      .select("depends_on_task_id, dependency_type")
      .eq("task_id", taskId);

    if (!dependencies || dependencies.length === 0) {
      return { can_start: true, blocked_by: [] };
    }

    const depRows = dependencies as DependencyCheckRow[];
    const dependentIds = depRows.map((d) => d.depends_on_task_id);

    const { data: dependentTasks } = await client
      .from("user_tasks")
      .select("id, title, status")
      .in("id", dependentIds);

    const blockedBy = (dependentTasks || [])
      .filter((t) => (t as DependentTaskRow).status !== "completed")
      .map((t) => {
        const row = t as DependentTaskRow;
        return {
          id: row.id,
          title: row.title,
          status: row.status,
        };
      });

    return {
      can_start: blockedBy.length === 0,
      blocked_by: blockedBy,
    };
  });
};
