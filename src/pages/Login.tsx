import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLoginMutation } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setUser = useStore(state => state.setUser);
  const loginMutation = useLoginMutation();
  const { isDark, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await loginMutation.mutateAsync({ email, password });
      if (data.error) throw new Error(data.error);
      
      setUser(data.user, data.session?.access_token, data.session?.refresh_token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900 transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md w-96 transition-colors duration-300">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">登录</h2>
        {error && <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-2 mb-4 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">邮箱</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">密码</label>
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
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            登录
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          还没有账号? <Link to="/register" className="text-blue-600 dark:text-blue-400 hover:underline">注册</Link>
        </p>
      </div>
      
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300"
        title={isDark ? '切换到亮色模式' : '切换到暗色模式'}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </div>
  );
};
