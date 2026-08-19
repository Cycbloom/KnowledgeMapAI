import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Inbox, Trash2, Sparkles, ChevronRight } from "lucide-react";
import { useGraphs, queryKeys, useNotesList, useTodaySummary } from "@/hooks/queries";
import { Button, EmptyState, Skeleton } from "@/components/common";
import { message } from "@/utils/messageHelper";
import { api } from "@/services/api";
import { CAPTURE_INBOX_TAG } from "@shared/constants/capture";
import type { Note } from "@shared/types/note";
import type { Graph } from "@shared/types";

/**
 * 今日回顾 / 捕获箱面板（每日捕获 + AI 自动归档的闭环入口）。
 *
 * 捕获复用笔记体系：捕获即一条挂上 CAPTURE_INBOX_TAG 的普通笔记；
 * "AI 归档"复用后端 autoArchive 链路（提取知识点 → 目标图谱建连 → 清除捕获箱标记）。
 */
export const TodayReview = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: graphs } = useGraphs();
  const graphList: Graph[] = graphs ?? [];
  const { data: summary } = useTodaySummary();

  const [draft, setDraft] = useState("");
  const [targetGraphId, setTargetGraphId] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBatchArchiving, setIsBatchArchiving] = useState(false);

  const { data, isLoading } = useNotesList({
    view: "note",
    tag: CAPTURE_INBOX_TAG,
    pageSize: 50,
  });

  const inboxNotes = React.useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // 默认归档目标：优先用户选择，否则取第一个图谱
  const effectiveGraphId = targetGraphId || graphList[0]?.id || "";

  const invalidateInbox = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.notesPrefix });

  const handleCapture = async () => {
    const text = draft.trim();
    if (!text) return;
    setIsCapturing(true);
    try {
      const firstLine = text.split(/\r?\n/, 1)[0]?.trim() || t("capture.untitled");
      await api.notes.create({
        title: firstLine.slice(0, 80),
        content: text,
        type: "note",
        tags: [CAPTURE_INBOX_TAG],
      });
      setDraft("");
      message.success(t("capture.captureCreated"));
      invalidateInbox();
    } catch {
      message.error(t("capture.captureFailed"));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleArchive = async (note: Note) => {
    if (!effectiveGraphId) {
      message.warning(t("capture.noGraph"));
      return;
    }
    setArchivingId(note.id);
    try {
      const result = await api.notes.autoArchive(note.id, {
        graphId: effectiveGraphId,
      });
      message.success(
        result.created
          ? t("capture.archiveSuccess", { n: result.nodeCount })
          : t("capture.archiveNoConcept"),
      );
      invalidateInbox();
    } catch {
      message.error(t("capture.archiveFailed"));
    } finally {
      setArchivingId(null);
    }
  };

  const handleBatchArchive = async () => {
    if (inboxNotes.length === 0) return;
    if (!effectiveGraphId) {
      message.warning(t("capture.noGraph"));
      return;
    }
    setIsBatchArchiving(true);
    try {
      const result = await api.notes.batchArchive({
        graphId: effectiveGraphId,
        noteIds: inboxNotes.map((n) => n.id),
      });
      message.success(
        t("capture.batchArchiveSuccess", {
          archived: result.archivedCount,
          failed: result.failedCount,
        }),
      );
      invalidateInbox();
    } catch {
      message.error(t("capture.batchArchiveFailed"));
    } finally {
      setIsBatchArchiving(false);
    }
  };

  const handleDelete = async (note: Note) => {
    setDeletingId(note.id);
    try {
      await api.notes.delete(note.id);
      message.success(t("capture.deleted"));
      invalidateInbox();
    } catch {
      message.error(t("capture.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-5">
      {/* 头部 */}
      <header className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100">
          <Inbox className="w-4 h-4 text-primary-500" aria-hidden="true" />
          {t("capture.title")}
        </h2>
        {inboxNotes.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            loading={isBatchArchiving}
            leftIcon={<Sparkles className="w-4 h-4" aria-hidden="true" />}
            onClick={handleBatchArchive}
          >
            {t("capture.batchArchive")}
          </Button>
        )}
      </header>

      {/* 今日回顾摘要 */}
      {summary && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 font-medium text-primary-700 dark:text-primary-300">
            <Inbox className="w-3 h-3" aria-hidden="true" />
            {t("capture.summaryPending", { n: summary.inboxCount })}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-300">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            {t("capture.summaryDueCards", { n: summary.dueCards })}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-300">
            <ChevronRight className="w-3 h-3" aria-hidden="true" />
            {t("capture.summaryDueTasks", { n: summary.dueTasks })}
          </span>
        </div>
      )}

      {/* 快速捕获输入 */}
      <div className="mb-3">
        <label htmlFor="today-review-capture" className="sr-only">
          {t("capture.placeholder")}
        </label>
        <div className="flex gap-2 items-end">
          <textarea
            id="today-review-capture"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleCapture();
              }
            }}
            placeholder={t("capture.placeholder")}
            className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <Button
            loading={isCapturing}
            onClick={handleCapture}
            disabled={!draft.trim()}
            leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
          >
            {t("capture.capture")}
          </Button>
        </div>

        {/* 归档目标图谱选择 */}
        {graphList.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{t("capture.target")}</span>
            <select
              value={effectiveGraphId}
              onChange={(e) => setTargetGraphId(e.target.value)}
              className="rounded-md border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {graphList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 捕获列表 */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : inboxNotes.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-6 h-6 opacity-60" aria-hidden="true" />}
            title={t("capture.emptyTitle")}
            description={t("capture.emptyDesc")}
          />
        ) : (
          inboxNotes.map((note) => {
            const snippet =
              note.content
                ?.replace(/[[\]]/g, "")
                .split(/\r?\n/)
                .filter(Boolean)
                .join(" ")
                .slice(0, 80) ?? "";
            const isArchiving = archivingId === note.id;
            const isDeleting = deletingId === note.id;
            return (
              <div
                key={note.id}
                className="flex items-start gap-2 rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                    {note.title}
                  </p>
                  {snippet && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {snippet}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={isArchiving}
                    onClick={() => handleArchive(note)}
                    title={t("capture.archive")}
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{t("capture.archive")}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={isDeleting}
                    onClick={() => handleDelete(note)}
                    title={t("capture.delete")}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};