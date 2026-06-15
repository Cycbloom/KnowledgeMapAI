import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { importDataSchema } from '../schemas/index';
import { cacheService, CacheKeys } from '../services/common/cacheService';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { pdfService } from '../services/common/pdfService';
import { parseMarkdownToGraph } from '../utils/markdownParser';
import { logger } from '../utils/logger';
import { createKnowledgePointWithGraphNode } from '../utils/nodeHelpers';

const router = Router();

// Export graph data
router.all('/export/:format', requireAuth, async (req: AuthRequest, res: Response) => {
  const { format } = req.params;
  const { graph_id } = req.query;
  // Handle POST body for advanced PDF options
  const { options } = req.body; 

  if (!graph_id) return res.status(400).json({ error: '必须提供 graph_id' });

  // Fetch full graph data
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('*')
    .eq('id', graph_id)
    .single();
    
  if (!graph) return res.status(404).json({ error: 'Graph not found' });

  const [graphNodesResult, edgesResult] = await Promise.all([
    req.supabase!.from('graph_nodes').select(`
      id,
      graph_id,
      knowledge_point_id,
      x_position,
      y_position,
      level,
      is_accepted,
      created_at,
      updated_at,
      knowledge_points (
        id,
        title,
        content,
        summary,
        learning_material,
        properties
      )
    `).eq('graph_id', graph_id).is('deleted_at', null),
    req.supabase!.from('edges').select('*').eq('graph_id', graph_id).is('deleted_at', null)
  ]);

  interface GraphNodeQueryResult {
    knowledge_point_id: string;
    graph_id: string;
    x_position: number;
    y_position: number;
    level: string;
    is_accepted: boolean;
    created_at: string;
    updated_at: string;
    knowledge_points?: {
      id?: string;
      title?: string;
      content?: string;
      summary?: string;
      learning_material?: string;
      properties?: Record<string, unknown>;
    } | {
      id?: string;
      title?: string;
      content?: string;
      summary?: string;
      learning_material?: string;
      properties?: Record<string, unknown>;
    }[];
  }

  const nodes = (graphNodesResult.data as GraphNodeQueryResult[] || []).map((gn) => {
    const kp = Array.isArray(gn.knowledge_points) ? gn.knowledge_points[0] : gn.knowledge_points;
    return {
      id: kp?.id || gn.knowledge_point_id,
      graph_id: gn.graph_id,
      knowledge_point_id: gn.knowledge_point_id,
      title: kp?.title || '',
      content: kp?.content || '',
      summary: kp?.summary || '',
      learning_material: kp?.learning_material || '',
      properties: kp?.properties || {},
      x_position: gn.x_position,
      y_position: gn.y_position,
      level: gn.level as import('../../shared/types/graph').NodeLevel,
      is_accepted: gn.is_accepted,
      created_at: gn.created_at,
      updated_at: gn.updated_at
    };
  });
  const edges = edgesResult.data || [];

  const exportData = {
    graph,
    nodes,
    edges
  };

  if (format === 'json') {
    res.header('Content-Type', 'application/json');
    res.attachment(`graph-${graph_id}.json`);
    return res.send(JSON.stringify(exportData, null, 2));
  } else if (format === 'markdown') {
    const safeTitle = typeof graph.title === 'string' && graph.title.trim() ? graph.title.trim() : `graph-${graph_id}`;
    res.header('Content-Type', 'text/markdown; charset=utf-8');
    res.attachment(`${safeTitle}.md`);

    let md = `# ${safeTitle}\n\n`;
    if (graph.description) {
      md += `> ${graph.description}\n\n`;
    }

    md += `---\n\n`;

    interface ExportNode {
      id: string;
      title: string;
      content?: string;
      level: string;
    }

    interface ExportEdge {
      source_knowledge_point_id: string;
      target_knowledge_point_id: string;
    }

    const nodeById = new Map(nodes?.map((n: ExportNode) => [n.id, n]));
    
    const childrenMap = new Map<string, ExportNode[]>();
    const incomingEdges = new Set<string>();
    
    edges?.forEach((e: ExportEdge) => {
        const list = childrenMap.get(e.source_knowledge_point_id) || [];
        const child = nodeById.get(e.target_knowledge_point_id);
        if (child) {
            list.push(child);
            childrenMap.set(e.source_knowledge_point_id, list);
            incomingEdges.add(e.target_knowledge_point_id);
        }
    });

    const visited = new Set<string>();

    const getHeaderPrefix = (level: string, depth: number): string => {
      switch (level) {
        case 'root': return '## ';
        case 'core': return '### ';
        case 'sub': return '#### ';
        case 'normal': return '##### ';
        case 'leaf': return '- '; 
        default: return `${'#'.repeat(Math.min(depth + 1, 6))  } `;
      }
    };

    const renderNode = (node: ExportNode, depth: number) => {
        if (visited.has(node.id)) return;
        visited.add(node.id);

        const isLeaf = node.level === 'leaf';
        const prefix = getHeaderPrefix(node.level || 'normal', depth);
        
        // Indent for leaves if nested? Markdown lists handle indentation naturally if we use 2 spaces
        // But here we are flattening structure slightly. 
        // Let's stick to the prefix logic.
        
        if (isLeaf) {
             // For leaves, we might want to just list them.
             // If parent was a header, this is a list item.
             md += `${prefix}**${node.title}**\n`;
        } else {
             md += `${prefix}${node.title}\n`;
        }

        if (node.content) {
            const content = node.content.trim();
            if (content) {
                 // Indent content for leaves
                 const contentPrefix = isLeaf ? '  ' : '';
                 md += `${content.split('\n').map((line: string) => `${contentPrefix}${line}`).join('\n')  }\n\n`;
            } else {
                 md += '\n';
            }
        } else {
            md += '\n';
        }

        const children = childrenMap.get(node.id) || [];
        children.forEach(child => renderNode(child, depth + 1));
    };

    // Find roots: Nodes with 'root' level OR no incoming edges
    const roots = nodes?.filter((n: ExportNode) => n.level === 'root' || !incomingEdges.has(n.id)) || [];

    // Fallback
    if (roots.length === 0 && nodes && nodes.length > 0) {
        roots.push(nodes[0]);
    }

    roots.forEach(root => renderNode(root, 1));

    // Render remaining disconnected nodes
    const remaining = nodes?.filter((n: ExportNode) => !visited.has(n.id)) || [];
    if (remaining.length > 0) {
        md += `\n---\n\n## Unconnected Nodes\n\n`;
        remaining.forEach(n => renderNode(n, 1));
    }

    return res.send(md);
  } else if (format === 'pdf') {
    const safeTitle = typeof graph.title === 'string' && graph.title.trim() ? graph.title.trim() : `graph-${graph_id}`;
    res.header('Content-Type', 'application/pdf');
    res.attachment(`${safeTitle}.pdf`);

    // Use PDF Service
    try {
      pdfService.generateReport(
        graph, 
        nodes || [], 
        edges || [], 
        options || {}, // Pass options from body (screenshot, etc.)
        res
      );
    } catch (e) {
      logger.error('PDF Generation Error:', e);
      if (!res.headersSent) {
         res.status(500).json({ error: 'PDF generation failed' });
      }
    }
    return;
  }

  throw new AppError('不支持的导出格式', 400, ErrorCodes.VALIDATION_ERROR);
});

// Import Markdown
router.post('/import/markdown', requireAuth, async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required and must be a string' });
  }

  try {
    const { graph_title, nodes, edges } = parseMarkdownToGraph(content);

    // Reuse the same logic as regular import, but we need to call it internally or duplicate logic.
    // Let's duplicate logic for now but keep it clean, or refactor to a service.
    // Since graphService.createGraph exists, we should use it? 
    // But createGraph only creates the graph, not nodes/edges in batch.
    // We'll stick to the transaction logic here.

    // 1. Create Graph
    const { data: graph, error: graphError } = await req.supabase!
      .from('knowledge_graphs')
      .insert([{ user_id: req.user.id, title: graph_title }])
      .select()
      .single();

    if (graphError) throw new Error(graphError.message);

    const nodeMap = new Map();
    
    if (nodes && Array.isArray(nodes)) {
      for (const n of nodes) {
        const result = await createKnowledgePointWithGraphNode(
          req.supabase!,
          req.user.id,
          {
            graph_id: graph.id,
            title: n.title,
            content: n.content || '',
            x_position: n.x_position || 0,
            y_position: n.y_position || 0,
            level: n.level || 'normal',
            properties: n.properties || {}
          }
        );
        
        if (result) {
          const oldId = n.id;
          if (oldId) {
            nodeMap.set(oldId, result.id);
          }
        }
      }

      if (edges && Array.isArray(edges) && edges.length > 0) {
        const edgesToInsert = [];
        
        for (const e of edges) {
          const sourceId = nodeMap.get(e.source);
          const targetId = nodeMap.get(e.target);
          
          if (sourceId && targetId) {
            edgesToInsert.push({
              source_knowledge_point_id: sourceId,
              target_knowledge_point_id: targetId,
              relationship_type: e.relationship || 'contains',
              graph_id: graph.id
            });
          }
        }
        
        if (edgesToInsert.length > 0) {
          const { error: edgesError } = await req.supabase!
            .from('edges')
            .insert(edgesToInsert);
            
          if (edgesError) throw new Error(edgesError.message);
        }
      }
    }

    // Success! Invalidate user graphs cache
    await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
    
    res.status(201).json({ graph });

  } catch (error) {
    logger.error('Import Markdown Error:', error);
    res.status(500).json({ error: (error as Error).message || 'Import failed' });
  }
});

// Import data with Manual Rollback Transaction
router.post('/import', requireAuth, validate(importDataSchema), async (req: AuthRequest, res: Response) => {
  const { graph_title, nodes, edges } = req.body;
  let createdGraphId: string | null = null;

  try {
    // 1. Create Graph
    const { data: graph, error: graphError } = await req.supabase!
      .from('knowledge_graphs')
      .insert([{ user_id: req.user.id, title: graph_title }])
      .select()
      .single();

    if (graphError) throw new Error(graphError.message);
    createdGraphId = graph.id;

    const nodeMap = new Map();
    
    if (nodes && Array.isArray(nodes)) {
      for (const n of nodes) {
        const result = await createKnowledgePointWithGraphNode(
          req.supabase!,
          req.user.id,
          {
            graph_id: graph.id,
            title: n.title,
            content: n.content || '',
            x_position: n.x_position || 0,
            y_position: n.y_position || 0,
            level: n.level || 'normal',
            properties: n.properties || {}
          }
        );
        
        if (result) {
          const oldId = n.id;
          if (oldId) {
            nodeMap.set(oldId, result.id);
          }
        }
      }

      if (edges && Array.isArray(edges) && edges.length > 0) {
        const edgesToInsert = [];
        
        for (const e of edges) {
          const sourceId = nodeMap.get(e.source);
          const targetId = nodeMap.get(e.target);
          
          if (sourceId && targetId) {
            edgesToInsert.push({
              source_knowledge_point_id: sourceId,
              target_knowledge_point_id: targetId,
              relationship_type: e.relationship || 'contains',
              graph_id: graph.id
            });
          }
        }
        
        if (edgesToInsert.length > 0) {
          const { error: edgesError } = await req.supabase!
            .from('edges')
            .insert(edgesToInsert);
            
          if (edgesError) throw new Error(edgesError.message);
        }
      }
    }

    // Success! Invalidate user graphs cache
    await cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));
    
    res.status(201).json({ graph });

  } catch (error) {
    logger.error('Import failed, rolling back:', error);
    
    if (createdGraphId) {
      await req.supabase!
        .from('knowledge_graphs')
        .delete()
        .eq('id', createdGraphId);
    }
    
    throw error;
  }
});

// Reset user data (debug only)
router.post('/reset', requireAuth, async (req: AuthRequest, res: Response) => {
  const { confirm = false, dry_run = false, types = ['all'] } = req.body;

  if (!confirm && !dry_run) {
    return res.status(400).json({
      error: '需要设置 confirm=true 或 dry_run=true',
      hint: '使用 dry_run=true 预览将要删除的数据'
    });
  }

  const userId = req.user.id;
  const isDryRun = dry_run;
  const willDelete = confirm && !dry_run;

  logger.info('数据重置请求', { userId, confirm, dry_run, types });

  interface TableResult {
    table: string;
    count: number;
    deleted: number;
    error?: string;
  }

  const results: TableResult[] = [];

  const processTable = async (
    table: string,
    column: string,
    extraFilter?: { column: string; value: unknown }
  ): Promise<TableResult> => {
    const result: TableResult = { table, count: 0, deleted: 0 };
    try {
      let query = req.supabase!.from(table).select('*', { count: 'exact', head: true }).eq(column, userId);
      if (extraFilter) {
        query = query.eq(extraFilter.column, extraFilter.value);
      }
      const { count } = await query;
      result.count = count || 0;

      if (willDelete && result.count > 0) {
        let deleteQuery = req.supabase!.from(table).delete().eq(column, userId);
        if (extraFilter) {
          deleteQuery = deleteQuery.eq(extraFilter.column, extraFilter.value);
        }
        const { error } = await deleteQuery;
        if (error) {
          result.error = error.message;
          logger.warn(`删除表 ${table} 失败`, { error: error.message });
        } else {
          result.deleted = result.count;
        }
      }
    } catch (e) {
      result.error = (e as Error).message || String(e);
      logger.warn(`处理表 ${table} 时出错`, { error: (e as Error).message });
    }
    return result;
  };

  const shouldProcess = (type: string): boolean =>
    types.includes('all') || types.includes(type);

  // graphs 类型
  if (shouldProcess('graphs')) {
    const graphTables = [
      { table: 'graph_collaborators', column: 'user_id' },
      { table: 'learning_path_progress', column: 'user_id' },
      { table: 'graph_domains', column: 'user_id' },
      { table: 'graph_relations', column: 'user_id' },
      { table: 'learning_paths', column: 'user_id' },
      { table: 'learning_path_nodes', column: 'user_id' },
      { table: 'ai_actions', column: 'user_id' },
      { table: 'prompt_templates', column: 'user_id', extraFilter: { column: 'scope', value: 'user' } },
      { table: 'templates', column: 'user_id' },
      { table: 'knowledge_graphs', column: 'user_id' }
    ];

    for (const t of graphTables) {
      results.push(await processTable(t.table, t.column, t.extraFilter));
    }
  }

  // tasks 类型
  if (shouldProcess('user_tasks')) {
    const taskTables = [
      { table: 'task_subtasks', column: 'user_id' },
      { table: 'task_links', column: 'user_id' },
      { table: 'task_knowledge_points', column: 'user_id' },
      { table: 'task_dependencies', column: 'user_id' },
      { table: 'task_executions', column: 'user_id' },
      { table: 'task_tags', column: 'user_id' },
      { table: 'task_settings', column: 'user_id' },
      { table: 'task_schedules', column: 'user_id' },
      { table: 'task_progress_plans', column: 'user_id' },
      { table: 'user_tasks', column: 'user_id' }
    ];

    for (const t of taskTables) {
      results.push(await processTable(t.table, t.column));
    }
  }

  // study 类型
  if (shouldProcess('study')) {
    const studyTables = [
      { table: 'user_activities', column: 'user_id' },
      { table: 'user_time_slots', column: 'user_id' },
      { table: 'user_achievements', column: 'user_id' },
      { table: 'focus_sessions', column: 'user_id' },
      { table: 'user_focus_stats', column: 'user_id' },
      { table: 'user_efficiency_profile', column: 'user_id' },
      { table: 'user_pass_progress', column: 'user_id' },
      { table: 'periodic_passes', column: 'user_id' },
      { table: 'periodic_tasks', column: 'user_id' },
      { table: 'task_reviews', column: 'user_id' },
      { table: 'path_node_tasks', column: 'user_id' },
      { table: 'knowledge_review_tasks', column: 'user_id' },
      { table: 'quiz_set_cards', column: 'user_id' },
      { table: 'study_cards', column: 'user_id' },
      { table: 'study_progress', column: 'user_id' },
      { table: 'backup_snapshots', column: 'user_id' },
      { table: 'queues', column: 'user_id' },
      { table: 'user_tasks', column: 'user_id' }
    ];

    for (const t of studyTables) {
      results.push(await processTable(t.table, t.column));
    }
  }

  // 公共表（all类型都删）
  if (types.includes('all')) {
    const commonTables = [
      { table: 'knowledge_points', column: 'owner_id' },
      { table: 'domains', column: 'user_id' },
      { table: 'quiz_sets', column: 'user_id' },
      { table: 'relationship_types', column: 'user_id', extraFilter: { column: 'is_builtin', value: false } }
    ];

    for (const t of commonTables) {
      results.push(await processTable(t.table, t.column, t.extraFilter));
    }
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  const totalFound = results.reduce((sum, r) => sum + r.count, 0);

  if (willDelete) {
    await cacheService.del(CacheKeys.USER_GRAPHS(userId));
    logger.info('用户数据重置完成', { userId, totalDeleted, tablesProcessed: results.length });
  }

  return res.json({
    success: true,
    mode: isDryRun ? 'dry_run' : (willDelete ? 'deleted' : 'preview'),
    summary: {
      total_deleted: totalDeleted,
      total_found: totalFound,
      tables: results.map(r => ({
        table: r.table,
        count: r.count,
        deleted: r.deleted,
        ...(r.error ? { error: r.error } : {})
      }))
    }
  });
});

export default router;
