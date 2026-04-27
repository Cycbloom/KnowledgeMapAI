import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { z } from "zod";
import {
  createTaskDependencySchema,
  taskDependencyParamsSchema,
} from "../../schemas/index";
import { logger } from "../../utils/logger";

const router = Router();

const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的任务ID"),
});

async function checkCircularDependency(
  supabase: any,
  taskId: string,
  dependsOnTaskId: string,
  userId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  const queue: string[] = [dependsOnTaskId];

  while (queue.length > 0) {
    const currentTaskId = queue.shift()!;

    if (currentTaskId === taskId) {
      return true;
    }

    if (visited.has(currentTaskId)) {
      continue;
    }
    visited.add(currentTaskId);

    const { data: dependencies } = await supabase
      .from("task_dependencies")
      .select("depends_on_task_id")
      .eq("task_id", currentTaskId)
      .eq("user_id", userId);

    for (const dep of dependencies || []) {
      if (!visited.has(dep.depends_on_task_id)) {
        queue.push(dep.depends_on_task_id);
      }
    }
  }

  return false;
}

router.post(
  "/tasks/:id/dependencies",
  requireAuth,
  validate({ params: uuidParamsSchema, body: createTaskDependencySchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;
    const { depends_on_task_id, dependency_type } = req.body;

    if (id === depends_on_task_id) {
      return res.status(400).json({ error: "任务不能依赖自身" });
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("user_tasks")
      .select("id")
      .in("id", [id, depends_on_task_id])
      .eq("user_id", req.user.id)
      .is("deleted_at", null);

    if (tasksError) {
      return res.status(500).json({ error: "查询任务失败" });
    }

    if (!tasks || tasks.length !== 2) {
      return res.status(404).json({ error: "一个或多个任务不存在" });
    }

    const { data: existingDep } = await supabase
      .from("task_dependencies")
      .select("id")
      .eq("task_id", id)
      .eq("depends_on_task_id", depends_on_task_id)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (existingDep) {
      return res.status(400).json({ error: "该依赖关系已存在" });
    }

    const hasCircular = await checkCircularDependency(
      supabase,
      id,
      depends_on_task_id,
      req.user.id,
    );

    if (hasCircular) {
      return res.status(400).json({ error: "添加此依赖会形成循环依赖" });
    }

    const { data: dependency, error } = await supabase
      .from("task_dependencies")
      .insert({
        task_id: id,
        depends_on_task_id,
        dependency_type: dependency_type ?? "strict",
        user_id: req.user.id,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create dependency error:", error);
      return res.status(500).json({ error: "创建依赖关系失败" });
    }

    res.status(201).json({ success: true, data: dependency });
  },
);

router.delete(
  "/tasks/:id/dependencies/:dependencyId",
  requireAuth,
  validate({ params: taskDependencyParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id, dependencyId } = req.params;

    const { error } = await supabase
      .from("task_dependencies")
      .delete()
      .eq("id", dependencyId)
      .eq("task_id", id)
      .eq("user_id", req.user.id);

    if (error) {
      return res.status(500).json({ error: "删除依赖关系失败" });
    }

    res.json({ success: true });
  },
);

router.get(
  "/tasks/:id/dependencies",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: task } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: dependencies, error } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, depends_on_task_id, user_tasks!task_dependencies_depends_on_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("task_id", id)
      .eq("user_id", req.user.id);

    if (error) {
      logger.error("Get dependencies error:", error);
      return res.status(500).json({ error: "获取依赖列表失败" });
    }

    const formattedDeps = (dependencies || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: dep.user_tasks,
    }));

    res.json({ success: true, data: formattedDeps });
  },
);

router.get(
  "/tasks/:id/dependents",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthRequest, res: Response) => {
    const supabase = req.supabase;
    if (!supabase) {
      return res
        .status(500)
        .json({ error: "Database connection not available" });
    }

    const { id } = req.params;

    const { data: task } = await supabase
      .from("user_tasks")
      .select("id")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!task) {
      return res.status(404).json({ error: "任务不存在" });
    }

    const { data: dependents, error } = await supabase
      .from("task_dependencies")
      .select(
        "id, dependency_type, created_at, task_id, user_tasks!task_dependencies_task_id_fkey(id, title, description, status, queue_level, priority)",
      )
      .eq("depends_on_task_id", id)
      .eq("user_id", req.user.id);

    if (error) {
      logger.error("Get dependents error:", error);
      return res.status(500).json({ error: "获取后置任务列表失败" });
    }

    const formattedDeps = (dependents || []).map((dep) => ({
      id: dep.id,
      dependency_type: dep.dependency_type,
      created_at: dep.created_at,
      task: dep.user_tasks,
    }));

    res.json({ success: true, data: formattedDeps });
  },
);

export default router;
