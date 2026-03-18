import { SupabaseClient } from '@supabase/supabase-js';
import { getPaginationParams, PaginationOptions } from '../../utils/pagination.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ErrorCodes } from '../../../shared/types/errorCodes.js';

export type ReviewType = 'daily' | 'task' | 'weekly';
export type Mood = 'great' | 'good' | 'neutral' | 'tired' | 'stressed';

export interface TaskReview {
  id: string;
  user_id: string;
  task_id?: string;
  review_type: ReviewType;
  content?: string;
  mood?: Mood;
  difficulties?: string;
  improvements?: string;
  learnings?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewData {
  task_id?: string;
  review_type: ReviewType;
  content?: string;
  mood?: Mood;
  difficulties?: string;
  improvements?: string;
  learnings?: string;
}

export interface UpdateReviewData {
  content?: string;
  mood?: Mood;
  difficulties?: string;
  improvements?: string;
  learnings?: string;
}

export interface ReviewFilters {
  review_type?: ReviewType;
  task_id?: string;
  from_date?: string;
  to_date?: string;
  mood?: Mood;
}

export class ReviewService {
  async createReview(
    client: SupabaseClient,
    userId: string,
    data: CreateReviewData
  ): Promise<TaskReview> {
    const { data: review, error } = await client
      .from('task_reviews')
      .insert({
        user_id: userId,
        ...data,
      })
      .select()
      .single();

    if (error) {
      throw new AppError(
        `创建复习记录失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return review as TaskReview;
  }

  async updateReview(
    client: SupabaseClient,
    reviewId: string,
    userId: string,
    data: UpdateReviewData
  ): Promise<TaskReview> {
    const { data: review, error } = await client
      .from('task_reviews')
      .update(data)
      .eq('id', reviewId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new AppError(
        `更新复习记录失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    if (!review) {
      throw new AppError('复习记录不存在', 404, ErrorCodes.NOT_FOUND);
    }
    return review as TaskReview;
  }

  async deleteReview(
    client: SupabaseClient,
    reviewId: string,
    userId: string
  ): Promise<void> {
    const { error } = await client
      .from('task_reviews')
      .delete()
      .eq('id', reviewId)
      .eq('user_id', userId);

    if (error) {
      throw new AppError(
        `删除复习记录失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
  }

  async getReview(
    client: SupabaseClient,
    reviewId: string,
    userId: string
  ): Promise<TaskReview | null> {
    const { data, error } = await client
      .from('task_reviews')
      .select('*')
      .eq('id', reviewId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new AppError(
        `获取复习记录失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return data as TaskReview | null;
  }

  async getReviews(
    client: SupabaseClient,
    userId: string,
    filters?: ReviewFilters,
    options?: PaginationOptions
  ): Promise<{ reviews: TaskReview[]; total: number }> {
    const { offset, end } = getPaginationParams(options);
    let query = client
      .from('task_reviews')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, end);

    if (filters?.review_type) {
      query = query.eq('review_type', filters.review_type);
    }
    if (filters?.task_id) {
      query = query.eq('task_id', filters.task_id);
    }
    if (filters?.mood) {
      query = query.eq('mood', filters.mood);
    }
    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }
    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(
        `获取复习记录列表失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return { reviews: data as TaskReview[], total: count || 0 };
  }

  async getDailyReview(
    client: SupabaseClient,
    userId: string,
    date?: string
  ): Promise<TaskReview | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startDate = `${targetDate}T00:00:00.000Z`;
    const endDate = `${targetDate}T23:59:59.999Z`;

    const { data, error } = await client
      .from('task_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('review_type', 'daily')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .maybeSingle();

    if (error) {
      throw new AppError(
        `获取每日复习记录失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return data as TaskReview | null;
  }

  async getWeeklyReview(
    client: SupabaseClient,
    userId: string,
    weekStart?: string
  ): Promise<TaskReview | null> {
    const targetWeekStart = weekStart || this.getWeekStart(new Date());
    const weekEnd = this.getWeekEnd(new Date(targetWeekStart));

    const { data, error } = await client
      .from('task_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('review_type', 'weekly')
      .gte('created_at', `${targetWeekStart}T00:00:00.000Z`)
      .lte('created_at', `${weekEnd}T23:59:59.999Z`)
      .maybeSingle();

    if (error) {
      throw new AppError(
        `获取每周复习记录失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return data as TaskReview | null;
  }

  async getTaskReview(
    client: SupabaseClient,
    userId: string,
    taskId: string
  ): Promise<TaskReview | null> {
    const { data, error } = await client
      .from('task_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .eq('review_type', 'task')
      .maybeSingle();

    if (error) {
      throw new AppError(
        `获取任务复习记录失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }
    return data as TaskReview | null;
  }

  async getReviewStats(
    client: SupabaseClient,
    userId: string,
    period: 'week' | 'month' = 'month'
  ): Promise<{
    totalReviews: number;
    byType: Record<ReviewType, number>;
    byMood: Record<Mood, number>;
    averageMoodScore: number;
  }> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const { data: reviews, error } = await client
      .from('task_reviews')
      .select('review_type, mood')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      throw new AppError(
        `获取复习统计失败: ${error.message}`,
        500,
        ErrorCodes.LEARNING_PROGRESS_ERROR
      );
    }

    const byType: Record<ReviewType, number> = { daily: 0, task: 0, weekly: 0 };
    const byMood: Record<Mood, number> = { great: 0, good: 0, neutral: 0, tired: 0, stressed: 0 };
    const moodScores: Record<Mood, number> = { great: 5, good: 4, neutral: 3, tired: 2, stressed: 1 };
    let totalMoodScore = 0;
    let moodCount = 0;

    reviews.forEach((r: { review_type: ReviewType; mood?: Mood }) => {
      byType[r.review_type]++;
      if (r.mood) {
        byMood[r.mood]++;
        totalMoodScore += moodScores[r.mood];
        moodCount++;
      }
    });

    return {
      totalReviews: reviews.length,
      byType,
      byMood,
      averageMoodScore: moodCount > 0 ? totalMoodScore / moodCount : 0,
    };
  }

  private getWeekStart(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }

  private getWeekEnd(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : 7);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  }
}

export const reviewService = new ReviewService();
