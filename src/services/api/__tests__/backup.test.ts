import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

// Mock useStore (backup.ts 通过 useStore.getState().token 读取令牌)
vi.mock('../../../store/useStore', () => ({
  useStore: {
    getState: () => ({ token: 'token-123' }),
  },
}));

// --- Imports (must be after vi.mock declarations) ---

import { backupApi, type BackupSnapshot } from '../backup';
import { AppError, SharedErrorCodes } from '../../../utils/errors';

// --- Test data ---

const mockSnapshot: BackupSnapshot = {
  id: 'snap-1',
  user_id: 'user-1',
  type: 'manual',
  file_path: '/backups/snap-1.zip',
  file_size: 1024,
  graphs_count: 3,
  nodes_count: 50,
  created_at: '2026-07-23T00:00:00.000Z',
};

// --- Tests ---

describe('backupApi', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ============================================================
  // export
  // ============================================================

  describe('export', () => {
    it('应该以 GET 请求 /api/backup/export 并返回 blob', async () => {
      const blob = new Blob(['backup-data'], { type: 'application/zip' });
      fetchSpy.mockResolvedValue(new Response(blob, { status: 200 }));

      const result = await backupApi.export();

      expect(fetchSpy).toHaveBeenCalledWith('/api/backup/export', {
        method: 'GET',
        headers: { Authorization: 'Bearer token-123' },
        credentials: 'include',
      });
      expect(result).toBeInstanceOf(Blob);
    });

    it('应该在响应失败时抛出 AppError 且 code 为 SYSTEM_INTERNAL_ERROR', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Internal Error', { status: 500 }),
      );

      await expect(backupApi.export()).rejects.toThrow(AppError);
      await expect(backupApi.export()).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
      });
    });
  });

  // ============================================================
  // getSnapshots
  // ============================================================

  describe('getSnapshots', () => {
    it('应该以 GET 请求 /api/backup/snapshots 并返回 snapshots 数组', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ snapshots: [mockSnapshot] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await backupApi.getSnapshots();

      expect(fetchSpy).toHaveBeenCalledWith('/api/backup/snapshots', {
        method: 'GET',
        headers: { Authorization: 'Bearer token-123' },
        credentials: 'include',
      });
      expect(result).toEqual([mockSnapshot]);
    });

    it('应该在响应中无 snapshots 字段时返回空数组', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await backupApi.getSnapshots();

      expect(result).toEqual([]);
    });

    it('应该在响应失败时抛出 AppError', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Server Error', { status: 500 }),
      );

      await expect(backupApi.getSnapshots()).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
      });
    });
  });

  // ============================================================
  // createSnapshot
  // ============================================================

  describe('createSnapshot', () => {
    it('应该以 POST 请求 /api/backup/snapshots 默认 type=manual 并传递 JSON body', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ id: 'snap-2' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await backupApi.createSnapshot();

      expect(fetchSpy).toHaveBeenCalledWith('/api/backup/snapshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        },
        credentials: 'include',
        body: JSON.stringify({ type: 'manual' }),
      });
      expect(result).toEqual({ id: 'snap-2' });
    });

    it('应该在响应失败时抛出 AppError 并携带响应中的 error 消息', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: '磁盘空间不足' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(backupApi.createSnapshot()).rejects.toThrow('磁盘空间不足');
    });

    it('应该在响应失败且无 error 字段时使用默认错误消息', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(backupApi.createSnapshot()).rejects.toThrow(
        'Failed to create snapshot',
      );
    });
  });

  // ============================================================
  // deleteSnapshot - 路径插值与编码
  // ============================================================

  describe('deleteSnapshot', () => {
    it('应该以 DELETE 请求 /api/backup/snapshots/{id} 并对路径参数进行编码', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await backupApi.deleteSnapshot('snap/1');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/backup/snapshots/snap%2F1',
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer token-123' },
          credentials: 'include',
        },
      );
      expect(result).toEqual({ success: true });
    });

    it('应该在响应失败时抛出 AppError 并携带响应中的 error 消息', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: '快照不存在' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(backupApi.deleteSnapshot('snap-x')).rejects.toThrow(
        '快照不存在',
      );
    });
  });

  // ============================================================
  // restoreSnapshot - 路径插值与编码
  // ============================================================

  describe('restoreSnapshot', () => {
    it('应该以 POST 请求 /api/backup/restore/{id} 并对路径参数进行编码', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ restored: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await backupApi.restoreSnapshot('snap 1');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/backup/restore/snap%201',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer token-123' },
          credentials: 'include',
        },
      );
      expect(result).toEqual({ restored: true });
    });

    it('应该在响应失败时抛出 AppError 并携带响应中的 error 消息', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: '恢复失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(backupApi.restoreSnapshot('snap-x')).rejects.toThrow(
        '恢复失败',
      );
    });
  });

  // ============================================================
  // import - 可选 mode 参数与 body 结构
  // ============================================================

  describe('import', () => {
    it('应该以 POST 请求 /api/backup/import 默认 mode=merge 并传递 JSON body', async () => {
      const data = { graphs: [], nodes: [] };
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ imported: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await backupApi.import(data);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/backup/import?mode=merge',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-123',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        },
      );
      expect(result).toEqual({ imported: true });
    });

    it('应该在 mode=replace 时附加 ?mode=replace', async () => {
      const data = { graphs: [{ id: 'g1' }] };
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ imported: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await backupApi.import(data, 'replace');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/backup/import?mode=replace',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
    });

    it('应该在响应失败时抛出 AppError 并携带响应中的 error 消息', async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ error: '导入失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(backupApi.import({})).rejects.toThrow('导入失败');
    });

    it('应该在响应失败且无 error 字段时使用默认错误消息', async () => {
      fetchSpy.mockResolvedValue(
        new Response('Bad Request', { status: 500 }),
      );

      await expect(backupApi.import({})).rejects.toThrow('Import failed');
    });
  });
});
