import type { AIProviderType } from "@shared/types";
import { logger } from "../../utils/logger";
import { appSettingsService } from "../core/appSettingsService";
import { withAIMonitoring } from "./aiMonitor";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { withTimeoutAndRetry, LONG_TIMEOUT } from "../../../shared/utils/retry";

type RerankingProvider = "jina" | "cohere";

interface RerankingConfig {
  provider: RerankingProvider;
  apiKey: string;
}

interface RerankDocument {
  id: string;
  content: string;
}

interface RerankResult {
  id: string;
  relevanceScore: number;
}

interface RerankOptions {
  topN?: number;
}

interface RerankApiResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
}

const PROVIDER_CONFIG: Record<RerankingProvider, { endpoint: string; model: string }> = {
  jina: {
    endpoint: "https://api.jina.ai/v1/rerank",
    model: "jina-reranker-v2-base-multilingual",
  },
  cohere: {
    endpoint: "https://api.cohere.ai/v1/rerank",
    model: "rerank-multilingual-v3.0",
  },
};

function buildFallbackResults(documents: RerankDocument[]): RerankResult[] {
  return documents.map((doc, index) => ({
    id: doc.id,
    relevanceScore: 1 - index * (1 / Math.max(documents.length, 1)),
  }));
}

export class RerankingService {
  private async getConfig(): Promise<RerankingConfig | null> {
    try {
      const sysConfig = await appSettingsService.getSetting<{
        reranking_ai?: RerankingConfig;
      }>("system_config");

      const config = sysConfig?.reranking_ai;
      if (!config?.provider || !config?.apiKey) {
        return null;
      }

      return config;
    } catch (error) {
      logger.warn("Failed to read reranking config:", error);
      return null;
    }
  }

  private async callRerankApi(
    provider: RerankingProvider,
    apiKey: string,
    query: string,
    documents: string[],
    topN: number,
  ): Promise<RerankApiResponse> {
    const providerConfig = PROVIDER_CONFIG[provider];

    const response = await withTimeoutAndRetry(
      async () => {
        const res = await fetch(providerConfig.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: providerConfig.model,
            query,
            documents,
            top_n: topN,
          }),
        });

        if (!res.ok) {
          const errorBody = await res.text().catch(() => "unknown error");
          throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
            message: `Reranking API returned ${res.status}: ${errorBody}`,
          });
        }

        return (await res.json()) as RerankApiResponse;
      },
      {
        timeout: LONG_TIMEOUT,
        maxRetries: 2,
        initialDelay: 1000,
        maxDelay: 5000,
      },
    );

    return response;
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options?: RerankOptions,
  ): Promise<RerankResult[]> {
    if (documents.length === 0) {
      return [];
    }

    const topN = options?.topN ?? documents.length;

    const config = await this.getConfig();
    if (!config) {
      return buildFallbackResults(documents);
    }

    try {
      const apiResponse = await withAIMonitoring<RerankApiResponse>(
        {
          operation: "rerank",
          provider: config.provider as unknown as AIProviderType,
          model: PROVIDER_CONFIG[config.provider].model,
        },
        async () => {
          const result = await this.callRerankApi(
            config.provider,
            config.apiKey,
            query,
            documents.map((d) => d.content),
            topN,
          );
          return {
            result,
            usage: {
              prompt_tokens: query.length + documents.reduce((sum, d) => sum + d.content.length, 0),
              completion_tokens: result.results.length,
            },
          };
        },
      );

      return apiResponse.results
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, topN)
        .map((item) => ({
          id: documents[item.index]?.id ?? "",
          relevanceScore: item.relevance_score,
        }))
        .filter((item) => item.id !== "");
    } catch (error) {
      logger.warn("Reranking failed, falling back to original order:", error);
      return buildFallbackResults(documents);
    }
  }
}

export const rerankingService = new RerankingService();
