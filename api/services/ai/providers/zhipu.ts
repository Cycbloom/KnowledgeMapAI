import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';

export class ZhipuProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('zhipu', config);
  }
}
