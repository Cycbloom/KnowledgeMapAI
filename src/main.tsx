import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './hooks'
import { registerServiceWorker } from './utils/serviceWorker'
import { initPerformanceMonitoring } from './utils/performance'
import { initErrorReporter } from './utils/errorReporter'
import { initCsrf } from './services/api'
import { initializeEventSubscribers } from './services/FrontendEventSubscribers'
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

initCsrf()
initializeEventSubscribers(queryClient)

const isElectron = navigator.userAgent.toLowerCase().includes('electron')

if (import.meta.env.PROD && !isElectron) {
  initErrorReporter()
  
  registerServiceWorker({
    onUpdate: (registration) => {
      if (confirm('发现新版本，是否立即更新？')) {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        window.location.reload()
      }
    },
    onSuccess: () => {
    },
  })

  initPerformanceMonitoring()
}

if (isElectron) {
  initErrorReporter()
  initPerformanceMonitoring()
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const Router = isElectron ? HashRouter : BrowserRouter;
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
}
