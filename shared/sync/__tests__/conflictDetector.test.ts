import { describe, it, expect } from 'vitest';
import { detectConflict } from '../conflictDetector';
import type { SyncOperation } from '../types';

function makeOp(
  action: SyncOperation['action'],
  table: string,
  recordId: string,
  data: Record<string, unknown> = {},
  timestamp = '2026-01-01T00:00:00Z',
): SyncOperation {
  return {
    id: `${action}-${table}-${recordId}-${timestamp}`,
    action,
    table,
    recordId,
    data,
    timestamp,
    userId: 'user-1',
  };
}

describe('detectConflict', () => {
  describe('table 与 recordId 匹配', () => {
    it('不同 table 不视为冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('update', 'nodes', 'g1', { name: 'B' });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('不同 recordId 不视为冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('update', 'graphs', 'g2', { name: 'B' });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('同 table 同 recordId 才可能冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('update', 'graphs', 'g1', { name: 'B' });
      expect(detectConflict(local, remote)).toBe(true);
    });
  });

  describe('delete 与非 delete 组合', () => {
    it('local delete + remote update → 冲突', () => {
      const local = makeOp('delete', 'graphs', 'g1', {});
      const remote = makeOp('update', 'graphs', 'g1', { name: 'A' });
      expect(detectConflict(local, remote)).toBe(true);
    });

    it('local update + remote delete → 冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('delete', 'graphs', 'g1', {});
      expect(detectConflict(local, remote)).toBe(true);
    });

    it('local delete + remote create → 冲突', () => {
      const local = makeOp('delete', 'graphs', 'g1', {});
      const remote = makeOp('create', 'graphs', 'g1', { name: 'A' });
      expect(detectConflict(local, remote)).toBe(true);
    });

    it('local create + remote delete → 冲突', () => {
      const local = makeOp('create', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('delete', 'graphs', 'g1', {});
      expect(detectConflict(local, remote)).toBe(true);
    });
  });

  describe('两个 update 字段级冲突', () => {
    it('同字段不同值 → 冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('update', 'graphs', 'g1', { name: 'B' });
      expect(detectConflict(local, remote)).toBe(true);
    });

    it('字段不相交 → 不冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('update', 'graphs', 'g1', { color: 'red' });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('同字段同值 → 不冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('update', 'graphs', 'g1', { name: 'A' });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('仅 created_at 不同 → 不冲突（跳过自动字段）', () => {
      const local = makeOp('update', 'graphs', 'g1', {
        name: 'A',
        created_at: '2026-01-01',
      });
      const remote = makeOp('update', 'graphs', 'g1', {
        name: 'A',
        created_at: '2026-02-01',
      });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('仅 updated_at 不同 → 不冲突（跳过自动字段）', () => {
      const local = makeOp('update', 'graphs', 'g1', {
        updated_at: '2026-01-01',
      });
      const remote = makeOp('update', 'graphs', 'g1', {
        updated_at: '2026-02-01',
      });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('仅 id 不同 → 不冲突（跳过自动字段）', () => {
      const local = makeOp('update', 'graphs', 'g1', { id: 'local-id' });
      const remote = makeOp('update', 'graphs', 'g1', { id: 'remote-id' });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('自动字段不同 + 业务字段不同 → 冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', {
        name: 'A',
        updated_at: '2026-01-01',
      });
      const remote = makeOp('update', 'graphs', 'g1', {
        name: 'B',
        updated_at: '2026-02-01',
      });
      expect(detectConflict(local, remote)).toBe(true);
    });

    it('空 data 互不冲突', () => {
      const local = makeOp('update', 'graphs', 'g1', {});
      const remote = makeOp('update', 'graphs', 'g1', {});
      expect(detectConflict(local, remote)).toBe(false);
    });
  });

  describe('非冲突组合', () => {
    it('两个 create 不视为冲突', () => {
      const local = makeOp('create', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('create', 'graphs', 'g1', { name: 'B' });
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('两个 delete 不视为冲突', () => {
      const local = makeOp('delete', 'graphs', 'g1', {});
      const remote = makeOp('delete', 'graphs', 'g1', {});
      expect(detectConflict(local, remote)).toBe(false);
    });

    it('local create + remote update（同字段同值）不冲突', () => {
      const local = makeOp('create', 'graphs', 'g1', { name: 'A' });
      const remote = makeOp('update', 'graphs', 'g1', { name: 'A' });
      // create + update 非 delete 组合，但只有 update+update 才走字段检测
      // create + update 走 default → false
      expect(detectConflict(local, remote)).toBe(false);
    });
  });
});
