import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../../middleware/auth";
import { appSettingsService } from "../../../services/core";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { PROVIDER_DEFAULTS, hasEnvFallback } from "./shared";

const router = Router();

router.get(
  "/embedding",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const sysConfig = await appSettingsService.getSetting<{
        embedding_ai?: { provider?: string; model?: string; baseURL?: string };
      }>("system_config");

      const embeddingAi = sysConfig?.embedding_ai;
      const provider = embeddingAi?.provider || "";

      let configured = false;
      let source: "user" | "env" | "none" = "none";

      if (provider) {
        const allConfigs =
          await appSettingsService.getSetting<
            Record<string, Record<string, string>>
          >("ai_provider_config");
        const dbConfig = allConfigs?.[provider];
        if (dbConfig?.apiKey) {
          configured = true;
          source = "user";
        } else if (hasEnvFallback(provider)) {
          configured = true;
          source = "env";
        }
      }

      const defaults = provider ? PROVIDER_DEFAULTS[provider] : undefined;

      res.json({
        provider: provider || undefined,
        model:
          embeddingAi?.model ||
          defaults?.model ||
          defaults?.embeddingModel ||
          undefined,
        baseURL: embeddingAi?.baseURL || defaults?.baseURL || undefined,
        configured,
        source,
      });
    } catch (error) {
      logger.error("Failed to get embedding config:", error);
      throw new AppError("Failed to get embedding config", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.put(
  "/embedding",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { provider, model, enabled } = req.body as {
        provider?: string;
        model?: string;
        enabled?: boolean;
      };

      if (enabled === false || (!provider && enabled === undefined)) {
        const sysConfig =
          (await appSettingsService.getSetting<Record<string, unknown>>(
            "system_config",
          )) || {};

        if (sysConfig.embedding_ai) {
          delete sysConfig.embedding_ai;
          await appSettingsService.updateSetting("system_config", sysConfig);
          appSettingsService.clearCache();
        }

        res.json({ success: true });
        return;
      }

      if (!provider) {
        throw new AppError("provider is required", 400, ErrorCodes.VALIDATION_ERROR);
      }

      const sysConfig =
        (await appSettingsService.getSetting<Record<string, unknown>>(
          "system_config",
        )) || {};

      sysConfig.embedding_ai = {
        provider,
        ...(model ? { model } : {}),
      };

      await appSettingsService.updateSetting("system_config", sysConfig);

      appSettingsService.clearCache();

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to update embedding config:", error);
      throw new AppError("Failed to update embedding config", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

export default router;
