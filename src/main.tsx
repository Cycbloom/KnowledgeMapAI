import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { defaultQueryConfig } from './hooks/queries/config'
import { subscribeNetworkStatus } from './hooks/common/useNetworkStatus'
import App from './App'
import { ThemeProvider } from './hooks'
import { unregisterLegacySW } from './utils/serviceWorker'
import { initPerformanceMonitoring } from './utils/performance'
import { initErrorReporter, destroyErrorReporter, setUserContext, captureException } from './utils/errorReporter'
import { initCsrf } from './services/api'
import { preloadMobileApi } from './services/api/adapter'
import { initializeEventSubscribers } from './services/FrontendEventSubscribers'
import { useStore } from './store/useStore'
import { migrateLegacyKeys } from './store/createPersistedStore'
import { useThemeStore } from './store/useThemeStore'
import { useNotificationsStore } from './store/useNotificationsStore'
import { useGraphEditorPreferencesStore } from './store/useGraphEditorPreferencesStore'
import { offlineMutationQueue, OfflineError } from './utils/offlineMutations'
import { migrateLegacyQueue } from './utils/backgroundSync'
import { queryPersister } from './utils/queryPersister'
import './store/storeIntegrations'
import './index.css'
import 'katex/dist/katex.min.css'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...defaultQueryConfig,
      refetchOnWindowFocus: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      captureException(error);
    },
  }),
  mutationCache: new MutationCache({
    // 离线时拦截 mutation：入队并抛出 OfflineError 阻止执行
    onMutate: async (variables, mutation) => {
      if (!onlineManager.isOnline()) {
        await offlineMutationQueue.enqueue({
          // mutationKey 是 readonly unknown[]，拷贝为可变数组便于持久化
          mutationKey: [...(mutation.options.mutationKey ?? [])],
          variables,
          context: undefined,
          meta: mutation.options.meta as Record<string, unknown> | undefined,
        });
        throw new OfflineError();
      }
    },
    onError: (error) => {
      // OfflineError 已入队，不是真正的错误，不触发 captureException
      if (error instanceof OfflineError) return;
      captureException(error);
    },
  }),
})

// 接入 React Query onlineManager：使 React Query 感知网络状态变化（Capacitor Network + window online/offline）
// 网络恢复时自动重放离线 mutation 队列
onlineManager.setEventListener((setOnline) => {
  return subscribeNetworkStatus((status) => {
    setOnline(status.isOnline);
    if (status.isOnline) {
      void offlineMutationQueue.replay(queryClient).catch((err) => {
        console.error('Failed to replay offline mutations', err);
      });
    }
  });
})

// 持久化查询缓存到 IndexedDB（KnowledgeMapQueryCache.queryCache）：
// 离线时已加载的数据仍能从缓存渲染，提升离线体验。
// 仅持久化 graphs / nodes / edges / user 前缀且 status === 'success' 的 query，
// 避免敏感或临时数据落盘。buster 与应用版本绑定，版本变更时自动失效旧缓存。
persistQueryClient({
  queryClient,
  persister: queryPersister,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  buster: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // 沿用 defaultShouldDehydrateQuery 语义：仅持久化成功的 query
      if (query.state.status !== 'success') return false;
      const queryKey = query.queryKey;
      if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
      const prefix = queryKey[0];
      return (
        typeof prefix === 'string' &&
        ['graphs', 'nodes', 'edges', 'user'].includes(prefix)
      );
    },
  },
})

migrateLegacyKeys()
// The theme store hydrates synchronously at import time (before
// migrateLegacyKeys runs), so re-read km-theme to pick up values just
// migrated from the legacy themeMode/themePreset keys on first load.
void useThemeStore.persist.rehydrate()
// The notifications and graph-editor stores also hydrate synchronously at
// import time (before migrateLegacyKeys runs), so re-read their km-* keys
// to pick up values just migrated from the legacy
// mutedNotificationTypes/graphEditorPreferences keys on first load.
void useNotificationsStore.persist.rehydrate()
void useGraphEditorPreferencesStore.persist.rehydrate()

const restoredUser = useStore.getState().user
if (restoredUser?.id) {
  setUserContext(restoredUser.id, restoredUser.email ?? undefined)
}

initCsrf()
initializeEventSubscribers(queryClient)

const isElectron = navigator.userAgent.toLowerCase().includes('electron')

// 始终初始化错误上报：生产环境入队上报后端，开发环境仅 console 输出
initErrorReporter()

// 清理历史版本（public/sw.js 手写 SW）的残留注册与缓存；
// fire-and-forget，不阻塞应用启动。新的 SW 注册由 VitePWA 通过
// `useRegisterSW`（UpdatePrompt 组件，Task 13）在组件层接管。
void unregisterLegacySW()

// 迁移旧 BackgroundSyncManager 队列（KnowledgeMapDB.offlineQueue）到新
// offlineMutationQueue（KnowledgeMapMutationQueue.mutationQueue）；
// fire-and-forget，不阻塞应用启动。幂等，重复调用安全。
void migrateLegacyQueue().catch((err) => {
  console.error('Failed to migrate legacy queue', err)
})

if (import.meta.env.PROD && !isElectron) {
  initPerformanceMonitoring()
}

if (isElectron && import.meta.env.PROD) {
  initPerformanceMonitoring()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyErrorReporter()
  })
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const Router = isElectron ? HashRouter : BrowserRouter;
  void (async () => {
    await preloadMobileApi();
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Router>
              <App />
            </Router>
          </ThemeProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  })();
}
