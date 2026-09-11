import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findReusableKnowledgePointId } from '../../utils/similaritySearch';

vi.mock('../../services/ai/aiService', () => ({
  aiService: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2]),
  },
}));

vi.mock('../../services/common/cacheService', () => ({
  cacheService: {
    getOrSet: async (_key: string, fetch: () => Promise<unknown>) => fetch(),
  },
  CacheKeys: {},
  CacheTTL: {},
  computeTextHash: (t: string) => t,
}));

function makeSupabase(kpRows: Array<{ id: string; properties: Record<string, unknown> | null }>) {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: [
        { id: 'generic-kp', title: '未来展望', similarity: 0.95, visibility: 'private' },
        { id: 'specific-kp', title: 'TCP 三次握手', similarity: 0.9, visibility: 'private' },
      ],
      error: null,
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'knowledge_points') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: kpRows, error: null }),
        };
      }
      // graph_nodes：默认无命中（不触发排除）
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };
}

describe('findReusableKnowledgePointId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('候选全部为泛化名称（generic）时返回 null，不跨图谱复用', async () => {
    const supabase = makeSupabase([
      { id: 'generic-kp', properties: { specificity: 'generic' } },
      { id: 'specific-kp', properties: { specificity: 'generic' } },
    ]);

    const result = await findReusableKnowledgePointId(
      supabase as never,
      'user-1',
      '未来展望',
      { bypassCache: true },
    );

    expect(result).toBeNull();
  });

  it('过滤 generic 候选后，返回剩余候选中的最高相似度节点', async () => {
    const supabase = makeSupabase([
      { id: 'generic-kp', properties: { specificity: 'generic' } },
      { id: 'specific-kp', properties: { specificity: 'specific' } },
    ]);

    const result = await findReusableKnowledgePointId(
      supabase as never,
      'user-1',
      'TCP 三次握手',
      { bypassCache: true },
    );

    expect(result).toBe('specific-kp');
  });

  it('候选均无 specificity 标注时维持原行为（返回最高相似度节点）', async () => {
    const supabase = makeSupabase([
      { id: 'generic-kp', properties: null },
      { id: 'specific-kp', properties: null },
    ]);

    const result = await findReusableKnowledgePointId(
      supabase as never,
      'user-1',
      'TCP 三次握手',
      { bypassCache: true },
    );

    expect(result).toBe('generic-kp');
  });
});
