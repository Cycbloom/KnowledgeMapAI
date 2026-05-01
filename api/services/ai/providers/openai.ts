import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';

export class OpenAIProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('openai', config);
  }
}
