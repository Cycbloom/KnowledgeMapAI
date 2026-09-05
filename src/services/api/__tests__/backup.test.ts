import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request/requestBlob from ../client（backup.ts 统一走 client 出口，
// 鉴权/CSRF/地址解析由 client 拦截器负责，此处只断言调用契约与错误传播）
vi.mock('../client', () => ({
  request: vi.fn(),
  requestBlob: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { backupApi, type BackupSnapshot } from '../backup';
import { request, requestBlob } from '../client';
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
  beforeEach(() => {
    vi.mocked(request).mockReset();
    vi.mocked(requestBlob).mockReset();
  });

  // ============================================================
  // export
  // ============================================================

  describe('export', () => {
    it('应该调用 requestBlob 请求 /backup/export 并返回 blob', async () => {
      const blob = new Blob(['backup-data'], { type: 'application/zip' });
      vi.mocked(requestBlob).mockResolvedValue(blob);

      const result = await backupApi.export();

      expect(requestBlob).toHaveBeenCalledWith('/backup/export');
      expect(result).toBeInstanceOf(Blob);
    });

    it('应该在 requestBlob 失败时原样抛出 AppError', async () => {
      const err = new AppError(
        'Export failed',
        SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        500,
      );
      vi.mocked(requestBlob).mockRejectedValue(err);

      await expect(backupApi.export()).rejects.toBe(err);
    });
  });

  // ============================================================
  // getSnapshots
  // ============================================================

  describe('getSnapshots', () => {
    it('应该以 GET 请求 /backup/snapshots 并返回 snapshots 数组', async () => {
      vi.mocked(request).mockResolvedValue({ snapshots: [mockSnapshot] });

      const result = await backupApi.getSnapshots();

      expect(request).toHaveBeenCalledWith('/backup/snapshots');
      expect(result).toEqual([mockSnapshot]);
    });

    it('应该在响应中无 snapshots 字段时返回空数组', async () => {
      vi.mocked(request).mockResolvedValue({});

      const result = await backupApi.getSnapshots();

      expect(result).toEqual([]);
    });

    it('应该在请求失败时原样抛出 AppError', async () => {
      const err = new AppError(
        'Server Error',
        SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        500,
      );
      vi.mocked(request).mockRejectedValue(err);

      await expect(backupApi.getSnapshots()).rejects.toMatchObject({
        code: SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
      });
    });
  });

  // ============================================================
  // createSnapshot
  // ============================================================

  describe('createSnapshot', () => {
    it('应该以 POST 请求 /backup/snapshots 默认 type=manual 并传递 JSON body', async () => {
      vi.mocked(request).mockResolvedValue({ id: 'snap-2' });

      const result = await backupApi.createSnapshot();

      expect(request).toHaveBeenCalledWith('/backup/snapshots', {
        method: 'POST',
        body: JSON.stringify({ type: 'manual' }),
      });
      expect(result).toEqual({ id: 'snap-2' });
    });

    it('应该在请求失败时原样抛出 AppError', async () => {
      const err = new AppError(
        '磁盘空间不足',
        SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        500,
      );
      vi.mocked(request).mockRejectedValue(err);

      await expect(backupApi.createSnapshot()).rejects.toThrow('磁盘空间不足');
    });
  });

  // ============================================================
  // deleteSnapshot - 路径插值与编码
  // ============================================================

  describe('deleteSnapshot', () => {
    it('应该以 DELETE 请求 /backup/snapshots/{id} 并对路径参数进行编码', async () => {
      vi.mocked(request).mockResolvedValue({ success: true });

      const result = await backupApi.deleteSnapshot('snap/1');

      expect(request).toHaveBeenCalledWith(
        '/backup/snapshots/snap%2F1',
        { method: 'DELETE' },
      );
      expect(result).toEqual({ success: true });
    });

    it('应该在请求失败时原样抛出 AppError', async () => {
      const err = new AppError(
        '快照不存在',
        SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        500,
      );
      vi.mocked(request).mockRejectedValue(err);

      await expect(backupApi.deleteSnapshot('snap-x')).rejects.toThrow(
        '快照不存在',
      );
    });
  });

  // ============================================================
  // restoreSnapshot - 路径插值与编码
  // ============================================================

  describe('restoreSnapshot', () => {
    it('应该以 POST 请求 /backup/restore/{id} 并对路径参数进行编码', async () => {
      vi.mocked(request).mockResolvedValue({ restored: true });

      const result = await backupApi.restoreSnapshot('snap 1');

      expect(request).toHaveBeenCalledWith(
        '/backup/restore/snap%201',
        { method: 'POST' },
      );
      expect(result).toEqual({ restored: true });
    });

    it('应该在请求失败时原样抛出 AppError', async () => {
      const err = new AppError(
        '恢复失败',
        SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        500,
      );
      vi.mocked(request).mockRejectedValue(err);

      await expect(backupApi.restoreSnapshot('snap-x')).rejects.toThrow(
        '恢复失败',
      );
    });
  });

  // ============================================================
  // import - 可选 mode 参数与 body 结构
  // ============================================================

  describe('import', () => {
    it('应该以 POST 请求 /backup/import 默认 mode=merge 并传递 JSON body', async () => {
      const data = { graphs: [], nodes: [] };
      vi.mocked(request).mockResolvedValue({ imported: true });

      const result = await backupApi.import(data);

      expect(request).toHaveBeenCalledWith('/backup/import?mode=merge', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      expect(result).toEqual({ imported: true });
    });

    it('应该在 mode=replace 时附加 ?mode=replace', async () => {
      const data = { graphs: [{ id: 'g1' }] };
      vi.mocked(request).mockResolvedValue({ imported: true });

      await backupApi.import(data, 'replace');

      expect(request).toHaveBeenCalledWith(
        '/backup/import?mode=replace',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
    });

    it('应该在请求失败时原样抛出 AppError', async () => {
      const err = new AppError(
        '导入失败',
        SharedErrorCodes.SYSTEM_INTERNAL_ERROR,
        500,
      );
      vi.mocked(request).mockRejectedValue(err);

      await expect(backupApi.import({})).rejects.toThrow('导入失败');
    });
  });
});
