/**
 * BlockReferenceNodeView —— P3 块引用的 React NodeView。
 *
 * 渲染为 inline 胶囊:📌 块摘要。三态:
 * - loading: 加载中(淡化显示 blockId)
 * - loaded: 显示块摘要(noteTitle - blockSummary 截断)
 * - stale: 源块已删除/失效,渲染为灰色胶囊,点击不跳转,显示 tooltip
 *
 * 点击 loaded 胶囊:跳转 /notes/{noteId}?block={blockId}
 * 点击 stale 胶囊:不跳转,显示 tooltip "源块已删除,可点击移除引用"
 */
import React, { useCallback, useId, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Link2, AlertCircle } from "lucide-react";
import { useBlockContent } from "../../../hooks/queries/useNoteQueries";

/** 从 editor.storage 安全读取 BlockEmbed 扩展的 currentNoteId(BlockReference 复用同一存储)。 */
const readCurrentNoteId = (editor: NodeViewProps["editor"]): string | undefined => {
  const storage = editor.storage as { blockEmbed?: { currentNoteId?: string } };
  return storage.blockEmbed?.currentNoteId;
};

/** 截断摘要为 40 字符 */
const truncate = (s: string, max = 40): string => (s.length > max ? `${s.slice(0, max)}…` : s);

export const BlockReferenceNodeView: React.FC<NodeViewProps> = ({
  node,
  editor,
  deleteNode,
  selected,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const blockId = (node.attrs as { blockId: string | null }).blockId;
  const sourceNoteId = (node.attrs as { noteId: string | null }).noteId;
  const currentNoteId = readCurrentNoteId(editor);
  const effectiveNoteId = sourceNoteId ?? currentNoteId ?? "";
  const staleTooltipId = useId();

  const { data, isLoading, isError } = useBlockContent(
    effectiveNoteId,
    blockId ?? "",
    !!effectiveNoteId && !!blockId,
  );

  const [showTooltip, setShowTooltip] = useState(false);

  const isStale = isError || (data?.isStale ?? false) || !data;

  const handleClick = useCallback(() => {
    if (isStale || !data) {
      setShowTooltip((v) => !v);
      return;
    }
    const targetNoteId = data.noteId || effectiveNoteId;
    if (targetNoteId && blockId) {
      navigate(`/notes/${targetNoteId}?block=${blockId}`);
    }
  }, [isStale, data, effectiveNoteId, blockId, navigate]);

  const handleRemove = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  // 无 blockId:异常态
  if (!blockId) {
    return (
      <NodeViewWrapper
        className="block-ref inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500"
        as="span"
        contentEditable={false}
      >
        <AlertCircle className="w-3 h-3" />
        <span>{t("notes.editor.blockRef.stale")}</span>
      </NodeViewWrapper>
    );
  }

  // 失效态:灰色胶囊
  if (isStale) {
    return (
      <NodeViewWrapper
        className="block-ref inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-pointer relative"
        as="span"
        contentEditable={false}
        onClick={handleClick}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
        data-selected={selected}
        aria-describedby={staleTooltipId}
        aria-haspopup={"tooltip" as "true"}
      >
        <AlertCircle className="w-3 h-3" />
        <span className="font-mono text-[10px]">{blockId}</span>
        <span>{t("notes.editor.blockRef.stale")}</span>
        {showTooltip && (
          <span
            role="tooltip"
            id={staleTooltipId}
            className="absolute z-10 top-full left-0 mt-1 px-2 py-1 rounded bg-gray-800 dark:bg-slate-900 text-white text-[10px] whitespace-nowrap shadow-lg"
          >
            {t("notes.editor.blockRef.removed")}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              className="ml-1 underline hover:text-amber-300"
            >
              {t("notes.editor.blockEmbed.unembed")}
            </button>
          </span>
        )}
      </NodeViewWrapper>
    );
  }

  // 加载态
  if (isLoading) {
    return (
      <NodeViewWrapper
        className="block-ref inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
        as="span"
        contentEditable={false}
      >
        <Link2 className="w-3 h-3" />
        <span className="font-mono text-[10px]">{blockId}</span>
        <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
      </NodeViewWrapper>
    );
  }

  // 已加载:胶囊
  const summary = truncate(data?.content ?? "");
  const noteTitle = data?.noteTitle ?? "";

  return (
    <NodeViewWrapper
      className="block-ref inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
      as="span"
      contentEditable={false}
      onClick={handleClick}
      title={t("notes.editor.blockRef.tooltip")}
      data-selected={selected}
    >
      <Link2 className="w-3 h-3" />
      {noteTitle && <span className="font-medium">{truncate(noteTitle, 20)}</span>}
      <span className="opacity-70">·</span>
      <span>{summary}</span>
    </NodeViewWrapper>
  );
};
