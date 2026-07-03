import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * BlockRefService 单元测试 (P3 Task 3.3)
 *
 * 重点验证:
 * 1. syncBlockRefs: 新增/删除/混合引用的 diff 逻辑
 * 2. syncBlockRefs: 失败不抛错(模拟 supabase error,函数应 logger.warn 后正常返回)
 * 3. getBlockContent: 命中/未命中块/跨用户
 * 4. getInboundRefs: 返回正确 BlockRef[]
 * 5. getOutboundRefs: 返回正确 BlockRef[]
 * 6. notesService.update: SSE block_updated 推送触发
 *
 * Mock 策略:
 * - 用 vi.hoisted 提升 mock 定义避免 ReferenceError
 * - mock supabase 的 from().select().eq().or()... 链式调用
 * - mock sseService.sendToUser 捕获 SSE 推送调用
 */

// ---------------------------------------------------------------------------
// vi.hoisted: 提升 mock 数据与函数,避免 ReferenceError
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => {
  return {
    sseSendToUser: vi.fn(),
  };
});

// Mock sseService 以便后续 notesService 测试能验证 SSE 推送
vi.mock("../../../api/services/core/sseService", () => ({
  sseService: {
    sendToUser: hoisted.sseSendToUser,
    addClient: vi.fn(),
    removeClient: vi.fn(),
    startHeartbeat: vi.fn(),
    stopHeartbeat: vi.fn(),
  },
}));

// Mock embeddingOps 以避免 notesService 调用真实 AI
vi.mock("../../../api/services/ai/embeddingOps", () => ({
  embeddingOps: {
    generateEmbedding: vi.fn().mockResolvedValue(null),
  },
}));

import { blockRefService } from "../../services/notes/blockRefService";
import { notesService } from "../../services/notes/notesService";

// ---------------------------------------------------------------------------
// Mock 类型与构造器
// ---------------------------------------------------------------------------

interface TableConfig {
  /** select 查询返回的数据(默认 thenable 返回) */
  data?: unknown[] | null;
  /** maybeSingle() 返回的单行 */
  maybeSingleData?: unknown | null;
  /** single() 返回的单行 */
  singleData?: unknown | null;
  /** 是否返回 error */
  error?: unknown;
  /** head count 查询返回的 count */
  count?: number;
}

interface MockConfig {
  /** 按表配置返回数据 */
  tables?: Record<string, TableConfig>;
  /** 默认配置(未在 tables 中指定的表) */
  default?: TableConfig;
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
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
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

  const getTableConfig = (table: string): TableConfig => {
    return config.tables?.[table] ?? config.default ?? { data: [], error: null };
  };

  const createChain = (table: string): MockChain => {
    let selectOpts: { count?: string; head?: boolean } | null = null;
    const filters: Array<[string, ...unknown[]]> = [];

    const chain: MockChain = {
      select: (_cols, opts) => {
        selectOpts = opts ?? null;
        return chain;
      },
      insert: (payload) => {
        operations.inserts.push({ table, payload, filters: [...filters] });
        return chain;
      },
      update: (payload) => {
        operations.updates.push({ table, payload, filters: [...filters] });
        return chain;
      },
      delete: () => {
        operations.deletes.push({ table, filters: [...filters] });
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
      maybeSingle: () => {
        const tc = getTableConfig(table);
        return Promise.resolve({
          data: tc.maybeSingleData ?? null,
          error: tc.error ?? null,
        });
      },
      single: () => {
        const tc = getTableConfig(table);
        return Promise.resolve({
          data: tc.singleData ?? null,
          error: tc.error ?? null,
        });
      },
      then: (onFulfilled, onRejected) => {
        const tc = getTableConfig(table);
        let result: { data: unknown; error: unknown; count?: number };
        if (selectOpts?.head) {
          result = { data: null, error: tc.error ?? null, count: tc.count ?? 0 };
        } else {
          result = { data: tc.data ?? [], error: tc.error ?? null };
        }
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
    };

    return chain;
  };

  return { from: createChain, _operations: operations };
}

// ---------------------------------------------------------------------------
// 测试数据
// ---------------------------------------------------------------------------

const USER_ID = "user-123";
const SOURCE_NOTE_ID = "note-source-001";
const TARGET_NOTE_ID = "note-target-001";
const BLOCK_ID_A = "abcdefghij"; // 10 位 [a-z0-9]
const BLOCK_ID_B = "klmnopqrst";

// 目标笔记(含两个带 ^id 的块)
const targetNoteRow = {
  id: TARGET_NOTE_ID,
  user_id: USER_ID,
  title: "目标笔记",
  content: `这是块 A 的内容\n\n这是块 B 的内容^${BLOCK_ID_B}`,
  updated_at: "2026-07-03T00:00:00Z",
  deleted_at: null,
};

// 源笔记(含对 BLOCK_ID_B 的引用)
const sourceNoteRow = {
  id: SOURCE_NOTE_ID,
  user_id: USER_ID,
  title: "源笔记",
  content: `引用方块 B: ((${BLOCK_ID_B}))`,
  updated_at: "2026-07-03T01:00:00Z",
  deleted_at: null,
};

// ---------------------------------------------------------------------------
// syncBlockRefs 测试
// ---------------------------------------------------------------------------

describe("BlockRefService.syncBlockRefs (P3 Task 3.3)", () => {
  beforeEach(() => {
    hoisted.sseSendToUser.mockClear();
  });

  it("新增引用: content 含新 ((id)),数据库空 → INSERT 调用一次", async () => {
    const mockClient = createMockClient({
      tables: {
        // 用户笔记列表(含目标笔记,供反查 target_note_id)
        notes: {
          data: [targetNoteRow, sourceNoteRow],
        },
        // 现有 note_block_refs(空)
        note_block_refs: {
          data: [],
        },
      },
    });

    await blockRefService.syncBlockRefs(
      mockClient as unknown as never,
      USER_ID,
      SOURCE_NOTE_ID,
      `引用方块 B: ((${BLOCK_ID_B}))`,
    );

    // 应有 1 次 INSERT
    expect(mockClient._operations.inserts).toHaveLength(1);
    const insertOp = mockClient._operations.inserts[0];
    expect(insertOp.table).toBe("note_block_refs");
    const payload = insertOp.payload as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0].source_note_id).toBe(SOURCE_NOTE_ID);
    expect(payload[0].target_note_id).toBe(TARGET_NOTE_ID);
    expect(payload[0].target_block_id).toBe(BLOCK_ID_B);
    expect(payload[0].type).toBe("ref");

    // 不应有 DELETE
    expect(mockClient._operations.deletes).toHaveLength(0);
  });

  it("删除引用: content 不再含原 ((id)),数据库有记录 → DELETE 调用一次", async () => {
    const mockClient = createMockClient({
      tables: {
        // 用户笔记列表(目标笔记仍存在,但源笔记 content 已不含引用)
        notes: {
          data: [targetNoteRow, sourceNoteRow],
        },
        // 现有 note_block_refs(有一条引用 BLOCK_ID_B 的记录)
        note_block_refs: {
          data: [
            {
              id: "ref-001",
              source_note_id: SOURCE_NOTE_ID,
              source_block_id: "",
              target_note_id: TARGET_NOTE_ID,
              target_block_id: BLOCK_ID_B,
              type: "ref",
              created_at: "2026-07-03T00:00:00Z",
            },
          ],
        },
      },
    });

    // content 不含任何 ((id)) 引用
    await blockRefService.syncBlockRefs(
      mockClient as unknown as never,
      USER_ID,
      SOURCE_NOTE_ID,
      "这是不含引用的内容",
    );

    // 应有 1 次 DELETE
    expect(mockClient._operations.deletes).toHaveLength(1);
    const deleteOp = mockClient._operations.deletes[0];
    expect(deleteOp.table).toBe("note_block_refs");

    // 不应有 INSERT
    expect(mockClient._operations.inserts).toHaveLength(0);
  });

  it("混合场景: content 改变,有的新增有的删除", async () => {
    // 目标笔记含两个块:A 和 B
    const targetWithTwoBlocks = {
      ...targetNoteRow,
      content: `块 A 内容^${BLOCK_ID_A}\n\n块 B 内容^${BLOCK_ID_B}`,
    };

    const mockClient = createMockClient({
      tables: {
        notes: {
          data: [targetWithTwoBlocks, sourceNoteRow],
        },
        // 现有引用:引用了 BLOCK_ID_B(将被删除),不含 BLOCK_ID_A(将新增)
        note_block_refs: {
          data: [
            {
              id: "ref-old",
              source_note_id: SOURCE_NOTE_ID,
              source_block_id: "",
              target_note_id: TARGET_NOTE_ID,
              target_block_id: BLOCK_ID_B,
              type: "ref",
              created_at: "2026-07-03T00:00:00Z",
            },
          ],
        },
      },
    });

    // 新 content:引用 BLOCK_ID_A(新增),不再引用 BLOCK_ID_B(删除)
    await blockRefService.syncBlockRefs(
      mockClient as unknown as never,
      USER_ID,
      SOURCE_NOTE_ID,
      `引用方块 A: ((${BLOCK_ID_A}))`,
    );

    // 应有 1 次 DELETE(旧的 BLOCK_ID_B 引用)
    expect(mockClient._operations.deletes).toHaveLength(1);
    // 应有 1 次 INSERT(新的 BLOCK_ID_A 引用)
    expect(mockClient._operations.inserts).toHaveLength(1);
    const insertPayload = mockClient._operations.inserts[0]
      .payload as Array<Record<string, unknown>>;
    expect(insertPayload[0].target_block_id).toBe(BLOCK_ID_A);
  });

  it("失败不抛错: 模拟 supabase query error,函数应正常返回", async () => {
    const mockClient = createMockClient({
      tables: {
        notes: {
          data: null,
          error: { message: "DB connection failed", code: "P0001" },
        },
      },
    });

    // 不应抛错
    await expect(
      blockRefService.syncBlockRefs(
        mockClient as unknown as never,
        USER_ID,
        SOURCE_NOTE_ID,
        `((${BLOCK_ID_B}))`,
      ),
    ).resolves.toBeUndefined();
  });

  it("引用失效: target_block_id 找不到归属笔记 → 跳过 INSERT", async () => {
    const mockClient = createMockClient({
      tables: {
        // 用户笔记列表(目标笔记不含 BLOCK_ID_A)
        notes: {
          data: [
            {
              ...targetNoteRow,
              content: `只有块 B^${BLOCK_ID_B}`,
            },
          ],
        },
        note_block_refs: { data: [] },
      },
    });

    // content 引用了不存在的 BLOCK_ID_A
    await blockRefService.syncBlockRefs(
      mockClient as unknown as never,
      USER_ID,
      SOURCE_NOTE_ID,
      `((${BLOCK_ID_A}))`,
    );

    // 不应有 INSERT(引用失效)
    expect(mockClient._operations.inserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getBlockContent 测试
// ---------------------------------------------------------------------------

describe("BlockRefService.getBlockContent (P3 Task 3.3)", () => {
  it("命中: 笔记存在+块存在,返回 BlockContent(isStale=false)", async () => {
    const mockClient = createMockClient({
      tables: {
        notes: {
          maybeSingleData: {
            id: TARGET_NOTE_ID,
            title: "目标笔记",
            content: `块 B 的内容^${BLOCK_ID_B}`,
          },
        },
      },
    });

    const result = await blockRefService.getBlockContent(
      mockClient as unknown as never,
      USER_ID,
      TARGET_NOTE_ID,
      BLOCK_ID_B,
    );

    expect(result).not.toBeNull();
    expect(result?.noteId).toBe(TARGET_NOTE_ID);
    expect(result?.blockId).toBe(BLOCK_ID_B);
    expect(result?.noteTitle).toBe("目标笔记");
    expect(result?.isStale).toBe(false);
    expect(result?.content).toContain("块 B 的内容");
    expect(result?.content).toContain(`^${BLOCK_ID_B}`);
  });

  it("未命中块: 笔记存在但块不存在,返回 isStale=true", async () => {
    const mockClient = createMockClient({
      tables: {
        notes: {
          maybeSingleData: {
            id: TARGET_NOTE_ID,
            title: "目标笔记",
            content: "这个笔记没有带 ^id 的块",
          },
        },
      },
    });

    const result = await blockRefService.getBlockContent(
      mockClient as unknown as never,
      USER_ID,
      TARGET_NOTE_ID,
      BLOCK_ID_A,
    );

    expect(result).not.toBeNull();
    expect(result?.isStale).toBe(true);
    expect(result?.content).toBe("");
    expect(result?.noteId).toBe(TARGET_NOTE_ID);
  });

  it("跨用户被拒: 笔记属主非当前用户,返回 null", async () => {
    const mockClient = createMockClient({
      tables: {
        notes: {
          maybeSingleData: null, // RLS 拦截,查不到
        },
      },
    });

    const result = await blockRefService.getBlockContent(
      mockClient as unknown as never,
      "other-user",
      TARGET_NOTE_ID,
      BLOCK_ID_B,
    );

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getInboundRefs / getOutboundRefs 测试
// ---------------------------------------------------------------------------

describe("BlockRefService.getInboundRefs (P3 Task 3.3)", () => {
  it("返回正确 BlockRef[](含 source 笔记标题)", async () => {
    const mockClient = createMockClient({
      tables: {
        note_block_refs: {
          data: [
            {
              id: "ref-001",
              source_note_id: SOURCE_NOTE_ID,
              source_block_id: "srcblock01",
              target_note_id: TARGET_NOTE_ID,
              target_block_id: BLOCK_ID_B,
              type: "ref",
              created_at: "2026-07-03T00:00:00Z",
              source_note: {
                id: SOURCE_NOTE_ID,
                title: "源笔记标题",
                deleted_at: null,
              },
            },
          ],
        },
      },
    });

    const result = await blockRefService.getInboundRefs(
      mockClient as unknown as never,
      USER_ID,
      TARGET_NOTE_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ref-001");
    expect(result[0].sourceNoteId).toBe(SOURCE_NOTE_ID);
    expect(result[0].targetNoteId).toBe(TARGET_NOTE_ID);
    expect(result[0].targetBlockId).toBe(BLOCK_ID_B);
    expect(result[0].type).toBe("ref");
    expect(result[0].sourceNoteTitle).toBe("源笔记标题");
  });

  it("过滤已软删除的 source 笔记", async () => {
    const mockClient = createMockClient({
      tables: {
        note_block_refs: {
          data: [
            {
              id: "ref-001",
              source_note_id: SOURCE_NOTE_ID,
              source_block_id: "",
              target_note_id: TARGET_NOTE_ID,
              target_block_id: BLOCK_ID_B,
              type: "ref",
              created_at: "2026-07-03T00:00:00Z",
              source_note: {
                id: SOURCE_NOTE_ID,
                title: "已删除的源笔记",
                deleted_at: "2026-07-03T01:00:00Z",
              },
            },
          ],
        },
      },
    });

    const result = await blockRefService.getInboundRefs(
      mockClient as unknown as never,
      USER_ID,
      TARGET_NOTE_ID,
    );

    // 已软删除的 source 笔记应被过滤
    expect(result).toHaveLength(0);
  });
});

describe("BlockRefService.getOutboundRefs (P3 Task 3.3)", () => {
  it("返回正确 BlockRef[](含 target 笔记标题)", async () => {
    const mockClient = createMockClient({
      tables: {
        note_block_refs: {
          data: [
            {
              id: "ref-002",
              source_note_id: SOURCE_NOTE_ID,
              source_block_id: "srcblock02",
              target_note_id: TARGET_NOTE_ID,
              target_block_id: BLOCK_ID_B,
              type: "embed",
              created_at: "2026-07-03T02:00:00Z",
              target_note: {
                id: TARGET_NOTE_ID,
                title: "目标笔记标题",
                deleted_at: null,
              },
            },
          ],
        },
      },
    });

    const result = await blockRefService.getOutboundRefs(
      mockClient as unknown as never,
      USER_ID,
      SOURCE_NOTE_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ref-002");
    expect(result[0].sourceNoteId).toBe(SOURCE_NOTE_ID);
    expect(result[0].targetNoteId).toBe(TARGET_NOTE_ID);
    expect(result[0].targetBlockId).toBe(BLOCK_ID_B);
    expect(result[0].type).toBe("embed");
    expect(result[0].targetNoteTitle).toBe("目标笔记标题");
  });
});

// ---------------------------------------------------------------------------
// getBlocksForSearch 测试
// ---------------------------------------------------------------------------

describe("BlockRefService.getBlocksForSearch (P3 Task 3.3)", () => {
  it("返回块列表(按 updated_at 倒序)", async () => {
    const mockClient = createMockClient({
      tables: {
        notes: {
          data: [
            {
              id: "note-1",
              title: "笔记一",
              content: `块内容一^${BLOCK_ID_A}`,
              updated_at: "2026-07-03T01:00:00Z",
            },
            {
              id: "note-2",
              title: "笔记二",
              content: `块内容二^${BLOCK_ID_B}`,
              updated_at: "2026-07-03T02:00:00Z",
            },
          ],
        },
      },
    });

    const result = await blockRefService.getBlocksForSearch(
      mockClient as unknown as never,
      USER_ID,
      "",
      10,
    );

    expect(result).toHaveLength(2);
    // updated_at 倒序:note-2 在前
    expect(result[0].noteId).toBe("note-2");
    expect(result[1].noteId).toBe("note-1");
    expect(result[0].blockId).toBe(BLOCK_ID_B);
    expect(result[0].noteTitle).toBe("笔记二");
    expect(result[0].blockSummary).toContain("块内容二");
  });

  it("按 query 过滤块摘要", async () => {
    const mockClient = createMockClient({
      tables: {
        notes: {
          data: [
            {
              id: "note-1",
              title: "TypeScript 学习",
              content: `学习 TypeScript 泛型^${BLOCK_ID_A}`,
              updated_at: "2026-07-03T01:00:00Z",
            },
            {
              id: "note-2",
              title: "Python 笔记",
              content: `Python 列表推导式^${BLOCK_ID_B}`,
              updated_at: "2026-07-03T02:00:00Z",
            },
          ],
        },
      },
    });

    const result = await blockRefService.getBlocksForSearch(
      mockClient as unknown as never,
      USER_ID,
      "typescript",
      10,
    );

    // 只返回含 "typescript" 的块(大小写不敏感)
    expect(result).toHaveLength(1);
    expect(result[0].blockId).toBe(BLOCK_ID_A);
  });
});

// ---------------------------------------------------------------------------
// notesService.update SSE block_updated 推送测试 (P3 Task 5.3)
// ---------------------------------------------------------------------------

describe("NotesService.update SSE block_updated push (P3 Task 5.3)", () => {
  beforeEach(() => {
    hoisted.sseSendToUser.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("块内容变化时推送 block_updated", async () => {
    // 旧笔记(块内容 "旧内容")
    const oldNote = {
      id: SOURCE_NOTE_ID,
      user_id: USER_ID,
      title: "测试笔记",
      content: `旧内容^${BLOCK_ID_A}`,
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

    // 更新后笔记(块内容变为 "新内容")
    const updatedNote = {
      ...oldNote,
      content: `新内容^${BLOCK_ID_A}`,
      updated_at: "2026-07-03T01:00:00Z",
    };

    const mockClient = createMockClient({
      tables: {
        notes: {
          maybeSingleData: oldNote, // get() 返回旧笔记
          singleData: updatedNote, // update().select().single() 返回新笔记
        },
        knowledge_points: { data: [] },
        graph_nodes: { data: [] },
        note_node_links: { data: [] },
        note_block_refs: { data: [] },
        note_embeddings: { data: [] },
      },
    });

    await notesService.update(
      mockClient as unknown as never,
      USER_ID,
      SOURCE_NOTE_ID,
      { content: `新内容^${BLOCK_ID_A}` },
    );

    // sseService.sendToUser 应被调用(至少一次,推送 block_updated)
    expect(hoisted.sseSendToUser).toHaveBeenCalled();
    const calls = hoisted.sseSendToUser.mock.calls;
    const blockUpdatedCall = calls.find(
      (call: unknown[]) => {
        const payload = call[1] as { type?: string };
        return payload?.type === "block_updated";
      },
    );
    expect(blockUpdatedCall).toBeDefined();
    const payload = blockUpdatedCall?.[1] as {
      type: string;
      blockId: string;
      noteId: string;
      newContent: string;
    };
    expect(payload.blockId).toBe(BLOCK_ID_A);
    expect(payload.noteId).toBe(SOURCE_NOTE_ID);
    expect(payload.newContent).toContain("新内容");
  });

  it("块内容未变化时不推送 block_updated", async () => {
    const note = {
      id: SOURCE_NOTE_ID,
      user_id: USER_ID,
      title: "测试笔记",
      content: `不变的内容^${BLOCK_ID_A}`,
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

    const mockClient = createMockClient({
      tables: {
        notes: {
          maybeSingleData: note,
          singleData: note,
        },
        knowledge_points: { data: [] },
        graph_nodes: { data: [] },
        note_node_links: { data: [] },
        note_block_refs: { data: [] },
        note_embeddings: { data: [] },
      },
    });

    await notesService.update(
      mockClient as unknown as never,
      USER_ID,
      SOURCE_NOTE_ID,
      { content: `不变的内容^${BLOCK_ID_A}` },
    );

    // 不应有 block_updated 推送(内容未变)
    const calls = hoisted.sseSendToUser.mock.calls;
    const blockUpdatedCall = calls.find(
      (call: unknown[]) => {
        const payload = call[1] as { type?: string };
        return payload?.type === "block_updated";
      },
    );
    expect(blockUpdatedCall).toBeUndefined();
  });
});
