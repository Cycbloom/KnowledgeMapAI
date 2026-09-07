import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Target, Plus, Trash2, X } from "lucide-react";
import { api } from "../../services/api";
import { useTheme } from "../../hooks";
import { Skeleton } from "../common";
import type { GoalMetric, GoalPeriodType, LearningGoal } from "@shared/types";

const METRICS: GoalMetric[] = [
  "focus_minutes",
  "tasks_completed",
  "cards_reviewed",
  "new_knowledge_points",
];

const PERIODS: GoalPeriodType[] = ["week", "month"];

const progressColor = (percent: number): string => {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 60) return "bg-sky-500";
  return "bg-amber-500";
};

const GoalRow = ({
  goal,
  isDark,
  onDelete,
}: {
  goal: LearningGoal;
  isDark: boolean;
  onDelete: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const unit = t(`dashboard.goals.metricUnit.${goal.metric}` as never);
  return (
    <div className={`p-3 rounded-xl border ${isDark ? "border-slate-700 bg-slate-700/40" : "border-gray-100 bg-gray-50"}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-gray-800"}`}>
          {t(`dashboard.goals.metrics.${goal.metric}` as never)}
        </span>
        <div className="flex items-center gap-2">
          {goal.progress_percent >= 100 && (
            <span className="text-[11px] font-medium text-green-500">
              {t("dashboard.goals.achieved")}
            </span>
          )}
          <button
            onClick={() => onDelete(goal.id)}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-600 ${isDark ? "text-slate-400" : "text-gray-400"}`}
            aria-label={t("dashboard.goals.deleteHint")}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className={isDark ? "text-slate-400" : "text-gray-500"}>
          {t("dashboard.goals.current")}: {goal.current_value} {unit}
        </span>
        <span className={isDark ? "text-slate-400" : "text-gray-500"}>
          {t("dashboard.goals.target")}: {goal.target_value} {unit}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-slate-600">
        <div
          className={`h-full rounded-full ${progressColor(goal.progress_percent)}`}
          style={{ width: `${Math.min(100, goal.progress_percent)}%` }}
        />
      </div>
    </div>
  );
};

export const GoalsTracker: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [period, setPeriod] = useState<GoalPeriodType>("week");
  const [metric, setMetric] = useState<GoalMetric>("focus_minutes");
  const [target, setTarget] = useState<number>(120);

  const { data, isLoading } = useQuery<LearningGoal[]>({
    queryKey: ["learning-goals"],
    queryFn: () => api.scheduler.listGoals(),
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["learning-goals"] });
  };

  const saveGoal = useMutation({
    mutationFn: (input: { period_type: GoalPeriodType; metric: GoalMetric; target_value: number }) =>
      api.scheduler.upsertGoal(input),
    onSuccess: () => {
      invalidate();
      setAdding(false);
    },
  });

  const removeGoal = useMutation({
    mutationFn: (id: string) => api.scheduler.deleteGoal(id),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-32 rounded-lg" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  const goals = data ?? [];
  const weekGoals = goals.filter((g) => g.period_type === "week");
  const monthGoals = goals.filter((g) => g.period_type === "month");

  return (
    <div className={`p-4 md:p-5 rounded-xl shadow-sm border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={`text-base md:text-lg font-bold flex items-center gap-2 ${isDark ? "text-white" : "text-gray-800"}`}>
          <Target size={18} className="text-primary-500" />
          {t("dashboard.goals.title")}
        </h3>
        <button
          onClick={() => setAdding((v) => !v)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            adding
              ? "bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          {adding ? <X size={13} /> : <Plus size={13} />}
          {adding ? "" : t("dashboard.goals.addGoal")}
        </button>
      </div>
      <p className={`text-xs mt-0.5 mb-3 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
        {t("dashboard.goals.subtitle")}
      </p>

      {adding && (
        <div className={`mb-4 p-3 rounded-xl border ${isDark ? "border-slate-600 bg-slate-700/40" : "border-gray-200 bg-gray-50"}`}>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as GoalPeriodType)}
              className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-gray-200 text-gray-800"}`}
              aria-label={t("dashboard.goals.periodLabel")}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`dashboard.goals.${p}`)}
                </option>
              ))}
            </select>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as GoalMetric)}
              className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-gray-200 text-gray-800"}`}
              aria-label={t("dashboard.goals.metricLabel")}
            >
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {t(`dashboard.goals.metrics.${m}` as never)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-gray-200 text-gray-800"}`}
              aria-label={t("dashboard.goals.targetLabel")}
            />
          </div>
          <button
            onClick={() => saveGoal.mutate({ period_type: period, metric, target_value: target })}
            disabled={target <= 0 || saveGoal.isPending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {t("dashboard.goals.save")}
          </button>
        </div>
      )}

      {goals.length === 0 && !adding ? (
        <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>
          {t("dashboard.goals.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {weekGoals.length > 0 && (
            <div>
              <p className={`text-[11px] font-medium mb-1.5 uppercase tracking-wide ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                {t("dashboard.goals.week")}
              </p>
              <div className="space-y-2">
                {weekGoals.map((g) => (
                  <GoalRow key={g.id} goal={g} isDark={isDark} onDelete={(id) => removeGoal.mutate(id)} />
                ))}
              </div>
            </div>
          )}
          {monthGoals.length > 0 && (
            <div>
              <p className={`text-[11px] font-medium mb-1.5 uppercase tracking-wide ${isDark ? "text-slate-500" : "text-gray-400"}`}>
                {t("dashboard.goals.month")}
              </p>
              <div className="space-y-2">
                {monthGoals.map((g) => (
                  <GoalRow key={g.id} goal={g} isDark={isDark} onDelete={(id) => removeGoal.mutate(id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
