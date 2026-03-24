import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import {
  OfflineOperation,
  addToOfflineQueue,
  getOfflineQueue,
  getOfflineQueueCount,
  removeFromOfflineQueue,
  updateOfflineQueueOperation,
  clearOfflineQueue,
  initDB,
} from './offlineStorage';
import { createLogger } from './logger';
import { request } from '../services/api';
import { useStore } from '../store/useStore';

const logger = createLogger('BackgroundSync');

export interface SyncConflict {
  id: string;
  entity: string;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
  timestamp: number;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  lastSyncError: string | null;
  conflicts: SyncConflict[];
}

export interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge';
  mergedData?: Record<string, unknown>;
}

type SyncEventType = 'syncStart' | 'syncComplete' | 'syncError' | 'conflictDetected' | 'queueUpdated';

type SyncEventCallback = (data: unknown) => void;

const MAX_RETRY_COUNT = 3;

class BackgroundSyncManager {
  private isSyncing = false;
  private eventListeners = new Map<SyncEventType, Set<SyncEventCallback>>();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      await initDB();
      await this.setupNetworkListeners();
      this.checkAndSync();
    } catch (error) {
      logger.error('Failed to initialize BackgroundSyncManager', error);
    }
  }

  private async setupNetworkListeners(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await Network.addListener('networkStatusChange', (status) => {
        this.notifyListeners('queueUpdated', { isOnline: status.connected });
        if (status.connected) {
          this.checkAndSync();
        }
      });
    } else {
      window.addEventListener('online', () => {
        this.notifyListeners('queueUpdated', { isOnline: true });
        this.checkAndSync();
      });

      window.addEventListener('offline', () => {
        this.notifyListeners('queueUpdated', { isOnline: false });
      });
    }
  }

  private async checkAndSync() {
    const isOnline = await this.getIsOnline();
    if (isOnline) {
      await this.syncOfflineQueue();
    }
  }

  private async getIsOnline(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Network.getStatus();
        return status.connected;
      } catch {
        return navigator.onLine;
      }
    }
    return navigator.onLine;
  }

  private notifyListeners(event: SyncEventType, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  async addToQueue(item: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const id = await addToOfflineQueue(item);
    const count = await getOfflineQueueCount();
    this.notifyListeners('queueUpdated', { pendingCount: count });
    const isOnline = await this.getIsOnline();
    if (isOnline) {
      this.checkAndSync();
    }
    return id;
  }

  async removeFromQueue(operationId: string): Promise<void> {
    await removeFromOfflineQueue(operationId);
    const count = await getOfflineQueueCount();
    this.notifyListeners('queueUpdated', { pendingCount: count });
  }

  async syncOfflineQueue(): Promise<{ success: number; failed: number; conflicts: SyncConflict[] }> {
    const isOnline = await this.getIsOnline();
    if (this.isSyncing || !isOnline) {
      return { success: 0, failed: 0, conflicts: [] };
    }

    this.isSyncing = true;
    this.notifyListeners('syncStart', { timestamp: Date.now() });

    const queue = await getOfflineQueue();
    const results = { success: 0, failed: 0, conflicts: [] as SyncConflict[] };
    const failedItems: OfflineOperation[] = [];

    for (const item of queue) {
      try {
        const result = await this.syncItem(item);
        if (result.success) {
          results.success++;
          await removeFromOfflineQueue(item.id);
        } else if (result.conflict) {
          results.conflicts.push(result.conflict);
          this.notifyListeners('conflictDetected', result.conflict);
        } else {
          throw new Error(result.error || 'Sync failed');
        }
      } catch (error) {
        results.failed++;
        const updatedItem = {
          ...item,
          retryCount: item.retryCount + 1,
        };

        if (updatedItem.retryCount < MAX_RETRY_COUNT) {
          failedItems.push(updatedItem);
          await updateOfflineQueueOperation(item.id, { retryCount: updatedItem.retryCount });
        } else {
          await removeFromOfflineQueue(item.id);
        }
      }
    }

    this.isSyncing = false;

    const count = await getOfflineQueueCount();
    this.notifyListeners('queueUpdated', { pendingCount: count });
    this.notifyListeners('syncComplete', results);

    return results;
  }

  private async syncItem(
    item: OfflineOperation
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    try {
      const token = useStore.getState().token;
      if (!token) {
        return { success: false, error: 'No authentication token' };
      }

      const endpoints: Record<string, string> = {
        graph: '/graphs',
        node: '/nodes',
        edge: '/edges',
      };

      const baseUrl = endpoints[item.entityType] || `/${item.entityType}s`;
      let url = baseUrl;
      let method = 'POST';
      let body: Record<string, unknown> = item.data as Record<string, unknown> || {};

      switch (item.type) {
        case 'update':
          url = `${baseUrl}/${item.entityId}`;
          method = 'PATCH';
          break;
        case 'delete':
          url = `${baseUrl}/${item.entityId}`;
          method = 'DELETE';
          body = {};
          break;
      }

      try {
        await request(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
        });

        return { success: true };
      } catch (error: any) {
        if (error.code === 'CONFLICT' || error.status === 409) {
          return {
            success: false,
            conflict: {
              id: item.id,
              entity: item.entityType,
              localData: item.data as Record<string, unknown>,
              remoteData: error.data || {},
              timestamp: Date.now(),
            },
          };
        }

        return {
          success: false,
          error: error.message || 'Network error',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async handleSyncConflict(conflict: SyncConflict, resolution: ConflictResolution): Promise<void> {
    const queue = await getOfflineQueue();
    const itemIndex = queue.findIndex(item => item.id === conflict.id);

    if (itemIndex === -1) return;

    const item = queue[itemIndex];

    switch (resolution.strategy) {
      case 'local':
        await updateOfflineQueueOperation(item.id, { retryCount: 0 });
        break;
      case 'remote':
        await removeFromOfflineQueue(item.id);
        break;
      case 'merge':
        if (resolution.mergedData) {
          await updateOfflineQueueOperation(item.id, {
            data: resolution.mergedData,
            retryCount: 0,
          });
        }
        break;
    }

    const isOnline = await this.getIsOnline();
    if (isOnline && resolution.strategy !== 'remote') {
      await this.syncOfflineQueue();
    }
  }

  async getStatus(): Promise<SyncStatus> {
    const isOnline = await this.getIsOnline();
    const pendingCount = await getOfflineQueueCount();

    const defaults: SyncStatus = {
      isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncTime: null,
      lastSyncError: null,
      conflicts: [],
    };

    try {
      const stored = localStorage.getItem('sync_status');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed, isOnline, isSyncing: this.isSyncing };
      }
    } catch {
      logger.error('Failed to parse sync status');
    }

    return defaults;
  }

  on(event: SyncEventType, callback: SyncEventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  async clearQueue(): Promise<void> {
    await clearOfflineQueue();
    const count = await getOfflineQueueCount();
    this.notifyListeners('queueUpdated', { pendingCount: count });
  }

  async getPendingItems(): Promise<OfflineOperation[]> {
    return getOfflineQueue();
  }
}

const syncManager = new BackgroundSyncManager();

export const registerBackgroundSync = (): void => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('offline-sync');
    }).catch(error => {
      logger.error('Failed to register background sync', error);
    });
  }
};

export const syncOfflineQueue = (): Promise<{ success: number; failed: number; conflicts: SyncConflict[] }> => {
  return syncManager.syncOfflineQueue();
};

export const handleSyncConflict = (conflict: SyncConflict, resolution: ConflictResolution): Promise<void> => {
  return syncManager.handleSyncConflict(conflict, resolution);
};

export const getSyncStatus = (): Promise<SyncStatus> => {
  return syncManager.getStatus();
};

export const addToSyncQueue = (item: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> => {
  return syncManager.addToQueue(item);
};

export const removeFromSyncQueue = (operationId: string): Promise<void> => {
  return syncManager.removeFromQueue(operationId);
};

export const onSyncEvent = (event: SyncEventType, callback: SyncEventCallback): (() => void) => {
  return syncManager.on(event, callback);
};

export const clearSyncQueue = (): Promise<void> => {
  return syncManager.clearQueue();
};

export const getPendingSyncItems = (): Promise<OfflineOperation[]> => {
  return syncManager.getPendingItems();
};

export { syncManager };
