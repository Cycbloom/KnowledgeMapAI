import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  BrainCircuit,
  AlertCircle,
  PenLine,
  Route,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { useTheme } from "../../hooks";
import {
  useCreateQuizSetMutation,
  useGenerateQuizMutation,
  useQuizGenerationProgress,
  useAIStatus,
  useGraphLearningPath,
  useUser,
} from '../../hooks/queries';
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { useStore } from '../../store/useStore';
import { KnowledgePointSelector } from './KnowledgePointSelector';
import { QuizTypeConfig } from './QuizTypeConfig';
import { DifficultySelector } from './DifficultySelector';
import { PromptConfigContent } from '../PromptConfig';
import type { QuizSetConfig } from '@shared/types/quiz';
import type { User } from '@shared/types/user';

interface LearningPathStageNode {
  knowledge_point_id?: string;
}

interface LearningPathStage {
  id?: string;
  title?: string;
  description?: string;
  nodes?: LearningPathStageNode[];
}

interface QuizGenerationModalProps {
  open: boolean;
  onClose: () => void;
  graphId?: string;
  onComplete: (quizSetId: string) => void;
}

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
  graphId: initialGraphId,
  onComplete,
}) => {
  const { isDark } = useTheme();
  const { token } = useStore();
  const { data: userData } = useUser(!!token);

  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(initialGraphId || null);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<QuizSetConfig>(defaultConfig);
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [createdQuizSetId, setCreatedQuizSetId] = useState<string | null>(null);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [showPromptConfig, setShowPromptConfig] = useState(false);

  const profile = (userData as { user?: { profile?: User['profile'] } } | null)?.user?.profile;
  const settings = profile?.settings;
  const promptConfigs = settings?.ai_config as Record<string, string> | undefined;

  const createMutation = useCreateQuizSetMutation();
  const generateMutation = useGenerateQuizMutation();
  const { data: aiStatus } = useAIStatus(open);
  const { data: learningPath } = useGraphLearningPath(selectedGraphId || '');

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
    setSelectedGraphId(initialGraphId || null);
    setSelectedPathId(null);
    setTitle('');
    setDescription('');
    setConfig(defaultConfig);
    setSelectedKnowledgePoints([]);
    setCustomPrompt('');
    setTaskId(null);
    setCreatedQuizSetId(null);
    setIsGeneratingTitle(false);
    setShowPromptConfig(false);
  }, [initialGraphId]);

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
    if (open && promptConfigs?.quiz_generation) {
      setCustomPrompt(promptConfigs.quiz_generation);
    }
  }, [open, promptConfigs?.quiz_generation]);

  useEffect(() => {
    if (progress?.status === 'completed' && createdQuizSetId) {
      frontendEventBus.publish("message_show", { type: 'success', content: '测验生成完成！' });
      onComplete(createdQuizSetId);
      handleClose();
    } else if (progress?.status === 'failed') {
      frontendEventBus.publish("message_show", { type: 'error', content: progress.error || '测验生成失败' });
      setTaskId(null);
    }
  }, [progress, createdQuizSetId, onComplete, handleClose]);

  const handleGraphChange = (graphId: string) => {
    setSelectedGraphId(graphId || null);
    setSelectedPathId(null);
    setSelectedKnowledgePoints([]);
  };

  const handlePathSelect = (pathId: string | null) => {
    setSelectedPathId(pathId);
  };

  const handleConfigChange = (partialConfig: Partial<QuizSetConfig>) => {
    setConfig((prev) => ({ ...prev, ...partialConfig }));
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;

    try {
      const fullConfig: QuizSetConfig = {
        ...config,
        knowledgePointIds: selectedKnowledgePoints,
        customPrompt: customPrompt || undefined,
      };

      const quizSet = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        graph_id: selectedGraphId || undefined,
        config: fullConfig,
      });

      setCreatedQuizSetId(quizSet.id);

      const result = await generateMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        graph_id: selectedGraphId || undefined,
        config: fullConfig,
      });

      setTaskId(result.task_id);
      frontendEventBus.publish("message_show", { type: 'info', content: '测验生成任务已开始...' });
    } catch (error: unknown) {
      console.error('Failed to generate quiz:', error);
      const message = error instanceof Error ? error.message : "创建测验失败";
      frontendEventBus.publish("message_show", { type: 'error', content: message });
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
        className={`rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200 ${
          showPromptConfig ? 'max-w-5xl' : 'max-w-2xl'
        } ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}
      >
        <div
          className={`p-6 border-b ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-gradient-to-r from-primary-50 to-white'
          }`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {showPromptConfig ? (
                <button
                  onClick={() => setShowPromptConfig(false)}
                  className={`p-2 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-primary-900/50 text-primary-400 hover:bg-primary-900/70'
                      : 'bg-primary-100 text-primary-600 hover:bg-primary-200'
                  }`}
                >
                  <ArrowLeft size={20} />
                </button>
              ) : (
                <div
                  className={`p-2 rounded-xl ${
                    isDark ? 'bg-primary-900/50 text-primary-400' : 'bg-primary-100 text-primary-600'
                  }`}
                >
                  <BrainCircuit size={24} />
                </div>
              )}
              <div>
                <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {showPromptConfig ? 'Prompt 配置管理' : '创建测验'}
                </h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {showPromptConfig ? '管理测验生成的提示词模板' : 'AI 自动生成测验题目'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!showPromptConfig && (
                <button
                  onClick={() => setShowPromptConfig(true)}
                  className={`p-2 rounded-full transition-colors ${
                    isDark
                      ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                  title="Prompt 配置管理"
                >
                  <Settings size={18} />
                </button>
              )}
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
        </div>

        {showPromptConfig ? (
          <div className={`flex-1 overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <PromptConfigContent initialScenarioId="quiz_generation" />
          </div>
        ) : (
          <>
            <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${isDark ? 'bg-slate-900' : 'bg-gray-50'}`}>
              {selectedGraphId && learningPath && learningPath.stages && learningPath.stages.length > 0 && (
                <div
                  className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Route size={18} className={isDark ? 'text-primary-400' : 'text-primary-600'} />
                    <label
                      className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}
                    >
                      选择测验方向（学习路径）
                    </label>
                  </div>
                  <div className="space-y-2">
                    {learningPath.stages.map((stage: LearningPathStage, index: number) => {
                      const isSelected = selectedPathId === stage.id;
                      const stageKnowledgePoints = stage.nodes?.map((n: LearningPathStageNode) => n.knowledge_point_id).filter((id): id is string => Boolean(id)) || [];
                      
                      return (
                        <button
                          key={stage.id || index}
                          onClick={() => {
                            handlePathSelect(isSelected ? null : stage.id || null);
                            if (!isSelected) {
                              setSelectedKnowledgePoints(stageKnowledgePoints);
                            } else {
                              setSelectedKnowledgePoints([]);
                            }
                          }}
                          disabled={isGenerating}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? isDark
                                ? 'border-primary-500 bg-primary-900/30'
                                : 'border-primary-500 bg-primary-50'
                              : isDark
                                ? 'border-slate-700 hover:border-slate-600'
                                : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {stage.title || `阶段 ${index + 1}`}
                              </span>
                              <span className={`ml-2 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                {stageKnowledgePoints.length} 个知识点
                              </span>
                            </div>
                            {isSelected && (
                              <span className={`text-xs font-medium ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>
                                已选择
                              </span>
                            )}
                          </div>
                          {stage.description && (
                            <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                              {stage.description}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                className={`p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-white border border-gray-200'}`}
              >
                <KnowledgePointSelector
                  graphId={selectedGraphId || undefined}
                  selectedIds={selectedKnowledgePoints}
                  onChange={setSelectedKnowledgePoints}
                  onGraphChange={handleGraphChange}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}
                    >
                      测验标题 <span className="text-red-500">*</span>
                    </label>
                    {isGeneratingTitle && (
                      <span className={`flex items-center gap-1 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                        <Loader2 size={12} className="animate-spin" />
                        AI 生成中...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="例如：第一章基础概念测验"
                      disabled={isGenerating}
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm transition-colors ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-primary-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <PenLine
                      size={16}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                        isDark ? 'text-slate-500' : 'text-gray-400'
                      }`}
                    />
                  </div>
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
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-primary-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
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

              {aiStatus && !aiStatus.enabled && (
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
                    isDark ? 'bg-primary-900/30' : 'bg-primary-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Loader2 size={18} className="animate-spin text-primary-600" />
                      <span className={`font-medium ${isDark ? 'text-primary-300' : 'text-primary-700'}`}>
                        正在生成测验...
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>
                      {progressPercent}%
                    </span>
                  </div>

                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-primary-100'}`}>
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all duration-300"
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
                    已选择 <span className="font-bold text-primary-600">{selectedKnowledgePoints.length}</span> 个知识点，
                    预计生成 <span className="font-bold text-primary-600">{totalQuestions}</span> 道题目
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
                  disabled={!canGenerate || isGenerating || (aiStatus && !aiStatus.enabled)}
                  className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold transition-all ${
                    canGenerate && !isGenerating && aiStatus?.enabled
                      ? 'bg-gradient-to-r from-primary-600 to-violet-600 hover:from-primary-700 hover:to-violet-700 text-white shadow-lg shadow-primary-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98]'
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
          </>
        )}
      </div>
    </div>
  );
};
