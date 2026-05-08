import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/errorHandler';
import { ErrorCodes } from '../../../../shared/types/errorCodes';

export class VolcengineProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('volcengine', config);
  }

  // Override to support dimensions parameter for Volcengine embedding
  async createEmbedding(text: string) {
    if (!this.embeddingModel) return null;

    logger.info(`[Volcengine] Creating embedding. Model: ${this.embeddingModel}, Is Vision/Multimodal: ${this.embeddingModel.includes('vision') || this.embeddingModel.includes('multimodal')}`);

    if (this.embeddingModel.includes('vision') || this.embeddingModel.includes('multimodal')) {
      return this.createMultimodalEmbedding(text);
    }

    // Fallback to standard OpenAI compatible endpoint for other models
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float',
        dimensions: 1024, 
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Volcengine embedding error:', error);
      throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, {
        message: error instanceof Error ? error.message : 'Volcengine embedding error',
      });
    }
  }

  // Special handler for doubao-embedding-vision-251215
  private async createMultimodalEmbedding(text: string) {
    if (!this.embeddingModel) return null;

    const endpoint = `${this.client.baseURL}/embeddings/multimodal`;
    logger.info(`[Volcengine] Using Multimodal Embedding Endpoint: ${endpoint}`);

    const payload = {
      model: this.embeddingModel,
      input: [
        {
          type: "text",
          text
        }
      ],
      dimensions: 1024,
      encoding_format: "float",
      multi_embedding: {
        type: "enabled"
      },
      sparse_embedding: {
        type: "enabled"
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.client.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `Volcengine API Error: ${response.status} ${response.statusText} - ${errorText}`,
        });
      }

      const data = await response.json() as {
        data?: { embedding?: number[] } | Array<{ embedding?: number[] }>;
      };
      
      if (data && data.data && !Array.isArray(data.data) && data.data.embedding) {
        return data.data.embedding;
      } 
      else if (data && data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].embedding) {
        return data.data[0].embedding;
      }
      else {
        logger.error('Unexpected response format from Volcengine:', JSON.stringify(data, null, 2));
        throw new AppError(ErrorCodes.AI_INVALID_RESPONSE);
      }
    } catch (error) {
      logger.error('Volcengine Multimodal embedding error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, {
        message: error instanceof Error ? error.message : 'Volcengine multimodal embedding error',
      });
    }
  }
}
