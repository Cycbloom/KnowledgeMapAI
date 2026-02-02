import dotenv from 'dotenv';
import { AIProviderType, AIProviderConfig } from './types.js';

dotenv.config();

export const getProviderConfig = (provider: AIProviderType): AIProviderConfig => {
  switch (provider) {
    case 'deepseek':
      return {
        apiKey: process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY || '',
        baseURL: 'https://api.deepseek.com',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      };
    case 'volcengine':
      return {
        apiKey: process.env.VOLCENGINE_API_KEY || '',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        model: process.env.VOLCENGINE_MODEL || 'doubao-seed-1-8-251228', // Model Name or Endpoint ID
        embeddingModel: process.env.VOLCENGINE_EMBEDDING_MODEL || 'doubao-embedding-vision-251215',
      };
    case 'aliyun':
      return {
        apiKey: process.env.ALIYUN_API_KEY || '',
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: process.env.ALIYUN_MODEL || 'qwen-long-latest',
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
};

export const getDefaultProvider = (): AIProviderType => {
  return (process.env.AI_DEFAULT_PROVIDER as AIProviderType) || 'deepseek';
};

export const getProviderForTask = (task: 'text' | 'embedding' | 'reasoning' = 'text'): AIProviderType => {
    // Default provider mapping
    const envMap: Record<string, string | undefined> = {
        'text': 'deepseek',
        'embedding': 'volcengine',
        'reasoning': 'aliyun'
    };

    return (envMap[task] as AIProviderType) || getDefaultProvider();
}
