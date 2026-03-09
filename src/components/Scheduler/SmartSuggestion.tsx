import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  taskRecommendationApi,
  SmartSuggestions,
  PrioritySuggestion,
} from "../../services/api/taskRecommendation";
import { TaskRecommendation } from "./TaskRecommendation";
import { ScheduledTask } from "@shared/types";

interface SmartSuggestionProps {
  onSelectTask?: (task: ScheduledTask) => void;
  onStartTask?: (taskId: string) => void;
  onPrioritySuggestion?: (suggestion: PrioritySuggestion) => void;
  taskTitle?: string;
  taskDescription?: string;
}

export const SmartSuggestion: React.FC<SmartSuggestionProps> = ({
  onSelectTask,
  onStartTask,
  onPrioritySuggestion,
  taskTitle,
  taskDescription,
}) => {
  const [suggestions, setSuggestions] = useState<SmartSuggestions | null>(null);
  const [prioritySuggestion, setPrioritySuggestion] =
    useState<PrioritySuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"recommendations" | "tips">(
    "recommendations",
  );

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    if (taskTitle) {
      analyzeTaskPriority(taskTitle, taskDescription);
    }
  }, [taskTitle, taskDescription]);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const result = await taskRecommendationApi.getSmartSuggestions();
      setSuggestions(result.data);
    } catch (error) {
      console.error("Failed to load suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeTaskPriority = async (title: string, description?: string) => {
    try {
      const result = await taskRecommendationApi.analyzePriority(
        title,
        description,
      );
      setPrioritySuggestion(result.data);
      onPrioritySuggestion?.(result.data);
    } catch (error) {
      console.error("Failed to analyze priority:", error);
    }
  };

  const getCurrentTimeInfo = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return { period: "上午", icon: "🌅" };
    if (hour >= 12 && hour < 18) return { period: "下午", icon: "☀️" };
    if (hour >= 18 && hour < 22) return { period: "傍晚", icon: "🌆" };
    return { period: "夜间", icon: "🌙" };
  };

  const timeInfo = getCurrentTimeInfo();

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              智能建议
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {timeInfo.icon} {timeInfo.period}好 · 基于您的效率数据
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadSuggestions();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="刷新建议"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {prioritySuggestion && taskTitle && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-500/10 dark:to-pink-500/10 border border-purple-200 dark:border-purple-500/30"
                >
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-purple-500 dark:text-purple-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                        优先级建议
                      </h4>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          建议优先级:{" "}
                          <strong className="text-purple-600 dark:text-purple-400">
                            P{prioritySuggestion.suggestedPriority}
                          </strong>
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          队列:{" "}
                          <strong className="text-purple-600 dark:text-purple-400">
                            Q{prioritySuggestion.suggestedQueue}
                          </strong>
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          置信度:{" "}
                          {Math.round(prioritySuggestion.confidence * 100)}%
                        </span>
                      </div>
                      {prioritySuggestion.reasons.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {prioritySuggestion.reasons.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab("recommendations")}
                  className={`
                    flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                    ${
                      activeTab === "recommendations"
                        ? "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }
                  `}
                >
                  任务推荐
                </button>
                <button
                  onClick={() => setActiveTab("tips")}
                  className={`
                    flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                    ${
                      activeTab === "tips"
                        ? "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }
                  `}
                >
                  效率提示
                </button>
              </div>

              {activeTab === "recommendations" && (
                <>
                  {suggestions?.timeBasedSuggestions &&
                    suggestions.timeBasedSuggestions.length > 0 && (
                      <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-blue-500 dark:text-blue-400 mt-0.5" />
                          <div>
                            {suggestions.timeBasedSuggestions.map((tip, i) => (
                              <p
                                key={i}
                                className="text-sm text-blue-700 dark:text-blue-300"
                              >
                                {tip}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  <TaskRecommendation
                    recommendations={suggestions?.topTasks || []}
                    onSelectTask={onSelectTask}
                    onStartTask={onStartTask}
                    isLoading={isLoading}
                  />
                </>
              )}

              {activeTab === "tips" && (
                <div className="space-y-3">
                  {suggestions?.efficiencyTips &&
                  suggestions.efficiencyTips.length > 0 ? (
                    suggestions.efficiencyTips.map((tip, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          {tip}
                        </p>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-6">
                      <Lightbulb className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        完成更多任务后，我们将提供个性化的效率建议
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
