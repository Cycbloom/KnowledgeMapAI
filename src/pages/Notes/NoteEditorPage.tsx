import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Trash2,
  Loader2,
  CalendarDays,
  NotebookPen,
  AlertTriangle,
} from "lucide-react";
import { useNote } from "@/hooks/queries";
import {
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useRestoreNoteMutation,
} from "@/hooks/mutations";
import { useError } from "@/hooks";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { addRecentNote } from "@/hooks/useRecentNotes";
import { BlockEditor } from "@/components/Notes/BlockEditor";
import { InboundBlockRefsPanel } from "@/components/Notes/InboundBlockRefsPanel";
import { Skeleton, EmptyState, ErrorBoundary } from "@/components/common";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { formatDate } from "@/utils/formatters";

/** 标题输入防抖时长（ms）。 */
const TITLE_DEBOUNCE_MS = 600;

/**
 * NoteEditorPage —— 笔记编辑器页（Task 8）。
 *
 * 路由：`/notes/:noteId`
 * 职责：
 * - 加载单篇笔记（useNote 查询）
 * - 顶部：返回列表按钮、类型徽章、可编辑标题（失焦/防抖保存）、置顶/归档/删除操作
 * - 主体：嵌入 BlockEditor（自动保存由其内部完成，列表查询失效由 mutation 处理）
 * - 加载态：Skeleton 骨架屏；错误/不存在态：EmptyState
 * - 暗色模式全覆盖
 */
const NoteEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { handleError } = useError();

  const { data: note, isLoading, isError } = useNote(noteId);

  const updateMutation = useUpdateNoteMutation();
  const deleteMutation = useDeleteNoteMutation();
  const restoreMutation = useRestoreNoteMutation();

  // 软删除笔记后显示 6s 撤销 toast，点击撤销调用 restore API
  const { executeDelete: executeDeleteNote } = useUndoableAction<string, string>({
    deleteFn: async (id: string) => {
      await deleteMutation.mutateAsync(id);
      return id;
    },
    restoreFn: (id: string) => restoreMutation.mutateAsync(id).then(() => undefined),
    deletedMessage: t("notes.noteDeleted"),
  });

  // 本地标题状态（受控输入，避免远端 refetch 覆盖用户输入）
  const [title, setTitle] = useState<string>("");
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = useRef<string>("");

  // 仅在 noteId 变化时同步标题，避免远端 refetch 覆盖正在输入的标题
  const noteIdValue = note?.id;
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      lastSavedTitleRef.current = note.title;
    }
    // 仅依赖 noteId，避免 note.title 变化触发同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdValue]);

  // 卸载时清标题防抖定时器
  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    };
  }, []);

  // 记录最近访问的笔记（Task 12）
  // 防重复：用 ref 记录上次写入的 noteId，仅在 noteId 变化时写入，
  // 避免 note.title 加载前后触发重复写入
  const lastRecordedNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!noteId || !note) return;
    if (lastRecordedNoteIdRef.current === noteId) return;
    const noteTitle = note.title?.trim() || t("notes.editorPage.untitled");
    addRecentNote({ id: noteId, title: noteTitle });
    lastRecordedNoteIdRef.current = noteId;
  }, [noteId, note?.title, t]);

  const saveTitle = async (nextTitle: string) => {
    if (!noteId) return;
    if (nextTitle === lastSavedTitleRef.current) return;
    try {
      await updateMutation.mutateAsync({
        id: noteId,
        data: { title: nextTitle },
      });
      lastSavedTitleRef.current = nextTitle;
    } catch (err) {
      handleError(err, {
        context: "NoteEditorPage.saveTitle",
        fallbackMessage: t("notes.editorPage.saveError"),
      });
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setTitle(next);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      void saveTitle(next);
    }, TITLE_DEBOUNCE_MS);
  };

  const handleTitleBlur = () => {
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    void saveTitle(title);
  };

  const handleTogglePin = async () => {
    if (!note) return;
    try {
      await updateMutation.mutateAsync({
        id: note.id,
        data: { isPinned: !note.isPinned },
      });
    } catch (err) {
      handleError(err, {
        context: "NoteEditorPage.togglePin",
        fallbackMessage: t("notes.updateFailed"),
      });
    }
  };

  const handleToggleArchive = async () => {
    if (!note) return;
    try {
      await updateMutation.mutateAsync({
        id: note.id,
        data: { isArchived: !note.isArchived },
      });
    } catch (err) {
      handleError(err, {
        context: "NoteEditorPage.toggleArchive",
        fallbackMessage: t("notes.updateFailed"),
      });
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    const confirmed = await asyncConfirm({
      title: t("notes.editorPage.deleteConfirmTitle"),
      message: t("notes.editorPage.deleteConfirmMessage"),
      confirmText: t("common.delete"),
      cancelText: t("common.cancel"),
      isDangerous: true,
    });
    if (!confirmed) return;
    try {
      await executeDeleteNote(note.id);
      navigate("/notes");
    } catch (err) {
      handleError(err, {
        context: "NoteEditorPage.delete",
        fallbackMessage: t("notes.deleteFailed"),
      });
    }
  };

  const handleBack = () => {
    navigate("/notes");
  };

  // —— 加载态：Skeleton 骨架屏 ——
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-40" />
          <Skeleton variant="rectangular" className="h-[60vh] w-full" />
        </div>
      </div>
    );
  }

  // —— 错误/不存在态 ——
  if (isError || !note) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-500 p-8 max-w-md w-full">
          <EmptyState
            illustration="error"
            title={t("notes.editorPage.notFound")}
            description={t("notes.editorPage.loadFailed")}
            action={{ label: t("notes.actions.open"), onClick: handleBack }}
          />
        </div>
      </div>
    );
  }

  const typeBadgeClass =
    note.type === "daily"
      ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700"
      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      <h1 className="sr-only">{t('notes.title')}</h1>
      {/* 顶部 header */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label={t("notes.actions.open")}
            title={t("notes.actions.open")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold flex-shrink-0 ${typeBadgeClass}`}
          >
            {note.type === "daily" ? (
              <CalendarDays size={11} aria-hidden="true" />
            ) : (
              <NotebookPen size={11} aria-hidden="true" />
            )}
            <span>
              {note.type === "daily"
                ? t("notes.badges.daily")
                : t("notes.badges.note")}
            </span>
          </span>

          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            placeholder={t("notes.editorPage.untitled")}
            className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md px-2 py-1"
            aria-label={t("notes.editorPage.title")}
          />

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={handleTogglePin}
              disabled={updateMutation.isPending}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-md transition-colors disabled:opacity-50"
              title={
                note.isPinned
                  ? t("notes.actions.unpin")
                  : t("notes.actions.pin")
              }
              aria-label={
                note.isPinned
                  ? t("notes.actions.unpin")
                  : t("notes.actions.pin")
              }
            >
              {note.isPinned ? <PinOff size={18} /> : <Pin size={18} />}
            </button>
            <button
              type="button"
              onClick={handleToggleArchive}
              disabled={updateMutation.isPending}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50"
              title={
                note.isArchived
                  ? t("notes.actions.unarchive")
                  : t("notes.actions.archive")
              }
              aria-label={
                note.isArchived
                  ? t("notes.actions.unarchive")
                  : t("notes.actions.archive")
              }
            >
              {note.isArchived ? (
                <ArchiveRestore size={18} />
              ) : (
                <Archive size={18} />
              )}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              title={t("notes.actions.delete")}
              aria-label={t("notes.actions.delete")}
            >
              {deleteMutation.isPending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
            </button>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-2 text-xs text-gray-400 dark:text-slate-500">
          {t("notes.fields.updatedAt")}: {formatDate(note.updatedAt, "relative")}
        </div>
      </header>

      {/* 主体：BlockEditor(左) + 被引用的块侧边栏(右,P3 Task 10.2) */}
      <div role="region" aria-label={t('common.aria.noteEditorRegion')} className="flex-1 overflow-hidden">
        <div className="h-full max-w-6xl mx-auto flex gap-4 px-4 sm:px-6 py-4">
          <div className="flex-1 min-w-0 h-full">
            <div className="max-w-4xl mx-auto h-full">
              <ErrorBoundary
                fallbackRender={(error, resetErrorBoundary) => (
                  <div className="h-full flex items-center justify-center p-6">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/40 p-8 max-w-md w-full text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <p role="alert" className="text-red-600 dark:text-red-400 mb-2 font-medium">
                        编辑器崩溃
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4 font-mono break-all">
                        {error.message}
                      </p>
                      <button
                        type="button"
                        onClick={resetErrorBoundary}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                      >
                        {t("common.retry")}
                      </button>
                    </div>
                  </div>
                )}
              >
                <BlockEditor
                  noteId={note.id}
                  initialContent={note.content}
                  noteType={note.type}
                />
              </ErrorBoundary>
            </div>
          </div>
          {/* P3 Task 10.2: 被引用的块侧边栏(大屏可见,移动端隐藏避免遮挡编辑器) */}
          <aside className="hidden lg:flex flex-col w-72 flex-shrink-0 h-full overflow-y-auto border-l border-gray-200 dark:border-slate-500 pl-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex-shrink-0">
              {t("notes.blockRefsPanel.inboundTitle")}
            </h3>
            <div className="flex-1 min-h-0">
              <InboundBlockRefsPanel noteId={note.id} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default NoteEditorPage;
