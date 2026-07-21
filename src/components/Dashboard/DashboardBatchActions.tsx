import React from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X, CheckSquare, Square } from "lucide-react";

interface DashboardBatchActionsProps {
  isDark: boolean;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  selectedCount: number;
  isBatchDeleting: boolean;
  batchDeleteProgress?: { completed: number; total: number } | null;
  onToggleSelectAll: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

export const DashboardBatchActions: React.FC<DashboardBatchActionsProps> = ({
  isDark,
  isAllSelected,
  isPartialSelected,
  selectedCount,
  isBatchDeleting,
  batchDeleteProgress,
  onToggleSelectAll,
  onBatchDelete,
  onClearSelection,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-xl ${
        isDark ? "bg-slate-800" : "bg-white border border-gray-200"
      }`}
      role="toolbar"
      aria-label={t("dashboard.batch.toolbar")}
    >
      <button
        onClick={onToggleSelectAll}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors min-h-[44px] ${
          isDark
            ? "hover:bg-slate-700 text-slate-300"
            : "hover:bg-gray-100 text-gray-600"
        }`}
        aria-label={isAllSelected ? t("dashboard.batch.deselectAll") : t("dashboard.batch.selectAll")}
      >
        {isAllSelected ? (
          <CheckSquare className="w-5 h-5 text-primary-500" aria-hidden="true" />
        ) : isPartialSelected ? (
          <div className="w-5 h-5 rounded border-2 border-primary-500 bg-primary-500/30 flex items-center justify-center" aria-hidden="true">
            <div className="w-2.5 h-0.5 bg-primary-500 rounded" />
          </div>
        ) : (
          <Square className="w-5 h-5" aria-hidden="true" />
        )}
        <span className="text-sm">
          {isAllSelected
            ? t("dashboard.batch.deselectAll")
            : t("dashboard.batch.selectAll")}
        </span>
      </button>

      {selectedCount > 0 && (
        <>
          <span
            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
            aria-live="polite"
          >
            {t("dashboard.batch.selected", { count: selectedCount })}
          </span>
          <div className="flex-1" />
          <button
            onClick={onBatchDelete}
            disabled={isBatchDeleting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              isDark
                ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            } disabled:opacity-50`}
            aria-label={t("dashboard.batch.batchDelete")}
          >
            <Trash2 size={16} aria-hidden="true" />
            {batchDeleteProgress
              ? t("tasks.progress.deleting", {
                  completed: batchDeleteProgress.completed,
                  total: batchDeleteProgress.total,
                })
              : isBatchDeleting
                ? t("dashboard.batch.deleting")
                : t("dashboard.batch.batchDelete")}
          </button>
          <button
            onClick={onClearSelection}
            className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
              isDark
                ? "hover:bg-slate-700 text-slate-400"
                : "hover:bg-gray-100 text-gray-500"
            }`}
            aria-label={t("dashboard.batch.clearSelection")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
};
