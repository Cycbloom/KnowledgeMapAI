import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { graphVersionsApi } from '../graphVersions';
import { request } from '../client';

// --- Tests ---

describe('graphVersionsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('listSnapshots - 分页参数', () => {
    it('应该使用默认 page=1 与 pageSize=20 请求 /graphs/{graphId}/snapshots', async () => {
      await graphVersionsApi.listSnapshots('graph-1');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/snapshots?page=1&pageSize=20',
      );
    });

    it('应该在传入 page 与 pageSize 时拼接对应查询参数', async () => {
      await graphVersionsApi.listSnapshots('graph-1', 3, 50);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/snapshots?page=3&pageSize=50',
      );
    });
  });

  describe('createSnapshot - 可选 description', () => {
    it('应该在不传 description 时以 POST 请求并 body.description 为 undefined', async () => {
      await graphVersionsApi.createSnapshot('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/snapshots', {
        method: 'POST',
        body: JSON.stringify({ description: undefined }),
      });
    });

    it('应该在传入 description 时以 POST 请求并传递 JSON body', async () => {
      await graphVersionsApi.createSnapshot('graph-1', '初始快照');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/snapshots', {
        method: 'POST',
        body: JSON.stringify({ description: '初始快照' }),
      });
    });
  });

  describe('getSnapshot - 路径插值', () => {
    it('应该请求 /graphs/{graphId}/snapshots/{snapshotId}', async () => {
      await graphVersionsApi.getSnapshot('graph-1', 'snap-1');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/snapshots/snap-1',
      );
    });
  });

  describe('diff - URLSearchParams 构造', () => {
    it('应该在不传 targetSnapshotId 时仅附加 sourceSnapshotId', async () => {
      await graphVersionsApi.diff('graph-1', 'snap-1');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/diff?sourceSnapshotId=snap-1',
      );
    });

    it('应该在传入 targetSnapshotId 时附加两个查询参数', async () => {
      await graphVersionsApi.diff('graph-1', 'snap-1', 'snap-2');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/diff?sourceSnapshotId=snap-1&targetSnapshotId=snap-2',
      );
    });
  });

  describe('rollback - POST 与 body', () => {
    it('应该以 POST 请求 /graphs/{graphId}/rollback 并传递 snapshotId', async () => {
      await graphVersionsApi.rollback('graph-1', 'snap-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/rollback', {
        method: 'POST',
        body: JSON.stringify({ snapshotId: 'snap-1' }),
      });
    });
  });

  describe('createBranch - POST 与 body', () => {
    it('应该以 POST 请求 /graphs/{graphId}/branches 并传递 branchName', async () => {
      await graphVersionsApi.createBranch('graph-1', 'feature-x');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/branches', {
        method: 'POST',
        body: JSON.stringify({ branchName: 'feature-x' }),
      });
    });
  });

  describe('listBranches - GET', () => {
    it('应该请求 /graphs/{graphId}/branches', async () => {
      await graphVersionsApi.listBranches('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/branches');
    });
  });

  describe('merge - 可选 selectedChanges 与 conflictResolutions', () => {
    it('应该在不传可选参数时以 POST 请求并 body 中可选项为 undefined', async () => {
      await graphVersionsApi.merge('graph-1', 'branch-graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/merge', {
        method: 'POST',
        body: JSON.stringify({
          branchGraphId: 'branch-graph-1',
          selectedChanges: undefined,
          conflictResolutions: undefined,
        }),
      });
    });

    it('应该在传入 selectedChanges 时序列化到 body', async () => {
      await graphVersionsApi.merge('graph-1', 'branch-graph-1', {
        nodeIds: ['node-1', 'node-2'],
        edgeIds: ['edge-1'],
      });
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/merge', {
        method: 'POST',
        body: JSON.stringify({
          branchGraphId: 'branch-graph-1',
          selectedChanges: {
            nodeIds: ['node-1', 'node-2'],
            edgeIds: ['edge-1'],
          },
          conflictResolutions: undefined,
        }),
      });
    });

    it('应该在传入 conflictResolutions 时序列化到 body', async () => {
      await graphVersionsApi.merge(
        'graph-1',
        'branch-graph-1',
        undefined,
        { conflict1: 'main', conflict2: 'branch' },
      );
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/merge', {
        method: 'POST',
        body: JSON.stringify({
          branchGraphId: 'branch-graph-1',
          selectedChanges: undefined,
          conflictResolutions: { conflict1: 'main', conflict2: 'branch' },
        }),
      });
    });

    it('应该在同时传入 selectedChanges 与 conflictResolutions 时全部序列化', async () => {
      await graphVersionsApi.merge(
        'graph-1',
        'branch-graph-1',
        { nodeIds: ['node-1'] },
        { conflict1: 'branch' },
      );
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/merge', {
        method: 'POST',
        body: JSON.stringify({
          branchGraphId: 'branch-graph-1',
          selectedChanges: { nodeIds: ['node-1'] },
          conflictResolutions: { conflict1: 'branch' },
        }),
      });
    });
  });

  describe('mergePreview - GET 与查询参数', () => {
    it('应该请求 /graphs/{graphId}/merge-preview?branchGraphId={branchGraphId}', async () => {
      await graphVersionsApi.mergePreview('graph-1', 'branch-graph-1');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/merge-preview?branchGraphId=branch-graph-1',
      );
    });
  });

  describe('listEvents - URLSearchParams 构造', () => {
    it('应该使用默认 page=1 与 pageSize=20 请求 /graphs/{graphId}/events', async () => {
      await graphVersionsApi.listEvents('graph-1');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/events?page=1&pageSize=20',
      );
    });

    it('应该在传入自定义 page 与 pageSize 时拼接对应查询参数', async () => {
      await graphVersionsApi.listEvents('graph-1', 2, 50);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/events?page=2&pageSize=50',
      );
    });

    it('应该在传入 batchId 时附加 ?batchId={value}', async () => {
      await graphVersionsApi.listEvents('graph-1', 1, 20, 'batch-1');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/events?page=1&pageSize=20&batchId=batch-1',
      );
    });

    it('应该在传入 eventType 时附加 ?eventType={value}', async () => {
      await graphVersionsApi.listEvents('graph-1', 1, 20, undefined, 'create');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/events?page=1&pageSize=20&eventType=create',
      );
    });

    it('应该在传入全部参数时按顺序拼接所有查询参数', async () => {
      await graphVersionsApi.listEvents('graph-1', 2, 50, 'batch-1', 'update');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/events?page=2&pageSize=50&batchId=batch-1&eventType=update',
      );
    });
  });
});
