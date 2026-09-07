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
} from "recharts";
import { Brain, TrendingUp, ShieldCheck, AlertTriangle, LucideIcon } from "lucide-react";
import { api } from "../../services/api";
import { useTheme } from "../../hooks";
import { Skeleton } from "../common";
import type { MasteryHealthResponse } from "@shared/types/api";

const CHART_GRID = { top: 4, right: 8, left: -16, bottom: 0 };

const axisTick = (isDark: boolean) => ({
  fontSize: 11,
  fill: isDark ? "#94a3b8" : "#64748b",
});

const tooltipStyle = (isDark: boolean): React.CSSProperties => ({
  backgroundColor: isDark ? "#1e293b" : "#fff",
  border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
  borderRadius: 8,
  fontSize: 12,
});

interface MetricProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  isDark: boolean;
}

const Metric = ({ title, value, icon: Icon, color, isDark }: MetricProps) => (
  <div className={`p-3 md:p-4 rounded-xl shadow-sm border flex items-start justify-between ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}>
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-medium mb-1 truncate ${isDark ? "text-slate-400" : "text-gray-500"}`}>{title}</p>
      <h3 className={`text-xl md:text-2xl font-bold ${isDark ? "text-white" : "text-gray-800"}`}>{value}</h3>
    </div>
    <div className={`p-2 rounded-full ${color} flex-shrink-0 ml-2`}>
      <Icon size={18} className="text-white" />
    </div>
  </div>
);

const ChartCard = ({
  title,
  isDark,
  children,
}: {
  title: string;
  isDark: boolean;
  children: React.ReactNode;
}) => (
  <div className={`p-4 md:p-6 rounded-xl shadow-sm border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}>
    <h3 className={`text-base md:text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}>{title}</h3>
    <div className="w-full h-48">{children}</div>
  </div>
);

export const MasteryHealthPanel: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<MasteryHealthResponse>({
    queryKey: ["statistics", "mastery-health"],
    queryFn: () => api.statistics.getMasteryHealth(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const masteryData = data.masteryBuckets.map((b) => ({
    name: `${b.range}%`,
    count: b.count,
  }));
  const stabilityData = data.stabilityBuckets.map((b) => ({
    name: b.range,
    count: b.count,
  }));
  const retrievabilityData = data.retrievabilityBuckets.map((b) => ({
    name: b.range,
    count: b.count,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-base md:text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
          {t("learningStats.masteryHealth.title")}
        </h3>
        <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
          {t("learningStats.masteryHealth.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Metric title={t("learningStats.masteryHealth.totalPoints")} value={data.totalPoints} icon={Brain} color="bg-primary-500" isDark={isDark} />
        <Metric title={t("learningStats.masteryHealth.avgMastery")} value={`${Math.round(data.avgMastery * 100)}%`} icon={TrendingUp} color="bg-indigo-500" isDark={isDark} />
        <Metric title={t("learningStats.masteryHealth.mastered")} value={`${data.masteredCount} / ${data.learningCount} / ${data.weakCount}`} icon={ShieldCheck} color="bg-green-500" isDark={isDark} />
        <Metric
          title={t("learningStats.masteryHealth.avgStability")}
          value={`${data.avgStability}${t("learningStats.masteryHealth.unitDays")} · ${Math.round(data.avgRetrievability * 100)}%`}
          icon={AlertTriangle}
          color="bg-amber-500"
          isDark={isDark}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <ChartCard title={t("learningStats.masteryHealth.masteryDistribution")} isDark={isDark}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={masteryData} margin={CHART_GRID}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} vertical={false} />
              <XAxis dataKey="name" tick={axisTick(isDark)} />
              <YAxis tick={axisTick(isDark)} allowDecimals={false} />
              <RechartsTooltip cursor={{ fill: isDark ? "#1e293b" : "#f8fafc" }} contentStyle={tooltipStyle(isDark)} />
              <Bar dataKey="count" name={t("learningStats.masteryHealth.totalPoints")} fill="#6366f1" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("learningStats.masteryHealth.stabilityDistribution")} isDark={isDark}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stabilityData} margin={CHART_GRID}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} vertical={false} />
              <XAxis dataKey="name" tick={axisTick(isDark)} />
              <YAxis tick={axisTick(isDark)} allowDecimals={false} />
              <RechartsTooltip cursor={{ fill: isDark ? "#1e293b" : "#f8fafc" }} contentStyle={tooltipStyle(isDark)} />
              <Bar dataKey="count" name={t("learningStats.masteryHealth.unitCards")} fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("learningStats.masteryHealth.retrievabilityDistribution")} isDark={isDark}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={retrievabilityData} margin={CHART_GRID}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} vertical={false} />
              <XAxis dataKey="name" tick={axisTick(isDark)} />
              <YAxis tick={axisTick(isDark)} allowDecimals={false} />
              <RechartsTooltip cursor={{ fill: isDark ? "#1e293b" : "#f8fafc" }} contentStyle={tooltipStyle(isDark)} />
              <Bar dataKey="count" name={t("learningStats.masteryHealth.unitCards")} fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className={`p-4 md:p-6 rounded-xl shadow-sm border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}>
          <h3 className={`text-base md:text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}>
            {t("learningStats.masteryHealth.weakPointsTitle")}
          </h3>
          {data.weakPoints.length === 0 ? (
            <p className={`text-sm ${isDark ? "text-slate-500" : "text-gray-400"}`}>
              {t("learningStats.masteryHealth.noWeakPoints")}
            </p>
          ) : (
            <ul className="space-y-2">
              {data.weakPoints.map((wp) => (
                <li
                  key={wp.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm ${isDark ? "bg-slate-700/50 text-slate-200" : "bg-gray-50 text-gray-700"}`}
                >
                  <span className="truncate min-w-0">{wp.title}</span>
                  <span className="flex-shrink-0 text-xs font-medium text-red-500">
                    {Math.round(wp.mastery * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
