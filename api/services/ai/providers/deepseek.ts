import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';
import { providerRegistry } from '../providerRegistry';

export class DeepseekProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('deepseek', config);
  }
}

providerRegistry.register('deepseek', DeepseekProvider, {
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: 'https://api.deepseek.com',
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
});
