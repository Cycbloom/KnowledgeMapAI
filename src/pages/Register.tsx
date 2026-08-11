import React, { useState, useId, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRegisterMutation } from '../hooks/mutations';
import { useStore } from '../store/useStore';
import { useTheme, useFormDraft } from '../hooks';
import { useKeyboardHandler } from '../hooks/gesture/useKeyboardHandler';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { Sun, Moon, Cloud, Check, X } from 'lucide-react';
import { isValidationError } from '../utils/errors';
import { getAuthModeDisplay } from '../config/authConfig';
import { checkRequirement, getPasswordRequirements } from '@shared/utils/passwordPolicy';
import type { User } from '@shared/types/user';

export const Register = () => {
  useKeyboardHandler();
  const { t } = useTranslation();
  const {
    value: draft,
    setValue: setDraft,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<{ email: string; name: string }>({
    key: 'register_draft',
    initialValue: { email: '', name: '' },
    storage: 'sessionStorage',
  });
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<{ email: boolean; password: boolean; confirmPassword: boolean }>({
    email: false,
    password: false,
    confirmPassword: false,
  });
  const navigate = useNavigate();
  const setUser = useStore(state => state.setUser);
  const registerMutation = useRegisterMutation();
  const { isDark, toggleTheme } = useTheme();
  const emailErrorId = useId();
  const confirmPasswordErrorId = useId();
  // 公共路由 main 地标 ref，路由切换时 focus 便于键盘/SR 导航
  const mainRef = useRef<HTMLElement>(null);

  // 路由切换时自动 focus 公共 main 地标，便于键盘导航与屏幕阅读器
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    try {
      const data = await registerMutation.mutateAsync({ email: draft.email, password, name: draft.name });
      if (data.error) throw new Error(data.error);

      setUser(data.user as User | null, data.session?.access_token ?? null, data.session?.refresh_token ?? null);
      clearDraft();
      navigate('/');
    } catch (err: unknown) {
      if (isValidationError(err)) {
        const detailMessages = err.details?.map(d => `${d.field}: ${d.message}`) || [err.message];
        setErrors(detailMessages);
      } else {
        const errorMessage = err instanceof Error ? err.message : t('register.registerFailed');
        setErrors([errorMessage]);
      }
    }
  };

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };
  const validateConfirmPassword = (pw: string, confirm: string): boolean => {
    return pw === confirm;
  };
  const passwordRequirements = getPasswordRequirements();
  const requirementKeys = Object.keys(passwordRequirements) as Array<keyof typeof passwordRequirements>;
  const isEmailInvalid = touched.email && !validateEmail(draft.email);
  const isPasswordInvalid = touched.password && !checkRequirement(password, 'minLength');
  const isConfirmPasswordInvalid = touched.confirmPassword && !validateConfirmPassword(password, confirmPassword);

  const getRequirementLabel = (key: keyof typeof passwordRequirements): string => {
    const labels: Record<keyof typeof passwordRequirements, string> = {
      minLength: t('register.passwordRequirements.minLength'),
      requireUpper: t('register.passwordRequirements.requireUpper'),
      requireLower: t('register.passwordRequirements.requireLower'),
      requireDigit: t('register.passwordRequirements.requireDigit'),
      requireSpecial: t('register.passwordRequirements.requireSpecial'),
    };
    return labels[key];
  };

  return (
    <main
      id="public-main"
      ref={mainRef}
      tabIndex={-1}
      className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 transition-colors duration-300 focus:outline-none"
    >
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md w-full max-w-md mx-4 transition-colors duration-300">
        <h1 className="text-2xl font-bold mb-2 text-center text-gray-900 dark:text-gray-100">{t('register.title')}</h1>
        <div className="flex items-center justify-center gap-1.5 mb-6 text-xs text-gray-500 dark:text-gray-400">
          <Cloud size={14} />
          <span>{t(getAuthModeDisplay(), { defaultValue: '' })}</span>
        </div>
        {errors.length > 0 && (
          <div role="alert" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-2 mb-4 rounded">
            {errors.map((msg, index) => (
              <div key={index}>{msg}</div>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('register.name')} <span aria-hidden="true">*</span></label>
            <input
              id="register-name"
              type="text"
              name="name"
              autoComplete="name"
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              className="mt-1 block w-full input-mobile rounded-md border-gray-300 dark:border-slate-500 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 border transition-all"
              aria-invalid={false}
              required
            />
          </div>
          <div>
            <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('register.email')} <span aria-hidden="true">*</span></label>
            <input
              id="register-email"
              type="email"
              name="email"
              autoComplete="email"
              value={draft.email}
              onChange={e => setDraft(prev => ({ ...prev, email: e.target.value }))}
              onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
              className="mt-1 block w-full input-mobile rounded-md border-gray-300 dark:border-slate-500 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 border transition-all"
              aria-invalid={isEmailInvalid}
              aria-describedby={isEmailInvalid ? emailErrorId : undefined}
              required
            />
            {isEmailInvalid && (
              <p id={emailErrorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{t('register.validation.emailInvalid')}</p>
            )}
          </div>
          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('register.password')} <span aria-hidden="true">*</span></label>
            <input
              id="register-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
              className="mt-1 block w-full input-mobile rounded-md border-gray-300 dark:border-slate-500 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 border transition-all"
              aria-invalid={isPasswordInvalid}
              aria-describedby={password ? 'password-requirements-checklist' : undefined}
              required
            />
            {password && (
              <ul id="password-requirements-checklist" className="mt-2 space-y-1">
                {requirementKeys.map((key) => {
                  const met = checkRequirement(password, key);
                  return (
                    <li key={key as string} className={`flex items-center gap-1.5 text-xs transition-colors ${met ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {met ? <Check size={14} className="shrink-0" /> : <X size={14} className="shrink-0" />}
                      <span>{getRequirementLabel(key)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('register.confirmPassword')}</label>
            <input
              id="register-confirm-password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
              className="mt-1 block w-full input-mobile rounded-md border-gray-300 dark:border-slate-500 dark:bg-slate-700 dark:text-gray-100 shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 border transition-all"
              aria-invalid={isConfirmPasswordInvalid}
              aria-describedby={isConfirmPasswordInvalid ? confirmPasswordErrorId : undefined}
            />
            {isConfirmPasswordInvalid && (
              <p id={confirmPasswordErrorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">{t('register.validation.passwordMismatch')}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-primary-600 text-white p-2 rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
          >
            {t('register.submit')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('register.alreadyHaveAccount')} <Link to="/login" className="text-primary-600 dark:text-primary-400 underline">{t('register.login')}</Link>
        </p>
      </div>
      
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300"
        title={isDark ? t('register.switchToLight') : t('register.switchToDark')}
        aria-label={isDark ? t('register.switchToLight') : t('register.switchToDark')}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <ConfirmationModal
        isOpen={showRestorePrompt}
        onClose={onDiscard}
        onConfirm={onRestore}
        title={t('common.restoreDraftTitle')}
        message={t('common.restoreDraftMessage')}
        confirmText={t('common.restore')}
        cancelText={t('common.discard')}
      />
    </main>
  );
};
