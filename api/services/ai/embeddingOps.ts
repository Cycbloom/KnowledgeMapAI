import { getAIProviderForTask } from "./factory";
import { getProviderForTask } from "./config";
import { withEmbeddingMonitoring } from "./aiMonitor";
import { logger } from "../../utils/logger";
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
          logger.warn("No embedding provider available");
          return null;
        }

        const provider = await getAIProviderForTask("embedding");

        if (!provider.hasKey) {
          logger.warn("Embedding provider has no API key configured");
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
                result: await createEmbedding(text),
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
                throw new Error('Embeddings not supported by this provider');
              }
              return {
                result: response.data[0].embedding as number[],
                tokenCount: text.length,
              };
            },
          );
        } catch (error) {
          logger.error("Failed to generate embedding:", error);
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
                  result: await createEmbedding(text),
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
            throw new Error('Embeddings not supported by this provider');
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
