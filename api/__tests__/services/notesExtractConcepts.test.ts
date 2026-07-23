import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * NotesService.extractConcepts 单元测试 (P1 Task 4)
 *
 * 重点验证:AI 返回非 JSON 内容时的容错处理。
 * - 非 JSON 内容 → 不抛错,返回 { concepts: [] }
 * - 有效 JSON → 正常解析返回 concepts 列表
 *
 * Mock 策略:
 * - getAIProviderForTask: 返回 hasKey=true 的 mock provider
 * - promptService.getRenderedPrompt: 返回渲染后的 prompt 字符串
 * - getSupabaseAdmin: 返回 mock client(用于 promptService 内部)
 * - performanceMonitor.recordLog: 静默
 * - pricingService.calculateCost: 返回 0
 *
 * supabase client mock:复用与 notesService.test.ts 相同的最小化 chainable client,
 * 仅支持 extractConcepts 所需的 from('notes').select().eq().maybeSingle() 路径。
 */

// --- Mock AI 依赖(必须在 import notesService 之前声明) ---
// vi.mock 工厂会被提升到文件顶部,故用 vi.hoisted 确保 mockProvider 可用

const { mockChatCompletionsCreate, mockProvider } = vi.hoisted(() => {
  const mockChatCompletionsCreate = vi.fn();
  const mockProvider = {
    hasKey: true,
    model: "test-model",
    providerType: "openai" as const,
    client: {
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    },
  };
  return { mockChatCompletionsCreate, mockProvider };
});

vi.mock("../../services/ai/factory", () => ({
  getAIProviderForTask: vi.fn().mockResolvedValue(mockProvider),
}));

vi.mock("../../services/ai/promptService", () => ({
  promptService: {
    getRenderedPrompt: vi.fn().mockResolvedValue("rendered prompt"),
  },
}));

vi.mock("../../services/ai/performanceMonitor", () => ({
  performanceMonitor: {
    recordLog: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../services/ai/pricingService", () => ({
  pricingService: {
    calculateCost: vi.fn().mockReturnValue(0),
  },
}));

vi.mock("../../services/ai/embeddingOps", () => ({
  embeddingOps: {
    generateEmbedding: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../supabase", () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({}),
}));

// --- import 须在 vi.mock 之后(避免 hoisting 顺序问题) ---

import { notesService } from "../../services/notes/notesService";

// --- 最小化 supabase client mock ---

const NOTE_ID = "note-123";
const USER_ID = "user-123";

const createMockSupabase = (noteData: unknown) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: noteData, error: null }),
      }),
    }),
  }),
});

describe("NotesService.extractConcepts JSON 解析容错", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI 返回非 JSON 内容时应返回空 concepts 数组(不抛错)", async () => {
    // 配置:笔记存在且 content 非空
    const note = {
      id: NOTE_ID,
      user_id: USER_ID,
      title: "测试笔记",
      content: "这是一段包含知识点的笔记内容",
      type: "note" as const,
      date: null,
      template_id: null,
      tags: [],
      is_pinned: false,
      is_archived: false,
      created_at: "2026-07-03T00:00:00Z",
      updated_at: "2026-07-03T00:00:00Z",
      deleted_at: null,
    };

    const mockSupabase = createMockSupabase(note);

    // AI 返回纯文本(非 JSON)
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "This is not a JSON response at all" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const result = await notesService.extractConcepts(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    // 应返回空数组,不抛错
    expect(result).toEqual({ concepts: [] });
    expect(result.concepts).toHaveLength(0);
  });

  it("AI 返回有效 JSON 时应正确解析为 concepts 列表", async () => {
    const note = {
      id: NOTE_ID,
      user_id: USER_ID,
      title: "测试笔记",
      content: "## React Hooks\n\nuseState 和 useEffect 是基础 Hook",
      type: "note" as const,
      date: null,
      template_id: null,
      tags: [],
      is_pinned: false,
      is_archived: false,
      created_at: "2026-07-03T00:00:00Z",
      updated_at: "2026-07-03T00:00:00Z",
      deleted_at: null,
    };

    const mockSupabase = createMockSupabase(note);

    const validConcepts = {
      concepts: [
        {
          name: "useState",
          description: "React 状态管理 Hook",
          related: ["useEffect"],
        },
        {
          name: "useEffect",
          description: "React 副作用 Hook",
          related: [],
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validConcepts) } }],
      usage: { prompt_tokens: 20, completion_tokens: 30 },
    });

    const result = await notesService.extractConcepts(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(result.concepts).toHaveLength(2);
    expect(result.concepts[0].name).toBe("useState");
    expect(result.concepts[0].description).toBe("React 状态管理 Hook");
    expect(result.concepts[0].related).toEqual(["useEffect"]);
    expect(result.concepts[1].name).toBe("useEffect");
  });

  it("AI 返回 markdown code fence 包裹的 JSON 时应正确解析", async () => {
    const note = {
      id: NOTE_ID,
      user_id: USER_ID,
      title: "测试笔记",
      content: "## 算法\n\n二分查找是基础算法",
      type: "note" as const,
      date: null,
      template_id: null,
      tags: [],
      is_pinned: false,
      is_archived: false,
      created_at: "2026-07-03T00:00:00Z",
      updated_at: "2026-07-03T00:00:00Z",
      deleted_at: null,
    };

    const mockSupabase = createMockSupabase(note);

    const validConcepts = {
      concepts: [
        {
          name: "二分查找",
          description: "在有序数组中查找元素",
          related: [],
        },
      ],
    };

    // 用 markdown code fence 包裹
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: `\`\`\`json\n${  JSON.stringify(validConcepts)  }\n\`\`\``,
          },
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 10 },
    });

    const result = await notesService.extractConcepts(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(result.concepts).toHaveLength(1);
    expect(result.concepts[0].name).toBe("二分查找");
  });

  it("笔记内容为空时应直接返回空数组(不调用 AI)", async () => {
    const note = {
      id: NOTE_ID,
      user_id: USER_ID,
      title: "空笔记",
      content: "",
      type: "note" as const,
      date: null,
      template_id: null,
      tags: [],
      is_pinned: false,
      is_archived: false,
      created_at: "2026-07-03T00:00:00Z",
      updated_at: "2026-07-03T00:00:00Z",
      deleted_at: null,
    };

    const mockSupabase = createMockSupabase(note);

    const result = await notesService.extractConcepts(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(result).toEqual({ concepts: [] });
    // 不应调用 AI
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  it("AI 返回部分字段缺失的 JSON 时应过滤无效条目", async () => {
    const note = {
      id: NOTE_ID,
      user_id: USER_ID,
      title: "测试笔记",
      content: "一些内容",
      type: "note" as const,
      date: null,
      template_id: null,
      tags: [],
      is_pinned: false,
      is_archived: false,
      created_at: "2026-07-03T00:00:00Z",
      updated_at: "2026-07-03T00:00:00Z",
      deleted_at: null,
    };

    const mockSupabase = createMockSupabase(note);

    // 含无效条目:name 为空字符串、name 不是字符串
    const mixedConcepts = {
      concepts: [
        { name: "有效概念", description: "描述" },
        { name: "", description: "空 name 应被过滤" },
        { description: "缺 name 字段应被过滤" },
        { name: 123, description: "name 非字符串应被过滤" },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify(mixedConcepts) } },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10 },
    });

    const result = await notesService.extractConcepts(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    // 仅保留有效条目
    expect(result.concepts).toHaveLength(1);
    expect(result.concepts[0].name).toBe("有效概念");
  });
});
