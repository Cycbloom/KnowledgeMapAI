import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Quote } from "lucide-react";
import {
  useInboundBlockRefs,
  useBlockContent,
} from "../../hooks/queries";
import { Skeleton } from "../common/Skeleton";
import { EmptyState } from "../common/EmptyState";
import type { BlockRef, BlockId } from "@shared/types/note";

export interface InboundBlockRefsPanelProps {
  /** 当前笔记 ID */
  noteId: string;
}

/**
 * 笔记详情侧边栏"被引用的块"面板(P3 Task 10.2)。
 *
 * 列出当前笔记中被其他笔记通过 ((blockId)) 引用的块。与
 * NodeBlockRefsPanel(节点维度,基于 [[节点]] 块被引用)互补:
 * 本面板是笔记维度,展示本笔记的块被谁引用。
 *
 * 数据流:
 * 1. useInboundBlockRefs(noteId) 拉取 BlockRef[](target_note_id = noteId)
 * 2. 按 targetBlockId 分组
 * 3. 每组用 useBlockContent(noteId, blockId) 拉取块内容做摘要展示
 * 4. 每组下列出引用方笔记(sourceNoteTitle),点击跳转
 *
 * 暗色模式 + i18n + 空状态。
 */

/** 单个"被引用块"分组:展示块摘要 + 引用方笔记列表。 */
const InboundBlockRefGroup: React.FC<{
  noteId: string;
  blockId: BlockId;
  refs: BlockRef[];
}> = ({ noteId, blockId, refs }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: blockContent, isLoading } = useBlockContent(
    noteId,
    blockId,
    true,
  );

  // 块摘要:优先用 blockContent.content(剥离 ^id),回退到空串
  const summary = blockContent?.content
    ? blockContent.content
        .replace(/\s*\^[a-z0-9]{10}\s*$/, "")
        .trim()
        .slice(0, 120)
    : "";

  // 块是否已失效(源块被修改/删除,blockId 不再存在)
  const isStale = blockContent?.isStale === true;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* 块摘要区 */}
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start gap-2">
          <Quote
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          {isLoading ? (
            <Skeleton
              variant="text"
              height={14}
              className="flex-1"
            />
          ) : (
            <p
              className={`flex-1 text-xs line-clamp-2 ${
                isStale
                  ? "text-gray-400 dark:text-gray-500 italic"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              {summary || t("notes.inboundBlockRefsPanel.emptyBlock")}
            </p>
          )}
          <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0">
            {blockId}
          </span>
        </div>
      </div>

      {/* 引用方笔记列表 */}
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {refs.map((ref) => {
          const referrerTitle =
            ref.sourceNoteTitle || t("notes.fields.untitled");
          const typeLabel =
            ref.type === "embed"
              ? t("notes.inboundBlockRefsPanel.typeEmbed")
              : t("notes.inboundBlockRefsPanel.typeRef");
          return (
            <li key={ref.id}>
              <button
                type="button"
                onClick={() => navigate(`/notes/${ref.sourceNoteId}`)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <FileText
                  className="w-3 h-3 flex-shrink-0 text-primary-500 dark:text-primary-400"
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0 text-xs font-medium text-primary-600 dark:text-primary-400 truncate">
                  {referrerTitle}
                </span>
                <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {typeLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const InboundBlockRefsPanel: React.FC<InboundBlockRefsPanelProps> = ({
  noteId,
}) => {
  const { t } = useTranslation();
  const { data: refs, isLoading, error } = useInboundBlockRefs(noteId);

  // 加载态
  if (isLoading) {
    return (
      <div className="space-y-2">
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
        title={t("notes.inboundBlockRefsPanel.loadFailed")}
        className="py-6 min-h-[120px]"
      />
    );
  }

  // 空态
  if (!refs || refs.length === 0) {
    return (
      <EmptyState
        illustration="empty"
        title={t("notes.inboundBlockRefsPanel.empty")}
        className="py-6 min-h-[120px]"
      />
    );
  }

  // 按 targetBlockId 分组(同一块被多个笔记引用时合并展示)
  const groups = new Map<BlockId, BlockRef[]>();
  for (const ref of refs) {
    const list = groups.get(ref.targetBlockId);
    if (list) {
      list.push(ref);
    } else {
      groups.set(ref.targetBlockId, [ref]);
    }
  }

  return (
    <div className="space-y-2">
      {Array.from(groups.entries()).map(([blockId, groupRefs]) => (
        <InboundBlockRefGroup
          key={blockId}
          noteId={noteId}
          blockId={blockId}
          refs={groupRefs}
        />
      ))}
    </div>
  );
};
