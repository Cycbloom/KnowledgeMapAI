import { SupabaseClient } from '@supabase/supabase-js';
import { aiService } from '../ai/aiService';
import { domainContextService } from '../ai/domainContextService';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { notDeleted } from '../common/softDeleteHelper';

interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface GraphRelation {
  from_title: string;
  to_title: string;
  type: 'prerequisite' | 'extension' | 'related';
  reason?: string;
}

interface AnalyzeDomainResult {
  recommendations: Recommendation[];
  relations: GraphRelation[];
}

export class AnalysisRouteService {
  async analyzeDomain(
    supabase: SupabaseClient,
    userId: string,
    domain: string,
    count: number = 10,
    contextDomainId?: string,
    sessionId?: string,
  ): Promise<AnalyzeDomainResult> {
    try {
      const { data: existingGraphs } = await notDeleted(supabase
        .from('knowledge_graphs')
        .select('id, title, description')
        .eq('user_id', userId)
        );

      const existingTitles = (existingGraphs || []).map((g) =>
        g.title.toLowerCase(),
      );

      let domainContext = '';
      let domainName = '';

      if (contextDomainId) {
        try {
          const context = await domainContextService.getDomainContext(
            supabase,
            contextDomainId,
            userId,
          );
          domainContext = context;

          const { data: domainInfo } = await supabase
            .from('domains')
            .select('name')
            .eq('id', contextDomainId)
            .single();
          domainName = domainInfo?.name || '';

          logger.info('使用领域上下文进行分析', {
            domainId: contextDomainId,
            domainName,
            userId,
          });
        } catch (error) {
          logger.warn('获取领域上下文失败，将使用全局分析', {
            domainId: contextDomainId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const basePrompt = `你是知识图谱专家。用户想学习「${domain}」领域。

请推荐 ${count} 个该领域的知识图谱主题，并分析它们之间的学习依赖关系。

要求：
1. 推荐主题覆盖领域各方面，避免重复
2. 分析主题之间的学习依赖关系（如：学A之前需要先学B）
3. 优先级：high(核心基础)/medium(重要内容)/low(扩展内容)
4. 简述不超过60字
${domainContext ? `5. 基于上述已有内容，推荐新的、不重复的知识点\n6. 避免推荐与已有图谱主题过于相似的内容` : ''}

返回JSON格式：
{
  "graphs": [
    {"title": "主题名", "description": "简述", "priority": "high/medium/low"}
  ],
  "relations": [
    {"from": "主题A", "to": "主题B", "type": "prerequisite", "reason": "A是B的前置知识"}
  ]
}

关系类型说明：
- prerequisite: from 是 to 的前置知识（学to之前需要先学from）
- extension: from 是 to 的扩展知识（学完to后可以学习from）
- related: from 和 to 相关但无直接依赖

已有图谱：${existingTitles.length > 0 ? existingTitles.slice(0, 15).join('、') : '无'}`;

      const finalPrompt = domainContext
        ? domainContextService.buildDomainAwarePrompt(
            basePrompt,
            domainContext,
            domainName,
          )
        : basePrompt;

      const response = await aiService.chat(
        [
          {
            role: 'system',
            content:
              '你是一个知识图谱专家，擅长分析领域知识结构、推荐学习路径、识别知识点之间的依赖关系。请用中文回复。确保返回有效的JSON格式。',
          },
          { role: 'user', content: finalPrompt },
        ],
        { timeout: 60000, sessionId, operation: 'domain_analysis' },
      );

      let recommendations: Recommendation[] = [];
      let graphRelations: GraphRelation[] = [];

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const graphs =
            parsed.graphs || parsed.list || parsed.recommendations || [];

          for (const item of graphs) {
            if (typeof item === 'string') {
              const parts = item.split('|');
              if (parts.length >= 3) {
                const [title, description, priority] = parts.map((s) =>
                  s.trim(),
                );
                if (title && !existingTitles.includes(title.toLowerCase())) {
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
              if (!existingTitles.includes(item.title.toLowerCase())) {
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
        logger.warn('Failed to parse domain analysis response as JSON');
      }

      if (domainContext && existingTitles.length > 0) {
        const beforeCount = recommendations.length;
        const existingSet = new Set(existingTitles.map((t) => t.toLowerCase()));
        recommendations = recommendations.filter((rec) => {
          const titleLower = rec.title.toLowerCase();
          const isTooSimilar = Array.from(existingSet).some(
            (existing) =>
              titleLower.includes(existing) || existing.includes(titleLower),
          );
          return !isTooSimilar;
        });

        if (recommendations.length !== beforeCount) {
          logger.info('应用领域上下文过滤', {
            before: beforeCount,
            after: recommendations.length,
          });
        }
      }

      const validTitles = new Set(
        recommendations.map((r) => r.title.toLowerCase()),
      );
      const existingTitlesSet = new Set(existingTitles);

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
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '领域分析失败';
      throw new AppError(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  }
}

export const analysisRouteService = new AnalysisRouteService();
