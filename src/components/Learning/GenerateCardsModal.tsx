import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, BrainCircuit, Settings, AlertCircle, Cloud, CloudUpload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isCapacitorMobile } from '../../config/mobileApiConfig';
import { mobileAIService } from '../../services/mobile/aiService';

interface GenerateProgress {
  current: number;
  total: number;
  isGenerating: boolean;
}

interface GenerateCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: { count: number; types: string[] }) => Promise<void>;
  nodeTitle: string;
  generateProgress?: GenerateProgress | null;
}

export const GenerateCardsModal: React.FC<GenerateCardsModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  nodeTitle,
  generateProgress
}) => {
  const navigate = useNavigate();
  const [types, setTypes] = useState<string[]>(['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank']);
  const [count, setCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileAIConfigured, setIsMobileAIConfigured] = useState(true);

  useEffect(() => {
    const mobile = isCapacitorMobile();
    setIsMobile(mobile);
    if (mobile) {
      const configured = mobileAIService.isConfigured();
      setIsMobileAIConfigured(configured);
    }
  }, [isOpen]);

  const handleGoToSettings = () => {
    onClose();
    navigate('/settings?tab=ai');
  };

  const handleToggleType = (typeId: string) => {
    setTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  };

  const handleConfirm = async () => {
    if (types.length === 0) return;
    if (isMobile && !isMobileAIConfigured) return;
    setIsLoading(true);
    try {
      await onGenerate({ count, types });
      if (!isMobile) {
        onClose();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const isGenerating = isLoading || (generateProgress?.isGenerating ?? false);
  const progressPercent = generateProgress 
    ? Math.round((generateProgress.current / generateProgress.total) * 100) 
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-800">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
             <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
               <BrainCircuit size={24} />
               <h3 className="text-xl font-bold">题目生成配置</h3>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
               <X size={20} />
             </button>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            正在为 <span className="font-semibold text-slate-700 dark:text-slate-300">"{nodeTitle}"</span> 配置挑战题目
          </p>
        </div>
        
        <div className="p-6 space-y-8">
          {/* Types */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
              题目类型选择
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'qa', label: '问答题' },
                { id: 'choice', label: '单选题' },
                { id: 'true_false', label: '判断题' },
                { id: 'multi_choice', label: '多选题' },
                { id: 'fill_in_the_blank', label: '填空题' },
                { id: 'essay', label: '解答题' }
              ].map(type => (
                <button 
                  key={type.id}
                  onClick={() => handleToggleType(type.id)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-center flex items-center justify-center gap-2
                    ${types.includes(type.id) 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-400 dark:text-indigo-300 shadow-sm' 
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {type.label}
                  {types.includes(type.id) && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                  生成数量
                </label>
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full text-sm font-bold">{count} 题</span>
            </div>
            <div className="px-2">
              <input 
                type="range" 
                min="1" 
                max="30" 
                value={count} 
                onChange={(e) => setCount(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-medium">
                <span>1</span>
                <span>15</span>
                <span>30</span>
              </div>
            </div>
          </div>

          {/* Warning/Info */}
          {isMobile && !isMobileAIConfigured ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-xs text-red-700 dark:text-red-400 flex gap-3">
              <div className="p-1 bg-red-100 dark:bg-red-800 rounded-full h-fit mt-0.5">
                <AlertCircle size={12} className="text-red-600 dark:text-red-300" />
              </div>
              <div className="flex-1">
                <p className="font-semibold mb-1">请先在设置中配置 AI API Key</p>
                <p className="leading-relaxed opacity-80">
                  移动端需要在设置中配置 AI 服务才能生成题目。
                </p>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-xl border text-xs flex gap-3 ${
              isMobile 
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-400' 
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              <div className={`p-1 rounded-full h-fit mt-0.5 ${
                isMobile 
                  ? 'bg-blue-100 dark:bg-blue-800' 
                  : 'bg-amber-100 dark:bg-amber-800'
              }`}>
                {isMobile 
                  ? <CloudUpload size={12} className="text-blue-600 dark:text-blue-300" /> 
                  : <Cloud size={12} className="text-amber-600 dark:text-amber-300" />
                }
              </div>
              <p className="leading-relaxed">
                {isMobile
                  ? '题目将在本地生成并同步到云端。'
                  : '任务将转入后台处理，您可以继续学习其他内容。'}
              </p>
            </div>
          )}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 flex justify-end gap-3">
          {isMobile && isGenerating && generateProgress ? (
            <>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    正在生成题目...
                  </span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {generateProgress.current} / {generateProgress.total} 题
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 text-center">
                  请保持应用在前台运行
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                隐藏
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors"
              >
                取消
              </button>
              {isMobile && !isMobileAIConfigured ? (
                <button
                  onClick={handleGoToSettings}
                  className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Settings size={18} />
                  前往设置
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={isLoading || types.length === 0}
                  className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  开始生成
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
