import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../../middleware/auth";
import { appSettingsService } from "../../../services/core";
import { clearProviderCache } from "../../../services/ai";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { PROVIDER_DEFAULTS, hasEnvFallback } from "./shared";

const router = Router();

router.get(
  "/embedding",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
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

    // NOTE: 只回退 defaults?.embeddingModel，禁止使用 defaults?.model（生成模型）。
    // 之前错误地把生成模型放在 embedding 模型前面作为回退，会导致向量化接口
    // 用错模型（比如 volcengine 里变成 doubao-seed-1-8-251228），最终
    // createEmbedding 报 "Failed to generate embedding"。
    const fallbackEmbeddingModel = defaults?.embeddingModel;

    res.json({
      provider: provider || undefined,
      model:
        (embeddingAi?.model && embeddingAi.model.trim() ? embeddingAi.model : undefined) ||
        fallbackEmbeddingModel ||
        undefined,
      baseURL: embeddingAi?.baseURL || defaults?.baseURL || undefined,
      configured,
      source,
    });
  },
);

router.put(
  "/embedding",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
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

    const defaults = PROVIDER_DEFAULTS[provider];
    const normalizedModel =
      (model && model.trim()) || defaults?.embeddingModel;

    const sysConfig =
      (await appSettingsService.getSetting<Record<string, unknown>>(
        "system_config",
      )) || {};

    sysConfig.embedding_ai = {
      provider,
      ...(normalizedModel ? { model: normalizedModel } : {}),
    };

    await appSettingsService.updateSetting("system_config", sysConfig);

    appSettingsService.clearCache();
    // 失效 provider 单例：用户切换 embedding 模型或其 provider 后，
    // 旧 provider 实例（已绑定旧 embeddingModel）必须丢弃，否则真实
    // 调用仍用旧模型（比如"测试通过但 embedding 生成失败"的典型表现）。
    clearProviderCache();

    res.json({ success: true });
  },
);

export default router;
