import { BaseAIProvider } from './base.js';
import { AIProviderConfig } from '../types.js';

export class AliyunProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('aliyun', config);
  }
}
