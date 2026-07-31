import type { SupabaseClient } from '@supabase/supabase-js';
import type { Graph, Edge, NodeLevel } from '@shared/types/graph';
import { cacheService, CacheKeys } from '../common/cacheService';
import { pdfService } from '../common/pdfService';
import { parseMarkdownToGraph } from '../../utils/markdownParser';
import { createKnowledgePointWithGraphNode } from '../../utils/nodeHelpers';
import { transactionExecutor } from '../../database/transactionExecutor';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import i18next from "i18next";
import { notDeleted } from '../common/softDeleteHelper';

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

interface ExportNode {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  title: string;
  content: string;
  summary: string;
  learning_material: string;
  properties: Record<string, unknown>;
  x_position: number;
  y_position: number;
  level: NodeLevel;
  is_accepted: boolean;
  created_at: string;
  updated_at: string;
}

interface ExportEdge {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  [key: string]: unknown;
}

interface MarkdownExportNode {
  id: string;
  title: string;
  content?: string;
  level: string;
}

interface ExportData {
  graph: Record<string, unknown>;
  nodes: ExportNode[];
  edges: ExportEdge[];
}

interface PdfOptions {
  includeScreenshot?: boolean;
  includeStats?: boolean;
  includeDetails?: boolean;
  screenshotBase64?: string;
}

interface ResetOptions {
  confirm?: boolean;
  dry_run?: boolean;
  types?: string[];
}

interface TableResult {
  table: string;
  count: number;
  deleted: number;
  error?: string;
}

interface TableInfo {
  table: string;
  column: string;
  extraFilter?: { column: string; value: unknown };
}

interface ExportGraphResult {
  graph: Record<string, unknown>;
  nodes: ExportNode[];
  edges: ExportEdge[];
  safeTitle: string;
}

export class DataService {
  /**
   * Fetch graph data for export (shared data fetching for all formats)
   */
  async fetchGraphForExport(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<ExportGraphResult> {
    // Fetch full graph data
    const { data: graph } = await supabase
      .from('knowledge_graphs')
      .select('*')
      .eq('id', graphId)
      .single();

    if (!graph) {
      throw new AppError(ErrorCodes.RESOURCE_GRAPH_NOT_FOUND);
    }

    const [graphNodesResult, edgesResult] = await Promise.all([
      notDeleted(supabase.from('graph_nodes').select(`
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
      `).eq('graph_id', graphId)),
      notDeleted(supabase.from('edges').select('*').eq('graph_id', graphId)),
    ]);

    const nodes: ExportNode[] = (graphNodesResult.data as GraphNodeQueryResult[] || []).map((gn) => {
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
        level: gn.level as NodeLevel,
        is_accepted: gn.is_accepted,
        created_at: gn.created_at,
        updated_at: gn.updated_at,
      };
    });
    const edges: ExportEdge[] = edgesResult.data || [];

    const safeTitle = typeof graph.title === 'string' && graph.title.trim() ? graph.title.trim() : `graph-${graphId}`;

    return { graph, nodes, edges, safeTitle };
  }

  /**
   * Export graph data in specified format (json, markdown, pdf)
   */
  async exportGraph(
    supabase: SupabaseClient,
    graphId: string,
    format: string,
  ): Promise<{ format: string; data: string; filename: string; contentType: string }> {
    const { graph, nodes, edges, safeTitle } = await this.fetchGraphForExport(supabase, graphId);

    if (format === 'json') {
      const exportData: ExportData = { graph, nodes, edges };
      return {
        format: 'json',
        data: JSON.stringify(exportData, null, 2),
        filename: `graph-${graphId}.json`,
        contentType: 'application/json',
      };
    } else if (format === 'markdown') {
      const md = this.buildMarkdownExport(safeTitle, graph, nodes, edges);
      return {
        format: 'markdown',
        data: md,
        filename: `${safeTitle}.md`,
        contentType: 'text/markdown; charset=utf-8',
      };
    } else if (format === 'pdf') {
      // For PDF, return metadata; the route should call generatePdfReport with the response stream
      return {
        format: 'pdf',
        data: '',
        filename: `${safeTitle}.pdf`,
        contentType: 'application/pdf',
      };
    }

    throw new AppError(i18next.t("graphMap.api.errors.unsupportedExportFormat"), 400, ErrorCodes.VALIDATION_ERROR);
  }

  /**
   * Build markdown string from graph data
   */
  private buildMarkdownExport(
    safeTitle: string,
    graph: Record<string, unknown>,
    nodes: ExportNode[],
    edges: ExportEdge[],
  ): string {
    let md = `# ${safeTitle}\n\n`;
    if (graph.description) {
      md += `> ${graph.description}\n\n`;
    }

    md += `---\n\n`;

    const nodeById = new Map<string, MarkdownExportNode>(nodes?.map((n) => [n.id, n]));

    const childrenMap = new Map<string, MarkdownExportNode[]>();
    const incomingEdges = new Set<string>();

    edges?.forEach((e) => {
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
        default: return `${'#'.repeat(Math.min(depth + 1, 6))} `;
      }
    };

    const renderNode = (node: MarkdownExportNode, depth: number) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      const isLeaf = node.level === 'leaf';
      const prefix = getHeaderPrefix(node.level || 'normal', depth);

      if (isLeaf) {
        md += `${prefix}**${node.title}**\n`;
      } else {
        md += `${prefix}${node.title}\n`;
      }

      if (node.content) {
        const content = node.content.trim();
        if (content) {
          const contentPrefix = isLeaf ? '  ' : '';
          md += `${content.split('\n').map((line: string) => `${contentPrefix}${line}`).join('\n')}\n\n`;
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
    const roots = nodes?.filter((n) => n.level === 'root' || !incomingEdges.has(n.id)) || [];

    // Fallback
    if (roots.length === 0 && nodes && nodes.length > 0) {
      roots.push(nodes[0]);
    }

    roots.forEach(root => renderNode(root, 1));

    // Render remaining disconnected nodes
    const remaining = nodes?.filter((n) => !visited.has(n.id)) || [];
    if (remaining.length > 0) {
      md += `\n---\n\n## Unconnected Nodes\n\n`;
      remaining.forEach(n => renderNode(n, 1));
    }

    return md;
  }

  /**
   * Generate PDF report for a graph - delegates to pdfService
   * This is a convenience method for the route to call directly
   * since PDF needs the response stream
   */
  generatePdfReport(
    graph: Record<string, unknown>,
    nodes: ExportNode[],
    edges: ExportEdge[],
    options: PdfOptions,
    outputStream: NodeJS.WritableStream,
  ): void {
    pdfService.generateReport(
      graph as unknown as Graph,
      nodes as unknown as { id: string; title: string; content?: string; level: NodeLevel }[],
      edges as unknown as Edge[],
      options,
      outputStream,
    );
  }

  /**
   * Import graph from markdown content
   */
  async importMarkdown(
    supabase: SupabaseClient,
    userId: string,
    content: string,
  ): Promise<Record<string, unknown>> {
    const { graph_title, nodes, edges } = parseMarkdownToGraph(content);

    if (transactionExecutor.isAvailable()) {
      const graph = await transactionExecutor.executeInTransaction(async (client) => {
        // 1. Create Graph
        const graphResult = await client.query(
          `INSERT INTO knowledge_graphs (user_id, title) VALUES ($1, $2) RETURNING *`,
          [userId, graph_title],
        );
        const graphRow = graphResult.rows[0];
        const graphId = graphRow.id;

        const nodeMap = new Map<string, string>();

        // 2. Create knowledge_points and graph_nodes
        if (nodes && Array.isArray(nodes)) {
          for (const n of nodes) {
            const kpResult = await client.query(
              `INSERT INTO knowledge_points (title, content, summary, properties, visibility, owner_id)
               VALUES ($1, $2, $3, $4, 'private', $5) RETURNING id`,
              [n.title, n.content || '', null, JSON.stringify(n.properties || {}), userId],
            );
            const kpId = kpResult.rows[0].id;

            await client.query(
              `INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted)
               VALUES ($1, $2, $3, $4, $5, true)`,
              [graphId, kpId, n.x_position || 0, n.y_position || 0, n.level || 'normal'],
            );

            const oldId = n.id;
            if (oldId) {
              nodeMap.set(oldId, kpId);
            }
          }

          // 3. Create edges
          if (edges && Array.isArray(edges) && edges.length > 0) {
            const edgesValues: string[] = [];
            const edgesParams: unknown[] = [];
            let paramIdx = 1;

            for (const e of edges) {
              const sourceId = nodeMap.get(e.source);
              const targetId = nodeMap.get(e.target);

              if (sourceId && targetId) {
                edgesValues.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
                edgesParams.push(sourceId, targetId, e.relationship || 'contains', graphId);
                paramIdx += 4;
              }
            }

            if (edgesValues.length > 0) {
              await client.query(
                `INSERT INTO edges (source_knowledge_point_id, target_knowledge_point_id, relationship_type, graph_id)
                 VALUES ${edgesValues.join(', ')}`,
                edgesParams,
              );
            }
          }
        }

        return graphRow;
      });

      // Success! Invalidate user graphs cache
      await cacheService.del(CacheKeys.USER_GRAPHS(userId));

      return graph;
    }

    // Fallback: no transaction executor available
    logger.warn('transactionExecutor not available, using manual rollback for importMarkdown');
    let createdGraphId: string | null = null;
    const createdKnowledgePointIds: string[] = [];

    try {
      // 1. Create Graph
      const { data: graph, error: graphError } = await supabase
        .from('knowledge_graphs')
        .insert([{ user_id: userId, title: graph_title }])
        .select()
        .single();

      if (graphError) throw new Error(graphError.message);
      createdGraphId = graph.id;

      const nodeMap = new Map<string, string>();

      if (nodes && Array.isArray(nodes)) {
        for (const n of nodes) {
          const result = await createKnowledgePointWithGraphNode(
            supabase,
            userId,
            {
              graph_id: graph.id,
              title: n.title,
              content: n.content || '',
              x_position: n.x_position || 0,
              y_position: n.y_position || 0,
              level: n.level || 'normal',
              properties: n.properties || {},
            },
          );

          if (result) {
            createdKnowledgePointIds.push(result.knowledge_point_id);
            const oldId = n.id;
            if (oldId) {
              nodeMap.set(oldId, result.id);
            }
          }
        }

        if (edges && Array.isArray(edges) && edges.length > 0) {
          const edgesToInsert: Array<{
            source_knowledge_point_id: string;
            target_knowledge_point_id: string;
            relationship_type: string;
            graph_id: string;
          }> = [];

          for (const e of edges) {
            const sourceId = nodeMap.get(e.source);
            const targetId = nodeMap.get(e.target);

            if (sourceId && targetId) {
              edgesToInsert.push({
                source_knowledge_point_id: sourceId,
                target_knowledge_point_id: targetId,
                relationship_type: e.relationship || 'contains',
                graph_id: graph.id,
              });
            }
          }

          if (edgesToInsert.length > 0) {
            const { error: edgesError } = await supabase
              .from('edges')
              .insert(edgesToInsert);

            if (edgesError) throw new Error(edgesError.message);
          }
        }
      }

      // Success! Invalidate user graphs cache
      await cacheService.del(CacheKeys.USER_GRAPHS(userId));

      return graph;
    } catch (error) {
      logger.error('Import Markdown failed, rolling back:', error);

      if (createdGraphId) {
        // Clean up graph_nodes for this graph
        await supabase.from('graph_nodes').delete().eq('graph_id', createdGraphId);
        // Clean up edges for this graph
        await supabase.from('edges').delete().eq('graph_id', createdGraphId);
        // Clean up knowledge_points created during import
        if (createdKnowledgePointIds.length > 0) {
          await supabase.from('knowledge_points').delete().in('id', createdKnowledgePointIds);
        }
        // Delete the graph
        await supabase.from('knowledge_graphs').delete().eq('id', createdGraphId);
      }

      throw error;
    }
  }

  /**
   * Import graph from JSON data
   */
  async importData(
    supabase: SupabaseClient,
    userId: string,
    data: {
      graph_title: string;
      nodes?: Array<{
        id?: string;
        title: string;
        content?: string;
        summary?: string;
        learning_material?: string;
        x_position?: number;
        y_position?: number;
        level?: string;
        properties?: Record<string, unknown>;
      }>;
      edges?: Array<{
        source: string;
        target: string;
        relationship?: string;
      }>;
    },
  ): Promise<Record<string, unknown>> {
    const { graph_title, nodes, edges } = data;

    if (transactionExecutor.isAvailable()) {
      const graph = await transactionExecutor.executeInTransaction(async (client) => {
        // 1. Create Graph
        const graphResult = await client.query(
          `INSERT INTO knowledge_graphs (user_id, title) VALUES ($1, $2) RETURNING *`,
          [userId, graph_title],
        );
        const graphRow = graphResult.rows[0];
        const graphId = graphRow.id;

        const nodeMap = new Map<string, string>();

        // 2. Create knowledge_points and graph_nodes
        if (nodes && Array.isArray(nodes)) {
          for (const n of nodes) {
            const kpResult = await client.query(
              `INSERT INTO knowledge_points (title, content, summary, learning_material, properties, visibility, owner_id)
               VALUES ($1, $2, $3, $4, $5, 'private', $6) RETURNING id`,
              [n.title, n.content || '', n.summary || null, n.learning_material || null, JSON.stringify(n.properties || {}), userId],
            );
            const kpId = kpResult.rows[0].id;

            await client.query(
              `INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted)
               VALUES ($1, $2, $3, $4, $5, true)`,
              [graphId, kpId, n.x_position || 0, n.y_position || 0, n.level || 'normal'],
            );

            const oldId = n.id;
            if (oldId) {
              nodeMap.set(oldId, kpId);
            }
          }

          // 3. Create edges
          if (edges && Array.isArray(edges) && edges.length > 0) {
            const edgesValues: string[] = [];
            const edgesParams: unknown[] = [];
            let paramIdx = 1;

            for (const e of edges) {
              const sourceId = nodeMap.get(e.source);
              const targetId = nodeMap.get(e.target);

              if (sourceId && targetId) {
                edgesValues.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
                edgesParams.push(sourceId, targetId, e.relationship || 'contains', graphId);
                paramIdx += 4;
              }
            }

            if (edgesValues.length > 0) {
              await client.query(
                `INSERT INTO edges (source_knowledge_point_id, target_knowledge_point_id, relationship_type, graph_id)
                 VALUES ${edgesValues.join(', ')}`,
                edgesParams,
              );
            }
          }
        }

        return graphRow;
      });

      // Success! Invalidate user graphs cache
      await cacheService.del(CacheKeys.USER_GRAPHS(userId));

      return graph;
    }

    // Fallback: no transaction executor available
    logger.warn('transactionExecutor not available, using manual rollback for importData');
    let createdGraphId: string | null = null;
    const createdKnowledgePointIds: string[] = [];

    try {
      // 1. Create Graph
      const { data: graph, error: graphError } = await supabase
        .from('knowledge_graphs')
        .insert([{ user_id: userId, title: graph_title }])
        .select()
        .single();

      if (graphError) throw new Error(graphError.message);
      createdGraphId = graph.id;

      const nodeMap = new Map<string, string>();

      if (nodes && Array.isArray(nodes)) {
        for (const n of nodes) {
          const result = await createKnowledgePointWithGraphNode(
            supabase,
            userId,
            {
              graph_id: graph.id,
              title: n.title,
              content: n.content || '',
              summary: n.summary,
              learning_material: n.learning_material,
              x_position: n.x_position || 0,
              y_position: n.y_position || 0,
              level: n.level || 'normal',
              properties: n.properties || {},
            },
          );

          if (result) {
            createdKnowledgePointIds.push(result.knowledge_point_id);
            const oldId = n.id;
            if (oldId) {
              nodeMap.set(oldId, result.id);
            }
          }
        }

        if (edges && Array.isArray(edges) && edges.length > 0) {
          const edgesToInsert: Array<{
            source_knowledge_point_id: string;
            target_knowledge_point_id: string;
            relationship_type: string;
            graph_id: string;
          }> = [];

          for (const e of edges) {
            const sourceId = nodeMap.get(e.source);
            const targetId = nodeMap.get(e.target);

            if (sourceId && targetId) {
              edgesToInsert.push({
                source_knowledge_point_id: sourceId,
                target_knowledge_point_id: targetId,
                relationship_type: e.relationship || 'contains',
                graph_id: graph.id,
              });
            }
          }

          if (edgesToInsert.length > 0) {
            const { error: edgesError } = await supabase
              .from('edges')
              .insert(edgesToInsert);

            if (edgesError) throw new Error(edgesError.message);
          }
        }
      }

      // Success! Invalidate user graphs cache
      await cacheService.del(CacheKeys.USER_GRAPHS(userId));

      return graph;
    } catch (error) {
      logger.error('Import failed, rolling back:', error);

      if (createdGraphId) {
        // Delete graph_nodes for this graph
        await supabase.from('graph_nodes').delete().eq('graph_id', createdGraphId);
        // Delete edges for this graph
        await supabase.from('edges').delete().eq('graph_id', createdGraphId);
        // Clean up knowledge_points created during import
        if (createdKnowledgePointIds.length > 0) {
          await supabase.from('knowledge_points').delete().in('id', createdKnowledgePointIds);
        }
        // Delete the graph
        await supabase.from('knowledge_graphs').delete().eq('id', createdGraphId);
      }

      throw error;
    }
  }

  /**
   * Reset user data across multiple tables
   */
  async resetUserData(
    supabase: SupabaseClient,
    userId: string,
    options: ResetOptions,
  ): Promise<{
    success: boolean;
    mode: string;
    summary: {
      total_deleted: number;
      total_found: number;
      tables: Array<{
        table: string;
        count: number;
        deleted: number;
        error?: string;
      }>;
    };
  }> {
    const { confirm = false, dry_run = false, types = ['all'] } = options;

    if (!confirm && !dry_run) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, {
        message: i18next.t("graphMap.api.errors.confirmOrDryRunRequired"),
        details: { hint: i18next.t("graphMap.api.errors.dryRunHint") },
      });
    }

    const isDryRun = dry_run;
    const willDelete = confirm && !dry_run;

    logger.info('数据重置请求', { userId, confirm, dry_run, types });

    const results: TableResult[] = [];

    const countTable = async (
      table: string,
      column: string,
      extraFilter?: { column: string; value: unknown },
    ): Promise<number> => {
      let query = supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, userId);
      if (extraFilter) {
        query = query.eq(extraFilter.column, extraFilter.value);
      }
      const { count } = await query;
      return count || 0;
    };

    const deleteTableViaSupabase = async (
      table: string,
      column: string,
      extraFilter?: { column: string; value: unknown },
    ): Promise<{ deleted: number; error?: string }> => {
      let deleteQuery = supabase.from(table).delete().eq(column, userId);
      if (extraFilter) {
        deleteQuery = deleteQuery.eq(extraFilter.column, extraFilter.value);
      }
      const { error } = await deleteQuery;
      if (error) {
        return { deleted: 0, error: error.message };
      }
      return { deleted: 0 }; // actual count unknown, will use pre-counted value
    };

    const shouldProcess = (type: string): boolean =>
      types.includes('all') || types.includes(type);

    // Collect all tables to process
    const allTables: TableInfo[] = [];

    // graphs 类型
    if (shouldProcess('graphs')) {
      allTables.push(
        { table: 'graph_collaborators', column: 'user_id' },
        { table: 'learning_path_progress', column: 'user_id' },
        { table: 'graph_domains', column: 'user_id' },
        { table: 'graph_relations', column: 'user_id' },
        { table: 'learning_paths', column: 'user_id' },
        { table: 'learning_path_nodes', column: 'user_id' },
        { table: 'ai_actions', column: 'user_id' },
        { table: 'prompt_templates', column: 'user_id', extraFilter: { column: 'scope', value: 'user' } },
        { table: 'templates', column: 'user_id' },
        { table: 'knowledge_graphs', column: 'user_id' },
      );
    }

    // tasks 类型
    if (shouldProcess('user_tasks')) {
      allTables.push(
        { table: 'task_subtasks', column: 'user_id' },
        { table: 'task_links', column: 'user_id' },
        { table: 'task_knowledge_points', column: 'user_id' },
        { table: 'task_dependencies', column: 'user_id' },
        { table: 'task_executions', column: 'user_id' },
        { table: 'task_tags', column: 'user_id' },
        { table: 'task_settings', column: 'user_id' },
        { table: 'task_schedules', column: 'user_id' },
        { table: 'task_progress_plans', column: 'user_id' },
        { table: 'user_tasks', column: 'user_id' },
      );
    }

    // study 类型
    if (shouldProcess('study')) {
      allTables.push(
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
        { table: 'quiz_set_cards', column: 'user_id' },
        { table: 'study_cards', column: 'user_id' },
        { table: 'study_progress', column: 'user_id' },
        { table: 'backup_snapshots', column: 'user_id' },
        { table: 'queues', column: 'user_id' },
        { table: 'user_tasks', column: 'user_id' },
      );
    }

    // 公共表（all类型都删）
    if (types.includes('all')) {
      allTables.push(
        { table: 'knowledge_points', column: 'owner_id' },
        { table: 'domains', column: 'user_id' },
        { table: 'quiz_sets', column: 'user_id' },
        { table: 'relationship_types', column: 'user_id', extraFilter: { column: 'is_builtin', value: false } },
      );
    }

    // Phase 1: Count all tables
    for (const t of allTables) {
      const result: TableResult = { table: t.table, count: 0, deleted: 0 };
      try {
        result.count = await countTable(t.table, t.column, t.extraFilter);
      } catch (e) {
        result.error = (e as Error).message || String(e);
        logger.warn(`计数表 ${t.table} 时出错`, { error: (e as Error).message });
      }
      results.push(result);
    }

    // Phase 2: Delete if requested
    if (willDelete) {
      const tablesWithCount = allTables.map((t, i) => ({ ...t, count: results[i].count }));
      const tablesToDelete = tablesWithCount.filter(t => t.count > 0);

      if (tablesToDelete.length > 0 && transactionExecutor.isAvailable()) {
        // Use transaction executor for atomic deletion
        try {
          await transactionExecutor.executeInTransaction(async (client) => {
            for (const t of tablesToDelete) {
              if (t.extraFilter) {
                await client.query(
                  `DELETE FROM ${t.table} WHERE ${t.column} = $1 AND ${t.extraFilter.column} = $2`,
                  [userId, t.extraFilter.value],
                );
              } else {
                await client.query(
                  `DELETE FROM ${t.table} WHERE ${t.column} = $1`,
                  [userId],
                );
              }
            }
          });

          // Mark all as deleted on success
          for (let i = 0; i < results.length; i++) {
            if (allTables[i] && tablesWithCount[i].count > 0) {
              results[i].deleted = results[i].count;
            }
          }
        } catch (error) {
          logger.error('事务删除失败，回退到逐表删除', { error: (error as Error).message });
          // Fallback: delete one by one via Supabase client
          for (let i = 0; i < allTables.length; i++) {
            const t = allTables[i];
            if (results[i].count > 0) {
              try {
                const { error: delError } = await deleteTableViaSupabase(t.table, t.column, t.extraFilter);
                if (delError) {
                  results[i].error = delError;
                  logger.warn(`删除表 ${t.table} 失败`, { error: delError });
                } else {
                  results[i].deleted = results[i].count;
                }
              } catch (e) {
                results[i].error = (e as Error).message || String(e);
                logger.warn(`删除表 ${t.table} 时出错`, { error: (e as Error).message });
              }
            }
          }
        }
      } else if (tablesToDelete.length > 0) {
        // No transaction executor available, delete one by one via Supabase client
        for (let i = 0; i < allTables.length; i++) {
          const t = allTables[i];
          if (results[i].count > 0) {
            try {
              const { error: delError } = await deleteTableViaSupabase(t.table, t.column, t.extraFilter);
              if (delError) {
                results[i].error = delError;
                logger.warn(`删除表 ${t.table} 失败`, { error: delError });
              } else {
                results[i].deleted = results[i].count;
              }
            } catch (e) {
              results[i].error = (e as Error).message || String(e);
              logger.warn(`删除表 ${t.table} 时出错`, { error: (e as Error).message });
            }
          }
        }
      }
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    const totalFound = results.reduce((sum, r) => sum + r.count, 0);

    if (willDelete) {
      await cacheService.del(CacheKeys.USER_GRAPHS(userId));
      logger.info('用户数据重置完成', { userId, totalDeleted, tablesProcessed: results.length });
    }

    return {
      success: true,
      mode: isDryRun ? 'dry_run' : (willDelete ? 'deleted' : 'preview'),
      summary: {
        total_deleted: totalDeleted,
        total_found: totalFound,
        tables: results.map(r => ({
          table: r.table,
          count: r.count,
          deleted: r.deleted,
          ...(r.error ? { error: r.error } : {}),
        })),
      },
    };
  }
}

export const dataService = new DataService();
