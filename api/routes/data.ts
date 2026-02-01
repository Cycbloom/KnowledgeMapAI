import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { importDataSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { AppError } from '../middleware/errorHandler.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { createRequire } from 'module';
import fs from 'fs';

const router = Router();
const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

// Export graph data
router.get('/export/:format', requireAuth, async (req: AuthRequest, res: Response) => {
  const { format } = req.params;
  const { graph_id } = req.query;

  if (!graph_id) return res.status(400).json({ error: '必须提供 graph_id' });

  // Fetch full graph data
  const { data: graph } = await req.supabase!
    .from('knowledge_graphs')
    .select('*')
    .eq('id', graph_id)
    .single();
    
  if (!graph) return res.status(404).json({ error: 'Graph not found' });

  const { data: nodes } = await req.supabase!.from('nodes').select('*').eq('graph_id', graph_id);
  
  const nodeIds = nodes?.map(n => n.id) || [];
  const { data: edges } = await req.supabase!.from('edges').select('*').in('source_node_id', nodeIds);

  const exportData = {
    graph,
    nodes,
    edges
  };

  if (format === 'json') {
    res.header('Content-Type', 'application/json');
    res.attachment(`graph-${graph_id}.json`);
    return res.send(JSON.stringify(exportData, null, 2));
  } else if (format === 'pdf') {
    const safeTitle = typeof graph.title === 'string' && graph.title.trim() ? graph.title.trim() : `graph-${graph_id}`;
    res.header('Content-Type', 'application/pdf');
    res.attachment(`${safeTitle}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 48 });

    const preferredFontPaths = [
      process.env.PDF_FONT_PATH,
      'C:\\\\Windows\\\\Fonts\\\\simhei.ttf',
      'C:\\\\Windows\\\\Fonts\\\\msyh.ttf',
      'C:\\\\Windows\\\\Fonts\\\\simsun.ttc'
    ].filter(Boolean) as string[];

    for (const fontPath of preferredFontPaths) {
      try {
        if (fs.existsSync(fontPath)) {
          doc.registerFont('CN', fontPath);
          doc.font('CN');
          break;
        }
      } catch {}
    }

    doc.pipe(res);

    doc.fontSize(20).text(safeTitle, { align: 'center' });
    doc.moveDown(0.5);
    if (graph.description) {
      doc.fontSize(11).fillColor('#333333').text(String(graph.description));
      doc.moveDown(0.8);
    }
    doc.fontSize(9).fillColor('#666666').text(`导出时间：${new Date().toLocaleString()}`);
    doc.moveDown(1);
    doc.fillColor('#111111');

    const nodesArr = Array.isArray(nodes) ? nodes : [];
    const edgesArr = Array.isArray(edges) ? edges : [];

    const nodeById = new Map(nodesArr.map((n: any) => [n.id, n]));
    const childrenByParent = new Map<string, string[]>();
    const incoming = new Set<string>();

    for (const e of edgesArr as any[]) {
      if (!e?.source_node_id || !e?.target_node_id) continue;
      incoming.add(e.target_node_id);
      const list = childrenByParent.get(e.source_node_id) || [];
      list.push(e.target_node_id);
      childrenByParent.set(e.source_node_id, list);
    }

    const rootNodes = nodesArr.filter((n: any) => n.level === 'root');
    const fallbackRoots = nodesArr.filter((n: any) => !incoming.has(n.id));
    const roots = rootNodes.length > 0 ? rootNodes : (fallbackRoots.length > 0 ? fallbackRoots : nodesArr.slice(0, 1));

    const visited = new Set<string>();

    const renderNode = (node: any, depth: number) => {
      if (!node || visited.has(node.id)) return;
      visited.add(node.id);

      const indent = Math.min(depth, 6) * 18;
      const titleSize = Math.max(11, 16 - depth);

      doc.fontSize(titleSize).fillColor('#111111').text(String(node.title || '未命名节点'), { indent });
      if (node.content) {
        doc.moveDown(0.2);
        doc.fontSize(9).fillColor('#333333').text(String(node.content), { indent: indent + 12 });
      }
      doc.moveDown(0.6);

      const children = childrenByParent.get(node.id) || [];
      for (const childId of children) {
        renderNode(nodeById.get(childId), depth + 1);
      }
    };

    for (const r of roots) renderNode(r, 0);

    const remaining = nodesArr.filter((n: any) => !visited.has(n.id));
    if (remaining.length > 0) {
      doc.addPage();
      doc.fontSize(14).fillColor('#111111').text('未连接节点', { align: 'left' });
      doc.moveDown(0.8);
      for (const n of remaining) renderNode(n, 0);
    }

    doc.end();
    return;
  }

  throw new AppError('Unsupported format', 400, ErrorCodes.VALIDATION_ERROR);
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

    // 2. Create Nodes
    const nodeMap = new Map(); // Old ID to New ID
    const nodesToInsert = [];
    
    if (nodes && Array.isArray(nodes)) {
      for (const n of nodes) {
        nodesToInsert.push({
          graph_id: graph.id,
          title: n.title,
          content: n.content,
          x_position: n.x_position || 0,
          y_position: n.y_position || 0,
          color: n.color,
          level: n.level || 'normal',
          properties: n.properties || {}
        });
      }
      
      const { data: insertedNodes, error: nodesError } = await req.supabase!
        .from('nodes')
        .insert(nodesToInsert)
        .select();

      if (nodesError) throw new Error(nodesError.message);

      // Build ID map
      if (insertedNodes && insertedNodes.length === nodes.length) {
        for (let i = 0; i < nodes.length; i++) {
          const oldId = nodes[i].id;
          const newId = insertedNodes[i].id;
          if (oldId) {
            nodeMap.set(oldId, newId);
          }
        }
      }

      // 3. Create Edges
      if (edges && Array.isArray(edges) && edges.length > 0) {
        const edgesToInsert = [];
        
        for (const e of edges) {
          const sourceId = nodeMap.get(e.source);
          const targetId = nodeMap.get(e.target);
          
          if (sourceId && targetId) {
            edgesToInsert.push({
              source_node_id: sourceId,
              target_node_id: targetId,
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
    console.error('Import failed, rolling back:', error);
    
    // Rollback: Delete the graph if it was created
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
