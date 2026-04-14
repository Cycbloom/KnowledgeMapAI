import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from "../../hooks";

interface ActivityHeatmapProps {
  data: { date: string; count: number }[];
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const today = new Date();
  const days = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const activityMap = new Map(data.map(d => [d.date, d.count]));

  const getColor = (count: number) => {
    if (count === 0) return isDark ? 'bg-slate-700' : 'bg-gray-100';
    if (count <= 2) return isDark ? 'bg-green-900' : 'bg-green-200';
    if (count <= 5) return isDark ? 'bg-green-700' : 'bg-green-400';
    if (count <= 10) return isDark ? 'bg-green-500' : 'bg-green-600';
    return isDark ? 'bg-green-400' : 'bg-green-800';
  };

  const weeks: (string | null)[][] = [];
  let currentWeek: (string | null)[] = [];
  
  const firstDay = new Date(days[0]);
  const firstDayOfWeek = firstDay.getDay();
  
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }
  
  days.forEach(date => {
    const d = new Date(date);
    if (d.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(date);
  });
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return (
    <div className={`p-4 md:p-6 rounded-lg shadow-md border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
      <h3 className={`text-base md:text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>{t('stats.activity.title')}</h3>
      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <div className="flex gap-0.5 md:gap-1 min-w-max">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5 md:gap-1">
              {week.map((date, dayIndex) => {
                if (!date) {
                  return (
                    <div
                      key={`empty-${weekIndex}-${dayIndex}`}
                      className="w-2.5 h-2.5 md:w-3 md:h-3"
                    />
                  );
                }
                const count = activityMap.get(date) || 0;
                return (
                  <div
                    key={date}
                    className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${getColor(count)}`}
                    title={`${date}: ${t('stats.activity.reviewCount', { count: count })}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className={`flex items-center justify-end mt-4 text-xs gap-1 md:gap-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        <span>{t('stats.activity.less')}</span>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-900' : 'bg-green-200'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-700' : 'bg-green-400'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-500' : 'bg-green-600'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-400' : 'bg-green-800'}`}></div>
        <span>{t('stats.activity.more')}</span>
      </div>
    </div>
  );
};
