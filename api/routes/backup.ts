import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { logger } from "../utils/logger";
import {
  readBackupFile,
  backupService,
} from "../services/common";
import fs from "fs/promises";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";

const router = Router();

router.get("/export", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const result = await backupService.exportAndRecord(req.supabase!, userId, "manual");

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
    throw new AppError((error as Error).message || "导出备份失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get(
  "/snapshots",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;

    try {
      const snapshots = await backupService.getSnapshots(req.supabase!, userId);
      res.json({ snapshots });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Get snapshots error:", error);
      throw new AppError((error as Error).message || "获取快照列表失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/snapshots",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { type = "manual" } = req.body;

    try {
      const result = await backupService.exportAndRecord(
        req.supabase!,
        userId,
        type as "auto_30min" | "auto_5hour" | "auto_1day" | "manual",
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
      throw new AppError((error as Error).message || "创建快照失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.delete(
  "/snapshots/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      await backupService.deleteSnapshot(req.supabase!, id, userId);
      res.json({ success: true, message: "快照已删除" });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Delete snapshot error:", error);
      if ((error as Error).message === "Snapshot not found") {
        throw new AppError("快照不存在", 404, ErrorCodes.NOT_FOUND);
      }
      throw new AppError((error as Error).message || "删除快照失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post(
  "/restore/:id",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const snapshot = await backupService.getSnapshot(
        req.supabase!,
        id,
        userId,
      );
      if (!snapshot) {
        throw new AppError("快照不存在", 404, ErrorCodes.NOT_FOUND);
      }

      const backupData = await readBackupFile(snapshot.file_path);

      const { stats } = await backupService.importBackup(
        req.supabase!,
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
      throw new AppError((error as Error).message || "恢复快照失败", 500, ErrorCodes.INTERNAL_ERROR);
    }
  },
);

router.post("/import", requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const backupData = req.body;
  const mode = req.query.mode || "merge";

  if (!backupData || !backupData.data) {
    throw new AppError("无效的备份数据格式", 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const { stats, mode: appliedMode } = await backupService.importBackup(
      req.supabase!,
      userId,
      backupData.data,
      mode as string,
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
    throw new AppError((error as Error).message || "导入备份失败", 500, ErrorCodes.INTERNAL_ERROR);
  }
});

export default router;
