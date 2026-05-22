import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRegisterMutation } from '../hooks/mutations';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks';
import { Sun, Moon, Cloud } from 'lucide-react';
import { isValidationError } from '../utils/errors';
import { getAuthModeDisplay } from '../config/authConfig';
import type { User } from '@shared/types/user';

export const Register = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const navigate = useNavigate();
  const setUser = useStore(state => state.setUser);
  const registerMutation = useRegisterMutation();
  const { isDark, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    try {
      const data = await registerMutation.mutateAsync({ email, password, name });
      if (data.error) throw new Error(data.error);
      
      setUser(data.user as User | null, data.session?.access_token ?? null, data.session?.refresh_token ?? null);
      navigate('/');
    } catch (err: unknown) {
      if (isValidationError(err)) {
        const detailMessages = err.details?.map(d => `${d.field}: ${d.message}`) || [err.message];
        setErrors(detailMessages);
      } else {
        const errorMessage = err instanceof Error ? err.message : '注册失败';
        setErrors([errorMessage]);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md w-96 transition-colors duration-300">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-gray-100">{t('register.title')}</h2>
        <div className="flex items-center justify-center gap-1.5 mb-6 text-xs text-gray-500 dark:text-gray-400">
          <Cloud size={14} />
          <span>{getAuthModeDisplay()}</span>
        </div>
        {errors.length > 0 && (
          <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-2 mb-4 rounded">
            {errors.map((msg, index) => (
              <div key={index}>{msg}</div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('register.name')}</label>
            <input
              type="text"
              name="name"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 block w-full input-mobile rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 border transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('register.email')}</label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full input-mobile rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 border transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('register.password')}</label>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full input-mobile rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 border transition-all"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary-600 text-white p-2 rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            {t('register.submit')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('register.alreadyHaveAccount')} <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline">{t('register.login')}</Link>
        </p>
      </div>
      
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300"
        title={isDark ? t('register.switchToLight') : t('register.switchToDark')}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </div>
  );
};
