import React from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarClock,
  Loader2,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import type { LearningPathDetail } from "./types";

interface PathActionBarProps {
  pathDetail: LearningPathDetail;
  isUpdating: boolean;
  onAutoSchedule: () => void;
  onUpdatePathStatus: (status: "active" | "paused" | "archived") => void;
  onDeletePath: () => void;
}

const PathActionBar: React.FC<PathActionBarProps> = ({
  pathDetail,
  isUpdating,
  onAutoSchedule,
  onUpdatePathStatus,
  onDeletePath,
}) => {
  const navigate = useNavigate();

  return (
    <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          {pathDetail.graph_id && (
            <button
              onClick={() => navigate(`/graphs/${pathDetail.graph_id}`)}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              查看图谱
            </button>
          )}
          <button
            onClick={onAutoSchedule}
            disabled={isUpdating}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2 disabled:opacity-50"
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarClock className="w-4 h-4" />
            )}
            自动排程
          </button>
        </div>

        <div className="flex items-center gap-2">
          {pathDetail.status === "active" && (
            <button
              onClick={() => onUpdatePathStatus("paused")}
              className="px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              暂停
            </button>
          )}
          {pathDetail.status === "paused" && (
            <button
              onClick={() => onUpdatePathStatus("active")}
              className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              继续
            </button>
          )}
          <button
            onClick={onDeletePath}
            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>
    </div>
  );
};

export default PathActionBar;
