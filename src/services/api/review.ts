import { request } from './client';

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

export const taskReviewApi = {
  async createReview(data: CreateReviewData): Promise<TaskReview> {
    return request<TaskReview>('/scheduler/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateReview(reviewId: string, data: UpdateReviewData): Promise<TaskReview> {
    return request<TaskReview>(`/scheduler/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteReview(reviewId: string): Promise<void> {
    return request<void>(`/scheduler/reviews/${reviewId}`, {
      method: 'DELETE',
    });
  },

  async getReview(reviewId: string): Promise<TaskReview | null> {
    return request<TaskReview | null>(`/scheduler/reviews/${reviewId}`);
  },

  async getReviews(filters?: ReviewFilters): Promise<TaskReview[]> {
    const params = new URLSearchParams();
    if (filters?.review_type) params.set('review_type', filters.review_type);
    if (filters?.task_id) params.set('task_id', filters.task_id);
    if (filters?.mood) params.set('mood', filters.mood);
    if (filters?.from_date) params.set('from_date', filters.from_date);
    if (filters?.to_date) params.set('to_date', filters.to_date);
    const query = params.toString();
    return request<TaskReview[]>(`/scheduler/reviews${query ? `?${query}` : ''}`);
  },

  async getDailyReview(date?: string): Promise<TaskReview | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return request<TaskReview | null>(`/scheduler/reviews/daily?date=${targetDate}`);
  },

  async getWeeklyReview(weekStart?: string): Promise<TaskReview | null> {
    const targetWeekStart = weekStart || new Date().toISOString().split('T')[0];
    return request<TaskReview | null>(`/scheduler/reviews/weekly?week_start=${targetWeekStart}`);
  },

  async getTaskReview(taskId: string): Promise<TaskReview | null> {
    return request<TaskReview | null>(`/scheduler/reviews/task/${taskId}`);
  },

  async getReviewStats(period: 'week' | 'month' = 'month'): Promise<ReviewStats> {
    return request<ReviewStats>(`/scheduler/reviews/stats?period=${period}`);
  },
};
