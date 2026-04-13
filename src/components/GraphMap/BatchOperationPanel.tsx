import React from "react";
import { useTranslation } from "react-i18next";
import { X, Link2, Trash2, Sparkles, Tag } from "lucide-react";

interface BatchOperationPanelProps {
  selectedCount: number;
  onBatchCreateRelation: () => void;
  onBatchAnalyze: () => void;
  onBatchDelete: () => void;
  onBatchSetDomain: () => void;
  onClearSelection: () => void;
}

export const BatchOperationPanel: React.FC<BatchOperationPanelProps> = ({
  selectedCount,
  onBatchCreateRelation,
  onBatchAnalyze,
  onBatchDelete,
  onBatchSetDomain,
  onClearSelection,
}) => {
  const { t } = useTranslation();

  if (selectedCount <= 1) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 p-3 flex items-center gap-3 z-50">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('graphMap.batch.selected', { count: selectedCount })}
      </span>
      <div className="h-6 w-px bg-gray-200 dark:bg-slate-600" />
      <button
        onClick={onBatchCreateRelation}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
      >
        <Link2 className="w-4 h-4" />
        {t('graphMap.batch.createRelation')}
      </button>
      <button
        onClick={onBatchAnalyze}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        {t('graphMap.batch.analyze')}
      </button>
      <button
        onClick={onBatchSetDomain}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
      >
        <Tag className="w-4 h-4" />
        {t('graphMap.batch.setDomain')}
      </button>
      <button
        onClick={onBatchDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        {t('graphMap.batch.delete')}
      </button>
      <button
        onClick={onClearSelection}
        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
        title={t('graphMap.batch.clearSelection')}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
