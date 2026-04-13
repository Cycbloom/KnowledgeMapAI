import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLoginMutation } from '../hooks/mutations';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks';
import { Sun, Moon, Cloud } from 'lucide-react';
import { getAuthModeDisplay } from '../config/authConfig';
import { credentialStorage } from '../utils/credentialStorage';
import { getSupabaseClient, resetSupabaseClient } from '../lib/supabase';

interface ApiErrorResponse {
  code?: string;
  message?: string;
}

export const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setUser = useStore(state => state.setUser);
  const loginMutation = useLoginMutation();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const saved = credentialStorage.load();
    if (saved) {
      setEmail(saved.email);
      setPassword(saved.password);
      setRememberMe(true);
    }
  }, []);

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      credentialStorage.clear();
    }
  };

  const getErrorMessage = (err: any): string => {
    if (err.response?.data) {
      const apiError = err.response.data as ApiErrorResponse;
      if (apiError.code) {
        return t(`errors.${apiError.code}`, { defaultValue: apiError.message || t('errors.UNKNOWN_ERROR') });
      }
      if (apiError.message) {
        return apiError.message;
      }
    }
    if (err.message) {
      if (err.message.includes('Invalid login credentials') || err.message.includes('invalid')) {
        return t('errors.INVALID_CREDENTIALS');
      }
      return err.message;
    }
    return t('errors.UNKNOWN_ERROR');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const client = getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
      resetSupabaseClient();
      
      const data = await loginMutation.mutateAsync({ email, password });
      
      if (data.error) throw new Error(data.error);
      
      if (rememberMe) {
        credentialStorage.save(email, password);
      } else {
        credentialStorage.clear();
      }
      
      setUser(data.user, data.session?.access_token ?? null, data.session?.refresh_token ?? null);
      navigate('/');
    } catch (err: any) {
      console.error('[Login] 登录失败:', err);
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md w-96 transition-colors duration-300">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-gray-100">{t('auth.login')}</h2>
        <div className="flex items-center justify-center gap-1.5 mb-6 text-xs text-gray-500 dark:text-gray-400">
          <Cloud size={14} />
          <span>{getAuthModeDisplay()}</span>
        </div>
        {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-2 mb-4 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('auth.email')}</label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('auth.password')}</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
              required
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={e => handleRememberMeChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded cursor-pointer"
            />
            <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              {t('auth.rememberMe')}
            </label>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            {t('auth.login')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('auth.noAccount')} <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline">{t('auth.register')}</Link>
        </p>
      </div>
      
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300"
        title={isDark ? t('auth.switchToLightMode') : t('auth.switchToDarkMode')}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </div>
  );
};
