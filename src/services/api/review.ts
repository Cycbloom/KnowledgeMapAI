import { supabase } from './supabase';

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

export interface ReviewStats {
  totalReviews: number;
  byType: Record<ReviewType, number>;
  byMood: Record<Mood, number>;
  averageMoodScore: number;
}

const API_BASE = '/api/scheduler';

export const reviewApi = {
  async createReview(data: CreateReviewData): Promise<TaskReview> {
    const { data: response, error } = await supabase
      .from('task_reviews')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return response as TaskReview;
  },

  async updateReview(reviewId: string, data: UpdateReviewData): Promise<TaskReview> {
    const { data: response, error } = await supabase
      .from('task_reviews')
      .update(data)
      .eq('id', reviewId)
      .select()
      .single();

    if (error) throw error;
    return response as TaskReview;
  },

  async deleteReview(reviewId: string): Promise<void> {
    const { error } = await supabase
      .from('task_reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
  },

  async getReview(reviewId: string): Promise<TaskReview | null> {
    const { data, error } = await supabase
      .from('task_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as TaskReview | null;
  },

  async getReviews(filters?: ReviewFilters): Promise<TaskReview[]> {
    let query = supabase
      .from('task_reviews')
      .select('*')
      .order('created_at', { ascending: false });

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

    const { data, error } = await query;
    if (error) throw error;
    return data as TaskReview[];
  },

  async getDailyReview(date?: string): Promise<TaskReview | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startDate = `${targetDate}T00:00:00.000Z`;
    const endDate = `${targetDate}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from('task_reviews')
      .select('*')
      .eq('review_type', 'daily')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .maybeSingle();

    if (error) throw error;
    return data as TaskReview | null;
  },

  async getWeeklyReview(weekStart?: string): Promise<TaskReview | null> {
    const getWeekStart = (date: Date): string => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split('T')[0];
    };

    const getWeekEnd = (date: Date): string => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? 0 : 7);
      d.setDate(diff);
      return d.toISOString().split('T')[0];
    };

    const targetWeekStart = weekStart || getWeekStart(new Date());
    const weekEnd = getWeekEnd(new Date(targetWeekStart));

    const { data, error } = await supabase
      .from('task_reviews')
      .select('*')
      .eq('review_type', 'weekly')
      .gte('created_at', `${targetWeekStart}T00:00:00.000Z`)
      .lte('created_at', `${weekEnd}T23:59:59.999Z`)
      .maybeSingle();

    if (error) throw error;
    return data as TaskReview | null;
  },

  async getTaskReview(taskId: string): Promise<TaskReview | null> {
    const { data, error } = await supabase
      .from('task_reviews')
      .select('*')
      .eq('task_id', taskId)
      .eq('review_type', 'task')
      .maybeSingle();

    if (error) throw error;
    return data as TaskReview | null;
  },

  async getReviewStats(period: 'week' | 'month' = 'month'): Promise<ReviewStats> {
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

    const { data: reviews, error } = await supabase
      .from('task_reviews')
      .select('review_type, mood')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const byType: Record<ReviewType, number> = { daily: 0, task: 0, weekly: 0 };
    const byMood: Record<Mood, number> = { great: 0, good: 0, neutral: 0, tired: 0, stressed: 0 };
    const moodScores: Record<Mood, number> = { great: 5, good: 4, neutral: 3, tired: 2, stressed: 1 };
    let totalMoodScore = 0;
    let moodCount = 0;

    reviews?.forEach((r: { review_type: ReviewType; mood?: Mood }) => {
      byType[r.review_type]++;
      if (r.mood) {
        byMood[r.mood]++;
        totalMoodScore += moodScores[r.mood];
        moodCount++;
      }
    });

    return {
      totalReviews: reviews?.length || 0,
      byType,
      byMood,
      averageMoodScore: moodCount > 0 ? totalMoodScore / moodCount : 0,
    };
  },
};
