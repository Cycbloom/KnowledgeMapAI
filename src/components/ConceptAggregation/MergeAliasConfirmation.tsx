import React, { useState, useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { X, GitMerge, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { useFocusTrap, useEscapeKey } from '@/hooks/common';

interface MergeAliasConfirmationProps {
  targetTitle: string;
  sourceTitles: string[];
  suggestedAliases: string[];
  onConfirm: (aliasesToKeep: string[]) => void;
  onCancel: () => void;
}

export const MergeAliasConfirmation: React.FC<MergeAliasConfirmationProps> = ({
  targetTitle,
  sourceTitles,
  suggestedAliases,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [selectedAliases, setSelectedAliases] = useState<Set<string>>(
    new Set(suggestedAliases)
  );

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: true });
  useEscapeKey(() => onCancel(), true);
  const titleId = useId();

  const handleToggleAlias = useCallback((alias: string) => {
    setSelectedAliases((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) {
        next.delete(alias);
      } else {
        next.add(alias);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedAliases(new Set(suggestedAliases));
  }, [suggestedAliases]);

  const handleDeselectAll = useCallback(() => {
    setSelectedAliases(new Set());
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(Array.from(selectedAliases));
  }, [selectedAliases, onConfirm]);

  const selectedCount = selectedAliases.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500">
          <div className="flex items-center gap-2">
            <GitMerge className="text-primary-500" size={20} />
            <h3 id={titleId} className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {t("conceptAggregation.mergeAlias.title")}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            aria-label={t("conceptAggregation.mergeAlias.close")}
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
              {t("conceptAggregation.mergeAlias.targetNode")}
            </div>
            <div className="font-medium text-slate-800 dark:text-slate-200">
              {targetTitle}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("conceptAggregation.mergeAlias.mergeHint")}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={handleSelectAll}
                  className="text-primary-600 dark:text-primary-400 underline"
                >
                  {t("conceptAggregation.mergeAlias.selectAll")}
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-slate-500 dark:text-slate-400 underline"
                >
                  {t("conceptAggregation.mergeAlias.deselectAll")}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {sourceTitles.map((title) => {
                const isSelected = selectedAliases.has(title);
                return (
                  <label
                    key={title}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggleAlias(title);
                      }}
                      className="flex-shrink-0"
                      aria-label={t("conceptAggregation.mergeAlias.selectItem", { name: title })}
                    >
                      {isSelected ? (
                        <CheckSquare
                          size={18}
                          className="text-primary-600 dark:text-primary-400"
                        />
                      ) : (
                        <Square
                          size={18}
                          className="text-slate-400 dark:text-slate-500"
                        />
                      )}
                    </button>

                    <span
                      className={`text-sm flex-1 ${
                        isSelected
                          ? 'text-slate-800 dark:text-slate-200 font-medium'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {title}
                    </span>

                    {isSelected && (
                      <span className="text-xs px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                        {t("conceptAggregation.mergeAlias.aliasLabel")}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {sourceTitles.length === 0 && (
              <EmptyState
                icon={<GitMerge className="w-12 h-12 text-gray-400" />}
                title={t('conceptAggregation.mergeAlias.empty')}
              />
            )}
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 p-2.5 rounded-lg">
              <AlertCircle size={14} />
              <span>
                {t("conceptAggregation.mergeAlias.selectedCount", { count: selectedCount })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("conceptAggregation.mergeAlias.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            {selectedCount > 0
              ? t("conceptAggregation.mergeAlias.confirmWithCount", { count: selectedCount })
              : t("conceptAggregation.mergeAlias.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export type { MergeAliasConfirmationProps };
