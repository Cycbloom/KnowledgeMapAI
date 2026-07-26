import React, { useState, useEffect, useCallback, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
  DecisionTaskRecommendation,
  type TaskRecommendation as TaskRecommendationType,
} from "../../services/api/taskRecommendation";
import { TaskRecommendation as TaskRecommendationComponent } from "./TaskRecommendation";
import { UserTask } from "@shared/types";

interface SmartSuggestionProps {
  onSelectTask?: (task: UserTask) => void;
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
  const [decisionRecommendations, setDecisionRecommendations] = useState<
    DecisionTaskRecommendation[]
  >([]);
  const [prioritySuggestion, setPrioritySuggestion] =
    useState<PrioritySuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"recommendations" | "tips">(
    "recommendations",
  );

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs: { id: "recommendations" | "tips"; label: string }[] = [
    { id: "recommendations", label: "任务推荐" },
    { id: "tips", label: "效率提示" },
  ];

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveTab(tabs[0].id);
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = tabs.length - 1;
        setActiveTab(tabs[lastIndex].id);
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    if (taskTitle) {
      analyzeTaskPriority(taskTitle, taskDescription);
    }
  }, [taskTitle, taskDescription]);

  const convertToTaskRecommendations = useCallback(
    (
      decisions: DecisionTaskRecommendation[],
    ): TaskRecommendationType[] => {
      return decisions.map((d) => {
        const urgencyLevel: TaskRecommendationType["urgencyLevel"] =
          d.totalScore >= 80
            ? "critical"
            : d.totalScore >= 60
              ? "high"
              : d.totalScore >= 40
                ? "medium"
                : "low";

        const task: UserTask = {
          id: d.taskId,
          title: d.title,
          queue_level: d.queueLevel,
          priority: d.priority,
          position: 0,
          status: "pending",
          tags: [],
          user_id: "",
          created_at: "",
          updated_at: "",
        };

        return {
          task,
          score: d.totalScore,
          reasons: [d.reason],
          urgencyLevel,
        };
      });
    },
    [],
  );

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const [smartResult, decisionResult] = await Promise.all([
        taskRecommendationApi.getSmartSuggestions().catch(() => ({
          data: { topTasks: [], timeBasedSuggestions: [], efficiencyTips: [] },
        })),
        taskRecommendationApi.getDecisionRecommendations().catch(() => ({
          data: [],
        })),
      ]);
      setSuggestions(smartResult.data);
      setDecisionRecommendations(decisionResult.data);
    } catch (error) {
      console.warn("Failed to load suggestions:", error);
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
      console.warn("Failed to analyze priority:", error);
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
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-500 overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary-500 to-pink-500 text-white">
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
                  className="mb-4 p-3 rounded-lg bg-gradient-to-r from-primary-50 to-pink-50 dark:from-primary-500/10 dark:to-pink-500/10 border border-primary-200 dark:border-primary-500/30"
                >
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">
                        优先级建议
                      </h4>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          建议优先级:{" "}
                          <strong className="text-primary-600 dark:text-primary-400">
                            P{prioritySuggestion.suggestedPriority}
                          </strong>
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          队列:{" "}
                          <strong className="text-primary-600 dark:text-primary-400">
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

              <div className="flex gap-2 mb-4" role="tablist" aria-label="智能建议">
                {tabs.map((tab, index) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => { tabRefs.current[index] = el; }}
                      role="tab"
                      id={`${tabIdPrefix}-${tab.id}`}
                      aria-selected={isActive}
                      aria-controls={`${panelIdPrefix}-${tab.id}`}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => setActiveTab(tab.id)}
                      onKeyDown={(e) => handleTabKeyDown(e, index)}
                      className={`
                        flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                        ${
                          isActive
                            ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        }
                      `}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "recommendations" && (
                <div
                  role="tabpanel"
                  id={`${panelIdPrefix}-recommendations`}
                  aria-labelledby={`${tabIdPrefix}-recommendations`}
                  tabIndex={0}
                >
                  {suggestions?.timeBasedSuggestions &&
                    suggestions.timeBasedSuggestions.length > 0 && (
                      <div className="mb-4 p-3 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30">
                        <div className="flex items-start gap-2">
                          <Clock className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5" />
                          <div>
                            {suggestions.timeBasedSuggestions.map((tip, i) => (
                              <p
                                key={i}
                                className="text-sm text-primary-700 dark:text-primary-300"
                              >
                                {tip}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  <TaskRecommendationComponent
                    recommendations={
                      decisionRecommendations.length > 0
                        ? convertToTaskRecommendations(decisionRecommendations)
                        : suggestions?.topTasks ?? []
                    }
                    onSelectTask={onSelectTask}
                    onStartTask={onStartTask}
                    isLoading={isLoading}
                  />
                </div>
              )}

              {activeTab === "tips" && (
                <div
                  role="tabpanel"
                  id={`${panelIdPrefix}-tips`}
                  aria-labelledby={`${tabIdPrefix}-tips`}
                  tabIndex={0}
                  className="space-y-3"
                >
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
