import React from 'react';
import { useTheme } from "../../hooks";

interface ActivityHeatmapProps {
  data: { date: string; count: number }[];
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data }) => {
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

  return (
    <div className={`p-4 md:p-6 rounded-lg shadow-md border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
      <h3 className={`text-base md:text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>学习活跃度</h3>
      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <div className="flex flex-wrap gap-0.5 md:gap-1 min-w-max">
          {days.map(date => {
            const count = activityMap.get(date) || 0;
            return (
              <div
                key={date}
                className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${getColor(count)}`}
                title={`${date}: ${count} 次复习`}
              />
            );
          })}
        </div>
      </div>
      <div className={`flex items-center justify-end mt-4 text-xs gap-1 md:gap-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        <span>Less</span>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-900' : 'bg-green-200'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-700' : 'bg-green-400'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-500' : 'bg-green-600'}`}></div>
        <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded-sm ${isDark ? 'bg-green-400' : 'bg-green-800'}`}></div>
        <span>More</span>
      </div>
    </div>
  );
};
