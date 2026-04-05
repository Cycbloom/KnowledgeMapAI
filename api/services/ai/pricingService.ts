import type { AIModelPricing, AIProviderType } from '@shared/types';

const MODEL_PRICING: AIModelPricing[] = [
  { provider: 'deepseek', model: 'deepseek-chat', inputPricePer1k: 0.001, outputPricePer1k: 0.002 },
  { provider: 'deepseek', model: 'deepseek-reasoner', inputPricePer1k: 0.001, outputPricePer1k: 0.002 },
  { provider: 'volcengine', model: 'doubao-seed-1-8-251228', inputPricePer1k: 0.0008, outputPricePer1k: 0.0015 },
  { provider: 'aliyun', model: 'qwen-long-latest', inputPricePer1k: 0.0005, outputPricePer1k: 0.002 },
  { provider: 'aliyun', model: 'qwen-vl-max', inputPricePer1k: 0.02, outputPricePer1k: 0.02 },
];

export const pricingService = {
  getPricing(provider: AIProviderType, model: string): AIModelPricing | undefined {
    return MODEL_PRICING.find(p => p.provider === provider && p.model === model);
  },
  
  calculateCost(provider: AIProviderType, model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.getPricing(provider, model);
    if (!pricing) {
      return (inputTokens + outputTokens) * 0.001 / 1000;
    }
    const inputCost = (inputTokens / 1000) * pricing.inputPricePer1k;
    const outputCost = (outputTokens / 1000) * pricing.outputPricePer1k;
    return inputCost + outputCost;
  },
  
  getAllPricing(): AIModelPricing[] {
    return MODEL_PRICING;
  }
};
