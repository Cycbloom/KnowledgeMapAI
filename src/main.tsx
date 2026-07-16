import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './hooks'
import { registerServiceWorker } from './utils/serviceWorker'
import { initPerformanceMonitoring } from './utils/performance'
import { initErrorReporter, destroyErrorReporter, setUserContext } from './utils/errorReporter'
import { initCsrf } from './services/api'
import { preloadMobileApi } from './services/api/adapter'
import { asyncConfirm } from './utils/asyncConfirm'
import i18n from './i18n'
import { initializeEventSubscribers } from './services/FrontendEventSubscribers'
import { useStore } from './store/useStore'
import { migrateLegacyKeys } from './store/createPersistedStore'
import { useThemeStore } from './store/useThemeStore'
import { useNotificationsStore } from './store/useNotificationsStore'
import { useGraphEditorPreferencesStore } from './store/useGraphEditorPreferencesStore'
import './store/storeIntegrations'
import './index.css'
import 'katex/dist/katex.min.css'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
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

if (import.meta.env.PROD && !isElectron) {
  initErrorReporter()
  
  registerServiceWorker({
    onUpdate: async (registration) => {
      const shouldUpdate = await asyncConfirm({
        title: i18n.t('common.confirm.newVersionTitle'),
        message: i18n.t('common.confirm.newVersionMessage'),
        confirmText: '立即更新',
        cancelText: '稍后',
      })
      if (shouldUpdate) {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        window.location.reload()
      }
    },
    onSuccess: () => {
    },
  })

  initPerformanceMonitoring()
}

if (isElectron && import.meta.env.PROD) {
  initErrorReporter()
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
