import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { api } from '../../services/api';
import { formatDuration } from '../../utils/formatters';
import type {HeatmapData} from '@shared/types';

interface FocusHeatmapProps {
  year?: number;
  className?: string;
}

const MONTHS = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const getColorForDuration = (duration: number, maxDuration: number): string => {
  if (duration === 0) return "bg-slate-100 dark:bg-slate-800";

  const intensity = duration / maxDuration;

  if (intensity < 0.25) return "bg-emerald-200 dark:bg-emerald-900";
  if (intensity < 0.5) return "bg-emerald-400 dark:bg-emerald-700";
  if (intensity < 0.75) return "bg-emerald-500 dark:bg-emerald-600";
  return "bg-emerald-600 dark:bg-emerald-500";
};

interface DayCellProps {
  date: string;
  duration: number;
  count: number;
  maxDuration: number;
  isToday: boolean;
}

const DayCell: React.FC<DayCellProps> = ({
  date,
  duration,
  count,
  maxDuration,
  isToday,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const colorClass = getColorForDuration(duration, maxDuration);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`
          w-3 h-3 rounded-sm cursor-pointer transition-all
          ${colorClass}
          ${isToday ? "ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-slate-900" : ""}
          hover:ring-2 hover:ring-slate-400 dark:hover:ring-slate-500
        `}
      />

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50"
          >
            <div className="bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              <p className="font-medium">
                {new Date(date).toLocaleDateString("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </p>
              {duration > 0 ? (
                <>
                  <p className="text-emerald-400">
                    {formatDuration(duration, { emptyText: "0分钟" })} 专注
                  </p>
                  <p className="text-slate-400">{count} 次会话</p>
                </>
              ) : (
                <p className="text-slate-400">无专注记录</p>
              )}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-700" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FocusHeatmap: React.FC<FocusHeatmapProps> = ({
  year,
  className = "",
}) => {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(
    year ?? new Date().getFullYear(),
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.scheduler.getYearlyHeatmap(currentYear);
        setData(response.data || []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch heatmap data:", err);
        setError("加载热力图数据失败");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentYear]);

  const { calendarData, maxDuration, totalDays, totalDuration, totalSessions } =
    useMemo(() => {
      const dataMap = new Map<string, { duration: number; count: number }>();
      let maxDur = 0;
      let totalDur = 0;
      let totalSess = 0;
      let activeDays = 0;

      data.forEach((d) => {
        dataMap.set(d.date, { duration: d.duration, count: d.count });
        if (d.duration > maxDur) maxDur = d.duration;
        totalDur += d.duration;
        totalSess += d.count;
        if (d.duration > 0) activeDays++;
      });

      const startDate = new Date(currentYear, 0, 1);
      const startDay = startDate.getDay();
      const calendar: Array<
        Array<{ date: string; duration: number; count: number }>
      > = [];

      let currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() - startDay);

      for (let week = 0; week < 53; week++) {
        const weekData: Array<{
          date: string;
          duration: number;
          count: number;
        }> = [];

        for (let day = 0; day < 7; day++) {
          const dateStr = currentDate.toISOString().split("T")[0];
          const yearStr = dateStr.split("-")[0];

          if (yearStr === String(currentYear)) {
            const dayData = dataMap.get(dateStr) || { duration: 0, count: 0 };
            weekData.push({ date: dateStr, ...dayData });
          } else {
            weekData.push({ date: dateStr, duration: 0, count: 0 });
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        calendar.push(weekData);
      }

      return {
        calendarData: calendar,
        maxDuration: maxDur || 1,
        totalDays: activeDays,
        totalDuration: totalDur,
        totalSessions: totalSess,
      };
    }, [data, currentYear]);

  const navigateYear = (direction: "prev" | "next") => {
    setCurrentYear(currentYear + (direction === "prev" ? -1 : 1));
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center text-red-500 dark:text-red-400">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const totalHours = totalDuration / 3600;
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar size={20} className="text-emerald-500" />
            年度专注热力图
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {currentYear}年
          </p>
        </motion.div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateYear("prev")}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => navigateYear("next")}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800/50">
          <p className="text-xs text-slate-600 dark:text-slate-400">活跃天数</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalDays}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800/50">
          <p className="text-xs text-slate-600 dark:text-slate-400">总时长</p>
          <p className="text-xl font-bold text-primary-600 dark:text-primary-400">
            {totalHours.toFixed(1)}h
          </p>
        </div>
        <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-800/50">
          <p className="text-xs text-slate-600 dark:text-slate-400">总会话</p>
          <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
            {totalSessions}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800/50">
          <p className="text-xs text-slate-600 dark:text-slate-400">日均时长</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
            {totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0}h
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 overflow-x-auto"
      >
        <div className="flex gap-1">
          <div className="flex flex-col gap-0.5 mr-2">
            <div className="h-3" />
            {WEEKDAYS.map((day, i) => (
              <div key={day} className="h-3 flex items-center">
                {i % 2 === 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 w-4">
                    {day}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-0.5">
            {calendarData.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {week.map((day, dayIndex) => (
                  <DayCell
                    key={`${weekIndex}-${dayIndex}`}
                    date={day.date}
                    duration={day.duration}
                    count={day.count}
                    maxDuration={maxDuration}
                    isToday={day.date === today}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Info size={12} />
            <span>专注强度</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">少</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
              <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
              <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
              <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
            </div>
            <span className="text-xs text-slate-400">多</span>
          </div>
        </div>
      </motion.div>

      <div className="flex justify-center mt-4 gap-2">
        {MONTHS.map((month, index) => (
          <span
            key={month}
            className="text-[10px] text-slate-400 dark:text-slate-500"
            style={{ width: `${100 / 12}%`, textAlign: "center" }}
          >
            {index % 3 === 0 ? month.slice(0, 2) : ""}
          </span>
        ))}
      </div>

      {totalDuration === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-center py-8 text-slate-500 dark:text-slate-400"
        >
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p>{currentYear}年还没有专注记录</p>
          <p className="text-sm mt-1">开始专注来填充你的热力图</p>
        </motion.div>
      )}
    </div>
  );
};
