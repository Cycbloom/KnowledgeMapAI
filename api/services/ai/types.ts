import OpenAI from 'openai';

export type AIProviderType = 'deepseek' | 'volcengine' | 'aliyun';

export interface AIProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface AIProvider {
  client: OpenAI;
  model: string;
  providerType: AIProviderType;
  hasKey: boolean;
}
