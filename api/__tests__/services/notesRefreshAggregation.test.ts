import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * NotesService.refreshDailyAggregation 单元测试 (P2 Task 3.2)
 *
 * 重点验证三种场景:
 * 1. 替换场景: 正文含 ## 今日数据 段, 被整段替换为新数据
 * 2. 追加场景: 正文不含 ## 今日数据 段, 在顶部追加
 * 3. 非 daily 类型: 抛 VALIDATION_ERROR
 *
 * Mock 策略:
 * - notesService.update: vi.spyOn 拦截, 避免走 update 内部的 syncNodeLinks/refreshEmbedding
 * - supabase client: chainable mock, 支持 notes(maybeSingle) + study_cards/task_executions(head count) + focus_sessions(select)
 */

import { notesService } from "../../services/notes/notesService";

// ---------------------------------------------------------------------------
// Mock 类型与构造器
// ---------------------------------------------------------------------------

interface MockConfig {
  /** notes.select().eq().maybeSingle() 返回的行 */
  note: unknown;
  /** study_cards head count 查询返回的 count */
  studyCardsCount?: number;
  /** task_executions head count 查询返回的 count */
  taskExecutionsCount?: number;
  /** focus_sessions select 查询返回的数据 */
  focusSessions?: { duration: number }[];
}

interface MockChain {
  select: (cols?: string, opts?: { count?: string; head?: boolean }) => MockChain;
  insert: (payload: unknown) => MockChain;
  update: (payload: unknown) => MockChain;
  delete: () => MockChain;
  eq: (col: string, val: unknown) => MockChain;
  neq: (col: string, val: unknown) => MockChain;
  in: (col: string, vals: unknown[]) => MockChain;
  or: (expr: string) => MockChain;
  gte: (col: string, val: unknown) => MockChain;
  lt: (col: string, val: unknown) => MockChain;
  contains: (col: string, val: unknown) => MockChain;
  is: (col: string, val: unknown) => MockChain;
  not: (col: string, val: unknown) => MockChain;
  order: (col?: string, opts?: unknown) => MockChain;
  range: (start: number, end: number) => MockChain;
  limit: (n: number) => MockChain;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  single: () => Promise<{ data: unknown; error: null }>;
  then: (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

function createMockSupabase(config: MockConfig): { from: (table: string) => MockChain } {
  const from = (table: string): MockChain => {
    let selectOpts: { count?: string; head?: boolean } | null = null;

    const chain: MockChain = {
      select: (_cols, opts) => {
        selectOpts = opts ?? null;
        return chain;
      },
      insert: () => chain,
      update: () => chain,
      delete: () => chain,
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      or: () => chain,
      gte: () => chain,
      lt: () => chain,
      contains: () => chain,
      is: () => chain,
      not: () => chain,
      order: () => chain,
      range: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve({ data: config.note, error: null }),
      single: () => Promise.resolve({ data: config.note, error: null }),
      then: (onFulfilled, onRejected) => {
        let result: { data: unknown; error: null; count?: number };
        if (selectOpts?.head) {
          const count =
            table === "study_cards"
              ? (config.studyCardsCount ?? 0)
              : table === "task_executions"
                ? (config.taskExecutionsCount ?? 0)
                : 0;
          result = { data: null, error: null, count };
        } else {
          result = { data: config.focusSessions ?? [], error: null };
        }
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };
    return chain;
  };

  return { from };
}

// ---------------------------------------------------------------------------
// 测试数据
// ---------------------------------------------------------------------------

const NOTE_ID = "note-daily-1";
const USER_ID = "user-123";
const DATE_STR = "2026-07-03";

const baseDailyNote = {
  id: NOTE_ID,
  user_id: USER_ID,
  title: "2026-07-03 学习日志",
  content: "",
  type: "daily" as const,
  date: DATE_STR,
  template_id: null,
  tags: [],
  is_pinned: false,
  is_archived: false,
  created_at: "2026-07-03T00:00:00Z",
  updated_at: "2026-07-03T00:00:00Z",
  deleted_at: null,
};

const updatedNote = {
  ...baseDailyNote,
  content: "updated-content",
  updated_at: "2026-07-03T01:00:00Z",
};

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe("NotesService.refreshDailyAggregation (P2 Task 3.2)", () => {
  let updateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    updateSpy = vi
      .spyOn(notesService, "update")
      .mockResolvedValue(updatedNote);
  });

  afterEach(() => {
    updateSpy.mockRestore();
  });

  it("替换场景: 正文含 ## 今日数据 段时应整段替换为新数据", async () => {
    const contentWithSection =
      "# 2026-07-03 学习日志\n\n## 今日数据\n- 复习卡片: 5\n- 完成任务: 3\n- 专注时长: 60\n\n## 今日学习\n学习内容\n";

    const mockSupabase = createMockSupabase({
      note: { ...baseDailyNote, content: contentWithSection },
      studyCardsCount: 10,
      taskExecutionsCount: 7,
      focusSessions: [{ duration: 1800 }, { duration: 1200 }], // 50 min
    });

    const result = await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    // update 被调用一次
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const callArgs = updateSpy.mock.calls[0];
    const updateData = callArgs[3] as { content: string };
    const newContent = updateData.content;

    // 新数据已替换
    expect(newContent).toContain("复习卡片: 10");
    expect(newContent).toContain("完成任务: 7");
    expect(newContent).toContain("专注时长: 50");
    // 旧数据不应残留
    expect(newContent).not.toContain("复习卡片: 5");
    expect(newContent).not.toContain("完成任务: 3");
    expect(newContent).not.toContain("专注时长: 60");
    // 后续段落保留
    expect(newContent).toContain("## 今日学习");
    expect(newContent).toContain("学习内容");
    // 返回值正确
    expect(result.refreshed).toBe(true);
    expect(result.note.id).toBe(NOTE_ID);
  });

  it("追加场景: 正文不含 ## 今日数据 段时应在顶部追加", async () => {
    const contentWithoutSection = "# 我的笔记\n\n这是正文内容\n";

    const mockSupabase = createMockSupabase({
      note: { ...baseDailyNote, content: contentWithoutSection },
      studyCardsCount: 3,
      taskExecutionsCount: 2,
      focusSessions: [{ duration: 3600 }], // 60 min
    });

    const result = await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const callArgs = updateSpy.mock.calls[0];
    const updateData = callArgs[3] as { content: string };
    const newContent = updateData.content;

    // 今日数据段应在顶部追加(在原正文之前)
    expect(newContent.indexOf("## 今日数据")).toBeLessThan(
      newContent.indexOf("# 我的笔记"),
    );
    expect(newContent).toContain("复习卡片: 3");
    expect(newContent).toContain("完成任务: 2");
    expect(newContent).toContain("专注时长: 60");
    // 原正文保留
    expect(newContent).toContain("# 我的笔记");
    expect(newContent).toContain("这是正文内容");
    // 返回值正确
    expect(result.refreshed).toBe(true);
    expect(result.note.id).toBe(NOTE_ID);
  });

  it("非 daily 类型时应抛 VALIDATION_ERROR", async () => {
    const nonDailyNote = {
      ...baseDailyNote,
      type: "note" as const,
      date: null,
    };

    const mockSupabase = createMockSupabase({ note: nonDailyNote });

    await expect(
      notesService.refreshDailyAggregation(
        mockSupabase as unknown as never,
        USER_ID,
        NOTE_ID,
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    // 不应调用 update
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
