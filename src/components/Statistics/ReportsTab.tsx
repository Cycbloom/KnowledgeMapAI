import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  BookOpen,
  AlarmClock,
  AlertTriangle,
  Plus,
  FileText,
  ChevronLeft,
  ChevronRight,
  Target,
  LucideIcon,
} from "lucide-react";
import { api } from "../../services/api";
import { useTheme } from "../../hooks";
import { Skeleton, ErrorState } from "../common";
import type { DailyReport, WeeklyReport } from "@shared/types/api";

const toLocalDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, n: number): Date => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
};

const mondayOf = (d: Date): Date => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
};

const formatDayLabel = (dateStr: string): string => dateStr.slice(5);

interface StatCardProps {
  title: string;
  hint?: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  isDark: boolean;
}

const StatCard = ({ title, hint, value, icon: Icon, color, isDark }: StatCardProps) => (
  <div
    className={`p-3 md:p-4 rounded-xl shadow-sm border flex items-start justify-between ${
      isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"
    }`}
  >
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-medium mb-1 truncate ${isDark ? "text-slate-400" : "text-gray-500"}`}>
        {title}
      </p>
      <h3 className={`text-xl md:text-2xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
        {value}
      </h3>
      {hint && (
        <p className={`text-xs mt-1 truncate ${isDark ? "text-slate-500" : "text-gray-400"}`}>
          {hint}
        </p>
      )}
    </div>
    <div className={`p-2 rounded-full ${color} flex-shrink-0 ml-2`}>
      <Icon size={20} className="text-white" />
    </div>
  </div>
);

interface SectionCardProps {
  title: string;
  isDark: boolean;
  children: React.ReactNode;
}

const SectionCard = ({ title, isDark, children }: SectionCardProps) => (
  <div className={`p-4 md:p-6 rounded-xl shadow-sm border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}>
    <h3 className={`text-base md:text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}>
      {title}
    </h3>
    {children}
  </div>
);

const EmptyHint = ({ text, isDark }: { text: string; isDark: boolean }) => (
  <div className={`text-center py-10 text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>{text}</div>
);

const DailyView = ({ isDark }: { isDark: boolean }) => {
  const { t } = useTranslation();
  const [date, setDate] = useState<string>(() => toLocalDateStr(new Date()));

  const { data, isLoading, isError, refetch } = useQuery<DailyReport>({
    queryKey: ["statistics", "reports", "daily", date],
    queryFn: () => api.statistics.getDailyReport(date),
    staleTime: 30_000,
  });

  const d = data;
  const cards = d
    ? [
        { key: "tasksCompleted", value: d.tasksCompleted, icon: CheckCircle2, color: "bg-green-500" },
        { key: "tasksPlanned", value: d.tasksPlanned, icon: Target, color: "bg-sky-500" },
        { key: "focusMinutes", value: `${d.focusMinutes}′`, hint: `${d.focusSessions}`, icon: Clock, color: "bg-amber-500" },
        { key: "cardsReviewed", value: d.cardsReviewed, icon: BookOpen, color: "bg-indigo-500" },
        { key: "pendingReviews", value: d.pendingReviews, icon: AlarmClock, color: "bg-orange-500" },
        { key: "overdueTasks", value: d.overdueTasks, icon: AlertTriangle, color: "bg-red-500" },
        { key: "newKnowledgePoints", value: d.newKnowledgePoints, icon: Plus, color: "bg-teal-500" },
        { key: "newNotes", value: d.newNotes, icon: FileText, color: "bg-violet-500" },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          max={toLocalDateStr(new Date())}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm ${
            isDark ? "bg-slate-800 border-slate-600 text-white" : "bg-white border-gray-200 text-gray-800"
          }`}
          aria-label={t("statistics.reports.selectDate")}
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState message={t("statistics.loadStatsFailed")} onRetry={() => refetch()} />}
      {data && (
        <>
          {cards.reduce((sum, c) => sum + (typeof c.value === "number" ? c.value : 0), 0) === 0 ? (
            <EmptyHint text={t("statistics.reports.empty")} isDark={isDark} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {cards.map((c) => (
                <StatCard
                  key={c.key}
                  title={t(`statistics.reports.dailyMetrics.${c.key}` as never)}
                  hint={
                    c.key === "focusMinutes"
                      ? t("statistics.reports.dailyMetrics.focusSessionsHint")
                      : t(`statistics.reports.dailyMetrics.${c.key}Hint` as never)
                  }
                  value={c.value}
                  icon={c.icon}
                  color={c.color}
                  isDark={isDark}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const WeeklyView = ({ isDark }: { isDark: boolean }) => {
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState<string>(() => toLocalDateStr(mondayOf(new Date())));

  const { data, isLoading, isError, refetch } = useQuery<WeeklyReport>({
    queryKey: ["statistics", "reports", "weekly", weekStart],
    queryFn: () => api.statistics.getWeeklyReport(weekStart),
    staleTime: 30_000,
  });

  const shiftWeek = (dir: number) => {
    setWeekStart(toLocalDateStr(addDays(new Date(`${weekStart}T00:00:00`), dir * 7)));
  };

  const chartData = (data?.dailyBreakdown ?? []).map((r) => ({
    date: formatDayLabel(r.date),
    tasks: r.tasksCompleted,
    focus: r.focusMinutes,
    reviews: r.cardsReviewed,
  }));

  const metrics = data
    ? [
        { key: "activeDays", value: `${data.activeDays}/7`, icon: CalendarDays, color: "bg-green-500" },
        { key: "tasksCompleted", value: data.tasksCompleted, icon: CheckCircle2, color: "bg-sky-500" },
        { key: "focusMinutes", value: data.focusMinutes, icon: Clock, color: "bg-amber-500" },
        { key: "cardsReviewed", value: data.cardsReviewed, icon: BookOpen, color: "bg-indigo-500" },
        { key: "newKnowledgePoints", value: data.newKnowledgePoints, icon: Plus, color: "bg-teal-500" },
        { key: "newNotes", value: data.newNotes, icon: FileText, color: "bg-violet-500" },
        { key: "currentPendingReviews", value: data.currentPendingReviews, icon: AlarmClock, color: "bg-orange-500" },
        { key: "currentOverdueTasks", value: data.currentOverdueTasks, icon: AlertTriangle, color: "bg-red-500" },
      ]
    : [];

  const weekEnd = data?.weekEnd
    ? addDays(new Date(`${data.weekEnd}T00:00:00`), -1)
    : addDays(new Date(`${weekStart}T00:00:00`), 6);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => shiftWeek(-1)}
          className={`p-2 rounded-lg border transition-colors ${
            isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
          aria-label={t("statistics.reports.prevWeek")}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => shiftWeek(1)}
          disabled={weekStart >= toLocalDateStr(mondayOf(new Date()))}
          className={`p-2 rounded-lg border transition-colors disabled:opacity-40 ${
            isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
          aria-label={t("statistics.reports.nextWeek")}
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setWeekStart(toLocalDateStr(mondayOf(new Date())))}
          className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
            isDark ? "border-slate-600 text-slate-300 hover:bg-slate-700" : "border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          {t("statistics.reports.currentWeek")}
        </button>
        <span className={`text-sm ml-2 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
          {t("statistics.reports.weekRange", {
            start: weekStart,
            end: toLocalDateStr(weekEnd),
          })}
        </span>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState message={t("statistics.loadStatsFailed")} onRetry={() => refetch()} />}
      {data && (
        <>
          {data.activeDays === 0 ? (
            <EmptyHint text={t("statistics.reports.empty")} isDark={isDark} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {metrics.map((m) => (
                <StatCard
                  key={m.key}
                  title={t(`statistics.reports.weeklyMetrics.${m.key}` as never)}
                  hint={t(`statistics.reports.weeklyMetrics.${m.key}Hint` as never)}
                  value={m.value}
                  icon={m.icon}
                  color={m.color}
                  isDark={isDark}
                />
              ))}
            </div>
          )}
          {chartData.length > 0 && (
            <SectionCard title={t("statistics.reports.trend.title")} isDark={isDark}>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: isDark ? "#94a3b8" : "#64748b" }} />
                    <YAxis tick={{ fontSize: 12, fill: isDark ? "#94a3b8" : "#64748b" }} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: isDark ? "#1e293b" : "#fff",
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: isDark ? "#fff" : "#1e293b" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="tasks" name={t("statistics.reports.trend.tasks")} fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="focus" name={t("statistics.reports.trend.focus")} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="reviews" name={t("statistics.reports.trend.reviews")} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
};

export const ReportsTab: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"daily" | "weekly">("daily");

  const modeButton = (id: "daily" | "weekly", label: string) => (
    <button
      key={id}
      onClick={() => setMode(id)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        mode === id
          ? "bg-primary-600 text-white shadow-sm"
          : isDark
            ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
        {t("statistics.reports.subtitle")}
      </p>
      <div className="flex gap-2">
        {modeButton("daily", t("statistics.reports.daily"))}
        {modeButton("weekly", t("statistics.reports.weekly"))}
      </div>
      {mode === "daily" ? <DailyView isDark={isDark} /> : <WeeklyView isDark={isDark} />}
    </div>
  );
};
