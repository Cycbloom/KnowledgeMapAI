import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNotesByNode } from "../../hooks/queries";
import { SkeletonList } from "../common/SkeletonList";
import { EmptyState } from "../common/EmptyState";
import { VirtualList } from "../common/VirtualList";
import { formatDate } from "../../utils/formatters";
import type { NoteType } from "@shared/types/note";

export interface NotesPanelProps {
  /** 当前节点 ID（为空时显示空状态） */
  nodeId?: string | null;
  /** 当前图谱 ID（保留以对齐 BacklinksPanel 签名，目前未使用） */
  graphId?: string;
}

interface NoteItem {
  id: string;
  title: string | null;
  type: NoteType;
  updatedAt: string;
  isPinned: boolean;
}

/** 类型徽章样式：daily 用紫色，note 用蓝色（与 NotesListPage 保持一致）。 */
const getTypeBadgeClass = (type: NoteType): string => {
  if (type === "daily") {
    return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700";
  }
  return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
};

/**
 * 节点详情侧边栏"关联笔记"面板。
 *
 * 列出挂载到当前节点的所有笔记（基于 note_node_links 表，
 * 由笔记正文 `[[节点名]]` 自动建立挂载关系）。点击笔记项跳转到笔记编辑器。
 *
 * 使用 VirtualList 优化长列表渲染性能。
 */
const NotesPanelComponent: React.FC<NotesPanelProps> = ({ nodeId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: notes, isLoading, error } = useNotesByNode(nodeId);

  // 无节点 ID 时显示空状态
  if (!nodeId) {
    return (
      <EmptyState
        illustration="empty"
        title={t("notes.notesPanel.empty.title")}
        description={t("notes.notesPanel.empty.description")}
        className="py-8 min-h-[160px]"
      />
    );
  }

  // 加载态：渲染 SkeletonList 骨架屏
  if (isLoading) {
    return (
      <div>
        <SkeletonList items={3} />
      </div>
    );
  }

  // 错误态
  if (error) {
    return (
      <EmptyState
        illustration="error"
        title={t("notes.notesPanel.loadFailed")}
        className="py-8 min-h-[160px]"
      />
    );
  }

  // 空态
  if (!notes || notes.length === 0) {
    return (
      <EmptyState
        illustration="empty"
        title={t("notes.notesPanel.empty.title")}
        description={t("notes.notesPanel.empty.description")}
        action={{
          label: t("notes.notesPanel.empty.cta"),
          onClick: () => navigate("/notes"),
        }}
        className="py-8 min-h-[160px]"
      />
    );
  }

  const noteItems: NoteItem[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    type: note.type,
    updatedAt: note.updatedAt,
    isPinned: note.isPinned,
  }));

  return (
    <VirtualList
      items={noteItems}
      estimateSize={() => 80}
      overscan={3}
      className="min-h-0"
      style={{ height: '100%' }}
      role="list"
      getItemKey={(index) => noteItems[index].id}
      renderItem={(note) => {
        const typeLabel =
          note.type === "daily"
            ? t("notes.badges.daily")
            : t("notes.badges.note");
        const updatedLabel = t("notes.notesPanel.updated", {
          date: formatDate(note.updatedAt, "short"),
        });
        return (
          <button
            key={note.id}
            type="button"
            onClick={() => navigate(`/notes/${note.id}`)}
            className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {note.title || t("notes.fields.untitled")}
              </span>
              <span
                className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded border ${getTypeBadgeClass(
                  note.type,
                )}`}
              >
                {typeLabel}
              </span>
            </div>
            {note.isPinned && (
              <span className="inline-block text-xs text-amber-600 dark:text-amber-400 mb-1">
                {t("notes.badges.pinned")}
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {updatedLabel}
            </span>
          </button>
        );
      }}
    />
  );
};

const areEqual = (prev: NotesPanelProps, next: NotesPanelProps) => {
  return prev.nodeId === next.nodeId;
};

export const NotesPanel = React.memo(NotesPanelComponent, areEqual);