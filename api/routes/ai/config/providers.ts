import { Router, type Response } from "express";
import OpenAI from "openai";
import type { AIProviderType } from "@shared/types";
import { requireAuth, type AuthRequest } from "../../../middleware/auth";
import { appSettingsService } from "../../../services/core";
import { getEnvConfig, clearProviderCache } from "../../../services/ai";
import { providerRegistry } from "../../../services/ai/providerRegistry";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { PROVIDER_DEFAULTS, maskApiKey, hasEnvFallback } from "./shared";
import { encrypt, decrypt, getEncryptionKey } from "../../../../shared/utils/encryption";

const router = Router();

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
      const allProviderTypes = providerRegistry.getRegisteredTypes();

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
      const encryptionKey = getEncryptionKey();

      for (const [provider, config] of Object.entries(providers)) {
        const mergedEntry = {
          ...(merged[provider] || {}),
          ...Object.fromEntries(
            Object.entries(config).filter(([, v]) => v !== undefined),
          ),
        };

        // 加密 apiKey 后再存储到数据库
        if (mergedEntry.apiKey) {
          mergedEntry.apiKey = encrypt(mergedEntry.apiKey, encryptionKey);
        }

        merged[provider] = mergedEntry;
      }

      await appSettingsService.updateSetting("ai_provider_config", merged);

      // 失效 provider 单例缓存：用户更新了 API key / baseURL / model 等配置后，
      // 旧缓存中的 provider 实例（含已构造的 OpenAI HTTP client）需要被丢弃，
      // 下次 getAIProvider 调用会基于新配置重新构造。
      clearProviderCache();

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

        // 解密数据库中存储的 apiKey（加密格式为 iv:authTag:ciphertext，恰含 2 个冒号）
        let dbApiKey = dbConfig?.apiKey || "";
        if (dbApiKey && dbApiKey.split(":").length === 3) {
          try {
            dbApiKey = decrypt(dbApiKey, getEncryptionKey());
          } catch {
            logger.warn(`[Provider Test] Failed to decrypt stored apiKey for ${provider}, falling back to env`);
            dbApiKey = "";
          }
        }

        testApiKey = testApiKey || dbApiKey || envConfig.apiKey || "";
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

export default router;
