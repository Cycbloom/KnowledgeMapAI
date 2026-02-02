import { BaseAIProvider } from './base.js';
import { getProviderConfig } from '../config.js';

export class VolcengineProvider extends BaseAIProvider {
  constructor() {
    super('volcengine', getProviderConfig('volcengine'));
  }
}
