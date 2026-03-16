import OpenAI from 'openai';
import { logger } from '../../../utils/logger.js';
export class BaseAIProvider {
    client;
    model;
    embeddingModel;
    providerType;
    hasKey;
    constructor(providerType, config) {
        this.providerType = providerType;
        this.model = config.model;
        this.embeddingModel = config.embeddingModel;
        this.hasKey = !!config.apiKey;
        // Warning: Don't log API keys
        if (!config.apiKey) {
            logger.warn(`[AI] ${providerType} API Key is missing. Functionality may be limited.`);
        }
        this.client = new OpenAI({
            apiKey: config.apiKey || 'dummy',
            baseURL: config.baseURL,
        });
    }
}
//# sourceMappingURL=base.js.map