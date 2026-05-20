import { logger } from "../../../utils/logger";
import { appEventBus } from "../../core/eventBus";
import type {
  UserTaskStatus,
  TaskStartedPayload,
  TaskPausedPayload,
  TaskResumedPayload,
  TaskCompletedPayload,
} from "../../../../shared/types/scheduler";

interface TransitionResult {
  success: boolean;
  task?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  error?: string;
}

type TransitionSideEffect = (
  supabase: any,
  taskId: string,
  userId: string,
  fromState: UserTaskStatus,
  toState: UserTaskStatus,
  taskData?: Record<string, unknown>,
) => Promise<Record<string, unknown> | undefined>;

interface TransitionConfig {
  to: UserTaskStatus;
  sideEffect?: TransitionSideEffect;
  eventType?: string;
  eventPayloadBuilder?: (
    taskId: string,
    userId: string,
    taskData: Record<string, unknown>,
    sideEffectResult?: Record<string, unknown>,
  ) => { payload: unknown; source?: string };
}

const VALID_TRANSITIONS: Record<UserTaskStatus, TransitionConfig[]> = {
  pending: [
    {
      to: "in_progress",
      sideEffect: async (supabase, taskId, userId, _from, _to, taskData) => {
        const { data: execution, error } = await supabase
          .from("task_executions")
          .insert({
            task_id: taskId,
            user_id: userId,
            started_at: new Date().toISOString(),
            queue_level: taskData?.queue_level ?? 0,
          })
          .select()
          .single();

        if (error) {
          logger.error("Create execution error:", error);
          return undefined;
        }
        return execution;
      },
      eventType: "task_started",
      eventPayloadBuilder: (taskId, _userId, taskData, _sideEffectResult) => ({
        payload: {
          taskId,
          queueLevel: taskData?.queue_level ?? 0,
          knowledgePointId: taskData?.knowledge_point_id,
        } as TaskStartedPayload,
      }),
    },
    {
      to: "cancelled",
    },
  ],
  in_progress: [
    {
      to: "paused",
      sideEffect: async (supabase, taskId, userId) => {
        const { data: execution } = await supabase
          .from("task_executions")
          .select("*")
          .eq("task_id", taskId)
          .eq("user_id", userId)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let duration = 0;
        if (execution) {
          const startedAt = new Date(execution.started_at);
          const endedAt = new Date();
          duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

          await supabase
            .from("task_executions")
            .update({
              ended_at: endedAt.toISOString(),
              duration,
              status: "interrupted",
            })
            .eq("id", execution.id);
        }

        return { duration };
      },
      eventType: "task_paused",
      eventPayloadBuilder: (taskId, _userId, _taskData, sideEffectResult) => ({
        payload: {
          taskId,
          duration: sideEffectResult?.duration ?? 0,
        } as TaskPausedPayload,
      }),
    },
    {
      to: "completed",
      sideEffect: async (supabase, taskId, userId, _from, _to, _taskData) => {
        const { data: execution } = await supabase
          .from("task_executions")
          .select("*")
          .eq("task_id", taskId)
          .eq("user_id", userId)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (execution) {
          const startedAt = new Date(execution.started_at);
          const endedAt = new Date();
          const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

          await supabase
            .from("task_executions")
            .update({
              ended_at: endedAt.toISOString(),
              duration,
              status: "completed",
            })
            .eq("id", execution.id);
        } else {
          const { data: lastExecution } = await supabase
            .from("task_executions")
            .select("*")
            .eq("task_id", taskId)
            .eq("user_id", userId)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastExecution) {
            await supabase
              .from("task_executions")
              .update({ status: "completed" })
              .eq("id", lastExecution.id);
          } else {
            await supabase.from("task_executions").insert({
              task_id: taskId,
              user_id: userId,
              started_at: new Date().toISOString(),
              ended_at: new Date().toISOString(),
              duration: 0,
              status: "completed",
            });
          }
        }

        return {};
      },
      eventType: "task_completed",
      eventPayloadBuilder: (taskId, _userId, taskData, _sideEffectResult) => ({
        payload: {
          taskId,
          queueLevel: taskData?.queue_level ?? 0,
          actualDuration: taskData?.actual_duration,
          knowledgePointId: taskData?.knowledge_point_id,
          tags: taskData?.tags ?? [],
        } as TaskCompletedPayload,
      }),
    },
    {
      to: "cancelled",
    },
  ],
  paused: [
    {
      to: "in_progress",
      sideEffect: async (supabase, taskId, userId, _from, _to, taskData) => {
        const { data: execution, error } = await supabase
          .from("task_executions")
          .insert({
            task_id: taskId,
            user_id: userId,
            started_at: new Date().toISOString(),
            queue_level: taskData?.queue_level ?? 0,
          })
          .select()
          .single();

        if (error) {
          logger.error("Create execution on resume error:", error);
          return undefined;
        }
        return execution;
      },
      eventType: "task_resumed",
      eventPayloadBuilder: (taskId, _userId, _taskData, _sideEffectResult) => ({
        payload: {
          taskId,
        } as TaskResumedPayload,
      }),
    },
    {
      to: "cancelled",
    },
  ],
  completed: [],
  cancelled: [],
};

class TaskStateMachine {
  canTransition(from: UserTaskStatus, to: UserTaskStatus): boolean {
    const transitions = VALID_TRANSITIONS[from];
    if (!transitions) return false;
    return transitions.some((t) => t.to === to);
  }

  getValidTransitions(from: UserTaskStatus): UserTaskStatus[] {
    return (VALID_TRANSITIONS[from] ?? []).map((t) => t.to);
  }

  async transition(
    supabase: any,
    taskId: string,
    userId: string,
    fromState: UserTaskStatus,
    toState: UserTaskStatus,
    additionalData?: Record<string, unknown>,
  ): Promise<TransitionResult> {
    const transitions = VALID_TRANSITIONS[fromState];
    if (!transitions) {
      return {
        success: false,
        error: `Invalid source state: ${fromState}`,
      };
    }

    const transitionConfig = transitions.find((t) => t.to === toState);
    if (!transitionConfig) {
      return {
        success: false,
        error: `Invalid transition: ${fromState} → ${toState}. Valid transitions: ${transitions.map((t) => t.to).join(", ")}`,
      };
    }

    const updateData: Record<string, unknown> = {
      status: toState,
      ...additionalData,
    };

    if (toState === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .update(updateData)
      .eq("id", taskId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .select()
      .single();

    if (taskError || !task) {
      return {
        success: false,
        error: taskError?.message ?? "Task not found or update failed",
      };
    }

    let sideEffectResult: Record<string, unknown> | undefined;
    if (transitionConfig.sideEffect) {
      try {
        sideEffectResult = await transitionConfig.sideEffect(
          supabase,
          taskId,
          userId,
          fromState,
          toState,
          task,
        );
      } catch (error) {
        logger.error(
          `[StateMachine] Side effect failed for ${fromState} → ${toState}:`,
          error,
        );
      }
    }

    if (transitionConfig.eventType && transitionConfig.eventPayloadBuilder) {
      try {
        const { payload, source } = transitionConfig.eventPayloadBuilder(
          taskId,
          userId,
          task,
          sideEffectResult,
        );
        await appEventBus.publish(
          transitionConfig.eventType as any,
          payload,
          userId,
          source ?? "task_state_machine",
        );
      } catch (error) {
        logger.error(
          `[StateMachine] Event publish failed for ${fromState} → ${toState}:`,
          error,
        );
      }
    }

    logger.info(
      `[StateMachine] Task ${taskId}: ${fromState} → ${toState}`,
    );

    return {
      success: true,
      task,
      execution: sideEffectResult,
    };
  }
}

export const taskStateMachine = new TaskStateMachine();
export { TaskStateMachine };
