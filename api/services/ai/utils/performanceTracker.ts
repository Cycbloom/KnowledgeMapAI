import type { AIProviderType } from "@shared/types";
import { performanceMonitor } from "../performanceMonitor";
import { pricingService } from "../pricingService";
import { extractTokenUsage } from "./tokenUtils";

export async function withAIPerformanceTracking<T>(
  options: {
    operation: string;
    provider: AIProviderType;
    model: string;
    metadata?: Record<string, unknown>;
  },
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

  try {
    const { result, usage } = await fn();
    const tokenUsage = extractTokenUsage(usage);
    inputTokens = tokenUsage.inputTokens;
    outputTokens = tokenUsage.outputTokens;
    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = pricingService.calculateCost(
      options.provider,
      options.model,
      inputTokens,
      outputTokens,
    );

    performanceMonitor.recordLog({
      operation: options.operation,
      provider: options.provider,
      model: options.model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      duration,
      success,
      errorMessage,
      metadata: options.metadata,
    });
  }
}
