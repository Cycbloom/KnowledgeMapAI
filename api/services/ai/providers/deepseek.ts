import { BaseAIProvider } from './base.js';
import { getProviderConfig } from '../config.js';

export class DeepseekProvider extends BaseAIProvider {
  constructor() {
    super('deepseek', getProviderConfig('deepseek'));
  }
}
