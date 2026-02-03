import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIStatus, useLogoutMutation, useUser, useUpdateProfileMutation } from '../hooks/useQueries';
import { useStore } from '../store/useStore';
import { useMessageStore } from '../store/useMessageStore';
import { useTheme } from '../hooks/useTheme';
import { LogOut, User, Cpu, KeyRound, ExternalLink, Brain, Save, Palette, Sun, Moon, Monitor, Plus, Trash2 } from 'lucide-react';
import { AvailableModels } from '../types';

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

  // AI Configuration State
  const [textConfig, setTextConfig] = useState({ provider: 'deepseek', model: 'deepseek-chat' });
  const [embeddingConfig, setEmbeddingConfig] = useState({ provider: 'volcengine', model: 'doubao-embedding-1.5' });
  const [reasoningConfig, setReasoningConfig] = useState({ provider: 'aliyun', model: 'qwen-max' });

  // Available Models State
  const [availableModels, setAvailableModels] = useState<AvailableModels>({
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    volcengine: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-embedding-1.5'],
    aliyun: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  });
  const [newModelName, setNewModelName] = useState('');
  const [selectedProviderForAdd, setSelectedProviderForAdd] = useState('deepseek');

  useEffect(() => {
    if (settings) {
      if (settings.request_retention) setRetention(Number(settings.request_retention));
      if (settings.maximum_interval) setMaxInterval(Number(settings.maximum_interval));
      
      // Load AI Config from DB
      if (settings.ai_config) {
        if (settings.ai_config.text) setTextConfig(settings.ai_config.text);
        if (settings.ai_config.embedding) setEmbeddingConfig(settings.ai_config.embedding);
        if (settings.ai_config.reasoning) setReasoningConfig(settings.ai_config.reasoning);
      }

      if (settings.available_models) {
        setAvailableModels(prev => ({
          ...prev,
          ...settings.available_models
        }));
      }
    }
  }, [settings]);

  const handleSaveAISettings = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        settings: {
          ...settings, // Preserve other settings
          request_retention: Number(retention), // Ensure these are also saved/preserved
          maximum_interval: Number(maxInterval),
          ai_config: {
            text: textConfig,
            embedding: embeddingConfig,
            reasoning: reasoningConfig
          },
          available_models: availableModels
        }
      });
      addMessage({ type: 'success', content: 'AI 配置已保存到云端' });
    } catch (e) {
      console.error(e);
      addMessage({ type: 'error', content: '保存 AI 配置失败' });
    }
  };

  const handleAddModel = () => {
    if (!newModelName.trim()) return;
    const provider = selectedProviderForAdd;
    const currentModels = availableModels[provider] || [];
    
    if (currentModels.includes(newModelName.trim())) {
      addMessage({ type: 'warning', content: '该模型已存在' });
      return;
    }

    setAvailableModels(prev => ({
      ...prev,
      [provider]: [...(prev[provider] || []), newModelName.trim()]
    }));
    setNewModelName('');
    addMessage({ type: 'success', content: `已添加模型: ${newModelName}` });
  };

  const handleDeleteModel = (provider: string, model: string) => {
    setAvailableModels(prev => ({
      ...prev,
      [provider]: prev[provider].filter(m => m !== model)
    }));
  };

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
    <div className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">个人中心</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">账号信息与系统配置</p>
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
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">外观设置</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setTheme('light')}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                themeMode === 'light'
                  ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700'
              }`}
            >
              <Sun className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">浅色模式</span>
            </button>
            
            <button
              onClick={() => setTheme('dark')}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                themeMode === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white ring-1 ring-slate-600 dark:bg-blue-600 dark:border-blue-500'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700'
              }`}
            >
              <Moon className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">深色模式</span>
            </button>
            
            <button
              onClick={() => setTheme('system')}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all ${
                themeMode === 'system'
                  ? 'bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300'
                  : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700'
              }`}
            >
              <Monitor className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">跟随系统</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI 状态与配置</h2>
            </div>
            <button
               onClick={handleSaveAISettings}
               className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-700 flex items-center gap-2 transition-colors"
            >
               <Save className="w-4 h-4" />
               <span>保存配置</span>
            </button>
          </div>

          {/* Model Management Section */}
          <div className="mb-8 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
             <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">可用模型库管理</h3>
             </div>
             <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">在此添加各服务商支持的模型，以便在下方任务中选择。</p>
             
             <div className="flex gap-2 mb-4">
                <select 
                   value={selectedProviderForAdd}
                   onChange={(e) => setSelectedProviderForAdd(e.target.value)}
                   className="p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                   <option value="deepseek">Deepseek</option>
                   <option value="volcengine">火山引擎 (Volcengine)</option>
                   <option value="aliyun">阿里云 (Aliyun)</option>
                </select>
                <input 
                   type="text" 
                   value={newModelName}
                   onChange={(e) => setNewModelName(e.target.value)}
                   placeholder="输入模型名称 (如 deepseek-chat)"
                   className="flex-1 p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button 
                   onClick={handleAddModel}
                   disabled={!newModelName.trim()}
                   className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                   <Plus className="w-4 h-4" /> 添加
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(availableModels).map(([provider, models]) => (
                   <div key={provider} className="bg-white dark:bg-slate-900 p-3 rounded border border-gray-100 dark:border-slate-700">
                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 border-b dark:border-slate-700 pb-1">{provider}</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                         {models.map(model => (
                            <div key={model} className="flex justify-between items-center text-sm group text-gray-700 dark:text-gray-300">
                               <span className="truncate" title={model}>{model}</span>
                               <button 
                                  onClick={() => handleDeleteModel(provider, model)}
                                  className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                               >
                                  <Trash2 className="w-3 h-3" />
                               </button>
                            </div>
                         ))}
                         {models.length === 0 && <div className="text-xs text-gray-300 dark:text-gray-600 italic">无模型</div>}
                      </div>
                   </div>
                ))}
             </div>
          </div>

          <div className="space-y-6">
            {/* Text Task Config */}
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-400">
                  <Brain className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">文本生成任务 (对话/卡片/扩充)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">提供方</label>
                  <select 
                    value={textConfig.provider}
                    onChange={(e) => setTextConfig({ ...textConfig, provider: e.target.value, model: availableModels[e.target.value]?.[0] || '' })}
                    className="w-full p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="deepseek">Deepseek</option>
                    <option value="volcengine">火山引擎 (Volcengine)</option>
                    <option value="aliyun">阿里云 (Aliyun)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">模型名称</label>
                  <select 
                    value={textConfig.model}
                    onChange={(e) => setTextConfig({ ...textConfig, model: e.target.value })}
                    className="w-full p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                     {availableModels[textConfig.provider]?.map(m => (
                        <option key={m} value={m}>{m}</option>
                     ))}
                     {!availableModels[textConfig.provider]?.length && <option value="" disabled>该提供方暂无模型</option>}
                  </select>
                </div>
              </div>
            </div>

            {/* Embedding Task Config */}
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">向量化任务 (搜索/相似度)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">提供方</label>
                  <select 
                    value={embeddingConfig.provider}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, provider: e.target.value, model: availableModels[e.target.value]?.[0] || '' })}
                    className="w-full p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="volcengine">火山引擎 (Volcengine)</option>
                    <option value="aliyun">阿里云 (Aliyun)</option>
                    <option value="deepseek">Deepseek</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">模型名称</label>
                   <select 
                    value={embeddingConfig.model}
                    onChange={(e) => setEmbeddingConfig({ ...embeddingConfig, model: e.target.value })}
                    className="w-full p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                     {availableModels[embeddingConfig.provider]?.map(m => (
                        <option key={m} value={m}>{m}</option>
                     ))}
                     {!availableModels[embeddingConfig.provider]?.length && <option value="" disabled>该提供方暂无模型</option>}
                  </select>
                </div>
              </div>
            </div>

            {/* Reasoning Task Config */}
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded text-orange-700 dark:text-orange-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">推理任务 (复杂逻辑/规划)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">提供方</label>
                  <select 
                    value={reasoningConfig.provider}
                    onChange={(e) => setReasoningConfig({ ...reasoningConfig, provider: e.target.value, model: availableModels[e.target.value]?.[0] || '' })}
                    className="w-full p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="aliyun">阿里云 (Aliyun)</option>
                    <option value="deepseek">Deepseek</option>
                    <option value="volcengine">火山引擎 (Volcengine)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">模型名称</label>
                  <select 
                    value={reasoningConfig.model}
                    onChange={(e) => setReasoningConfig({ ...reasoningConfig, model: e.target.value })}
                    className="w-full p-2 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                     {availableModels[reasoningConfig.provider]?.map(m => (
                        <option key={m} value={m}>{m}</option>
                     ))}
                     {!availableModels[reasoningConfig.provider]?.length && <option value="" disabled>该提供方暂无模型</option>}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {!aiStatus?.enabled && (
            <div className="mt-5 p-4 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 text-sm">
              <div className="flex items-start gap-2">
                <KeyRound className="w-4 h-4 mt-0.5" />
                <div>
                  <div className="font-semibold">配置方式</div>
                  <div className="mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                    在服务端环境变量中配置 AI_API_KEY 或 DEEPSEEK_API_KEY，然后重启服务端进程。未配置时：文本分析/对话会进入模拟模式，文档解析与智能推荐将不可用。
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
               <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
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

