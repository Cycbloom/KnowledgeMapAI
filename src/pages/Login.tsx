import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../services/api/createApiClient';
import { updateSupabaseConfig, isSupabaseConfigured, authConfig } from '../config/authConfig';
import { getSupabaseClient, resetSupabaseClient } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks';
import {
  Database,
  Bot,
  Sun,
  Moon,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

type AIProviderType = 'deepseek' | 'volcengine' | 'aliyun' | 'openai' | 'zhipu' | 'moonshot';

interface MigrationResult {
  name: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  message?: string;
}

interface ConfiguredProvider {
  provider: AIProviderType;
  label: string;
}

const AI_PROVIDERS: { value: AIProviderType; label: string; defaultBaseURL: string; defaultModel: string }[] = [
  { value: 'deepseek', label: 'DeepSeek', defaultBaseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { value: 'volcengine', label: 'Volcengine', defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-pro-32k' },
  { value: 'aliyun', label: 'Aliyun', defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-turbo' },
  { value: 'openai', label: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { value: 'zhipu', label: 'Zhipu', defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4', defaultModel: 'glm-4-flash' },
  { value: 'moonshot', label: 'Moonshot', defaultBaseURL: 'https://api.moonshot.cn/v1', defaultModel: 'moonshot-v1-8k' },
];

export const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useStore(state => state.setUser);
  const { isDark, toggleTheme } = useTheme();

  const [dbForm, setDbForm] = useState({
    url: '',
    anonKey: '',
    serviceRoleKey: '',
    databaseUrl: '',
  });
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceRoleKey, setShowServiceRoleKey] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbError, setDbError] = useState('');
  const [dbStatus, setDbStatus] = useState<'empty' | 'partial' | 'ready' | 'unknown' | 'loading'>('loading');
  const [dbInitializing, setDbInitializing] = useState(false);
  const [migrations, setMigrations] = useState<MigrationResult[]>([]);

  const [aiProvider, setAiProvider] = useState<AIProviderType>('deepseek');
  const [aiApiKey, setAiApiKey] = useState('');
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [aiBaseURL, setAiBaseURL] = useState('https://api.deepseek.com/v1');
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<'success' | 'error' | null>(null);
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [configuredProviders, setConfiguredProviders] = useState<ConfiguredProvider[]>([]);

  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    loadSavedConfig();
  }, []);

  useEffect(() => {
    const provider = AI_PROVIDERS.find(p => p.value === aiProvider);
    if (provider) {
      setAiBaseURL(provider.defaultBaseURL);
      setAiModel(provider.defaultModel);
    }
  }, [aiProvider]);

  const loadSavedConfig = async () => {
    const savedUrl = authConfig.supabase.url;
    const savedAnonKey = authConfig.supabase.anonKey;
    if (savedUrl) {
      setDbForm(prev => ({ ...prev, url: savedUrl }));
    }
    if (savedAnonKey) {
      setDbForm(prev => ({ ...prev, anonKey: savedAnonKey }));
    }

    if (window.electronAPI?.config) {
      try {
        const electronConfig = await window.electronAPI.config.read() as Record<string, unknown>;
        const db = electronConfig?.database as Record<string, string> | undefined;
        if (db) {
          setDbForm(prev => ({
            ...prev,
            url: db.url || prev.url,
            anonKey: db.anonKey || prev.anonKey,
            serviceRoleKey: db.serviceRoleKey || prev.serviceRoleKey,
            databaseUrl: db.databaseUrl || prev.databaseUrl,
          }));
        }
      } catch {
        // ignore electron config read errors
      }
    }

    try {
      const response = await apiClient.get('/ai/config/database') as Record<string, string>;
      if (response) {
        setDbForm(prev => ({
          ...prev,
          url: response.url || prev.url,
          anonKey: response.anonKey || prev.anonKey,
          serviceRoleKey: response.serviceRoleKey || prev.serviceRoleKey,
          databaseUrl: response.databaseUrl || prev.databaseUrl,
        }));
      }
    } catch {
      // ignore database config read errors
    }

    if (isSupabaseConfigured()) {
      checkDatabaseStatus();
      setDbConnected(true);
    } else {
      setDbStatus('unknown');
    }

    loadConfiguredProviders();
  };

  const loadConfiguredProviders = async () => {
    try {
      const response = await apiClient.get('/ai/config/providers') as Record<string, Record<string, string>>;
      const providers: ConfiguredProvider[] = [];
      if (response && typeof response === 'object') {
        for (const [key, value] of Object.entries(response)) {
          if (value?.apiKey) {
            const providerInfo = AI_PROVIDERS.find(p => p.value === key);
            providers.push({
              provider: key as AIProviderType,
              label: providerInfo?.label || key,
            });
          }
        }
      }
      setConfiguredProviders(providers);
    } catch {
      // ignore provider config read errors
    }
  };

  const checkDatabaseStatus = async () => {
    setDbStatus('loading');
    try {
      const response = await apiClient.get('/database/status') as { status: string };
      setDbStatus(response.status as 'empty' | 'partial' | 'ready');
    } catch {
      setDbStatus('unknown');
    }
  };

  const handleTestConnection = async () => {
    if (!dbForm.url.trim() || !dbForm.anonKey.trim()) {
      setDbError(t('configPage.urlAndAnonKeyRequired'));
      return;
    }

    setDbTesting(true);
    setDbError('');
    setDbConnected(false);

    try {
      if (window.electronAPI?.config) {
        await window.electronAPI.config.write({
          database: {
            url: dbForm.url,
            anonKey: dbForm.anonKey,
            serviceRoleKey: dbForm.serviceRoleKey,
            databaseUrl: dbForm.databaseUrl,
          },
        });
      }

      await apiClient.put('/ai/config/database', {
        url: dbForm.url,
        anonKey: dbForm.anonKey,
        serviceRoleKey: dbForm.serviceRoleKey,
        databaseUrl: dbForm.databaseUrl,
      });

      updateSupabaseConfig(dbForm.url, dbForm.anonKey);
      resetSupabaseClient();

      setDbConnected(true);
      checkDatabaseStatus();
      attemptAutoAuth();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDbError(message || t('configPage.connectionFailed'));
    } finally {
      setDbTesting(false);
    }
  };

  const attemptAutoAuth = async () => {
    setAuthenticating(true);
    setAuthError('');

    try {
      const client = getSupabaseClient();
      if (!client) {
        setAuthenticating(false);
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session) {
        setUser(
          sessionData.session.user as unknown as Parameters<typeof setUser>[0],
          sessionData.session.access_token,
          sessionData.session.refresh_token,
        );
        navigate('/');
        return;
      }

      const { data: anonData, error: anonError } = await client.auth.signInAnonymously();
      if (!anonError && anonData.session) {
        setUser(
          anonData.session.user as unknown as Parameters<typeof setUser>[0],
          anonData.session.access_token,
          anonData.session.refresh_token,
        );
        navigate('/');
        return;
      }

      setShowAuthForm(true);
    } catch {
      setShowAuthForm(true);
    } finally {
      setAuthenticating(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email.trim() || !authForm.password.trim()) return;

    setAuthenticating(true);
    setAuthError('');

    try {
      const client = getSupabaseClient();
      if (!client) {
        setAuthError(t('configPage.noSupabaseClient'));
        return;
      }

      const { data, error } = await client.auth.signUp({
        email: authForm.email,
        password: authForm.password,
      });

      if (error) {
        const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (signInError) {
          setAuthError(signInError.message);
          return;
        }
        if (signInData.session) {
          setUser(
            signInData.session.user as unknown as Parameters<typeof setUser>[0],
            signInData.session.access_token,
            signInData.session.refresh_token,
          );
          navigate('/');
        }
        return;
      }

      if (data.session) {
        setUser(
          data.session.user as unknown as Parameters<typeof setUser>[0],
          data.session.access_token,
          data.session.refresh_token,
        );
        navigate('/');
      } else {
        setAuthError(t('configPage.confirmEmail'));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthError(message);
    } finally {
      setAuthenticating(false);
    }
  };

  const handleInitializeDatabase = async () => {
    setDbInitializing(true);
    setMigrations([]);

    try {
      const response = await apiClient.post('/database/migrate') as {
        migrations?: Array<{ name: string; status: string; message?: string }>;
        results?: Array<{ name: string; status: string; message?: string }>;
      };

      const rawMigrations = response.migrations || response.results || [];
      const mapped: MigrationResult[] = rawMigrations.map(m => ({
        name: m.name,
        status: m.status === 'success' || m.status === 'applied' ? 'success' : m.status === 'failed' ? 'failed' : 'success',
        message: m.message,
      }));

      setMigrations(mapped);

      const allSuccess = mapped.every(m => m.status === 'success');
      if (allSuccess && mapped.length > 0) {
        setDbStatus('ready');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMigrations(prev => [...prev, { name: t('configPage.migrationError'), status: 'failed', message }]);
    } finally {
      setDbInitializing(false);
    }
  };

  const handleSaveAIConfig = async () => {
    if (!aiApiKey.trim()) {
      setAiTestResult('error');
      setAiTestMessage(t('configPage.apiKeyRequired'));
      return;
    }

    setAiSaving(true);
    try {
      const updateData: Record<string, { apiKey?: string; baseURL?: string; model?: string }> = {};
      updateData[aiProvider] = {
        apiKey: aiApiKey,
        baseURL: aiBaseURL,
        model: aiModel,
      };
      await apiClient.put('/ai/config/providers', { providers: updateData });
      setAiTestResult('success');
      setAiTestMessage(t('configPage.aiConfigSaved'));
      loadConfiguredProviders();
    } catch {
      setAiTestResult('error');
      setAiTestMessage(t('configPage.aiConfigSaveFailed'));
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAIConfig = async () => {
    if (!aiApiKey.trim()) {
      setAiTestResult('error');
      setAiTestMessage(t('configPage.apiKeyRequired'));
      return;
    }

    setAiTesting(true);
    setAiTestResult(null);
    try {
      const response = await apiClient.post('/ai/config/providers/test', {
        provider: aiProvider,
        apiKey: aiApiKey,
        baseURL: aiBaseURL,
        model: aiModel,
      }) as { success: boolean; message: string };
      if (response.success) {
        setAiTestResult('success');
        setAiTestMessage(t('configPage.aiTestSuccess'));
      } else {
        setAiTestResult('error');
        setAiTestMessage(response.message || t('configPage.aiTestFailed'));
      }
    } catch {
      setAiTestResult('error');
      setAiTestMessage(t('configPage.aiTestFailed'));
    } finally {
      setAiTesting(false);
    }
  };

  const renderPasswordField = (
    value: string,
    onChange: (val: string) => void,
    show: boolean,
    onToggle: () => void,
    placeholder: string,
  ) => (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2.5 pr-10 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  const renderSupabaseCard = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Database className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('configPage.connectSupabase')}
        </h2>
        {dbConnected ? (
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <Check className="w-3 h-3" />
            {t('configPage.connected')}
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
            {t('configPage.notConnected')}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.supabaseUrl')}
          </label>
          <input
            type="text"
            value={dbForm.url}
            onChange={e => setDbForm(prev => ({ ...prev, url: e.target.value }))}
            placeholder="https://xxx.supabase.co"
            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.anonKey')}
          </label>
          {renderPasswordField(
            dbForm.anonKey,
            val => setDbForm(prev => ({ ...prev, anonKey: val })),
            showAnonKey,
            () => setShowAnonKey(!showAnonKey),
            'eyJhbGciOi...',
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.serviceRoleKey')}
          </label>
          {renderPasswordField(
            dbForm.serviceRoleKey,
            val => setDbForm(prev => ({ ...prev, serviceRoleKey: val })),
            showServiceRoleKey,
            () => setShowServiceRoleKey(!showServiceRoleKey),
            'eyJhbGciOi...',
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.databaseUrl')}
          </label>
          <input
            type="text"
            value={dbForm.databaseUrl}
            onChange={e => setDbForm(prev => ({ ...prev, databaseUrl: e.target.value }))}
            placeholder="postgresql://postgres:...@db.xxx.supabase.co:5432/postgres"
            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t('configPage.databaseUrlHelp')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleTestConnection}
          disabled={dbTesting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dbTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('configPage.testing')}
            </>
          ) : (
            t('configPage.testConnection')
          )}
        </button>

        {dbError && (
          <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <X className="w-4 h-4" />
            {dbError}
          </div>
        )}
      </div>

      {dbConnected && dbStatus !== 'ready' && dbStatus !== 'loading' && dbStatus !== 'unknown' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-600 dark:text-amber-400">
              {dbStatus === 'empty' ? t('configPage.schemaEmpty') : t('configPage.schemaPartial')}
            </span>
          </div>
          <button
            onClick={handleInitializeDatabase}
            disabled={dbInitializing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {dbInitializing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('configPage.initializing')}
              </>
            ) : (
              t('configPage.initializeDatabase')
            )}
          </button>
        </div>
      )}

      {dbConnected && dbStatus === 'ready' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check className="w-4 h-4" />
          {t('configPage.schemaReady')}
        </div>
      )}

      {migrations.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('configPage.migrationProgress')}
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
            {migrations.map((migration, index) => (
              <div key={index} className="px-3 py-2 flex items-center gap-2">
                {migration.status === 'success' && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                {migration.status === 'failed' && <X className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                {migration.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500 shrink-0" />}
                {migration.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{migration.name}</p>
                  {migration.message && (
                    <p className={`text-xs mt-0.5 ${migration.status === 'failed' ? 'text-red-500' : 'text-gray-400'}`}>
                      {migration.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAuthForm && (
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {t('configPage.signInRequired')}
          </p>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <input
              type="email"
              value={authForm.email}
              onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder={t('configPage.email')}
              className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="password"
              value={authForm.password}
              onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
              placeholder={t('configPage.password')}
              className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {authError && (
              <p className="text-xs text-red-500">{authError}</p>
            )}
            <button
              type="submit"
              disabled={authenticating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('configPage.signingIn')}
                </>
              ) : (
                t('configPage.signIn')
              )}
            </button>
          </form>
        </div>
      )}

      {dbConnected && authenticating && !showAuthForm && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('configPage.authenticating')}
        </div>
      )}
    </div>
  );

  const renderAICard = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('configPage.configureAI')}
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.provider')}
          </label>
          <div className="relative">
            <select
              value={aiProvider}
              onChange={e => setAiProvider(e.target.value as AIProviderType)}
              className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
            >
              {AI_PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.apiKey')}
          </label>
          {renderPasswordField(
            aiApiKey,
            setAiApiKey,
            showAiApiKey,
            () => setShowAiApiKey(!showAiApiKey),
            t('configPage.apiKeyPlaceholder'),
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.baseUrl')}
          </label>
          <input
            type="text"
            value={aiBaseURL}
            onChange={e => setAiBaseURL(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('configPage.model')}
          </label>
          <input
            type="text"
            value={aiModel}
            onChange={e => setAiModel(e.target.value)}
            placeholder="model-name"
            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSaveAIConfig}
          disabled={aiSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('configPage.saving')}
            </>
          ) : (
            t('configPage.save')
          )}
        </button>
        <button
          onClick={handleTestAIConfig}
          disabled={aiTesting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('configPage.testing')}
            </>
          ) : (
            t('configPage.test')
          )}
        </button>
        {aiTestResult && (
          <div className={`flex items-center gap-1.5 text-sm ${aiTestResult === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {aiTestResult === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {aiTestMessage}
          </div>
        )}
      </div>

      {configuredProviders.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t('configPage.configuredProviders')}
          </p>
          <div className="flex flex-wrap gap-2">
            {configuredProviders.map(p => (
              <span
                key={p.provider}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              >
                <Check className="w-3 h-3" />
                {p.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-4xl">
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-8">
            KnowledgeMap
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderSupabaseCard()}
            {renderAICard()}
          </div>
        </div>
      </div>

      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300"
        title={isDark ? t('configPage.switchToLightMode') : t('configPage.switchToDarkMode')}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </div>
  );
};
