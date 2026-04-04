export type AnalysisMode = 'quick' | 'deep' | 'custom';

export interface TokenEstimation {
  min: number;
  max: number;
}

const TOKEN_CONFIG = {
  quick: {
    base: 2000,
    perGraph: 500,
    variance: 0.3,
  },
  deep: {
    base: 5000,
    perGraph: 2000,
    variance: 0.5,
  },
  custom: {
    base: 3000,
    perGraph: 1500,
    variance: 0.4,
  },
} as const;

export function estimateTokenConsumption(
  mode: AnalysisMode,
  graphCount: number
): TokenEstimation {
  const config = TOKEN_CONFIG[mode];
  const baseTokens = config.base + config.perGraph * graphCount;
  const variance = config.variance;

  return {
    min: Math.round(baseTokens * (1 - variance)),
    max: Math.round(baseTokens * (1 + variance)),
  };
}

export function formatTokenCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

export function getTokenWarningLevel(tokens: TokenEstimation): 'low' | 'medium' | 'high' {
  const avgTokens = (tokens.min + tokens.max) / 2;
  if (avgTokens < 5000) return 'low';
  if (avgTokens < 15000) return 'medium';
  return 'high';
}
