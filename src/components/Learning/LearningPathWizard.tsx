import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  BookOpen, 
  Settings2, 
  Sparkles, 
  Loader2, 
  ChevronRight, 
  Check,
  Wand2,
  AlertTriangle,
  Plus,
  FolderPlus
} from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';
import { useErrorHandler } from "../../hooks";

interface PrerequisiteQuestion {
  topic: string;
  description?: string;
  options: string[];
}

interface QuestionsData {
  graphTitle: string;
  suggestedGoals: string[];
  prerequisiteQuestions: PrerequisiteQuestion[];
}

interface LearningPathWizardProps {
  graphId: string;
  onComplete: (data: {
    targetGoal: string;
    currentKnowledge: Record<string, string>;
    learningStyle: 'sequential' | 'exploratory' | 'focused';
    dailyTimeMinutes: number;
  }) => void;
  onCancel: () => void;
}

const KNOWLEDGE_LEVELS = ['不了解', '了解一点', '比较熟悉', '非常熟悉'];
const LEARNING_STYLES = [
  { value: 'sequential', label: '顺序学习', description: '按顺序逐步学习' },
  { value: 'exploratory', label: '探索学习', description: '自由探索感兴趣的内容' },
  { value: 'focused', label: '专注学习', description: '专注于核心知识点' },
];

export const LearningPathWizard: React.FC<LearningPathWizardProps> = ({
  graphId,
  onComplete,
  onCancel
}) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingGraphs, setIsCreatingGraphs] = useState(false);
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null);
  
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [customGoal, setCustomGoal] = useState('');
  const [knowledgeAnswers, setKnowledgeAnswers] = useState<Record<string, string>>({});
  const [learningStyle, setLearningStyle] = useState<'sequential' | 'exploratory' | 'focused'>('sequential');
  const [dailyTime, setDailyTime] = useState(30);
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<Set<string>>(new Set());
  const [createdGraphs, setCreatedGraphs] = useState<Array<{ topic: string; graphId: string }>>([]);
  
  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphId]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const result = await api.learningPath.getQuestions({ graph_id: graphId });
      setQuestionsData(result);
      if (result.suggestedGoals.length > 0) {
        setSelectedGoal(result.suggestedGoals[0]);
      }
      const initialAnswers: Record<string, string> = {};
      result.prerequisiteQuestions.forEach((q: PrerequisiteQuestion) => {
        initialAnswers[q.topic] = q.options[0];
      });
      setKnowledgeAnswers(initialAnswers);
    } catch (error) {
      handleError(error, { context: 'Questions', fallbackMessage: '获取问题失败' });
    } finally {
      setIsLoading(false);
    }
  };

  const unknownPrerequisites = Object.entries(knowledgeAnswers)
    .filter(([_, level]) => level === '不了解')
    .map(([topic]) => topic);

  const handleNext = () => {
    if (step < 4) {
      if (step === 2 && unknownPrerequisites.length === 0) {
        setStep(4);
      } else {
        setStep(step + 1);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      if (step === 4 && unknownPrerequisites.length === 0) {
        setStep(2);
      } else {
        setStep(step - 1);
      }
    }
  };

  const togglePrerequisite = (topic: string) => {
    const newSelected = new Set(selectedPrerequisites);
    if (newSelected.has(topic)) {
      newSelected.delete(topic);
    } else {
      newSelected.add(topic);
    }
    setSelectedPrerequisites(newSelected);
  };

  const handleCreatePrerequisiteGraphs = async () => {
    if (selectedPrerequisites.size === 0) {
      addMessage({ type: 'warning', content: '请选择要创建图谱的前置知识' });
      return;
    }

    setIsCreatingGraphs(true);
    try {
      const topics = Array.from(selectedPrerequisites).map(topic => ({
        topic,
        mastery_level: '不了解'
      }));

      console.info('Creating prerequisite graphs:', { graphId, topics, selectedPrerequisites: Array.from(selectedPrerequisites) });

      const result = await api.graphs.createPrerequisiteGraphs(graphId, { 
        topics,
        depth: 2,
        style: 'academic'
      });
      
      console.info('Create prerequisite graphs result:', result);

      setCreatedGraphs(result.created);
      addMessage({ 
        type: 'success', 
        content: `已创建 ${result.created.length} 个前置知识图谱` 
      });
      
      setSelectedPrerequisites(new Set());
    } catch (error) {
      console.error('Create prerequisite graphs error:', error);
      handleError(error, { context: 'CreateGraphs', fallbackMessage: '创建前置图谱失败' });
    } finally {
      setIsCreatingGraphs(false);
    }
  };

  const handleComplete = async () => {
    const finalGoal = selectedGoal === 'custom' ? customGoal : selectedGoal;
    
    if (!finalGoal.trim()) {
      addMessage({ type: 'warning', content: '请选择或输入学习目标' });
      return;
    }

    setIsGenerating(true);
    addMessage({ type: 'info', content: '已收到请求，AI 正在为您规划学习路径，请稍候...' });
    try {
      onComplete({
        targetGoal: finalGoal,
        currentKnowledge: knowledgeAnswers,
        learningStyle,
        dailyTimeMinutes: dailyTime
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedGoal === 'custom' ? customGoal.trim().length > 0 : !!selectedGoal;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm text-gray-500">AI 正在分析图谱内容...</p>
      </div>
    );
  }

  const stepIndicator = unknownPrerequisites.length > 0 ? [1, 2, 3, 4] : [1, 2, 3];

  return (
    <div className="learning-path-wizard">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-indigo-500" />
          AI 学习路径规划
        </h3>
        <div className="flex items-center gap-2">
          {stepIndicator.map((s) => (
            <div
              key={s}
              className={`w-8 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Target className="w-4 h-4 text-indigo-500" />
              <span>第 1 步：选择学习目标</span>
            </div>
            
            <p className="text-sm text-gray-500">
              根据你的图谱「{questionsData?.graphTitle}」，推荐以下学习目标：
            </p>

            <div className="space-y-2">
              {questionsData?.suggestedGoals.map((goal, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedGoal(goal)}
                  className={`w-full p-3 rounded-lg text-left text-sm transition-all ${
                    selectedGoal === goal
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedGoal === goal
                        ? 'border-indigo-500 bg-indigo-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selectedGoal === goal && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span>{goal}</span>
                  </div>
                </button>
              ))}
              
              <button
                onClick={() => setSelectedGoal('custom')}
                className={`w-full p-3 rounded-lg text-left text-sm transition-all ${
                  selectedGoal === 'custom'
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                    : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedGoal === 'custom'
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedGoal === 'custom' && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-gray-600 dark:text-gray-300">其他目标</span>
                </div>
                {selectedGoal === 'custom' && (
                  <input
                    type="text"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="请输入你的学习目标..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white mt-2"
                    autoFocus
                  />
                )}
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>第 2 步：评估前置知识</span>
            </div>
            
            <p className="text-sm text-gray-500">
              请评估你对以下知识的掌握程度：
            </p>

            <div className="space-y-4">
              {questionsData?.prerequisiteQuestions.map((question, index) => {
                const isUnknown = knowledgeAnswers[question.topic] === '不了解';
                return (
                  <div key={index} className={`space-y-2 p-2 rounded-lg ${isUnknown ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{question.topic}</span>
                        {question.description && (
                          <span className="text-xs text-gray-500 ml-2">({question.description})</span>
                        )}
                      </div>
                      {isUnknown && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {KNOWLEDGE_LEVELS.map((level) => (
                        <button
                          key={level}
                          onClick={() => setKnowledgeAnswers(prev => ({ ...prev, [question.topic]: level }))}
                          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                            knowledgeAnswers[question.topic] === level
                              ? level === '不了解' 
                                ? 'bg-red-500 text-white' 
                                : 'bg-indigo-500 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 3 && unknownPrerequisites.length > 0 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <FolderPlus className="w-4 h-4 text-indigo-500" />
              <span>第 3 步：创建前置知识图谱</span>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                以下知识你标注为「不了解」，建议先学习。可以为这些知识创建独立的学习图谱：
              </p>
            </div>

            <div className="space-y-2">
              {unknownPrerequisites.map((topic) => (
                <button
                  key={topic}
                  onClick={() => togglePrerequisite(topic)}
                  className={`w-full p-3 rounded-lg text-left text-sm transition-all flex items-center gap-3 ${
                    selectedPrerequisites.has(topic)
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                      : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${
                    selectedPrerequisites.has(topic)
                      ? 'bg-indigo-500 text-white'
                      : 'border-2 border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedPrerequisites.has(topic) && <Check className="w-3 h-3" />}
                  </div>
                  <span className="flex-1">{topic}</span>
                  <span className="text-xs text-gray-400">点击选择</span>
                </button>
              ))}
            </div>

            {createdGraphs.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-2">
                  已创建的图谱：
                </p>
                <ul className="space-y-1">
                  {createdGraphs.map((g) => (
                    <li key={g.graphId} className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                      <Check className="w-3 h-3" />
                      {g.topic}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleCreatePrerequisiteGraphs}
              disabled={isCreatingGraphs || selectedPrerequisites.size === 0}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreatingGraphs ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  为选中的知识创建学习图谱
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Settings2 className="w-4 h-4 text-indigo-500" />
              <span>{unknownPrerequisites.length > 0 ? '第 4 步' : '第 3 步'}：学习偏好</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  每日学习时间
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={10}
                    value={dailyTime}
                    onChange={(e) => setDailyTime(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 w-16 text-right">
                    {dailyTime} 分钟
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  学习风格
                </label>
                <div className="space-y-2">
                  {LEARNING_STYLES.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setLearningStyle(style.value as any)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        learningStyle === style.value
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{style.label}</div>
                      <div className="text-xs text-gray-500">{style.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mt-6 pt-4 border-t dark:border-slate-700">
        <button
          onClick={step === 1 ? onCancel : handleBack}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {step === 1 ? '取消' : '上一步'}
        </button>
        
        {step < 4 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一步
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                生成学习路径
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default LearningPathWizard;
