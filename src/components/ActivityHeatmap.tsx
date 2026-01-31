import React from 'react';

interface ActivityHeatmapProps {
  data: { date: string; count: number }[];
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({ data }) => {
  // Generate last 365 days
  const today = new Date();
  const days = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const activityMap = new Map(data.map(d => [d.date, d.count]));

  const getColor = (count: number) => {
    if (count === 0) return 'bg-gray-100';
    if (count <= 2) return 'bg-green-200';
    if (count <= 5) return 'bg-green-400';
    if (count <= 10) return 'bg-green-600';
    return 'bg-green-800';
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">学习活跃度</h3>
      <div className="flex flex-wrap gap-1">
        {days.map(date => {
          const count = activityMap.get(date) || 0;
          return (
            <div
              key={date}
              className={`w-3 h-3 rounded-sm ${getColor(count)}`}
              title={`${date}: ${count} 次复习`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-end mt-4 text-xs text-gray-500 gap-2">
        <span>Less</span>
        <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
        <div className="w-3 h-3 bg-green-200 rounded-sm"></div>
        <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
        <div className="w-3 h-3 bg-green-600 rounded-sm"></div>
        <div className="w-3 h-3 bg-green-800 rounded-sm"></div>
        <span>More</span>
      </div>
    </div>
  );
};
