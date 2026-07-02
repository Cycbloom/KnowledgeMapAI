import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Home } from 'lucide-react';

export interface RouteFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function RouteErrorFallback({ error, resetErrorBoundary }: RouteFallbackProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
      <div className="text-5xl">⚠️</div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-slate-200">
        {t('common.routeError.title')}
      </h2>
      <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md">
        {t('common.routeError.message')}
      </p>
      <pre className="text-xs text-left text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg max-w-md overflow-auto max-h-32">
        {error.message}
      </pre>
      <div className="flex gap-3">
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <RefreshCw size={16} />
          {t('common.routeError.retry')}
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-200 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Home size={16} />
          {t('common.routeError.goHome')}
        </button>
      </div>
    </div>
  );
}
