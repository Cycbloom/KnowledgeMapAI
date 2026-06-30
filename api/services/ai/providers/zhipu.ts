import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';
import { providerRegistry } from '../providerRegistry';

export class ZhipuProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('zhipu', config);
  }
}

providerRegistry.register('zhipu', ZhipuProvider, {
  apiKey: process.env.ZHIPU_API_KEY ?? '',
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  model: process.env.ZHIPU_MODEL ?? 'glm-4-flash',
});
