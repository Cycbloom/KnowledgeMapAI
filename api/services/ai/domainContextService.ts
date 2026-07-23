import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { notDeleted } from '../common/softDeleteHelper';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CONTEXT_LENGTH = 500;

interface CacheEntry {
  value: string;
  expiresAt: number;
}

export class DomainContextService {
  private cache = new Map<string, CacheEntry>();

  async getDomainContext(
    supabase: SupabaseClient,
    domainId: string,
    userId: string,
  ): Promise<string> {
    const cacheKey = `${domainId}:${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('Domain context cache hit', { domainId, userId });
      return cached.value;
    }

    try {
      const { data: domainRecord, error: domainError } = await notDeleted(supabase
        .from('domains')
        .select('name')
        .eq('id', domainId)
        )
        .single();

      if (domainError || !domainRecord) {
        logger.warn('Domain not found', { domainId, error: domainError });
        return '';
      }

      const domainName = domainRecord.name;

      const { data: graphDomains, error: gdError } = await supabase
        .from('graph_domains')
        .select('graph_id')
        .eq('domain_id', domainId);

      if (gdError) {
        logger.error('Failed to query graph_domains', { domainId, error: gdError });
        return '';
      }

      if (!graphDomains || graphDomains.length === 0) {
        logger.debug('No graphs found for domain', { domainId, domainName });
        this.setCache(cacheKey, '');
        return '';
      }

      const graphIds = graphDomains.map((gd: { graph_id: string }) => gd.graph_id);

      const { data: graphs, error: graphsError } = await notDeleted(supabase
        .from('knowledge_graphs')
        .select('id, title, description')
        .in('id', graphIds)
        );

      if (graphsError) {
        logger.error('Failed to query knowledge_graphs', { domainId, error: graphsError });
        return '';
      }

      if (!graphs || graphs.length === 0) {
        this.setCache(cacheKey, '');
        return '';
      }

      const contextText = this.buildContextText(domainName, graphs);
      const truncated = this.truncateText(contextText);

      this.setCache(cacheKey, truncated);

      logger.info('Domain context built successfully', {
        domainId,
        domainName,
        graphCount: graphs.length,
        contextLength: truncated.length,
      });

      return truncated;
    } catch (error) {
      logger.error('Unexpected error in getDomainContext', { domainId, userId, error });
      return '';
    }
  }

  buildDomainAwarePrompt(
    basePrompt: string,
    domainContext: string,
    domainName?: string,
  ): string {
    if (!domainContext) {
      return basePrompt;
    }

    const contextBlock = `[领域知识上下文 - ${domainName || '当前领域'}]\n${domainContext}\n\n`;

    return `${contextBlock}${basePrompt}`;
  }

  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Domain context cache cleared', { entriesCleared: size });
  }

  private buildContextText(
    domainName: string,
    graphs: Array<{ id: string; title: string; description: string | null }>,
  ): string {
    const lines = graphs.map((g, index) => {
      const desc = g.description || '暂无描述';
      return `${index + 1}. ${g.title} - ${desc}`;
    });

    return `当前【${domainName}】领域的已有知识体系包括以下 ${graphs.length} 个图谱：\n${lines.join('\n')}`;
  }

  private truncateText(text: string): string {
    if (text.length <= MAX_CONTEXT_LENGTH) {
      return text;
    }
    return `${text.substring(0, MAX_CONTEXT_LENGTH)  }...(内容已截断)`;
  }

  private setCache(key: string, value: string): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
}

export const domainContextService = new DomainContextService();
