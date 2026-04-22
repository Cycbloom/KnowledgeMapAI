import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import { logger } from "../../utils/logger";
import { subtaskStateMachine } from "../../services/scheduler/subtaskStateMachine";
import { subtaskKnowledgeSyncService } from "../../services/scheduler/subtaskKnowledgeSync";

const router = Router();

const createSubtaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "标题不能为空"),
    description: z.string().optional(),
    knowledge_point_id: z.string().uuid("无效的知识点ID"),
    priority: z.number().int().min(0).optional(),
    estimated_duration: z.number().int().min(0).optional(),
    due_date: z.string().datetime().optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
  }),
});

const updateSubtaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "标题不能为空").optional(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "completed"]).optional(),
    priority: z.number().int().min(0).optional(),
    estimated_duration: z.number().int().min(0).optional(),
    actual_duration: z.number().int().min(0).optional(),
    due_date: z.string().datetime().optional().nullable(),
    learning_state: z
      .enum(["learning", "review", "practice", "quiz"])
      .optional(),
    mastery_level: z.number().min(0).max(100).optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
    subtaskId: z.string().uuid("无效的子任务ID"),
  }),
});

const transitionSubtaskSchema = z.object({
  body: z.object({
    to_state: z.enum(["learning", "review", "practice", "quiz"]),
    mastery_level: z.number().min(0).max(100),
    reason: z.string().optional(),
  }),
  params: z.object({
    id: z.string().uuid("无效的任务ID"),
    subtaskId: z.string().uuid("无效的子任务ID"),
  }),
});

const subtaskParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
  subtaskId: z.string().uuid("无效的子任务ID"),
});

router.post(
  "/tasks/:id/subtasks",
  requireAuth,
  validate(createSubtaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const {
      title,
      description,
      knowledge_point_id,
      priority,
      estimated_duration,
      due_date,
    } = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: existingSubtask } = await supabase
      .from("task_subtasks")
      .select("id")
      .eq("task_id", id)
      .eq("knowledge_point_id", knowledge_point_id)
      .maybeSingle();

    if (existingSubtask) {
      return res.status(400).json({ error: "该知识点已关联到此任务" });
    }

    const { count } = await supabase
      .from("task_subtasks")
      .select("*", { count: "exact", head: true })
      .eq("task_id", id);

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .insert({
        task_id: id,
        title,
        description,
        knowledge_point_id,
        priority: priority ?? 0,
        position: count ?? 0,
        estimated_duration,
        due_date,
        status: "pending",
        learning_state: "learning",
        mastery_level: 0,
        last_state_change_at: new Date().toISOString(),
        state_history: [],
      })
      .select()
      .single();

    if (error) {
      logger.error("Create subtask error:", error);
      return res.status(500).json({ error: "创建子任务失败" });
    }

    res.status(201).json({ success: true, data: subtask });
  },
);

router.get(
  "/tasks/:id/subtasks",
  requireAuth,
  validate({ params: z.object({ id: z.string().uuid("无效的任务ID") }) }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: subtasks, error } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("task_id", id)
      .order("position", { ascending: true });

    if (error) {
      logger.error("Get subtasks error:", error);
      return res.status(500).json({ error: "获取子任务列表失败" });
    }

    res.json({ success: true, data: subtasks });
  },
);

router.put(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate(updateSubtaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;
    const updates = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    if (updates.status === "completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", subtaskId)
      .eq("task_id", id)
      .select()
      .single();

    if (error) {
      logger.error("Update subtask error:", error);
      return res.status(500).json({ error: "更新子任务失败" });
    }

    if (!subtask) {
      return res.status(404).json({ error: "子任务不存在" });
    }

    if (subtask.learning_path_node_id && updates.status === "completed") {
      try {
        await supabase
          .from("learning_path_nodes")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", subtask.learning_path_node_id);

        logger.info(
          `Synced subtask ${subtaskId} completion with learning path node ${subtask.learning_path_node_id}`,
        );
      } catch (syncError) {
        logger.error("Failed to sync with learning path node:", syncError);
      }
    }

    if (updates.learning_state || updates.mastery_level !== undefined) {
      try {
        await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
          supabase,
          subtaskId,
          updates.learning_state || subtask.learning_state,
          updates.mastery_level ?? subtask.mastery_level,
        );
      } catch (syncError) {
        logger.error("Failed to sync with knowledge point:", syncError);
      }
    }

    res.json({ success: true, data: subtask });
  },
);

router.delete(
  "/tasks/:id/subtasks/:subtaskId",
  requireAuth,
  validate({ params: subtaskParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;

    const { error } = await supabase
      .from("task_subtasks")
      .delete()
      .eq("id", subtaskId)
      .eq("task_id", id);

    if (error) {
      logger.error("Delete subtask error:", error);
      return res.status(500).json({ error: "删除子任务失败" });
    }

    res.json({ success: true });
  },
);

router.post(
  "/tasks/:id/subtasks/:subtaskId/transition",
  requireAuth,
  validate(transitionSubtaskSchema),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;
    const { to_state, mastery_level, reason } = req.body;

    const { data: task } = await supabase
      .from("scheduled_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .single();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: subtask, error: fetchError } = await supabase
      .from("task_subtasks")
      .select("*")
      .eq("id", subtaskId)
      .eq("task_id", id)
      .single();

    if (fetchError || !subtask) {
      return res.status(404).json({ error: "子任务不存在" });
    }

    const currentState = subtask.learning_state as
      | "learning"
      | "review"
      | "practice"
      | "quiz";

    if (!subtaskStateMachine.canTransition(currentState, to_state)) {
      const validTransitions =
        subtaskStateMachine.getValidTransitions(currentState);
      return res.status(400).json({
        error: `无效的状态转换: ${currentState} → ${to_state}`,
        validTransitions,
      });
    }

    const result = await subtaskStateMachine.transition(
      supabase,
      subtaskId,
      to_state,
      mastery_level,
      reason,
    );

    if (!result.success) {
      return res.status(500).json({ error: result.error || "状态转换失败" });
    }

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      to_state,
      mastery_level,
    );

    res.json({ success: true, data: result.subtask });
  },
);

router.patch(
  "/tasks/:id/subtasks/:subtaskId/mastery",
  requireAuth,
  validate({
    params: subtaskParamsSchema,
    body: z.object({
      mastery_level: z.number().min(0).max(100),
    }),
  }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;
    const { mastery_level } = req.body;

    const { data: subtask, error } = await supabase
      .from("task_subtasks")
      .update({
        mastery_level,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subtaskId)
      .eq("task_id", id)
      .select()
      .single();

    if (error || !subtask) {
      return res.status(500).json({ error: "更新掌握度失败" });
    }

    await subtaskKnowledgeSyncService.syncSubtaskStateToKnowledgePoint(
      supabase,
      subtaskId,
      subtask.learning_state,
      mastery_level,
    );

    res.json({ success: true, data: subtask });
  },
);

router.get(
  "/tasks/:id/subtasks/:subtaskId/valid-transitions",
  requireAuth,
  validate({ params: subtaskParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, subtaskId } = req.params;

    const { data: subtask } = await supabase
      .from("task_subtasks")
      .select("learning_state, mastery_level, state_history")
      .eq("id", subtaskId)
      .eq("task_id", id)
      .single();

    if (!subtask) {
      return res.status(404).json({ error: "子任务不存在" });
    }

    const currentState = subtask.learning_state as
      | "learning"
      | "review"
      | "practice"
      | "quiz";
    const validTransitions =
      subtaskStateMachine.getValidTransitions(currentState);
    const recommendedNext = subtaskStateMachine.getRecommendedNextState(
      currentState,
      subtask.mastery_level,
      subtask.state_history || [],
    );

    res.json({
      success: true,
      data: {
        current_state: currentState,
        mastery_level: subtask.mastery_level,
        valid_transitions: validTransitions,
        recommended_next: recommendedNext,
      },
    });
  },
);

export default router;
