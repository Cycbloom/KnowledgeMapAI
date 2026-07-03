import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RAG 笔记扩展单元测试 (P1 Task 5.5)
 *
 * 覆盖两个核心场景:
 * 1. 笔记 embedding 命中检索 (ragSearchService.noteSemanticSearch)
 *    - mock getSupabaseAdmin.rpc("match_notes") 返回笔记 embedding 命中
 *    - 断言结果 type='note', id 为 note_id (便于前端跳转 /notes/:noteId)
 *    - 容错: embedding 生成失败 / rpc 错误 / rerank 失败回退
 *
 * 2. RAG 上下文含笔记内容 (contextWindowManager.buildContext with noteSources)
 *    - 直接调用 contextWindowManager 传入 noteSources (挂载笔记)
 *    - 断言上下文包含 [挂载笔记] 段落和笔记标题/内容
 *    - 向后兼容: 无 noteSources 时不输出 [挂载笔记] 段落
 *
 * Mock 策略:
 * - getSupabaseAdmin: 返回 { rpc: mockRpc } 用于 match_notes RPC
 * - AIService: 构造函数返回 { generateEmbedding: mockGenerateEmbedding }
 * - rerankingService: rerank reject (验证 pgvector 回退)
 * - logger: 静默
 */

// --- Mock 依赖 (vi.hoisted 确保变量在 vi.mock 工厂函数执行前完成初始化) ---

const { mockRpc, mockGenerateEmbedding } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGenerateEmbedding: vi.fn(),
}));

vi.mock("../../../supabase", () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({
    rpc: mockRpc,
  }),
}));

vi.mock("../../../services/ai/aiService", () => ({
  AIService: class MockAIService {
    generateEmbedding = mockGenerateEmbedding;
  },
}));

vi.mock("../../../services/ai/rerankingService", () => ({
  rerankingService: {
    rerank: vi.fn().mockRejectedValue(new Error("rerank unavailable in test")),
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

import { ragSearchService } from "../../../services/ai/ragSearchService";
import { contextWindowManager } from "../../../services/ai/contextWindowManager";

const USER_ID = "user-123";

describe("RAGSearchService.noteSemanticSearch 笔记 embedding 命中检索 (P1 Task 5.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认返回有效 embedding 向量 (维度不影响 mock 行为)
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  it("应返回 type='note' 的笔记命中, 且 id 为 note_id (便于前端跳转)", async () => {
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
        chunk_text: "useState 是最基础的 Hook",
        title: "Hooks 深入",
        similarity: 0.72,
      },
    ];
    mockRpc.mockResolvedValue({ data: mockNoteHits, error: null });

    const results = await ragSearchService.noteSemanticSearch("hooks", USER_ID, {
      matchThreshold: 0.3,
      matchCount: 5,
    });

    expect(results).toHaveLength(2);
    // 关键断言: type 标记为 'note' (与 'document' 区分)
    expect(results.every((r) => r.type === "note")).toBe(true);
    // id 为 note_id (不是 embedding id), 便于前端跳转到 /notes/:noteId
    expect(results[0].id).toBe("note-aaa");
    expect(results[1].id).toBe("note-bbb");
    // 内容映射正确
    expect(results[0].title).toBe("React 学习笔记");
    expect(results[0].content).toBe("React Hooks 是 React 16.8 引入的特性");
    expect(results[0].similarity).toBe(0.85);
    expect(results[0].graphId).toBe("");

    // 验证 rpc 调用参数
    expect(mockRpc).toHaveBeenCalledWith(
      "match_notes",
      expect.objectContaining({
        match_threshold: 0.3,
        match_count: 20, // candidateCount = max(5 * 4, 20) = 20
        p_user_id: USER_ID,
      }),
    );
  });

  it("embedding 生成失败时应返回空数组 (不抛错)", async () => {
    mockGenerateEmbedding.mockResolvedValue(null);

    const results = await ragSearchService.noteSemanticSearch("query", USER_ID);

    expect(results).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rpc 返回错误时应返回空数组 (容错不抛错)", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "function match_notes does not exist" },
    });

    const results = await ragSearchService.noteSemanticSearch("query", USER_ID);

    expect(results).toEqual([]);
  });

  it("rerank 失败时应回退到 pgvector 原始排序", async () => {
    const mockNoteHits = [
      {
        id: "emb-001",
        note_id: "note-aaa",
        chunk_text: "内容 A",
        title: "笔记 A",
        similarity: 0.9,
      },
      {
        id: "emb-002",
        note_id: "note-bbb",
        chunk_text: "内容 B",
        title: "笔记 B",
        similarity: 0.8,
      },
    ];
    mockRpc.mockResolvedValue({ data: mockNoteHits, error: null });

    // rerankingService.rerank 已在顶部 mock 为 reject, 此处验证回退逻辑
    const results = await ragSearchService.noteSemanticSearch("query", USER_ID, {
      matchCount: 5,
    });

    // 回退后仍应返回 2 条结果, 保持原始 pgvector 排序 (similarity 降序)
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("note-aaa");
    expect(results[0].similarity).toBe(0.9);
    expect(results[1].id).toBe("note-bbb");
    expect(results[1].similarity).toBe(0.8);
    expect(results.every((r) => r.type === "note")).toBe(true);
  });

  it("无命中时应返回空数组", async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const results = await ragSearchService.noteSemanticSearch("query", USER_ID);

    expect(results).toEqual([]);
  });
});

describe("ContextWindowManager.buildContext 挂载笔记上下文 (P1 Task 5.4)", () => {
  it("上下文应包含 [挂载笔记] 段落和笔记内容", () => {
    const sources = [
      {
        id: "kp-1",
        title: "知识点 1",
        content: "这是知识点内容",
        similarity: 0.8,
        graphId: "graph-1",
      },
    ];
    const noteSources = [
      {
        id: "note-1",
        title: "React Hooks 笔记",
        content: "useState 用于状态管理, useEffect 用于副作用处理",
      },
    ];

    const { context } = contextWindowManager.buildContext(sources, {
      maxTokens: 2000,
      noteSources,
    });

    // 上下文应包含 [挂载笔记] 标题段落
    expect(context).toContain("[挂载笔记]");
    // 上下文应包含笔记标题和内容
    expect(context).toContain("React Hooks 笔记");
    expect(context).toContain("useState 用于状态管理");
    // 知识节点段落仍应存在
    expect(context).toContain("[相关知识节点]");
  });

  it("无挂载笔记时不应输出 [挂载笔记] 段落 (向后兼容)", () => {
    const sources = [
      {
        id: "kp-1",
        title: "知识点 1",
        content: "这是知识点内容",
        similarity: 0.8,
        graphId: "graph-1",
      },
    ];

    const { context } = contextWindowManager.buildContext(sources, {
      maxTokens: 2000,
    });

    expect(context).not.toContain("[挂载笔记]");
    // 仍应包含相关知识节点
    expect(context).toContain("[相关知识节点]");
  });

  it("笔记内容超过 1000 字符时应被截断", () => {
    const longContent = "A".repeat(1500);
    const noteSources = [
      {
        id: "note-1",
        title: "长笔记",
        content: longContent,
      },
    ];

    const { context } = contextWindowManager.buildContext([], {
      maxTokens: 5000,
      noteSources,
    });

    expect(context).toContain("[挂载笔记]");
    expect(context).toContain("长笔记");
    // 截断后应只包含前 1000 字符
    const aCount = (context.match(/A/g) || []).length;
    expect(aCount).toBe(1000);
  });

  it("多个挂载笔记应全部包含在上下文中", () => {
    const noteSources = [
      { id: "note-1", title: "笔记一", content: "内容一" },
      { id: "note-2", title: "笔记二", content: "内容二" },
      { id: "note-3", title: "笔记三", content: "内容三" },
    ];

    const { context } = contextWindowManager.buildContext([], {
      maxTokens: 5000,
      noteSources,
    });

    expect(context).toContain("[挂载笔记]");
    expect(context).toContain("笔记一");
    expect(context).toContain("内容一");
    expect(context).toContain("笔记二");
    expect(context).toContain("内容二");
    expect(context).toContain("笔记三");
    expect(context).toContain("内容三");
  });
});
