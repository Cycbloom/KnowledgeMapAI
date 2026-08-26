import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../../middleware/auth";
import { appSettingsService } from "../../../services/core";
import { aiConfigRouteService } from "../../../services/ai";
import {
  getSupabaseAdmin,
  reinitializeSupabaseClients,
  getCurrentSupabaseConfig,
} from "../../../supabase";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { maskUrl } from "./shared";

const router = Router();

router.get(
  "/database",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    const config = getCurrentSupabaseConfig();
    const url = config.url || "";
    const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
    const mode = isLocal ? "local" : "cloud";

    // admin client: 系统级数据库连接健康检查，需绕过 RLS 探测全局数据库状态
    const result = await aiConfigRouteService.testDatabaseConnection(getSupabaseAdmin());
    const connected = result.connected;

    res.json({
      configured: !!url,
      url: url ? maskUrl(url) : "",
      mode,
      connected,
    });
  },
);

router.put(
  "/database",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { url, anonKey, serviceRoleKey, databaseUrl } = req.body as {
      url?: string;
      anonKey?: string;
      serviceRoleKey?: string;
      databaseUrl?: string;
    };

    if (!url) {
      throw new AppError("url is required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      new URL(url);
    } catch {
      throw new AppError("url is not a valid URL", 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!serviceRoleKey) {
      throw new AppError("serviceRoleKey is required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!anonKey) {
      throw new AppError("anonKey is required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    await appSettingsService.updateSetting("database_config", {
      url,
      anonKey,
      serviceRoleKey,
      ...(databaseUrl ? { databaseUrl } : {}),
    });

    const result = reinitializeSupabaseClients({
      url,
      serviceKey: serviceRoleKey,
      anonKey,
    });

    if (!result.success) {
      res.json({
        success: false,
        message: result.error || "Failed to reinitialize database clients",
      });
      return;
    }

    // admin client: 数据库重新初始化后的连接测试，需使用新配置的 admin client 验证连通性
    const admin = getSupabaseAdmin();
    const testResult = await aiConfigRouteService.testDatabaseConnectionWithConfig(admin);

    if (!testResult.connected) {
      res.json({
        success: false,
        message: `Database reinitialized but connection test failed: ${testResult.error || "Unknown error"}`,
      });
      return;
    }

    appSettingsService.clearCache();

    let schemaStatus = null;
    try {
      const { migrationService } =
        await import("../../../services/migration/migrationService");
      if (databaseUrl) {
        migrationService.setDatabaseUrl(databaseUrl);
      }
      schemaStatus = await migrationService.getDatabaseStatus();
    } catch {
      // migration service not available, skip schema status
    }

    res.json({
      success: true,
      message: "Database configuration updated successfully",
      schemaStatus,
    });
  },
);

export default router;
