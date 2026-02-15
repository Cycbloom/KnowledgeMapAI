import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Brain, 
  Clock, 
  Flame, 
  Target, 
  TrendingUp,
  AlertTriangle,
  Calendar,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';
import { useErrorHandler } from '../../hooks/useErrorHandler';

interface OverviewData {
  totalGraphs: number;
  totalNodes: number;
  totalCards: number;
  masteredNodes: number;
  learningNodes: number;
  newNodes: number;
  overallProgress: number;
  weeklyStudyTime: number;
  streakDays: number;
}

interface WeakPoint {
  nodeId: string;
  nodeTitle: string;
  graphTitle: string;
  mastery: number;
  reviewCount: number;
  nextReview: string | null;
  priority: 'high' | 'medium' | 'low';
  suggestion: string;
}

interface ActivityData {
  date: string;
  studyTime: number;
  reviews: number;
}

interface Prediction {
  date: string;
  reviewCount: number;
  newCards: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const KnowledgeHealthDashboard: React.FC = () => {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [weakPoints, setWeakPoints] = useState<WeakPoint[]>([]);
  const [activity, setActivity] = useState<ActivityData[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { handleError } = useErrorHandler();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [overviewRes, weakRes, activityRes, predRes] = await Promise.all([
        api.health.getOverview(),
        api.health.getWeakPoints(),
        api.health.getWeeklyActivity(),
        api.health.getPredictions()
      ]);
      
      setOverview(overviewRes);
      setWeakPoints(weakRes.weakPoints || []);
      setActivity(activityRes.activity || []);
      setPredictions(predRes.predictions || []);
    } catch (error) {
      handleError(error, { context: 'HealthDashboard' });
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      default: return 'text-gray-500 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="knowledge-health-dashboard space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg">
          <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">知识健康度</h1>
          <p className="text-sm text-gray-500">全面了解你的学习状态</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Brain className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview?.totalNodes || 0}</p>
              <p className="text-xs text-gray-500">知识点</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Target className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview?.masteredNodes || 0}</p>
              <p className="text-xs text-gray-500">已掌握</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.round((overview?.weeklyStudyTime || 0) / 60)}h</p>
              <p className="text-xs text-gray-500">本周学习</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overview?.streakDays || 0}</p>
              <p className="text-xs text-gray-500">连续天数</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          整体掌握度
        </h3>
        <div className="flex items-center gap-4">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(overview?.overallProgress || 0) * 3.52} 352`}
                className="text-green-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{overview?.overallProgress || 0}%</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">已掌握: {overview?.masteredNodes || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm">学习中: {overview?.learningNodes || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span className="text-sm">未学习: {overview?.newNodes || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            薄弱知识点
          </h3>
          {weakPoints.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>太棒了！没有明显的薄弱点</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weakPoints.slice(0, 5).map((point, index) => (
                <motion.div
                  key={point.nodeId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{point.nodeTitle}</p>
                    <p className="text-xs text-gray-500">{point.graphTitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(point.priority)}`}>
                      {point.mastery}%
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            未来 7 天预测
          </h3>
          <div className="space-y-2">
            {predictions.map((pred, index) => (
              <div
                key={pred.date}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getDifficultyColor(pred.difficulty)}`} />
                  <span className="text-sm">
                    {new Date(pred.date).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>复习: {pred.reviewCount}</span>
                  <span>新学: {pred.newCards}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-500" />
          本周学习活动
        </h3>
        <div className="flex items-end gap-2 h-32">
          {activity.map((day, index) => {
            const maxTime = Math.max(...activity.map(a => a.studyTime), 1);
            const height = (day.studyTime / maxTime) * 100;
            
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-t-lg relative" style={{ height: '100px' }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: index * 0.1 }}
                    className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t-lg"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(day.date).toLocaleDateString('zh-CN', { weekday: 'short' })}
                </p>
                <p className="text-xs text-gray-400">{day.studyTime}分</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeHealthDashboard;
