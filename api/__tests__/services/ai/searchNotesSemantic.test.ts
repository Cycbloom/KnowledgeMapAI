import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SearchService.semanticSearch 笔记补全单元测试 (P2 Task 5.2)
 *
 * 重点验证:
 * 1. 三 RPC 并行: match_knowledge_points / search_similar_graphs / match_notes 同时调用
 * 2. 字段映射: match_notes 返回行映射为 SearchNoteResult (id=note_id, type="note", ...)
 * 3. 失败容错: match_notes 返回 error 时 notes=[], 但 graphs/nodes 仍正常返回
 *
 * Mock 策略:
 * - aiService.generateEmbedding: 返回有效 embedding 向量
 * - logger: 静默
 * - supabase client: rpc 支持 3 个 RPC 名称, from 支持 graph_nodes 查询
 */

// --- Mock 依赖 (vi.hoisted 确保 mock 函数在 vi.mock 工厂执行前就绪) ---

const { mockGenerateEmbedding, mockRpc } = vi.hoisted(() => ({
  mockGenerateEmbedding: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("../../../services/ai/aiService", () => ({
  aiService: {
    generateEmbedding: mockGenerateEmbedding,
  },
}));

vi.mock("../../../utils/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// --- import 须在 vi.mock 之后 ---

import { searchService } from "../../../services/ai/searchService";

// ---------------------------------------------------------------------------
// 辅助: 构造 supabase mock (rpc + from)
// ---------------------------------------------------------------------------

interface MockGraphNodesResult {
  data: unknown;
  error: null;
}

/**
 * 创建 mock supabase client.
 * - rpc: 由 vi.hoisted 的 mockRpc 控制(按调用顺序/参数返回不同结果)
 * - from: 仅用于 graph_nodes 查询(notDeleted 包装), 返回空数组
 */
const createMockSupabase = (graphNodesResult?: MockGraphNodesResult) => ({
  rpc: mockRpc,
  from: vi.fn(() => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve(graphNodesResult ?? { data: [], error: null }).then(
          onFulfilled,
          onRejected,
        ),
    };
    return chain;
  }),
});

const USER_ID = "user-123";
const QUERY = "React Hooks";
const EMBEDDING = [0.1, 0.2, 0.3];

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe("SearchService.semanticSearch 笔记补全 (P2 Task 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbedding.mockResolvedValue(EMBEDDING);
  });

  it("三 RPC 应并行调用 (match_knowledge_points / search_similar_graphs / match_notes)", async () => {
    // 所有 RPC 返回空数据(关注调用本身, 不关注结果)
    mockRpc.mockResolvedValue({ data: [], error: null });

    const mockSupabase = createMockSupabase();

    await searchService.semanticSearch(
      mockSupabase as unknown as never,
      QUERY,
      USER_ID,
    );

    // rpc 应被调用 3 次, 分别对应 3 个 RPC 名称
    expect(mockRpc).toHaveBeenCalledTimes(3);
    const rpcNames = mockRpc.mock.calls.map((call) => call[0]);
    expect(rpcNames).toContain("match_knowledge_points");
    expect(rpcNames).toContain("search_similar_graphs");
    expect(rpcNames).toContain("match_notes");

    // 验证 match_notes 参数
    const matchNotesCall = mockRpc.mock.calls.find(
      (call) => call[0] === "match_notes",
    );
    expect(matchNotesCall).toBeDefined();
    const matchNotesParams = matchNotesCall?.[1] as Record<string, unknown>;
    expect(matchNotesParams.query_embedding).toBe(EMBEDDING);
    expect(matchNotesParams.match_threshold).toBe(0.5);
    expect(matchNotesParams.match_count).toBe(10);
    expect(matchNotesParams.p_user_id).toBe(USER_ID);
  });

  it("match_notes 返回行应正确映射为 SearchNoteResult (id=note_id, type=note)", async () => {
    const mockNoteHits = [
      {
        id: "emb-001",
        note_id: "note-aaa",
        chunk_text: "React Hooks 是 React 16.8 引入的特性",
        title: "React 学习笔记",
        similarity: 0.85,
      },
      {
        id: "emb-002",
        note_id: "note-bbb",
        chunk_text: "useState 是最基础的 Hook,用于状态管理",
        title: "Hooks 深入",
        similarity: 0.72,
      },
    ];

    mockRpc.mockImplementation((name: string) => {
      if (name === "match_notes") {
        return Promise.resolve({ data: mockNoteHits, error: null });
      }
      // knowledge_points / graphs 返回空(避免触发 graph_nodes 查询)
      return Promise.resolve({ data: [], error: null });
    });

    const mockSupabase = createMockSupabase();

    const result = await searchService.semanticSearch(
      mockSupabase as unknown as never,
      QUERY,
      USER_ID,
    );

    // notes 应有 2 条结果
    expect(result.notes).toHaveLength(2);

    // 字段映射验证
    const first = result.notes[0];
    expect(first.id).toBe("note-aaa"); // id = note_id (非 embedding id)
    expect(first.title).toBe("React 学习笔记");
    expect(first.summary).toBe("React Hooks 是 React 16.8 引入的特性");
    expect(first.type).toBe("note");
    expect(first.updated_at).toBe("");
    expect(first.tags).toBeNull();
    expect(first.similarity).toBe(0.85);

    const second = result.notes[1];
    expect(second.id).toBe("note-bbb");
    expect(second.similarity).toBe(0.72);

    // graphs/nodes 为空(未返回数据)
    expect(result.graphs).toEqual([]);
    expect(result.nodes).toEqual([]);
  });

  it("match_notes 失败时 notes 应为空数组, 但 graphs 仍正常返回 (容错)", async () => {
    const mockGraphHits = [
      {
        id: "graph-1",
        title: "React 知识图谱",
        description: "React 生态知识图谱",
        similarity: 0.9,
      },
    ];

    mockRpc.mockImplementation((name: string) => {
      if (name === "match_notes") {
        // match_notes 返回错误
        return Promise.resolve({
          data: null,
          error: { message: "function match_notes does not exist" },
        });
      }
      if (name === "search_similar_graphs") {
        return Promise.resolve({ data: mockGraphHits, error: null });
      }
      // knowledge_points 返回空(避免触发 graph_nodes 查询)
      return Promise.resolve({ data: [], error: null });
    });

    const mockSupabase = createMockSupabase();

    const result = await searchService.semanticSearch(
      mockSupabase as unknown as never,
      QUERY,
      USER_ID,
    );

    // notes 为空(match_notes 失败)
    expect(result.notes).toEqual([]);

    // graphs 仍正常返回
    expect(result.graphs).toHaveLength(1);
    expect(result.graphs[0].id).toBe("graph-1");
    expect(result.graphs[0].title).toBe("React 知识图谱");
    expect(result.graphs[0].similarity).toBe(0.9);

    // nodes 为空(knowledge_points 无数据)
    expect(result.nodes).toEqual([]);
  });
});
