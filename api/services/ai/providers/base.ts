import OpenAI from 'openai';
import { AIProvider, AIProviderConfig, AIProviderType } from '../types.js';

export abstract class BaseAIProvider implements AIProvider {
  public client: OpenAI;
  public model: string;
  public embeddingModel?: string;
  public providerType: AIProviderType;
  public hasKey: boolean;

  constructor(providerType: AIProviderType, config: AIProviderConfig) {
    this.providerType = providerType;
    this.model = config.model;
    this.embeddingModel = config.embeddingModel;
    this.hasKey = !!config.apiKey;
    
    // Warning: Don't log API keys
    if (!config.apiKey) {
      console.warn(`[AI] ${providerType} API Key is missing. Functionality may be limited.`);
    }

    this.client = new OpenAI({
      apiKey: config.apiKey || 'dummy',
      baseURL: config.baseURL,
    });
  }
}
