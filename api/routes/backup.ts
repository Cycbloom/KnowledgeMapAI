import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { logger } from '../utils/logger.js';
import { createBackup, deleteBackupFile, readBackupFile, cleanupOldSnapshots } from '../services/backupService.js';
import fs from 'fs/promises';

const router = Router();

router.get('/export', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const result = await createBackup(req.supabase!, userId, 'manual');
    
    await req.supabase!.from('backup_snapshots').insert({
      user_id: userId,
      type: 'manual',
      file_path: result.filePath,
      file_size: result.fileSize,
      graphs_count: result.graphsCount,
      nodes_count: result.nodesCount,
    });

    const content = await fs.readFile(result.filePath, 'utf-8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="knowledgemap-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(content);

  } catch (error: any) {
    logger.error('Export backup error:', error);
    res.status(500).json({ error: error.message || '导出备份失败' });
  }
});

router.get('/snapshots', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;

  try {
    const { data: snapshots } = await req.supabase!
      .from('backup_snapshots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    res.json({ snapshots: snapshots || [] });
  } catch (error: any) {
    logger.error('Get snapshots error:', error);
    res.status(500).json({ error: error.message || '获取快照列表失败' });
  }
});

router.post('/snapshots', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const { type = 'manual' } = req.body;

  try {
    const result = await createBackup(req.supabase!, userId, type);
    
    await req.supabase!.from('backup_snapshots').insert({
      user_id: userId,
      type,
      file_path: result.filePath,
      file_size: result.fileSize,
      graphs_count: result.graphsCount,
      nodes_count: result.nodesCount,
    });

    res.json({
      success: true,
      message: '快照创建成功',
      snapshot: {
        file_size: result.fileSize,
        graphs_count: result.graphsCount,
        nodes_count: result.nodesCount,
      },
    });
  } catch (error: any) {
    logger.error('Create snapshot error:', error);
    res.status(500).json({ error: error.message || '创建快照失败' });
  }
});

router.delete('/snapshots/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const { data: snapshot } = await req.supabase!
      .from('backup_snapshots')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!snapshot) {
      return res.status(404).json({ error: '快照不存在' });
    }

    await deleteBackupFile(snapshot.file_path);
    
    await req.supabase!
      .from('backup_snapshots')
      .delete()
      .eq('id', id);

    res.json({ success: true, message: '快照已删除' });
  } catch (error: any) {
    logger.error('Delete snapshot error:', error);
    res.status(500).json({ error: error.message || '删除快照失败' });
  }
});

router.post('/restore/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const { data: snapshot } = await req.supabase!
      .from('backup_snapshots')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!snapshot) {
      return res.status(404).json({ error: '快照不存在' });
    }

    const backupData = await readBackupFile(snapshot.file_path);
    const { data } = backupData;

    const existingGraphs = await req.supabase!
      .from('knowledge_graphs')
      .select('id')
      .eq('user_id', userId);
    
    if (existingGraphs.data && existingGraphs.data.length > 0) {
      const graphIds = existingGraphs.data.map((g: any) => g.id);
      
      await req.supabase!.from('study_cards').delete().eq('user_id', userId);
      await req.supabase!.from('study_progress').delete().eq('user_id', userId);
      await req.supabase!.from('edges').delete().in('graph_id', graphIds);
      await req.supabase!.from('nodes').delete().in('graph_id', graphIds);
      await req.supabase!.from('knowledge_graphs').delete().eq('user_id', userId);
    }

    const stats = {
      graphs: 0,
      nodes: 0,
      edges: 0,
      study_cards: 0,
    };

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
        await req.supabase!.from('edges').insert(edgesToInsert);
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
        await req.supabase!.from('study_cards').insert(cardsToInsert);
        stats.study_cards = cardsToInsert.length;
      }
    }

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));

    res.json({
      success: true,
      message: '快照恢复成功',
      stats,
    });

  } catch (error: any) {
    logger.error('Restore snapshot error:', error);
    res.status(500).json({ error: error.message || '恢复快照失败' });
  }
});

router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user.id;
  const backupData = req.body;
  const mode = req.query.mode || 'merge';

  if (!backupData || !backupData.data) {
    return res.status(400).json({ error: '无效的备份数据格式' });
  }

  const { data } = backupData;
  const stats = {
    graphs: 0,
    nodes: 0,
    edges: 0,
    study_cards: 0,
  };

  try {
    if (mode === 'replace') {
      const existingGraphs = await req.supabase!
        .from('knowledge_graphs')
        .select('id')
        .eq('user_id', userId);
      
      if (existingGraphs.data && existingGraphs.data.length > 0) {
        const graphIds = existingGraphs.data.map((g: any) => g.id);
        
        await req.supabase!.from('study_cards').delete().eq('user_id', userId);
        await req.supabase!.from('study_progress').delete().eq('user_id', userId);
        await req.supabase!.from('edges').delete().in('graph_id', graphIds);
        await req.supabase!.from('nodes').delete().in('graph_id', graphIds);
        await req.supabase!.from('knowledge_graphs').delete().eq('user_id', userId);
      }
    }

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
        await req.supabase!.from('edges').insert(edgesToInsert);
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
        await req.supabase!.from('study_cards').insert(cardsToInsert);
        stats.study_cards = cardsToInsert.length;
      }
    }

    await cacheService.del(CacheKeys.USER_GRAPHS(userId));

    res.json({
      success: true,
      message: mode === 'replace' ? '快照恢复成功' : '备份导入成功',
      stats,
      mode,
    });

  } catch (error: any) {
    logger.error('Import backup error:', error);
    res.status(500).json({ error: error.message || '导入备份失败' });
  }
});

export default router;
