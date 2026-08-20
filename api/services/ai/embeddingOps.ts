import { getAIProviderForTask } from "./factory";
import { getProviderForTask } from "./config";
import { withEmbeddingMonitoring } from "./aiMonitor";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { cacheService, CacheKeys, CacheTTL, computeTextHash } from "../common/cacheService";

export class EmbeddingOps {
  async generateEmbedding(text: string): Promise<number[] | null> {
    // 使用缓存避免重复生成
    const textHash = computeTextHash(text);
    const cacheKey = CacheKeys.EMBEDDING(textHash);

    return cacheService.getOrSet(
      cacheKey,
      async () => {
        const embeddingProvider = await getProviderForTask("embedding");

        if (!embeddingProvider) {
          logger.warn("No embedding provider available (getProviderForTask returned null)");
          return null;
        }

        const provider = await getAIProviderForTask("embedding");

        logger.info("[EmbeddingOps] generateEmbedding", {
          providerType: provider.providerType,
          model: provider.embeddingModel ?? null,
          textLen: text.length,
          hasKey: provider.hasKey,
        });

        if (!provider.hasKey) {
          logger.warn(
            `[EmbeddingOps] Provider "${embeddingProvider}" has no API key configured`,
          );
          return null;
        }

        try {
          const createEmbedding = provider.createEmbedding;
          if (createEmbedding) {
            return await withEmbeddingMonitoring(
              {
                operation: "generate_embedding",
                provider: provider.providerType,
                model: provider.embeddingModel || provider.model,
              },
              async () => ({
                // 必须显式绑定 this：解构赋值后直接调用会导致方法内 this 丢失。
                result: await createEmbedding.call(provider, text),
                tokenCount: text.length,
              }),
            );
          }

          return await withEmbeddingMonitoring(
            {
              operation: "generate_embedding",
              provider: provider.providerType,
              model: provider.embeddingModel || provider.model,
            },
            async () => {
              const response = await provider.client.embeddings?.create({
                model: provider.embeddingModel || provider.model,
                input: text,
              });
              if (!response) {
                throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, { message: 'Embeddings not supported by this provider' });
              }
              return {
                result: response.data[0].embedding as number[],
                tokenCount: text.length,
              };
            },
          );
        } catch (error) {
          const raw = error as {
            code?: string | number;
            status?: number;
            statusCode?: number;
            message?: string;
            response?: unknown;
            error?: unknown;
          };
          const respBody = (raw.response as { data?: unknown } | null)?.data;
          logger.error("Failed to generate embedding", {
            provider: embeddingProvider,
            modelUsed: provider.embeddingModel || provider.model || null,
            errorCode: raw.code ?? null,
            httpStatus: raw.status ?? raw.statusCode ?? null,
            message:
              raw.message ??
              (error instanceof Error ? error.message : String(error)),
            responseBody: respBody
              ? JSON.stringify(respBody).slice(0, 800)
              : null,
            innerError: raw.error
              ? JSON.stringify(raw.error).slice(0, 800)
              : null,
          });
          return null;
        }
      },
      CacheTTL.SEARCH,
      ['embedding']
    ) as Promise<number[] | null>;
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    const embeddingProvider = await getProviderForTask("embedding");
    if (!embeddingProvider) {
      logger.warn(
        "No embedding provider configured. Set embedding_ai.provider in system_config or EMBEDDING_PROVIDER env var.",
      );
      return texts.map(() => null);
    }

    const provider = await getAIProviderForTask("embedding");

    if (!provider.hasKey) {
      logger.warn(
        `Embedding provider "${embeddingProvider}" has no API key configured.`,
      );
      return texts.map(() => null);
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      const createEmbedding = provider.createEmbedding;
      if (createEmbedding) {
        const concurrencyLimit = 5;
        const results: (number[] | null)[] = new Array(texts.length).fill(null);

        for (let i = 0; i < texts.length; i += concurrencyLimit) {
          const batch = texts.slice(i, i + concurrencyLimit);
          const batchResults = await Promise.all(
            batch.map((text) =>
              withEmbeddingMonitoring(
                {
                  operation: "generate_embedding_batch",
                  provider: provider.providerType,
                  model: provider.embeddingModel || provider.model,
                  metadata: { batchCount: batch.length },
                },
                async () => ({
                  // 同 generateEmbedding：解构调用需显式绑定 this。
                  result: await createEmbedding.call(provider, text),
                  tokenCount: text.length,
                }),
              ).catch(() => null),
            ),
          );

          for (let j = 0; j < batch.length; j++) {
            results[i + j] = batchResults[j];
          }

          if (i + concurrencyLimit < texts.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        return results;
      }

      return await withEmbeddingMonitoring(
        {
          operation: "generate_embedding_batch",
          provider: provider.providerType,
          model: provider.embeddingModel || provider.model,
          metadata: { batchCount: texts.length },
        },
        async () => {
          const response = await provider.client.embeddings?.create({
            model: provider.embeddingModel || provider.model,
            input: texts,
          });
          if (!response) {
            throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, { message: 'Embeddings not supported by this provider' });
          }

          const results: (number[] | null)[] = new Array(texts.length).fill(
            null,
          );
          for (const item of response.data) {
            results[item.index] = item.embedding;
          }

          return {
            result: results,
            tokenCount: texts.reduce((sum, t) => sum + t.length, 0),
          };
        },
      );
    } catch (error) {
      logger.error("Failed to generate embeddings batch:", error);
      return texts.map(() => null);
    }
  }
}

export const embeddingOps = new EmbeddingOps();
