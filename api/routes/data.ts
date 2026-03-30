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
      knowledge_points (
        id,
        title,
        content,
        learning_material,
        properties
      )
    `).eq('graph_id', graph_id).is('deleted_at', null),
    req.supabase!.from('edges').select('*').eq('graph_id', graph_id).is('deleted_at', null)
  ]);

  const nodes = (graphNodesResult.data || []).map((gn: any) => {
    const kp = Array.isArray(gn.knowledge_points) ? gn.knowledge_points[0] : gn.knowledge_points;
    return {
      id: kp?.id || gn.knowledge_point_id,
      graph_id: gn.graph_id,
      title: kp?.title || '',
      content: kp?.content || '',
      learning_material: kp?.learning_material || '',
      properties: kp?.properties || {},
      x_position: gn.x_position,
      y_position: gn.y_position,
      level: gn.level,
      is_accepted: gn.is_accepted
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

    const nodeById = new Map(nodes?.map((n: any) => [n.id, n]));
    
    // Build tree structure
    const childrenMap = new Map<string, any[]>();
    const incomingEdges = new Set<string>(); // target_knowledge_point_ids
    
    edges?.forEach((e: any) => {
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

    const renderNode = (node: any, depth: number) => {
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
    const roots = nodes?.filter((n: any) => n.level === 'root' || !incomingEdges.has(n.id)) || [];

    // Fallback
    if (roots.length === 0 && nodes && nodes.length > 0) {
        roots.push(nodes[0]);
    }

    roots.forEach(root => renderNode(root, 1));

    // Render remaining disconnected nodes
    const remaining = nodes?.filter((n: any) => !visited.has(n.id)) || [];
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
    } catch (e: any) {
      logger.error('PDF Generation Error:', e);
      if (!res.headersSent) {
         res.status(500).json({ error: 'PDF generation failed' });
      }
    }
    return;
  }

  throw new AppError('Unsupported format', 400, ErrorCodes.VALIDATION_ERROR);
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
              relationship_type: e.relationship || 'related',
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

  } catch (error: any) {
    logger.error('Import Markdown Error:', error);
    res.status(500).json({ error: error.message || 'Import failed' });
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
              relationship_type: e.relationship || 'related',
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

  } catch (error: any) {
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

export default router;
