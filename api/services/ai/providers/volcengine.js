import { BaseAIProvider } from './base.js';
import { logger } from '../../../utils/logger.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { ErrorCodes } from '../../../constants/errorCodes.js';
export class VolcengineProvider extends BaseAIProvider {
    constructor(config) {
        super('volcengine', config);
    }
    // Override to support dimensions parameter for Volcengine embedding
    async createEmbedding(text) {
        if (!this.embeddingModel)
            return null;
        // Check if using the multimodal model
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
        }
        catch (error) {
            logger.error('Volcengine embedding error:', error);
            throw new AppError(ErrorCodes.AI_EMBEDDING_ERROR, {
                message: error instanceof Error ? error.message : 'Volcengine embedding error',
            });
        }
    }
    // Special handler for doubao-embedding-vision-251215
    async createMultimodalEmbedding(text) {
        if (!this.embeddingModel)
            return null;
        // Construct the endpoint URL manually since it differs from standard OpenAI
        const endpoint = `${this.client.baseURL}/embeddings/multimodal`;
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
            const data = await response.json();
            if (data && data.data && data.data.embedding) {
                return data.data.embedding;
            }
            else if (data && data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].embedding) {
                return data.data[0].embedding;
            }
            else {
                logger.error('Unexpected response format from Volcengine:', JSON.stringify(data, null, 2));
                throw new AppError(ErrorCodes.AI_INVALID_RESPONSE);
            }
        }
        catch (error) {
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
//# sourceMappingURL=volcengine.js.map