import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import {
  taskReviewApi,
  type CreateReviewData,
  type UpdateReviewData,
  type ReviewFilters,
} from '../review';
import { request } from '../client';

// --- Tests ---

describe('taskReviewApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('创建与更新', () => {
    it('应该调用 createReview 以 POST 请求 /scheduler/reviews 并传递 JSON body', async () => {
      const data: CreateReviewData = {
        review_type: 'daily',
        content: '今天学了很多',
        mood: 'good',
      };
      await taskReviewApi.createReview(data);
      expect(request).toHaveBeenCalledWith('/scheduler/reviews', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 updateReview 以 PUT 请求 /scheduler/reviews/{reviewId} 并传递 JSON body', async () => {
      const data: UpdateReviewData = {
        content: '更新内容',
        mood: 'great',
      };
      await taskReviewApi.updateReview('review-1', data);
      expect(request).toHaveBeenCalledWith('/scheduler/reviews/review-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('删除与获取单个', () => {
    it('应该调用 deleteReview 以 DELETE 请求 /scheduler/reviews/{reviewId}', async () => {
      await taskReviewApi.deleteReview('review-1');
      expect(request).toHaveBeenCalledWith('/scheduler/reviews/review-1', {
        method: 'DELETE',
      });
    });

    it('应该调用 getReview 请求 /scheduler/reviews/{reviewId}', async () => {
      await taskReviewApi.getReview('review-1');
      expect(request).toHaveBeenCalledWith('/scheduler/reviews/review-1');
    });
  });

  describe('getReviews - URLSearchParams 构造', () => {
    it('应该在不传 filters 时请求 /scheduler/reviews（无查询串）', async () => {
      await taskReviewApi.getReviews();
      expect(request).toHaveBeenCalledWith('/scheduler/reviews');
    });

    it('应该在传入空 filters 时请求 /scheduler/reviews（无查询串）', async () => {
      await taskReviewApi.getReviews({});
      expect(request).toHaveBeenCalledWith('/scheduler/reviews');
    });

    it('应该在传入 review_type 时附加 ?review_type={value}', async () => {
      await taskReviewApi.getReviews({ review_type: 'daily' });
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews?review_type=daily',
      );
    });

    it('应该在传入 task_id 时附加 ?task_id={value}', async () => {
      await taskReviewApi.getReviews({ task_id: 'task-1' });
      expect(request).toHaveBeenCalledWith('/scheduler/reviews?task_id=task-1');
    });

    it('应该在传入 mood 时附加 ?mood={value}', async () => {
      await taskReviewApi.getReviews({ mood: 'good' });
      expect(request).toHaveBeenCalledWith('/scheduler/reviews?mood=good');
    });

    it('应该在传入 from_date 时附加 ?from_date={value}', async () => {
      await taskReviewApi.getReviews({ from_date: '2026-01-01' });
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews?from_date=2026-01-01',
      );
    });

    it('应该在传入 to_date 时附加 ?to_date={value}', async () => {
      await taskReviewApi.getReviews({ to_date: '2026-01-31' });
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews?to_date=2026-01-31',
      );
    });

    it('应该在传入完整 filters 时按顺序拼接全部查询参数', async () => {
      const filters: ReviewFilters = {
        review_type: 'daily',
        task_id: 'task-1',
        mood: 'good',
        from_date: '2026-01-01',
        to_date: '2026-01-31',
      };
      await taskReviewApi.getReviews(filters);
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews?review_type=daily&task_id=task-1&mood=good&from_date=2026-01-01&to_date=2026-01-31',
      );
    });
  });

  describe('getDailyReview - 可选 date 参数', () => {
    beforeEach(() => {
      vi.useFakeTimers().setSystemTime(new Date('2026-07-23T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该在传入 date 时请求 /scheduler/reviews/daily?date={date}', async () => {
      await taskReviewApi.getDailyReview('2026-01-15');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews/daily?date=2026-01-15',
      );
    });

    it('应该在不传 date 时使用当天日期', async () => {
      await taskReviewApi.getDailyReview();
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews/daily?date=2026-07-23',
      );
    });
  });

  describe('getWeeklyReview - 可选 weekStart 参数', () => {
    beforeEach(() => {
      vi.useFakeTimers().setSystemTime(new Date('2026-07-23T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该在传入 weekStart 时请求 /scheduler/reviews/weekly?week_start={weekStart}', async () => {
      await taskReviewApi.getWeeklyReview('2026-07-20');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews/weekly?week_start=2026-07-20',
      );
    });

    it('应该在不传 weekStart 时使用当天日期', async () => {
      await taskReviewApi.getWeeklyReview();
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews/weekly?week_start=2026-07-23',
      );
    });
  });

  describe('getTaskReview - 路径插值', () => {
    it('应该调用 getTaskReview 请求 /scheduler/reviews/task/{taskId}', async () => {
      await taskReviewApi.getTaskReview('task-1');
      expect(request).toHaveBeenCalledWith('/scheduler/reviews/task/task-1');
    });
  });

  describe('getReviewStats - 可选 period 参数', () => {
    it('应该在不传 period 时使用默认值 month', async () => {
      await taskReviewApi.getReviewStats();
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews/stats?period=month',
      );
    });

    it('应该在传入 week 时附加 ?period=week', async () => {
      await taskReviewApi.getReviewStats('week');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews/stats?period=week',
      );
    });

    it('应该在传入 month 时附加 ?period=month', async () => {
      await taskReviewApi.getReviewStats('month');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/reviews/stats?period=month',
      );
    });
  });
});
