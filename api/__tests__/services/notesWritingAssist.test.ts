import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * NotesService.writingAssist 单元测试 (P2 Task 3.1)
 *
 * 重点验证:
 * 1. 三种 action (continue / rewrite / expand) 调用对应 Prompt code
 * 2. AI 返回内容作为 suggestion 返回
 * 3. token 用量正确累加为 tokensUsed
 * 4. 笔记不存在时抛 RESOURCE_NOT_FOUND
 *
 * Mock 策略:
 * - getAIProviderForTask: 返回 hasKey=true 的 mock provider
 * - promptService.getRenderedPrompt: vi.fn() 用于断言调用参数
 * - performanceMonitor.recordLog: 静默
 * - pricingService.calculateCost: 返回 0
 * - embeddingOps.generateEmbedding: 返回 null(refreshEmbedding 不会执行实际写入)
 * - getSupabaseAdmin: 返回 mock client(用于 promptService 内部)
 *
 * supabase client mock:仅支持 notes.select.eq.maybeSingle 路径(供 this.get 使用)
 */

// --- Mock AI 依赖(vi.hoisted 确保变量在 vi.mock 工厂函数执行前完成初始化) ---

const { mockGetRenderedPrompt, mockChatCompletionsCreate, mockProvider } =
  vi.hoisted(() => {
    const fnGetRenderedPrompt = vi.fn();
    const fnChatCompletionsCreate = vi.fn();
    const provider = {
      hasKey: true,
      model: "test-model",
      providerType: "openai" as const,
      client: {
        chat: {
          completions: {
            create: fnChatCompletionsCreate,
          },
        },
      },
    };
    return {
      mockGetRenderedPrompt: fnGetRenderedPrompt,
      mockChatCompletionsCreate: fnChatCompletionsCreate,
      mockProvider: provider,
    };
  });

vi.mock("../../services/ai/factory", () => ({
  getAIProviderForTask: vi.fn().mockResolvedValue(mockProvider),
}));

vi.mock("../../services/ai/promptService", () => ({
  promptService: {
    getRenderedPrompt: mockGetRenderedPrompt,
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

// --- import 须在 vi.mock 之后 ---

import { notesService } from "../../services/notes/notesService";
import { promptService } from "../../services/ai/promptService";

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

const baseNote = {
  id: NOTE_ID,
  user_id: USER_ID,
  title: "测试笔记",
  content: "这是一段测试内容",
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

describe("NotesService.writingAssist (P2 Task 3.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRenderedPrompt.mockResolvedValue("rendered prompt");
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: "AI 生成的建议内容" } }],
      usage: { prompt_tokens: 50, completion_tokens: 30 },
    });
  });

  it("action='continue' 时应调用 notes_writing_continue Prompt code", async () => {
    const mockSupabase = createMockSupabase(baseNote);

    await notesService.writingAssist(mockSupabase as unknown as never, USER_ID, {
      noteId: NOTE_ID,
      action: "continue",
      selectedText: "测试文本",
    });

    expect(promptService.getRenderedPrompt).toHaveBeenCalledWith(
      expect.anything(),
      "notes_writing_continue",
      expect.objectContaining({
        selectedText: "测试文本",
        contextBefore: "",
        contextAfter: "",
      }),
      USER_ID,
    );
  });

  it("action='rewrite' 时应调用 notes_writing_rewrite Prompt code", async () => {
    const mockSupabase = createMockSupabase(baseNote);

    await notesService.writingAssist(mockSupabase as unknown as never, USER_ID, {
      noteId: NOTE_ID,
      action: "rewrite",
      selectedText: "需要改写的文本",
    });

    expect(promptService.getRenderedPrompt).toHaveBeenCalledWith(
      expect.anything(),
      "notes_writing_rewrite",
      expect.objectContaining({
        selectedText: "需要改写的文本",
        contextBefore: "",
        contextAfter: "",
      }),
      USER_ID,
    );
  });

  it("action='expand' 时应调用 notes_writing_expand Prompt code", async () => {
    const mockSupabase = createMockSupabase(baseNote);

    await notesService.writingAssist(mockSupabase as unknown as never, USER_ID, {
      noteId: NOTE_ID,
      action: "expand",
      selectedText: "需要扩写的文本",
      contextBefore: "前文上下文",
      contextAfter: "后文上下文",
    });

    expect(promptService.getRenderedPrompt).toHaveBeenCalledWith(
      expect.anything(),
      "notes_writing_expand",
      expect.objectContaining({
        selectedText: "需要扩写的文本",
        contextBefore: "前文上下文",
        contextAfter: "后文上下文",
      }),
      USER_ID,
    );
  });

  it("应返回 AI 生成的 suggestion 与累加的 tokensUsed", async () => {
    const mockSupabase = createMockSupabase(baseNote);

    const result = await notesService.writingAssist(
      mockSupabase as unknown as never,
      USER_ID,
      {
        noteId: NOTE_ID,
        action: "continue",
        selectedText: "测试",
      },
    );

    expect(result.suggestion).toBe("AI 生成的建议内容");
    // tokensUsed = inputTokens(50) + outputTokens(30) = 80
    expect(result.tokensUsed).toBe(80);
  });

  it("未提供 contextBefore/contextAfter 时应传递空字符串", async () => {
    const mockSupabase = createMockSupabase(baseNote);

    await notesService.writingAssist(mockSupabase as unknown as never, USER_ID, {
      noteId: NOTE_ID,
      action: "continue",
      selectedText: "仅选中文本",
    });

    const callArgs = mockGetRenderedPrompt.mock.calls[0];
    const context = callArgs?.[2] as Record<string, string>;
    expect(context.contextBefore).toBe("");
    expect(context.contextAfter).toBe("");
  });

  it("笔记不存在时应抛 RESOURCE_NOT_FOUND", async () => {
    const mockSupabase = createMockSupabase(null);

    await expect(
      notesService.writingAssist(mockSupabase as unknown as never, USER_ID, {
        noteId: NOTE_ID,
        action: "continue",
        selectedText: "测试",
      }),
    ).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
    });

    // 不应调用 AI
    expect(mockChatCompletionsCreate).not.toHaveBeenCalled();
  });

  it("AI 返回空内容时 suggestion 应为空字符串", async () => {
    const mockSupabase = createMockSupabase(baseNote);

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    });

    const result = await notesService.writingAssist(
      mockSupabase as unknown as never,
      USER_ID,
      {
        noteId: NOTE_ID,
        action: "continue",
        selectedText: "测试",
      },
    );

    expect(result.suggestion).toBe("");
    expect(result.tokensUsed).toBe(10);
  });
});
