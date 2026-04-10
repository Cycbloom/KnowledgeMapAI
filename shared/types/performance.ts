import type { AIProviderType } from './ai';

export interface AIPerformanceLog {
  id: string;
  timestamp: number;
  operation: string;
  model: string;
  provider: AIProviderType;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  duration: number;
  success: boolean;
  errorMessage?: string;
  
  cachedInputTokens?: number;
  uncachedInputTokens?: number;
  reasoningTokens?: number;
  cacheHitRate?: number;
  costBreakdown?: {
    cachedInputCost: number;
    uncachedInputCost: number;
    outputCost: number;
    totalCost: number;
    savedByCache: number;
  };
  
  metadata?: {
    graphId?: string;
    nodeId?: string;
    userId?: string;
  };
}

export interface AIModelPricing {
  provider: AIProviderType;
  model: string;
  cachedInputPricePer1M: number;
  uncachedInputPricePer1M: number;
  outputPricePer1M: number;
}

export interface AIPerformanceStats {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedInputTokens: number;
  totalUncachedInputTokens: number;
  totalTokens: number;
  totalCost: number;
  totalSavedByCache: number;
  avgDuration: number;
  avgCacheHitRate: number;
  byOperation: Record<string, { count: number; tokens: number; cost: number; cachedTokens: number; savedCost: number }>;
  byModel: Record<string, { count: number; tokens: number; cost: number; cachedTokens: number; savedCost: number }>;
}

export interface GetPerformanceLogsQuery {
  limit?: number;
  offset?: number;
  operation?: string;
  provider?: AIProviderType;
  success?: boolean;
  startTime?: number;
  endTime?: number;
}
