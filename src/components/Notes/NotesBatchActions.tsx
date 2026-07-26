import React from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X, CheckSquare, Square } from "lucide-react";

interface NotesBatchActionsProps {
  isDark: boolean;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  selectedCount: number;
  isBatchDeleting: boolean;
  onToggleSelectAll: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
}

/**
 * 笔记列表批量操作工具栏。结构与样式镜像 DashboardBatchActions,
 * 仅将 i18n key 前缀从 dashboard.batch.* 改为 notes.batch.*。
 */
export const NotesBatchActions: React.FC<NotesBatchActionsProps> = ({
  isDark,
  isAllSelected,
  isPartialSelected,
  selectedCount,
  isBatchDeleting,
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
      aria-label={t("notes.batch.toolbar")}
    >
      <button
        onClick={onToggleSelectAll}
        role="checkbox"
        aria-checked={(isAllSelected ? "true" : isPartialSelected ? "mixed" : "false") as "true" | "false" | "mixed"}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors min-h-[44px] ${
          isDark
            ? "hover:bg-slate-700 text-slate-300"
            : "hover:bg-gray-100 text-gray-600"
        }`}
        aria-label={
          isAllSelected
            ? t("notes.batch.deselectAll")
            : t("notes.batch.selectAll")
        }
      >
        {isAllSelected ? (
          <CheckSquare
            className="w-5 h-5 text-primary-500"
            aria-hidden="true"
          />
        ) : isPartialSelected ? (
          <div
            className="w-5 h-5 rounded border-2 border-primary-500 bg-primary-500/30 flex items-center justify-center"
            aria-hidden="true"
          >
            <div className="w-2.5 h-0.5 bg-primary-500 rounded" />
          </div>
        ) : (
          <Square className="w-5 h-5" aria-hidden="true" />
        )}
        <span className="text-sm">
          {isAllSelected
            ? t("notes.batch.deselectAll")
            : t("notes.batch.selectAll")}
        </span>
      </button>

      {selectedCount > 0 && (
        <>
          <span
            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
            aria-live="polite"
          >
            {t("notes.batch.selected", { count: selectedCount })}
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
            aria-label={t("notes.batch.batchDelete")}
          >
            <Trash2 size={16} aria-hidden="true" />
            {isBatchDeleting
              ? t("notes.batch.deleting")
              : t("notes.batch.batchDelete")}
          </button>
          <button
            onClick={onClearSelection}
            className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
              isDark
                ? "hover:bg-slate-700 text-slate-400"
                : "hover:bg-gray-100 text-gray-500"
            }`}
            aria-label={t("notes.batch.clearSelection")}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
};

export default NotesBatchActions;
