import { BaseAIProvider } from './base.js';
import { AIProviderConfig } from '../../../types/ai.js';

export class DeepseekProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('deepseek', config);
  }
}
