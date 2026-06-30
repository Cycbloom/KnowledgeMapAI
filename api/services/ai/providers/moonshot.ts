import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';
import { providerRegistry } from '../providerRegistry';

export class MoonshotProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('moonshot', config);
  }
}

providerRegistry.register('moonshot', MoonshotProvider, {
  apiKey: process.env.MOONSHOT_API_KEY ?? '',
  baseURL: 'https://api.moonshot.cn/v1',
  model: process.env.MOONSHOT_MODEL ?? 'moonshot-v1-8k',
});
