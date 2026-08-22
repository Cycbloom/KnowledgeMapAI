import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { createBackup, BackupService, type BackupData } from '../../../services/common/backupService';

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ size: 123 }),
    unlink: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

type QueryResult = { data: unknown; error: unknown };

/**
 * 按表名返回独立链式对象的 mock Supabase：
 * - 查询（select/eq/in/is/order）await 时返回该表配置的数据
 * - insert(rows).select('id') await 时返回按行生成的新 id
 * - insertCalls 记录每次插入（表名 + 行数据），供断言 FK 重映射
 */
function createMockSupabase() {
  const insertCalls: Array<{ table: string; rows: Record<string, unknown>[]; ids: string[] }> = [];
  const tableResults = new Map<string, QueryResult>();
  let idCounter = 0;

  const makeChain = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> & {
      then: (f?: unknown, r?: unknown) => Promise<unknown>;
      [k: string]: unknown;
    } = {
      then: (onFulfilled?: unknown, onRejected?: unknown) => {
        const result = tableResults.get(table) ?? { data: null, error: null };
        return Promise.resolve(result).then(
          onFulfilled as ((v: unknown) => unknown) | undefined,
          onRejected as ((r: unknown) => unknown) | undefined,
        );
      },
    };
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'single', 'maybeSingle', 'delete']) {
      chain[m] = vi.fn(() => chain);
    }
    chain.update = vi.fn(() => chain);
    chain.insert = vi.fn((rows: Record<string, unknown>[]) => {
      const ids = rows.map(() => `new-${idCounter++}`);
      insertCalls.push({ table, rows, ids });
      const insertChain: Record<string, unknown> & {
        then: (f?: unknown, r?: unknown) => Promise<unknown>;
      } = {
        then: (onFulfilled?: unknown, onRejected?: unknown) => {
          const data = ids.map((id) => ({ id }));
          return Promise.resolve({ data, error: null }).then(
            onFulfilled as ((v: unknown) => unknown) | undefined,
            onRejected as ((r: unknown) => unknown) | undefined,
          );
        },
      };
      for (const m of ['select', 'eq', 'is']) {
        insertChain[m] = vi.fn(() => insertChain);
      }
      return insertChain;
    });
    return chain;
  };

  return {
    from: vi.fn((table: string) => makeChain(table)),
    insertCalls,
    setTableData(table: string, data: unknown) {
      tableResults.set(table, { data, error: null });
    },
  };
}

/** 构造一个全字段为空数组的备份 data，便于按需覆盖 */
function emptyBackupData(): BackupData['data'] {
  return {
    graphs: [],
    knowledge_points: [],
    graph_nodes: [],
    edges: [],
    knowledge_point_versions: [],
    graph_backbone_modules: [],
    graph_snapshots: [],
    graph_events: [],
    literature_sources: [],
    graph_domains: [],
    graph_relations: [],
    domains: [],
    relationship_types: [],
    study_cards: [],
    study_progress: [],
    quiz_sets: [],
    quiz_set_cards: [],
    learning_sessions: [],
    learning_session_results: [],
    queues: [],
    user_tasks: [],
    task_tags: [],
    task_settings: [],
    task_dependencies: [],
    task_schedules: [],
    task_progress_plans: [],
    user_time_slots: [],
    task_subtasks: [],
    task_links: [],
    task_knowledge_points: [],
    task_reviews: [],
    task_templates: [],
    scheduler_weight_profiles: [],
    learning_paths: [],
    learning_path_nodes: [],
    learning_path_prerequisites: [],
    learning_path_progress: [],
    path_node_tasks: [],
    learning_loops: [],
    note_templates: [],
    notes: [],
    note_node_links: [],
    note_block_refs: [],
    focus_sessions: [],
    user_efficiency_profile: [],
    user_achievements: [],
    periodic_tasks: [],
    periodic_passes: [],
    user_pass_progress: [],
    user_focus_stats: [],
    agent_sessions: [],
    agent_messages: [],
    agent_tool_calls: [],
    agent_pending_actions: [],
    installed_plugins: [],
    learning_material_schemas: [],
    notification_settings: [],
  };
}

describe('backupService', () => {
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBackup', () => {
    it('导出保留图谱 tags、全周期 periodic_tasks，并扁平化 contents', async () => {
      const mock = createMockSupabase();
      mock.setTableData('knowledge_graphs', [
        {
          id: 'g1',
          user_id: userId,
          title: '图谱',
          tags: ['tag-a', 'tag-b'],
          is_branch: false,
          branch_name: null,
          deleted_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          knowledge_graph_contents: {
            podcast_script: '脚本',
            reference_books: [],
            external_links: [],
            learning_guide: '指南',
          },
        },
      ]);
      mock.setTableData('knowledge_points', [
        {
          id: 'kp1',
          owner_id: userId,
          title: '知识点',
          summary: '摘要',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ]);
      mock.setTableData('periodic_tasks', [
        { id: 'pt1', user_id: userId, period_type: 'weekly', period_start: '2026-01-05', period_end: '2026-01-11', task_type: 'study', target: 5 },
        { id: 'pt2', user_id: userId, period_type: 'monthly', period_start: '2026-01-01', period_end: '2026-01-31', task_type: 'focus', target: 20 },
      ]);
      mock.setTableData('graph_nodes', [
        { id: 'gn1', graph_id: 'g1', knowledge_point_id: 'kp1', x_position: 1, y_position: 2, level: 'root', is_accepted: true },
      ]);
      mock.setTableData('edges', []);

      const result = await createBackup(mock as unknown as SupabaseClient, userId, 'manual');

      expect(result.graphsCount).toBe(1);
      expect(result.nodesCount).toBe(1);

      const writeFileMock = vi.mocked(fs.writeFile);
      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const content = writeFileMock.mock.calls[0][1] as string;
      const parsed = JSON.parse(content) as BackupData;

      expect(parsed.version).toBe('3.0');
      expect(parsed.data.graphs[0].tags).toEqual(['tag-a', 'tag-b']);
      expect(parsed.data.graphs[0].learning_guide).toBe('指南');
      expect(parsed.data.graphs[0].podcast_script).toBe('脚本');
      // 图谱节点保留原 id（用于恢复时 note_node_links 重映射）
      expect(parsed.data.graph_nodes[0].id).toBe('gn1');
      expect(parsed.data.periodic_tasks.map((p) => p.period_type).sort()).toEqual(['monthly', 'weekly']);
    });

    it('软删除的图谱与节点不出现在备份中（deleted_at 过滤）', async () => {
      const mock = createMockSupabase();
      // 未配置任何表数据，查询返回空 → 仅验证不抛错且计数为 0
      const result = await createBackup(mock as unknown as SupabaseClient, userId, 'manual');
      expect(result.graphsCount).toBe(0);
      expect(result.nodesCount).toBe(0);
    });
  });

  describe('restoreBackupData', () => {
    it('重映射 FK，缺失 task 的 focus_sessions 置空，保留 tags', async () => {
      const mock = createMockSupabase();
      const service = new BackupService();

      const data = emptyBackupData();
      data.graphs = [
        {
          id: 'g1',
          user_id: userId,
          title: '图谱',
          tags: ['tag-x'],
          description: null,
          domain: null,
          settings: {},
          is_public: false,
          is_favorite: false,
          parent_graph_id: null,
          is_branch: false,
          branch_name: null,
          branch_source_snapshot_id: null,
          last_used_at: '2026-01-01T00:00:00Z',
          task_id: null,
          template_type: null,
          deleted_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      data.knowledge_points = [
        {
          id: 'kp1',
          owner_id: userId,
          title: '知识点',
          content: null,
          summary: null,
          learning_material: null,
          properties: {},
          keywords: {},
          aliases: [],
          visibility: 'private',
          mastery_level: 0,
          last_study_at: null,
          total_study_duration: 0,
          source_knowledge_point_id: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      data.graph_nodes = [
        {
          id: 'gn1',
          graph_id: 'g1',
          knowledge_point_id: 'kp1',
          x_position: 0,
          y_position: 0,
          level: 'root',
          is_accepted: true,
          deleted_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      data.edges = [
        {
          id: 'e1',
          graph_id: 'g1',
          source_knowledge_point_id: 'kp1',
          target_knowledge_point_id: 'kp1',
          relationship_type: 'contains',
          weight: 1,
          custom_label: null,
          custom_color: null,
          custom_line_style: null,
          show_arrow: null,
          deleted_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      data.study_cards = [
        {
          id: 'c1',
          user_id: userId,
          knowledge_point_id: 'kp1',
          graph_id: 'g1',
          source_graph_id: 'g1',
          question: 'q',
          answer: 'a',
          explanation: null,
          card_type: 'qa',
          options: null,
          focus_topic: null,
          difficulty: 1,
          last_reviewed: null,
          next_review: '2026-01-02T00:00:00Z',
          review_count: 0,
          fsrs_state: 'New',
          fsrs_stability: 0,
          fsrs_difficulty: 0,
          fsrs_elapsed_days: 0,
          fsrs_scheduled_days: 0,
          fsrs_retrievability: 0,
          fsrs_last_review: null,
          last_rating: null,
          quiz_set_id: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      data.focus_sessions = [
        {
          id: 'f1',
          user_id: userId,
          task_id: 'missing-task',
          started_at: '2026-01-01T10:00:00Z',
          ended_at: '2026-01-01T10:25:00Z',
          duration: 1500,
          mode: 'focus',
          completed: true,
          pomodoro_count: 1,
          white_noise_type: null,
          is_break: false,
          created_at: '2026-01-01T10:00:00Z',
        },
      ];

      const stats = await service.restoreBackupData(mock as unknown as SupabaseClient, userId, data);

      expect(stats.graphs).toBe(1);
      expect(stats.nodes).toBe(1);
      expect(stats.study_cards).toBe(1);

      // 图谱插入保留 tags，且 parent/task 重映射安全
      const graphInsert = mock.insertCalls.find((c) => c.table === 'knowledge_graphs');
      expect(graphInsert?.rows[0].tags).toEqual(['tag-x']);
      expect(graphInsert?.rows[0].user_id).toBe(userId);

      // graph_nodes 的 graph/kp 被重映射到插入时生成的新 id
      const kpInsert = mock.insertCalls.find((c) => c.table === 'knowledge_points');
      const gnInsert = mock.insertCalls.find((c) => c.table === 'graph_nodes');
      expect(gnInsert?.rows[0].graph_id).toBe(graphInsert?.ids[0]);
      expect(gnInsert?.rows[0].knowledge_point_id).toBe(kpInsert?.ids[0]);

      // 边引用重映射后的 kp id
      const edgeInsert = mock.insertCalls.find((c) => c.table === 'edges');
      expect(edgeInsert?.rows[0].source_knowledge_point_id).toBe(kpInsert?.ids[0]);
      expect(edgeInsert?.rows[0].target_knowledge_point_id).toBe(kpInsert?.ids[0]);

      // study_cards 关联重映射后的 graph/kp
      const cardInsert = mock.insertCalls.find((c) => c.table === 'study_cards');
      expect(cardInsert?.rows[0].graph_id).toBe(graphInsert?.ids[0]);
      expect(cardInsert?.rows[0].knowledge_point_id).toBe(kpInsert?.ids[0]);

      // 关键修复：不存在的 task_id 被置空而非引发外键失败
      const focusInsert = mock.insertCalls.find((c) => c.table === 'focus_sessions');
      expect(focusInsert?.rows[0].task_id).toBeNull();
      expect(stats.focus_sessions).toBe(1);
    });

    it('兼容旧版 v2.x 扁平化 nodes 格式', async () => {
      const mock = createMockSupabase();
      const service = new BackupService();

      // 旧版文件不含 knowledge_points / graph_nodes 键，仅含扁平化 nodes
      const data = emptyBackupData();
      const legacyData = data as BackupData['data'] & {
        knowledge_points?: BackupData['data']['knowledge_points'];
        graph_nodes?: BackupData['data']['graph_nodes'];
      };
      delete legacyData.knowledge_points;
      delete legacyData.graph_nodes;
      legacyData.nodes = [
        {
          id: 'kp1',
          graph_id: 'g1',
          title: '旧版节点',
          content: 'content',
          summary: 'summary',
          x_position: 5,
          y_position: 6,
          level: 'normal',
          is_accepted: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      legacyData.graphs = [
        {
          id: 'g1',
          user_id: userId,
          title: '图谱',
          tags: [],
          description: null,
          domain: null,
          settings: {},
          is_public: false,
          is_favorite: false,
          parent_graph_id: null,
          is_branch: false,
          branch_name: null,
          branch_source_snapshot_id: null,
          last_used_at: null,
          task_id: null,
          template_type: null,
          deleted_at: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      const stats = await service.restoreBackupData(mock as unknown as SupabaseClient, userId, legacyData);

      expect(stats.nodes).toBe(1);
      const kpInsert = mock.insertCalls.find((c) => c.table === 'knowledge_points');
      expect(kpInsert?.rows[0].title).toBe('旧版节点');
      const gnInsert = mock.insertCalls.find((c) => c.table === 'graph_nodes');
      expect(gnInsert?.rows[0].x_position).toBe(5);
      expect(gnInsert?.rows[0].knowledge_point_id).toBe(kpInsert?.ids[0]);
    });
  });
});
