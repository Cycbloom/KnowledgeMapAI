import { Router, type Response } from "express";
import OpenAI from "openai";
import type { AIProviderType } from "@shared/types";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { settingsService } from "../../services/core/settingsService";
import { logger } from "../../utils/logger";
import {
  getSupabaseAdmin,
  reinitializeSupabaseClients,
  getCurrentSupabaseConfig,
} from "../../supabase";

const router = Router();

const PROVIDER_ENV_KEY_MAP: Record<string, string[]> = {
  deepseek: ["DEEPSEEK_API_KEY", "AI_API_KEY"],
  volcengine: ["VOLCENGINE_API_KEY"],
  aliyun: ["ALIYUN_API_KEY"],
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
    if (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost"
    ) {
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
        await settingsService.getSetting<Record<string, Record<string, string>>>(
          "ai_provider_config",
        );

      const providers: Record<string, Record<string, unknown>> = {};
      const allProviderTypes: AIProviderType[] = [
        "deepseek",
        "volcengine",
        "aliyun",
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
      res.status(500).json({ error: "Failed to get provider configs" });
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
          { apiKey?: string; baseURL?: string; model?: string; embeddingModel?: string }
        >;
      };

      if (!providers || typeof providers !== "object") {
        res.status(400).json({ error: "providers object is required" });
        return;
      }

      for (const [provider, config] of Object.entries(providers)) {
        if (config.apiKey !== undefined && config.apiKey === "") {
          res
            .status(400)
            .json({ error: `apiKey for ${provider} must be non-empty if provided` });
          return;
        }
        if (config.baseURL !== undefined) {
          try {
            new URL(config.baseURL);
          } catch {
            res
              .status(400)
              .json({ error: `baseURL for ${provider} is not a valid URL` });
            return;
          }
        }
      }

      const existingConfigs =
        (await settingsService.getSetting<Record<string, Record<string, string>>>(
          "ai_provider_config",
        )) || {};

      const merged = { ...existingConfigs };

      for (const [provider, config] of Object.entries(providers)) {
        merged[provider] = {
          ...(merged[provider] || {}),
          ...Object.fromEntries(
            Object.entries(config).filter(([, v]) => v !== undefined),
          ),
        };
      }

      await settingsService.updateSetting("ai_provider_config", merged);

      res.json({ success: true });
    } catch (error) {
      logger.error("Failed to update provider configs:", error);
      res.status(500).json({ error: "Failed to update provider configs" });
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
        res.status(400).json({ error: "provider is required" });
        return;
      }

      let testApiKey = apiKey;
      let testBaseURL = baseURL;
      let testModel = model;

      if (!testApiKey || !testBaseURL) {
        const allConfigs =
          await settingsService.getSetting<Record<string, Record<string, string>>>(
            "ai_provider_config",
          );
        const dbConfig = allConfigs?.[provider];
        const defaults = PROVIDER_DEFAULTS[provider];

        testApiKey = testApiKey || dbConfig?.apiKey || "";
        testBaseURL = testBaseURL || dbConfig?.baseURL || defaults?.baseURL || "";
        testModel = testModel || dbConfig?.model || defaults?.model || "";
      }

      if (!testApiKey) {
        res.json({ success: false, message: "No API key available for testing" });
        return;
      }

      if (!testBaseURL) {
        res.json({ success: false, message: "No base URL available for testing" });
        return;
      }

      const client = new OpenAI({
        apiKey: testApiKey,
        baseURL: testBaseURL,
      });

      const startTime = Date.now();
      await client.chat.completions.create({
        model: testModel || "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      });
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
      const isLocal =
        url.includes("127.0.0.1") || url.includes("localhost");
      const mode = isLocal ? "local" : "cloud";
      let connected = false;

      try {
        const { error } = await getSupabaseAdmin()
          .from("app_settings")
          .select("key")
          .limit(1);
        connected = !error;
      } catch {
        connected = false;
      }

      res.json({
        configured: !!url,
        url: url ? maskUrl(url) : "",
        mode,
        connected,
      });
    } catch (error) {
      logger.error("Failed to get database config:", error);
      res.status(500).json({ error: "Failed to get database config" });
    }
  },
);

router.put(
  "/database",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { url, anonKey, serviceRoleKey } = req.body as {
        url?: string;
        anonKey?: string;
        serviceRoleKey?: string;
      };

      if (!url) {
        res.status(400).json({ error: "url is required" });
        return;
      }

      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: "url is not a valid URL" });
        return;
      }

      if (!serviceRoleKey) {
        res.status(400).json({ error: "serviceRoleKey is required" });
        return;
      }

      if (!anonKey) {
        res.status(400).json({ error: "anonKey is required" });
        return;
      }

      await settingsService.updateSetting("database_config", {
        url,
        anonKey,
        serviceRoleKey,
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

      try {
        const { error } = await getSupabaseAdmin()
          .from("app_settings")
          .select("key")
          .limit(1);

        if (error) {
          res.json({
            success: false,
            message: `Database reinitialized but connection test failed: ${error.message}`,
          });
          return;
        }
      } catch (testError) {
        const err = testError as Error;
        res.json({
          success: false,
          message: `Database reinitialized but connection test failed: ${err.message}`,
        });
        return;
      }

      settingsService.clearCache();

      res.json({ success: true, message: "Database configuration updated successfully" });
    } catch (error) {
      logger.error("Failed to update database config:", error);
      res.status(500).json({ error: "Failed to update database config" });
    }
  },
);

export default router;
