import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { getSupabaseAdmin } from '../../supabase';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { cacheService, CacheKeys } from './cacheService';
import type { Database } from '@shared/types/database.generated';
import { asyncTaskService } from '../asyncTaskService';
import type {
  BackupData,
  BackupLegacyNodeItem,
  RestoreStats,
} from './backupService';

type Tables = Database['public']['Tables'];
type RowOf<T extends keyof Tables> = Tables[T]['Row'];

type IdMap = Map<string, string>;

function mapId(id: string | null | undefined, map: IdMap): string | null {
  if (!id) return null;
  return map.get(id) ?? null;
}

function mapIdList(ids: string[] | null | undefined, map: IdMap): string[] {
  if (!ids) return [];
  const out: string[] = [];
  for (const id of ids) {
    const mapped = map.get(id);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** 批量插入封装：空列表直接跳过；失败返回 error，由调用方决定是否抛错 */
async function batchInsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<{ error: { message: string } | null }> {
  if (rows.length === 0) return { error: null };
  const { error } = await supabase.from(table).insert(rows);
  return { error };
}

/** 统一执行批量插入并累计统计；'nodes' 由图谱节点恢复块单独写入，此处不覆盖 */
async function restoreBatch(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  stats: Record<string, number>,
  statKey: string,
  label: string,
): Promise<void> {
  const { error } = await batchInsert(supabase, table, rows);
  if (error) {
    logger.warn(`Failed to restore ${label}:`, error);
    return;
  }
  if (statKey !== '_' && statKey !== 'nodes') {
    stats[statKey] = rows.length;
  }
}

/**
 * 备份恢复服务：负责把备份数据整体写回数据库。
 * 从 backupService 中拆出，聚焦「恢复 + 导入」职责，保持对外方法签名不变。
 */
export class BackupRestoreService {
  /** replace 模式：按 FK 依赖顺序（子表在前）清空当前用户的全部个人数据 */
  async deleteAllUserData(supabase: SupabaseClient, userId: string): Promise<void> {
    // 使用服务角色客户端执行硬删除，绕过 RLS 对 DELETE 的拦截（普通用户客户端可能只有 UPDATE/软删权限）
    const db = getSupabaseAdmin() ?? supabase;

    // 子表/无 user_id 列的表需通过父表 ID 清空，父表按序删除
    const { data: taskIds } = await db.from('user_tasks').select('id').eq('user_id', userId);
    const taskIdList = (taskIds as { id: string }[] | null)?.map((t) => t.id) ?? [];
    const { data: noteIds } = await db.from('notes').select('id').eq('user_id', userId);
    const noteIdList = (noteIds as { id: string }[] | null)?.map((n) => n.id) ?? [];
    const { data: pathIds } = await db.from('learning_paths').select('id').eq('user_id', userId);
    const pathIdList = (pathIds as { id: string }[] | null)?.map((p) => p.id) ?? [];
    const { data: agentIds } = await db.from('agent_sessions').select('id').eq('user_id', userId);
    const agentIdList = (agentIds as { id: string }[] | null)?.map((s) => s.id) ?? [];
    const { data: quizSetIds } = await db.from('quiz_sets').select('id').eq('user_id', userId);
    const quizSetIdList = (quizSetIds as { id: string }[] | null)?.map((q) => q.id) ?? [];

    const run = async (table: string, ids: string[], column = 'id') => {
      if (ids.length === 0) return;
      const { error } = await db.from(table).delete().in(column, ids);
      if (error) logger.warn(`Failed to clear ${table}:`, error);
    };

    // agent 相关（子表）
    await run('agent_pending_actions', agentIdList, 'session_id');
    await run('agent_tool_calls', agentIdList, 'session_id');
    await run('agent_messages', agentIdList, 'session_id');
    await run('agent_sessions', agentIdList);
    // 学习会话（子表）
    const { data: sessionIds } = await db.from('learning_sessions').select('id').eq('user_id', userId);
    const sessionIdList = (sessionIds as { id: string }[] | null)?.map((s) => s.id) ?? [];
    await run('learning_session_results', sessionIdList, 'session_id');
    await run('learning_sessions', sessionIdList);
    // 测验
    await run('quiz_set_cards', quizSetIdList, 'quiz_set_id');
    await run('quiz_sets', quizSetIdList);
    // 笔记（子表）
    await run('note_block_refs', noteIdList, 'source_note_id');
    await run('note_node_links', noteIdList, 'note_id');
    await run('notes', noteIdList);
    await db.from('note_templates').delete().eq('user_id', userId);
    // 学习路径（子表）
    const { data: pathNodeIds } = await db.from('learning_path_nodes').select('id').in('path_id', pathIdList);
    const pathNodeIdList = (pathNodeIds as { id: string }[] | null)?.map((n) => n.id) ?? [];
    await run('learning_path_prerequisites', pathNodeIdList, 'path_node_id');
    await run('learning_path_progress', pathIdList, 'path_id');
    await run('path_node_tasks', pathIdList, 'path_id');
    await run('learning_path_nodes', pathIdList, 'path_id');
    await run('learning_paths', pathIdList);
    await db.from('learning_loops').delete().eq('user_id', userId);
    // 任务（子表）
    await run('task_dependencies', taskIdList, 'task_id');
    await run('task_progress_plans', taskIdList, 'task_id');
    await run('task_subtasks', taskIdList, 'task_id');
    await run('task_links', taskIdList, 'task_id');
    await run('task_knowledge_points', taskIdList, 'task_id');
    await run('task_schedules', taskIdList, 'task_template_id');
    await run('task_reviews', taskIdList, 'task_id');
    await db.from('task_executions').delete().eq('user_id', userId);
    await run('user_tasks', taskIdList);
    await db.from('queues').delete().eq('user_id', userId);
    await db.from('task_tags').delete().eq('user_id', userId);
    await db.from('task_settings').delete().eq('user_id', userId);
    await db.from('user_time_slots').delete().eq('user_id', userId);
    await db.from('scheduler_weight_profiles').delete().eq('user_id', userId);
    await db.from('task_templates').delete().eq('user_id', userId);
    // 学习卡片/进度
    await db.from('study_cards').delete().eq('user_id', userId);
    await db.from('study_progress').delete().eq('user_id', userId);
    // 专注/效率
    await db.from('focus_sessions').delete().eq('user_id', userId);
    await db.from('user_efficiency_profile').delete().eq('user_id', userId);
    await db.from('user_focus_stats').delete().eq('user_id', userId);
    // 成就/周期任务
    await db.from('user_achievements').delete().eq('user_id', userId);
    const { data: passIds } = await db.from('periodic_passes').select('id').eq('user_id', userId);
    const passIdList = (passIds as { id: string }[] | null)?.map((p) => p.id) ?? [];
    await run('user_pass_progress', passIdList, 'pass_id');
    await db.from('periodic_passes').delete().eq('user_id', userId);
    await db.from('periodic_tasks').delete().eq('user_id', userId);
    // 领域/关系类型/插件/配置
    await db.from('domains').delete().eq('user_id', userId);
    await db.from('relationship_types').delete().eq('user_id', userId);
    await db.from('installed_plugins').delete().eq('user_id', userId);
    await db.from('notification_settings').delete().eq('user_id', userId);
    // 图谱及其全部子表：按 user_id 直接删主表，利用 ON DELETE CASCADE 级联清理
    // edges/graph_nodes/graph_events/graph_snapshots/literature_sources/graph_domains/graph_relations/graph_backbone_modules/knowledge_graph_contents/graph_collaborators 等，
    // 避免逐表 .in(大量 id) 导致 PostgREST URL 过长（URI too long）
    await db.from('learning_material_schemas').delete().eq('user_id', userId);
    await db.from('knowledge_graphs').delete().eq('user_id', userId);
    // 知识点及其子表（knowledge_point_versions/document_chunks 等）按 owner_id 级联清理
    await db.from('knowledge_points').delete().eq('owner_id', userId);
  }

  async restoreBackupData(
    supabase: SupabaseClient,
    userId: string,
    data: BackupData["data"],
  ): Promise<RestoreStats> {
    const stats: RestoreStats = {
      graphs: 0,
      nodes: 0,
      edges: 0,
      study_cards: 0,
      study_progress: 0,
      focus_sessions: 0,
      user_achievements: 0,
      periodic_tasks: 0,
      backbone_modules: 0,
      notes: 0,
      user_tasks: 0,
      learning_paths: 0,
      quiz_sets: 0,
      agent_sessions: 0,
      literature_sources: 0,
    };

    const domainMap: IdMap = new Map();
    const graphMap: IdMap = new Map();
    const kpMap: IdMap = new Map();
    const gnMap: IdMap = new Map();
    const snapshotMap: IdMap = new Map();
    const queueMap: IdMap = new Map();
    const taskMap: IdMap = new Map();
    const subtaskMap: IdMap = new Map();
    const pathMap: IdMap = new Map();
    const pathNodeMap: IdMap = new Map();
    const noteTemplateMap: IdMap = new Map();
    const noteMap: IdMap = new Map();
    const quizSetMap: IdMap = new Map();
    const cardMap: IdMap = new Map();
    const learningSessionMap: IdMap = new Map();
    const passMap: IdMap = new Map();
    const agentSessionMap: IdMap = new Map();

    // ---------- 1. 领域（含父级重映射） ----------
    const domains = data.domains ?? [];
    if (domains.length > 0) {
      const { data: insertedDomains, error: domainsError } = await supabase
        .from('domains')
        .insert(domains.map((d) => ({ ...d, id: randomUUID(), user_id: userId })))
        .select('id');
      if (domainsError) {
        logger.warn('Failed to restore domains:', domainsError);
      } else {
        (insertedDomains ?? []).forEach((d, i) => {
          domainMap.set(domains[i].id, d.id);
        });
        const links = domains
          .map((d, i) => {
            const newId = (insertedDomains as { id: string }[] | null)?.[i]?.id;
            const newParentId = d.parent_id ? mapId(d.parent_id, domainMap) : null;
            if (!newId || !newParentId) return null;
            return { id: newId, parent_id: newParentId };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        for (const link of links) {
          await supabase.from('domains').update({ parent_id: link.parent_id }).eq('id', link.id);
        }
      }
    }

    // ---------- 2. 用户自定义关系类型 ----------
    await restoreBatch(
      supabase,
      'relationship_types',
      (data.relationship_types ?? []).map((rt) => ({ ...rt, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'relationship_types',
    );

    // ---------- 3. 图谱 + contents ----------
    const graphs = data.graphs ?? [];
    if (graphs.length > 0) {
      // task_id 关联 user_tasks（不随备份导出），仅当对应任务仍存在时保留关联，避免外键冲突
      const { data: existingTasks } = await supabase
        .from('user_tasks')
        .select('id')
        .eq('user_id', userId);
      const validTaskIds = new Set((existingTasks ?? []).map((t: { id: string }) => t.id));

      const graphsToInsert = graphs.map((g) => {
        const {
          id: _id,
          task_id,
          parent_graph_id: _parentGraphId,
          // 以下为导出时从 knowledge_graph_contents 扁平化的字段，不属于 knowledge_graphs 列，插入前必须剔除
          podcast_script: _podcastScript,
          reference_books: _referenceBooks,
          external_links: _externalLinks,
          learning_guide: _learningGuide,
          ...rest
        } = g;
        return {
          ...rest,
          user_id: userId,
          parent_graph_id: null,
          // 分支来源快照依赖后续 graph_snapshots 恢复，先置空避免外键冲突，恢复后重映射
          branch_source_snapshot_id: null,
          task_id: task_id && validTaskIds.has(task_id) ? task_id : null,
        };
      });

      const { data: insertedGraphs, error: graphsError } = await supabase
        .from('knowledge_graphs')
        .insert(graphsToInsert)
        .select('id');

      if (graphsError) throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { message: `导入图谱失败: ${graphsError.message}` });

      (insertedGraphs ?? []).forEach((g, i) => {
        graphMap.set(graphs[i].id, g.id);
      });
      stats.graphs = insertedGraphs?.length || 0;

      // 恢复图谱分支关系：parent_graph_id 需重映射到新 ID（子表可能先于父表插入，故置后批量更新）
      const parentLinks = graphs
        .map((g, i) => {
          const newId = (insertedGraphs as { id: string }[] | null)?.[i]?.id;
          const newParentId = g.parent_graph_id ? mapId(g.parent_graph_id, graphMap) : null;
          if (!newId || !newParentId) return null;
          return { id: newId, parent_graph_id: newParentId };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      for (const link of parentLinks) {
        await supabase
          .from('knowledge_graphs')
          .update({ parent_graph_id: link.parent_graph_id })
          .eq('id', link.id);
      }

      // 同步导入 knowledge_graph_contents 记录（1:1 子表）
      const contentsToInsert = graphs
        .map((g, i) => {
          const newGraphId = (insertedGraphs as { id: string }[] | null)?.[i]?.id;
          if (!newGraphId) return null;
          return {
            graph_id: newGraphId,
            podcast_script: g.podcast_script ?? null,
            reference_books: g.reference_books ?? null,
            external_links: g.external_links ?? null,
            learning_guide: g.learning_guide ?? null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (contentsToInsert.length > 0) {
        const { error: contentError } = await supabase
          .from('knowledge_graph_contents')
          .insert(contentsToInsert);
        if (contentError) {
          logger.warn('Failed to restore knowledge_graph_contents:', contentError);
        }
      }
    }

    // ---------- 4. 知识点（兼容新旧格式） ----------
    const hasNewNodeFormat = Array.isArray(data.knowledge_points) || Array.isArray(data.graph_nodes);
    const kpList: RowOf<'knowledge_points'>[] = hasNewNodeFormat
      ? (data.knowledge_points ?? [])
      : ((data.nodes ?? []) as BackupLegacyNodeItem[]).map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content ?? '',
          summary: n.summary ?? null,
          learning_material: n.learning_material ?? null,
          properties: (n.properties as Record<string, unknown> | null) ?? {},
          keywords: (n.keywords as Record<string, unknown>[] | null) ?? {},
          aliases: n.aliases ?? [],
          visibility: 'private',
          owner_id: userId,
          mastery_level: n.mastery_level ?? 0,
          last_study_at: n.last_study_at ?? null,
          total_study_duration: n.total_study_duration ?? 0,
          created_at: n.created_at,
          updated_at: n.updated_at,
        } as RowOf<'knowledge_points'>));

    if (kpList.length > 0) {
      const kpsToInsert = kpList.map((kp) => ({
        title: kp.title,
        content: kp.content ?? null,
        summary: kp.summary ?? null,
        learning_material: kp.learning_material ?? null,
        keywords: kp.keywords ?? {},
        aliases: kp.aliases ?? [],
        properties: kp.properties ?? {},
        visibility: kp.visibility ?? 'private',
        owner_id: userId,
        mastery_level: kp.mastery_level ?? 0,
        last_study_at: kp.last_study_at ?? null,
        total_study_duration: kp.total_study_duration ?? 0,
        source_knowledge_point_id: null,
      }));

      const { data: insertedKps, error: kpError } = await supabase
        .from('knowledge_points')
        .insert(kpsToInsert)
        .select('id');

      if (kpError) {
        logger.warn('Failed to restore knowledge points:', kpError);
      } else {
        (insertedKps ?? []).forEach((kp, i) => {
          kpMap.set(kpList[i].id, kp.id);
        });

        // 分支副本来源重映射
        const sourceLinks = kpList
          .map((kp, i) => {
            const newId = (insertedKps as { id: string }[] | null)?.[i]?.id;
            const newSourceId = kp.source_knowledge_point_id ? mapId(kp.source_knowledge_point_id, kpMap) : null;
            if (!newId || !newSourceId) return null;
            return { id: newId, source_knowledge_point_id: newSourceId };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        for (const link of sourceLinks) {
          await supabase.from('knowledge_points').update({ source_knowledge_point_id: link.source_knowledge_point_id }).eq('id', link.id);
        }
      }
    }

    // ---------- 5. 知识点版本历史 ----------
    // 用 upsert-ignore 处理唯一键 (knowledge_point_id, version_number)：快照内如存在重复版本号则跳过而非整批失败
    const kpVersions = (data.knowledge_point_versions ?? [])
      .map((v) => {
        const kpId = mapId(v.knowledge_point_id, kpMap);
        if (!kpId) return null;
        return { ...v, id: randomUUID(), knowledge_point_id: kpId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (kpVersions.length > 0) {
      const { error } = await supabase
        .from('knowledge_point_versions')
        .upsert(kpVersions, { onConflict: 'knowledge_point_id,version_number', ignoreDuplicates: true });
      if (error) {
        logger.warn('Failed to restore knowledge_point_versions:', error);
      }
    }

    // ---------- 6. 图谱节点（兼容新旧格式） ----------
    const gnList: RowOf<'graph_nodes'>[] = hasNewNodeFormat
      ? (data.graph_nodes ?? [])
      : ((data.nodes ?? []) as BackupLegacyNodeItem[]).map((n) => ({
          graph_id: n.graph_id,
          knowledge_point_id: n.id,
          x_position: n.x_position ?? 0,
          y_position: n.y_position ?? 0,
          level: n.level ?? 'normal',
          is_accepted: n.is_accepted ?? true,
          created_at: n.created_at,
          updated_at: n.updated_at,
        } as RowOf<'graph_nodes'>));

    const graphNodesToInsert = gnList
      .map((n) => {
        const graphId = mapId(n.graph_id, graphMap);
        const kpId = mapId(n.knowledge_point_id, kpMap);
        if (!graphId || !kpId) return null;
        return {
          graph_id: graphId,
          knowledge_point_id: kpId,
          x_position: n.x_position ?? 0,
          y_position: n.y_position ?? 0,
          level: n.level ?? 'normal',
          is_accepted: n.is_accepted ?? true,
          created_at: n.created_at,
          updated_at: n.updated_at,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (graphNodesToInsert.length > 0) {
      const { data: insertedGns, error: gnError } = await supabase
        .from('graph_nodes')
        .insert(graphNodesToInsert)
        .select('id');
      if (gnError) {
        logger.warn('Failed to restore graph nodes:', gnError);
      } else {
        (insertedGns ?? []).forEach((gn, i) => {
          gnMap.set(gnList[i].id, gn.id);
        });
        stats.nodes = graphNodesToInsert.length;
      }
    }

    // ---------- 7. 边 ----------
    const edgesToInsert = (data.edges ?? [])
      .map((e) => {
        const graphId = mapId(e.graph_id, graphMap);
        const sourceKPId = mapId(e.source_knowledge_point_id, kpMap);
        const targetKPId = mapId(e.target_knowledge_point_id, kpMap);
        if (!graphId || !sourceKPId || !targetKPId) return null;
        return {
          graph_id: graphId,
          source_knowledge_point_id: sourceKPId,
          target_knowledge_point_id: targetKPId,
          relationship_type: e.relationship_type || 'contains',
          weight: e.weight ?? 1,
          custom_label: e.custom_label ?? null,
          custom_color: e.custom_color ?? null,
          custom_line_style: e.custom_line_style ?? null,
          show_arrow: e.show_arrow ?? null,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    await restoreBatch(supabase, 'edges', edgesToInsert, stats as unknown as Record<string, number>, 'edges', 'edges');

    // ---------- 8. 骨干模块（兼容旧版 backbone_modules 键） ----------
    const legacyBackbone = (data as BackupData['data'] & { backbone_modules?: RowOf<'graph_backbone_modules'>[] }).backbone_modules ?? [];
    const backboneSource = (data.graph_backbone_modules ?? []).length > 0 ? data.graph_backbone_modules : legacyBackbone;
    const backboneModules = backboneSource
      .map((bm) => {
        const graphId = mapId(bm.graph_id, graphMap);
        if (!graphId) return null;
        return { ...bm, id: randomUUID(), graph_id: graphId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'graph_backbone_modules', backboneModules, stats as unknown as Record<string, number>, 'backbone_modules', 'backbone modules');

    // ---------- 9. 图谱版本快照 ----------
    const snapshots = (data.graph_snapshots ?? [])
      .map((s) => {
        const graphId = mapId(s.graph_id, graphMap);
        if (!graphId) return null;
        return { ...s, id: randomUUID(), graph_id: graphId, operator_id: userId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (snapshots.length > 0) {
      const { data: insertedSnapshots, error: snapError } = await supabase
        .from('graph_snapshots')
        .insert(snapshots)
        .select('id');
      if (snapError) {
        logger.warn('Failed to restore graph snapshots:', snapError);
      } else {
        (insertedSnapshots ?? []).forEach((s, i) => {
          snapshotMap.set((data.graph_snapshots ?? [])[i].id, s.id);
        });
      }
    }

    // 分支图谱来源快照重映射（快照已恢复，branch_source_snapshot_id 此前暂置空）
    const branchLinks = graphs
      .map((g) => {
        const newId = graphMap.get(g.id);
        const newSnapshotId = g.branch_source_snapshot_id ? mapId(g.branch_source_snapshot_id, snapshotMap) : null;
        if (!newId || !newSnapshotId) return null;
        return { id: newId, branch_source_snapshot_id: newSnapshotId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    for (const link of branchLinks) {
      await supabase.from('knowledge_graphs').update({ branch_source_snapshot_id: link.branch_source_snapshot_id }).eq('id', link.id);
    }

    // ---------- 10. 图谱事件 ----------
    const events = (data.graph_events ?? [])
      .map((ev) => {
        const graphId = mapId(ev.graph_id, graphMap);
        if (!graphId) return null;
        return {
          ...ev,
          id: randomUUID(),
          graph_id: graphId,
          operator_id: userId,
          snapshot_id: ev.snapshot_id ? mapId(ev.snapshot_id, snapshotMap) : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'graph_events', events, stats as unknown as Record<string, number>, 'nodes', 'graph_events');

    // ---------- 11. 文献来源 ----------
    const literature = (data.literature_sources ?? [])
      .map((ls) => {
        const graphId = mapId(ls.graph_id, graphMap);
        if (!graphId) return null;
        return { ...ls, id: randomUUID(), graph_id: graphId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'literature_sources', literature, stats as unknown as Record<string, number>, 'literature_sources', 'literature sources');

    // ---------- 12. 图谱-领域关联 ----------
    const graphDomains = (data.graph_domains ?? [])
      .map((gd) => {
        const graphId = mapId(gd.graph_id, graphMap);
        const domainId = mapId(gd.domain_id, domainMap);
        if (!graphId || !domainId) return null;
        return { id: randomUUID(), graph_id: graphId, domain_id: domainId, is_primary: gd.is_primary ?? false };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'graph_domains', graphDomains, stats as unknown as Record<string, number>, 'nodes', 'graph_domains');

    // ---------- 13. 图谱关系 ----------
    const graphRelations = (data.graph_relations ?? [])
      .map((gr) => {
        const sourceId = mapId(gr.source_graph_id, graphMap);
        const targetId = mapId(gr.target_graph_id, graphMap);
        if (!sourceId || !targetId) return null;
        return { ...gr, id: randomUUID(), source_graph_id: sourceId, target_graph_id: targetId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'graph_relations', graphRelations, stats as unknown as Record<string, number>, 'nodes', 'graph_relations');

    // ---------- 14. 学习路径 ----------
    const learningPaths = (data.learning_paths ?? [])
      .map((p) => {
        const sourceGraphId = p.source_graph_id ? mapId(p.source_graph_id, graphMap) : null;
        const domainId = p.domain_id ? mapId(p.domain_id, domainMap) : null;
        return { ...p, id: randomUUID(), user_id: userId, source_graph_id: sourceGraphId, domain_id: domainId };
      });
    if (learningPaths.length > 0) {
      const { data: insertedPaths, error: pathsError } = await supabase
        .from('learning_paths')
        .insert(learningPaths)
        .select('id');
      if (pathsError) {
        logger.warn('Failed to restore learning paths:', pathsError);
      } else {
        (insertedPaths ?? []).forEach((p, i) => {
          pathMap.set((data.learning_paths ?? [])[i].id, p.id);
        });
        stats.learning_paths = learningPaths.length;
      }
    }

    // ---------- 15. 学习路径节点 ----------
    const pathNodes = (data.learning_path_nodes ?? [])
      .map((pn) => {
        const pathId = mapId(pn.path_id, pathMap);
        const kpId = pn.knowledge_point_id ? mapId(pn.knowledge_point_id, kpMap) : null;
        const graphId = pn.graph_id ? mapId(pn.graph_id, graphMap) : null;
        if (!pathId) return null;
        return { ...pn, id: randomUUID(), path_id: pathId, knowledge_point_id: kpId, graph_id: graphId, prerequisites: [] };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (pathNodes.length > 0) {
      const { data: insertedPathNodes, error: pathNodesError } = await supabase
        .from('learning_path_nodes')
        .insert(pathNodes)
        .select('id');
      if (pathNodesError) {
        logger.warn('Failed to restore learning path nodes:', pathNodesError);
      } else {
        (insertedPathNodes ?? []).forEach((pn, i) => {
          pathNodeMap.set((data.learning_path_nodes ?? [])[i].id, pn.id);
        });
      }
    }

    // ---------- 16. 学习路径前置依赖 ----------
    const pathPrereqs = (data.learning_path_prerequisites ?? [])
      .map((pr) => {
        const nodeId = mapId(pr.path_node_id, pathNodeMap);
        const prereqId = mapId(pr.prerequisite_node_id, pathNodeMap);
        if (!nodeId || !prereqId) return null;
        return { id: randomUUID(), path_node_id: nodeId, prerequisite_node_id: prereqId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'learning_path_prerequisites', pathPrereqs, stats as unknown as Record<string, number>, 'nodes', 'learning_path_prerequisites');

    // ---------- 17. 学习路径进度 ----------
    const pathProgress = (data.learning_path_progress ?? [])
      .map((pp) => {
        const pathId = mapId(pp.path_id, pathMap);
        const nodeId = mapId(pp.node_id, pathNodeMap);
        if (!pathId || !nodeId) return null;
        return { ...pp, id: randomUUID(), user_id: userId, path_id: pathId, node_id: nodeId, planned_nodes: mapIdList(pp.planned_nodes, pathNodeMap) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'learning_path_progress', pathProgress, stats as unknown as Record<string, number>, '_', 'learning_path_progress');

    // ---------- 18. 学习循环 ----------
    const learningLoops = (data.learning_loops ?? [])
      .map((ll) => {
        const kpId = ll.knowledge_point_id ? mapId(ll.knowledge_point_id, kpMap) : null;
        const graphId = ll.graph_id ? mapId(ll.graph_id, graphMap) : null;
        return { ...ll, id: randomUUID(), user_id: userId, knowledge_point_id: kpId, graph_id: graphId };
      });
    await restoreBatch(supabase, 'learning_loops', learningLoops, stats as unknown as Record<string, number>, 'nodes', 'learning_loops');

    // ---------- 20. 队列 ----------
    const queues = (data.queues ?? [])
      .map((q) => ({ ...q, id: randomUUID(), user_id: userId }));
    if (queues.length > 0) {
      const { data: insertedQueues, error: queuesError } = await supabase
        .from('queues')
        .insert(queues)
        .select('id');
      if (queuesError) {
        logger.warn('Failed to restore queues:', queuesError);
      } else {
        (insertedQueues ?? []).forEach((q, i) => {
          queueMap.set((data.queues ?? [])[i].id, q.id);
        });
      }
    }

    // ---------- 21. 用户任务 ----------
    const tasks = (data.user_tasks ?? [])
      .map((t) => {
        const queueId = t.queue_id ? mapId(t.queue_id, queueMap) : null;
        const kpId = t.knowledge_point_id ? mapId(t.knowledge_point_id, kpMap) : null;
        const graphId = t.graph_id ? mapId(t.graph_id, graphMap) : null;
        return {
          ...t,
          id: randomUUID(),
          user_id: userId,
          queue_id: queueId,
          knowledge_point_id: kpId,
          graph_id: graphId,
          parent_task_id: null,
        };
      });
    if (tasks.length > 0) {
      const { data: insertedTasks, error: tasksError } = await supabase
        .from('user_tasks')
        .insert(tasks)
        .select('id');
      if (tasksError) {
        logger.warn('Failed to restore user tasks:', tasksError);
      } else {
        (insertedTasks ?? []).forEach((t, i) => {
          taskMap.set((data.user_tasks ?? [])[i].id, t.id);
        });
        stats.user_tasks = tasks.length;

        // 父任务重映射
        const parentLinks = (data.user_tasks ?? [])
          .map((t, i) => {
            const newId = (insertedTasks as { id: string }[] | null)?.[i]?.id;
            const newParentId = t.parent_task_id ? mapId(t.parent_task_id, taskMap) : null;
            if (!newId || !newParentId) return null;
            return { id: newId, parent_task_id: newParentId };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        for (const link of parentLinks) {
          await supabase.from('user_tasks').update({ parent_task_id: link.parent_task_id }).eq('id', link.id);
        }
      }
    }

    // 图谱 → 任务关联（task_id 在任务恢复后重映射）
    const graphTaskLinks = graphs
      .map((g) => {
        const newGraphId = graphMap.get(g.id);
        const newTaskId = g.task_id ? mapId(g.task_id, taskMap) : null;
        if (!newGraphId) return null;
        return { id: newGraphId, task_id: newTaskId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    for (const link of graphTaskLinks) {
      await supabase.from('knowledge_graphs').update({ task_id: link.task_id }).eq('id', link.id);
    }

    // ---------- 22. 路径节点任务关联（依赖 taskMap） ----------
    const pathNodeTasks = (data.path_node_tasks ?? [])
      .map((pnt) => {
        const pathId = mapId(pnt.path_id, pathMap);
        const nodeId = mapId(pnt.node_id, pathNodeMap);
        const taskId = mapId(pnt.task_id, taskMap);
        if (!pathId || !nodeId || !taskId) return null;
        return { id: randomUUID(), path_id: pathId, node_id: nodeId, task_id: taskId, user_id: userId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'path_node_tasks', pathNodeTasks, stats as unknown as Record<string, number>, '_', 'path_node_tasks');

    // ---------- 23. 任务子表 ----------
    const subtasks = (data.task_subtasks ?? [])
      .map((st) => {
        const taskId = mapId(st.task_id, taskMap);
        const kpId = mapId(st.knowledge_point_id, kpMap);
        if (!taskId || !kpId) return null;
        return { ...st, id: randomUUID(), task_id: taskId, knowledge_point_id: kpId, learning_path_node_id: null };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (subtasks.length > 0) {
      const { data: insertedSubtasks, error: subtasksError } = await supabase
        .from('task_subtasks')
        .insert(subtasks)
        .select('id');
      if (subtasksError) {
        logger.warn('Failed to restore task subtasks:', subtasksError);
      } else {
        (insertedSubtasks ?? []).forEach((st, i) => {
          subtaskMap.set((data.task_subtasks ?? [])[i].id, st.id);
        });

        // learning_path_node_id 在路径节点恢复后重映射
        const pathNodeLinks = (data.task_subtasks ?? [])
          .map((st, i) => {
            const newId = (insertedSubtasks as { id: string }[] | null)?.[i]?.id;
            const newPathNodeId = st.learning_path_node_id ? mapId(st.learning_path_node_id, pathNodeMap) : null;
            if (!newId || !newPathNodeId) return null;
            return { id: newId, learning_path_node_id: newPathNodeId };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        for (const link of pathNodeLinks) {
          await supabase.from('task_subtasks').update({ learning_path_node_id: link.learning_path_node_id }).eq('id', link.id);
        }
      }
    }

    await restoreBatch(
      supabase,
      'task_tags',
      (data.task_tags ?? []).map((t) => ({ ...t, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'task_tags',
    );
    await restoreBatch(
      supabase,
      'task_settings',
      (data.task_settings ?? []).map((t) => ({ ...t, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'task_settings',
    );
    const taskDependencies = (data.task_dependencies ?? [])
      .map((td) => {
        const taskId = mapId(td.task_id, taskMap);
        const dependsOnId = mapId(td.depends_on_task_id, taskMap);
        if (!taskId || !dependsOnId) return null;
        return { ...td, id: randomUUID(), task_id: taskId, depends_on_task_id: dependsOnId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'task_dependencies', taskDependencies, stats as unknown as Record<string, number>, 'nodes', 'task_dependencies');
    const taskSchedules = (data.task_schedules ?? [])
      .map((ts) => {
        const templateId = mapId(ts.task_template_id, taskMap);
        if (!templateId) return null;
        return { ...ts, id: randomUUID(), user_id: userId, task_template_id: templateId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'task_schedules', taskSchedules, stats as unknown as Record<string, number>, 'nodes', 'task_schedules');
    const taskProgressPlans = (data.task_progress_plans ?? [])
      .map((tp) => {
        const taskId = mapId(tp.task_id, taskMap);
        if (!taskId) return null;
        return { ...tp, id: randomUUID(), task_id: taskId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'task_progress_plans', taskProgressPlans, stats as unknown as Record<string, number>, 'nodes', 'task_progress_plans');
    await restoreBatch(
      supabase,
      'user_time_slots',
      (data.user_time_slots ?? []).map((t) => ({ ...t, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'user_time_slots',
    );
    const taskLinks = (data.task_links ?? [])
      .map((tl) => {
        const taskId = mapId(tl.task_id, taskMap);
        if (!taskId) return null;
        return { ...tl, id: randomUUID(), task_id: taskId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'task_links', taskLinks, stats as unknown as Record<string, number>, 'nodes', 'task_links');
    const taskKps = (data.task_knowledge_points ?? [])
      .map((tk) => {
        const taskId = mapId(tk.task_id, taskMap);
        const kpId = mapId(tk.knowledge_point_id, kpMap);
        if (!taskId || !kpId) return null;
        return { ...tk, id: randomUUID(), task_id: taskId, knowledge_point_id: kpId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'task_knowledge_points', taskKps, stats as unknown as Record<string, number>, 'nodes', 'task_knowledge_points');
    const taskReviews = (data.task_reviews ?? [])
      .map((tr) => {
        const taskId = tr.task_id ? mapId(tr.task_id, taskMap) : null;
        return { ...tr, id: randomUUID(), user_id: userId, task_id: taskId };
      });
    await restoreBatch(supabase, 'task_reviews', taskReviews, stats as unknown as Record<string, number>, 'nodes', 'task_reviews');
    await restoreBatch(
      supabase,
      'task_templates',
      (data.task_templates ?? []).map((t) => ({ ...t, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'task_templates',
    );
    await restoreBatch(
      supabase,
      'scheduler_weight_profiles',
      (data.scheduler_weight_profiles ?? []).map((s) => ({ ...s, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'scheduler_weight_profiles',
    );

    // ---------- 23. 测验 ----------
    const quizSets = (data.quiz_sets ?? [])
      .map((qs) => {
        const graphId = qs.graph_id ? mapId(qs.graph_id, graphMap) : null;
        return { ...qs, id: randomUUID(), user_id: userId, graph_id: graphId };
      });
    if (quizSets.length > 0) {
      const { data: insertedQuizSets, error: quizSetsError } = await supabase
        .from('quiz_sets')
        .insert(quizSets)
        .select('id');
      if (quizSetsError) {
        logger.warn('Failed to restore quiz sets:', quizSetsError);
      } else {
        (insertedQuizSets ?? []).forEach((qs, i) => {
          quizSetMap.set((data.quiz_sets ?? [])[i].id, qs.id);
        });
        stats.quiz_sets = quizSets.length;
      }
    }

    // ---------- 24. 学习卡片 ----------
    const cardsToInsert = (data.study_cards ?? [])
      .map((c) => {
        const graphId = c.graph_id ? mapId(c.graph_id, graphMap) : null;
        const kpId = c.knowledge_point_id ? mapId(c.knowledge_point_id, kpMap) : null;
        const quizSetId = c.quiz_set_id ? mapId(c.quiz_set_id, quizSetMap) : null;
        const sourceGraphId = c.source_graph_id ? mapId(c.source_graph_id, graphMap) : graphId;
        if (!graphId || !kpId) return null;
        return {
          user_id: userId,
          knowledge_point_id: kpId,
          graph_id: graphId,
          source_graph_id: sourceGraphId,
          question: c.question,
          answer: c.answer,
          explanation: c.explanation ?? null,
          card_type: c.card_type || 'qa',
          options: c.options ?? null,
          focus_topic: c.focus_topic ?? null,
          difficulty: c.difficulty ?? 1,
          last_reviewed: c.last_reviewed ?? null,
          next_review: c.next_review ?? new Date().toISOString(),
          review_count: c.review_count ?? 0,
          fsrs_state: c.fsrs_state || 'New',
          fsrs_stability: c.fsrs_stability ?? 0,
          fsrs_difficulty: c.fsrs_difficulty ?? 0,
          fsrs_elapsed_days: c.fsrs_elapsed_days ?? 0,
          fsrs_scheduled_days: c.fsrs_scheduled_days ?? 0,
          fsrs_retrievability: c.fsrs_retrievability ?? 0,
          fsrs_last_review: c.fsrs_last_review ?? null,
          last_rating: c.last_rating ?? null,
          quiz_set_id: quizSetId,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
    if (cardsToInsert.length > 0) {
      const { data: insertedCards, error: cardsError } = await supabase
        .from('study_cards')
        .insert(cardsToInsert)
        .select('id');
      if (cardsError) {
        logger.warn('Failed to restore study cards:', cardsError);
      } else {
        (insertedCards ?? []).forEach((card, i) => {
          cardMap.set((data.study_cards ?? [])[i].id, card.id);
        });
        stats.study_cards = cardsToInsert.length;
      }
    }

    // ---------- 25. 测验-卡片关联 ----------
    const quizSetCards = (data.quiz_set_cards ?? [])
      .map((qc) => {
        const quizSetId = mapId(qc.quiz_set_id, quizSetMap);
        const cardId = mapId(qc.card_id, cardMap);
        if (!quizSetId || !cardId) return null;
        return { id: randomUUID(), quiz_set_id: quizSetId, card_id: cardId, display_order: qc.display_order ?? 0 };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'quiz_set_cards', quizSetCards, stats as unknown as Record<string, number>, 'nodes', 'quiz_set_cards');

    // ---------- 26. 学习进度 ----------
    const progressToInsert = (data.study_progress ?? [])
      .map((sp) => {
        const graphId = mapId(sp.graph_id, graphMap);
        if (!graphId) return null;
        return {
          user_id: userId,
          graph_id: graphId,
          total_nodes: sp.total_nodes ?? 0,
          mastered_nodes: sp.mastered_nodes ?? 0,
          progress_percentage: sp.progress_percentage ?? 0,
          study_streak: sp.study_streak ?? 0,
        };
      })
      .filter((sp): sp is NonNullable<typeof sp> => sp !== null);
    await restoreBatch(supabase, 'study_progress', progressToInsert, stats as unknown as Record<string, number>, 'study_progress', 'study progress');

    // ---------- 27. 学习会话 ----------
    const learningSessions = (data.learning_sessions ?? [])
      .map((ls) => {
        const subtaskId = mapId(ls.subtask_id, subtaskMap);
        const kpId = mapId(ls.knowledge_point_id, kpMap);
        const quizSetId = ls.quiz_set_id ? mapId(ls.quiz_set_id, quizSetMap) : null;
        if (!subtaskId || !kpId) return null;
        return {
          ...ls,
          id: randomUUID(),
          user_id: userId,
          subtask_id: subtaskId,
          knowledge_point_id: kpId,
          quiz_set_id: quizSetId,
          card_ids: mapIdList(ls.card_ids, cardMap),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (learningSessions.length > 0) {
      const { data: insertedSessions, error: sessionsError } = await supabase
        .from('learning_sessions')
        .insert(learningSessions)
        .select('id');
      if (sessionsError) {
        logger.warn('Failed to restore learning sessions:', sessionsError);
      } else {
        (insertedSessions ?? []).forEach((ls, i) => {
          learningSessionMap.set((data.learning_sessions ?? [])[i].id, ls.id);
        });
      }
    }

    // ---------- 28. 会话答题结果 ----------
    const sessionResults = (data.learning_session_results ?? [])
      .map((lr) => {
        const sessionId = mapId(lr.session_id, learningSessionMap);
        const cardId = mapId(lr.card_id, cardMap);
        if (!sessionId || !cardId) return null;
        return { ...lr, id: randomUUID(), session_id: sessionId, card_id: cardId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'learning_session_results', sessionResults, stats as unknown as Record<string, number>, 'nodes', 'learning_session_results');

    // ---------- 29. 笔记模板 ----------
    const noteTemplates = (data.note_templates ?? [])
      .map((nt) => ({ ...nt, id: randomUUID(), user_id: userId }));
    if (noteTemplates.length > 0) {
      const { data: insertedNoteTemplates, error: noteTemplatesError } = await supabase
        .from('note_templates')
        .insert(noteTemplates)
        .select('id');
      if (noteTemplatesError) {
        logger.warn('Failed to restore note templates:', noteTemplatesError);
      } else {
        (insertedNoteTemplates ?? []).forEach((nt, i) => {
          noteTemplateMap.set((data.note_templates ?? [])[i].id, nt.id);
        });
      }
    }

    // ---------- 30. 笔记 ----------
    const notes = (data.notes ?? [])
      .map((n) => {
        const templateId = n.template_id ? mapId(n.template_id, noteTemplateMap) : null;
        return { ...n, id: randomUUID(), user_id: userId, template_id: templateId };
      });
    if (notes.length > 0) {
      const { data: insertedNotes, error: notesError } = await supabase
        .from('notes')
        .insert(notes)
        .select('id');
      if (notesError) {
        logger.warn('Failed to restore notes:', notesError);
      } else {
        (insertedNotes ?? []).forEach((n, i) => {
          noteMap.set((data.notes ?? [])[i].id, n.id);
        });
        stats.notes = notes.length;
      }
    }

    // ---------- 31. 笔记-节点挂载 ----------
    const noteNodeLinks = (data.note_node_links ?? [])
      .map((nl) => {
        const noteId = mapId(nl.note_id, noteMap);
        const nodeId = mapId(nl.node_id, gnMap);
        const graphId = mapId(nl.graph_id, graphMap);
        if (!noteId || !nodeId || !graphId) return null;
        return { id: randomUUID(), note_id: noteId, node_id: nodeId, graph_id: graphId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'note_node_links', noteNodeLinks, stats as unknown as Record<string, number>, 'nodes', 'note_node_links');

    // ---------- 32. 笔记块引用 ----------
    const noteBlockRefs = (data.note_block_refs ?? [])
      .map((br) => {
        const sourceNoteId = mapId(br.source_note_id, noteMap);
        const targetNoteId = mapId(br.target_note_id, noteMap);
        if (!sourceNoteId || !targetNoteId) return null;
        return { ...br, id: randomUUID(), source_note_id: sourceNoteId, target_note_id: targetNoteId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'note_block_refs', noteBlockRefs, stats as unknown as Record<string, number>, 'nodes', 'note_block_refs');

    // ---------- 33. 专注会话 ----------
    const sessionsToInsert = (data.focus_sessions ?? [])
      .map((fs) => ({
        user_id: userId,
        task_id: fs.task_id ? mapId(fs.task_id, taskMap) : null,
        started_at: fs.started_at || new Date().toISOString(),
        ended_at: fs.ended_at || new Date().toISOString(),
        duration: fs.duration || 0,
        mode: fs.mode || 'focus',
        completed: fs.completed ?? true,
        pomodoro_count: fs.pomodoro_count || 0,
        white_noise_type: fs.white_noise_type || null,
        is_break: fs.is_break || false,
      }));
    await restoreBatch(supabase, 'focus_sessions', sessionsToInsert, stats as unknown as Record<string, number>, 'focus_sessions', 'focus sessions');

    // ---------- 34. 用户效率画像 ----------
    await restoreBatch(
      supabase,
      'user_efficiency_profile',
      (data.user_efficiency_profile ?? []).map((p) => ({ ...p, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'user_efficiency_profile',
    );

    // ---------- 35. 成就 ----------
    // achievements 为全局只读表，其 id 在各环境是随机生成的；备份里引用的
    // achievement_id 可能在本环境不存在，需先过滤，否则整批 upsert 会因外键 23503 失败
    const adminDb = getSupabaseAdmin() ?? supabase;
    const { data: validAchievements } = await adminDb.from('achievements').select('id');
    const validAchievementIds = new Set(
      (validAchievements as { id: string }[] | null)?.map((a) => a.id) ?? [],
    );
    const achievementsToInsert = (data.user_achievements ?? [])
      .filter((ua) => ua.achievement_id != null && validAchievementIds.has(ua.achievement_id))
      .map((ua) => ({
        user_id: userId,
        achievement_id: ua.achievement_id as string,
        progress: ua.progress ?? 0,
        metadata: ua.metadata ?? {},
        unlocked_at: ua.unlocked_at ?? new Date().toISOString(),
      }));
    // 依赖非 id 的唯一键，需用 upsert-ignore 实现幂等，避免重复导入到已有数据时报唯一键冲突
    const { error: achError } = achievementsToInsert.length
      ? await supabase
          .from('user_achievements')
          .upsert(achievementsToInsert, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
      : { error: null };
    if (achError) {
      logger.warn('Failed to restore user achievements:', achError);
    } else {
      stats.user_achievements = achievementsToInsert.length;
    }

    // ---------- 36. 周期任务（全周期类型） ----------
    const periodicTasks = (data.periodic_tasks ?? [])
      .filter((pt) => pt.period_type != null && pt.period_start != null && pt.period_end != null && pt.task_type != null && pt.target != null)
      .map((pt) => ({
        user_id: userId,
        period_type: pt.period_type as string,
        period_start: pt.period_start as string,
        period_end: pt.period_end as string,
        task_type: pt.task_type as string,
        target: pt.target as number,
        progress: pt.progress ?? 0,
        status: pt.status ?? 'pending',
        xp_reward: pt.xp_reward ?? 0,
        pass_points: pt.pass_points ?? 10,
      }));
    // 依赖非 id 的唯一键，需用 upsert-ignore 实现幂等，避免重复导入到已有数据时报唯一键冲突
    const { error: ptError } = periodicTasks.length
      ? await supabase
          .from('periodic_tasks')
          .upsert(periodicTasks, { onConflict: 'user_id,period_type,period_start,task_type', ignoreDuplicates: true })
      : { error: null };
    if (ptError) {
      logger.warn('Failed to restore periodic tasks:', ptError);
    } else {
      stats.periodic_tasks = periodicTasks.length;
    }

    // ---------- 37. 通行证 ----------
    const periodicPasses = (data.periodic_passes ?? [])
      .map((pp) => ({ ...pp, id: randomUUID(), user_id: userId }));
    if (periodicPasses.length > 0) {
      const { data: insertedPasses, error: passesError } = await supabase
        .from('periodic_passes')
        .insert(periodicPasses)
        .select('id');
      if (passesError) {
        logger.warn('Failed to restore periodic passes:', passesError);
      } else {
        (insertedPasses ?? []).forEach((pp, i) => {
          passMap.set((data.periodic_passes ?? [])[i].id, pp.id);
        });
      }
    }

    const userPassProgress = (data.user_pass_progress ?? [])
      .map((up) => {
        const passId = mapId(up.pass_id, passMap);
        if (!passId) return null;
        return { ...up, id: randomUUID(), user_id: userId, pass_id: passId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'user_pass_progress', userPassProgress, stats as unknown as Record<string, number>, 'nodes', 'user_pass_progress');

    await restoreBatch(
      supabase,
      'user_focus_stats',
      (data.user_focus_stats ?? []).map((s) => ({ ...s, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'user_focus_stats',
    );

    // ---------- 38. Agent 会话 ----------
    const agentSessions = (data.agent_sessions ?? [])
      .map((as_) => ({
        ...as_,
        id: randomUUID(),
        user_id: userId,
        graph_ids: mapIdList(as_.graph_ids, graphMap),
      }));
    if (agentSessions.length > 0) {
      const { data: insertedAgentSessions, error: agentSessionsError } = await supabase
        .from('agent_sessions')
        .insert(agentSessions)
        .select('id');
      if (agentSessionsError) {
        logger.warn('Failed to restore agent sessions:', agentSessionsError);
      } else {
        (insertedAgentSessions ?? []).forEach((as_, i) => {
          agentSessionMap.set((data.agent_sessions ?? [])[i].id, as_.id);
        });
        stats.agent_sessions = agentSessions.length;
      }
    }

    const agentMessages = (data.agent_messages ?? [])
      .map((am) => {
        const sessionId = mapId(am.session_id, agentSessionMap);
        if (!sessionId) return null;
        return { ...am, id: randomUUID(), session_id: sessionId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'agent_messages', agentMessages, stats as unknown as Record<string, number>, 'nodes', 'agent_messages');

    const agentToolCalls = (data.agent_tool_calls ?? [])
      .map((at) => {
        const sessionId = mapId(at.session_id, agentSessionMap);
        if (!sessionId) return null;
        return { ...at, id: randomUUID(), session_id: sessionId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'agent_tool_calls', agentToolCalls, stats as unknown as Record<string, number>, 'nodes', 'agent_tool_calls');

    const agentPendingActions = (data.agent_pending_actions ?? [])
      .map((ap) => {
        const sessionId = mapId(ap.session_id, agentSessionMap);
        if (!sessionId) return null;
        return { ...ap, id: randomUUID(), session_id: sessionId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'agent_pending_actions', agentPendingActions, stats as unknown as Record<string, number>, 'nodes', 'agent_pending_actions');

    // ---------- 39. 已安装插件 ----------
    await restoreBatch(
      supabase,
      'installed_plugins',
      (data.installed_plugins ?? []).map((p) => ({ ...p, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'installed_plugins',
    );

    // ---------- 40. 学习材料章节配置 ----------
    const learningMaterialSchemas = (data.learning_material_schemas ?? [])
      .map((lms) => {
        const graphId = lms.graph_id ? mapId(lms.graph_id, graphMap) : null;
        // graph 作用域必须能映射到图谱，否则跳过避免约束冲突
        if (lms.scope === 'graph' && !graphId) return null;
        return { ...lms, id: randomUUID(), user_id: userId, graph_id: graphId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    await restoreBatch(supabase, 'learning_material_schemas', learningMaterialSchemas, stats as unknown as Record<string, number>, '_', 'learning_material_schemas');

    // ---------- 41. 通知设置 ----------
    await restoreBatch(
      supabase,
      'notification_settings',
      (data.notification_settings ?? []).map((n) => ({ ...n, id: randomUUID(), user_id: userId })),
      stats as unknown as Record<string, number>,
      'nodes',
      'notification_settings',
    );

    // 恢复完成后，自动后台补全缺失的 embedding（知识点 + 分块 + 图谱 + 笔记）：
    // 备份不存向量也不含 document_chunks/note_embeddings 表（避免体积膨胀/模型漂移），
    // 恢复后在线场景下全量重建（dense + sparse），使查重与语义/稀疏检索立即生效；
    // 离线/无 key 时该任务优雅降级（嵌入保持为 null），可用既有「补全缺失 embedding」任务稍后重跑。
    try {
      await asyncTaskService.createTask(
        userId,
        "embedding_generation",
        { scope: "all" },
        "恢复后补全缺失嵌入",
      );
      logger.info(
        `Enqueued embedding backfill after restore for user ${userId}`,
      );
    } catch (error) {
      logger.warn("Failed to enqueue embedding backfill after restore", error);
    }

    return stats;
  }

  async importBackup(
    supabase: SupabaseClient,
    userId: string,
    data: BackupData["data"],
    mode: string = "merge",
  ): Promise<{
    stats: Awaited<ReturnType<BackupRestoreService["restoreBackupData"]>>;
    mode: string;
  }> {
    if (mode === "replace") {
      await this.deleteAllUserData(supabase, userId);
    }

    const stats = await this.restoreBackupData(supabase, userId, data);

    // 导入会直接写库，绕过常规 mutation 事件，需手动失效该用户全部聚合缓存，避免后续读到旧数据
    await cacheService.del([
      CacheKeys.USER_GRAPHS(userId),
      CacheKeys.GRAPH_MAP(userId),
      CacheKeys.GRAPH_DOMAINS(userId),
      CacheKeys.GRAPH_TAGS(userId),
    ]);

    return { stats, mode };
  }
}

export const backupRestoreService = new BackupRestoreService();
