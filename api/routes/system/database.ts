import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { migrationService } from "../../services/migration/migrationService";
import {
  reinitializeSupabaseClients,
  getCurrentSupabaseConfig,
} from "../../supabase";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

router.get(
  "/status",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const status = await migrationService.getDatabaseStatus();
      res.json(status);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      if (message.includes("Database URL is not configured")) {
        res.json({
          status: "not_configured",
          executedVersions: [],
          missingVersions: [],
          totalMigrations: 0,
          executedCount: 0,
          error: "Database URL not configured",
        });
        return;
      }
      logger.error("Failed to get database status:", error);
      throw new AppError("Failed to get database status", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/migrate",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const results = await migrationService.executeMigrations();
      res.json({ success: true, results });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to execute migrations:", error);
      res.json({ success: false, error: message });
    }
  },
);

router.get(
  "/migrations",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const migrations = await migrationService.getMigrationHistory();
      res.json({ migrations });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to get migration history:", error);
      res.json({ migrations: [], error: message });
    }
  },
);

router.post(
  "/reinitialize",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { confirm } = req.body as { confirm?: boolean };

      if (!confirm) {
        throw new AppError(
          "This operation will drop all tables. Set 'confirm: true' in the request body to proceed.",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const config = getCurrentSupabaseConfig();
      const databaseUrl =
        process.env.DATABASE_URL || config.serviceKey
          ? `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD || "postgres"}@${config.url?.replace("http", "postgresql").replace(/:\d+/, ":5432")}/postgres`
          : "";

      if (!databaseUrl) {
        res.json({
          success: false,
          error: "Database URL not configured",
        });
        return;
      }

      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: databaseUrl, max: 1 });

      try {
        await pool.query(`
          DROP SCHEMA public CASCADE;
          CREATE SCHEMA public;
          GRANT ALL ON SCHEMA public TO postgres;
          GRANT ALL ON SCHEMA public TO public;
        `);
        logger.warn("Database schema dropped and recreated");
      } finally {
        await pool.end();
      }

      const results = await migrationService.executeMigrations();

      reinitializeSupabaseClients({
        url: config.url ?? "",
        serviceKey: config.serviceKey ?? "",
        anonKey: config.anonKey ?? "",
      });

      res.json({ success: true, results });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to reinitialize database:", error);
      res.json({ success: false, error: message });
    }
  },
);

export default router;
