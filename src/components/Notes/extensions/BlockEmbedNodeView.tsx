/**
 * BlockEmbedNodeView —— P3 块嵌入的 React NodeView(Task 9.2/9.3)。
 *
 * 接入 useBlockContent 拉取源块正文并渲染为 Markdown,支持三态:
 * - loading: 加载中(spinner + 文案)
 * - loaded: 渲染块 Markdown 内容(ReactMarkdown)
 * - removed: 源块已删除(isStale=true 或 isError=true)
 *
 * 实时同步(Task 9.1/9.3):
 * - useBlockSSE 监听 block_updated 事件,匹配当前 blockId 时置 isStale=true
 * - 显示"源块已更新,点击刷新"提示条,用户点击后 refetch 并重置 isStale
 *
 * 操作:
 * - 跳转源块:useNavigate -> /notes/{noteId}?block={blockId}
 * - 解除嵌入:deleteNode + insertContent(块正文),把嵌入转为普通文本
 *
 * noteId 解析:优先使用节点 attrs.noteId(插入时记录),为 null 时回退到
 * editor.storage.blockEmbed.currentNoteId(当前编辑笔记,页面重载后场景)。
 * NodeView 不可编辑(contentEditable=false)。
 */
import React, { useCallback, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FileText, ExternalLink, Unlink, RefreshCw, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useBlockContent } from "../../../hooks/queries/useNoteQueries";
import { useBlockSSE } from "../../../hooks/useBlockSSE";

/** 从 editor.storage 安全读取 BlockEmbed 扩展的 currentNoteId。 */
const readCurrentNoteId = (editor: NodeViewProps["editor"]): string | undefined => {
  const storage = editor.storage as { blockEmbed?: { currentNoteId?: string } };
  return storage.blockEmbed?.currentNoteId;
};

export const BlockEmbedNodeView: React.FC<NodeViewProps> = ({
  node,
  editor,
  deleteNode,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const blockId = (node.attrs as { blockId: string | null }).blockId;
  const sourceNoteId = (node.attrs as { noteId: string | null }).noteId;
  const currentNoteId = readCurrentNoteId(editor);
  // 优先用节点记录的源 noteId,回退到当前编辑笔记(页面重载后场景)
  const effectiveNoteId = sourceNoteId ?? currentNoteId ?? "";

  const { data, isLoading, isError, refetch } = useBlockContent(
    effectiveNoteId,
    blockId ?? "",
    !!effectiveNoteId && !!blockId,
  );

  const [isStale, setIsStale] = useState(false);

  // SSE:收到匹配当前 blockId 的 block_updated 事件时,标记为 stale
  const handleBlockUpdated = useCallback(
    (updatedBlockId: string) => {
      if (updatedBlockId === blockId) {
        setIsStale(true);
      }
    },
    [blockId],
  );

  useBlockSSE(currentNoteId, handleBlockUpdated);

  // 刷新:重新拉取块内容并清除 stale 标记
  const handleRefresh = useCallback(() => {
    void refetch();
    setIsStale(false);
  }, [refetch]);

  // 跳转源块笔记
  const handleJumpToSource = useCallback(() => {
    const targetNoteId = data?.noteId ?? effectiveNoteId;
    if (targetNoteId && blockId) {
      navigate(`/notes/${targetNoteId}?block=${blockId}`);
    }
  }, [navigate, data?.noteId, effectiveNoteId, blockId]);

  // 解除嵌入:删除 embed 节点,把块正文作为文本插入原位
  const handleUnembed = useCallback(() => {
    const content = data?.content ?? "";
    deleteNode();
    editor.chain().focus().insertContent(content).run();
  }, [data?.content, deleteNode, editor]);

  // —— 无 blockId:异常态 ——
  if (!blockId) {
    return (
      <NodeViewWrapper
        className="block-embed my-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2"
        as="div"
      >
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{t("notes.blockEmbedNodeView.removed")}</span>
        </div>
      </NodeViewWrapper>
    );
  }

  // —— 加载态 ——
  if (isLoading) {
    return (
      <NodeViewWrapper
        className="block-embed my-2 rounded-lg border border-gray-200 dark:border-slate-500 bg-gray-50 dark:bg-slate-800/50 overflow-hidden"
        as="div"
      >
        <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500 dark:text-slate-400">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="font-mono text-xs">{blockId}</span>
          <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          <span>{t("notes.blockEmbedNodeView.loading")}</span>
        </div>
      </NodeViewWrapper>
    );
  }

  // —— 已删除态:源块不存在(isError=404 或 data.isStale=true) ——
  const isRemoved = isError || (data?.isStale ?? false);
  if (isRemoved) {
    return (
      <NodeViewWrapper
        className="block-embed my-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 overflow-hidden"
        as="div"
        contentEditable={false}
        role="textbox"
        aria-label={t("notes.blockEmbedNodeView.label")}
        aria-multiline="false"
        aria-readonly="true"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{t("notes.blockEmbedNodeView.removed")}</span>
            <span className="font-mono text-xs opacity-70">{blockId}</span>
          </div>
          <button
            type="button"
            onClick={handleUnembed}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-700/50 transition-colors"
            title={t("notes.blockEmbedNodeView.unembed")}
          >
            <Unlink className="w-3 h-3" />
            {t("notes.blockEmbedNodeView.unembed")}
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  // —— 已加载:渲染块 Markdown 内容 ——
  const content = data?.content ?? "";
  const noteTitle = data?.noteTitle ?? "";

  return (
    <NodeViewWrapper
      className="block-embed my-2 rounded-lg border border-gray-200 dark:border-slate-500 bg-gray-50 dark:bg-slate-800/50 overflow-hidden"
      as="div"
      contentEditable={false}
      role="textbox"
      aria-label={t("notes.blockEmbedNodeView.label")}
      aria-multiline="true"
      aria-readonly="true"
    >
      {/* 顶部信息条:标题 + 操作按钮 */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-slate-500 bg-white/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 min-w-0">
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate font-medium">{noteTitle}</span>
          <span className="font-mono text-[10px] opacity-60 flex-shrink-0">{blockId}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleJumpToSource}
            aria-label={t("notes.blockEmbedNodeView.jumpToSource")}
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title={t("notes.blockEmbedNodeView.jumpToSource")}
          >
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleUnembed}
            aria-label={t("notes.blockEmbedNodeView.unembed")}
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title={t("notes.blockEmbedNodeView.unembed")}
          >
            <Unlink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* stale 提示条:源块已更新,点击刷新 */}
      {isStale && (
        <button
          type="button"
          onClick={handleRefresh}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border-b border-amber-100 dark:border-amber-800/50"
        >
          <RefreshCw className="w-3 h-3" />
          {t("notes.blockEmbedNodeView.refreshPrompt")}
        </button>
      )}

      {/* 块正文 Markdown 渲染 */}
      <div className="px-3 py-2 prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-slate-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={(url) => url}>
          {content}
        </ReactMarkdown>
      </div>
    </NodeViewWrapper>
  );
};
