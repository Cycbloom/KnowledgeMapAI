import { createLogger } from './logger';

const logger = createLogger('OfflineStorage');

const DB_NAME = 'KnowledgeMapDB';
const DB_VERSION = 1;

const STORES = {
  GRAPHS: 'graphs',
  OFFLINE_QUEUE: 'offlineQueue',
  SYNC_STATUS: 'syncStatus',
} as const;

export interface GraphData {
  nodes: unknown[];
  edges: unknown[];
  settings?: Record<string, unknown>;
  updatedAt: number;
}

export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'node' | 'edge' | 'graph' | 'settings';
  entityId: string;
  graphId: string;
  data?: unknown;
  timestamp: number;
  retryCount: number;
}

export interface SyncStatus {
  graphId: string;
  lastSyncAt: number;
  pendingOperations: number;
  status: 'synced' | 'pending' | 'error';
  errorMessage?: string;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('Failed to open IndexedDB', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      logger.debug('IndexedDB opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.GRAPHS)) {
        const graphsStore = db.createObjectStore(STORES.GRAPHS, { keyPath: 'graphId' });
        graphsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.OFFLINE_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.OFFLINE_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('graphId', 'graphId', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        queueStore.createIndex('entityType', 'entityType', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
        db.createObjectStore(STORES.SYNC_STATUS, { keyPath: 'graphId' });
      }

      logger.debug('IndexedDB schema created/updated');
    };
  });
}

export async function initDB(): Promise<IDBDatabase> {
  return openDB();
}

export async function cacheGraph(graphId: string, data: Omit<GraphData, 'updatedAt'>): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.GRAPHS], 'readwrite');
    const store = transaction.objectStore(STORES.GRAPHS);

    const graphData: GraphData & { graphId: string } = {
      graphId,
      ...data,
      updatedAt: Date.now(),
    };

    const request = store.put(graphData);

    request.onsuccess = () => {
      logger.debug(`Graph cached: ${graphId}`);
      resolve();
    };

    request.onerror = () => {
      logger.error(`Failed to cache graph: ${graphId}`, request.error);
      reject(request.error);
    };
  });
}

export async function getCachedGraph(graphId: string): Promise<GraphData | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.GRAPHS], 'readonly');
    const store = transaction.objectStore(STORES.GRAPHS);
    const request = store.get(graphId);

    request.onsuccess = () => {
      if (request.result) {
        const { graphId: _, ...data } = request.result;
        resolve(data as GraphData);
      } else {
        resolve(null);
      }
    };

    request.onerror = () => {
      logger.error(`Failed to get cached graph: ${graphId}`, request.error);
      reject(request.error);
    };
  });
}

export async function deleteCachedGraph(graphId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.GRAPHS], 'readwrite');
    const store = transaction.objectStore(STORES.GRAPHS);
    const request = store.delete(graphId);

    request.onsuccess = () => {
      logger.debug(`Graph cache deleted: ${graphId}`);
      resolve();
    };

    request.onerror = () => {
      logger.error(`Failed to delete cached graph: ${graphId}`, request.error);
      reject(request.error);
    };
  });
}

export async function getAllCachedGraphs(): Promise<Array<{ graphId: string } & GraphData>> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.GRAPHS], 'readonly');
    const store = transaction.objectStore(STORES.GRAPHS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      logger.error('Failed to get all cached graphs', request.error);
      reject(request.error);
    };
  });
}

export async function addToOfflineQueue(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);

    const id = `${operation.entityType}_${operation.entityId}_${Date.now()}`;
    const fullOperation: OfflineOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const request = store.add(fullOperation);

    request.onsuccess = () => {
      logger.debug(`Added to offline queue: ${id}`);
      resolve(id);
    };

    request.onerror = () => {
      logger.error('Failed to add to offline queue', request.error);
      reject(request.error);
    };
  });
}

export async function getOfflineQueue(): Promise<OfflineOperation[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.OFFLINE_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => {
      const operations = request.result || [];
      operations.sort((a, b) => a.timestamp - b.timestamp);
      resolve(operations);
    };

    request.onerror = () => {
      logger.error('Failed to get offline queue', request.error);
      reject(request.error);
    };
  });
}

export async function getOfflineQueueByGraph(graphId: string): Promise<OfflineOperation[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.OFFLINE_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);
    const index = store.index('graphId');
    const request = index.getAll(graphId);

    request.onsuccess = () => {
      const operations = request.result || [];
      operations.sort((a, b) => a.timestamp - b.timestamp);
      resolve(operations);
    };

    request.onerror = () => {
      logger.error(`Failed to get offline queue for graph: ${graphId}`, request.error);
      reject(request.error);
    };
  });
}

export async function removeFromOfflineQueue(operationId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);
    const request = store.delete(operationId);

    request.onsuccess = () => {
      logger.debug(`Removed from offline queue: ${operationId}`);
      resolve();
    };

    request.onerror = () => {
      logger.error(`Failed to remove from offline queue: ${operationId}`, request.error);
      reject(request.error);
    };
  });
}

export async function updateOfflineQueueOperation(operationId: string, updates: Partial<OfflineOperation>): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);
    const getRequest = store.get(operationId);

    getRequest.onsuccess = () => {
      const operation = getRequest.result;
      if (!operation) {
        reject(new Error(`Operation not found: ${operationId}`));
        return;
      }

      const updatedOperation = { ...operation, ...updates };
      const putRequest = store.put(updatedOperation);

      putRequest.onsuccess = () => {
        logger.debug(`Updated offline operation: ${operationId}`);
        resolve();
      };

      putRequest.onerror = () => {
        logger.error(`Failed to update offline operation: ${operationId}`, putRequest.error);
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      logger.error(`Failed to get offline operation: ${operationId}`, getRequest.error);
      reject(getRequest.error);
    };
  });
}

export async function clearOfflineQueue(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);
    const request = store.clear();

    request.onsuccess = () => {
      logger.debug('Offline queue cleared');
      resolve();
    };

    request.onerror = () => {
      logger.error('Failed to clear offline queue', request.error);
      reject(request.error);
    };
  });
}

export async function getOfflineQueueCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.OFFLINE_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.OFFLINE_QUEUE);
    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      logger.error('Failed to get offline queue count', request.error);
      reject(request.error);
    };
  });
}

export async function updateSyncStatus(status: SyncStatus): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_STATUS], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_STATUS);
    const request = store.put(status);

    request.onsuccess = () => {
      logger.debug(`Sync status updated for graph: ${status.graphId}`);
      resolve();
    };

    request.onerror = () => {
      logger.error(`Failed to update sync status for graph: ${status.graphId}`, request.error);
      reject(request.error);
    };
  });
}

export async function getSyncStatus(graphId: string): Promise<SyncStatus | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_STATUS], 'readonly');
    const store = transaction.objectStore(STORES.SYNC_STATUS);
    const request = store.get(graphId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      logger.error(`Failed to get sync status for graph: ${graphId}`, request.error);
      reject(request.error);
    };
  });
}

export async function getAllSyncStatuses(): Promise<SyncStatus[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_STATUS], 'readonly');
    const store = transaction.objectStore(STORES.SYNC_STATUS);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      logger.error('Failed to get all sync statuses', request.error);
      reject(request.error);
    };
  });
}

export async function deleteSyncStatus(graphId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_STATUS], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_STATUS);
    const request = store.delete(graphId);

    request.onsuccess = () => {
      logger.debug(`Sync status deleted for graph: ${graphId}`);
      resolve();
    };

    request.onerror = () => {
      logger.error(`Failed to delete sync status for graph: ${graphId}`, request.error);
      reject(request.error);
    };
  });
}

export async function clearAllData(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.GRAPHS, STORES.OFFLINE_QUEUE, STORES.SYNC_STATUS], 'readwrite');

    const clearPromises = [
      new Promise<void>((res, rej) => {
        const request = transaction.objectStore(STORES.GRAPHS).clear();
        request.onsuccess = () => res();
        request.onerror = () => rej(request.error);
      }),
      new Promise<void>((res, rej) => {
        const request = transaction.objectStore(STORES.OFFLINE_QUEUE).clear();
        request.onsuccess = () => res();
        request.onerror = () => rej(request.error);
      }),
      new Promise<void>((res, rej) => {
        const request = transaction.objectStore(STORES.SYNC_STATUS).clear();
        request.onsuccess = () => res();
        request.onerror = () => rej(request.error);
      }),
    ];

    Promise.all(clearPromises)
      .then(() => {
        logger.debug('All offline data cleared');
        resolve();
      })
      .catch((error) => {
        logger.error('Failed to clear all offline data', error);
        reject(error);
      });
  });
}

export async function getStorageStats(): Promise<{
  graphsCount: number;
  queueCount: number;
  syncStatusCount: number;
}> {
  const db = await openDB();

  const getCount = (storeName: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  const [graphsCount, queueCount, syncStatusCount] = await Promise.all([
    getCount(STORES.GRAPHS),
    getCount(STORES.OFFLINE_QUEUE),
    getCount(STORES.SYNC_STATUS),
  ]);

  return { graphsCount, queueCount, syncStatusCount };
}

export { STORES };
