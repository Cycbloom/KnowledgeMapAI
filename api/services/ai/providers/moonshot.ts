import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';

export class MoonshotProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('moonshot', config);
  }
}
