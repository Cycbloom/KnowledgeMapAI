export function extractTokenUsage(
  usage:
    | {
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
    | undefined,
): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
  reasoningTokens: number;
} {
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0;

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    uncachedInputTokens: Math.max(0, inputTokens - cachedInputTokens),
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens || 0,
  };
}
