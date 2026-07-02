import React from "react";
import { useTranslation } from "react-i18next";
import { useBacklinks } from "../../../hooks";
import { Skeleton } from "../../common/Skeleton";
import { EmptyState } from "../../common/EmptyState";
import type { BacklinkItem } from "@shared/types";

export interface BacklinksPanelProps {
  /** 当前知识点的 ID（为空时显示空状态） */
  knowledgePointId?: string | null;
  /** 当前图谱 ID（用于点击跳转时判断是否同图谱） */
  currentGraphId?: string;
  /** 点击反向链接项时跳转到引用节点的回调 */
  onNavigateToNode?: (knowledgePointId: string, graphId?: string) => void;
}

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  knowledgePointId,
  currentGraphId,
  onNavigateToNode,
}) => {
  const { t } = useTranslation();
  const { backlinks, loading, error } = useBacklinks(knowledgePointId);

  // 无知识点 ID 时显示空状态
  if (!knowledgePointId) {
    return (
      <EmptyState
        illustration="empty"
        title={t("graphEditor.backlinks.empty")}
        className="py-8 min-h-[160px]"
      />
    );
  }

  // 加载态：渲染 3 个 Skeleton 卡片
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton variant="rectangular" height={64} className="rounded-lg" />
        <Skeleton variant="rectangular" height={64} className="rounded-lg" />
        <Skeleton variant="rectangular" height={64} className="rounded-lg" />
      </div>
    );
  }

  // 错误态
  if (error) {
    return (
      <EmptyState
        illustration="error"
        title={t("graphEditor.backlinks.error")}
        className="py-8 min-h-[160px]"
      />
    );
  }

  // 空态
  if (backlinks.length === 0) {
    return (
      <EmptyState
        illustration="empty"
        title={t("graphEditor.backlinks.empty")}
        className="py-8 min-h-[160px]"
      />
    );
  }

  return (
    <div className="space-y-2">
      {backlinks.map((item: BacklinkItem) => {
        const isInCurrentGraph =
          !!currentGraphId && item.graphId === currentGraphId;
        return (
          <button
            key={`${item.sourceKnowledgePointId}-${item.graphId}`}
            type="button"
            onClick={() =>
              onNavigateToNode?.(item.sourceKnowledgePointId, item.graphId)
            }
            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {item.sourceKnowledgePointTitle}
              </span>
              <span
                className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                  isInCurrentGraph
                    ? "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                }`}
                title={item.graphTitle}
              >
                {isInCurrentGraph
                  ? t("graphEditor.backlinks.inCurrentGraph")
                  : item.graphTitle}
              </span>
            </div>
            {item.context && (
              <p className="text-xs italic text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">
                {item.context}
              </p>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
          </button>
        );
      })}
    </div>
  );
};
