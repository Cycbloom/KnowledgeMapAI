import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { uuidParamsSchema } from "../../schemas";
import { logger } from "../../utils/logger";
import {
  readBackupFile,
  backupService,
} from "../../services/common";
import fs from "fs/promises";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

/** 快照类型：用于文件名拼接，必须枚举校验以阻止路径注入 */
const snapshotTypeSchema = z.enum(["auto_30min", "auto_5hour", "auto_1day", "manual"]);

/** 导入模式 */
const importModeSchema = z.enum(["merge", "replace"]);

/** 备份导入载荷：校验结构并对各数据集设上限，防止超大请求耗尽资源 */
const backupImportSchema = z.object({
  version: z.string().optional(),
  exportedAt: z.string().optional(),
  user: z.object({ id: z.string(), email: z.string().optional() }).optional(),
  data: z.object({
    graphs: z.array(z.any()).max(500).optional(),
    knowledge_points: z.array(z.any()).max(10000).optional(),
    graph_nodes: z.array(z.any()).max(10000).optional(),
    edges: z.array(z.any()).max(10000).optional(),
    knowledge_point_versions: z.array(z.any()).max(20000).optional(),
    graph_backbone_modules: z.array(z.any()).max(1000).optional(),
    graph_snapshots: z.array(z.any()).max(2000).optional(),
    graph_events: z.array(z.any()).max(5000).optional(),
    literature_sources: z.array(z.any()).max(2000).optional(),
    graph_domains: z.array(z.any()).max(2000).optional(),
    graph_relations: z.array(z.any()).max(2000).optional(),
    domains: z.array(z.any()).max(1000).optional(),
    relationship_types: z.array(z.any()).max(500).optional(),
    study_cards: z.array(z.any()).max(5000).optional(),
    study_progress: z.array(z.any()).max(500).optional(),
    quiz_sets: z.array(z.any()).max(1000).optional(),
    quiz_set_cards: z.array(z.any()).max(5000).optional(),
    learning_sessions: z.array(z.any()).max(10000).optional(),
    learning_session_results: z.array(z.any()).max(30000).optional(),
    queues: z.array(z.any()).max(100).optional(),
    user_tasks: z.array(z.any()).max(3000).optional(),
    task_tags: z.array(z.any()).max(500).optional(),
    task_settings: z.array(z.any()).max(10).optional(),
    task_dependencies: z.array(z.any()).max(5000).optional(),
    task_schedules: z.array(z.any()).max(1000).optional(),
    task_progress_plans: z.array(z.any()).max(10000).optional(),
    user_time_slots: z.array(z.any()).max(1000).optional(),
    task_subtasks: z.array(z.any()).max(10000).optional(),
    task_links: z.array(z.any()).max(5000).optional(),
    task_knowledge_points: z.array(z.any()).max(5000).optional(),
    task_reviews: z.array(z.any()).max(3000).optional(),
    task_templates: z.array(z.any()).max(500).optional(),
    scheduler_weight_profiles: z.array(z.any()).max(10).optional(),
    learning_paths: z.array(z.any()).max(500).optional(),
    learning_path_nodes: z.array(z.any()).max(5000).optional(),
    learning_path_prerequisites: z.array(z.any()).max(10000).optional(),
    learning_path_progress: z.array(z.any()).max(5000).optional(),
    path_node_tasks: z.array(z.any()).max(5000).optional(),
    learning_loops: z.array(z.any()).max(3000).optional(),
    note_templates: z.array(z.any()).max(200).optional(),
    notes: z.array(z.any()).max(10000).optional(),
    note_node_links: z.array(z.any()).max(10000).optional(),
    note_block_refs: z.array(z.any()).max(10000).optional(),
    focus_sessions: z.array(z.any()).max(10000).optional(),
    user_efficiency_profile: z.array(z.any()).max(10).optional(),
    user_achievements: z.array(z.any()).max(2000).optional(),
    periodic_tasks: z.array(z.any()).max(2000).optional(),
    periodic_passes: z.array(z.any()).max(200).optional(),
    user_pass_progress: z.array(z.any()).max(2000).optional(),
    user_focus_stats: z.array(z.any()).max(10).optional(),
    agent_sessions: z.array(z.any()).max(2000).optional(),
    agent_messages: z.array(z.any()).max(20000).optional(),
    agent_tool_calls: z.array(z.any()).max(20000).optional(),
    agent_pending_actions: z.array(z.any()).max(5000).optional(),
    installed_plugins: z.array(z.any()).max(500).optional(),
    learning_material_schemas: z.array(z.any()).max(500).optional(),
    notification_settings: z.array(z.any()).max(10).optional(),
    backbone_modules: z.array(z.any()).max(1000).optional(),
    nodes: z.array(z.any()).max(10000).optional(),
  }),
});

router.get("/export", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const result = await backupService.exportAndRecord(req.supabase, userId, "manual");

    const content = await fs.readFile(result.filePath, "utf-8");

    res.setHeader("Content-Type", "application/json");
    // 使用东八区（UTC+8）本地日期格式化文件名
    const now = new Date();
    const beijingDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const dateStr = beijingDate.toISOString().split("T")[0];
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="knowledgemap-backup-${dateStr}.json"`,
    );
    res.send(content);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error("Export backup error:", error);
    throw new AppError((error as Error).message || "导出备份失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.get(
  "/snapshots",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user.id;

    try {
      const snapshots = await backupService.getSnapshots(req.supabase, userId);
      res.json({ snapshots });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Get snapshots error:", error);
      throw new AppError((error as Error).message || "获取快照列表失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/snapshots",
  requireAuth,
  validate({ body: z.object({ type: snapshotTypeSchema.optional() }) }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user.id;
    const { type } = req.body as { type?: "auto_30min" | "auto_5hour" | "auto_1day" | "manual" };

    try {
      const result = await backupService.exportAndRecord(
        req.supabase,
        userId,
        type ?? "manual",
      );

      res.json({
        success: true,
        message: "快照创建成功",
        snapshot: {
          file_size: result.fileSize,
          graphs_count: result.graphsCount,
          nodes_count: result.nodesCount,
        },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Create snapshot error:", error);
      throw new AppError((error as Error).message || "创建快照失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.delete(
  "/snapshots/:id",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      await backupService.deleteSnapshot(req.supabase, id, userId);
      res.json({ success: true, message: "快照已删除" });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Delete snapshot error:", error);
      if ((error as Error).message === "Snapshot not found") {
        throw new AppError("快照不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      throw new AppError((error as Error).message || "删除快照失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/restore/:id",
  requireAuth,
  validate({ params: uuidParamsSchema }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const snapshot = await backupService.getSnapshot(
        req.supabase,
        id,
        userId,
      );
      if (!snapshot) {
        throw new AppError("快照不存在", 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const backupData = await readBackupFile(snapshot.file_path);

      const { stats } = await backupService.importBackup(
        req.supabase,
        userId,
        backupData.data,
        "replace",
      );

      res.json({
        success: true,
        message: "快照恢复成功",
        stats,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Restore snapshot error:", error);
      throw new AppError((error as Error).message || "恢复快照失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/import",
  requireAuth,
  validate({
    body: backupImportSchema,
    query: z.object({ mode: importModeSchema.optional() }),
  }),
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user.id;
    const backupData = req.body;
    const mode = (req.query.mode as string | undefined) || "merge";

    try {
      const { stats, mode: appliedMode } = await backupService.importBackup(
        req.supabase,
        userId,
        backupData.data,
        mode,
      );

      res.json({
        success: true,
        message: appliedMode === "replace" ? "快照恢复成功" : "备份导入成功",
        stats,
        mode: appliedMode,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Import backup error:", error);
      throw new AppError((error as Error).message || "导入备份失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
});

export default router;
