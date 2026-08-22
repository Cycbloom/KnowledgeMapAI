import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock requestData function from ../client
vi.mock('../client', () => ({
  requestData: vi.fn(),
}));

import { focusApi } from '../modules/scheduler/focus';
import { requestData } from '../client';

beforeEach(() => {
  vi.mocked(requestData).mockClear();
});

describe('scheduler/focus - 路由回归测试', () => {
  describe('createFocusSession - POST 请求', () => {
    it('应该 POST /scheduler/focus-sessions 并传递 JSON body', async () => {
      const data = { started_at: '2026-08-22T10:00:00Z' };
      await focusApi.createFocusSession(data);
      expect(requestData).toHaveBeenCalledWith('/scheduler/focus-sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('getUserFocusStats - GET 请求', () => {
    it('应该请求 /scheduler/focus-sessions/stats（避免 404）', async () => {
      await focusApi.getUserFocusStats();
      expect(requestData).toHaveBeenCalledWith('/scheduler/focus-sessions/stats');
    });
  });

  describe('getDailyFocusStats - GET 请求', () => {
    it('无参数时请求 /scheduler/focus-sessions/today', async () => {
      await focusApi.getDailyFocusStats();
      expect(requestData).toHaveBeenCalledWith('/scheduler/focus-sessions/today');
    });

    it('带 date 时请求 /scheduler/focus-sessions/today?date=...', async () => {
      await focusApi.getDailyFocusStats('2026-08-22');
      expect(requestData).toHaveBeenCalledWith(
        '/scheduler/focus-sessions/today?date=2026-08-22',
      );
    });
  });

  describe('getWeeklyFocusStats - GET 请求', () => {
    it('无参数时请求 /scheduler/focus-sessions/weekly-stats', async () => {
      await focusApi.getWeeklyFocusStats();
      expect(requestData).toHaveBeenCalledWith(
        '/scheduler/focus-sessions/weekly-stats',
      );
    });

    it('带 week_start 时请求 /scheduler/focus-sessions/weekly-stats?week_start=...', async () => {
      await focusApi.getWeeklyFocusStats('2026-08-17');
      expect(requestData).toHaveBeenCalledWith(
        '/scheduler/focus-sessions/weekly-stats?week_start=2026-08-17',
      );
    });
  });

  describe('getMonthlyFocusStats - GET 请求', () => {
    it('无参数时请求 /scheduler/focus-sessions/monthly-stats', async () => {
      await focusApi.getMonthlyFocusStats();
      expect(requestData).toHaveBeenCalledWith(
        '/scheduler/focus-sessions/monthly-stats',
      );
    });

    it('带 year/month 时请求 /scheduler/focus-sessions/monthly-stats?year=...&month=...', async () => {
      await focusApi.getMonthlyFocusStats(2026, 8);
      expect(requestData).toHaveBeenCalledWith(
        '/scheduler/focus-sessions/monthly-stats?year=2026&month=8',
      );
    });
  });

  describe('getYearlyHeatmap - GET 请求', () => {
    it('无参数时请求 /scheduler/focus-sessions/heatmap', async () => {
      await focusApi.getYearlyHeatmap();
      expect(requestData).toHaveBeenCalledWith(
        '/scheduler/focus-sessions/heatmap',
      );
    });

    it('带 year 时请求 /scheduler/focus-sessions/heatmap?year=...', async () => {
      await focusApi.getYearlyHeatmap(2026);
      expect(requestData).toHaveBeenCalledWith(
        '/scheduler/focus-sessions/heatmap?year=2026',
      );
    });
  });
});
