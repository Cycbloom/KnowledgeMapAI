/** 排序项：包含唯一标识、原始分数和关联数据 */
export interface RankedItem<T> {
  id: string;
  score: number;
  data: T;
}

/** RRF 融合排序配置 */
export interface ReciprocalRankFusionOptions {
  /** RRF 常数 k，默认 60 */
  k?: number;
}

/**
 * Reciprocal Rank Fusion（RRF）融合排序
 *
 * 对多路排序结果进行融合，公式：score = Σ(1 / (k + rank_i))
 * - rank_i 为该结果在第 i 路中的排名（从 1 开始）
 * - 同一 id 在多路出现时，RRF 分数为各路分数之和，保留最高 score 和完整 data
 * - 空路不参与计算
 *
 * @param rankedLists 多路排序结果
 * @param options 配置项，可指定 k 值
 * @returns 融合排序后的结果，按 RRF 分数降序排列
 */
export function reciprocalRankFusion<T>(
  rankedLists: RankedItem<T>[][],
  options: ReciprocalRankFusionOptions = {},
): RankedItem<T>[] {
  const { k = 60 } = options;

  // 空输入直接返回
  if (rankedLists.length === 0) {
    return [];
  }

  // 用 Map 聚合每个 id 的 RRF 分数、最高原始 score 和 data
  const fusionMap = new Map<
    string,
    { rrfScore: number; bestScore: number; data: T }
  >();

  for (const list of rankedLists) {
    // 空路跳过
    if (list.length === 0) {
      continue;
    }

    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const rankPosition = rank + 1; // 排名从 1 开始
      const contribution = 1 / (k + rankPosition);

      const existing = fusionMap.get(item.id);
      if (existing) {
        // 同一 id 在多路出现，累加 RRF 分数，保留最高 score 和 data
        existing.rrfScore += contribution;
        if (item.score > existing.bestScore) {
          existing.bestScore = item.score;
          existing.data = item.data;
        }
      } else {
        fusionMap.set(item.id, {
          rrfScore: contribution,
          bestScore: item.score,
          data: item.data,
        });
      }
    }
  }

  // 转换为数组并按 RRF 分数降序排列
  const results: (RankedItem<T> & { _rrfScore: number })[] = [];
  for (const [id, entry] of fusionMap) {
    results.push({
      id,
      score: entry.bestScore,
      data: entry.data,
      _rrfScore: entry.rrfScore,
    });
  }

  results.sort((a, b) => b._rrfScore - a._rrfScore);

  // 移除内部排序用的 _rrfScore 字段，返回标准 RankedItem
  return results.map(({ _rrfScore: _, ...item }) => item);
}
