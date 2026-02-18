import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogoutMutation, useUser } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { LogOut, User, Settings as SettingsIcon, ExternalLink, MessageSquare, X, Database, Download, Upload, AlertTriangle } from 'lucide-react';
import { PromptSettingsPanel } from '../components/PromptSettingsPanel';
import { AIActionSettingsPanel } from '../components/AIActionSettingsPanel';
import { backupApi } from '../services/api/backup';

export const Profile = () => {
  const navigate = useNavigate();
  const { user, token, setUser } = useStore();
  const { addMessage } = useMessageStore();
  const logoutMutation = useLogoutMutation();
  const [isPromptSettingsOpen, setIsPromptSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'prompts' | 'actions'>('prompts');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: userData, isLoading } = useUser(!!token);

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

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const blob = await backupApi.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knowledgemap-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addMessage({ type: 'success', content: '备份导出成功' });
    } catch (e) {
      console.error(e);
      addMessage({ type: 'error', content: '导出备份失败' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.data) {
        throw new Error('无效的备份文件格式');
      }

      const result = await backupApi.import(data);
      addMessage({ 
        type: 'success', 
        content: `备份导入成功：${result.stats.graphs} 个图谱，${result.stats.nodes} 个节点，${result.stats.study_cards} 张学习卡片` 
      });
    } catch (e: any) {
      console.error(e);
      addMessage({ type: 'error', content: e.message || '导入备份失败' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">个人中心</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">账号信息与安全</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white flex items-center gap-2 transition-colors"
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4" />
            <span>{logoutMutation.isPending ? '退出中...' : '退出登录'}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">账号信息</h2>
          </div>

          {isLoading ? (
            <div className="text-gray-600 dark:text-gray-400">加载中...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
                <div className="text-gray-500 dark:text-gray-400">昵称</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100 break-words">{displayName}</div>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
                <div className="text-gray-500 dark:text-gray-400">邮箱</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100 break-words">{email}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <SettingsIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">系统设置</h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">管理外观、AI 模型配置及学习算法参数</p>
                </div>
                <button
                    onClick={() => navigate('/settings')}
                    className="px-4 py-2 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center gap-2 transition-colors"
                >
                    <span>前往设置</span>
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI 提示词管理</h2>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">配置用户全局 AI 提示词模板 (User Scope)</p>
                </div>
                <button
                    onClick={() => setIsPromptSettingsOpen(true)}
                    className="px-4 py-2 rounded-md bg-purple-50 dark:bg-slate-700 text-purple-700 dark:text-white hover:bg-purple-100 dark:hover:bg-slate-600 flex items-center gap-2 transition-colors"
                >
                    <span>管理提示词</span>
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Data Backup Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">数据备份</h2>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            导出所有知识图谱、节点、学习卡片和进度数据。建议定期备份以防数据丢失。
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Download className="w-5 h-5" />
              <span>{isExporting ? '导出中...' : '导出备份'}</span>
            </button>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span>{isImporting ? '导入中...' : '导入备份'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <strong>注意：</strong>导入备份会创建新的图谱和节点（不会覆盖现有数据）。如果重复导入同一备份，会产生重复内容。
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Prompt Settings Modal */}
      {isPromptSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 rounded-lg text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">AI 个性化设置</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">配置全局提示词与自定义动作 (User Scope)</p>
                </div>
              </div>
              <button onClick={() => setIsPromptSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex border-b border-gray-100 dark:border-gray-700 px-6 bg-gray-50/50 dark:bg-gray-800/50">
                <button 
                    className={`pb-3 pt-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'prompts' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('prompts')}
                >
                    提示词模板
                    {activeTab === 'prompts' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />}
                </button>
                <button 
                    className={`pb-3 pt-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'actions' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    onClick={() => setActiveTab('actions')}
                >
                    自定义动作
                    {activeTab === 'actions' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />}
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {activeTab === 'prompts' ? (
                <PromptSettingsPanel scope="user" />
              ) : (
                <AIActionSettingsPanel scope="user" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
