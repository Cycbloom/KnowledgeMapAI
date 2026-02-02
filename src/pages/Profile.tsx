import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIStatus, useLogoutMutation, useUser, useUpdateProfileMutation } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { useTheme } from '../hooks/useTheme';
import { LogOut, User, Cpu, KeyRound, ExternalLink, Brain, Save, Palette, Sun, Moon, Monitor } from 'lucide-react';

export const Profile = () => {
  const navigate = useNavigate();
  const { user, token, setUser } = useStore();
  const { themeMode, setTheme } = useTheme();
  const { addMessage } = useMessageStore();
  const logoutMutation = useLogoutMutation();

  const { data: userData, isLoading } = useUser(!!token);
  const { data: aiStatus } = useAIStatus(!!token);
  const updateProfileMutation = useUpdateProfileMutation();

  const profile = (userData as any)?.user?.profile;
  const settings = profile?.settings;
  const displayName = profile?.name || (userData as any)?.user?.user_metadata?.name || user?.name || '未命名用户';
  const email = (userData as any)?.user?.email || user?.email || '-';

  const [retention, setRetention] = useState(0.9);
  const [maxInterval, setMaxInterval] = useState(36500);

  useEffect(() => {
    if (settings) {
      if (settings.request_retention) setRetention(Number(settings.request_retention));
      if (settings.maximum_interval) setMaxInterval(Number(settings.maximum_interval));
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        settings: {
          request_retention: Number(retention),
          maximum_interval: Number(maxInterval)
        }
      });
      addMessage({ type: 'success', content: '算法配置已保存' });
    } catch (e) {
      addMessage({ type: 'error', content: '保存失败' });
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      console.error(e);
    }
    setUser(null, null);
    addMessage({ type: 'success', content: '已退出登录' });
    navigate('/login');
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">个人中心</h1>
            <p className="text-gray-600 mt-1">账号信息与系统配置</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2"
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4" />
            <span>{logoutMutation.isPending ? '退出中...' : '退出登录'}</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">账号信息</h2>
          </div>

          {isLoading ? (
            <div className="text-gray-600">加载中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-gray-500">昵称</div>
                <div className="mt-1 font-semibold text-gray-900 break-words">{displayName}</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-gray-500">邮箱</div>
                <div className="mt-1 font-semibold text-gray-900 break-words">{email}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-pink-600" />
            <h2 className="text-lg font-bold text-gray-900">外观设置</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                themeMode === 'light'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sun className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">浅色模式</span>
            </button>
            
            <button
              onClick={() => setTheme('dark')}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                themeMode === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white ring-1 ring-slate-600'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Moon className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">深色模式</span>
            </button>
            
            <button
              onClick={() => setTheme('system')}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                themeMode === 'system'
                  ? 'bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-200'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Monitor className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">跟随系统</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">AI 状态</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-gray-500">是否启用</div>
              <div className={`mt-1 font-semibold ${aiStatus?.enabled ? 'text-emerald-700' : 'text-amber-800'}`}>
                {aiStatus?.enabled ? '已启用' : '未启用'}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-gray-500">提供方</div>
              <div className="mt-1 font-semibold text-gray-900">{aiStatus?.provider || '-'}</div>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
              <div className="text-gray-500">模型</div>
              <div className="mt-1 font-semibold text-gray-900">{aiStatus?.model || '-'}</div>
            </div>
          </div>

          {!aiStatus?.enabled && (
            <div className="mt-5 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm">
              <div className="flex items-start gap-2">
                <KeyRound className="w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-semibold">配置方式</div>
                  <div className="mt-1 leading-relaxed text-amber-800">
                    在服务端环境变量中配置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY，然后重启服务端进程。未配置时：文本分析/对话会进入模拟模式，文档解析与智能推荐将不可用。
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <Brain className="w-5 h-5 text-indigo-600" />
               <h2 className="text-lg font-bold text-gray-900">学习算法配置 (FSRS)</h2>
            </div>
            <button
               onClick={handleSaveSettings}
               disabled={updateProfileMutation.isPending}
               className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
            >
               <Save className="w-4 h-4" />
               <span>{updateProfileMutation.isPending ? '保存中...' : '保存配置'}</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                   <label className="font-semibold text-gray-700 text-sm">目标保留率 (Request Retention)</label>
                   <span className="text-indigo-600 font-bold">{Number(retention).toFixed(2)}</span>
                </div>
                <input 
                   type="range" 
                   min="0.70" 
                   max="0.99" 
                   step="0.01"
                   value={retention}
                   onChange={(e) => setRetention(Number(e.target.value))}
                   className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-xs text-gray-500 mt-2">
                   设定您希望在复习时记住的概率。值越高，复习越频繁，记忆越牢固。建议范围：0.80 - 0.95。
                </p>
             </div>
             
             <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                   <label className="font-semibold text-gray-700 text-sm">最大复习间隔 (天)</label>
                   <span className="text-indigo-600 font-bold">{maxInterval} 天</span>
                </div>
                <input 
                   type="range" 
                   min="1" 
                   max="36500" 
                   step="100"
                   value={maxInterval}
                   onChange={(e) => setMaxInterval(Number(e.target.value))}
                   className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-xs text-gray-500 mt-2">
                   限制卡片复习的最大间隔天数。默认 36500 天（100年）。
                </p>
             </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">快捷入口</div>
              <div className="text-sm text-gray-600 mt-1">常用功能快速跳转</div>
            </div>
            <button
              onClick={() => navigate('/tasks')}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>打开任务中心</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

