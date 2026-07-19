import type { QueryClient } from '@tanstack/react-query';
import { DefaultError } from '@tanstack/react-query';
import { createLogger } from './logger';

const logger = createLogger('OfflineMutations');

// 使用独立 DB 避免与现有 KnowledgeMapDB（offlineStorage.ts）的 version 升级冲突。
// offlineStorage.ts 使用 KnowledgeMapDB v1，这里若共用同一 DB 升级 version 会引入
// 复杂的兼容性风险。独立 DB 简化实现，互不影响。
const DB_NAME = 'KnowledgeMapMutationQueue';
const DB_VERSION = 1;
const STORE_NAME = 'mutationQueue';

/**
 * 自定义错误类：标记 mutation 因离线而被拦截
 * 不应触发错误 toast / captureException，应静默入队
 */
export class OfflineError extends Error {
  constructor(message = 'Mutation queued offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

/**
 * 离线队列项结构
 */
export interface QueuedMutation {
  /** 唯一 ID（crypto.randomUUID() 或兜底生成） */
  id: string;
  /** React Query mutation key */
  mutationKey: unknown[];
  /** mutation 变量 */
  variables: unknown;
  /** mutation context（onMutate 返回值，离线拦截时尚未生成，恒为 undefined） */
  context: unknown;
  /** mutation meta */
  meta: Record<string, unknown> | undefined;
  /** 入队时间戳 */
  timestamp: number;
  /** 已重试次数 */
  retryCount: number;
  /** 最后一次错误信息（非网络错误） */
  lastError?: string;
}

/**
 * 队列状态监听器
 */
type QueueListener = (queue: QueuedMutation[]) => void;

const MAX_RETRY_COUNT = 3;

let dbInstance: IDBDatabase | null = null;

const listeners = new Set<QueueListener>();

function isBrowser(): boolean {
  return typeof indexedDB !== 'undefined';
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // SSR / 旧环境兜底
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('Failed to open mutation queue IndexedDB', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      logger.debug('Mutation queue IndexedDB opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      logger.debug('Mutation queue schema created/updated');
    };
  });
}

async function putItem(item: QueuedMutation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      logger.error('Failed to put mutation queue item', request.error);
      reject(request.error);
    };
  });
}

async function deleteItem(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      logger.error(`Failed to delete mutation queue item: ${id}`, request.error);
      reject(request.error);
    };
  });
}

async function getAllItems(): Promise<QueuedMutation[]> {
  if (!isBrowser()) {
    return [];
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result || []) as QueuedMutation[];
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };

    request.onerror = () => {
      logger.error('Failed to get all mutation queue items', request.error);
      reject(request.error);
    };
  });
}

/**
 * 判断错误是否为网络错误（fetch failed / TypeError / 网络相关）
 */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TypeError') return true;
  const message = error.message.toLowerCase();
  if (message.includes('failed to fetch')) return true;
  if (message.includes('network')) return true;
  if (message.includes('networkerror')) return true;
  return false;
}

function notifyListeners(): void {
  void getAllItems()
    .then((items) => {
      listeners.forEach((listener) => {
        try {
          listener(items);
        } catch (err) {
          logger.error('Queue listener error', err);
        }
      });
    })
    .catch((err) => {
      logger.error('Failed to notify listeners', err);
    });
}

/**
 * 离线 mutation 队列单例
 *
 * - 离线时通过 MutationCache.onMutate 拦截 mutation，调用 enqueue 入队
 * - 网络恢复时调用 replay 重放队列
 */
export const offlineMutationQueue = {
  /**
   * 将 mutation 加入离线队列
   * @returns 队列项 ID
   */
  async enqueue(
    item: Omit<QueuedMutation, 'id' | 'timestamp' | 'retryCount'>,
  ): Promise<string> {
    const queued: QueuedMutation = {
      ...item,
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0,
    };
    await putItem(queued);
    logger.debug(`Mutation enqueued: ${queued.id}`);
    notifyListeners();
    return queued.id;
  },

  /**
   * 从队列中移除指定 ID 的项
   */
  async dequeue(id: string): Promise<void> {
    await deleteItem(id);
    logger.debug(`Mutation dequeued: ${id}`);
    notifyListeners();
  },

  /**
   * 获取所有待重放的 mutation，按入队时间升序排序
   */
  async getPending(): Promise<QueuedMutation[]> {
    return getAllItems();
  },

  /**
   * 订阅队列状态变化
   * @returns unsubscribe 函数
   */
  subscribe(listener: QueueListener): () => void {
    listeners.add(listener);
    // 立即触发一次，让订阅者拿到当前队列快照
    void getAllItems()
      .then((items) => listener(items))
      .catch((err) => {
        logger.error('Failed to trigger initial listener', err);
      });
    return () => {
      listeners.delete(listener);
    };
  },

  /**
   * 重放队列中的 mutation
   *
   * - 按 timestamp 顺序逐个重放
   * - 成功：dequeue
   * - 网络错误：保留在队列，retryCount++，停止后续重放（避免顺序错乱）
   * - 非网络错误：retryCount++，达到 MAX_RETRY_COUNT 则 dequeue（避免无限重试）
   */
  async replay(queryClient: QueryClient): Promise<void> {
    const pending = await getAllItems();
    if (pending.length === 0) {
      return;
    }

    logger.debug(`Replaying ${pending.length} offline mutations`);

    for (const item of pending) {
      try {
        // 通过 mutationCache.build 重建 mutation 并执行。
        // 注意：此版本的 @tanstack/query-core 无 QueryClient.executeMutation 方法。
        // mutationFn 由应用通过 queryClient.setMutationDefaults(mutationKey, { mutationFn })
        // 注册的 defaults 提供；若未注册，execute 会抛出 "No mutationFn found"，
        // 按非网络错误处理（重试到上限后丢弃）。
        const mutation = queryClient
          .getMutationCache()
          .build<unknown, DefaultError, unknown, unknown>(queryClient, {
            mutationKey: item.mutationKey,
            meta: item.meta,
            retry: 0,
          });
        await mutation.execute(item.variables);
        await deleteItem(item.id);
        logger.debug(`Mutation replayed successfully: ${item.id}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (isNetworkError(error)) {
          // 网络错误：保留在队列，等待下次 replay
          await putItem({
            ...item,
            retryCount: item.retryCount + 1,
            lastError: errorMessage,
          });
          logger.warn(
            `Replay stopped due to network error on ${item.id} (retry ${item.retryCount + 1})`,
            error,
          );
          break;
        }

        // 非网络错误：retryCount++，达到上限则丢弃
        const newRetryCount = item.retryCount + 1;
        if (newRetryCount >= MAX_RETRY_COUNT) {
          await deleteItem(item.id);
          logger.warn(
            `Mutation ${item.id} dropped after ${newRetryCount} retries: ${errorMessage}`,
            error,
          );
        } else {
          await putItem({
            ...item,
            retryCount: newRetryCount,
            lastError: errorMessage,
          });
          logger.warn(
            `Mutation ${item.id} retry ${newRetryCount}/${MAX_RETRY_COUNT}: ${errorMessage}`,
            error,
          );
        }
      }
    }

    notifyListeners();
  },
};
