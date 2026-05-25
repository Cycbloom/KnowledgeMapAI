import React, { useState, useCallback } from 'react';
import { X, GitMerge, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';

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
  const [selectedAliases, setSelectedAliases] = useState<Set<string>>(
    new Set(suggestedAliases)
  );

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
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <GitMerge className="text-primary-500" size={20} />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              合并别名确认
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            aria-label="关闭"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
              目标节点
            </div>
            <div className="font-medium text-slate-800 dark:text-slate-200">
              {targetTitle}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                以下概念将被合并并转为别名：
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={handleSelectAll}
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  全选
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-slate-500 dark:text-slate-400 hover:underline"
                >
                  取消全选
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
                      aria-label={`选择 ${title}`}
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
                        别名
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {sourceTitles.length === 0 && (
              <div className="flex flex-col items-center py-6 text-slate-400 dark:text-slate-500">
                <AlertCircle size={24} className="mb-2 opacity-50" />
                <p className="text-sm">没有可合并的概念</p>
              </div>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/30 p-2.5 rounded-lg">
              <AlertCircle size={14} />
              <span>
                已选择{' '}
                <span className="font-medium text-primary-600 dark:text-primary-400">
                  {selectedCount}
                </span>{' '}
                个概念作为别名
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            确认合并{selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
};

export type { MergeAliasConfirmationProps };
