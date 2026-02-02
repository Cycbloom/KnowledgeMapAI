import { BaseAIProvider } from './base.js';
import { getProviderConfig } from '../config.js';

export class AliyunProvider extends BaseAIProvider {
  constructor() {
    super('aliyun', getProviderConfig('aliyun'));
  }
}
