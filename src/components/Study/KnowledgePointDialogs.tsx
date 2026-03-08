import React from 'react';
import type { SimilarKnowledgePoint } from '../../types';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            发现相似知识点
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            您要创建的「{pendingTitle}」与以下知识点相似，是否复用？
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
                        {point.visibility === 'public' ? '公共' : '私有'}
                      </span>
                      {point.graphs_count !== undefined && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          已在 {point.graphs_count} 个图谱中使用
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {Math.round(point.similarity * 100)}% 相似
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
            取消
          </button>
          <button
            onClick={onCreateNew}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            创建新知识点
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
  if (!isOpen) return null;

  const hasMultipleGraphs = affectedGraphs.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            删除知识点
          </h3>
        </div>

        <div className="p-4">
          <p className="text-gray-700 dark:text-gray-300">
            确定要删除「{nodeName}」吗？
          </p>

          {hasMultipleGraphs && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                此知识点在多个图谱中使用
              </p>
              <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                {affectedGraphs.slice(0, 5).map((g) => (
                  <li key={g.graph_id}>• {g.graph_title}</li>
                ))}
                {affectedGraphs.length > 5 && (
                  <li>• 还有 {affectedGraphs.length - 5} 个图谱...</li>
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
            取消
          </button>
          <button
            onClick={onSoftDelete}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
          >
            从当前图谱移除
          </button>
          {hasMultipleGraphs && (
            <button
              onClick={onHardDelete}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              彻底删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
