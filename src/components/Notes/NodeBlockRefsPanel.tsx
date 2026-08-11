import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FileText, Quote } from "lucide-react";
import { useBlockRefBacklinks } from "../../hooks/queries";
import { useIsMobile } from "../../hooks/common/useIsMobile";
import { SkeletonList } from "../common/SkeletonList";
import { EmptyState } from "../common/EmptyState";
import { VirtualList } from "../common/VirtualList";
import { withFallback } from "../common/withFallback";
import type { NodeBlockRefBacklink } from "@shared/types/backlink";

export interface NodeBlockRefsPanelProps {
  /** 当前节点 ID(为空时显示空状态) */
  nodeId?: string | null;
}

/**
 * 节点详情侧边栏"引用此节点的块"子区块(P3 Task 10.1)。
 *
 * 列出引用了"含 [[节点]] 的块"的笔记。与 NotesPanel(关联笔记,基于
 * note_node_links)互补:本面板展示块级引用关系(基于 note_block_refs)。
 *
 * 数据流:backlinkService.getBlockRefBacklinksForNode 查含 [[节点]] 的块,
 * 再查 note_block_refs WHERE target_block_id IN 这些块,JOIN source_note
 * 拿引用方笔记标题。每项含引用方笔记(noteId/noteTitle)+ 被引用块摘要。
 *
 * 点击条目跳转到引用方笔记。
 *
 * 使用 VirtualList 优化长列表渲染性能。
 */
export const NodeBlockRefsPanel: React.FC<NodeBlockRefsPanelProps> = ({
  nodeId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile } = useIsMobile();
  const { data: items, isLoading, error } = useBlockRefBacklinks(nodeId);

  // 无节点 ID 时显示空状态
  if (!nodeId) {
    return (
      <EmptyState
        illustration="empty"
        title={t("notes.nodeBlockRefsPanel.empty")}
        className="py-6 min-h-[120px]"
      />
    );
  }

  // 加载态:渲染 SkeletonList 骨架屏
  if (isLoading) {
    // 移动端直接渲染骨架屏，跳过 motion.div 动画
    if (isMobile) {
      return (
        <div>
          <SkeletonList items={2} />
        </div>
      );
    }
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <SkeletonList items={2} />
      </motion.div>
    );
  }

  // 错误态
  if (error) {
    return (
      <EmptyState
        illustration="error"
        title={t("notes.nodeBlockRefsPanel.loadFailed")}
        className="py-6 min-h-[120px]"
      />
    );
  }

  // 空态
  if (!items || items.length === 0) {
    return (
      <EmptyState
        illustration="empty"
        title={t("notes.nodeBlockRefsPanel.empty")}
        className="py-6 min-h-[120px]"
      />
    );
  }

  return (
    <VirtualList
      items={items}
      estimateSize={() => 80}
      overscan={3}
      className="min-h-0"
      style={{ height: '100%' }}
      role="list"
      getItemKey={(index) => `${items[index].noteId}-${items[index].blockId}-${index}`}
      renderItem={(item: NodeBlockRefBacklink) => (
        <button
          type="button"
          onClick={() => navigate(`/notes/${item.noteId}`)}
          className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
        >
          {/* 被引用块摘要 */}
          <div className="flex items-start gap-2 mb-1.5">
            <Quote
              className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
            <p className="flex-1 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
              {item.blockSummary || t("notes.nodeBlockRefsPanel.emptyBlock")}
            </p>
          </div>
          {/* 引用方笔记 */}
          <div className="flex items-center gap-1.5 text-xs">
            <FileText
              className="w-3 h-3 flex-shrink-0 text-primary-500 dark:text-primary-400"
              aria-hidden="true"
            />
            <span className="font-medium text-primary-600 dark:text-primary-400 truncate">
              {item.noteTitle || t("notes.fields.untitled")}
            </span>
            <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">
              {item.blockId}
            </span>
          </div>
        </button>
      )}
    />
  );
};

/** 使用 ErrorBoundary 包裹的 NodeBlockRefsPanel，支持面板级优雅降级 */
export const SafeNodeBlockRefsPanel = withFallback(NodeBlockRefsPanel, { variant: 'panel' });