import { Router, type Response } from "express";
import OpenAI from "openai";
import type { AIProviderType } from "@shared/types";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { appSettingsService } from "../../services/core";
import { aiConfigRouteService } from "../../services/ai";
import { getEnvConfig } from "../../services/ai";
import { logger } from "../../utils/logger";
import {
  getSupabaseAdmin,
  reinitializeSupabaseClients,
  getCurrentSupabaseConfig,
} from "../../supabase";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

const router = Router();

const PROVIDER_ENV_KEY_MAP: Record<string, string[]> = {
  deepseek: ["DEEPSEEK_API_KEY", "AI_API_KEY"],
  volcengine: ["VOLCENGINE_API_KEY"],
  aliyun: ["ALIYUN_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  zhipu: ["ZHIPU_API_KEY"],
  moonshot: ["MOONSHOT_API_KEY"],
};

const PROVIDER_DEFAULTS: Record<
  string,
  { baseURL: string; model: string; embeddingModel?: string }
> = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  volcengine: {
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-8-251228",
    embeddingModel: "doubao-embedding-vision-251215",
  },
  aliyun: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-long-latest",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  zhipu: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
  },
  moonshot: {
    baseURL: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
};

function maskApiKey(key: string): string {
  if (!key || key.length <= 8) {
    return "****";
  }
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
      return `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
    }
    const parts = parsed.hostname.split(".");
    if (parts.length >= 2) {
      return `${parsed.protocol}//****.${parts.slice(-2).join(".")}`;
    }
    return `${parsed.protocol}//****`;
  } catch {
    return "****";
  }
}

function hasEnvFallback(provider: string): boolean {
  const envKeys = PROVIDER_ENV_KEY_MAP[provider];
  if (!envKeys) return false;
  return envKeys.some((key) => !!process.env[key]);
}

router.get(
  "/providers",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const allConfigs =
        await appSettingsService.getSetting<
          Record<string, Record<string, string>>
        >("ai_provider_config");

      const providers: Record<string, Record<string, unknown>> = {};
      const allProviderTypes: AIProviderType[] = [
        "deepseek",
        "volcengine",
        "aliyun",
        "openai",
        "zhipu",
        "moonshot",
      ];

      for (const provider of allProviderTypes) {
        const dbConfig = allConfigs?.[provider];
        const envAvailable = hasEnvFallback(provider);
        const defaults = PROVIDER_DEFAULTS[provider];

        if (dbConfig?.apiKey) {
          providers[provider] = {
            configured: true,
            apiKey: maskApiKey(dbConfig.apiKey),
            baseURL: dbConfig.baseURL || defaults.baseURL,
            model: dbConfig.model || defaults.model,
            ...(dbConfig.embeddingModel || defaults.embeddingModel
              ? {
                  embeddingModel:
                    dbConfig.embeddingModel || defaults.embeddingModel,
                }
              : {}),
            source: "user",
          };
        } else if (envAvailable) {
          providers[provider] = {
            configured: true,
            source: "env",
          };
        } else {
          providers[provider] = {
            configured: false,
            source: "none",
          };
        }
      }

      res.json({ providers });
    } catch (error) {
      logger.error("Failed to get provider configs:", error);
      throw new AppError("Failed to get provider configs", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.put(
  "/providers",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { providers } = req.body as {
        providers: Record<
          string,
          {
            apiKey?: string;
            baseURL?: string;
            model?: string;
            embeddingModel?: string;
          }
        >;
      };

      if (!providers || typeof providers !== "object") {
        throw new AppError("providers object is required", 400, ErrorCodes.VALIDATION_ERROR);
      }

      for (const [provider, config] of Object.entries(providers)) {
        if (config.apiKey !== undefined && config.apiKey === "") {
          throw new AppError(`apiKey for ${provider} must be non-empty if provided`, 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (config.baseURL !== undefined) {
          try {
            new URL(config.baseURL);
          } catch {
            throw new AppError(`baseURL for ${provider} is not a valid URL`, 400, ErrorCodes.VALIDATION_ERROR);
          }
        }
      }

      const existingConfigs =
        (await appSettingsService.getSetting<
          Record<string, Record<string, string>>
        >("ai_provider_config")) || {};

      const merged = { ...existingConfigs };

      for (const [provider, config] of Object.entries(providers)) {
        merged[provider] = {
          ...(merged[provider] || {}),
          ...Object.fromEntries(
            Object.entries(config).filter(([, v]) => v !== undefined),
          ),
        };
      }

      await appSettingsService.updateSetting("ai_provider_config", merged);

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to update provider configs:", error);
      throw new AppError("Failed to update provider configs", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.post(
  "/providers/test",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { provider, apiKey, baseURL, model } = req.body as {
        provider: string;
        apiKey?: string;
        baseURL?: string;
        model?: string;
      };

      if (!provider) {
        throw new AppError("provider is required", 400, ErrorCodes.VALIDATION_ERROR);
      }

      let testApiKey = apiKey;
      let testBaseURL = baseURL;
      let testModel = model;

      if (!testApiKey || !testBaseURL) {
        const allConfigs =
          await appSettingsService.getSetting<
            Record<string, Record<string, string>>
          >("ai_provider_config");
        const dbConfig = allConfigs?.[provider];
        const defaults = PROVIDER_DEFAULTS[provider];
        const envConfig = getEnvConfig(provider as AIProviderType);

        testApiKey = testApiKey || dbConfig?.apiKey || envConfig.apiKey || "";
        testBaseURL =
          testBaseURL ||
          dbConfig?.baseURL ||
          envConfig.baseURL ||
          defaults?.baseURL ||
          "";
        testModel =
          testModel ||
          dbConfig?.model ||
          envConfig.model ||
          defaults?.model ||
          "";
      }

      if (!testApiKey) {
        res.json({
          success: false,
          message: "No API key available for testing",
        });
        return;
      }

      if (!testBaseURL) {
        res.json({
          success: false,
          message: "No base URL available for testing",
        });
        return;
      }

      const client = new OpenAI({
        apiKey: testApiKey,
        baseURL: testBaseURL,
      });

      const isEmbeddingModel =
        testModel?.includes("embedding") ||
        Object.values(PROVIDER_DEFAULTS).some(
          (d) => d.embeddingModel === testModel,
        );

      const isVolcengineMultimodal =
        provider === "volcengine" &&
        (testModel?.includes("vision") || testModel?.includes("multimodal"));

      const startTime = Date.now();

      if (isEmbeddingModel && isVolcengineMultimodal) {
        const multimodalEndpoint = `${testBaseURL}/embeddings/multimodal`;
        logger.info(
          `[Provider Test] Using Volcengine Multimodal Endpoint: ${multimodalEndpoint}`,
        );

        const response = await fetch(multimodalEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${testApiKey}`,
          },
          body: JSON.stringify({
            model: testModel,
            input: [{ type: "text", text: "test" }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Volcengine API Error: ${response.status} ${errorText}`,
          );
        }
      } else if (isEmbeddingModel) {
        await client.embeddings.create({
          model: testModel || "",
          input: "test",
        });
      } else {
        await client.chat.completions.create({
          model: testModel || "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 1,
        });
      }

      const duration = Date.now() - startTime;

      res.json({
        success: true,
        message: `Connection successful (${duration}ms)`,
      });
    } catch (error) {
      const err = error as Error;
      logger.error("Provider test failed:", error);
      res.json({
        success: false,
        message: err.message || "Connection test failed",
      });
    }
  },
);

router.get(
  "/database",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const config = getCurrentSupabaseConfig();
      const url = config.url || "";
      const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
      const mode = isLocal ? "local" : "cloud";

      const result = await aiConfigRouteService.testDatabaseConnection(getSupabaseAdmin());
      const connected = result.connected;

      res.json({
        configured: !!url,
        url: url ? maskUrl(url) : "",
        mode,
        connected,
      });
    } catch (error) {
      logger.error("Failed to get database config:", error);
      throw new AppError("Failed to get database config", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

router.put(
  "/database",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
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
          await import("../../services/migration/migrationService");
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
    } catch (error) {
      logger.error("Failed to update database config:", error);
      throw new AppError("Failed to update database config", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);

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

    res.json({ success: true });
  } catch (error) {
    logger.error("Failed to update main AI config:", error);
    throw new AppError("Failed to update main AI config", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

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
