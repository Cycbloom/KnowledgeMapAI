import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { aiService } from '../ai/aiService';
import { domainContextService } from '../ai/domainContextService';
import { checkDuplicateGraphTopic } from '../../utils/similaritySearch';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import i18next from "i18next";
import { notDeleted } from '../common/softDeleteHelper';
import { cacheService, CacheKeys } from '../common/cacheService';
import { LONG_TIMEOUT } from '../../../shared/utils/retry';

class DomainExpansionService {
  async expandDomain(
    supabase: SupabaseClient,
    userId: string,
    options: {
      graph_ids?: string[];
      domain?: string;
      count?: number;
    },
  ): Promise<{
    recommendations: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    relations: Array<{
      from_title: string;
      to_title: string;
      type: 'prerequisite' | 'extension' | 'related';
      reason?: string;
    }>;
    source_graphs: Array<{
      id: string;
      title: string;
      description: string | null;
      domain: string | null;
    }>;
    target_domain?: { id: string; name: string };
    /** 未指定目标领域时，由 AI 从扩展内容推断的一个新领域名 */
    inferred_domain?: string;
  }> {
    const { graph_ids, domain, count = 10 } = options;

    try {
      const sourceGraphs: Array<{
        id: string;
        title: string;
        description: string | null;
        domain: string | null;
      }> = [];

      if (graph_ids && graph_ids.length > 0) {
        const { data: graphsById } = await notDeleted(supabase
          .from('knowledge_graphs')
          .select('id, title, description, domain')
          .eq('user_id', userId)
          .in('id', graph_ids)
          );

        if (graphsById) {
          sourceGraphs.push(...graphsById);
        }
      }

      if (domain && domain.trim()) {
        const { data: graphsByDomain } = await notDeleted(supabase
          .from('knowledge_graphs')
          .select('id, title, description, domain')
          .eq('user_id', userId)
          .ilike('domain', `%${domain.trim()}%`)
          );

        if (graphsByDomain) {
          const existingIds = new Set(sourceGraphs.map((g) => g.id));
          for (const g of graphsByDomain) {
            if (!existingIds.has(g.id)) {
              sourceGraphs.push(g);
            }
          }
        }
      }

      let targetDomainId: string | null = null;
      let targetDomainName: string | null = null;

      if (domain) {
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            domain,
          )
        ) {
          const { data: domainData } = await notDeleted(supabase
            .from('domains')
            .select('id, name')
            .eq('id', domain)
            )
            .single();

          if (domainData) {
            targetDomainId = domainData.id;
            targetDomainName = domainData.name;
          }
        } else {
          const { data: domainData } = await notDeleted(supabase
            .from('domains')
            .select('id, name')
            .eq('name', domain)
            .or(`user_id.eq.${userId},and(is_system.eq.true,user_id.is.null)`)
            )
            .maybeSingle();

          if (domainData) {
            targetDomainId = domainData.id;
            targetDomainName = domainData.name;
          }
        }
      }

      if (sourceGraphs.length === 0) {
        throw new AppError(i18next.t("graphMap.api.errors.graphOrDomainNotFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const { data: existingGraphs } = await notDeleted(supabase
        .from('knowledge_graphs')
        .select('id, title, description')
        .eq('user_id', userId)
        );

      const existingTitles = (existingGraphs || []).map((g) =>
        g.title.toLowerCase(),
      );

      // 预构建 Set，将循环内 existingTitles.includes 的 O(n) 线性扫描降为 has 的 O(1) 查询
      const existingTitlesSet = new Set(existingTitles);

      let domainContext = '';

      if (targetDomainId) {
        try {
          domainContext = await domainContextService.getDomainContext(
            supabase,
            targetDomainId,
            userId,
          );
          logger.info('扩展分析使用领域上下文', {
            domainId: targetDomainId,
            domainName: targetDomainName,
          });
        } catch (error) {
          logger.warn('获取扩展领域上下文失败', { error });
        }
      }

      const basePrompt = `你是知识图谱专家。基于用户已有的知识图谱，推荐相关的扩展学习内容。

${sourceGraphs.length > 0 ? `用户已有 ${sourceGraphs.length} 个图谱：\n${sourceGraphs.map((g, i) => `${i + 1}. ${g.title}${g.description ? ` - ${g.description}` : ''}`).join('\n')}` : ''}

${domainContext ? `\n[目标领域上下文 - ${targetDomainName}]\n${domainContext}\n[/目标领域上下文]` : ''}

${targetDomainName ? `\n请优先推荐与「${targetDomainName}」领域相关的扩展方向。` : ''}

请推荐 ${count} 个扩展知识图谱，并分析它们之间的学习依赖关系。
${!targetDomainName ? '\n（未指定目标领域。请在返回 JSON 中额外提供一个 "domain" 字段，用不超过12字的短语概括这批扩展内容所属的新领域，应与已有领域区分开。）' : ''}

要求：
1. 推荐与现有图谱相关的主题，帮助用户扩展知识体系
2. 分析推荐图谱之间的学习依赖关系（如：学A之前需要先学B）
3. **重要**：分析推荐图谱与现有图谱之间的关系（如：推荐图谱X是现有图谱Y的前置知识/扩展知识）
4. 优先级：high(核心扩展)/medium(重要扩展)/low(可选扩展)
5. 简述不超过60字

返回JSON格式：
{
  "graphs": [
    {"title": "主题名", "description": "简述", "priority": "high/medium/low"}
  ],
  "relations": [
    {"from": "主题A", "to": "主题B", "type": "prerequisite", "reason": "A是B的前置知识"}
  ],
  "domain": "可选的新领域名"
}

关系类型说明：
- prerequisite: from 是 to 的前置知识（学to之前需要先学from）
- extension: from 是 to 的扩展知识（学完to后可以学习from）
- related: from 和 to 相关但无直接依赖

**重要提示**：
- relations 中可以包含推荐图谱之间的关系
- 也可以包含推荐图谱与现有图谱之间的关系（from 或 to 可以是现有图谱的名称）
- 请尽可能多地建立推荐图谱与现有图谱之间的连接

已有图谱（不要重复推荐）：${existingTitles.length > 0 ? existingTitles.join('、') : '无'}`;

      const response = await aiService.chat(
        [
          {
            role: 'system',
            content:
              '你是一个知识图谱专家，擅长分析领域知识结构、推荐学习路径、识别知识点之间的依赖关系。请用中文回复。确保返回有效的JSON格式。',
          },
          { role: 'user', content: basePrompt },
        ],
        { timeout: LONG_TIMEOUT },
      );

      const recommendations: Array<{
        title: string;
        description: string;
        priority: 'high' | 'medium' | 'low';
      }> = [];

      let graphRelations: Array<{
        from_title: string;
        to_title: string;
        type: 'prerequisite' | 'extension' | 'related';
        reason?: string;
      }> = [];

      let inferredDomain: string | null = null;

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const graphs =
            parsed.graphs || parsed.list || parsed.recommendations || [];

          if (
            !targetDomainName &&
            typeof parsed.domain === 'string' &&
            parsed.domain.trim()
          ) {
            inferredDomain = parsed.domain.trim().slice(0, 12);
          }

          for (const item of graphs) {
            if (typeof item === 'string') {
              const parts = item.split('|');
              if (parts.length >= 3) {
                const [title, description, priority] = parts.map((s) =>
                  s.trim(),
                );
                if (title && !existingTitlesSet.has(title.toLowerCase())) {
                  recommendations.push({
                    title,
                    description: description || '',
                    priority: (['high', 'medium', 'low'].includes(priority)
                      ? priority
                      : 'medium') as 'high' | 'medium' | 'low',
                  });
                }
              }
            } else if (typeof item === 'object' && item.title) {
              if (!existingTitlesSet.has(item.title.toLowerCase())) {
                recommendations.push({
                  title: item.title,
                  description: item.description || '',
                  priority: item.priority || 'medium',
                });
              }
            }
          }

          const relations = parsed.relations || [];
          for (const rel of relations) {
            if (rel.from && rel.to && rel.type) {
              graphRelations.push({
                from_title: rel.from,
                to_title: rel.to,
                type: rel.type as 'prerequisite' | 'extension' | 'related',
                reason: rel.reason,
              });
            }
          }
        }
      } catch {
        logger.warn('Failed to parse domain expansion response as JSON');
      }

      const validTitles = new Set(
        recommendations.map((r) => r.title.toLowerCase()),
      );

      graphRelations = graphRelations.filter((rel) => {
        const fromLower = rel.from_title.toLowerCase();
        const toLower = rel.to_title.toLowerCase();
        const fromIsValid =
          validTitles.has(fromLower) || existingTitlesSet.has(fromLower);
        const toIsValid =
          validTitles.has(toLower) || existingTitlesSet.has(toLower);
        return fromIsValid && toIsValid;
      });

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      recommendations.sort((a, b) => {
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.title.localeCompare(b.title, 'zh-CN');
      });

      return {
        recommendations: recommendations.slice(0, count),
        relations: graphRelations,
        source_graphs: sourceGraphs,
        ...(targetDomainId && targetDomainName
          ? { target_domain: { id: targetDomainId, name: targetDomainName } }
          : {}),
        ...(inferredDomain ? { inferred_domain: inferredDomain } : {}),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '领域扩展失败';
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }

  async batchCreateDomainGraphs(
    supabase: SupabaseClient,
    userId: string,
    data: {
      graphs: Array<{ title: string; description?: string }>;
      domain?: string;
      domain_id?: string;
      relations?: Array<{
        from_title: string;
        to_title: string;
        type: 'prerequisite' | 'extension' | 'related';
        reason?: string;
      }>;
    },
  ): Promise<{
    created: Array<{ graphId: string; title: string; isNew: boolean }>;
    failed: Array<{
      title: string;
      error: string;
      reason: 'duplicate' | 'db_error' | 'invalid_data';
    }>;
    summary: { total: number; success: number; failed: number; skipped: number };
  }> {
    const { graphs, domain, domain_id, relations } = data;

    try {
      const results: Array<{
        graphId: string;
        title: string;
        isNew: boolean;
      }> = [];

      const failedItems: Array<{
        title: string;
        error: string;
        reason: 'duplicate' | 'db_error' | 'invalid_data';
      }> = [];

      const titleToIdMap = new Map<string, string>();

      let resolvedDomainId: string | null = null;
      let resolvedDomainName: string | null = null;

      if (domain_id) {
        const { data: existingDomain, error: domainError } = await supabase
          .from('domains')
          .select('id, name')
          .eq('id', domain_id)
          .maybeSingle();

        if (domainError) {
          logger.error('Failed to query domain by ID:', domainError);
        } else if (existingDomain) {
          resolvedDomainId = existingDomain.id;
          resolvedDomainName = existingDomain.name;
        }
      } else if (domain) {
        const { data: existingDomain, error: domainError } = await supabase
          .from('domains')
          .select('id, name')
          .eq('name', domain)
          .eq('user_id', userId)
          .maybeSingle();

        if (domainError) {
          logger.error('Failed to query domain by name:', domainError);
        } else if (existingDomain) {
          resolvedDomainId = existingDomain.id;
          resolvedDomainName = existingDomain.name;
        } else {
          const { data: newDomain, error: createDomainError } = await supabase
            .from('domains')
            .insert({
              name: domain,
              user_id: userId,
              color: '#6366F1',
            })
            .select('id, name')
            .single();

          if (createDomainError || !newDomain) {
            logger.warn('Failed to create domain:', createDomainError);
          } else {
            resolvedDomainId = newDomain.id;
            resolvedDomainName = newDomain.name;
          }
        }
      }

      const { data: allExistingGraphs, error: queryError } = await notDeleted(supabase
        .from('knowledge_graphs')
        .select('id, title')
        .eq('user_id', userId)
        );

      if (queryError) {
        logger.error('Failed to query existing graphs:', queryError);
        throw new AppError(i18next.t("graphMap.api.errors.queryGraphFailed"), 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }

      if (allExistingGraphs) {
        for (const g of allExistingGraphs) {
          titleToIdMap.set(g.title.toLowerCase(), g.id);
        }
      }

      for (const graphData of graphs) {
        try {
          if (!graphData.title || typeof graphData.title !== 'string') {
            throw new AppError(ErrorCodes.VALIDATION_ERROR, {
              message: `Invalid data: title is required and must be a string`,
            });
          }

          const duplicateCheck = await checkDuplicateGraphTopic(
            supabase,
            userId,
            graphData.title,
            { threshold: 0.85 },
          );

          if (
            duplicateCheck.isDuplicate &&
            duplicateCheck.similarGraphs.length > 0
          ) {
            const similarGraph = duplicateCheck.similarGraphs[0];
            results.push({
              graphId: similarGraph.id,
              title: similarGraph.title,
              isNew: false,
            });
            titleToIdMap.set(graphData.title.toLowerCase(), similarGraph.id);
          } else {
            const { data: newGraph, error: createError } = await supabase
              .from('knowledge_graphs')
              .insert({
                user_id: userId,
                title: graphData.title,
                description: graphData.description || '',
                domain: resolvedDomainName || null,
                embedding: duplicateCheck.embedding,
              })
              .select()
              .single();

            if (createError || !newGraph) {
              throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
                message: `Database error: ${createError?.message || 'Failed to create graph'}`,
              });
            }

            if (resolvedDomainId) {
              const { error: domainAssocError } = await supabase
                .from('graph_domains')
                .insert({
                  graph_id: newGraph.id,
                  domain_id: resolvedDomainId,
                  is_primary: true,
                });

              if (domainAssocError) {
                logger.warn('Failed to create graph_domains association:', {
                  graphId: newGraph.id,
                  domainId: resolvedDomainId,
                  error: domainAssocError.message,
                });
              }
            }

            results.push({
              graphId: newGraph.id,
              title: graphData.title,
              isNew: true,
            });
            titleToIdMap.set(graphData.title.toLowerCase(), newGraph.id);
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          let errorReason: 'duplicate' | 'db_error' | 'invalid_data';
          if (
            errorMessage.toLowerCase().includes('duplicate') ||
            errorMessage.toLowerCase().includes('similar')
          ) {
            errorReason = 'duplicate';
          } else if (
            errorMessage.toLowerCase().includes('database') ||
            errorMessage.toLowerCase().includes('db') ||
            errorMessage.toLowerCase().includes('insert') ||
            errorMessage.toLowerCase().includes('query')
          ) {
            errorReason = 'db_error';
          } else {
            errorReason = 'invalid_data';
          }

          failedItems.push({
            title: graphData.title || '(unknown)',
            error: errorMessage,
            reason: errorReason,
          });

          logger.warn(
            `Failed to process graph "${graphData.title}": ${errorMessage}`,
            { reason: errorReason },
          );

          continue;
        }
      }

      // 计算统计信息
      const successCount = results.length;
      const failedCount = failedItems.length;
      const skippedCount = results.filter((r) => !r.isNew).length;
      const totalCount = graphs.length;

      logger.info(`Batch create summary:`, {
        total: totalCount,
        success: successCount,
        failed: failedCount,
        skipped: skippedCount,
      });

      // 创建关系（带错误保护）
      if (relations && relations.length > 0) {
        try {
          logger.info(`Creating ${relations.length} relations between graphs`);

          const relationsToCreate: Array<{
            source_graph_id: string;
            target_graph_id: string;
            relation_type: string;
            context?: string;
          }> = [];

          const failedRelations: Array<{
            from_title: string;
            to_title: string;
            type: string;
            error: string;
          }> = [];

          for (const rel of relations) {
            try {
              const sourceId = titleToIdMap.get(rel.from_title.toLowerCase());
              const targetId = titleToIdMap.get(rel.to_title.toLowerCase());

              if (!sourceId || !targetId) {
                logger.warn(
                  `Skipping relation: graph not found - from: ${rel.from_title}, to: ${rel.to_title}`,
                );
                continue;
              }

              const { data: existingRelation, error: queryRelError } =
                await supabase
                  .from('graph_relations')
                  .select('id')
                  .eq('source_graph_id', sourceId)
                  .eq('target_graph_id', targetId)
                  .maybeSingle();

              if (queryRelError) {
                throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
                  message: `Query relation error: ${queryRelError.message}`,
                });
              }

              if (!existingRelation) {
                relationsToCreate.push({
                  source_graph_id: sourceId,
                  target_graph_id: targetId,
                  relation_type: rel.type,
                  context: rel.reason,
                });
                logger.info(
                  `Relation [${rel.type}]: ${rel.from_title} -> ${rel.to_title}${rel.reason ? ` (${rel.reason})` : ''}`,
                );
              } else {
                logger.info(
                  `Relation already exists: ${rel.from_title} -> ${rel.to_title}`,
                );
              }
            } catch (error: unknown) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              failedRelations.push({
                from_title: rel.from_title,
                to_title: rel.to_title,
                type: rel.type,
                error: errorMessage,
              });
              logger.error(
                `Failed to process relation [${rel.type}]: ${rel.from_title} -> ${rel.to_title}: ${errorMessage}`,
              );
              // 继续处理下一个关系
            }
          }

          if (failedRelations.length > 0) {
            logger.warn(
              `${failedRelations.length} relations failed to process`,
              { failedRelations },
            );
          }

          if (relationsToCreate.length > 0) {
            logger.info(
              `Inserting ${relationsToCreate.length} relations into graph_relations`,
            );
            const { error: relationError } = await supabase
              .from('graph_relations')
              .insert(relationsToCreate);

            if (relationError) {
              logger.error('Failed to create relations:', relationError);
            } else {
              logger.info(
                `Successfully created ${relationsToCreate.length} relations`,
              );
            }
          }
        } catch (error: unknown) {
          // 关系创建的整体错误不应该影响主响应
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Error during relation creation phase: ${errorMessage}`);
          // 不抛出错误，继续返回图谱创建结果
        }
      }

      try {
        await cacheService.del([
          CacheKeys.GRAPH_MAP(userId),
          CacheKeys.USER_GRAPHS(userId),
          CacheKeys.GRAPH_TAGS(userId),
          CacheKeys.GRAPH_DOMAINS(userId),
        ]);
      } catch (invalidateError: unknown) {
        logger.warn('Failed to invalidate graph map cache after batch create:', invalidateError);
      }

      return {
        created: results,
        failed: failedItems,
        summary: {
          total: totalCount,
          success: successCount,
          failed: failedCount,
          skipped: skippedCount,
        },
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '批量创建图谱失败';
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const domainExpansionService = new DomainExpansionService();
