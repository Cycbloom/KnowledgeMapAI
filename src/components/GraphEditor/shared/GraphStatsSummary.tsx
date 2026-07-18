import React from 'react';
import { Node } from '../../../types';
import { PieChart, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface GraphStatsSummaryProps {
  nodes: Node[];
  masteredCount: number;
  dueTodayCount: number;
  isolatedCount: number;
}

export const GraphStatsSummary = React.memo(({
  nodes,
  masteredCount,
  dueTodayCount,
  isolatedCount
}: GraphStatsSummaryProps) => {
  const total = nodes.length;
  if (total === 0) return null;

  const progress = Math.round((masteredCount / total) * 100);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 mb-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
          <PieChart size={14} className="text-primary-500" />
          <span>掌握进度</span>
        </div>
        <span className="font-bold text-primary-600 dark:text-primary-400">{progress}%</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
        <div 
          className="h-full bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700">
          <Clock size={12} className={dueTodayCount > 0 ? "text-amber-500" : "text-slate-400"} />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">今日复习</span>
            <span className={`font-bold ${dueTodayCount > 0 ? "text-amber-600" : "text-slate-600"}`}>
              {dueTodayCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700">
          {isolatedCount > 0 ? (
            <AlertTriangle size={12} className="text-orange-500" />
          ) : (
            <CheckCircle2 size={12} className="text-green-500" />
          )}
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">孤立节点</span>
            <span className={`font-bold ${isolatedCount > 0 ? "text-orange-600" : "text-slate-600"}`}>
              {isolatedCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
