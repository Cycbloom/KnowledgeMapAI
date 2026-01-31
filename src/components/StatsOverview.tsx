import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface StatsOverviewProps {
  data: { name: string; value: number; color: string }[];
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 h-full">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">知识掌握分布</h3>
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
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
