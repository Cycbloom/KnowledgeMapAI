import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock request：仅校验契约（路径、method、body），不发起真实请求
vi.mock('../client', () => ({
  request: vi.fn(),
}));

import { tagsApi } from '../tags';
import { request } from '../client';

describe('tagsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list', () => {
    it('应该通过 GET /tags 获取标签聚合', async () => {
      const mockResult = {
        tags: [
          {
            name: 'react',
            counts: { graphs: 2, notes: 1, tasks: 0 },
            total: 3,
          },
        ],
      };
      vi.mocked(request).mockResolvedValue(mockResult);

      const result = await tagsApi.list();

      expect(request).toHaveBeenCalledWith('/tags');
      expect(result).toEqual(mockResult);
    });
  });

  describe('rename', () => {
    it('应该通过 POST /tags/rename 重命名标签', async () => {
      const mockResult = {
        updated: { graphs: 1, notes: 0, tasks: 0 },
      };
      vi.mocked(request).mockResolvedValue(mockResult);

      const result = await tagsApi.rename('old', 'new');

      expect(request).toHaveBeenCalledWith('/tags/rename', {
        method: 'POST',
        body: JSON.stringify({ from: 'old', to: 'new' }),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('merge', () => {
    it('应该通过 POST /tags/merge 合并标签', async () => {
      const mockResult = {
        updated: { graphs: 2, notes: 1, tasks: 0 },
      };
      vi.mocked(request).mockResolvedValue(mockResult);

      const result = await tagsApi.merge(['a', 'b'], 'target');

      expect(request).toHaveBeenCalledWith('/tags/merge', {
        method: 'POST',
        body: JSON.stringify({ sources: ['a', 'b'], target: 'target' }),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('delete', () => {
    it('应该通过 DELETE /tags/:name 删除标签（name URL 编码）', async () => {
      const mockResult = {
        removed: { graphs: 0, notes: 1, tasks: 0 },
      };
      vi.mocked(request).mockResolvedValue(mockResult);

      const result = await tagsApi.delete('前端/基础');

      expect(request).toHaveBeenCalledWith(
        `/tags/${encodeURIComponent('前端/基础')}`,
        { method: 'DELETE' },
      );
      expect(result).toEqual(mockResult);
    });
  });
});
