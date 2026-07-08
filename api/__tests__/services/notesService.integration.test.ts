import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { http, passthrough } from 'msw';
import {
  describeIfDbAvailable,
  getAdminClient,
  getAuthedClient,
  cleanTable,
} from '../../../tests/helpers/testDb';
import { server } from '../../../tests/setup/mswServer';

/**
 * MSW passthrough helper — lets requests to local Supabase reach the real
 * server instead of being intercepted. Must be re-added in beforeEach because
 * setupTests.ts calls server.resetHandlers() in afterEach.
 */
const mswPassthroughLocalSupabase = () =>
  server.use(http.all('http://127.0.0.1:54321/*', () => passthrough()));

// ---------------------------------------------------------------------------
// Mock AI dependencies — do not call real LLM/embedding during integration tests.
// Pattern mirrors notesWritingAssist.test.ts: vi.hoisted ensures the mock
// provider is initialised before vi.mock factory runs.
// ---------------------------------------------------------------------------

const { mockChatCompletionsCreate, mockProvider } = vi.hoisted(() => {
  const fnChatCompletionsCreate = vi.fn();
  const provider = {
    hasKey: true,
    model: 'test-model',
    providerType: 'openai' as const,
    client: {
      chat: {
        completions: {
          create: fnChatCompletionsCreate,
        },
      },
    },
  };
  return { mockChatCompletionsCreate: fnChatCompletionsCreate, mockProvider: provider };
});

vi.mock('../../services/ai/factory', () => ({
  getAIProviderForTask: vi.fn().mockResolvedValue(mockProvider),
}));

vi.mock('../../services/ai/promptService', () => ({
  promptService: {
    getRenderedPrompt: vi.fn().mockResolvedValue('rendered prompt'),
  },
}));

vi.mock('../../services/ai/performanceMonitor', () => ({
  performanceMonitor: {
    recordLog: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/ai/pricingService', () => ({
  pricingService: {
    calculateCost: vi.fn().mockReturnValue(0),
  },
}));

// embeddingOps returns null → refreshEmbedding skips UPSERT (no real embedding generated)
vi.mock('../../services/ai/embeddingOps', () => ({
  embeddingOps: {
    generateEmbedding: vi.fn().mockResolvedValue(null),
  },
}));

// getSupabaseAdmin is called by extractConcepts/writingAssist to pass to
// promptService.getRenderedPrompt; both are mocked so {} is safe.
vi.mock('../../supabase', () => ({
  getSupabaseAdmin: vi.fn().mockReturnValue({}),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// SSE push (block_updated / block_removed) is silenced — not under test.
vi.mock('../../services/core/sseService', () => ({
  sseService: {
    sendToUser: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Imports (must come after vi.mock)
// ---------------------------------------------------------------------------

import { notesService } from '../../services/notes/notesService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteDbRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: string;
  date: string | null;
  deleted_at: string | null;
  is_pinned: boolean;
  is_archived: boolean;
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'test123456';

/** Returns today's date as YYYY-MM-DD (local timezone, matches service's getLocalDateString). */
const getTodayDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describeIfDbAvailable('NotesService Integration', () => {
  let adminClient: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    // Let MSW pass through requests to local Supabase (server.listen was
    // started in setupTests.ts; resetHandlers in afterEach removes overrides).
    mswPassthroughLocalSupabase();

    adminClient = getAdminClient();

    // Sign in as the seeded test user to obtain its UUID.
    const userClient = await getAuthedClient(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    const { data: authData } = await userClient.auth.getUser();
    userId = authData.user?.id ?? '';
    if (!userId) throw new Error('Failed to get test user ID');
  });

  beforeEach(async () => {
    // Re-add passthrough (afterEach in setupTests.ts calls server.resetHandlers)
    mswPassthroughLocalSupabase();

    // Truncate notes — CASCADE handles child tables (note_node_links,
    // note_block_refs, note_embeddings). note_templates is NOT truncated so
    // the system default template survives for getOrCreateTodayDaily.
    await cleanTable('notes');

    // Reset AI mock call history between tests
    mockChatCompletionsCreate.mockReset();
  });

  // ===========================================================================
  // Notes CRUD
  // ===========================================================================

  describe('Notes CRUD', () => {
    it('should create a note and verify it exists in DB', async () => {
      const note = await notesService.create(adminClient, userId, {
        title: '测试笔记',
        content: '这是测试内容',
        type: 'note',
      });

      expect(note.id).toBeDefined();
      expect(note.title).toBe('测试笔记');
      expect(note.content).toBe('这是测试内容');
      expect(note.type).toBe('note');
      expect(note.userId).toBe(userId);
      expect(note.deletedAt).toBeNull();

      // Verify directly in DB
      const { data: dbNote, error } = await adminClient
        .from('notes')
        .select('*')
        .eq('id', note.id)
        .single();

      expect(error).toBeNull();
      expect(dbNote).not.toBeNull();
      const row = dbNote as unknown as NoteDbRow;
      expect(row.title).toBe('测试笔记');
      expect(row.content).toBe('这是测试内容');
      expect(row.user_id).toBe(userId);
      expect(row.deleted_at).toBeNull();
    });

    it('should get a note by ID', async () => {
      const created = await notesService.create(adminClient, userId, {
        title: '获取测试',
        content: '获取内容',
        type: 'note',
      });

      const fetched = await notesService.get(adminClient, userId, created.id);

      expect(fetched.id).toBe(created.id);
      expect(fetched.title).toBe('获取测试');
      expect(fetched.content).toBe('获取内容');
      expect(fetched.userId).toBe(userId);
    });

    it('should list notes for a user', async () => {
      await notesService.create(adminClient, userId, {
        title: '笔记A',
        content: '',
        type: 'note',
      });
      await notesService.create(adminClient, userId, {
        title: '笔记B',
        content: '',
        type: 'note',
      });
      await notesService.create(adminClient, userId, {
        title: '笔记C',
        content: '',
        type: 'note',
      });

      const result = await notesService.list(adminClient, userId, {});

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(3);

      const titles = result.items.map((n) => n.title).sort();
      expect(titles).toEqual(['笔记A', '笔记B', '笔记C']);
    });

    it('should update a note title and content', async () => {
      const created = await notesService.create(adminClient, userId, {
        title: '旧标题',
        content: '旧内容',
        type: 'note',
      });

      const updated = await notesService.update(adminClient, userId, created.id, {
        title: '新标题',
        content: '新内容',
      });

      expect(updated.title).toBe('新标题');
      expect(updated.content).toBe('新内容');

      // Verify in DB
      const { data: dbNote } = await adminClient
        .from('notes')
        .select('title, content')
        .eq('id', created.id)
        .single();

      const row = dbNote as unknown as { title: string; content: string };
      expect(row.title).toBe('新标题');
      expect(row.content).toBe('新内容');
    });

    it('should soft delete a note and exclude it from list', async () => {
      const created = await notesService.create(adminClient, userId, {
        title: '删除测试',
        content: '',
        type: 'note',
      });

      await notesService.delete(adminClient, userId, created.id);

      // Verify deleted_at is set in DB
      const { data: dbNote } = await adminClient
        .from('notes')
        .select('deleted_at')
        .eq('id', created.id)
        .single();

      const row = dbNote as unknown as { deleted_at: string | null };
      expect(row.deleted_at).not.toBeNull();

      // list (default includeDeleted=false) should not include the deleted note
      const result = await notesService.list(adminClient, userId, {});
      const ids = result.items.map((n) => n.id);
      expect(ids).not.toContain(created.id);
      expect(result.total).toBe(0);
    });
  });

  // ===========================================================================
  // Daily Notes — aggregation refresh
  // ===========================================================================

  describe('Daily Notes', () => {
    it('should refresh daily aggregation section with latest data', async () => {
      const today = getTodayDateStr();

      // Create a daily note with stale aggregation values (999)
      const created = await notesService.create(adminClient, userId, {
        title: `${today} 学习日志`,
        content:
          `# ${today} 学习日志\n\n` +
          '## 今日数据\n- 复习卡片: 999\n- 完成任务: 999\n- 专注时长: 999\n\n' +
          '## 今日学习\n',
        type: 'daily',
        date: today,
      });

      // Refresh — test user has no study_cards/task_executions/focus_sessions,
      // so aggregation should be all zeros.
      const result = await notesService.refreshDailyAggregation(
        adminClient,
        userId,
        created.id,
      );

      expect(result.refreshed).toBe(true);
      expect(result.note.content).toContain('复习卡片: 0');
      expect(result.note.content).toContain('完成任务: 0');
      expect(result.note.content).toContain('专注时长: 0');
      // Stale values must be replaced
      expect(result.note.content).not.toContain('999');

      // Verify in DB
      const { data: dbNote } = await adminClient
        .from('notes')
        .select('content')
        .eq('id', created.id)
        .single();

      const row = dbNote as unknown as { content: string };
      expect(row.content).toContain('复习卡片: 0');
      expect(row.content).not.toContain('999');
    });
  });

  // ===========================================================================
  // AI Features (mocked AI provider)
  // ===========================================================================

  describe('AI Features', () => {
    it('should extract concepts from note content (mocked AI)', async () => {
      const created = await notesService.create(adminClient, userId, {
        title: '概念提取测试',
        content: 'React 是一个用于构建用户界面的 JavaScript 库。组件化开发是其核心思想。',
        type: 'note',
      });

      // Mock AI returns JSON with two concepts
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                concepts: [
                  {
                    name: 'React',
                    description: '用于构建用户界面的 JavaScript 库',
                    related: ['组件化'],
                  },
                  {
                    name: '组件化开发',
                    description: '将 UI 拆分为独立可复用的组件',
                    related: ['React'],
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      const result = await notesService.extractConcepts(
        adminClient,
        userId,
        created.id,
      );

      expect(result.concepts).toHaveLength(2);
      expect(result.concepts[0].name).toBe('React');
      expect(result.concepts[0].description).toBe('用于构建用户界面的 JavaScript 库');
      expect(result.concepts[0].related).toContain('组件化');
      expect(result.concepts[1].name).toBe('组件化开发');
    });

    it('should generate writing-assist suggestion (mocked AI)', async () => {
      const created = await notesService.create(adminClient, userId, {
        title: '写作辅助测试',
        content: '这是一段需要续写的文本',
        type: 'note',
      });

      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI 续写的内容' } }],
        usage: { prompt_tokens: 50, completion_tokens: 30 },
      });

      const result = await notesService.writingAssist(adminClient, userId, {
        noteId: created.id,
        action: 'continue',
        selectedText: '这是一段需要续写的文本',
      });

      expect(result.suggestion).toBe('AI 续写的内容');
      // tokensUsed = inputTokens(50) + outputTokens(30) = 80
      expect(result.tokensUsed).toBe(80);
    });
  });
});
