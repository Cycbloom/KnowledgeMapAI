/**
 * 图内节点相似度计算工具。
 * 策略：优先使用节点 embedding 的余弦相似度（语义级），缺失向量时 fallback 到
 *       标题归一化 + 词元重叠 + 编辑距离的启发式（字符级，含中文分词与反义词惩罚）。
 */

/* =========================================================
 *  基础工具：分词
 * ========================================================= */

/**
 * 归一化并切分词元。
 * - 中文优先用 Intl.Segmenter 按词切分（浏览器原生），缺失环境时回退按字符切；
 * - 英文等空白分词语言按空白切；
 * - 统一小写、去标点。
 */
export function normalizeText(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
  if (!cleaned) return [];

  // 优先 Intl.Segmenter：中文按词，英文按词/空白
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
      const tokens: string[] = [];
      for (const seg of segmenter.segment(cleaned)) {
        const segText = seg.segment.trim();
        if (segText) tokens.push(segText.toLowerCase());
      }
      return tokens;
    } catch {
      /* ignore, fall through */
    }
  }

  // Fallback：含中文则按字符切，其余按空白切
  const tokens: string[] = [];
  const parts = cleaned.split(/\s+/);
  const hasChinese = /[\u4e00-\u9fff]/.test(cleaned);
  for (const part of parts) {
    if (hasChinese && /[\u4e00-\u9fff]/.test(part)) {
      for (const ch of part) tokens.push(ch);
    } else {
      tokens.push(part);
    }
  }
  return tokens.filter(Boolean);
}

/* =========================================================
 *  基础工具：字符级启发式
 * ========================================================= */

/** 词元重叠相似度（Jaccard） */
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

/* =========================================================
 *  语义护栏：否定 / 反义前缀检测
 * ========================================================= */

/** 常见中文否定/反义前缀。命中后强制相似度压到极低值。 */
const NEGATION_PREFIXES = ["无", "非", "不", "未", "反", "假", "伪"];

/**
 * 检测两个标题是否为「加否定前缀」的对立关系。
 * 例：监督学习 ↔ 无监督学习，线性 ↔ 非线性，对称 ↔ 不对称。
 * 支持前缀在前或后缀在后的组合（如 "可逆" ↔ "不可逆"，"相关" ↔ "不相关"）。
 */
export function isNegationPair(aRaw: string, bRaw: string): boolean {
  const a = aRaw.trim().toLowerCase();
  const b = bRaw.trim().toLowerCase();
  if (!a || !b || a === b) return false;

  const isNegatable = (core: string): boolean => {
    // 核心词过短（单字）不视为否定前缀结构：
    // "无 + 锡 = 无锡" 是合成词而非"锡的否定"；
    // 英文至少 3 字符以上再讨论（如 able/unable）。
    if (/[\u4e00-\u9fff]/.test(core)) {
      return [...core].length >= 2;
    }
    return core.length >= 3;
  };

  for (const prefix of NEGATION_PREFIXES) {
    const p = prefix.toLowerCase();
    if (b === p + a && isNegatable(a)) return true;
    if (a === p + b && isNegatable(b)) return true;
  }
  // 后缀场景：带 "的/性/化" 等常见后缀时，否定词可能插在中间。
  // 例："相关性" ↔ "不相关性"，"可逆的" ↔ "不可逆的"。
  const SUFFIXES = ["的", "性", "化", "式", "型", "类"];
  for (const suffix of SUFFIXES) {
    const s = suffix.toLowerCase();
    if (a.endsWith(s) && b.endsWith(s)) {
      const aCore = a.slice(0, -s.length);
      const bCore = b.slice(0, -s.length);
      if (!aCore || !bCore) continue;
      for (const prefix of NEGATION_PREFIXES) {
        const p = prefix.toLowerCase();
        if (bCore === p + aCore && isNegatable(aCore)) return true;
        if (aCore === p + bCore && isNegatable(bCore)) return true;
      }
    }
  }
  return false;
}

/* =========================================================
 *  语义相似度：纯 JS 余弦（embedding 在内存时，毫秒级）
 * ========================================================= */

/**
 * 两个向量的余弦相似度，返回 0~1（负相似度截断为 0，
 * 这里用于节点语义对比，负值通常代表对比度过强无合并意义）。
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return sim < 0 ? 0 : sim;
}

/* =========================================================
 *  核心：综合打分 + 节点对检索
 * ========================================================= */

export type SimilaritySource = "vector" | "heuristic";

export interface NodeSimilarityPair {
  a: { id: string; title: string; content?: string };
  b: { id: string; title: string; content?: string };
  /** 综合相似度 0~1 */
  score: number;
  /** 来源：vector=语义向量余弦；heuristic=字符启发式 */
  source: SimilaritySource;
}

export interface FindSimilarPairsMeta {
  /** 缺少 embedding 的节点数量（若提供了 embeddingsMap） */
  missingEmbeddingCount: number;
  /** 总节点数 */
  totalNodes: number;
}

/**
 * 字符级启发式综合打分。被用作无向量时的 fallback。
 */
function heuristicScore(
  titleA: string,
  titleB: string,
): { score: number } {
  // 1) 反义词直接判不相似
  if (isNegationPair(titleA, titleB)) {
    return { score: 0.15 };
  }

  const tokensA = normalizeText(titleA || "");
  const tokensB = normalizeText(titleB || "");
  const overlap = tokenOverlap(tokensA, tokensB);
  const editSim = normalizedEditSimilarity(titleA || "", titleB || "");

  // 2) 短标题降低编辑距离权重：标题越短，差一个字的代价越高
  const minLen = Math.min((titleA || "").length, (titleB || "").length);
  const editWeight =
    minLen <= 3 ? 0.05 : minLen <= 6 ? 0.1 : minLen <= 10 ? 0.15 : 0.2;
  const overlapWeight = 1 - editWeight;

  // 3) 不再用 Math.max(..., editSim)，防止编辑距离一票否决
  let score = overlap * overlapWeight + editSim * editWeight;

  // 4) 词元重叠很低（<10%）但编辑距离很高（>60%）时额外打折扣，
  //    惩罚 "监督学习 vs 无监督学习" 这类 "多一个字" 的假阳性
  if (overlap < 0.1 && editSim > 0.6) {
    score *= 0.6;
  }

  return { score: Math.max(0, Math.min(1, score)) };
}

/**
 * 计算图内所有节点对的相似度。
 *
 * 优先语义向量（embeddingsMap 内双方都有则用余弦，source=vector），
 * 否则走字符启发式（source=heuristic，含反义词惩罚）。
 *
 * @param nodes       节点列表
 * @param threshold   相似度阈值，默认 0.72（启发式与余弦同档，
 *                    余弦通常更可靠，误报少，故共用同一阈值）
 * @param maxPairs    最多返回对数
 * @param embeddingsMap 可选：nodeId → 1024 维向量。传入后开启语义优先模式。
 */
export function findSimilarNodePairs(
  nodes: Array<{ id: string; title: string; content?: string }>,
  threshold = 0.72,
  maxPairs = 50,
  embeddingsMap?: Map<string, number[]>,
): { pairs: NodeSimilarityPair[]; meta: FindSimilarPairsMeta } {
  const pairs: NodeSimilarityPair[] = [];

  let missingEmbeddingCount = 0;
  if (embeddingsMap) {
    for (const n of nodes) {
      if (!embeddingsMap.has(n.id)) missingEmbeddingCount++;
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.id === b.id) continue;

      let score: number;
      let source: SimilaritySource;

      const embA = embeddingsMap?.get(a.id);
      const embB = embeddingsMap?.get(b.id);
      if (embA && embB) {
        // 语义向量：优先路径
        score = cosineSimilarity(embA, embB);
        source = "vector";
      } else {
        // 字符启发式：fallback 路径
        const h = heuristicScore(a.title || "", b.title || "");
        score = h.score;
        source = "heuristic";
      }

      if (score >= threshold) {
        pairs.push({
          a: { id: a.id, title: a.title, content: a.content },
          b: { id: b.id, title: b.title, content: b.content },
          score,
          source,
        });
      }
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  return {
    pairs: pairs.slice(0, maxPairs),
    meta: {
      missingEmbeddingCount,
      totalNodes: nodes.length,
    },
  };
}

/** 把相似度格式化为百分比 */
export function formatSimilarity(score: number): string {
  return `${Math.round(score * 100)}%`;
}
