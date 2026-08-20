import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';
import { providerRegistry } from '../providerRegistry';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { ErrorCodes } from '../../../../shared/types/errorCodes';

export class VolcengineProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('volcengine', config);
  }

  // Override to support dimensions parameter for Volcengine embedding
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
        data?: { embedding?: number[] } | Array<{ embedding?: number[] }>;
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
}

providerRegistry.register('volcengine', VolcengineProvider, {
  apiKey: process.env.VOLCENGINE_API_KEY ?? '',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  model: process.env.VOLCENGINE_MODEL ?? 'doubao-seed-1-8-251228',
  embeddingModel:
    process.env.VOLCENGINE_EMBEDDING_MODEL ??
    'doubao-embedding-vision-251215',
});
