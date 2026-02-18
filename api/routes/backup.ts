import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/export', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const [graphsResult, studyCardsResult, studyProgressResult, focusSessionsResult, userAchievementsResult, dailyTasksResult] = await Promise.all([
      req.supabase!.from('knowledge_graphs').select('*').eq('user_id', userId),
      req.supabase!.from('study_cards').select('*').eq('user_id', userId),
      req.supabase!.from('study_progress').select('*').eq('user_id', userId),
      req.supabase!.from('focus_sessions').select('*').eq('user_id', userId),
      req.supabase!.from('user_achievements').select('*').eq('user_id', userId),
      req.supabase!.from('daily_tasks').select('*').eq('user_id', userId),
    ]);

    const graphs = graphsResult.data || [];
    
    const graphIds = graphs.map((g: any) => g.id);
    
    let nodes: any[] = [];
    let edges: any[] = [];
    
    if (graphIds.length > 0) {
      const [nodesResult, edgesResult] = await Promise.all([
        req.supabase!.from('nodes').select('*').in('graph_id', graphIds),
        req.supabase!.from('edges').select('*').in('graph_id', graphIds),
      ]);
      nodes = nodesResult.data || [];
      edges = edgesResult.data || [];
    }

    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: {
        id: userId,
        email: req.user.email,
      },
      data: {
        graphs: graphs.map((g: any) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          settings: g.settings,
          is_public: g.is_public,
          created_at: g.created_at,
          updated_at: g.updated_at,
        })),
        nodes: nodes.map((n: any) => ({
          id: n.id,
          graph_id: n.graph_id,
          title: n.title,
          content: n.content,
          learning_material: n.learning_material,
          properties: n.properties,
          x_position: n.x_position,
          y_position: n.y_position,
          level: n.level,
          is_accepted: n.is_accepted,
          created_at: n.created_at,
          updated_at: n.updated_at,
        })),
        edges: edges.map((e: any) => ({
          id: e.id,
          graph_id: e.graph_id,
          source_node_id: e.source_node_id,
          target_node_id: e.target_node_id,
          relationship_type: e.relationship_type,
          weight: e.weight,
        })),
        study_cards: (studyCardsResult.data || []).map((c: any) => ({
          id: c.id,
          graph_id: c.graph_id,
          node_id: c.node_id,
          question: c.question,
          answer: c.answer,
          explanation: c.explanation,
          card_type: c.card_type,
          options: c.options,
          difficulty: c.difficulty,
          last_reviewed: c.last_reviewed,
          next_review: c.next_review,
          review_count: c.review_count,
          fsrs_state: c.fsrs_state,
          fsrs_stability: c.fsrs_stability,
          fsrs_difficulty: c.fsrs_difficulty,
          fsrs_elapsed_days: c.fsrs_elapsed_days,
          fsrs_scheduled_days: c.fsrs_scheduled_days,
          fsrs_retrievability: c.fsrs_retrievability,
          fsrs_last_review: c.fsrs_last_review,
          created_at: c.created_at,
        })),
        study_progress: studyProgressResult.data || [],
        focus_sessions: focusSessionsResult.data || [],
        user_achievements: userAchievementsResult.data || [],
        daily_tasks: dailyTasksResult.data || [],
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="knowledgemap-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(JSON.stringify(backupData, null, 2));

  } catch (error: any) {
    logger.error('Export backup error:', error);
    res.status(500).json({ error: error.message || '导出备份失败' });
  }
});

router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const backupData = req.body;

  if (!backupData || !backupData.data) {
    return res.status(400).json({ error: '无效的备份数据格式' });
  }

  const { data } = backupData;
  const stats = {
    graphs: 0,
    nodes: 0,
    edges: 0,
    study_cards: 0,
    study_progress: 0,
    focus_sessions: 0,
    user_achievements: 0,
    daily_tasks: 0,
  };

  try {
    const oldToNewGraphIds = new Map<string, string>();
    const oldToNewNodeIds = new Map<string, string>();

    if (data.graphs && data.graphs.length > 0) {
      const graphsToInsert = data.graphs.map((g: any) => ({
        user_id: userId,
        title: g.title,
        description: g.description,
        settings: g.settings || {},
        is_public: g.is_public || false,
      }));

      const { data: insertedGraphs, error: graphsError } = await req.supabase!
        .from('knowledge_graphs')
        .insert(graphsToInsert)
        .select();

      if (graphsError) throw new Error(`导入图谱失败: ${graphsError.message}`);
      
      insertedGraphs?.forEach((g: any, i: number) => {
        oldToNewGraphIds.set(data.graphs[i].id, g.id);
      });
      stats.graphs = insertedGraphs?.length || 0;
    }

    if (data.nodes && data.nodes.length > 0) {
      const nodesToInsert = data.nodes.map((n: any) => ({
        graph_id: oldToNewGraphIds.get(n.graph_id),
        title: n.title,
        content: n.content,
        learning_material: n.learning_material,
        properties: n.properties || {},
        x_position: n.x_position || 0,
        y_position: n.y_position || 0,
        level: n.level || 'normal',
        is_accepted: n.is_accepted !== false,
      })).filter((n: any) => n.graph_id);

      const { data: insertedNodes, error: nodesError } = await req.supabase!
        .from('nodes')
        .insert(nodesToInsert)
        .select();

      if (nodesError) throw new Error(`导入节点失败: ${nodesError.message}`);
      
      insertedNodes?.forEach((n: any, i: number) => {
        oldToNewNodeIds.set(data.nodes[i].id, n.id);
      });
      stats.nodes = insertedNodes?.length || 0;
    }

    if (data.edges && data.edges.length > 0) {
      const edgesToInsert = data.edges.map((e: any) => ({
        graph_id: oldToNewGraphIds.get(e.graph_id),
        source_node_id: oldToNewNodeIds.get(e.source_node_id),
        target_node_id: oldToNewNodeIds.get(e.target_node_id),
        relationship_type: e.relationship_type || 'related',
        weight: e.weight || 1,
      })).filter((e: any) => e.graph_id && e.source_node_id && e.target_node_id);

      if (edgesToInsert.length > 0) {
        const { error: edgesError } = await req.supabase!
          .from('edges')
          .insert(edgesToInsert);

        if (edgesError) logger.warn('导入边时部分失败:', edgesError.message);
        stats.edges = edgesToInsert.length;
      }
    }

    if (data.study_cards && data.study_cards.length > 0) {
      const cardsToInsert = data.study_cards.map((c: any) => ({
        user_id: userId,
        graph_id: oldToNewGraphIds.get(c.graph_id),
        node_id: oldToNewNodeIds.get(c.node_id),
        question: c.question,
        answer: c.answer,
        explanation: c.explanation,
        card_type: c.card_type || 'qa',
        options: c.options,
        difficulty: c.difficulty || 1,
        last_reviewed: c.last_reviewed,
        next_review: c.next_review,
        review_count: c.review_count || 0,
        fsrs_state: c.fsrs_state || 0,
        fsrs_stability: c.fsrs_stability || 0,
        fsrs_difficulty: c.fsrs_difficulty || 0,
        fsrs_elapsed_days: c.fsrs_elapsed_days || 0,
        fsrs_scheduled_days: c.fsrs_scheduled_days || 0,
        fsrs_retrievability: c.fsrs_retrievability || 0,
        fsrs_last_review: c.fsrs_last_review,
      })).filter((c: any) => c.graph_id);

      if (cardsToInsert.length > 0) {
        const { data: insertedCards, error: cardsError } = await req.supabase!
          .from('study_cards')
          .insert(cardsToInsert);

        if (cardsError) logger.warn('导入学习卡片时部分失败:', cardsError.message);
        stats.study_cards = cardsToInsert.length;
      }
    }

    if (data.study_progress && data.study_progress.length > 0) {
      const progressToInsert = data.study_progress.map((p: any) => ({
        user_id: userId,
        graph_id: oldToNewGraphIds.get(p.graph_id),
        total_nodes: p.total_nodes || 0,
        mastered_nodes: p.mastered_nodes || 0,
        progress_percentage: p.progress_percentage || 0,
        study_streak: p.study_streak || 0,
      })).filter((p: any) => p.graph_id);

      if (progressToInsert.length > 0) {
        const { error: progressError } = await req.supabase!
          .from('study_progress')
          .insert(progressToInsert);

        if (progressError) logger.warn('导入学习进度时部分失败:', progressError.message);
        stats.study_progress = progressToInsert.length;
      }
    }

    if (data.focus_sessions && data.focus_sessions.length > 0) {
      const sessionsToInsert = data.focus_sessions.map((s: any) => ({
        user_id: userId,
        start_time: s.start_time,
        end_time: s.end_time,
        duration: s.duration,
        mode: s.mode,
        completed: s.completed !== false,
      }));

      if (sessionsToInsert.length > 0) {
        const { error: sessionsError } = await req.supabase!
          .from('focus_sessions')
          .insert(sessionsToInsert);

        if (sessionsError) logger.warn('导入专注会话时部分失败:', sessionsError.message);
        stats.focus_sessions = sessionsToInsert.length;
      }
    }

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));

    res.json({
      success: true,
      message: '备份导入成功',
      stats,
    });

  } catch (error: any) {
    logger.error('Import backup error:', error);
    res.status(500).json({ error: error.message || '导入备份失败' });
  }
});

export default router;
