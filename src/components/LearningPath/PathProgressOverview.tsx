import React from "react";
import { BarChart3 } from "lucide-react";
import { NodeStatus } from "../../services/api/learningPaths";
import type { LearningPathDetail } from "./types";

interface PathProgressOverviewProps {
  pathDetail: LearningPathDetail;
  nodesByStatus: Record<NodeStatus, number>;
}

const PathProgressOverview: React.FC<PathProgressOverviewProps> = ({
  pathDetail,
  nodesByStatus,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary-500" />
        进度概览
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary-500">
              {pathDetail.progress.total_nodes}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              总节点
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">
              {pathDetail.progress.completed_nodes}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              已完成
            </div>
          </div>
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary-500">
              {nodesByStatus.in_progress || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              学习中
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-500">
              {nodesByStatus.pending || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              待学习
            </div>
          </div>
        </div>

        <div className="pt-4 border-t dark:border-slate-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              连续学习
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {pathDetail.progress.current_streak} 天
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              最长连续
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {pathDetail.progress.longest_streak} 天
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PathProgressOverview;
