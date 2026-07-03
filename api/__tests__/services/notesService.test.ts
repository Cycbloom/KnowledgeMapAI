import { describe, it, expect, beforeEach } from "vitest";
import { notesService } from "../../services/notes/notesService";

/**
 * NotesService 单元测试
 *
 * 覆盖:
 * 1. 挂载关系同步(syncNodeLinks):新增/删除 [[节点名]] 链接
 * 2. Daily 唯一约束:getOrCreateTodayDaily 重复创建返回已有
 * 3. 聚合变量渲染:renderTemplate 模板变量替换为实际值
 *
 * Mock 策略:构建一个最小化的 chainable supabase client mock,
 * 支持按表返回可配置的查询结果,并记录 insert/delete/update 操作。
 */

// ---------------------------------------------------------------------------
// Mock 类型与构造器
// ---------------------------------------------------------------------------

interface MockConfig {
  /** select 查询返回的数据(按表) */
  selectResults?: Record<string, unknown[] | null>;
  /** .maybeSingle()/.single() 返回的单行(按表) */
  singleResults?: Record<string, unknown | null>;
  /** insert().select().single() 返回的行(按表) */
  insertResults?: Record<string, unknown | null>;
  /** update().select().single() 返回的行(按表) */
  updateResults?: Record<string, unknown | null>;
  /** head count 查询返回的 count(按表) */
  countResults?: Record<string, number>;
}

interface RecordedOperation {
  table: string;
  payload?: unknown;
  filters: Array<[string, ...unknown[]]>;
}

interface MockClient {
  from: (table: string) => MockChain;
  _operations: {
    inserts: RecordedOperation[];
    deletes: RecordedOperation[];
    updates: RecordedOperation[];
  };
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

function createMockClient(config: MockConfig): MockClient {
  const operations = {
    inserts: [] as RecordedOperation[],
    deletes: [] as RecordedOperation[],
    updates: [] as RecordedOperation[],
  };

  const createChain = (table: string): MockChain => {
    const filters: Array<[string, ...unknown[]]> = [];
    let operation: "select" | "insert" | "update" | "delete" = "select";
    let payload: unknown = null;
    let selectOpts: { count?: string; head?: boolean } | null = null;

    const chain: MockChain = {
      select: (cols, opts) => {
        selectOpts = opts ?? null;
        return chain;
      },
      insert: (p) => {
        operation = "insert";
        payload = p;
        return chain;
      },
      update: (p) => {
        operation = "update";
        payload = p;
        return chain;
      },
      delete: () => {
        operation = "delete";
        return chain;
      },
      eq: (col, val) => {
        filters.push(["eq", col, val]);
        return chain;
      },
      neq: (col, val) => {
        filters.push(["neq", col, val]);
        return chain;
      },
      in: (col, vals) => {
        filters.push(["in", col, vals]);
        return chain;
      },
      or: (expr) => {
        filters.push(["or", expr]);
        return chain;
      },
      gte: (col, val) => {
        filters.push(["gte", col, val]);
        return chain;
      },
      lt: (col, val) => {
        filters.push(["lt", col, val]);
        return chain;
      },
      contains: (col, val) => {
        filters.push(["contains", col, val]);
        return chain;
      },
      is: (col, val) => {
        filters.push(["is", col, val]);
        return chain;
      },
      not: (col, val) => {
        filters.push(["not", col, val]);
        return chain;
      },
      order: () => chain,
      range: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve(resolveResult(true)),
      single: () => Promise.resolve(resolveResult(true)),
      then: (onFulfilled, onRejected) =>
        Promise.resolve(resolveResult(false)).then(onFulfilled, onRejected),
    };

    function resolveResult(
      isSingle: boolean,
    ): { data: unknown; error: null; count?: number } {
      if (operation === "insert") {
        operations.inserts.push({ table, payload, filters: [...filters] });
        return { data: config.insertResults?.[table] ?? null, error: null };
      }
      if (operation === "delete") {
        operations.deletes.push({ table, filters: [...filters] });
        return { data: null, error: null };
      }
      if (operation === "update") {
        operations.updates.push({ table, payload, filters: [...filters] });
        return { data: config.updateResults?.[table] ?? null, error: null };
      }
      if (isSingle) {
        const single = config.singleResults?.[table];
        if (single !== null && single !== undefined) {
          return { data: single, error: null };
        }
        // singleResults 未配置或为 null 时,回退到 selectResults 首行
        // (模拟 .limit(1).maybeSingle() 从数组取首行的行为)
        const selectArr = config.selectResults?.[table];
        if (Array.isArray(selectArr) && selectArr.length > 0) {
          return { data: selectArr[0], error: null };
        }
        return { data: null, error: null };
      }
      if (selectOpts?.head) {
        return {
          data: null,
          error: null,
          count: config.countResults?.[table] ?? 0,
        };
      }
      return { data: config.selectResults?.[table] ?? null, error: null };
    }

    return chain;
  };

  return {
    from: (table: string) => createChain(table),
    _operations: operations,
  };
}

const USER_ID = "user-123";
const NOTE_ID = "note-123";
// 与 notesService.getLocalDateString 对齐:使用本地时区(Asia/Shanghai)日期,
// 而非 toISOString() 返回的 UTC 日期,避免 UTC 与本地日期跨日时不一致。
const TODAY = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
})();

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe("NotesService", () => {
  describe("renderTemplate", () => {
    it("应将所有聚合变量替换为实际值", () => {
      const template =
        "# {{date}} 学习日志\n\n## 今日数据\n- 复习卡片: {{today_reviewed_cards}}\n- 完成任务: {{today_completed_tasks}}\n- 专注时长: {{today_focus_time}}\n";
      const aggregation = {
        reviewedCards: 12,
        completedTasks: 5,
        focusTimeMinutes: 90,
      };

      const { title, content } = notesService.renderTemplate(
        template,
        "2026-07-03",
        aggregation,
      );

      expect(title).toBe("2026-07-03 学习日志");
      expect(content).toContain("复习卡片: 12");
      expect(content).toContain("完成任务: 5");
      expect(content).toContain("专注时长: 90");
      expect(content).not.toContain("{{");
    });

    it("模板无 H1 时应回退到默认标题", () => {
      const { title } = notesService.renderTemplate(
        "今日复习: {{today_reviewed_cards}}",
        "2026-07-03",
        { reviewedCards: 1, completedTasks: 0, focusTimeMinutes: 0 },
      );
      expect(title).toBe("2026-07-03 学习日志");
    });

    it("重复出现的变量应全部替换", () => {
      const template = "{{date}} - {{today_reviewed_cards}} cards, again {{today_reviewed_cards}}";
      const { content } = notesService.renderTemplate(template, "2026-07-03", {
        reviewedCards: 7,
        completedTasks: 0,
        focusTimeMinutes: 0,
      });
      expect(content).toBe("2026-07-03 - 7 cards, again 7");
    });
  });

  describe("syncNodeLinks", () => {
    it("新增 [[节点名]] 时应创建对应的 note_node_links", async () => {
      // 配置 mock:存在名为 "NodeA" 的知识点 + 对应 graph_node,且当前无挂载关系
      const mock = createMockClient({
        selectResults: {
          knowledge_points: [
            { id: "kp-1", title: "NodeA" },
          ],
          graph_nodes: [
            {
              id: "gn-1",
              knowledge_point_id: "kp-1",
              graph_id: "graph-1",
              graph: { deleted_at: null },
            },
          ],
          note_node_links: [],
        },
      });

      await notesService.syncNodeLinks(
        mock as unknown as never,
        USER_ID,
        NOTE_ID,
        "今日学习了 [[NodeA]] 的内容",
      );

      // 应插入一条挂载关系
      expect(mock._operations.inserts).toHaveLength(1);
      const insert = mock._operations.inserts[0];
      expect(insert.table).toBe("note_node_links");
      const payload = insert.payload as Array<{
        note_id: string;
        node_id: string;
        graph_id: string;
      }>;
      expect(payload).toHaveLength(1);
      expect(payload[0]).toEqual({
        note_id: NOTE_ID,
        node_id: "gn-1",
        graph_id: "graph-1",
      });

      // 不应删除任何挂载关系
      expect(mock._operations.deletes).toHaveLength(0);
    });

    it("移除 [[节点名]] 时应删除对应的 note_node_links", async () => {
      // 配置 mock:笔记不再包含任何 wiki 链接,但已有挂载关系 gn-1
      const mock = createMockClient({
        selectResults: {
          note_node_links: [{ id: "link-1", node_id: "gn-1" }],
        },
      });

      await notesService.syncNodeLinks(
        mock as unknown as never,
        USER_ID,
        NOTE_ID,
        "这是一段没有 wiki 链接的纯文本",
      );

      // 应删除一条挂载关系
      expect(mock._operations.deletes).toHaveLength(1);
      const del = mock._operations.deletes[0];
      expect(del.table).toBe("note_node_links");

      // 不应插入任何挂载关系
      expect(mock._operations.inserts).toHaveLength(0);
    });

    it("节点名未变化时应保持挂载关系不变(无增删)", async () => {
      // 配置 mock:笔记仍含 [[NodeA]],且挂载关系已存在
      const mock = createMockClient({
        selectResults: {
          knowledge_points: [{ id: "kp-1", title: "NodeA" }],
          graph_nodes: [
            {
              id: "gn-1",
              knowledge_point_id: "kp-1",
              graph_id: "graph-1",
              graph: { deleted_at: null },
            },
          ],
          note_node_links: [{ id: "link-1", node_id: "gn-1" }],
        },
      });

      await notesService.syncNodeLinks(
        mock as unknown as never,
        USER_ID,
        NOTE_ID,
        "今日复习 [[NodeA]]",
      );

      // 既不插入也不删除(已是期望状态)
      expect(mock._operations.inserts).toHaveLength(0);
      expect(mock._operations.deletes).toHaveLength(0);
    });

    it("图谱已软删除时不应创建挂载关系", async () => {
      const mock = createMockClient({
        selectResults: {
          knowledge_points: [{ id: "kp-1", title: "NodeA" }],
          graph_nodes: [
            {
              id: "gn-1",
              knowledge_point_id: "kp-1",
              graph_id: "graph-1",
              graph: { deleted_at: "2026-01-01T00:00:00Z" }, // 图谱已软删除
            },
          ],
          note_node_links: [],
        },
      });

      await notesService.syncNodeLinks(
        mock as unknown as never,
        USER_ID,
        NOTE_ID,
        "[[NodeA]]",
      );

      expect(mock._operations.inserts).toHaveLength(0);
    });
  });

  describe("getOrCreateTodayDaily", () => {
    it("今日 daily 已存在时应返回已有(不重复创建)", async () => {
      const existingNote = {
        id: "existing-note-1",
        user_id: USER_ID,
        title: `${TODAY} 学习日志`,
        content: "# 已有内容",
        type: "daily",
        date: TODAY,
        template_id: null,
        tags: [],
        is_pinned: false,
        is_archived: false,
        created_at: "2026-07-03T00:00:00Z",
        updated_at: "2026-07-03T00:00:00Z",
        deleted_at: null,
      };

      const mock = createMockClient({
        singleResults: { notes: existingNote },
      });

      const result = await notesService.getOrCreateTodayDaily(
        mock as unknown as never,
        USER_ID,
      );

      expect(result.created).toBe(false);
      expect(result.note.id).toBe("existing-note-1");
      expect(result.note.title).toBe(`${TODAY} 学习日志`);
      // 不应执行任何插入
      expect(mock._operations.inserts).toHaveLength(0);
    });

    it("今日 daily 不存在时应使用系统模板创建(聚合数据写入静态快照)", async () => {
      // 无已有 daily,无用户默认模板,有系统模板
      const systemTemplate = {
        id: "tpl-sys-1",
        user_id: null,
        name: "系统默认 - 三段式学习日志",
        content:
          "# {{date}} 学习日志\n\n## 今日数据\n- 复习卡片: {{today_reviewed_cards}}\n- 完成任务: {{today_completed_tasks}}\n- 专注时长: {{today_focus_time}}\n",
        is_default: false,
        is_system: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const createdNote = {
        id: "new-note-1",
        user_id: USER_ID,
        title: `${TODAY} 学习日志`,
        content: `# ${TODAY} 学习日志\n\n## 今日数据\n- 复习卡片: 12\n- 完成任务: 5\n- 专注时长: 90\n`,
        type: "daily",
        date: TODAY,
        template_id: "tpl-sys-1",
        tags: [],
        is_pinned: false,
        is_archived: false,
        created_at: "2026-07-03T08:00:00Z",
        updated_at: "2026-07-03T08:00:00Z",
        deleted_at: null,
      };

      const mock = createMockClient({
        // notes 查询(可能返回 maybeSingle 结果):null 表示无已有 daily
        singleResults: {
          notes: null, // 第一次查 notes(无已有)
          note_templates: null, // 用户默认模板查询返回 null
        },
        selectResults: {
          note_templates: [systemTemplate], // 系统模板查询(limit 1 但返回数组)
          focus_sessions: [{ duration: 5400 }], // 90 分钟
        },
        countResults: {
          study_cards: 12,
          task_executions: 5,
        },
        insertResults: {
          notes: createdNote,
        },
      });

      const result = await notesService.getOrCreateTodayDaily(
        mock as unknown as never,
        USER_ID,
      );

      expect(result.created).toBe(true);
      expect(result.note.id).toBe("new-note-1");
      expect(result.note.title).toBe(`${TODAY} 学习日志`);
      // 验证聚合数据作为静态快照写入正文
      expect(result.note.content).toContain("复习卡片: 12");
      expect(result.note.content).toContain("完成任务: 5");
      expect(result.note.content).toContain("专注时长: 90");

      // 验证插入了 notes 记录
      expect(mock._operations.inserts).toHaveLength(1);
      const insertOp = mock._operations.inserts[0];
      expect(insertOp.table).toBe("notes");
      const insertedRow = insertOp.payload as Record<string, unknown>;
      expect(insertedRow.type).toBe("daily");
      expect(insertedRow.date).toBe(TODAY);
      expect(insertedRow.template_id).toBe("tpl-sys-1");
    });

    it("无用户默认模板且无系统模板时应使用兜底模板", async () => {
      // 极端场景:数据库未 seed 系统模板,应使用硬编码兜底
      const mock = createMockClient({
        singleResults: {
          notes: null,
          note_templates: null,
        },
        selectResults: {
          note_templates: [],
          focus_sessions: [],
        },
        countResults: {
          study_cards: 0,
          task_executions: 0,
        },
        insertResults: {
          notes: {
            id: "fallback-note",
            user_id: USER_ID,
            title: `${TODAY} 学习日志`,
            content: `# ${TODAY} 学习日志\n\n## 今日数据\n- 复习卡片: 0\n- 完成任务: 0\n- 专注时长: 0\n\n## 今日学习\n\n## 今日复习\n\n## 今日反思\n`,
            type: "daily",
            date: TODAY,
            template_id: null,
            tags: [],
            is_pinned: false,
            is_archived: false,
            created_at: "2026-07-03T08:00:00Z",
            updated_at: "2026-07-03T08:00:00Z",
            deleted_at: null,
          },
        },
      });

      const result = await notesService.getOrCreateTodayDaily(
        mock as unknown as never,
        USER_ID,
      );

      expect(result.created).toBe(true);
      expect(result.note.title).toBe(`${TODAY} 学习日志`);
      // 兜底模板的三段式应存在
      expect(result.note.content).toContain("今日数据");
      expect(result.note.content).toContain("今日学习");
      expect(result.note.content).toContain("今日复习");
      expect(result.note.content).toContain("今日反思");
    });
  });

  describe("list", () => {
    it("应排除已软删除的笔记并按 is_pinned/updated_at 排序", async () => {
      const noteRows = [
        {
          id: "n1",
          user_id: USER_ID,
          title: "置顶笔记",
          content: "",
          type: "note",
          date: null,
          template_id: null,
          tags: [],
          is_pinned: true,
          is_archived: false,
          created_at: "2026-07-01T00:00:00Z",
          updated_at: "2026-07-02T00:00:00Z",
          deleted_at: null,
        },
        {
          id: "n2",
          user_id: USER_ID,
          title: "普通笔记",
          content: "",
          type: "note",
          date: null,
          template_id: null,
          tags: [],
          is_pinned: false,
          is_archived: false,
          created_at: "2026-07-02T00:00:00Z",
          updated_at: "2026-07-03T00:00:00Z",
          deleted_at: null,
        },
      ];

      const mock = createMockClient({
        countResults: { notes: 2 },
        selectResults: { notes: noteRows },
      });

      const result = await notesService.list(
        mock as unknown as never,
        USER_ID,
        { page: 1, pageSize: 20 },
      );

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items).toHaveLength(2);
      // 第一项应为置顶笔记
      expect(result.items[0].isPinned).toBe(true);
      // 字段映射正确(camelCase)
      expect(result.items[0].userId).toBe(USER_ID);
      expect(result.items[0].templateId).toBeNull();
    });
  });

  // ============================================================
  // P1 Task 4: 模板 CRUD 测试
  // ============================================================

  describe("createTemplate", () => {
    it("应创建自定义模板(is_system=false, user_id=当前用户)", async () => {
      const insertedTemplate = {
        id: "tpl-1",
        user_id: USER_ID,
        name: "我的模板",
        content: "# {{date}} 笔记",
        is_default: false,
        is_system: false,
        created_at: "2026-07-03T00:00:00Z",
        updated_at: "2026-07-03T00:00:00Z",
      };

      const mock = createMockClient({
        insertResults: { note_templates: insertedTemplate },
      });

      const result = await notesService.createTemplate(
        mock as unknown as never,
        USER_ID,
        { name: "我的模板", content: "# {{date}} 笔记" },
      );

      expect(result.id).toBe("tpl-1");
      expect(result.userId).toBe(USER_ID);
      expect(result.isSystem).toBe(false);
      expect(result.isDefault).toBe(false);
      expect(result.name).toBe("我的模板");

      // 验证插入 payload
      expect(mock._operations.inserts).toHaveLength(1);
      const insert = mock._operations.inserts[0];
      expect(insert.table).toBe("note_templates");
      const payload = insert.payload as Record<string, unknown>;
      expect(payload.user_id).toBe(USER_ID);
      expect(payload.is_system).toBe(false);
      expect(payload.is_default).toBe(false);
      expect(payload.name).toBe("我的模板");
    });
  });

  describe("updateTemplate", () => {
    it("应更新自定义模板并返回更新后的模板", async () => {
      const existingTemplate = {
        id: "tpl-1",
        user_id: USER_ID,
        name: "旧名称",
        content: "旧内容",
        is_default: false,
        is_system: false,
        created_at: "2026-07-03T00:00:00Z",
        updated_at: "2026-07-03T00:00:00Z",
      };

      const updatedTemplate = {
        ...existingTemplate,
        name: "新名称",
        content: "新内容",
        updated_at: "2026-07-03T01:00:00Z",
      };

      const mock = createMockClient({
        singleResults: { note_templates: existingTemplate },
        updateResults: { note_templates: updatedTemplate },
      });

      const result = await notesService.updateTemplate(
        mock as unknown as never,
        USER_ID,
        "tpl-1",
        { name: "新名称", content: "新内容" },
      );

      expect(result.name).toBe("新名称");
      expect(result.content).toBe("新内容");

      // 验证 update 操作被调用,且 payload 包含更新字段
      expect(mock._operations.updates).toHaveLength(1);
      const update = mock._operations.updates[0];
      expect(update.table).toBe("note_templates");
      const payload = update.payload as Record<string, unknown>;
      expect(payload.name).toBe("新名称");
      expect(payload.content).toBe("新内容");
    });

    it("is_system=true 模板应抛出 CANNOT_MODIFY_SYSTEM_TEMPLATE (403)", async () => {
      const systemTemplate = {
        id: "tpl-sys",
        user_id: null,
        name: "系统默认模板",
        content: "# 系统模板",
        is_default: false,
        is_system: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const mock = createMockClient({
        singleResults: { note_templates: systemTemplate },
      });

      await expect(
        notesService.updateTemplate(
          mock as unknown as never,
          USER_ID,
          "tpl-sys",
          { name: "尝试修改系统模板" },
        ),
      ).rejects.toMatchObject({
        code: "CANNOT_MODIFY_SYSTEM_TEMPLATE",
        statusCode: 403,
      });

      // 不应执行任何 update 操作
      expect(mock._operations.updates).toHaveLength(0);
    });
  });

  describe("deleteTemplate", () => {
    it("应删除自定义模板", async () => {
      const existingTemplate = {
        id: "tpl-1",
        user_id: USER_ID,
        name: "我的模板",
        content: "内容",
        is_default: false,
        is_system: false,
        created_at: "2026-07-03T00:00:00Z",
        updated_at: "2026-07-03T00:00:00Z",
      };

      const mock = createMockClient({
        singleResults: { note_templates: existingTemplate },
      });

      await notesService.deleteTemplate(
        mock as unknown as never,
        USER_ID,
        "tpl-1",
      );

      // 验证 delete 操作被调用
      expect(mock._operations.deletes).toHaveLength(1);
      const del = mock._operations.deletes[0];
      expect(del.table).toBe("note_templates");
    });

    it("is_system=true 模板应抛出 CANNOT_MODIFY_SYSTEM_TEMPLATE (403)", async () => {
      const systemTemplate = {
        id: "tpl-sys",
        user_id: null,
        name: "系统默认模板",
        content: "# 系统模板",
        is_default: false,
        is_system: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const mock = createMockClient({
        singleResults: { note_templates: systemTemplate },
      });

      await expect(
        notesService.deleteTemplate(
          mock as unknown as never,
          USER_ID,
          "tpl-sys",
        ),
      ).rejects.toMatchObject({
        code: "CANNOT_MODIFY_SYSTEM_TEMPLATE",
        statusCode: 403,
      });

      // 不应执行任何 delete 操作
      expect(mock._operations.deletes).toHaveLength(0);
    });
  });

  describe("setDefaultTemplate", () => {
    it("设默认时应先取消同用户其他默认,再设置当前为默认", async () => {
      const existingTemplate = {
        id: "tpl-2",
        user_id: USER_ID,
        name: "模板 B",
        content: "内容",
        is_default: false, // 当前不是默认
        is_system: false,
        created_at: "2026-07-03T00:00:00Z",
        updated_at: "2026-07-03T00:00:00Z",
      };

      const updatedTemplate = {
        ...existingTemplate,
        is_default: true,
        updated_at: "2026-07-03T01:00:00Z",
      };

      const mock = createMockClient({
        singleResults: { note_templates: existingTemplate },
        updateResults: { note_templates: updatedTemplate },
      });

      const result = await notesService.setDefaultTemplate(
        mock as unknown as never,
        USER_ID,
        "tpl-2",
      );

      expect(result.isDefault).toBe(true);

      // 应有两次 update 操作:
      // 1. 取消其他默认:update({is_default: false}).eq('user_id', userId).neq('id', id)
      // 2. 设置当前默认:update({is_default: true}).eq('id', id)
      expect(mock._operations.updates).toHaveLength(2);

      const clearUpdate = mock._operations.updates[0];
      expect(clearUpdate.table).toBe("note_templates");
      const clearPayload = clearUpdate.payload as Record<string, unknown>;
      expect(clearPayload.is_default).toBe(false);
      // 应有 user_id 过滤 + neq id 过滤
      const hasUserIdFilter = clearUpdate.filters.some(
        ([op, col]) => op === "eq" && col === "user_id",
      );
      const hasNeqIdFilter = clearUpdate.filters.some(
        ([op, col]) => op === "neq" && col === "id",
      );
      expect(hasUserIdFilter).toBe(true);
      expect(hasNeqIdFilter).toBe(true);

      const setUpdate = mock._operations.updates[1];
      expect(setUpdate.table).toBe("note_templates");
      const setPayload = setUpdate.payload as Record<string, unknown>;
      expect(setPayload.is_default).toBe(true);
    });

    it("is_system=true 模板应抛出 CANNOT_MODIFY_SYSTEM_TEMPLATE (403)", async () => {
      const systemTemplate = {
        id: "tpl-sys",
        user_id: null,
        name: "系统默认模板",
        content: "# 系统模板",
        is_default: false,
        is_system: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const mock = createMockClient({
        singleResults: { note_templates: systemTemplate },
      });

      await expect(
        notesService.setDefaultTemplate(
          mock as unknown as never,
          USER_ID,
          "tpl-sys",
        ),
      ).rejects.toMatchObject({
        code: "CANNOT_MODIFY_SYSTEM_TEMPLATE",
        statusCode: 403,
      });

      // 不应执行任何 update 操作
      expect(mock._operations.updates).toHaveLength(0);
    });
  });
});
