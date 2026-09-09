import { createLogger } from "@/utils/logger";

const logger = createLogger("OfflineDb");

export const OFFLINE_DB_NAME = "KnowledgeMapOffline";
// v2: 新增 graph_nodes/edges 内容表（旧版 v1 库升级安装后由 onupgradeneeded 补建表）
export const OFFLINE_DB_VERSION = 2;

/** 内容表（随数据包导入，重建时整体覆盖） */
export const CONTENT_STORES = [
  "graphs",
  "knowledge_points",
  "graph_nodes",
  "edges",
  "study_cards",
  "quiz_sets",
  "quiz_set_cards",
] as const;

/** 本地记录表（永不随数据包覆盖，保留离线学习成果） */
export const RECORD_STORES = ["review_logs", "quiz_sessions", "op_log"] as const;

/** 元信息表（bundle 版本、导入时间、本地身份等） */
export const META_STORE = "meta";

export type ContentStoreName = (typeof CONTENT_STORES)[number];

export interface OfflineReviewLog {
  id: string;
  card_id: string;
  quality: number;
  rating: string;
  reviewed_at: string;
  next_review: string;
}

export interface OfflineQuizSession {
  id: string;
  quiz_set_id: string;
  correct_count: number;
  total_count: number;
  score: number;
  created_at: string;
  results: Array<{
    card_id: string;
    correct: boolean;
    user_answer?: string;
    time_spent?: number;
  }>;
}

/** 待回传服务器的操作日志（备案通过联网后按序回放） */
export interface OfflineOpLogEntry {
  id: string;
  table: string;
  record_id: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  timestamp: string;
  synced: boolean;
}

export interface OfflineMeta {
  key: string;
  value: unknown;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onerror = () => {
      logger.error("Failed to open offline IndexedDB", {
        message: request.error?.message,
      });
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      logger.debug("Offline IndexedDB opened");
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      for (const store of CONTENT_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }

      for (const store of RECORD_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      logger.error("IndexedDB request failed", {
        message: request.error?.message,
      });
      reject(request.error);
    };
  });
}

function getStore(storeName: string, mode: IDBTransactionMode): IDBObjectStore {
  const db = dbInstance;
  if (!db) {
    throw new Error("Offline IndexedDB not opened");
  }
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/** 打开数据库并确保连接可用（幂等） */
export async function ensureOfflineDb(): Promise<IDBDatabase> {
  return openDB();
}

/** 关闭并重置数据库连接（测试用；下次调用 openDB 会按最新版本重新打开） */
export async function closeOfflineDb(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function getAll<T = Record<string, unknown>>(
  storeName: string,
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getById<T = Record<string, unknown>>(
  storeName: string,
  id: string,
): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function putRecord(
  storeName: string,
  value: Record<string, unknown>,
): Promise<void> {
  await openDB();
  await runRequest(
    getStore(storeName, "readwrite").put(value) as IDBRequest<IDBValidKey>,
  );
}

export async function bulkPut(
  storeName: string,
  values: Array<Record<string, unknown>>,
): Promise<void> {
  if (values.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    for (const value of values) {
      store.put(value);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deleteRecord(
  storeName: string,
  id: string,
): Promise<void> {
  await openDB();
  await runRequest(
    getStore(storeName, "readwrite").delete(id) as IDBRequest<undefined>,
  );
}

export async function clearStore(storeName: string): Promise<void> {
  await openDB();
  await runRequest(
    getStore(storeName, "readwrite").clear() as IDBRequest<undefined>,
  );
}

export async function getMeta<T = unknown>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE, "readonly");
    const store = transaction.objectStore(META_STORE);
    const request = store.get(key) as IDBRequest<OfflineMeta | undefined>;
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? (result.value as T) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await openDB();
  await runRequest(
    getStore(META_STORE, "readwrite").put({ key, value }) as IDBRequest<IDBValidKey>,
  );
}

/** 离线模式下的本地身份（伪 auth 数据，非网络会话） */
export interface OfflineLocalIdentity {
  ownerId: string;
  email: string;
  name?: string | null;
}

export async function setLocalIdentity(identity: OfflineLocalIdentity): Promise<void> {
  await setMeta("localIdentity", identity);
}

export async function getLocalIdentity(): Promise<OfflineLocalIdentity | null> {
  return getMeta<OfflineLocalIdentity>("localIdentity");
}

export async function setBundleVersion(version: number): Promise<void> {
  await setMeta("bundleVersion", version);
}

export async function getBundleVersion(): Promise<number | null> {
  return getMeta<number>("bundleVersion");
}
