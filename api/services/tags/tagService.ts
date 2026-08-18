import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheService, CacheKeys, CacheTTL } from '../common/cacheService';
import { notDeleted } from '../common/softDeleteHelper';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

/** 各资源携带某标签的记录数 */
export interface TagResourceCounts {
  graphs: number;
  notes: number;
  tasks: number;
}

/** 标签聚合条目 */
export interface TagSummary {
  name: string;
  counts: TagResourceCounts;
  total: number;
}

/** 标签写操作影响的记录数 */
export type TagUpdateResult = TagResourceCounts;

interface TagRow {
  tags: string[] | null;
}

/** 校验标签名：trim 后非空且 ≤30 字符 */
function assertValidTagName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 30) {
    throw new AppError('标签名必须为 1-30 个字符', 400, ErrorCodes.VALIDATION_ERROR);
  }
  return trimmed;
}

class TagService {
  /**
   * 聚合 graphs / notes / tasks 三类资源的标签及计数。
   */
  async list(supabase: SupabaseClient, userId: string): Promise<{ tags: TagSummary[] }> {
    return cacheService.getOrSet(
      CacheKeys.USER_TAGS(userId),
      async () => {
        const [graphsRes, notesRes, tasksRes] = await Promise.all([
          notDeleted(
            supabase.from('knowledge_graphs').select('tags').eq('user_id', userId),
          ),
          notDeleted(supabase.from('notes').select('tags').eq('user_id', userId)),
          notDeleted(supabase.from('user_tasks').select('tags').eq('user_id', userId)),
        ]);

        const tagMap = new Map<string, TagResourceCounts>();
        const bump = (rows: TagRow[] | null, resource: keyof TagResourceCounts) => {
          for (const row of rows ?? []) {
            // 去重后计数：同一行内重复标签只计一次
            for (const tag of new Set(row.tags ?? [])) {
              const counts = tagMap.get(tag) ?? { graphs: 0, notes: 0, tasks: 0 };
              counts[resource] += 1;
              tagMap.set(tag, counts);
            }
          }
        };

        bump(graphsRes.data as TagRow[] | null, 'graphs');
        bump(notesRes.data as TagRow[] | null, 'notes');
        bump(tasksRes.data as TagRow[] | null, 'tasks');

        const tags: TagSummary[] = Array.from(tagMap.entries())
          .map(([name, counts]) => ({
            name,
            counts,
            total: counts.graphs + counts.notes + counts.tasks,
          }))
          .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

        return { tags };
      },
      CacheTTL.DYNAMIC,
      [`user:${userId}`, 'tags'],
    );
  }

  /** 重命名标签：三表中 from → to */
  async rename(
    supabase: SupabaseClient,
    userId: string,
    from: string,
    to: string,
  ): Promise<TagUpdateResult> {
    const fromName = assertValidTagName(from);
    const toName = assertValidTagName(to);
    if (fromName === toName) {
      return { graphs: 0, notes: 0, tasks: 0 };
    }

    const { data, error } = await supabase.rpc('rename_user_tag', {
      p_user_id: userId,
      p_from: fromName,
      p_to: toName,
    });
    if (error) {
      logger.error('[TagService] rename_user_tag failed:', error.message);
      throw new AppError('标签重命名失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    await this.invalidate(userId);
    return (data ?? { graphs: 0, notes: 0, tasks: 0 }) as TagUpdateResult;
  }

  /** 合并标签：sources 并入 target */
  async merge(
    supabase: SupabaseClient,
    userId: string,
    sources: string[],
    target: string,
  ): Promise<TagUpdateResult> {
    const sourceNames = Array.from(new Set(sources.map((s) => assertValidTagName(s))));
    if (sourceNames.length < 1 || sourceNames.length > 10) {
      throw new AppError('合并来源需为 1-10 个标签', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const targetName = assertValidTagName(target);
    if (sourceNames.includes(targetName)) {
      throw new AppError('合并目标不能同时是来源', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { data, error } = await supabase.rpc('merge_user_tags', {
      p_user_id: userId,
      p_sources: sourceNames,
      p_target: targetName,
    });
    if (error) {
      logger.error('[TagService] merge_user_tags failed:', error.message);
      throw new AppError('标签合并失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    await this.invalidate(userId);
    return (data ?? { graphs: 0, notes: 0, tasks: 0 }) as TagUpdateResult;
  }

  /** 删除标签：从三表中移除 */
  async remove(
    supabase: SupabaseClient,
    userId: string,
    name: string,
  ): Promise<TagUpdateResult> {
    const tagName = assertValidTagName(name);

    const { data, error } = await supabase.rpc('remove_user_tag', {
      p_user_id: userId,
      p_name: tagName,
    });
    if (error) {
      logger.error('[TagService] remove_user_tag failed:', error.message);
      throw new AppError('标签删除失败', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
    await this.invalidate(userId);
    return (data ?? { graphs: 0, notes: 0, tasks: 0 }) as TagUpdateResult;
  }

  /**
   * 批量重写标签后失效相关缓存：
   * - 用户级缓存（图谱列表等，payload 中含 tags）
   * - 标签聚合缓存（USER_TAGS / GRAPH_TAGS）
   */
  private async invalidate(userId: string): Promise<void> {
    await Promise.all([
      cacheService.delByTags([`user:${userId}`]),
      cacheService.del([CacheKeys.GRAPH_TAGS(userId)]),
    ]);
  }
}

export const tagService = new TagService();
