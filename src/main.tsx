import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ThemeProvider } from './hooks/useTheme'
import { registerServiceWorker } from './utils/serviceWorker'
import { initPerformanceMonitoring } from './utils/performance'
import { initErrorReporter } from './utils/errorReporter'
import { initCsrf } from './services/api'
import './index.css'
import 'katex/dist/katex.min.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

initCsrf()

if (import.meta.env.PROD) {
  initErrorReporter()
  
  registerServiceWorker({
    onUpdate: (registration) => {
      console.info('[SW] New version available')
      if (confirm('发现新版本，是否立即更新？')) {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
        window.location.reload()
      }
    },
    onSuccess: () => {
      console.info('[SW] App is ready for offline use')
    },
  })

  initPerformanceMonitoring()
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
