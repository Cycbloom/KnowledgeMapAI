import { BaseAIProvider } from './base';
import type { AIProviderConfig } from '@shared/types';
import { providerRegistry } from '../providerRegistry';

export class OpenAIProvider extends BaseAIProvider {
  constructor(config: AIProviderConfig) {
    super('openai', config);
  }
}

providerRegistry.register('openai', OpenAIProvider, {
  apiKey: process.env.OPENAI_API_KEY ?? '',
  baseURL: 'https://api.openai.com/v1',
  model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
});
