import { BaseAIProvider } from './base';
import type { AIProviderConfig, SparseVector } from '@shared/types';
import { providerRegistry } from '../providerRegistry';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { ErrorCodes } from '../../../../shared/types/errorCodes';

export class VolcengineProvider extends BaseAIProvider {
  // multimodal 端点一次请求同时返回 dense + sparse。dense 走 createEmbedding 返回，
  // sparse 同步缓存到 textHash → sparse 供 createSparseEmbedding 复用（零额外 API 调用）。
  private sparseCache = new Map<string, { value: SparseVector; at: number }>();
  private static SPARSE_CACHE_TTL_MS = 10 * 60 * 1000;

  constructor(config: AIProviderConfig) {
    super('volcengine', config);
  }

  async createEmbedding(text: string) {
    if (!this.embeddingModel) {
      logger.warn('[Volcengine] embedding model not configured');
      return null;
    }

    const isVision =
      this.embeddingModel.includes('vision') ||
      this.embeddingModel.includes('multimodal');
    const endpoint = isVision
      ? `${this.client.baseURL}/embeddings/multimodal`
      : `${this.client.baseURL}/embeddings`;

    logger.info('[Volcengine] createEmbedding', {
      model: this.embeddingModel,
      textLen: text.length,
      endpoint,
    });

    if (isVision) {
      return this.createMultimodalEmbedding(text, endpoint);
    }

    // Fallback to standard OpenAI compatible endpoint for other models
    try {
      const response = await this.client.embeddings?.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float',
        dimensions: 1024,
      });
      if (!response) {
        throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, {
          message: 'Embeddings not supported by this provider (null response)',
        });
      }
      const data = response as { data: Array<{ embedding: number[] }> };
      const emb = data.data?.[0]?.embedding;
      if (!emb) {
        logger.error('[Volcengine] embedding vector missing in response');
        throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, {
          message: 'Response data[0].embedding missing',
        });
      }
      return emb;
    } catch (error) {
      const sdkErr = error as {
        status?: number;
        code?: string;
        message?: string;
        error?: unknown;
        response?: unknown;
      };
      const respBody = (sdkErr.response as { data?: unknown } | null)?.data;
      const innerErr = sdkErr.error as { message?: string; code?: string } | null;

      logger.error('[Volcengine] standard embedding failed', {
        model: this.embeddingModel,
        status: sdkErr.status ?? null,
        code: sdkErr.code ?? innerErr?.code ?? null,
        message:
          innerErr?.message ??
          sdkErr.message ??
          (error instanceof Error ? error.message : String(error)),
        responseBody: respBody
          ? JSON.stringify(respBody).slice(0, 500)
          : null,
      });
      throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, {
        message:
          innerErr?.message ??
          sdkErr.message ??
          (error instanceof Error ? error.message : 'Volcengine embedding error'),
      });
    }
  }

  // Special handler for doubao-embedding-vision-* (multimodal endpoint)
  private async createMultimodalEmbedding(text: string, endpoint: string) {
    if (!this.embeddingModel) return null;

    const payload = {
      model: this.embeddingModel,
      input: [{ type: "text", text }],
      dimensions: 1024,
      encoding_format: "float",
      multi_embedding: { type: "enabled" },
      sparse_embedding: { type: "enabled" },
    };

    try {
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.client.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        let parsed: unknown = null;
        try { parsed = JSON.parse(errorText); } catch { /* ignore */ }
        const err = parsed as {
          error?: { message?: string; code?: string };
          message?: string;
          code?: string;
        } | null;
        const errMsg =
          err?.error?.message ?? err?.message ?? errorText.slice(0, 500);
        const errCode = err?.error?.code ?? err?.code ?? response.status;

        logger.error('[Volcengine] multimodal embedding HTTP error', {
          statusCode: response.status,
          errorCode: errCode,
          errorMessage: errMsg,
          elapsedMs: elapsed,
        });
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `Volcengine API Error [${errCode}]: ${errMsg}`,
        });
      }

      const rawText = await response.text();
      let data: {
        data?: {
          embedding?: number[];
          sparse_embedding?: { index: number; value: number }[];
        } | Array<{
          embedding?: number[];
          sparse_embedding?: { index: number; value: number }[];
        }>;
      };
      try {
        data = JSON.parse(rawText) as typeof data;
      } catch {
        logger.error('[Volcengine] multimodal embedding non-JSON response', {
          responseSample: rawText.slice(0, 200),
          elapsedMs: elapsed,
        });
        throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, {
          message: 'Volcengine returned non-JSON response for multimodal embedding',
        });
      }

      // 同时解析 sparse_embedding（与 dense 同源一次返回），缓存供 createSparseEmbedding 复用。
      const sparseCandidate =
        !Array.isArray(data?.data) && data?.data
          ? data.data
          : Array.isArray(data?.data) && data.data.length > 0
            ? data.data[0]
            : undefined;
      if (sparseCandidate) {
        const sparse = sparseCandidate.sparse_embedding;
        if (Array.isArray(sparse) && sparse.length > 0) {
          this.sparseCache.set(text, { value: sparse, at: Date.now() });
        }
      }

      if (data?.data && !Array.isArray(data.data) && data.data.embedding) {
        return data.data.embedding;
      }
      if (
        data?.data &&
        Array.isArray(data.data) &&
        data.data.length > 0 &&
        data.data[0].embedding
      ) {
        return data.data[0].embedding;
      }

      logger.error('[Volcengine] unexpected multimodal response format', {
        responseSample: rawText.slice(0, 200),
      });
      throw new AppError(ErrorCodes.AI_INVALID_RESPONSE);
    } catch (error) {
      if (!(error instanceof AppError)) {
        const raw = error as { code?: string; message?: string };
        logger.error('[Volcengine] multimodal embedding fetch error', {
          code: raw.code ?? null,
          message:
            raw.message ??
            (error instanceof Error ? error.message : String(error)),
        });
      }
      if (error instanceof AppError) throw error;
      throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, {
        message:
          error instanceof Error ? error.message : 'Volcengine multimodal embedding error',
      });
    }
  }

  /**
   * 生成稀疏向量（SPLADE 风格，doubao-embedding-vision 的 sparse_embedding）。
   *
   * multimodal 端点一次请求同时返回 dense + sparse，dense 已由 createEmbedding 返回并
   * 在此方法被调用前大概率已缓存（索引阶段先写 dense 再写 sparse）。因此这里优先查
   * sparseCache；缓存未命中时再显式调用一次 multimodal 端点解析 sparse，不做 dense 返回。
   */
  async createSparseEmbedding(text: string): Promise<SparseVector | null> {
    if (!this.embeddingModel || !this.embeddingModel.includes('vision')) {
      logger.warn('[Volcengine] sparse embedding requires a vision/multimodal embedding model');
      return null;
    }

    // 1. 命中缓存（由 createEmbedding 的 createMultimodalEmbedding 填充）
    const cached = this.sparseCache.get(text);
    if (
      cached &&
      Date.now() - cached.at < VolcengineProvider.SPARSE_CACHE_TTL_MS
    ) {
      return cached.value;
    }

    // 2. 缓存已过期或未填充：显式调用 multimodal 端点。payload 与 createMultimodalEmbedding 一致，
    //    但这里只需 sparse，仍复用同一 endpoint 以保持同源向量。
    try {
      const endpoint = `${this.client.baseURL}/embeddings/multimodal`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.client.apiKey}`,
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: [{ type: 'text', text }],
          encoding_format: 'float',
          sparse_embedding: { type: 'enabled' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[Volcengine] sparse embedding HTTP error', {
          statusCode: response.status,
          responseSample: errorText.slice(0, 300),
        });
        return null;
      }

      const rawText = await response.text();
      const json = JSON.parse(rawText) as {
        data?: {
          sparse_embedding?: { index: number; value: number }[];
        } | Array<{
          sparse_embedding?: { index: number; value: number }[];
        }>;
      };

      const obj =
        !Array.isArray(json?.data) && json?.data
          ? json.data
          : Array.isArray(json?.data) && json.data.length > 0
            ? json.data[0]
            : undefined;
      const sparse = obj?.sparse_embedding;
      if (Array.isArray(sparse) && sparse.length > 0) {
        this.sparseCache.set(text, { value: sparse, at: Date.now() });
        return sparse;
      }

      logger.warn('[Volcengine] sparse embedding returned empty', {
        responseSample: rawText.slice(0, 200),
      });
      return null;
    } catch (error) {
      logger.error('[Volcengine] sparse embedding fetch error', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

providerRegistry.register('volcengine', VolcengineProvider, {
  apiKey: process.env.VOLCENGINE_API_KEY ?? '',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  model: process.env.VOLCENGINE_MODEL ?? 'doubao-seed-1-8-251228',
  embeddingModel:
    process.env.VOLCENGINE_EMBEDDING_MODEL ??
    'doubao-embedding-vision-251215',
});
