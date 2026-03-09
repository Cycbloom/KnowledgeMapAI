import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle,
  RefreshCw,
  Brain,
} from "lucide-react";
import { api } from '../../services/api';

interface SmartRecommendation {
  recommendedTask: {
    task: {
      id: string;
      title: string;
      description?: string;
      priority: number;
      queue_level: number;
      estimated_duration?: number;
      deadline?: string;
      tags?: string[];
    };
    score: number;
    reasons: string[];
    urgencyLevel: "low" | "medium" | "high" | "critical";
  } | null;
  alternativeTasks: Array<{
    task: {
      id: string;
      title: string;
      priority: number;
      queue_level: number;
    };
    score: number;
    reasons: string[];
  }>;
  reasons: string[];
  currentContext: {
    timeSlot: {
      label: string;
      type: "morning" | "afternoon" | "evening" | "night";
    };
    isPeakHour: boolean;
    efficiencyLevel: "high" | "medium" | "low";
  };
}

interface SmartRecommendationBarProps {
  onStartTask?: (taskId: string) => void;
  onViewTask?: (taskId: string) => void;
  currentTaskId?: string | null;
}

export const SmartRecommendationBar: React.FC<SmartRecommendationBarProps> = ({
  onStartTask,
  onViewTask,
  currentTaskId,
}) => {
  const [recommendation, setRecommendation] =
    useState<SmartRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const loadRecommendation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.scheduler.getSmartRecommendation();
      if (response.success) {
        setRecommendation(response.data);
      }
    } catch (error: any) {
      console.error("Failed to load recommendation:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendation();
  }, [loadRecommendation, currentTaskId]);

  const handleAcceptRecommendation = () => {
    if (recommendation?.recommendedTask && onStartTask) {
      onStartTask(recommendation.recommendedTask.task.id);
    }
  };

  const handleViewTask = () => {
    if (recommendation?.recommendedTask && onViewTask) {
      onViewTask(recommendation.recommendedTask.task.id);
    }
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-green-500";
    }
  };

  const getEfficiencyBadge = (level: string) => {
    switch (level) {
      case "high":
        return {
          label: "效率高峰",
          color: "text-green-500 bg-green-100 dark:bg-green-500/20",
        };
      case "low":
        return {
          label: "效率低谷",
          color: "text-yellow-500 bg-yellow-100 dark:bg-yellow-500/20",
        };
      default:
        return {
          label: "效率正常",
          color: "text-blue-500 bg-blue-100 dark:bg-blue-500/20",
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-500/10 dark:to-blue-500/10 rounded-xl p-4 border border-cyan-200 dark:border-cyan-500/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center animate-pulse">
            <Brain className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="flex-1">
            <div className="h-4 bg-cyan-200 dark:bg-cyan-500/30 rounded w-48 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!recommendation?.recommendedTask) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              暂无待处理任务，干得漂亮！🎉
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { recommendedTask, currentContext, reasons, alternativeTasks } =
    recommendation;
  const efficiencyBadge = getEfficiencyBadge(currentContext.efficiencyLevel);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 dark:from-cyan-500/10 dark:via-blue-500/10 dark:to-indigo-500/10 rounded-xl border border-cyan-200 dark:border-cyan-500/30 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/50 dark:bg-slate-900/50 border-b border-cyan-100 dark:border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              智能推荐
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentContext.timeSlot.label} · {efficiencyBadge.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRecommendation}
            className="p-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-colors"
            title="刷新推荐"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-colors"
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronRight className="w-4 h-4 rotate-90" />
            </motion.div>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Recommended Task */}
            <div className="p-4">
              <div className="flex items-start gap-4">
                <div
                  className={`w-2 h-full min-h-[80px] rounded-full ${getUrgencyColor(recommendedTask.urgencyLevel)}`}
                />

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white text-lg">
                        {recommendedTask.task.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Q{recommendedTask.task.queue_level}
                        </span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          优先级 {recommendedTask.task.priority}
                        </span>
                        {recommendedTask.task.estimated_duration && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="w-3 h-3" />
                            {recommendedTask.task.estimated_duration}分钟
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleViewTask}
                        className="px-3 py-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 rounded-lg transition-colors"
                      >
                        查看详情
                      </button>
                      <button
                        onClick={handleAcceptRecommendation}
                        className="px-4 py-1.5 text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/30"
                      >
                        开始任务
                      </button>
                    </div>
                  </div>

                  {/* Reasons */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {reasons.slice(0, 4).map((reason, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Alternative Tasks */}
              {alternativeTasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-cyan-100 dark:border-cyan-500/20">
                  <button
                    onClick={() => setShowAlternatives(!showAlternatives)}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${showAlternatives ? "rotate-90" : ""}`}
                    />
                    其他推荐 ({alternativeTasks.length})
                  </button>

                  <AnimatePresence>
                    {showAlternatives && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 space-y-2"
                      >
                        {alternativeTasks.map((alt, index) => (
                          <div
                            key={alt.task.id}
                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-slate-400">
                                #{index + 1}
                              </span>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {alt.task.title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {alt.reasons[0]}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => onStartTask?.(alt.task.id)}
                              className="px-3 py-1 text-sm text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-colors"
                            >
                              开始
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
