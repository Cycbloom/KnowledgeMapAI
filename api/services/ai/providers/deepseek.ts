import { BaseAIProvider } from './base.js';
import { AIProviderConfig } from '../types.js';

export class DeepseekProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('deepseek', config);
  }
}
