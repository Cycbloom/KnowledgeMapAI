import type { CardDifficulty, GenerateCardsOptions } from "../ai/index";

/**
 * AI 服务接口，仅包含 scheduler 层实际需要的方法。
 * 用于解耦 scheduler 层对 ai 层的直接运行时依赖，消除 scheduler→ai 循环依赖。
 */
export interface IAIProviderService {
  generateCards(
    topic: string,
    content: string,
    options?: GenerateCardsOptions,
  ): Promise<{ cards: unknown[] }>;
}

export type { CardDifficulty };
