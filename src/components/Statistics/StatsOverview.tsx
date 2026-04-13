import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
