import { describe, it, expect } from 'vitest';
import { splitConfigAcrossNodes } from '../../routes/ai/cards';

interface CardBatchConfig {
  count?: number;
  cards_per_type?: Record<string, number>;
  count_per_difficulty?: { easy?: number; medium?: number; hard?: number };
  count_matrix?: Record<string, { easy?: number; medium?: number; hard?: number }>;
}

/**
 * 模拟路由在 splitConfigAcrossNodes 之后做的「余数补偿」流程。
 * 复刻 api/routes/ai/cards.ts:155-262 的 per-node 装配逻辑，
 * 让单元测试不只断言 splitConfigAcrossNodes 的中间值，还能断言
 * 「所有节点合起来是否 ≈ 用户指定总数」。
 */
function applyPerNodeRemainder(
  base: CardBatchConfig,
  userConfig: CardBatchConfig,
  nodeCount: number,
): CardBatchConfig[] {
  const out: CardBatchConfig[] = [];
  let remainderCount = 0;
  const remainderPerType: Record<string, number> = {};
  const remainderPerDiff: { easy?: number; medium?: number; hard?: number } = {};
  const remainderMatrix: Record<string, { easy?: number; medium?: number; hard?: number }> = {};

  if (typeof userConfig?.count === 'number' && userConfig.count > 0) {
    remainderCount = userConfig.count - (base.count ?? 0) * nodeCount;
  }
  if (userConfig?.cards_per_type) {
    for (const [t, v] of Object.entries(userConfig.cards_per_type)) {
      const b = Number(base.cards_per_type?.[t] ?? 0);
      const rem = Number(v ?? 0) - b * nodeCount;
      if (rem > 0) remainderPerType[t] = rem;
    }
  }
  if (userConfig?.count_per_difficulty) {
    const src = userConfig.count_per_difficulty;
    const b = base.count_per_difficulty ?? {};
    (['easy', 'medium', 'hard'] as const).forEach((k) => {
      if (typeof src[k] === 'number') {
        const rem = (src[k] as number) - Number(b[k] ?? 0) * nodeCount;
        if (rem > 0) remainderPerDiff[k] = rem;
      }
    });
  }
  if (userConfig?.count_matrix) {
    for (const [t, cellRaw] of Object.entries(userConfig.count_matrix)) {
      if (!cellRaw) continue;
      const cell = cellRaw as { easy?: number; medium?: number; hard?: number };
      const baseCell = base.count_matrix?.[t] ?? {};
      const remCell: { easy?: number; medium?: number; hard?: number } = {};
      (['easy', 'medium', 'hard'] as const).forEach((k) => {
        const v = cell[k];
        if (typeof v === 'number' && v > 0) {
          const rem = v - Number(baseCell[k] ?? 0) * nodeCount;
          if (rem > 0) remCell[k] = rem;
        }
      });
      if (Object.keys(remCell).length > 0) remainderMatrix[t] = remCell;
    }
  }

  for (let i = 0; i < nodeCount; i++) {
    const nodeConfig: CardBatchConfig = JSON.parse(JSON.stringify(base));
    if (typeof nodeConfig.count === 'number' && remainderCount > 0 && i < remainderCount) {
      nodeConfig.count += 1;
    }
    if (nodeConfig.cards_per_type) {
      for (const [t, rem] of Object.entries(remainderPerType)) {
        if (rem > 0 && i < rem) {
          nodeConfig.cards_per_type[t] = (nodeConfig.cards_per_type[t] ?? 0) + 1;
        }
      }
    }
    if (nodeConfig.count_per_difficulty) {
      (['easy', 'medium', 'hard'] as const).forEach((k) => {
        const rem = remainderPerDiff[k];
        if (typeof rem === 'number' && rem > 0 && i < rem) {
          const cpd = nodeConfig.count_per_difficulty;
          if (cpd) cpd[k] = (cpd[k] ?? 0) + 1;
        }
      });
    }
    if (nodeConfig.count_matrix) {
      for (const [t, remCell] of Object.entries(remainderMatrix)) {
        const target = nodeConfig.count_matrix[t];
        if (!target) continue;
        (['easy', 'medium', 'hard'] as const).forEach((k) => {
          const rem = remCell[k];
          if (typeof rem === 'number' && rem > 0 && i < rem) {
            target[k] = (target[k] ?? 0) + 1;
          }
        });
      }
    }
    out.push(nodeConfig);
  }
  return out;
}

function totalCardsAcrossNodes(nodes: CardBatchConfig[]): number {
  let total = 0;
  for (const n of nodes) {
    if (typeof n.count === 'number') total += n.count;
    if (n.cards_per_type) {
      for (const v of Object.values(n.cards_per_type)) total += v;
    }
    if (n.count_per_difficulty) {
      for (const v of Object.values(n.count_per_difficulty)) total += v;
    }
    if (n.count_matrix) {
      for (const cell of Object.values(n.count_matrix)) {
        for (const v of Object.values(cell)) total += v;
      }
    }
  }
  return total;
}

describe('splitConfigAcrossNodes — count 总量不膨胀', () => {
  it('count=5 / 10 节点：每节点 base=0，余数把 5 张补到前 5 个节点，总量 = 5', () => {
    // 修复前：Math.max(1, 0) = 1，每节点都拿 1 → 10 张（用户要求 5，得到 10，2x 膨胀）
    const base = splitConfigAcrossNodes({ count: 5 }, 10);
    expect(base.count).toBe(0);

    const nodes = applyPerNodeRemainder(base, { count: 5 }, 10);
    expect(totalCardsAcrossNodes(nodes)).toBe(5);
  });

  it('count=1 / 10 节点：仅前 1 个节点 +1，总量 = 1', () => {
    const base = splitConfigAcrossNodes({ count: 1 }, 10);
    expect(base.count).toBe(0);

    const nodes = applyPerNodeRemainder(base, { count: 1 }, 10);
    expect(totalCardsAcrossNodes(nodes)).toBe(1);
  });

  it('count=11 / 5 节点：base=2，前 1 个节点 +1，总量 = 11', () => {
    const base = splitConfigAcrossNodes({ count: 11 }, 5);
    expect(base.count).toBe(2);

    const nodes = applyPerNodeRemainder(base, { count: 11 }, 5);
    expect(totalCardsAcrossNodes(nodes)).toBe(11);
  });

  it('count=10 / 5 节点：base=2，余数 0，总量 = 10', () => {
    const base = splitConfigAcrossNodes({ count: 10 }, 5);
    expect(base.count).toBe(2);

    const nodes = applyPerNodeRemainder(base, { count: 10 }, 5);
    expect(totalCardsAcrossNodes(nodes)).toBe(10);
  });

  it('count=20 / 5 节点：base=4，总量 = 20', () => {
    const base = splitConfigAcrossNodes({ count: 20 }, 5);
    expect(base.count).toBe(4);

    const nodes = applyPerNodeRemainder(base, { count: 20 }, 5);
    expect(totalCardsAcrossNodes(nodes)).toBe(20);
  });

  it('未传 count：保持原状（兼容旧行为：processor 默认 5/节点）', () => {
    const base = splitConfigAcrossNodes({}, 10);
    expect(base.count).toBeUndefined();
  });
});

describe('splitConfigAcrossNodes — cards_per_type 总量不膨胀', () => {
  it('cards_per_type={qa:3} / 10 节点：每节点 base=0，余数把 3 张补到前 3 节点，总量 = 3', () => {
    // 修复前：Math.max(1, 0) = 1，每节点 qa=1 → 10 张
    const base = splitConfigAcrossNodes(
      { cards_per_type: { qa: 3 } },
      10,
    );
    expect(base.cards_per_type?.qa).toBe(0);

    const nodes = applyPerNodeRemainder(
      base,
      { cards_per_type: { qa: 3 } },
      10,
    );
    expect(totalCardsAcrossNodes(nodes)).toBe(3);
  });

  it('cards_per_type={qa:7,choice:3} / 5 节点：按类型独立 floor + 余数', () => {
    const base = splitConfigAcrossNodes(
      { cards_per_type: { qa: 7, choice: 3 } },
      5,
    );
    expect(base.cards_per_type?.qa).toBe(1); // floor(7/5)
    expect(base.cards_per_type?.choice).toBe(0); // floor(3/5)

    const nodes = applyPerNodeRemainder(
      base,
      { cards_per_type: { qa: 7, choice: 3 } },
      5,
    );
    // qa: base 1*5=5, 余 2 → 前 2 节点 +1 → 7
    // choice: base 0*5=0, 余 3 → 前 3 节点 +1 → 3
    expect(totalCardsAcrossNodes(nodes)).toBe(10);
  });
});

describe('splitConfigAcrossNodes — count_per_difficulty 余数补偿', () => {
  it('cpd={easy:3} / 10 节点：base=0，余数把 3 张补到前 3 节点', () => {
    const base = splitConfigAcrossNodes(
      { count_per_difficulty: { easy: 3 } },
      10,
    );
    expect(base.count_per_difficulty?.easy).toBe(0);

    const nodes = applyPerNodeRemainder(
      base,
      { count_per_difficulty: { easy: 3 } },
      10,
    );
    expect(totalCardsAcrossNodes(nodes)).toBe(3);
  });
});

describe('splitConfigAcrossNodes — count_matrix 余数补偿', () => {
  it('matrix={qa:{easy:2}} / 10 节点：base=0，余数补到前 2 节点', () => {
    const base = splitConfigAcrossNodes(
      { count_matrix: { qa: { easy: 2 } } },
      10,
    );
    expect(base.count_matrix?.qa?.easy).toBe(0);

    const nodes = applyPerNodeRemainder(
      base,
      { count_matrix: { qa: { easy: 2 } } },
      10,
    );
    expect(totalCardsAcrossNodes(nodes)).toBe(2);
  });

  it('matrix={qa:{easy:1,medium:1,hard:1}} / 3 节点：base=0，每格余数补到前 1 节点', () => {
    const base = splitConfigAcrossNodes(
      { count_matrix: { qa: { easy: 1, medium: 1, hard: 1 } } },
      3,
    );
    expect(base.count_matrix?.qa?.easy).toBe(0);
    expect(base.count_matrix?.qa?.medium).toBe(0);
    expect(base.count_matrix?.qa?.hard).toBe(0);

    const nodes = applyPerNodeRemainder(
      base,
      { count_matrix: { qa: { easy: 1, medium: 1, hard: 1 } } },
      3,
    );
    expect(totalCardsAcrossNodes(nodes)).toBe(3);
  });
});

describe('splitConfigAcrossNodes — 边界情况', () => {
  it('nodeCount=1 时直接返回原 config（不做切分）', () => {
    const config = { count: 5, cards_per_type: { qa: 2 } };
    const result = splitConfigAcrossNodes(config, 1);
    expect(result).toBe(config); // 同一引用
  });

  it('count=0 不修改（走 processor 默认 5 行为）', () => {
    const base = splitConfigAcrossNodes({ count: 0 }, 5);
    expect(base.count).toBe(0); // 0 也保持原样，不被误改
  });
});
