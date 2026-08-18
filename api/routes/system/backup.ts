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
    nodes: z.array(z.any()).max(5000).optional(),
    edges: z.array(z.any()).max(10000).optional(),
    study_cards: z.array(z.any()).max(5000).optional(),
    study_progress: z.array(z.any()).max(500).optional(),
    focus_sessions: z.array(z.any()).max(10000).optional(),
    user_achievements: z.array(z.any()).max(2000).optional(),
    periodic_tasks: z.array(z.any()).max(2000).optional(),
    backbone_modules: z.array(z.any()).max(1000).optional(),
  }),
});

router.get("/export", requireAuth, async (req: AuthedRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const result = await backupService.exportAndRecord(req.supabase, userId, "manual");

    const content = await fs.readFile(result.filePath, "utf-8");

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="knowledgemap-backup-${new Date().toISOString().split("T")[0]}.json"`,
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
