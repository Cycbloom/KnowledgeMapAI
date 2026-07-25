import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Calendar,
  Target,
  Lightbulb,
  X,
  CheckCircle,
  SkipForward,
  Edit3,
  Trash2,
  CalendarRange,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../services/api";
import { TaskProgressPlan } from "../../../types";
import { formatDate as formatDateUtil } from "../../../utils/formatters";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { EmptyState } from "../../common/EmptyState";

interface ProgressDetailProps {
  taskId: string;
  taskType?: string;
  progressPercentage?: number;
  className?: string;
}

interface ProgressAnalysis {
  status: "ahead" | "on_track" | "behind";
  currentProgress: number;
  plannedProgress: number;
  avgDailyProgress: number;
  daysRemaining: number;
  estimatedCompletionDate: string;
  suggestions: string[];
}

export const ProgressDetail: React.FC<ProgressDetailProps> = ({
  taskId,
  taskType,
  progressPercentage = 0,
  className = "",
}) => {
  const [plans, setPlans] = useState<TaskProgressPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<TaskProgressPlan | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<ProgressAnalysis | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    loadProgressPlans();
  }, [taskId]);

  const loadProgressPlans = async () => {
    setLoading(true);
    try {
      const plansData = await api.scheduler.getProgressPlan(taskId);
      setPlans(Array.isArray(plansData) ? plansData : []);
      analyzeProgress(Array.isArray(plansData) ? plansData : []);
    } catch (error) {
      console.error("Failed to load progress plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeProgress = (progressPlans: TaskProgressPlan[]) => {
    if (progressPlans.length === 0) {
      setAnalysis(null);
      return;
    }

    const completedPlans = progressPlans.filter(
      (p) => p.status === "completed",
    );
    const totalPlanned = progressPlans.reduce(
      (sum, p) => sum + p.planned_percentage,
      0,
    );
    const totalActual = completedPlans.reduce(
      (sum, p) => sum + p.actual_percentage,
      0,
    );
    const avgDaily =
      completedPlans.length > 0 ? totalActual / completedPlans.length : 0;

    const remainingProgress = 100 - progressPercentage;
    const daysRemaining =
      avgDaily > 0 ? Math.ceil(remainingProgress / avgDaily) : 0;

    const today = new Date();
    const estimatedDate = new Date(today);
    estimatedDate.setDate(estimatedDate.getDate() + daysRemaining);

    const plannedProgress = totalPlanned;
    const status =
      progressPercentage >= plannedProgress
        ? "ahead"
        : progressPercentage >= plannedProgress * 0.9
          ? "on_track"
          : "behind";

    const suggestions: string[] = [];
    if (status === "ahead") {
      suggestions.push("进度超前，可以适当降低每日目标");
      suggestions.push("考虑提前完成任务或增加任务内容");
    } else if (status === "on_track") {
      suggestions.push("保持当前节奏，按计划进行");
    } else {
      suggestions.push("进度滞后，建议增加每日投入时间");
      suggestions.push("检查是否有阻碍因素需要解决");
    }

    if (avgDaily > 0) {
      suggestions.push(`平均每日完成 ${avgDaily.toFixed(1)}%`);
    }

    setAnalysis({
      status,
      currentProgress: progressPercentage,
      plannedProgress,
      avgDailyProgress: avgDaily,
      daysRemaining,
      estimatedCompletionDate: formatDateUtil(estimatedDate, 'short'),
      suggestions,
    });
  };

  const handleUpdatePlan = async (
    planId: string,
    updates: Partial<TaskProgressPlan>,
  ) => {
    try {
      await api.scheduler.updateProgressPlan(taskId, {
        planId,
        ...updates,
      });
      setPlans(
        plans.map((p) => (p.id === planId ? { ...p, ...updates } : p)),
      );
      setSelectedPlan(null);
      loadProgressPlans();
    } catch (error) {
      console.error("Failed to update plan:", error);
    }
  };

  const formatDate = (dateStr: string): string => {
    return formatDateUtil(dateStr, 'short');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "skipped":
        return <SkipForward className="w-4 h-4 text-slate-400" />;
      default:
        return <Calendar className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusLabel = (
    plan: TaskProgressPlan,
  ): { text: string; color: string } => {
    if (plan.status === "skipped") {
      return { text: "已跳过", color: "text-slate-400" };
    }
    if (plan.status === "completed") {
      if (plan.actual_percentage > plan.planned_percentage) {
        return { text: "超额完成", color: "text-green-500" };
      }
      if (plan.actual_percentage >= plan.planned_percentage * 0.9) {
        return { text: "已完成", color: "text-green-500" };
      }
      return { text: "未达标", color: "text-yellow-500" };
    }
    return { text: "待处理", color: "text-slate-400" };
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
        <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 bg-slate-200 dark:bg-slate-700 rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  if (taskType !== "long_term") {
    return (
      <div className={`text-center py-8 ${className}`}>
        <Target className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
        <p className="text-slate-400 dark:text-slate-500">
          进度详情仅适用于长期任务
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-500" />
          进度详情
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {progressPercentage}% 完成
        </span>
      </div>

      {/* 总体进度条 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            总体进度
          </span>
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {progressPercentage}%
          </span>
        </div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary-500 to-primary-500"
          />
        </div>
        {analysis && (
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
            <span>剩余 {100 - progressPercentage}%</span>
            <span>预计 {analysis.daysRemaining} 天完成</span>
          </div>
        )}
      </div>

      {/* 进度趋势图 */}
      {plans.length > 0 && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            进度趋势
          </h4>
          <ProgressChart plans={plans} onPointClick={setSelectedPlan} />
        </div>
      )}

      {/* 智能分析 */}
      {analysis && (
        <div className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-500/10 dark:to-primary-500/10 rounded-xl border border-primary-200 dark:border-primary-500/30">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-primary-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                进度分析
              </h4>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    analysis.status === "ahead"
                      ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
                      : analysis.status === "on_track"
                        ? "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400"
                  }`}
                >
                  {analysis.status === "ahead"
                    ? "超前"
                    : analysis.status === "on_track"
                      ? "正常"
                      : "滞后"}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  当前 {analysis.currentProgress}% / 计划{" "}
                  {analysis.plannedProgress}%
                </span>
              </div>
              <ul className="space-y-1">
                {analysis.suggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1"
                  >
                    <span className="text-primary-500 mt-1">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 每日进度计划表格 */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          每日进度计划
        </h4>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-500 overflow-hidden">
          <table
            className="w-full"
            aria-label={t("scheduler.progressDetail.tableAriaLabel", { defaultValue: "每日进度计划表" })}
          >
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">
                  日期
                </th>
                <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  计划
                </th>
                <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  实际
                </th>
                <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  状态
                </th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-500 dark:text-slate-400">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const status = getStatusLabel(plan);
                return (
                  <tr
                    key={plan.id}
                    className="border-t border-slate-100 dark:border-slate-500/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(plan.status)}
                        <span className="text-sm text-slate-900 dark:text-white">
                          {formatDate(plan.plan_date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {plan.planned_percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-sm font-medium ${
                          plan.actual_percentage >= plan.planned_percentage
                            ? "text-green-500"
                            : plan.actual_percentage > 0
                              ? "text-yellow-500"
                              : "text-slate-400"
                        }`}
                      >
                        {plan.actual_percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs ${status.color}`}>
                        {status.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan);
                        }}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                      >
                        <Edit3 className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {plans.length === 0 && (
            <EmptyState icon={<CalendarRange size={32} />} title={t('scheduler.empty.progressPlans')} />
          )}
        </div>
      </div>

      {/* 侧边滑出编辑面板 */}
      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
            onClick={() => setSelectedPlan(null)}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-500 p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  编辑进度 - {formatDate(selectedPlan.plan_date)}
                </h3>
                <button
                  onClick={() => setSelectedPlan(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    计划进度
                  </label>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedPlan.planned_percentage}%
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    实际进度
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={selectedPlan.actual_percentage}
                    id="actual-progress-input"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    状态
                  </label>
                  <div className="space-y-2">
                    {[
                      { value: "pending", label: "待处理", icon: Calendar },
                      {
                        value: "completed",
                        label: "已完成",
                        icon: CheckCircle,
                      },
                      { value: "skipped", label: "跳过", icon: SkipForward },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPlan.status === option.value
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-500/10"
                            : "border-slate-200 dark:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <input
                          type="radio"
                          name="status"
                          value={option.value}
                          defaultChecked={selectedPlan.status === option.value}
                          className="sr-only"
                        />
                        <option.icon
                          className={`w-4 h-4 ${
                            selectedPlan.status === option.value
                              ? "text-primary-500"
                              : "text-slate-400"
                          }`}
                        />
                        <span
                          className={`text-sm ${
                            selectedPlan.status === option.value
                              ? "text-primary-600 dark:text-primary-400 font-medium"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    备注
                  </label>
                  <textarea
                    id="notes-input"
                    defaultValue={selectedPlan.notes || ""}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-500 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    placeholder="添加备注..."
                  />
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-500 p-4 flex justify-between">
                <button
                  onClick={async () => {
                    if (await asyncConfirm({ title: t('common.confirm.deleteProgressTitle'), message: t('common.confirm.deleteProgressMessage'), isDangerous: true })) {
                      handleUpdatePlan(selectedPlan.id, { status: "skipped" });
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPlan(null)}
                    className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      const actualProgress = parseInt(
                        (
                          document.getElementById(
                            "actual-progress-input",
                          ) as HTMLInputElement
                        )?.value || "0",
                      );
                      const status = (
                        document.querySelector(
                          'input[name="status"]:checked',
                        ) as HTMLInputElement
                      )?.value as "pending" | "completed" | "skipped";
                      const notes = (
                        document.getElementById(
                          "notes-input",
                        ) as HTMLTextAreaElement
                      )?.value;
                      handleUpdatePlan(selectedPlan.id, {
                        actual_percentage: actualProgress,
                        status: status || selectedPlan.status,
                        notes,
                      });
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 transition-all"
                  >
                    保存
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProgressChart: React.FC<{
  plans: TaskProgressPlan[];
  onPointClick: (plan: TaskProgressPlan) => void;
}> = ({ plans, onPointClick }) => {
  const sortedPlans = [...plans].sort(
    (a, b) => new Date(a.plan_date).getTime() - new Date(b.plan_date).getTime(),
  );

  const dataPoints = sortedPlans.reduce<
    Array<{
      date: string;
      planned: number;
      actual: number;
      plan: TaskProgressPlan;
    }>
  >((acc, plan, index) => {
    const prevPlanned = index > 0 ? acc[index - 1].planned : 0;
    const prevActual = index > 0 ? acc[index - 1].actual : 0;
    acc.push({
      date: plan.plan_date,
      planned: prevPlanned + plan.planned_percentage,
      actual: prevActual + plan.actual_percentage,
      plan,
    });
    return acc;
  }, []);

  const maxValue = Math.max(
    100,
    ...dataPoints.map((d) => Math.max(d.planned, d.actual)),
  );

  const getX = (index: number) => {
    if (dataPoints.length === 1) return 50;
    return (index / (dataPoints.length - 1)) * 100;
  };

  const getY = (value: number) => {
    return 100 - (value / maxValue) * 100;
  };

  const plannedPath = dataPoints
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.planned)}`)
    .join(" ");

  const actualPath = dataPoints
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.actual)}`)
    .join(" ");

  return (
    <div className="relative h-40">
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34, 211, 238)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line
          x1="0"
          y1="100"
          x2="100"
          y2="100"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth="0.5"
        />
        <line
          x1="0"
          y1="75"
          x2="100"
          y2="75"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth="0.3"
          strokeDasharray="2,2"
        />
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth="0.3"
          strokeDasharray="2,2"
        />
        <line
          x1="0"
          y1="25"
          x2="100"
          y2="25"
          stroke="currentColor"
          className="text-slate-200 dark:text-slate-700"
          strokeWidth="0.3"
          strokeDasharray="2,2"
        />

        <path
          d={plannedPath}
          fill="none"
          stroke="rgb(34, 211, 238)"
          strokeWidth="1.5"
          strokeDasharray="4,2"
        />

        <path
          d={actualPath}
          fill="none"
          stroke="rgb(59, 130, 246)"
          strokeWidth="2"
        />

        {dataPoints.map((d, i) => (
          <g
            key={d.date}
            onClick={() => onPointClick(d.plan)}
            className="cursor-pointer"
          >
            <circle
              cx={getX(i)}
              cy={getY(d.planned)}
              r="2"
              fill="rgb(34, 211, 238)"
              className="hover:r-3 transition-all"
            />
            <circle
              cx={getX(i)}
              cy={getY(d.actual)}
              r="2.5"
              fill="rgb(59, 130, 246)"
              className="hover:r-4 transition-all"
            />
          </g>
        ))}
      </svg>

      <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
        {dataPoints.slice(0, 5).map((d) => (
          <span key={d.date}>
            {formatDateUtil(d.date, 'short')}
          </span>
        ))}
      </div>

      <div className="absolute top-0 right-0 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div
            className="w-3 h-0.5 bg-primary-400"
            style={{ borderTop: "2px dashed rgb(34, 211, 238)" }}
          />
          <span className="text-slate-500 dark:text-slate-400">计划</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-primary-500" />
          <span className="text-slate-500 dark:text-slate-400">实际</span>
        </div>
      </div>
    </div>
  );
};
