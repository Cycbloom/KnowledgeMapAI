import { Router, type Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import type { AIProviderType } from "@shared/types";
import { requireAuth, type AuthRequest } from "../../../middleware/auth";
import { validate } from "../../../middleware/validate";
import { appSettingsService } from "../../../services/core";
import { getEnvConfig, clearProviderCache } from "../../../services/ai";
import { providerRegistry } from "../../../services/ai/providerRegistry";
import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";
import { PROVIDER_DEFAULTS, maskApiKey, hasEnvFallback } from "./shared";
import { encrypt, decrypt, getEncryptionKey, isEncryptedApiKey } from "../../../../shared/utils/encryption";

const router = Router();

// PUT /providers 请求体校验：apiKey 非空、baseURL 必须是合法 URL
const updateProvidersSchema = z.object({
  providers: z.record(
    z.object({
      apiKey: z.string().min(1).optional(),
      baseURL: z.string().url().optional(),
      model: z.string().optional(),
      embeddingModel: z.string().optional(),
    }),
  ),
});

router.get(
  "/providers",
  requireAuth,
  async (_req: AuthRequest, res: Response) => {
    try {
      const [allConfigs, sysConfig] = await Promise.all([
        appSettingsService.getSetting<
          Record<string, Record<string, string>>
        >("ai_provider_config"),
        appSettingsService.getSetting<{
          main_ai?: { provider?: string; model?: string };
          embedding_ai?: { provider?: string; model?: string };
        }>("system_config"),
      ]);

      const providers: Record<string, Record<string, unknown>> = {};
      const allProviderTypes = providerRegistry.getRegisteredTypes();

      for (const provider of allProviderTypes) {
        const dbConfig = allConfigs?.[provider];
        const envAvailable = hasEnvFallback(provider);
        const defaults = PROVIDER_DEFAULTS[provider];

        // 与 getProviderConfig 保持一致：如果 system_config 选了当前
        // provider 作为 main_ai / embedding_ai，就优先显示用户在 UI 上
        // 保存的 model / embeddingModel，避免"测试通过但实际调用失败"。
        let baseModel = dbConfig?.model || defaults.model;
        if (
          sysConfig?.main_ai?.provider === provider &&
          sysConfig.main_ai.model?.trim()
        ) {
          baseModel = sysConfig.main_ai.model.trim();
        }

        let baseEmbeddingModel =
          dbConfig?.embeddingModel || defaults.embeddingModel;
        if (
          sysConfig?.embedding_ai?.provider === provider &&
          sysConfig.embedding_ai.model?.trim()
        ) {
          baseEmbeddingModel = sysConfig.embedding_ai.model.trim();
        }

        if (dbConfig?.apiKey) {
          providers[provider] = {
            configured: true,
            apiKey: maskApiKey(dbConfig.apiKey),
            baseURL: dbConfig.baseURL || defaults.baseURL,
            model: baseModel,
            ...(baseEmbeddingModel
              ? { embeddingModel: baseEmbeddingModel }
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
  validate({ body: updateProvidersSchema }),
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
      // 透传业务错误（如后续逻辑抛出的 AppError），仅兜底未知异常
      if (error instanceof AppError) throw error;
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

      if (!testApiKey || !testBaseURL || !testModel) {
        const [allConfigs, sysConfig] = await Promise.all([
          appSettingsService.getSetting<
            Record<string, Record<string, string>>
          >("ai_provider_config"),
          appSettingsService.getSetting<{
            main_ai?: { provider?: string; model?: string };
            embedding_ai?: { provider?: string; model?: string };
          }>("system_config"),
        ]);
        const dbConfig = allConfigs?.[provider];
        const defaults = PROVIDER_DEFAULTS[provider];
        const envConfig = getEnvConfig(provider as AIProviderType);

        // 解密数据库中存储的 apiKey（加密格式为 iv:authTag:ciphertext，恰含 2 个冒号）
        let dbApiKey = dbConfig?.apiKey || "";
        if (isEncryptedApiKey(dbApiKey)) {
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

        // 候选模型优先级：请求入参 > ai_provider_config.model > system_config.main_ai.model
        // > envConfig.model > defaults.model（生成模型）
        const mainModel =
          dbConfig?.model ||
          (sysConfig?.main_ai?.provider === provider
            ? sysConfig.main_ai.model
            : undefined) ||
          envConfig.model ||
          defaults?.model ||
          "";

        // 向量化模型候选优先级（当请求参数是 embedding 模型时使用）
        const embeddingModel =
          dbConfig?.embeddingModel ||
          (sysConfig?.embedding_ai?.provider === provider
            ? sysConfig.embedding_ai.model
            : undefined) ||
          envConfig.embeddingModel ||
          defaults?.embeddingModel ||
          "";

        // 没有传 model 时，智能选择：如果 system_config 把当前 provider
        // 选成 embedding_ai，就用 embedding 模型测，否则用生成模型测。
        if (!testModel) {
          const pickedEmbedding =
            sysConfig?.embedding_ai?.provider === provider && embeddingModel;
          testModel = pickedEmbedding || mainModel;
        } else {
          // 传了 model，但需要识别它是「生成模型」还是「embedding 模型」，
          // 避免把 embedding 请求打到生成 model，或反过来。
          const passedIsEmbedding =
            testModel.includes("embedding") ||
            Object.values(PROVIDER_DEFAULTS).some(
              (d) => d.embeddingModel === testModel,
            );
          if (passedIsEmbedding) {
            testModel = testModel || embeddingModel;
          }
        }
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
