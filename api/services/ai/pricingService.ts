import type { AIModelPricing, AIProviderType } from "@shared/types";

const MODEL_PRICING: AIModelPricing[] = [
  {
    provider: "deepseek",
    model: "deepseek-chat",
    cachedInputPricePer1M: 0.2,
    uncachedInputPricePer1M: 2.0,
    outputPricePer1M: 3.0,
  },
  {
    provider: "deepseek",
    model: "deepseek-reasoner",
    cachedInputPricePer1M: 0.2,
    uncachedInputPricePer1M: 2.0,
    outputPricePer1M: 3.0,
  },
  {
    provider: "volcengine",
    model: "doubao-seed-1-8-251228",
    cachedInputPricePer1M: 0.08,
    uncachedInputPricePer1M: 1.5,
    outputPricePer1M: 1.5,
  },
  {
    provider: "volcengine",
    model: "doubao-embedding-vision-251215",
    uncachedInputPricePer1M: 0.7,
    cachedInputPricePer1M: 0.7,
    outputPricePer1M: 0,
  },
  {
    provider: "aliyun",
    model: "qwen-long-latest",
    cachedInputPricePer1M: 0.05,
    uncachedInputPricePer1M: 2.0,
    outputPricePer1M: 2.0,
  },
  {
    provider: "aliyun",
    model: "qwen-vl-max",
    cachedInputPricePer1M: 2.0,
    uncachedInputPricePer1M: 20.0,
    outputPricePer1M: 20.0,
  },
];

export const pricingService = {
  getPricing(
    provider: AIProviderType,
    model: string,
  ): AIModelPricing | undefined {
    return MODEL_PRICING.find(
      (p) => p.provider === provider && p.model === model,
    );
  },

  calculateCost(
    provider: AIProviderType,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens?: number,
  ): number {
    const pricing = this.getPricing(provider, model);

    if (!pricing) {
      return ((inputTokens + outputTokens) * 0.001) / 1000;
    }

    const safeCachedTokens = cachedTokens || 0;
    const uncachedInputTokens = Math.max(0, inputTokens - safeCachedTokens);

    const cachedCost =
      (safeCachedTokens / 1_000_000) * pricing.cachedInputPricePer1M;
    const uncachedInputCost =
      (uncachedInputTokens / 1_000_000) * pricing.uncachedInputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;

    return cachedCost + uncachedInputCost + outputCost;
  },

  calculateDetailedCost(
    provider: AIProviderType,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens?: number,
  ): {
    cachedInputCost: number;
    uncachedInputCost: number;
    outputCost: number;
    totalCost: number;
    savedByCache: number;
  } {
    const pricing = this.getPricing(provider, model);

    if (!pricing) {
      const totalCost = ((inputTokens + outputTokens) * 0.001) / 1000;
      return {
        cachedInputCost: 0,
        uncachedInputCost: totalCost * 0.6,
        outputCost: totalCost * 0.4,
        totalCost,
        savedByCache: 0,
      };
    }

    const safeCachedTokens = cachedTokens || 0;
    const uncachedInputTokens = Math.max(0, inputTokens - safeCachedTokens);

    const cachedInputCost =
      (safeCachedTokens / 1_000_000) * pricing.cachedInputPricePer1M;
    const uncachedInputCost =
      (uncachedInputTokens / 1_000_000) * pricing.uncachedInputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePer1M;
    const totalCost = cachedInputCost + uncachedInputCost + outputCost;

    const costIfNoCache =
      (inputTokens / 1_000_000) * pricing.uncachedInputPricePer1M;
    const savedByCache = costIfNoCache - cachedInputCost;

    return {
      cachedInputCost,
      uncachedInputCost,
      outputCost,
      totalCost,
      savedByCache: Math.max(0, savedByCache),
    };
  },

  getAllPricing(): AIModelPricing[] {
    return MODEL_PRICING;
  },
};
