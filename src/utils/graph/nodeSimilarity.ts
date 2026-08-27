/**
 * 图内节点相似度计算工具（纯前端，零 AI 成本）。
 * 基于标题归一化 + 词元重叠 + 编辑距离的启发式相似度。
 */

/** 归一化：小写、去标点、去空白，中文按字符切分 */
export function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** 词元重叠相似度（Jaccard 变体） */
export function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

/** 归一化编辑距离（Levenshtein），返回 0~1 的相似度 */
export function normalizedEditSimilarity(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 1;
  if (s.length === 0 || t.length === 0) return 0;
  const maxLen = Math.max(s.length, t.length);
  const distance = levenshtein(s, t);
  return 1 - distance / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      prev = tmp;
    }
  }
  return dp[n];
}

export interface NodeSimilarityPair {
  /** 第一个节点（保留方，若合并） */
  a: { id: string; title: string; content?: string };
  /** 第二个节点（移除方，若合并） */
  b: { id: string; title: string; content?: string };
  /** 综合相似度 0~1 */
  score: number;
}

/**
 * 计算图内所有节点对的标题相似度。
 * @param nodes 节点列表（含 id/title/content）
 * @param threshold 相似度阈值，超过则计入结果
 * @param maxPairs 最多返回的对数
 */
export function findSimilarNodePairs(
  nodes: Array<{ id: string; title: string; content?: string }>,
  threshold = 0.72,
  maxPairs = 50,
): NodeSimilarityPair[] {
  const pairs: NodeSimilarityPair[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.id === b.id) continue;

      const tokensA = normalizeText(a.title || "");
      const tokensB = normalizeText(b.title || "");
      const overlap = tokenOverlap(tokensA, tokensB);

      // 编辑相似度：对完整标题计算
      const editSim = normalizedEditSimilarity(a.title || "", b.title || "");

      // 综合：词元重叠为主，编辑距离为辅；标题越短越依赖编辑距离
      const score = Math.max(overlap * 0.8 + editSim * 0.2, editSim);

      if (score >= threshold) {
        pairs.push({
          a: { id: a.id, title: a.title, content: a.content },
          b: { id: b.id, title: b.title, content: b.content },
          score,
        });
      }
    }
  }

  // 按相似度降序
  pairs.sort((x, y) => y.score - x.score);
  return pairs.slice(0, maxPairs);
}

/** 把相似度格式化为百分比 */
export function formatSimilarity(score: number): string {
  return `${Math.round(score * 100)}%`;
}
