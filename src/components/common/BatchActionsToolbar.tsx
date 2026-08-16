import React from "react";
import { useTranslation } from "react-i18next";
import { Trash2, X, CheckSquare, Square } from "lucide-react";

export interface BatchActionsToolbarProps {
  isDark: boolean;
  /** i18n 命名空间前缀，如 "notes.batch" / "dashboard.batch"。组件读取 `${prefix}.selectAll` 等。 */
  i18nPrefix: string;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  selectedCount: number;
  isBatchDeleting: boolean;
  batchDeleteProgress?: { completed: number; total: number } | null;
  onToggleSelectAll: () => void;
  onBatchAction: () => void;
  onClearSelection: () => void;
}

/**
 * 共享批量操作工具栏。三态全选(全/半/未选)、选中计数、批量执行、清除选择，
 * 视觉与 aria 语义在各列表统一，通过 `i18nPrefix` 读取对应命名空间文案。
 */
export const BatchActionsToolbar: React.FC<BatchActionsToolbarProps> = ({
  isDark,
  i18nPrefix,
  isAllSelected,
  isPartialSelected,
  selectedCount,
  isBatchDeleting,
  batchDeleteProgress,
  onToggleSelectAll,
  onBatchAction,
  onClearSelection,
}) => {
  const { t } = useTranslation();

  const ariaChecked = (
    isAllSelected ? "true" : isPartialSelected ? "mixed" : "false"
  ) as "true" | "false" | "mixed";

  const actionLabel: string = batchDeleteProgress
    ? t(`${i18nPrefix}.deletingProgress` as never, {
        completed: batchDeleteProgress.completed,
        total: batchDeleteProgress.total,
      })
    : isBatchDeleting
      ? t(`${i18nPrefix}.deleting` as never)
      : t(`${i18nPrefix}.batchDelete` as never);

  return (
    <div
      className={`flex items-center gap-4 p-3 rounded-xl ${
        isDark ? "bg-slate-800" : "bg-white border border-gray-200"
      }`}
      role="toolbar"
      aria-label={t(`${i18nPrefix}.toolbar` as never)}
    >
      <button
        onClick={onToggleSelectAll}
        role="checkbox"
        aria-checked={ariaChecked}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors min-h-[44px] ${
          isDark
            ? "hover:bg-slate-700 text-slate-300"
            : "hover:bg-gray-100 text-gray-600"
        }`}
        aria-label={
          isAllSelected
            ? t(`${i18nPrefix}.deselectAll` as never)
            : t(`${i18nPrefix}.selectAll` as never)
        }
      >
        {isAllSelected ? (
          <CheckSquare className="w-5 h-5 text-primary-500" aria-hidden="true" />
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
            ? t(`${i18nPrefix}.deselectAll` as never)
            : t(`${i18nPrefix}.selectAll` as never)}
        </span>
      </button>

      {selectedCount > 0 && (
        <>
          <span
            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
            aria-live="polite"
          >
            {t(`${i18nPrefix}.selected` as never, { count: selectedCount })}
          </span>
          <div className="flex-1" />
          <button
            onClick={onBatchAction}
            disabled={isBatchDeleting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              isDark
                ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            } disabled:opacity-50`}
            aria-label={t(`${i18nPrefix}.batchDelete` as never)}
          >
            <Trash2 size={16} aria-hidden="true" />
            {actionLabel}
          </button>
          <button
            onClick={onClearSelection}
            className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
              isDark
                ? "hover:bg-slate-700 text-slate-400"
                : "hover:bg-gray-100 text-gray-500"
            }`}
            aria-label={t(`${i18nPrefix}.clearSelection` as never)}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
};