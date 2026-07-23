// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isCloudOnlyResource,
  isLocalDbAvailable,
  resetLocalDbAvailability,
  localQuery,
  localBatch,
  getLocalDbStatus,
  getSyncStatus,
  triggerSync,
  onSyncStatusChanged,
} from '../localClient';
import type { IpcDbRequest } from '@shared/types/ipc';

type MockFn = ReturnType<typeof vi.fn>;

interface ElectronAPIMock {
  db?: {
    getStatus?: MockFn;
    query?: MockFn;
    batch?: MockFn;
  };
  sync?: {
    getStatus?: MockFn;
    trigger?: MockFn;
    onStatusChanged?: MockFn;
  };
}

/** Build a successful DbStatus response for getStatus mocks. */
function makeReadyStatus(): {
  success: boolean;
  data: { isReady: boolean; pendingPushCounts: Record<string, number>; totalPendingPush: number };
} {
  return {
    success: true,
    data: {
      isReady: true,
      pendingPushCounts: {},
      totalPendingPush: 0,
    },
  };
}

/** Install a mock electronAPI on window (or remove it when undefined). */
function setElectronAPI(api: ElectronAPIMock | undefined): void {
  Object.defineProperty(window, 'electronAPI', {
    value: api,
    configurable: true,
    writable: true,
  });
}

/** Set up a fully available local DB mock and return the mock fns for customization. */
function setupAvailableDb(): { getStatus: MockFn; query: MockFn; batch: MockFn } {
  const getStatus = vi.fn().mockResolvedValue(makeReadyStatus());
  const query = vi.fn().mockResolvedValue({ success: true, data: null });
  const batch = vi.fn().mockResolvedValue({ success: true, data: [] });
  setElectronAPI({ db: { getStatus, query, batch } });
  return { getStatus, query, batch };
}

describe('localClient', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetLocalDbAvailability();
    setElectronAPI(undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    setElectronAPI(undefined);
    resetLocalDbAvailability();
  });

  describe('isCloudOnlyResource', () => {
    it('should identify cloud-only resources', () => {
      expect(isCloudOnlyResource('ai')).toBe(true);
      expect(isCloudOnlyResource('rag')).toBe(true);
      expect(isCloudOnlyResource('search')).toBe(true);
      expect(isCloudOnlyResource('agent')).toBe(true);
      expect(isCloudOnlyResource('embeddings')).toBe(true);
      expect(isCloudOnlyResource('literature')).toBe(true);
      expect(isCloudOnlyResource('auto_graph')).toBe(true);
      expect(isCloudOnlyResource('story')).toBe(true);
      expect(isCloudOnlyResource('podcast')).toBe(true);
    });

    it('should not flag local-capable resources', () => {
      expect(isCloudOnlyResource('graphs')).toBe(false);
      expect(isCloudOnlyResource('nodes')).toBe(false);
      expect(isCloudOnlyResource('edges')).toBe(false);
      expect(isCloudOnlyResource('study')).toBe(false);
      expect(isCloudOnlyResource('tasks')).toBe(false);
    });
  });

  describe('isLocalDbAvailable', () => {
    it('should return false when electronAPI is undefined', async () => {
      const available = await isLocalDbAvailable();
      expect(available).toBe(false);
    });

    it('should return false when db is missing', async () => {
      setElectronAPI({});
      const available = await isLocalDbAvailable();
      expect(available).toBe(false);
    });

    it('should return false when db.getStatus is missing', async () => {
      setElectronAPI({ db: { query: vi.fn(), batch: vi.fn() } });
      const available = await isLocalDbAvailable();
      expect(available).toBe(false);
    });

    it('should return false when getStatus throws', async () => {
      const getStatus = vi.fn().mockRejectedValue(new Error('IPC error'));
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      const available = await isLocalDbAvailable();
      expect(available).toBe(false);
      expect(getStatus).toHaveBeenCalledTimes(1);
    });

    it('should return false when response.success is false', async () => {
      const getStatus = vi.fn().mockResolvedValue({ success: false, error: 'not ready' });
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      const available = await isLocalDbAvailable();
      expect(available).toBe(false);
    });

    it('should return false when data.isReady is not true', async () => {
      const getStatus = vi.fn().mockResolvedValue({
        success: true,
        data: { isReady: false, pendingPushCounts: {}, totalPendingPush: 0 },
      });
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      const available = await isLocalDbAvailable();
      expect(available).toBe(false);
    });

    it('should return true when db is ready', async () => {
      const getStatus = vi.fn().mockResolvedValue(makeReadyStatus());
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      const available = await isLocalDbAvailable();
      expect(available).toBe(true);
      expect(getStatus).toHaveBeenCalledTimes(1);
    });

    it('should cache true result without re-calling getStatus', async () => {
      const getStatus = vi.fn().mockResolvedValue(makeReadyStatus());
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      await isLocalDbAvailable();
      await isLocalDbAvailable();
      expect(getStatus).toHaveBeenCalledTimes(1);
    });

    it('should cache false result without re-calling getStatus', async () => {
      const getStatus = vi.fn().mockResolvedValue({ success: false });
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      await isLocalDbAvailable();
      await isLocalDbAvailable();
      expect(getStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetLocalDbAvailability', () => {
    it('should reset cache so next isLocalDbAvailable call re-checks status', async () => {
      const getStatus = vi.fn().mockResolvedValue(makeReadyStatus());
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      await isLocalDbAvailable();
      expect(getStatus).toHaveBeenCalledTimes(1);
      resetLocalDbAvailability();
      await isLocalDbAvailable();
      expect(getStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('localQuery', () => {
    const request: IpcDbRequest = { resource: 'graphs', method: 'findAll', params: {} };

    it('should return null when electronAPI is not available', async () => {
      const result = await localQuery(request);
      expect(result).toBeNull();
    });

    it('should return null for cloud-only resources without checking DB', async () => {
      const { getStatus } = setupAvailableDb();
      const result = await localQuery({ resource: 'ai', method: 'findAll', params: {} });
      expect(result).toBeNull();
      expect(getStatus).not.toHaveBeenCalled();
    });

    it('should return null when electronAPI is removed after availability check', async () => {
      setupAvailableDb();
      await isLocalDbAvailable();
      setElectronAPI(undefined);
      const result = await localQuery(request);
      expect(result).toBeNull();
    });

    it('should return null and warn when query response is not successful', async () => {
      const { getStatus, batch } = setupAvailableDb();
      const query = vi.fn().mockResolvedValue({ success: false, error: 'DB error' });
      setElectronAPI({ db: { getStatus, query, batch } });
      const result = await localQuery(request);
      expect(result).toBeNull();
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(request);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should return data when query is successful', async () => {
      const { getStatus, batch } = setupAvailableDb();
      const query = vi.fn().mockResolvedValue({
        success: true,
        data: { id: '1', name: 'test' },
      });
      setElectronAPI({ db: { getStatus, query, batch } });
      const result = await localQuery<{ id: string; name: string }>(request);
      expect(result).toEqual({ id: '1', name: 'test' });
      expect(query).toHaveBeenCalledWith(request);
    });

    it('should return null, warn, and reset availability when query throws', async () => {
      const { getStatus, batch } = setupAvailableDb();
      const query = vi.fn().mockRejectedValue(new Error('IPC crashed'));
      setElectronAPI({ db: { getStatus, query, batch } });
      const result = await localQuery(request);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      // After error, availability should be reset — next call re-checks getStatus
      await isLocalDbAvailable();
      expect(getStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('localBatch', () => {
    const operations: IpcDbRequest[] = [
      { resource: 'graphs', method: 'findAll', params: {} },
      { resource: 'nodes', method: 'findAll', params: {} },
    ];

    it('should return null when DB is not available', async () => {
      const result = await localBatch(operations);
      expect(result).toBeNull();
    });

    it('should return null when any operation is cloud-only', async () => {
      const { getStatus } = setupAvailableDb();
      const mixedOps: IpcDbRequest[] = [
        { resource: 'graphs', method: 'findAll', params: {} },
        { resource: 'ai', method: 'findAll', params: {} },
      ];
      const result = await localBatch(mixedOps);
      expect(result).toBeNull();
      expect(getStatus).not.toHaveBeenCalled();
    });

    it('should return null when electronAPI is removed after availability check', async () => {
      setupAvailableDb();
      await isLocalDbAvailable();
      setElectronAPI(undefined);
      const result = await localBatch(operations);
      expect(result).toBeNull();
    });

    it('should return null and warn when batch response is not successful', async () => {
      const { getStatus, query } = setupAvailableDb();
      const batch = vi.fn().mockResolvedValue({ success: false, error: 'batch failed' });
      setElectronAPI({ db: { getStatus, query, batch } });
      const result = await localBatch(operations);
      expect(result).toBeNull();
      expect(batch).toHaveBeenCalledWith(operations);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should return data array when batch is successful', async () => {
      const { getStatus, query } = setupAvailableDb();
      const batch = vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: 'g1' }, { id: 'n1' }],
      });
      setElectronAPI({ db: { getStatus, query, batch } });
      const result = await localBatch<{ id: string }>(operations);
      expect(result).toEqual([{ id: 'g1' }, { id: 'n1' }]);
      expect(batch).toHaveBeenCalledWith(operations);
    });

    it('should return null, warn, and reset availability when batch throws', async () => {
      const { getStatus, query } = setupAvailableDb();
      const batch = vi.fn().mockRejectedValue(new Error('IPC batch crashed'));
      setElectronAPI({ db: { getStatus, query, batch } });
      const result = await localBatch(operations);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      await isLocalDbAvailable();
      expect(getStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('getLocalDbStatus', () => {
    it('should return null when DB is not available', async () => {
      const result = await getLocalDbStatus();
      expect(result).toBeNull();
    });

    it('should return null when electronAPI is removed after availability check', async () => {
      setupAvailableDb();
      await isLocalDbAvailable();
      setElectronAPI(undefined);
      const result = await getLocalDbStatus();
      expect(result).toBeNull();
    });

    it('should return null when getStatus response is not successful', async () => {
      const getStatus = vi.fn().mockResolvedValue(makeReadyStatus());
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      await isLocalDbAvailable();
      getStatus.mockResolvedValueOnce({ success: false, error: 'status error' });
      const result = await getLocalDbStatus();
      expect(result).toBeNull();
    });

    it('should return status data when getStatus is successful', async () => {
      const statusData = {
        isReady: true,
        pendingPushCounts: { graphs: 3 },
        totalPendingPush: 3,
      };
      const getStatus = vi.fn().mockResolvedValue({ success: true, data: statusData });
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      const result = await getLocalDbStatus();
      expect(result).toEqual(statusData);
    });

    it('should return null when getStatus throws', async () => {
      const getStatus = vi.fn().mockResolvedValue(makeReadyStatus());
      setElectronAPI({ db: { getStatus, query: vi.fn(), batch: vi.fn() } });
      await isLocalDbAvailable();
      getStatus.mockRejectedValueOnce(new Error('status crash'));
      const result = await getLocalDbStatus();
      expect(result).toBeNull();
    });
  });

  describe('getSyncStatus', () => {
    it('should return null when electronAPI is undefined', async () => {
      const result = await getSyncStatus();
      expect(result).toBeNull();
    });

    it('should return null when sync.getStatus is missing', async () => {
      setElectronAPI({ sync: {} });
      const result = await getSyncStatus();
      expect(result).toBeNull();
    });

    it('should return data when response is successful', async () => {
      const syncData = { isRunning: true, isOnline: true };
      const getStatus = vi.fn().mockResolvedValue({ success: true, data: syncData });
      setElectronAPI({ sync: { getStatus } });
      const result = await getSyncStatus();
      expect(result).toEqual(syncData);
      expect(getStatus).toHaveBeenCalledTimes(1);
    });

    it('should return null when response is not successful', async () => {
      const getStatus = vi.fn().mockResolvedValue({ success: false, error: 'sync error' });
      setElectronAPI({ sync: { getStatus } });
      const result = await getSyncStatus();
      expect(result).toBeNull();
    });

    it('should return null when getStatus throws', async () => {
      const getStatus = vi.fn().mockRejectedValue(new Error('sync crash'));
      setElectronAPI({ sync: { getStatus } });
      const result = await getSyncStatus();
      expect(result).toBeNull();
    });
  });

  describe('triggerSync', () => {
    it('should return false when electronAPI is undefined', async () => {
      const result = await triggerSync();
      expect(result).toBe(false);
    });

    it('should return false when sync.trigger is missing', async () => {
      setElectronAPI({ sync: {} });
      const result = await triggerSync();
      expect(result).toBe(false);
    });

    it('should return true when trigger response is successful', async () => {
      const trigger = vi.fn().mockResolvedValue({ success: true });
      setElectronAPI({ sync: { trigger } });
      const result = await triggerSync();
      expect(result).toBe(true);
      expect(trigger).toHaveBeenCalledTimes(1);
    });

    it('should return false when trigger response is not successful', async () => {
      const trigger = vi.fn().mockResolvedValue({ success: false });
      setElectronAPI({ sync: { trigger } });
      const result = await triggerSync();
      expect(result).toBe(false);
    });

    it('should return false when trigger throws', async () => {
      const trigger = vi.fn().mockRejectedValue(new Error('trigger crash'));
      setElectronAPI({ sync: { trigger } });
      const result = await triggerSync();
      expect(result).toBe(false);
    });
  });

  describe('onSyncStatusChanged', () => {
    it('should return a noop function when electronAPI is undefined', () => {
      const unsubscribe = onSyncStatusChanged(() => {});
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should return a noop function when sync.onStatusChanged is missing', () => {
      setElectronAPI({ sync: {} });
      const unsubscribe = onSyncStatusChanged(() => {});
      expect(typeof unsubscribe).toBe('function');
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should call sync.onStatusChanged with callback and return its result', () => {
      const unsubscribeMock = vi.fn();
      const onStatusChanged = vi.fn().mockReturnValue(unsubscribeMock);
      setElectronAPI({ sync: { onStatusChanged } });
      const callback = (_status: unknown): void => {};
      const result = onSyncStatusChanged(callback);
      expect(onStatusChanged).toHaveBeenCalledTimes(1);
      expect(onStatusChanged).toHaveBeenCalledWith(callback);
      expect(result).toBe(unsubscribeMock);
    });
  });
});
