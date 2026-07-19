import localforage from 'localforage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { AsyncStorage } from '@tanstack/query-persist-client-core';
import { createLogger } from './logger';

const logger = createLogger('QueryPersister');

// 使用独立 DB（KnowledgeMapQueryCache）避免与 offlineStorage.ts（KnowledgeMapDB v1）
// 和 offlineMutations.ts（KnowledgeMapMutationQueue v1）的 IndexedDB version 升级冲突。
// storeName 'queryCache' 仅在此 DB 内使用，互不影响。
const queryCacheStore = localforage.createInstance({
  name: 'KnowledgeMapQueryCache',
  storeName: 'queryCache',
  description: 'React Query persisted cache',
});

// SSR / 非浏览器环境兜底：AsyncStorage 接口允许 storage 为 undefined，
// 此时 createAsyncStoragePersister 会创建一个 no-op persister。
const isBrowser = typeof indexedDB !== 'undefined';

const queryCacheStorage: AsyncStorage<string> | undefined = isBrowser
  ? {
      getItem: async (key: string): Promise<string | null> => {
        try {
          const value = await queryCacheStore.getItem<string>(key);
          return value ?? null;
        } catch (error) {
          logger.error('Failed to read query cache from IndexedDB', error);
          return null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          await queryCacheStore.setItem(key, value);
        } catch (error) {
          logger.error('Failed to write query cache to IndexedDB', error);
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          await queryCacheStore.removeItem(key);
        } catch (error) {
          logger.error('Failed to remove query cache from IndexedDB', error);
        }
      },
    }
  : undefined;

export const queryPersister = createAsyncStoragePersister({
  storage: queryCacheStorage,
  key: 'react-query-cache',
});
