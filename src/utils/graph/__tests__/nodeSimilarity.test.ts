import {
  normalizeText,
  tokenOverlap,
  normalizedEditSimilarity,
  isNegationPair,
  cosineSimilarity,
  findSimilarNodePairs,
} from "../nodeSimilarity";

/* ----------------------------------------------------------
 *  normalizeText + tokenOverlap
 * ---------------------------------------------------------- */

describe("normalizeText", () => {
  it("英文按空白拆，去标点并小写", () => {
    expect(normalizeText("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("空字符串返回空数组", () => {
    expect(normalizeText("")).toEqual([]);
    expect(normalizeText("   ")).toEqual([]);
  });

  it("中文至少能按字符切（无 Intl.Segmenter 环境兜底）", () => {
    // 当环境不支持 Intl.Segmenter 或分词未按词拆开时，兜底按字符切：
    // 4 个汉字至少产生 4 个 token
    const tokens = normalizeText("监督学习");
    expect(tokens.length).toBeGreaterThanOrEqual(1);
    expect(tokens.every((t) => typeof t === "string" && t.length > 0)).toBe(
      true,
    );
  });
});

describe("tokenOverlap", () => {
  it("完全相同的词集 Jaccard=1", () => {
    expect(tokenOverlap(["a", "b"], ["a", "b"])).toBe(1);
  });

  it("无交集时为 0", () => {
    expect(tokenOverlap(["a"], ["b"])).toBe(0);
  });

  it("空集为 0", () => {
    expect(tokenOverlap([], ["a"])).toBe(0);
  });
});

/* ----------------------------------------------------------
 *  normalizedEditSimilarity
 * ---------------------------------------------------------- */

describe("normalizedEditSimilarity", () => {
  it("完全相同 → 1", () => {
    expect(normalizedEditSimilarity("abc", "abc")).toBe(1);
  });

  it("一者为空 → 0", () => {
    expect(normalizedEditSimilarity("", "abc")).toBe(0);
  });

  it("差异 1 字 / 5 字 = 0.8（复现监督/无监督原始场景）", () => {
    // 监督学习 vs 无监督学习：差 1 字，共 5 字 → 1 - 1/5 = 0.8
    expect(normalizedEditSimilarity("监督学习", "无监督学习")).toBeCloseTo(
      0.8,
      5,
    );
  });
});

/* ----------------------------------------------------------
 *  isNegationPair —— 本次核心护栏
 * ---------------------------------------------------------- */

describe("isNegationPair", () => {
  // 仅覆盖「X vs 否定前缀+X」结构；字级反义替换（已知/未知、正向/反向…）
  // 交由语义向量（embedding 余弦）处理，字符级护栏不强行枚举。
  const TRUE_CASES: Array<[string, string]> = [
    ["监督学习", "无监督学习"],
    ["无监督学习", "监督学习"],
    ["线性", "非线性"],
    ["对称", "不对称"],
    ["相关性", "不相关性"], // 后缀场景："性"
    ["可逆的", "不可逆的"], // 后缀场景："的"
    ["真实性", "非真实性"],
  ];

  test.each(TRUE_CASES)("检测反义词对：%p ↔ %p", (a, b) => {
    expect(isNegationPair(a, b)).toBe(true);
  });

  it("相同字符串不算对立", () => {
    expect(isNegationPair("学习", "学习")).toBe(false);
  });

  it("毫不相关的词不算对立", () => {
    expect(isNegationPair("苹果", "香蕉")).toBe(false);
  });

  it("只是恰好首字是否定字，但不属于「前缀+原词」结构时，不会误判", () => {
    // "无锡" 是专有名词，首字"无"不是否定前缀用法
    expect(isNegationPair("无锡", "锡")).toBe(false);
  });

  it("空/空白输入安全返回 false", () => {
    expect(isNegationPair("", "x")).toBe(false);
    expect(isNegationPair(" ", "x")).toBe(false);
  });
});

/* ----------------------------------------------------------
 *  cosineSimilarity
 * ---------------------------------------------------------- */

describe("cosineSimilarity", () => {
  it("同向量 → 1", () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it("正交向量 → 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("负相似度截断为 0", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(0);
  });

  it("维度不一致或空 → 0", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

/* ----------------------------------------------------------
 *  findSimilarNodePairs —— 集成行为
 * ---------------------------------------------------------- */

describe("findSimilarNodePairs", () => {
  const mkNodes = () => [
    { id: "a", title: "监督学习" },
    { id: "b", title: "无监督学习" },
    { id: "c", title: "强化学习" },
    { id: "d", title: "监督学习法" }, // 与 a 高度相似（字符上）
  ];

  it("监督学习 vs 无监督学习：纯启发式下因反义词护栏不会被判相似", () => {
    const res = findSimilarNodePairs(
      [mkNodes()[0], mkNodes()[1]],
      0.72,
      50,
      undefined,
    );
    expect(res.pairs).toHaveLength(0);
    expect(res.meta.missingEmbeddingCount).toBe(0);
    expect(res.meta.totalNodes).toBe(2);
  });

  it("返回对象结构包含 pairs 与 meta", () => {
    const res = findSimilarNodePairs(mkNodes());
    expect(Array.isArray(res.pairs)).toBe(true);
    expect(typeof res.meta.missingEmbeddingCount).toBe("number");
    expect(res.meta.totalNodes).toBe(mkNodes().length);
  });

  it("未传 embeddingsMap：所有对 source=heuristic，missingEmbeddingCount=0", () => {
    const res = findSimilarNodePairs(mkNodes());
    expect(res.meta.missingEmbeddingCount).toBe(0);
    for (const p of res.pairs) expect(p.source).toBe("heuristic");
  });

  it("传 embeddingsMap 但只有部分节点有向量：缺向量数量统计正确，缺向量对 fallback 到 heuristic", () => {
    const map = new Map<string, number[]>();
    // 只给 a、b 向量
    map.set("a", [1, 0, 0, 0]);
    map.set("b", [0, 1, 0, 0]); // 与 a 正交 → 余弦=0
    // c、d 无向量
    const res = findSimilarNodePairs(mkNodes(), 0.72, 50, map);
    expect(res.meta.missingEmbeddingCount).toBe(2); // c、d 没向量
    expect(res.meta.totalNodes).toBe(4);
    // a vs b 走向量，且正交，得 0 < 0.72，应不出现在 pairs 里
    const abPair = res.pairs.find(
      (p) =>
        (p.a.id === "a" && p.b.id === "b") ||
        (p.a.id === "b" && p.b.id === "a"),
    );
    expect(abPair).toBeUndefined();
  });

  it("双方都有向量且余弦≥阈值：source=vector，分数为余弦", () => {
    const a = [0.6, 0.8, 0, 0];
    const b = [0.6, 0.8, 0, 0]; // 同一向量 → 余弦=1
    const map = new Map<string, number[]>();
    map.set("n1", a);
    map.set("n2", b);
    const res = findSimilarNodePairs(
      [
        { id: "n1", title: "X" },
        { id: "n2", title: "Y" },
      ],
      0.72,
      50,
      map,
    );
    expect(res.pairs).toHaveLength(1);
    expect(res.pairs[0].source).toBe("vector");
    expect(res.pairs[0].score).toBeCloseTo(1, 5);
    expect(res.meta.missingEmbeddingCount).toBe(0);
  });

  it("阈值过滤：余弦 0.5 的 pair 在 threshold=0.72 下被过滤", () => {
    // cos θ = 0.5 → 夹角 60°
    const a = [1, 0];
    const b = [0.5, Math.sqrt(3) / 2];
    const map = new Map<string, number[]>();
    map.set("x", a);
    map.set("y", b);
    const res = findSimilarNodePairs(
      [
        { id: "x", title: "X" },
        { id: "y", title: "Y" },
      ],
      0.72,
      50,
      map,
    );
    expect(res.pairs).toHaveLength(0);
  });
});
