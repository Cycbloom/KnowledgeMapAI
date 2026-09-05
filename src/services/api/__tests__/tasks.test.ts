import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError, SharedErrorCodes } from '../../../utils/errors';

// Mock request/requestBlob from ../client（tasks.ts 统一走 client 出口，
// 鉴权/CSRF/地址解析由 client 拦截器负责，此处只断言调用契约与错误传播）
vi.mock('../client', () => ({
  request: vi.fn(),
  requestBlob: vi.fn(),
  getApiUrl: vi.fn(),
}));

import { tasksApi, searchApi, dataApi } from '../tasks';
import { request, requestBlob } from '../client';
import { AppError, SharedErrorCodes } from '../../../utils/errors';

beforeEach(() => {
  vi.mocked(request).mockClear();
});

describe('tasksApi', () => {
  describe('create', () => {
    it('应该向 /tasks 发送 POST 请求并携带 JSON body', () => {
      const data = { type: 'export', payload: { graphId: 'g1' } };

      tasksApi.create(data);

      expect(request).toHaveBeenCalledWith('/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('list', () => {
    it('应该使用默认 limit 和 offset 请求任务列表', () => {
      tasksApi.list();

      expect(request).toHaveBeenCalledWith('/tasks?limit=20&offset=0');
    });

    it('应该在传入 status 时将其加入查询参数', () => {
      tasksApi.list('pending');

      expect(request).toHaveBeenCalledWith(
        '/tasks?status=pending&limit=20&offset=0',
      );
    });

    it('应该使用自定义 limit 和 offset 构造查询参数', () => {
      tasksApi.list('done', 50, 10);

      expect(request).toHaveBeenCalledWith(
        '/tasks?status=done&limit=50&offset=10',
      );
    });

    it('应该在未传入 status 时省略 status 参数', () => {
      tasksApi.list(undefined, 5, 0);

      expect(request).toHaveBeenCalledWith('/tasks?limit=5&offset=0');
    });
  });

  describe('retry', () => {
    it('应该向 /tasks/{id}/retry 发送 POST 请求', () => {
      tasksApi.retry('abc123');

      expect(request).toHaveBeenCalledWith('/tasks/abc123/retry', {
        method: 'POST',
      });
    });
  });

  describe('delete', () => {
    it('应该向 /tasks/{id} 发送 DELETE 请求', () => {
      tasksApi.delete('abc123');

      expect(request).toHaveBeenCalledWith('/tasks/abc123', {
        method: 'DELETE',
      });
    });
  });
});

describe('searchApi', () => {
  describe('query', () => {
    it('应该使用默认 type=keyword 查询搜索', () => {
      searchApi.query('hello');

      expect(request).toHaveBeenCalledWith('/search?q=hello&type=keyword');
    });

    it('应该使用指定的 type 构造查询参数', () => {
      searchApi.query('hello world', 'semantic');

      expect(request).toHaveBeenCalledWith(
        '/search?q=hello%20world&type=semantic',
      );
    });

    it('应该对查询关键词进行 URL 编码', () => {
      searchApi.query('a&b=c', 'hybrid');

      expect(request).toHaveBeenCalledWith('/search?q=a%26b%3Dc&type=hybrid');
    });
  });
});

describe('dataApi', () => {
  describe('import', () => {
    it('应该向 /data/import 发送 POST 请求并携带 JSON body', () => {
      const data = { file: 'data.json', content: 'abc' };

      dataApi.import(data);

      expect(request).toHaveBeenCalledWith('/data/import', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  // ============================================================
  // export: 统一走 requestBlob（client 拦截器补鉴权/CSRF/基址）
  // ============================================================
  describe('export', () => {
    beforeEach(() => {
      vi.mocked(requestBlob).mockReset();
    });

    it('应该调用 requestBlob 请求 /data/export/{format}?graph_id={graphId} 并返回 blob', async () => {
      const mockBlob = new Blob(['export-data'], {
        type: 'application/json',
      });
      vi.mocked(requestBlob).mockResolvedValue(mockBlob);

      const result = await dataApi.export('graph-1', 'json');

      expect(requestBlob).toHaveBeenCalledWith(
        '/data/export/json?graph_id=graph-1',
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it('应该支持 markdown 格式并对 graphId 与 format 进行 URL 编码', async () => {
      const mockBlob = new Blob(['# md'], { type: 'text/markdown' });
      vi.mocked(requestBlob).mockResolvedValue(mockBlob);

      await dataApi.export('graph a&b=c', 'markdown');

      expect(requestBlob).toHaveBeenCalledWith(
        '/data/export/markdown?graph_id=graph%20a%26b%3Dc',
      );
    });

    it('应该在 requestBlob 失败时原样抛出 AppError', async () => {
      const err = new AppError(
        'Export failed',
        SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        500,
      );
      vi.mocked(requestBlob).mockRejectedValue(err);

      const error = await dataApi
        .export('graph-1', 'json')
        .catch((e: unknown) => e);

      expect(error).toBe(err);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        message: 'Export failed',
        code: SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        statusCode: 500,
      });
    });
  });
});
