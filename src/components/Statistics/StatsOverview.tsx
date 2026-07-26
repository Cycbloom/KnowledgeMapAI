import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import { useTheme } from "../../hooks";

interface StatsOverviewProps {
  data: { name: string; value: number; color: string }[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ data }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  return (
    <div className={`p-6 rounded-3xl shadow-sm border h-full ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
    }`}>
      <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
        {t('statistics.knowledgeDistribution')}
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#1e293b' : '#fff'} strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1e293b' : '#fff',
                borderColor: isDark ? '#334155' : '#e5e7eb',
                borderRadius: '0.5rem',
                color: isDark ? '#f1f5f9' : '#1f2937'
              }}
              itemStyle={{ color: isDark ? '#f1f5f9' : '#1f2937' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <dl className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} aria-hidden="true" />
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{entry.name}</span>
            </dt>
            <dd className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{entry.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
