import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  Settings2,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  AlertCircle,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import {
  useCreateQuizSetMutation,
  useGenerateQuizMutation,
  useQuizGenerationProgress,
  useAIStatus,
} from '../../hooks/queries';
import { useMessageStore } from '../../store/useMessageStore';
import { KnowledgePointSelector } from './KnowledgePointSelector';
import { QuizTypeConfig } from './QuizTypeConfig';
import { DifficultySelector } from './DifficultySelector';
import type { QuizSetConfig } from '@shared/types/quiz';

interface QuizGenerationModalProps {
  open: boolean;
  onClose: () => void;
  graphId?: string;
  onComplete: (quizSetId: string) => void;
}

const aiProviders = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4 / GPT-3.5' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 系列' },
  { id: 'aliyun', name: '阿里云', description: '通义千问' },
  { id: 'volcengine', name: '火山引擎', description: '豆包大模型' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek 系列' },
];

const defaultConfig: QuizSetConfig = {
  cardTypes: ['qa', 'choice', 'true_false'],
  difficulty: 'medium',
  knowledgePointIds: [],
  cardsPerType: {
    qa: 5,
    choice: 5,
    true_false: 5,
    multi_choice: 3,
    fill_in_the_blank: 5,
    essay: 2,
  },
};

export const QuizGenerationModal: React.FC<QuizGenerationModalProps> = ({
  open,
  onClose,
  graphId,
  onComplete,
}) => {
  const { isDark } = useTheme();
  const { addMessage } = useMessageStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<QuizSetConfig>(defaultConfig);
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiProvider, setAiProvider] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [createdQuizSetId, setCreatedQuizSetId] = useState<string | null>(null);

  const createMutation = useCreateQuizSetMutation();
  const generateMutation = useGenerateQuizMutation();
  const { data: aiStatus } = useAIStatus(open);

  const { data: progress } = useQuizGenerationProgress(taskId, !!taskId);

  const isGenerating = !!taskId && progress?.status !== 'completed' && progress?.status !== 'failed';

  const totalQuestions = useMemo(() => {
    return config.cardTypes.reduce(
      (sum, type) => sum + (config.cardsPerType?.[type] || 0),
      0
    );
  }, [config.cardTypes, config.cardsPerType]);

  const canGenerate = useMemo(() => {
    return (
      title.trim().length >= 2 &&
      config.cardTypes.length > 0 &&
      selectedKnowledgePoints.length > 0 &&
      totalQuestions > 0
    );
  }, [title, config.cardTypes, selectedKnowledgePoints, totalQuestions]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setConfig(defaultConfig);
    setSelectedKnowledgePoints([]);
    setShowAdvanced(false);
    setCustomPrompt('');
    setAiProvider('');
    setTaskId(null);
    setCreatedQuizSetId(null);
  }, []);

  const handleClose = useCallback(() => {
    if (isGenerating) {
      if (!confirm('测验正在生成中，确定要取消吗？')) {
        return;
      }
    }
    onClose();
  }, [isGenerating, onClose]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  useEffect(() => {
    if (progress?.status === 'completed' && createdQuizSetId) {
      addMessage({ type: 'success', content: '测验生成完成！' });
      onComplete(createdQuizSetId);
      handleClose();
    } else if (progress?.status === 'failed') {
      addMessage({ type: 'error', content: progress.error || '测验生成失败' });
      setTaskId(null);
    }
  }, [progress, createdQuizSetId, addMessage, onComplete, handleClose]);

  const handleConfigChange = (partialConfig: Partial<QuizSetConfig>) => {
    setConfig((prev) => ({ ...prev, ...partialConfig }));
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    try {
      const fullConfig: QuizSetConfig = {
        ...config,
        knowledgePointIds: selectedKnowledgePoints,
        customPrompt: customPrompt || undefined,
        aiProvider: aiProvider || undefined,
      };

      const quizSet = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        graph_id: graphId,
        config: fullConfig,
      });

      setCreatedQuizSetId(quizSet.id);

      const result = await generateMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        graph_id: graphId,
        config: fullConfig,
      });

      setTaskId(result.task_id);
      addMessage({ type: 'info', content: '测验生成任务已开始...' });
    } catch (error: any) {
      console.error('Failed to generate quiz:', error);
      addMessage({ type: 'error', content: error.message || '创建测验失败' });
    }
  };

  const progressPercent = useMemo(() => {
    if (!progress) return 0;
    if (progress.total === 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  }, [progress]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div
        className={`rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200 ${
          isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'
        }`}
      >
        <div
          className={`p-6 border-b ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-gradient-to-r from-indigo-50 to-white'
          }`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  isDark ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                }`}
              >
                <BrainCircuit size={24} />
              </div>
              <div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  创建测验
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  AI 自动生成测验题目
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className={`p-2 rounded-full transition-colors ${
                isDark
                  ? 'text-slate-400 hover:bg-slate-800'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
          <div className="space-y-4">
            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}
              >
                测验标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：第一章基础概念测验"
                disabled={isGenerating}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}
              >
                描述（可选）
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="测验的简要描述..."
                disabled={isGenerating}
                rows={2}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm resize-none transition-colors ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
          </div>

          <div
            className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'}`}
          >
            <KnowledgePointSelector
              graphId={graphId}
              selectedIds={selectedKnowledgePoints}
              onChange={setSelectedKnowledgePoints}
            />
          </div>

          <div
            className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'}`}
          >
            <QuizTypeConfig config={config} onChange={handleConfigChange} />
          </div>

          <div
            className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'}`}
          >
            <DifficultySelector
              difficulty={config.difficulty}
              onChange={(difficulty) => handleConfigChange({ difficulty })}
            />
          </div>

          <div
            className={`rounded-xl overflow-hidden ${
              isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'
            }`}
          >
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={isGenerating}
              className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                isGenerating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings2
                  size={18}
                  className={isDark ? 'text-slate-400' : 'text-gray-500'}
                />
                <span
                  className={`font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}
                >
                  高级配置
                </span>
              </div>
              {showAdvanced ? (
                <ChevronUp size={18} className={isDark ? 'text-slate-400' : 'text-gray-500'} />
              ) : (
                <ChevronDown size={18} className={isDark ? 'text-slate-400' : 'text-gray-500'} />
              )}
            </button>

            {showAdvanced && (
              <div className={`px-4 pb-4 space-y-4 border-t ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                <div className="pt-4">
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-gray-700'
                    }`}
                  >
                    AI 提供者
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    disabled={isGenerating}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-white border-gray-200 text-gray-900'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="">使用默认配置</option>
                    {aiProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} - {provider.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-gray-700'
                    }`}
                  >
                    自定义提示词
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="添加自定义要求，例如：侧重于实际应用场景..."
                    disabled={isGenerating}
                    rows={3}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm resize-none ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            )}
          </div>

          {aiStatus && !aiStatus.configured && (
            <div
              className={`flex items-center gap-3 p-4 rounded-xl ${
                isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-700'
              }`}
            >
              <AlertCircle size={20} />
              <div>
                <p className="font-medium">AI 未配置</p>
                <p className="text-sm opacity-80">请在设置中配置 AI API Key 以使用测验生成功能</p>
              </div>
            </div>
          )}

          {isGenerating && progress && (
            <div
              className={`p-4 rounded-xl ${
                isDark ? 'bg-indigo-900/30' : 'bg-indigo-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                  <span className={`font-medium ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>
                    正在生成测验...
                  </span>
                </div>
                <span className={`text-sm font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {progressPercent}%
                </span>
              </div>

              <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-indigo-100'}`}>
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {progress.current && (
                <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  正在处理：{progress.current}
                </p>
              )}

              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                已完成 {progress.completed} / {progress.total} 题
              </p>
            </div>
          )}
        </div>

        <div
          className={`p-4 border-t flex justify-between items-center ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-white'
          }`}
        >
          <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
            {selectedKnowledgePoints.length > 0 ? (
              <span>
                已选择 <span className="font-bold text-indigo-600">{selectedKnowledgePoints.length}</span> 个知识点，
                预计生成 <span className="font-bold text-indigo-600">{totalQuestions}</span> 道题目
              </span>
            ) : (
              <span>请选择知识点</span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isGenerating}
              className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${
                isDark
                  ? 'text-slate-400 hover:bg-slate-800'
                  : 'text-gray-600 hover:bg-gray-100'
              } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              取消
            </button>

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating || (aiStatus && !aiStatus.configured)}
              className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold transition-all ${
                canGenerate && !isGenerating && aiStatus?.configured
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]'
                  : isDark
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  开始生成
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
