import { DefaultError, type QueryClient } from '@tanstack/react-query';
import { createLogger } from './logger';
import { type OfflineOperation, getOfflineQueue, clearOfflineQueue } from './offlineStorage';
import { frontendEventBus } from '@/services/timer/FrontendEventBus';
import { type SyncConflictDetectedPayload } from '@/services/FrontendEventTypes';
import { isAppError, isApiError } from '@/utils/errors';

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
  /**
   * 标记为不可重放：replay 时若 mutationKey 未注册到 queryClient.setMutationDefaults，
   * 会抛出 "No mutationFn found"——此错误重试永远不会成功，故立即标记为不可重放，
   * 跳过 retry/drop 逻辑，避免静默数据丢失（被丢弃的用户操作不会再次尝试）。
   */
  unplayable?: boolean;
}

/**
 * 重放进度回调参数
 */
export interface ReplayProgress {
  current: number;
  total: number;
  itemId: string;
  status: 'pending' | 'success' | 'error' | 'conflict';
}

/**
 * 重放选项
 */
export interface ReplayOptions {
  onProgress?: (progress: ReplayProgress) => void;
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

/**
 * 判断错误是否因 mutationFn 未注册导致（不可重放错误）
 *
 * 当应用未通过 queryClient.setMutationDefaults(mutationKey, { mutationFn })
 * 注册默认 mutationFn 时，react-query 在 execute 阶段会抛出
 * "No mutationFn found"。此错误重试永远失败（mutationKey 不变则结果不变），
 * 故需在 replay 中识别并标记为 unplayable，跳过常规 retry/drop 逻辑，
 * 防止离线期间的用户操作被静默丢弃。
 */
function isNoMutationFnError(error: unknown): boolean {
  return error instanceof Error && /no mutationfn found/i.test(error.message);
}

/**
 * 判断错误是否为 409 冲突错误
 */
function isConflictError(error: unknown): boolean {
  // 使用 'in' 操作符避免对 AppError 类型属性的直接访问（由于共享类型输出文件未构建的问题）
  if (isAppError(error) && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode === 409;
  }
  if (isApiError(error) && error.status === 409) {
    return true;
  }
  if (error instanceof Error && 'status' in error) {
    const err = error as Error & { status: number };
    if (err.status === 409) return true;
  }
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
   * - 409 冲突：dequeue 并发出 sync_conflict_detected 事件
   */
  async replay(
    queryClient: QueryClient,
    options?: ReplayOptions,
  ): Promise<void> {
    const pending = await getAllItems();
    if (pending.length === 0) {
      return;
    }

    logger.debug(`Replaying ${pending.length} offline mutations`);

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      // 跳过已标记为 unplayable 的项：mutationFn 未注册，重试永远不会成功，
      // 再次执行只会重复抛错并写 IndexedDB。仍保留在队列中供用户/工具显式清理。
      if (item.unplayable) {
        continue;
      }

      // 重放前回调
      options?.onProgress?.({ current: i, total: pending.length, itemId: item.id, status: 'pending' });

      try {
        // 通过 mutationCache.build 重建 mutation 并执行。
        // 注意：此版本的 @tanstack/query-core 无 QueryClient.executeMutation 方法。
        // mutationFn 由应用通过 queryClient.setMutationDefaults(mutationKey, { mutationFn })
        // 注册的 defaults 提供；若未注册，execute 会抛出 "No mutationFn found"，
        // 见下方 isNoMutationFnError 分支处理。
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
        options?.onProgress?.({ current: i + 1, total: pending.length, itemId: item.id, status: 'success' });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // 409 冲突：发出冲突事件，dequeue 后继续处理下一项
        if (isConflictError(error)) {
          // 从 AppError 的 context 中提取 remoteData（如果存在）
          let remoteData: Record<string, unknown> = {};
          if (isAppError(error) && 'context' in error) {
            const ctx = (error as { context?: { remoteData?: unknown } }).context;
            if (ctx?.remoteData) {
              remoteData = ctx.remoteData as Record<string, unknown>;
            }
          }

          const conflictPayload: SyncConflictDetectedPayload = {
            id: item.id,
            entity: String(item.mutationKey[0] ?? 'unknown'),
            localData: item.variables as Record<string, unknown>,
            remoteData,
            timestamp: Date.now(),
          };

          frontendEventBus.publish('sync_conflict_detected', conflictPayload);
          await deleteItem(item.id);
          logger.warn(
            `Mutation ${item.id} has conflict (409), removed from queue`,
          );
          options?.onProgress?.({ current: i + 1, total: pending.length, itemId: item.id, status: 'conflict' });
          continue;
        }

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
          options?.onProgress?.({ current: i + 1, total: pending.length, itemId: item.id, status: 'error' });
          break;
        }

        // 不可重放错误：mutationFn 未注册到 setMutationDefaults，重试永远失败。
        // 标记为 unplayable 后保留在队列中（不递增 retryCount、不被丢弃），
        // 避免用户操作在离线→在线切换时被静默丢失。队列仍可被用户/工具显式清理。
        if (isNoMutationFnError(error)) {
          await putItem({
            ...item,
            unplayable: true,
            lastError: errorMessage,
          });
          logger.error(
            `Mutation ${item.id} marked unplayable (no mutationFn registered for key ${JSON.stringify(item.mutationKey)}): ${errorMessage}. ` +
              'This usually means queryClient.setMutationDefaults was not called for this key. ' +
              'The mutation is kept in the queue to prevent silent data loss.',
            error,
          );
          options?.onProgress?.({ current: i + 1, total: pending.length, itemId: item.id, status: 'error' });
          continue;
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
        options?.onProgress?.({ current: i + 1, total: pending.length, itemId: item.id, status: 'error' });
      }
    }

    notifyListeners();
  },
};

/**
 * 将旧 BackgroundSyncManager 的 IndexedDB 队列（KnowledgeMapDB.offlineQueue）
 * 迁移到新的 React Query offlineMutationQueue（KnowledgeMapMutationQueue.mutationQueue）。
 *
 * - 读取旧 offlineQueue store 中的所有 OfflineOperation
 * - 转换为 QueuedMutation 格式（mutationKey / variables / meta 编码原操作信息）
 * - 调用 offlineMutationQueue.enqueue 写入新队列
 * - 清空旧 offlineQueue store
 * - 返回成功迁移的项数
 *
 * 幂等：迁移完成后清空旧 store，重复调用不会产生重复项。
 * 若旧 store 为空或不存在，返回 0。
 * SSR 安全：非浏览器环境直接返回 0。
 *
 * 位于 offlineMutations.ts，负责将旧 IndexedDB 队列迁移到由 offlineMutationQueue 管理的新结构。
 */
export async function migrateLegacyQueue(): Promise<number> {
  // SSR 安全：非浏览器环境无 IndexedDB
  if (typeof indexedDB === 'undefined') {
    return 0;
  }

  let operations: OfflineOperation[];
  try {
    operations = await getOfflineQueue();
  } catch (error) {
    logger.warn('Failed to read legacy offline queue, skipping migration', error);
    return 0;
  }

  if (operations.length === 0) {
    return 0;
  }

  let migrated = 0;
  for (const op of operations) {
    try {
      await offlineMutationQueue.enqueue({
        // 编码原操作信息到 mutationKey，便于排查与未来对接 mutationFn
        mutationKey: ['legacy-sync', op.entityType, op.type, op.entityId],
        variables: {
          entityType: op.entityType,
          operationType: op.type,
          entityId: op.entityId,
          graphId: op.graphId,
          data: op.data,
        },
        context: undefined,
        meta: {
          legacy: true,
          entityType: op.entityType,
          operationType: op.type,
          entityId: op.entityId,
          graphId: op.graphId,
        },
      });
      migrated++;
    } catch (error) {
      logger.error(`Failed to migrate legacy queue item: ${op.id}`, error);
    }
  }

  // 清空旧 store，保证幂等：重复调用不会再迁移已处理的项
  try {
    await clearOfflineQueue();
  } catch (error) {
    logger.error('Failed to clear legacy offline queue after migration', error);
  }

  logger.debug(
    `Migrated ${migrated}/${operations.length} items from legacy queue to offlineMutationQueue`,
  );
  return migrated;
}
