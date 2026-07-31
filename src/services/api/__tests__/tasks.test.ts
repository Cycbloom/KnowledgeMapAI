import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError, SharedErrorCodes } from '../../../utils/errors';

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
  getApiUrl: vi.fn(),
}));

// Mock useStore（dataApi.export 使用动态 import）
vi.mock('../../../store/useStore', () => ({
  useStore: {
    getState: vi.fn(),
  },
}));

import { tasksApi, searchApi, dataApi } from '../tasks';
import { request, getApiUrl } from '../client';
import { useStore } from '../../../store/useStore';

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
  // export: 直接 fetch + 动态 import(getApiUrl / useStore)
  // ============================================================
  describe('export', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let setUserMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      setUserMock = vi.fn();
      vi.mocked(getApiUrl).mockResolvedValue('/api/v1');
      vi.mocked(useStore.getState).mockReturnValue({
        token: 'token-123',
        setUser: setUserMock,
      });
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('应该通过 fetch 请求导出并返回 blob(含 Authorization 头)', async () => {
      const mockBlob = new Blob(['export-data'], {
        type: 'application/json',
      });
      fetchSpy.mockResolvedValue(new Response(mockBlob, { status: 200 }));

      const result = await dataApi.export('graph-1', 'json');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/data/export/json?graph_id=graph-1',
        {
          headers: {
            Authorization: 'Bearer token-123',
          },
        },
      );
      expect(result).toBeInstanceOf(Blob);
    });

    it('应该在无 token 时省略 Authorization 头', async () => {
      vi.mocked(useStore.getState).mockReturnValue({
        token: null,
        setUser: setUserMock,
      });
      const mockBlob = new Blob(['pdf-data'], { type: 'application/pdf' });
      fetchSpy.mockResolvedValue(new Response(mockBlob, { status: 200 }));

      await dataApi.export('graph-2', 'pdf');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/data/export/pdf?graph_id=graph-2',
        {
          headers: {},
        },
      );
    });

    it('应该支持 markdown 格式并对 graphId 与 format 进行 URL 编码', async () => {
      const mockBlob = new Blob(['# md'], { type: 'text/markdown' });
      fetchSpy.mockResolvedValue(new Response(mockBlob, { status: 200 }));

      await dataApi.export('graph a&b=c', 'markdown');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/data/export/markdown?graph_id=graph%20a%26b%3Dc',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-123' },
        }),
      );
    });

    it('应该在 401 响应时调用 setUser(null, null) 并抛出 AppError', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Unauthorized access', { status: 401 }),
      );

      await expect(dataApi.export('graph-1', 'json')).rejects.toMatchObject({
        message: 'Unauthorized access',
        code: SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        statusCode: 500,
      });
      expect(setUserMock).toHaveBeenCalledWith(null, null);
    });

    it('应该在非 ok 非 401 响应时抛出包含响应文本的 AppError 且不调用 setUser', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Internal Server Error', { status: 500 }),
      );

      await expect(dataApi.export('graph-1', 'json')).rejects.toMatchObject({
        message: 'Internal Server Error',
        code: SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        statusCode: 500,
      });
      expect(setUserMock).not.toHaveBeenCalled();
    });

    it('应该在响应文本为空时使用默认错误消息 Export failed', async () => {
      fetchSpy.mockResolvedValue(new Response('', { status: 502 }));

      const error = await dataApi
        .export('graph-1', 'json')
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        message: 'Export failed',
        code: SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        statusCode: 500,
      });
    });
  });
});
