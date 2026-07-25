import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
  requestData: vi.fn(),
}));

import { achievementsApi } from '../modules/scheduler/achievements';
import { request, requestData } from '../client';

beforeEach(() => {
  vi.mocked(request).mockClear();
  vi.mocked(requestData).mockClear();
});

describe('scheduler/achievements - 路由与响应格式回归测试', () => {
  describe('getAllAchievements - GET 请求', () => {
    it('应该请求 /achievements（NOT /scheduler/achievements）并使用 request<T>，避免 404', async () => {
      await achievementsApi.getAllAchievements();
      expect(request).toHaveBeenCalledWith('/achievements');
      expect(requestData).not.toHaveBeenCalled();
    });
  });

  describe('getUserAchievements - GET 请求', () => {
    it('应该请求 /achievements/user 并使用 request<T>，避免 404', async () => {
      await achievementsApi.getUserAchievements();
      expect(request).toHaveBeenCalledWith('/achievements/user');
      expect(requestData).not.toHaveBeenCalled();
    });
  });

  describe('checkAchievements - POST 请求', () => {
    it('应该以 POST 请求 /achievements/check 并使用 request<T>，避免 404', async () => {
      await achievementsApi.checkAchievements();
      expect(request).toHaveBeenCalledWith('/achievements/check', {
        method: 'POST',
      });
      expect(requestData).not.toHaveBeenCalled();
    });
  });
});
