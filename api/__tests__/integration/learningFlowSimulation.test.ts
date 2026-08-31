/**
 * S5 学习调度全链路集成模拟
 *
 * 在本地 Supabase 上跑通：
 *   图谱创建 → startLearningForGraph(图谱大任务 + 自动生成学习路径 + 重排子任务)
 *   → completeLearning(读完材料推进状态机 + 建复习卡)
 *   → practice(练习会话推进状态机)
 *   → settleFocusSession(专注时长统一结算)
 *   → getNextStep(调度决策：复习打断 / 队列推进)
 *
 * 前置：本地 Supabase 已启动（npm run db:local:reset），.env.test.local 配置了
 * VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY。
 */
import { it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { http, passthrough } from 'msw';
import {
  describeIfDbAvailable,
  getAdminClient,
  cleanTable,
} from '../../../tests/helpers/testDb';
import { server } from '../../../tests/setup/mswServer';
import { graphLearningLauncherService } from '../../services/scheduler/graphLearningLauncherService';
import { learningFlowService } from '../../services/scheduler/learningFlowService';
import { subtaskQuizIntegrationService } from '../../services/scheduler/subtaskQuizIntegration';
import { timeSettlementService } from '../../services/scheduler/timeSettlementService';
import { schedulerDecisionService } from '../../services/scheduler/schedulerDecisionService';

// 让 local Supabase 请求穿透 MSW
const mswPassthroughLocalSupabase = () =>
  server.use(http.all('http://127.0.0.1:54321/*', () => passthrough()));

// mock AI 服务，避免真实 embedding/LLM 调用
vi.mock('../../services/ai/aiService', () => ({
  aiService: {
    generateEmbedding: vi.fn().mockResolvedValue(null),
  },
}));

const TEST_PASSWORD = 'test-password-123456';

describeIfDbAvailable('S5 学习调度全链路模拟', () => {
  let admin: SupabaseClient;
  let userId = '';
  let userEmail = '';

  // 测试数据
  let graphId = '';
  let kp1Id = '';
  let kp2Id = '';
  let card1Id = '';

  beforeAll(async () => {
    mswPassthroughLocalSupabase();
    admin = getAdminClient();

    // 1. 创建临时用户
    userEmail = `sim-${Date.now()}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email: userEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user?.id ?? '';
    if (!userId) throw new Error('Failed to create sim user');

    // 2. 建图谱 + 知识点 + 节点 + 边
    const { data: graph } = await admin
      .from('knowledge_graphs')
      .insert({ user_id: userId, title: '模拟学习图谱' })
      .select('id')
      .single();
    graphId = graph?.id ?? '';
    expect(graphId).toBeTruthy();

    const { data: kps } = await admin
      .from('knowledge_points')
      .insert([
        {
          owner_id: userId,
          title: { 'zh-CN': '知识点一' },
          content: { 'zh-CN': '第一个知识点的学习材料内容' },
          learning_material: { 'zh-CN': '知识点一的学习材料正文' },
        },
        {
          owner_id: userId,
          title: { 'zh-CN': '知识点二' },
          content: { 'zh-CN': '第二个知识点的学习材料内容' },
          learning_material: { 'zh-CN': '知识点二的学习材料正文' },
        },
      ])
      .select('id');
    kp1Id = kps?.[0]?.id ?? '';
    kp2Id = kps?.[1]?.id ?? '';
    expect(kp1Id).toBeTruthy();
    expect(kp2Id).toBeTruthy();

    await admin.from('graph_nodes').insert([
      { graph_id: graphId, knowledge_point_id: kp1Id, level: 'core' },
      { graph_id: graphId, knowledge_point_id: kp2Id, level: 'core' },
    ]);

    await admin.from('edges').insert({
      graph_id: graphId,
      source_knowledge_point_id: kp1Id,
      target_knowledge_point_id: kp2Id,
      relationship_type: 'prerequisite',
    });

    // 3. 预建一张练习题卡（避免 practice 触发 AI 生成）
    const { data: card } = await admin
      .from('study_cards')
      .insert({
        user_id: userId,
        knowledge_point_id: kp1Id,
        graph_id: graphId,
        question: '知识点一的练习题',
        answer: '参考答案',
        card_type: 'choice',
        difficulty: 1,
        fsrs_state: 'New',
        fsrs_stability: 0,
        fsrs_difficulty: 0,
        next_review: new Date().toISOString(),
      })
      .select('id')
      .single();
    card1Id = card?.id ?? '';
    expect(card1Id).toBeTruthy();
  });

  afterAll(async () => {
    mswPassthroughLocalSupabase();
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
    // 清理测试数据
    try {
      await cleanTable('knowledge_graphs');
      await cleanTable('knowledge_points');
      await cleanTable('study_cards');
    } catch {
      // cleanup best-effort
    }
  });

  it('图谱启动串联：大任务 + 学习路径 + 重排子任务', async () => {
    const result = await graphLearningLauncherService.startLearningForGraph(
      admin,
      userId,
      graphId,
      { daily_minutes: 30 },
    );

    // 图谱大任务存在
    expect(result.graphTaskId).toBeTruthy();
    const { data: graph } = await admin
      .from('knowledge_graphs')
      .select('task_id')
      .eq('id', graphId)
      .single();
    expect(graph?.task_id).toBe(result.graphTaskId);

    // 学习路径已生成
    expect(result.pathId).toBeTruthy();
    expect(result.pathReused).toBe(false);

    // 图谱大任务标题应为可读文案，而非未经翻译的 i18n key
    const { data: graphTaskRow } = await admin
      .from('user_tasks')
      .select('title, task_type')
      .eq('id', result.graphTaskId)
      .single();
    expect(graphTaskRow?.task_type).toBe('graph_learning');
    expect(graphTaskRow?.title).toBe('学习图谱: 模拟学习图谱');
    expect(graphTaskRow?.title).not.toContain('scheduler.');

    // 学习路径标题也应为可读文案
    const { data: pathRow } = await admin
      .from('learning_paths')
      .select('title')
      .eq('id', result.pathId)
      .single();
    expect(pathRow?.title).toBeTruthy();
    expect(String(pathRow?.title ?? '')).not.toContain('scheduler.');

    // 子任务已挂到大任务下且按路径排序
    expect(result.totalTasks).toBeGreaterThanOrEqual(2);
    expect(result.nextSubtask).toBeTruthy();

    // 图谱应只有【一个】graph_learning 任务（防止 graph_created 双订阅者重复建任务）
    const { count: graphTaskCount } = await admin
      .from('user_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('graph_id', graphId)
      .eq('task_type', 'graph_learning')
      .is('deleted_at', null);
    expect(graphTaskCount).toBe(1);

    const { data: subtasks } = await admin
      .from('task_subtasks')
      .select('id, task_id, knowledge_point_id, learning_path_node_id, position, title')
      .eq('task_id', result.graphTaskId)
      .order('position', { ascending: true });
    expect(subtasks?.length).toBeGreaterThanOrEqual(2);
    for (const st of subtasks ?? []) {
      expect(st.task_id).toBe(result.graphTaskId);
      expect(st.learning_path_node_id).toBeTruthy();
      expect(st.knowledge_point_id).toBeTruthy();
      // 子任务标题应为可读中文，而非 JSONB 本地化对象字面量 {"zh-CN": ...}
      expect(String(st.title)).not.toContain('{');
    }
  });

  it('学习完成推进状态机并创建首次复习卡', async () => {
    const result = await learningFlowService.completeLearning(admin, {
      knowledgePointId: kp1Id,
      userId,
      graphId,
    });

    // 推进到首个非 learning 阶段
    expect(['review', 'practice', 'quiz']).toContain(result.nextState);
    expect(result.nextActivity.type).toBeTruthy();

    // 首次复习卡已创建
    expect(result.reviewCardCreated).toBe(true);
    const { data: reviewCards } = await admin
      .from('study_cards')
      .select('id')
      .eq('user_id', userId)
      .eq('knowledge_point_id', kp1Id)
      .eq('card_type', 'qa');
    expect(reviewCards?.length).toBeGreaterThanOrEqual(1);
  });

  it('练习会话完成推进子任务状态', async () => {
    // 找到 kp1 的子任务
    const { data: subtasks } = await admin
      .from('task_subtasks')
      .select('id')
      .eq('knowledge_point_id', kp1Id)
      .limit(1);
    const subtaskId = subtasks?.[0]?.id;
    expect(subtaskId).toBeTruthy();

    // 开始练习会话（用预建的卡）
    const session = await subtaskQuizIntegrationService.startPracticeSession(
      admin,
      subtaskId as string,
      kp1Id,
    );
    expect(session.cards.length).toBeGreaterThanOrEqual(1);

    // 完成练习：答对一张卡
    const completion = await subtaskQuizIntegrationService.completePractice(
      admin,
      subtaskId as string,
      [
        {
          card_id: card1Id,
          correct: true,
          time_spent: 30,
        },
      ],
    );

    expect(completion.totalCount).toBe(1);
    expect(completion.correctCount).toBe(1);
    expect(completion.newState).toBeTruthy();
    expect(completion.masteryLevel).toBeGreaterThanOrEqual(0);
  });

  it('专注时长统一结算到任务/子任务/路径进度', async () => {
    // 找到图谱大任务
    const { data: graph } = await admin
      .from('knowledge_graphs')
      .select('task_id')
      .eq('id', graphId)
      .single();
    const graphTaskId = graph?.task_id;
    expect(graphTaskId).toBeTruthy();

    const result = await timeSettlementService.settleFocusSession(admin, userId, {
      taskId: graphTaskId as string,
      duration: 1500, // 25 分钟
    });

    expect(result.settledMinutes).toBe(25);
    expect(result.taskUpdated).toBe(true);

    // 子任务 actual_duration 累加
    const { data: subtask } = await admin
      .from('task_subtasks')
      .select('actual_duration')
      .eq('task_id', graphTaskId)
      .not('learning_path_node_id', 'is', null)
      .order('position', { ascending: true })
      .limit(1)
      .single();
    expect((subtask?.actual_duration as number) ?? 0).toBeGreaterThanOrEqual(25);

    // 路径进度 time_spent 累加
    const { data: pathProgress } = await admin
      .from('learning_path_progress')
      .select('time_spent')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    expect((pathProgress?.time_spent as number) ?? 0).toBeGreaterThanOrEqual(25);
  });

  it('调度决策返回队列推进（无到期复习时）', async () => {
    const decision = await schedulerDecisionService.getNextStep(admin, userId);

    // 初始无大量到期复习 → 应推进学习
    if (decision.type === 'progress') {
      expect(decision.progress?.taskId).toBeTruthy();
    } else {
      // 允许 empty（未标记到期）
      expect(['empty', 'progress']).toContain(decision.type);
    }
  });
});
