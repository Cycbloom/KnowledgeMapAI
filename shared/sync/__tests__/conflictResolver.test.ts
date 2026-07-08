import { describe, it, expect } from 'vitest';
import {
  autoResolveConflict,
  resolveConflict,
  autoResolveConflicts,
} from '../conflictResolver';
import type { SyncConflict, SyncOperation } from '../types';

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

function makeConflict(
  local: SyncOperation,
  remote: SyncOperation,
): SyncConflict {
  return {
    id: `conflict-${local.table}-${local.recordId}`,
    table: local.table,
    recordId: local.recordId,
    localVersion: local,
    remoteVersion: remote,
    resolved: false,
  };
}

describe('conflictResolver', () => {
  describe('autoResolveConflict', () => {
    it('默认 Cloud Wins：返回 remote 版本', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程' });
      const conflict = makeConflict(local, remote);

      const result = autoResolveConflict(conflict);

      expect(result).toBe(remote);
      expect(result?.data).toEqual({ name: '远程' });
    });

    it('返回值就是 conflict.remoteVersion 引用', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程' });
      const conflict = makeConflict(local, remote);

      const result = autoResolveConflict(conflict);

      // Cloud Wins 直接返回 remoteVersion
      expect(result).toBe(conflict.remoteVersion);
    });
  });

  describe('resolveConflict', () => {
    it('resolution=local → 返回 localVersion', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程' });
      const conflict = makeConflict(local, remote);

      const result = resolveConflict(conflict, 'local');

      expect(result).toBe(local);
      expect(result.data).toEqual({ name: '本地' });
    });

    it('resolution=remote → 返回 remoteVersion', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程' });
      const conflict = makeConflict(local, remote);

      const result = resolveConflict(conflict, 'remote');

      expect(result).toBe(remote);
      expect(result.data).toEqual({ name: '远程' });
    });

    it('resolution=merge → 合并 local 与 remote 数据', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地', color: 'red' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程', size: 10 });
      const conflict = makeConflict(local, remote);

      const result = resolveConflict(conflict, 'merge');

      // action 为 update
      expect(result.action).toBe('update');
      // table 与 recordId 取自 local
      expect(result.table).toBe('graphs');
      expect(result.recordId).toBe('g1');
      // userId 取自 local
      expect(result.userId).toBe('user-1');
      // 合并数据：remote 覆盖 local（同名字段 remote 胜出）
      expect(result.data).toHaveProperty('color', 'red');
      expect(result.data).toHaveProperty('size', 10);
      expect(result.data).toHaveProperty('name', '远程');
    });

    it('resolution=merge → 合并后包含 updated_at 字段', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程' });
      const conflict = makeConflict(local, remote);

      const result = resolveConflict(conflict, 'merge');

      expect(result.data).toHaveProperty('updated_at');
      expect(typeof result.data.updated_at).toBe('string');
    });

    it('resolution=merge → 保留 local 的 created_at', () => {
      const local = makeOp('update', 'graphs', 'g1', {
        name: '本地',
        created_at: '2026-01-01',
      });
      const remote = makeOp('update', 'graphs', 'g1', {
        name: '远程',
        created_at: '2026-12-01',
      });
      const conflict = makeConflict(local, remote);

      const result = resolveConflict(conflict, 'merge');

      // 优先保留 local 的 created_at
      expect(result.data.created_at).toBe('2026-01-01');
    });

    it('resolution=merge → local 无 created_at 时取 remote 的', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', {
        name: '远程',
        created_at: '2026-12-01',
      });
      const conflict = makeConflict(local, remote);

      const result = resolveConflict(conflict, 'merge');

      expect(result.data.created_at).toBe('2026-12-01');
    });

    it('resolution=merge → 合并后 id 以 merged- 开头', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程' });
      const conflict = makeConflict(local, remote);

      const result = resolveConflict(conflict, 'merge');

      expect(result.id).toMatch(/^merged-/);
    });

    it('resolution=merge → 两次调用生成不同 id（含随机性）', () => {
      const local = makeOp('update', 'graphs', 'g1', { name: '本地' });
      const remote = makeOp('update', 'graphs', 'g1', { name: '远程' });
      const conflict = makeConflict(local, remote);

      const result1 = resolveConflict(conflict, 'merge');
      const result2 = resolveConflict(conflict, 'merge');

      // id 含 Date.now() 与 Math.random()，应不同
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('autoResolveConflicts', () => {
    it('批量解决多个冲突，返回 resolved 数组', () => {
      const conflicts = [
        makeConflict(
          makeOp('update', 'graphs', 'g1', { name: '本地1' }),
          makeOp('update', 'graphs', 'g1', { name: '远程1' }),
        ),
        makeConflict(
          makeOp('update', 'graphs', 'g2', { name: '本地2' }),
          makeOp('update', 'graphs', 'g2', { name: '远程2' }),
        ),
      ];

      const { resolved, unresolved } = autoResolveConflicts(conflicts);

      expect(resolved).toHaveLength(2);
      expect(unresolved).toHaveLength(0);
      // Cloud Wins：返回远程版本
      expect(resolved[0].data).toEqual({ name: '远程1' });
      expect(resolved[1].data).toEqual({ name: '远程2' });
    });

    it('解决后标记 conflict.resolved=true 与 resolution=remote', () => {
      const conflicts = [
        makeConflict(
          makeOp('update', 'graphs', 'g1', { name: '本地' }),
          makeOp('update', 'graphs', 'g1', { name: '远程' }),
        ),
      ];

      autoResolveConflicts(conflicts);

      expect(conflicts[0].resolved).toBe(true);
      expect(conflicts[0].resolution).toBe('remote');
    });

    it('空冲突列表返回空 resolved 与 unresolved', () => {
      const { resolved, unresolved } = autoResolveConflicts([]);

      expect(resolved).toHaveLength(0);
      expect(unresolved).toHaveLength(0);
    });

    it('所有 conflict 均可自动解决（remoteVersion 非空）→ unresolved 为空', () => {
      const conflicts = [
        makeConflict(
          makeOp('update', 'graphs', 'g1', { name: '本地' }),
          makeOp('update', 'graphs', 'g1', { name: '远程' }),
        ),
        makeConflict(
          makeOp('delete', 'graphs', 'g2', {}),
          makeOp('delete', 'graphs', 'g2', {}),
        ),
      ];

      const { resolved, unresolved } = autoResolveConflicts(conflicts);

      expect(resolved).toHaveLength(2);
      expect(unresolved).toHaveLength(0);
    });
  });
});
