import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIStatus, useLogoutMutation, useUser } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { LogOut, User, Cpu, KeyRound, ExternalLink } from 'lucide-react';

export const Profile = () => {
  const navigate = useNavigate();
  const { user, token, setUser } = useStore();
  const { addMessage } = useMessageStore();
  const logoutMutation = useLogoutMutation();

  const { data: userData, isLoading } = useUser(!!token);
  const { data: aiStatus } = useAIStatus(!!token);

  const profile = (userData as any)?.user?.profile;
  const displayName = profile?.name || (userData as any)?.user?.user_metadata?.name || user?.name || '未命名用户';
  const email = (userData as any)?.user?.email || user?.email || '-';

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

