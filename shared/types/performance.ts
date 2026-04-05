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
  metadata?: {
    graphId?: string;
    nodeId?: string;
    userId?: string;
  };
}

export interface AIModelPricing {
  provider: AIProviderType;
  model: string;
  inputPricePer1k: number;
  outputPricePer1k: number;
}

export interface AIPerformanceStats {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  avgDuration: number;
  byOperation: Record<string, { count: number; tokens: number; cost: number }>;
  byModel: Record<string, { count: number; tokens: number; cost: number }>;
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
