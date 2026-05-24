import type { AIProviderType } from "@shared/types";
import { performanceMonitor } from "../performanceMonitor";
import { pricingService } from "../pricingService";
import { extractTokenUsage } from "./tokenUtils";

export interface AIPerformanceTrackingOptions {
  operation: string;
  provider: AIProviderType;
  model: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

export async function withAIPerformanceTracking<T>(
  options: AIPerformanceTrackingOptions,
  fn: () => Promise<{
    result: T;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number; audio_tokens?: number };
      completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
      };
    };
  }>,
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let uncachedInputTokens = 0;
  let reasoningTokens = 0;

  try {
    const { result, usage } = await fn();
    const tokenUsage = extractTokenUsage(usage);
    inputTokens = tokenUsage.inputTokens;
    outputTokens = tokenUsage.outputTokens;
    cachedInputTokens = tokenUsage.cachedInputTokens;
    uncachedInputTokens = tokenUsage.uncachedInputTokens;
    reasoningTokens = tokenUsage.reasoningTokens;
    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const cacheHitRate =
      inputTokens > 0 ? (cachedInputTokens / inputTokens) * 100 : 0;

    const costBreakdown = pricingService.calculateDetailedCost(
      options.provider,
      options.model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
    );

    performanceMonitor.recordLog({
      operation: options.operation,
      provider: options.provider,
      model: options.model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: costBreakdown.totalCost,
      duration,
      success,
      errorMessage,
      metadata: options.metadata,
      sessionId: options.sessionId,

      cachedInputTokens,
      uncachedInputTokens,
      reasoningTokens,
      cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
      costBreakdown,
    });
  }
}
