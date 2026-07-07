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

  // ===========================================================================
  // Bug 7 回归测试: 旧正则方案在以下边界场景会失败导致数据残留/重复,改为按行分段替换后修复
  // ===========================================================================

  /** 工具:统计子串出现次数,用于断言"段不重复" */
  const countOccurrences = (str: string, substr: string): number =>
    str.split(substr).length - 1;

  it("Bug 7 回归: 标题后紧跟空行时应整段替换(空行也算段内)", async () => {
    // 旧正则 ^## 今日数据$\n... 在标题后紧跟空行时,部分场景只匹配标题行,空行+数据行残留
    const contentWithBlankAfterHeader =
      "# 日志\n\n## 今日数据\n\n- 复习卡片: 5\n- 完成任务: 3\n- 专注时长: 60\n\n## 今日学习\n";
    const mockSupabase = createMockSupabase({
      note: { ...baseDailyNote, content: contentWithBlankAfterHeader },
      studyCardsCount: 10,
      taskExecutionsCount: 7,
      focusSessions: [{ duration: 1800 }, { duration: 1200 }], // 50 min
    });

    await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateData = updateSpy.mock.calls[0][3] as { content: string };
    const newContent = updateData.content;

    // 只有一个 ## 今日数据 段
    expect(countOccurrences(newContent, "## 今日数据")).toBe(1);
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
  });

  it("Bug 7 回归: 段在文档末尾无末尾换行时应整段替换", async () => {
    // 旧正则 (?:.*\n)*? 要求每行以 \n 结尾,文档末尾无 \n 时无法匹配,导致 hasSection=false 走追加分支
    const contentNoTrailingNewline =
      "## 今日数据\n- 复习卡片: 5\n- 完成任务: 3\n- 专注时长: 60";
    const mockSupabase = createMockSupabase({
      note: { ...baseDailyNote, content: contentNoTrailingNewline },
      studyCardsCount: 10,
      taskExecutionsCount: 7,
      focusSessions: [{ duration: 1800 }, { duration: 1200 }],
    });

    await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateData = updateSpy.mock.calls[0][3] as { content: string };
    const newContent = updateData.content;

    // 只有一个 ## 今日数据 段(关键:旧逻辑会追加新段,产生两个)
    expect(countOccurrences(newContent, "## 今日数据")).toBe(1);
    expect(newContent).toContain("复习卡片: 10");
    expect(newContent).toContain("专注时长: 50");
    expect(newContent).not.toContain("复习卡片: 5");
    expect(newContent).not.toContain("专注时长: 60");
  });

  it("Bug 7 回归: \\r\\n 换行时应整段替换", async () => {
    // 旧正则 $\n 不匹配 \r\n,导致 hasSection=false 走追加分支,产生两个段
    const contentCrlf =
      "## 今日数据\r\n- 复习卡片: 5\r\n- 完成任务: 3\r\n- 专注时长: 60\r\n\r\n## 今日学习\r\n";
    const mockSupabase = createMockSupabase({
      note: { ...baseDailyNote, content: contentCrlf },
      studyCardsCount: 10,
      taskExecutionsCount: 7,
      focusSessions: [{ duration: 1800 }, { duration: 1200 }],
    });

    await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateData = updateSpy.mock.calls[0][3] as { content: string };
    const newContent = updateData.content;

    // 只有一个 ## 今日数据 段
    expect(countOccurrences(newContent, "## 今日数据")).toBe(1);
    expect(newContent).toContain("复习卡片: 10");
    expect(newContent).toContain("专注时长: 50");
    expect(newContent).not.toContain("复习卡片: 5");
    expect(newContent).not.toContain("专注时长: 60");
    // 后续段落保留
    expect(newContent).toContain("## 今日学习");
  });

  it("Bug 7 回归: 标题含尾部空格时应整段替换", async () => {
    // 旧正则 ^## 今日数据$ 不匹配 "## 今日数据 "(尾部空格),走追加分支产生两个段
    const contentTrailingSpace =
      "## 今日数据 \n- 复习卡片: 5\n- 完成任务: 3\n- 专注时长: 60\n";
    const mockSupabase = createMockSupabase({
      note: { ...baseDailyNote, content: contentTrailingSpace },
      studyCardsCount: 10,
      taskExecutionsCount: 7,
      focusSessions: [{ duration: 1800 }, { duration: 1200 }],
    });

    await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateData = updateSpy.mock.calls[0][3] as { content: string };
    const newContent = updateData.content;

    // 只有一个 ## 今日数据 段(新段标题无尾部空格)
    expect(countOccurrences(newContent, "## 今日数据")).toBe(1);
    expect(newContent).toContain("复习卡片: 10");
    expect(newContent).toContain("专注时长: 50");
    expect(newContent).not.toContain("复习卡片: 5");
    expect(newContent).not.toContain("专注时长: 60");
  });

  it("Bug 7 回归: 多次连续刷新数据不应重复追加", async () => {
    // 旧正则在部分场景只替换标题行,数据行残留;下次刷新再追加新数据,导致数据重复
    const originalContent =
      "# 日志\n\n## 今日数据\n- 复习卡片: 5\n- 完成任务: 3\n- 专注时长: 60\n\n## 今日学习\n";
    const config = {
      note: { ...baseDailyNote, content: originalContent },
      studyCardsCount: 10,
      taskExecutionsCount: 7,
      focusSessions: [{ duration: 1800 }, { duration: 1200 }], // 50 min
    };
    const mockSupabase = createMockSupabase(config);

    // 第一次刷新
    await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const firstContent = (updateSpy.mock.calls[0][3] as { content: string })
      .content;
    // 只有一个段
    expect(countOccurrences(firstContent, "## 今日数据")).toBe(1);
    expect(firstContent).toContain("复习卡片: 10");
    expect(firstContent).not.toContain("复习卡片: 5");

    // 模拟落盘后再次刷新:更新 mock 中的 note.content 为第一次刷新的结果
    config.note = { ...baseDailyNote, content: firstContent };

    await notesService.refreshDailyAggregation(
      mockSupabase as unknown as never,
      USER_ID,
      NOTE_ID,
    );
    expect(updateSpy).toHaveBeenCalledTimes(2);
    const secondContent = (updateSpy.mock.calls[1][3] as { content: string })
      .content;

    // 关键断言: 第二次刷新后仍只有一个段,且数据条目数量正确(无重复)
    expect(countOccurrences(secondContent, "## 今日数据")).toBe(1);
    expect(countOccurrences(secondContent, "- 复习卡片:")).toBe(1);
    expect(countOccurrences(secondContent, "- 完成任务:")).toBe(1);
    expect(countOccurrences(secondContent, "- 专注时长:")).toBe(1);
    expect(secondContent).toContain("复习卡片: 10");
    expect(secondContent).toContain("完成任务: 7");
    expect(secondContent).toContain("专注时长: 50");
    // 后续段落保留
    expect(secondContent).toContain("## 今日学习");
  });
});
