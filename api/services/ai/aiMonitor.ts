import type { AIProviderType } from '@shared/types';
import { performanceMonitor } from './performanceMonitor';
import { pricingService } from './pricingService';

export interface AIMonitoringOptions {
  operation: string;
  provider: AIProviderType;
  model: string;
  metadata?: {
    graphId?: string;
    nodeId?: string;
    userId?: string;
    batchCount?: number;
  };
  sessionId?: string;
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
  };
}

interface MonitoringResult<T> {
  result: T;
  usage?: TokenUsage;
}

/**
 * 统一的AI性能监控装饰器
 * 
 * 用于包装所有AI Provider API调用，自动记录：
 * - 输入/输出Token（含缓存命中详情）
 * - 三档成本明细（缓存命中/未命中/输出）
 * - 响应时间、成功率
 * - 缓存命中率、节省金额
 * 
 * @example
 * // 在任何AI服务中使用
 * const result = await withAIMonitoring(
 *   { operation: 'chat', provider: provider.providerType, model: provider.model },
 *   async () => {
 *     const response = await provider.client.chat.completions.create({...});
 *     return { result: response, usage: response.usage };
 *   }
 * );
 */
export async function withAIMonitoring<T>(
  options: AIMonitoringOptions,
  fn: () => Promise<MonitoringResult<T>>
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
    
    inputTokens = usage?.prompt_tokens || 0;
    outputTokens = usage?.completion_tokens || 0;
    
    cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
    uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens || 0;

    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const cacheHitRate = inputTokens > 0 ? (cachedInputTokens / inputTokens) * 100 : 0;
    
    const costBreakdown = pricingService.calculateDetailedCost(
      options.provider,
      options.model,
      inputTokens,
      outputTokens,
      cachedInputTokens
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

/**
 * 用于Embedding等非Chat类型的AI调用监控
 * Embedding不返回详细的token信息，只记录基本指标
 */
export async function withEmbeddingMonitoring<T>(
  options: Omit<AIMonitoringOptions, 'model'> & { model?: string },
  fn: () => Promise<{ result: T; tokenCount?: number }>
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;

  try {
    const { result } = await fn();
    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordLog({
      operation: options.operation,
      provider: options.provider,
      model: options.model || 'embedding-model',
      inputTokens: 1,  // embedding按次计费，简化处理
      outputTokens: 0,
      totalTokens: 1,
      estimatedCost: 0,  // embedding成本单独计算，这里简化为0
      duration,
      success,
      errorMessage,
      metadata: options.metadata,
    });
  }
}
