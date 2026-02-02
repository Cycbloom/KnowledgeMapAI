import OpenAI from 'openai';

export type AIProviderType = 'deepseek' | 'volcengine' | 'aliyun';

export interface AIProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  embeddingModel?: string;
}

export interface AIProvider {
  client: OpenAI;
  model: string;
  embeddingModel?: string;
  providerType: AIProviderType;
  hasKey: boolean;
  createEmbedding?: (text: string) => Promise<number[] | null>;
}
