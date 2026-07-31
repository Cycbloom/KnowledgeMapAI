import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SimilarKnowledgePoint } from '../../types';
import { useFocusTrap, useEscapeKey } from '../../hooks/common';

interface KnowledgePointReuseDialogProps {
  isOpen: boolean;
  similarPoints: SimilarKnowledgePoint[];
  pendingTitle: string;
  onReuse: (knowledgePointId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const KnowledgePointReuseDialog: React.FC<KnowledgePointReuseDialogProps> = ({
  isOpen,
  similarPoints,
  pendingTitle,
  onReuse,
  onCreateNew,
  onCancel,
  isLoading = false
}) => {
  const { t } = useTranslation();
  const contentRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onCancel, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kp-reuse-dialog-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 id="kp-reuse-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('study.knowledgePoint.similarityFound')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('study.knowledgePoint.similarityPrompt', { title: pendingTitle })}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {similarPoints.map((point) => (
              <div
                key={point.id}
                className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => !isLoading && onReuse(point.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {point.title}
                    </h4>
                    {point.content && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {point.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        point.visibility === 'public'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {point.visibility === 'public' ? t('study.knowledgePoint.visibilityPublic') : t('study.knowledgePoint.visibilityPrivate')}
                      </span>
                      {point.graphs_count !== undefined && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {t('study.knowledgePoint.usedInGraphs', { count: point.graphs_count })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                      {t('study.knowledgePoint.similarityPercent', { percent: Math.round(point.similarity * 100) })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onCreateNew}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {t('study.knowledgePoint.createNew')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  nodeName: string;
  affectedGraphs?: Array<{ graph_id: string; graph_title: string }>;
  onSoftDelete: () => void;
  onHardDelete: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  nodeName,
  affectedGraphs = [],
  onSoftDelete,
  onHardDelete,
  onCancel,
  isLoading = false
}) => {
  const { t } = useTranslation();
  const contentRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onCancel, isOpen);

  if (!isOpen) return null;

  const hasMultipleGraphs = affectedGraphs.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kp-delete-confirm-dialog-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 id="kp-delete-confirm-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('study.knowledgePoint.deleteTitle')}
          </h3>
        </div>

        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300">
            {t('study.knowledgePoint.deleteConfirm', { name: nodeName })}
          </p>

          {hasMultipleGraphs && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                {t('study.knowledgePoint.usedInMultipleGraphs')}
              </p>
              <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                {affectedGraphs.slice(0, 5).map((g) => (
                  <li key={g.graph_id}>• {g.graph_title}</li>
                ))}
                {affectedGraphs.length > 5 && (
                  <li>• {t('study.knowledgePoint.moreGraphs', { count: affectedGraphs.length - 5 })}</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSoftDelete}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
          >
            {t('study.knowledgePoint.removeFromCurrentGraph')}
          </button>
          {hasMultipleGraphs && (
            <button
              onClick={onHardDelete}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {t('study.knowledgePoint.permanentDelete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
