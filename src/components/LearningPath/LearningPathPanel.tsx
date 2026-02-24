import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Route, 
  Clock, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  Circle, 
  AlertCircle,
  ChevronRight,
  Calendar,
  Zap,
  BookOpen,
  BarChart3,
  RefreshCw,
  Sparkles,
  Wand2
} from 'lucide-react';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/useMessageStore';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { LearningPathWizard } from './LearningPathWizard';

interface LearningPathStage {
  nodeId: string;
  nodeTitle: string;
  nodeContent: string;
  level: string;
  order: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimatedTime: number;
  prerequisites: string[];
  isCompleted: boolean;
  masteryLevel: number;
  nextReviewDate: string | null;
}

interface LearningPath {
  graphId: string;
  graphTitle: string;
  totalNodes: number;
  completedNodes: number;
  estimatedTotalTime: number;
  stages: LearningPathStage[];
  todayPlan: LearningPathStage[];
  predictions: {
    completionDate: string;
    weeklyProgress: number[];
    recommendedDailyTime: number;
  };
  suggestions: string[];
  aiGenerated?: boolean;
  targetGoal?: string;
}

interface LearningPathPanelProps {
  graphId: string;
  onNodeSelect?: (nodeId: string) => void;
}

export const LearningPathPanel: React.FC<LearningPathPanelProps> = ({
  graphId,
  onNodeSelect
}) => {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [_isGenerating, setIsGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<'sequential' | 'exploratory' | 'focused' | 'custom'>('sequential');
  const [dailyTime, setDailyTime] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  
  const { addMessage } = useMessageStore();
  const { handleError } = useErrorHandler();

  const fetchLearningPath = async () => {
    setIsLoading(true);
    try {
      const result = await api.learningPath.generate({
        graph_id: graphId,
        learning_style: selectedStyle,
        daily_time_minutes: dailyTime
      });
      setLearningPath(result);
    } catch (error) {
      handleError(error, { context: 'LearningPath', fallbackMessage: '获取学习路径失败' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWizardComplete = async (data: {
    targetGoal: string;
    currentKnowledge: Record<string, string>;
    learningStyle: 'sequential' | 'exploratory' | 'focused';
    dailyTimeMinutes: number;
  }) => {
    setIsGenerating(true);
    try {
      const knowledgeStr = Object.entries(data.currentKnowledge)
        .map(([k, v]) => `${k}: ${v}`)
        .join('；');
      
      const result = await api.learningPath.generate({
        graph_id: graphId,
        learning_style: data.learningStyle,
        daily_time_minutes: data.dailyTimeMinutes,
        target_goal: data.targetGoal,
        current_knowledge: knowledgeStr
      });
      setLearningPath(result);
      setShowWizard(false);
      addMessage({ type: 'success', content: 'AI 学习路径已生成！' });
    } catch (error) {
      handleError(error, { context: 'AIPath', fallbackMessage: 'AI 路径生成失败' });
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (graphId) {
      fetchLearningPath();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphId]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      default: return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '高优先';
      case 'medium': return '中优先';
      case 'low': return '低优先';
      default: return priority;
    }
  };

  const getMasteryColor = (level: number) => {
    if (level >= 0.8) return 'bg-green-500';
    if (level >= 0.6) return 'bg-blue-500';
    if (level >= 0.3) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (isLoading && !learningPath) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="learning-path-panel space-y-4">
      {showWizard ? (
        <LearningPathWizard
          graphId={graphId}
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                <Route className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  智能学习路径
                </h2>
                <p className="text-sm text-gray-500">{learningPath?.graphTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWizard(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600"
              >
                <Wand2 size={14} />
                AI 规划
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <BarChart3 size={20} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-4 overflow-hidden"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    学习风格
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'sequential', label: '顺序学习' },
                      { value: 'exploratory', label: '探索学习' },
                      { value: 'focused', label: '专注学习' },
                      { value: 'custom', label: '自定义' }
                    ].map(style => (
                      <button
                        key={style.value}
                        onClick={() => setSelectedStyle(style.value as any)}
                        className={`px-3 py-1.5 text-sm rounded-lg ${
                          selectedStyle === style.value
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-slate-600 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    每日学习时间: {dailyTime} 分钟
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={10}
                    value={dailyTime}
                    onChange={(e) => setDailyTime(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
                <button
                  onClick={() => fetchLearningPath()}
                  className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  重新生成路径
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {learningPath?.aiGenerated && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Sparkles size={14} className="text-purple-500" />
              <span className="text-xs text-purple-600 dark:text-purple-400">
                AI 生成 · 目标：{learningPath.targetGoal}
              </span>
            </div>
          )}

          {!learningPath ? (
            <div className="text-center py-8 text-gray-500">
              <Route className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>无法生成学习路径</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500">{learningPath.totalNodes}</div>
                  <div className="text-xs text-gray-500">总知识点</div>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-500">{learningPath.completedNodes}</div>
                  <div className="text-xs text-gray-500">已掌握</div>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-500">
                    {Math.round(learningPath.estimatedTotalTime / 60)}h
                  </div>
                  <div className="text-xs text-gray-500">预计时间</div>
                </div>
              </div>

              {learningPath.todayPlan.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    今日学习计划
                  </div>
                  <div className="space-y-2">
                    {learningPath.todayPlan.slice(0, 5).map((stage, index) => (
                      <motion.div
                        key={stage.nodeId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => onNodeSelect?.(stage.nodeId)}
                        className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getPriorityColor(stage.priority)}`}>
                          {stage.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {stage.nodeTitle}
                          </div>
                          <div className="text-xs text-gray-500">{stage.reason}</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          {stage.estimatedTime}分钟
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  学习预测
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">预计完成日期</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDate(learningPath.predictions.completionDate)}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 mb-2">本周进度预测</div>
                    <div className="flex gap-1">
                      {learningPath.predictions.weeklyProgress.map((progress, index) => (
                        <div key={index} className="flex-1">
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="text-xs text-center text-gray-400 mt-1">
                            {['一', '二', '三', '四', '五', '六', '日'][index]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">建议每日学习时间</span>
                    <span className="font-medium text-blue-500">
                      {learningPath.predictions.recommendedDailyTime} 分钟
                    </span>
                  </div>
                </div>
              </div>

              {learningPath.suggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    学习建议
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <ul className="space-y-2">
                      {learningPath.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                          <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {suggestion}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  完整学习路径
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {learningPath.stages.map((stage, index) => (
                    <div
                      key={stage.nodeId}
                      onClick={() => onNodeSelect?.(stage.nodeId)}
                      className="flex items-center gap-3 p-2 bg-white dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600"
                    >
                      <div className="text-xs text-gray-400 w-6">{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {stage.nodeTitle}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getMasteryColor(stage.masteryLevel)}`}
                            style={{ width: `${stage.masteryLevel * 100}%` }}
                          />
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(stage.priority)}`}>
                          {getPriorityLabel(stage.priority)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default LearningPathPanel;
