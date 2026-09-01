import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note } from '@shared/types/note';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { notDeleted } from '../common/softDeleteHelper';
import {
  mapRowToNote,
  getLocalDateString,
  getDayStartIso,
  getNextDayStartIso,
  type NoteRow,
  type DailyAggregation,
  type GetOrCreateDailyResult,
} from './notesShared';
import { notesTemplateService } from './notesTemplateService';

/**
 * Daily 笔记域服务：今日 Daily 的自动创建、模板聚合数据查询与模板渲染。
 * 不依赖 NotesService，由 NotesService 组合注入。
 */
export class NotesDailyService {
  /**
   * 获取或创建今日 Daily Note。
   * - 今日已存在则直接返回(created=false)
   * - 不存在则查询用户默认模板(无则系统模板),渲染聚合变量后创建
   */
  async getOrCreateTodayDaily(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<GetOrCreateDailyResult> {
    const today = getLocalDateString();

    // 1. 查今日 daily 是否存在(未软删除)
    const { data: existing, error: existError } = await notDeleted(supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'daily')
      .eq('date', today)
    ).maybeSingle();

    if (existError) {
      logger.error('getOrCreateTodayDaily: query existing error', { userId, today, error: existError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, today } });
    }

    if (existing) {
      return {
        note: mapRowToNote(existing as unknown as NoteRow),
        created: false,
      };
    }

    // 2. 查用户默认模板,无则用系统模板
    const template = await notesTemplateService.getDefaultTemplate(supabase, userId);

    // 3. 渲染模板(聚合变量替换为当日静态快照)
    const aggregation = await this.getDailyAggregation(supabase, userId, today);
    const { title, content } = this.renderTemplate(template.content, today, aggregation);

    // 4. 插入 notes 表
    const insertRow: Record<string, unknown> = {
      user_id: userId,
      title,
      content,
      type: 'daily',
      date: today,
      template_id: template.id,
      tags: [],
      is_pinned: false,
      is_archived: false,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('notes')
      .insert(insertRow)
      .select('*')
      .single();

    if (insertError) {
      // 并发情况下另一请求可能已创建,再次查询返回已有
      if (insertError.code === '23505') {
        const { data: retry } = await notDeleted(supabase
          .from('notes')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'daily')
          .eq('date', today)
        ).maybeSingle();
        if (retry) {
          return {
            note: mapRowToNote(retry as unknown as NoteRow),
            created: false,
          };
        }
        throw new AppError(ErrorCodes.DATABASE_DUPLICATE_ENTRY, {
          context: { userId, today },
        });
      }
      logger.error('getOrCreateTodayDaily: insert error', { userId, today, error: insertError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, today } });
    }

    return {
      note: mapRowToNote(inserted as unknown as NoteRow),
      created: true,
    };
  }

  /**
   * 渲染模板:替换 {{date}}、{{today_reviewed_cards}}、{{today_completed_tasks}}、{{today_focus_time}} 为静态快照值。
   * 聚合数据写入正文后不再变化(便于历史追溯)。
   */
  renderTemplate(
    templateContent: string,
    dateStr: string,
    aggregation: DailyAggregation,
  ): { title: string; content: string } {
    const content = templateContent
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{today_reviewed_cards\}\}/g, String(aggregation.reviewedCards))
      .replace(/\{\{today_completed_tasks\}\}/g, String(aggregation.completedTasks))
      .replace(/\{\{today_focus_time\}\}/g, String(aggregation.focusTimeMinutes));

    // 从首行 H1 提取标题,无则用 "${date} 学习日志"
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `${dateStr} 学习日志`;

    return { title, content };
  }

  /**
   * 获取 Daily 模板渲染所需的当日聚合数据(只读快照)。
   * 各来源查询相互独立,单个失败不影响其他(记 0)。
   */
  async getDailyAggregation(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<DailyAggregation> {
    const [reviewedCards, completedTasks, focusTimeMinutes] = await Promise.all([
      this.getTodayReviewedCardsCount(supabase, userId, dateStr),
      this.getTodayCompletedTasksCount(supabase, userId, dateStr),
      this.getTodayFocusTimeMinutes(supabase, userId, dateStr),
    ]);

    return { reviewedCards, completedTasks, focusTimeMinutes };
  }

  /**
   * 查今日复习卡数。
   *
   * 数据来源:study_cards 表(study_progress 表仅记录每图谱的进度汇总,
   * 不含每日复习事件)。study_cards.last_reviewed 表示最近一次复习时间,
   * 据此过滤"今日复习"的卡片。
   */
  private async getTodayReviewedCardsCount(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<number> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    const { count, error } = await supabase
      .from('study_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('last_reviewed', startIso)
      .lt('last_reviewed', endIso);

    if (error) {
      logger.warn('getTodayReviewedCardsCount: query error, fallback to 0', { userId, dateStr, error });
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 查今日完成任务数。
   *
   * 数据来源:task_executions 表(user_id + status='completed' + ended_at 今日)。
   * ended_at 为可空字段,status='completed' 时应当已设置,失败时回退到 started_at。
   */
  private async getTodayCompletedTasksCount(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<number> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    // 优先按 ended_at 过滤;ended_at 为空时回退到 started_at
    const { count, error } = await supabase
      .from('task_executions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .or(`and(ended_at.gte.${startIso},ended_at.lt.${endIso}),and(ended_at.is.null,started_at.gte.${startIso},started_at.lt.${endIso})`);

    if (error) {
      logger.warn('getTodayCompletedTasksCount: query error, fallback to 0', { userId, dateStr, error });
      return 0;
    }

    return count ?? 0;
  }

  /**
   * 查今日专注时长(分钟)。
   *
   * 数据来源:focus_sessions 表(user_id + mode='focus' + started_at 今日)。
   * duration 字段单位为秒,累加后转换为分钟(向下取整)。
   */
  private async getTodayFocusTimeMinutes(
    supabase: SupabaseClient,
    userId: string,
    dateStr: string,
  ): Promise<number> {
    const startIso = getDayStartIso(dateStr);
    const endIso = getNextDayStartIso(dateStr);

    const { data, error } = await supabase
      .from('focus_sessions')
      .select('duration')
      .eq('user_id', userId)
      .eq('mode', 'focus')
      .gte('started_at', startIso)
      .lt('started_at', endIso);

    if (error) {
      logger.warn('getTodayFocusTimeMinutes: query error, fallback to 0', { userId, dateStr, error });
      return 0;
    }

    const totalSeconds = (data ?? []).reduce(
      (sum, row: { duration: number | null }) => sum + (row.duration ?? 0),
      0,
    );
    return Math.floor(totalSeconds / 60);
  }
}

export const notesDailyService = new NotesDailyService();
export type { Note };