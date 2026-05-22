import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle,
  RefreshCw,
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../services/api";

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

interface EfficiencyProfile {
  hourlyEfficiency: Record<number, number>;
  tagEfficiency: Record<
    string,
    { avgDuration: number; completionRate: number }
  >;
  queueEfficiency: Record<
    number,
    { avgDuration: number; completionRate: number }
  >;
  peakHours: number[];
  lowHours: number[];
}

interface RecommendationDetail {
  type: "efficiency" | "mastery" | "dependency" | "deadline" | "priority";
  icon: React.ReactNode;
  title: string;
  description: string;
  score?: number;
}

interface SmartRecommendationBarProps {
  onStartTask?: (taskId: string) => void;
  onViewTask?: (taskId: string) => void;
  currentTaskId?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SmartRecommendationBar: React.FC<SmartRecommendationBarProps> = ({
  onStartTask,
  onViewTask,
  currentTaskId,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { t } = useTranslation();
  const [recommendation, setRecommendation] =
    useState<SmartRecommendation | null>(null);
  const [efficiencyProfile, setEfficiencyProfile] =
    useState<EfficiencyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const isExpanded =
    isCollapsed !== undefined ? !isCollapsed : internalExpanded;

  const handleToggleExpand = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  }, [onToggleCollapse, internalExpanded]);

  const loadRecommendation = useCallback(async () => {
    setLoading(true);
    try {
      const [recommendationRes, efficiencyRes] = await Promise.all([
        api.scheduler.getSmartRecommendation(),
        api.scheduler.getEfficiencyProfile(30),
      ]);

      if (recommendationRes.success) {
        setRecommendation(recommendationRes.data);
      }

      if (efficiencyRes.success) {
        setEfficiencyProfile(efficiencyRes.data);
      }
    } catch (error: unknown) {
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
          label: t("scheduler.recommendation.peakEfficiency"),
          color: "text-green-500 bg-green-100 dark:bg-green-500/20",
        };
      case "low":
        return {
          label: t("scheduler.recommendation.lowEfficiency"),
          color: "text-yellow-500 bg-yellow-100 dark:bg-yellow-500/20",
        };
      default:
        return {
          label: t("scheduler.recommendation.normalEfficiency"),
          color: "text-primary-500 bg-primary-100 dark:bg-primary-500/20",
        };
    }
  };

  const getRecommendationDetails = (): RecommendationDetail[] => {
    if (!recommendation?.recommendedTask || !efficiencyProfile) return [];

    const details: RecommendationDetail[] = [];
    const task = recommendation.recommendedTask.task;

    if (recommendation.currentContext.isPeakHour) {
      details.push({
        type: "efficiency",
        icon: <TrendingUp className="w-4 h-4" />,
        title: "效率高峰期",
        description: "当前是您的效率高峰时段，适合处理重要任务",
        score: efficiencyProfile.hourlyEfficiency[new Date().getHours()] || 0,
      });
    }

    if (task.tags && task.tags.length > 0) {
      const tagEfficiencies = task.tags
        .map((tag) => ({
          tag,
          rate: efficiencyProfile.tagEfficiency[tag]?.completionRate || 0,
        }))
        .filter((t) => t.rate > 0);

      if (tagEfficiencies.length > 0) {
        const avgRate =
          tagEfficiencies.reduce((sum, t) => sum + t.rate, 0) /
          tagEfficiencies.length;
        details.push({
          type: "mastery",
          icon: <Target className="w-4 h-4" />,
          title: "掌握度分析",
          description: `您在此类任务上完成率 ${Math.round(avgRate * 100)}%`,
          score: avgRate,
        });
      }
    }

    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const hoursUntil = Math.round(
        (deadline.getTime() - Date.now()) / (1000 * 60 * 60),
      );
      details.push({
        type: "deadline",
        icon: <AlertCircle className="w-4 h-4" />,
        title: "截止时间",
        description:
          hoursUntil < 0
            ? "已超过截止日期"
            : hoursUntil < 24
              ? `截止时间临近 (${hoursUntil}小时)`
              : `截止时间: ${deadline.toLocaleDateString("zh-CN")}`,
      });
    }

    if (task.priority >= 3) {
      details.push({
        type: "priority",
        icon: <Zap className="w-4 h-4" />,
        title: "高优先级",
        description: `优先级 ${task.priority}，位于 Q${task.queue_level} 队列`,
      });
    }

    return details;
  };

  const getBestTimeSlots = (): Array<{
    time: string;
    efficiency: number;
    label: string;
  }> => {
    if (!efficiencyProfile) return [];

    const currentHour = new Date().getHours();
    const slots: Array<{ time: string; efficiency: number; label: string }> =
      [];

    for (let i = currentHour; i < Math.min(currentHour + 8, 24); i++) {
      const efficiency = efficiencyProfile.hourlyEfficiency[i] || 0;
      const isPeak = efficiencyProfile.peakHours.includes(i);
      const isLow = efficiencyProfile.lowHours.includes(i);

      let label = "";
      if (isPeak) {
        label = "高峰时段";
      } else if (isLow) {
        label = "低效时段";
      } else if (efficiency > 0.7) {
        label = "高效时段";
      } else {
        label = "正常时段";
      }

      slots.push({
        time: `${i}:00`,
        efficiency,
        label,
      });
    }

    return slots.slice(0, 4);
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-500/10 dark:to-primary-500/10 rounded-xl p-4 border border-primary-200 dark:border-primary-500/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center animate-pulse">
            <Brain className="w-4 h-4 text-primary-500" />
          </div>
          <div className="flex-1">
            <div className="h-4 bg-primary-200 dark:bg-primary-500/30 rounded w-48 animate-pulse" />
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
              {t("scheduler.recommendation.noPendingTasks")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { recommendedTask, currentContext, reasons, alternativeTasks } =
    recommendation;
  const efficiencyBadge = getEfficiencyBadge(currentContext.efficiencyLevel);
  const recommendationDetails = getRecommendationDetails();
  const bestTimeSlots = getBestTimeSlots();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-primary-50 via-primary-50 to-primary-50 dark:from-primary-500/10 dark:via-primary-500/10 dark:to-primary-500/10 rounded-xl border border-primary-200 dark:border-primary-500/30 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-white/50 dark:bg-slate-900/50 border-b border-primary-100 dark:border-primary-500/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary-500 to-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {t("scheduler.recommendation.title")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {!isExpanded && recommendedTask
                ? recommendedTask.task.title
                : `${currentContext.timeSlot.label} · ${efficiencyBadge.label}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`px-2 py-1 rounded-full text-xs font-medium ${efficiencyBadge.color}`}
          >
            {currentContext.isPeakHour ? (
              <TrendingUp className="w-3 h-3 inline mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 inline mr-1" />
            )}
            {efficiencyBadge.label}
          </div>
          <button
            onClick={loadRecommendation}
            className="p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 transition-colors"
            title="刷新推荐"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleToggleExpand}
            className="p-2 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 transition-colors"
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
              <ChevronRight className="w-4 h-4 rotate-90" />
            </motion.div>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
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
                          {t("scheduler.recommendation.priority", {
                            level: recommendedTask.task.priority,
                          })}
                        </span>
                        {recommendedTask.task.estimated_duration && (
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Clock className="w-3 h-3" />
                            {t("scheduler.recommendation.minutes", {
                              count: recommendedTask.task.estimated_duration,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleViewTask}
                        className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 rounded-lg transition-colors"
                      >
                        {t("scheduler.recommendation.viewDetails")}
                      </button>
                      <button
                        onClick={handleAcceptRecommendation}
                        className="px-4 py-1.5 text-sm bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 transition-all shadow-lg shadow-primary-500/30"
                      >
                        {t("scheduler.recommendation.startTask")}
                      </button>
                    </div>
                  </div>

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

                  {recommendationDetails.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-primary-100 dark:border-primary-500/20">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors mb-3"
                      >
                        <Lightbulb className="w-4 h-4" />
                        {t("scheduler.recommendation.recommendationDetails")}
                        <ChevronRight
                          className={`w-4 h-4 transition-transform ${showDetails ? "rotate-90" : ""}`}
                        />
                      </button>

                      <AnimatePresence>
                        {showDetails && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-2"
                          >
                            {recommendationDetails.map((detail, index) => (
                              <div
                                key={index}
                                className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                              >
                                <div className="text-primary-500 mt-0.5">
                                  {detail.icon}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <h5 className="font-medium text-sm text-slate-900 dark:text-white">
                                      {detail.title}
                                    </h5>
                                    {detail.score !== undefined && (
                                      <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                                        {Math.round(detail.score * 100)}%
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {detail.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {bestTimeSlots.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-primary-100 dark:border-primary-500/20">
                      <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        最佳执行时段建议
                      </h5>
                      <div className="grid grid-cols-4 gap-2">
                        {bestTimeSlots.map((slot, index) => (
                          <div
                            key={index}
                            className={`p-2 rounded-lg text-center ${
                              slot.label === "高峰时段"
                                ? "bg-green-100 dark:bg-green-500/20 border border-green-300 dark:border-green-500/30"
                                : slot.label === "低效时段"
                                  ? "bg-yellow-100 dark:bg-yellow-500/20 border border-yellow-300 dark:border-yellow-500/30"
                                  : slot.efficiency > 0.7
                                    ? "bg-primary-100 dark:bg-primary-500/20 border border-primary-300 dark:border-primary-500/30"
                                    : "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <div className="text-xs font-medium text-slate-900 dark:text-white">
                              {slot.time}
                            </div>
                            <div
                              className={`text-xs mt-1 ${
                                slot.label === "高峰时段"
                                  ? "text-green-600 dark:text-green-400"
                                  : slot.label === "低效时段"
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {slot.label}
                            </div>
                            {slot.efficiency > 0 && (
                              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                {Math.round(slot.efficiency * 100)}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alternative Tasks */}
              {alternativeTasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-primary-100 dark:border-primary-500/20">
                  <button
                    onClick={() => setShowAlternatives(!showAlternatives)}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
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
                              className="px-3 py-1 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors"
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
