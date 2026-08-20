import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../../middleware/auth";
import { appSettingsService } from "../../../services/core";
import { clearProviderCache } from "../../../services/ai";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { PROVIDER_DEFAULTS, hasEnvFallback } from "./shared";

const router = Router();

router.get(
  "/main-ai",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const sysConfig = await appSettingsService.getSetting<{
        main_ai?: { provider?: string; model?: string; baseURL?: string };
      }>("system_config");

      const mainAi = sysConfig?.main_ai;
      const provider = mainAi?.provider || "";

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
        model: mainAi?.model || defaults?.model || undefined,
        baseURL: mainAi?.baseURL || defaults?.baseURL || undefined,
        configured,
        source,
      });
    } catch (error) {
      logger.error("Failed to get main AI config:", error);
      throw new AppError("Failed to get main AI config", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.put("/main-ai", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { provider, model } = req.body as {
      provider?: string;
      model?: string;
    };

    if (!provider) {
      throw new AppError("provider is required", 400, ErrorCodes.VALIDATION_ERROR);
    }

    const sysConfig =
      (await appSettingsService.getSetting<Record<string, unknown>>(
        "system_config",
      )) || {};

    sysConfig.main_ai = {
      provider,
      ...(model ? { model } : {}),
    };

    await appSettingsService.updateSetting("system_config", sysConfig);

    appSettingsService.clearCache();
    // 失效 provider 单例：用户切换生成模型或其 provider 后，旧构造的 provider
    // 实例（已绑定旧 model/apiKey）必须丢弃，否则真实调用仍用旧配置。
    clearProviderCache();

    res.json({ success: true });
  } catch (error) {
    logger.error("Failed to update main AI config:", error);
    throw new AppError("Failed to update main AI config", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
