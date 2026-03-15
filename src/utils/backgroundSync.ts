export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

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

const SYNC_QUEUE_KEY = 'sync_queue';
const SYNC_STATUS_KEY = 'sync_status';
const MAX_RETRY_COUNT = 3;

class BackgroundSyncManager {
  private isSyncing = false;
  private eventListeners = new Map<SyncEventType, Set<SyncEventCallback>>();

  constructor() {
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.notifyListeners('queueUpdated', { isOnline: true });
      this.syncOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.notifyListeners('queueUpdated', { isOnline: false });
    });
  }

  private notifyListeners(event: SyncEventType, data: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  private getQueue(): SyncQueueItem[] {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: SyncQueueItem[]): void {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    this.notifyListeners('queueUpdated', { pendingCount: queue.length });
  }

  private updateStatus(updates: Partial<SyncStatus>): void {
    try {
      const current = this.getStatus();
      const updated = { ...current, ...updates };
      localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updated));
    } catch {
      console.error('[BackgroundSync] Failed to update status');
    }
  }

  addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): string {
    const queue = this.getQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `${item.entity}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    queue.push(newItem);
    this.saveQueue(queue);
    return newItem.id;
  }

  removeFromQueue(itemId: string): void {
    const queue = this.getQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    this.saveQueue(filtered);
  }

  async syncOfflineQueue(): Promise<{ success: number; failed: number; conflicts: SyncConflict[] }> {
    if (this.isSyncing || !navigator.onLine) {
      return { success: 0, failed: 0, conflicts: [] };
    }

    this.isSyncing = true;
    this.updateStatus({ isSyncing: true });
    this.notifyListeners('syncStart', { timestamp: Date.now() });

    const queue = this.getQueue();
    const results = { success: 0, failed: 0, conflicts: [] as SyncConflict[] };
    const failedItems: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        const result = await this.syncItem(item);
        if (result.success) {
          results.success++;
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
          lastError: error instanceof Error ? error.message : 'Unknown error',
        };

        if (updatedItem.retryCount < MAX_RETRY_COUNT) {
          failedItems.push(updatedItem);
        }
      }
    }

    this.saveQueue(failedItems);
    this.isSyncing = false;

    const status: Partial<SyncStatus> = {
      isSyncing: false,
      lastSyncTime: Date.now(),
      lastSyncError: results.failed > 0 ? `${results.failed} items failed to sync` : null,
    };
    this.updateStatus(status);

    this.notifyListeners('syncComplete', results);

    return results;
  }

  private async syncItem(
    item: SyncQueueItem
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, error: 'No authentication token' };
    }

    const endpoints: Record<string, string> = {
      graph: '/api/graphs',
      node: '/api/nodes',
      edge: '/api/edges',
      card: '/api/cards',
      template: '/api/templates',
    };

    const baseUrl = endpoints[item.entity] || `/api/${item.entity}s`;
    let url = baseUrl;
    let method = 'POST';
    let body: Record<string, unknown> = item.data;

    switch (item.type) {
      case 'update':
        url = `${baseUrl}/${item.data.id}`;
        method = 'PATCH';
        break;
      case 'delete':
        url = `${baseUrl}/${item.data.id}`;
        method = 'DELETE';
        body = {};
        break;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      if (response.status === 409) {
        const remoteData = await response.json();
        return {
          success: false,
          conflict: {
            id: item.id,
            entity: item.entity,
            localData: item.data,
            remoteData: remoteData.data || remoteData,
            timestamp: Date.now(),
          },
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}`,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  handleSyncConflict(conflict: SyncConflict, resolution: ConflictResolution): void {
    const queue = this.getQueue();
    const itemIndex = queue.findIndex(item => item.id === conflict.id);

    if (itemIndex === -1) return;

    const item = queue[itemIndex];

    switch (resolution.strategy) {
      case 'local':
        item.retryCount = 0;
        item.lastError = undefined;
        break;
      case 'remote':
        queue.splice(itemIndex, 1);
        break;
      case 'merge':
        if (resolution.mergedData) {
          item.data = resolution.mergedData;
          item.retryCount = 0;
          item.lastError = undefined;
        }
        break;
    }

    this.saveQueue(queue);

    if (navigator.onLine && resolution.strategy !== 'remote') {
      this.syncOfflineQueue();
    }
  }

  getStatus(): SyncStatus {
    const defaults: SyncStatus = {
      isOnline: navigator.onLine,
      isSyncing: this.isSyncing,
      pendingCount: this.getQueue().length,
      lastSyncTime: null,
      lastSyncError: null,
      conflicts: [],
    };

    try {
      const stored = localStorage.getItem(SYNC_STATUS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...defaults, ...parsed, isOnline: navigator.onLine, isSyncing: this.isSyncing };
      }
    } catch {
      console.error('[BackgroundSync] Failed to parse status');
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

  clearQueue(): void {
    this.saveQueue([]);
  }

  getPendingItems(): SyncQueueItem[] {
    return this.getQueue();
  }
}

const syncManager = new BackgroundSyncManager();

export const registerBackgroundSync = (): void => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      return (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('offline-sync');
    }).catch(error => {
      console.error('[BackgroundSync] Failed to register:', error);
    });
  }

  if (navigator.onLine) {
    syncManager.syncOfflineQueue();
  }
};

export const syncOfflineQueue = (): Promise<{ success: number; failed: number; conflicts: SyncConflict[] }> => {
  return syncManager.syncOfflineQueue();
};

export const handleSyncConflict = (conflict: SyncConflict, resolution: ConflictResolution): void => {
  syncManager.handleSyncConflict(conflict, resolution);
};

export const getSyncStatus = (): SyncStatus => {
  return syncManager.getStatus();
};

export const addToSyncQueue = (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): string => {
  return syncManager.addToQueue(item);
};

export const removeFromSyncQueue = (itemId: string): void => {
  syncManager.removeFromQueue(itemId);
};

export const onSyncEvent = (event: SyncEventType, callback: SyncEventCallback): (() => void) => {
  return syncManager.on(event, callback);
};

export const clearSyncQueue = (): void => {
  syncManager.clearQueue();
};

export const getPendingSyncItems = (): SyncQueueItem[] => {
  return syncManager.getPendingItems();
};

export { syncManager };
