import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';

export class DeepseekProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('deepseek', config);
  }
}
