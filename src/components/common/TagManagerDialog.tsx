import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Tags,
  X,
  Pencil,
  Trash2,
  Merge,
  Check,
  Network,
  FileText,
  ListTodo,
} from "lucide-react";
import { useTags } from "../../hooks/queries/useTagQueries";
import {
  useRenameTagMutation,
  useMergeTagsMutation,
  useDeleteTagMutation,
} from "../../hooks/mutations/useTagMutations";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";
import { message } from "../../utils/messageHelper";
import { ConfirmationModal } from "./ConfirmationModal";
import type { TagSummary } from "../../services/api/contracts/ITagsApi";

/** 标签名最大长度（与后端 tagRouteService 校验一致） */
const MAX_TAG_LENGTH = 30;

interface TagManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type MergingState =
  | { phase: "idle" }
  | { phase: "input" }
  | { phase: "confirm"; target: string };

/**
 * 统一标签管理对话框：跨图谱/笔记/任务的标签
 * 重命名（行内编辑）、多选合并、删除（带确认）。
 */
export const TagManagerDialog: React.FC<TagManagerDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { data: tags, isLoading } = useTags();
  const renameMutation = useRenameTagMutation();
  const mergeMutation = useMergeTagsMutation();
  const deleteMutation = useDeleteTagMutation();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<TagSummary | null>(null);
  const [merging, setMerging] = useState<MergingState>({ phase: "idle" });
  const [mergeTarget, setMergeTarget] = useState("");

  const panelRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);

  const sortedTags = useMemo(
    () => [...(tags ?? [])].sort((a, b) => b.total - a.total),
    [tags],
  );

  const toggleSelected = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelected(next);
    setMerging({ phase: "idle" });
    setMergeTarget("");
  };

  const startRename = (tag: TagSummary) => {
    setRenaming({ from: tag.name, to: tag.name });
  };

  const confirmRename = async () => {
    if (!renaming) return;
    const to = renaming.to.trim().slice(0, MAX_TAG_LENGTH);
    if (!to) {
      message.warning(t("tags.manager.nameRequired"));
      return;
    }
    if (to === renaming.from) {
      setRenaming(null);
      return;
    }
    try {
      const res = await renameMutation.mutateAsync({ from: renaming.from, to });
      const total =
        res.updated.graphs + res.updated.notes + res.updated.tasks;
      message.success(t("tags.manager.renameSuccess", { count: total }));
      setRenaming(null);
    } catch {
      message.error(t("tags.manager.operationFailed"));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await deleteMutation.mutateAsync(deleting.name);
      const total =
        res.removed.graphs + res.removed.notes + res.removed.tasks;
      message.success(t("tags.manager.deleteSuccess", { count: total }));
      selected.delete(deleting.name);
      setSelected(new Set(selected));
    } catch {
      message.error(t("tags.manager.operationFailed"));
    } finally {
      setDeleting(null);
    }
  };

  const startMerge = () => {
    setMerging({ phase: "input" });
    setMergeTarget("");
  };

  const confirmMerge = async () => {
    const target = mergeTarget.trim().slice(0, MAX_TAG_LENGTH);
    if (!target) {
      message.warning(t("tags.manager.nameRequired"));
      return;
    }
    if (selected.has(target)) {
      // 目标已在选中集合中：将其移出 sources
      const sources = [...selected].filter((name) => name !== target);
      if (sources.length === 0) {
        message.warning(t("tags.manager.selectToMerge"));
        return;
      }
      await doMerge(sources, target);
      return;
    }
    await doMerge([...selected], target);
  };

  const doMerge = async (sources: string[], target: string) => {
    try {
      const res = await mergeMutation.mutateAsync({ sources, target });
      const total =
        res.updated.graphs + res.updated.notes + res.updated.tasks;
      message.success(t("tags.manager.mergeSuccess", { count: total }));
      setSelected(new Set());
      setMerging({ phase: "idle" });
      setMergeTarget("");
    } catch {
      message.error(t("tags.manager.operationFailed"));
    }
  };

  const totalRefs = (tag: TagSummary) =>
    tag.counts.graphs + tag.counts.notes + tag.counts.tasks;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-gray-100 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-slate-700">
          <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
            <Tags size={20} />
          </div>
          <h3 className="flex-1 text-base sm:text-lg font-bold text-gray-900 dark:text-white">
            {t("tags.manager.dialogTitle")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label={t("common.cancel")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Merge bar */}
        {selected.size >= 2 && (
          <div className="px-5 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-900/50">
            {merging.phase === "idle" ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-primary-700 dark:text-primary-300">
                  {t("tags.manager.mergeSelected")} ({selected.size})
                </span>
                <button
                  onClick={startMerge}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  <Merge size={14} />
                  {t("tags.manager.mergeSelected")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  {t("tags.manager.mergeDescription", { count: selected.size })}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={mergeTarget}
                    onChange={(e) =>
                      setMergeTarget(e.target.value.slice(0, MAX_TAG_LENGTH))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmMerge();
                      }
                    }}
                    placeholder={t("tags.manager.mergeTargetPlaceholder")}
                    ref={(el) => {
                      el?.focus();
                    }}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={confirmMerge}
                    disabled={mergeMutation.isPending}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} />
                    {t("tags.manager.confirm")}
                  </button>
                  <button
                    onClick={() => setMerging({ phase: "idle" })}
                    className="px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {t("tags.manager.cancel")}
                  </button>
                </div>
                {/* 从未选中的已有标签中选目标 */}
                <div className="flex flex-wrap gap-1.5">
                  {sortedTags
                    .filter((tag) => !selected.has(tag.name))
                    .slice(0, 10)
                    .map((tag) => (
                      <button
                        key={tag.name}
                        onClick={() => setMergeTarget(tag.name)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          mergeTarget === tag.name
                            ? "bg-primary-500 text-white"
                            : "bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600"
                        }`}
                      >
                        {tag.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">
              {t("common.loading")}
            </div>
          ) : sortedTags.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500">
              {t("tags.manager.empty")}
            </div>
          ) : (
            sortedTags.map((tag) => {
              const isSelected = selected.has(tag.name);
              const isRenamingThis = renaming?.from === tag.name;
              return (
                <div
                  key={tag.name}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isSelected
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <button
                    onClick={() => toggleSelected(tag.name)}
                    aria-label={tag.name}
                    className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                      isSelected
                        ? "bg-primary-500 border-primary-500 text-white"
                        : "border-gray-300 dark:border-slate-600 hover:border-primary-500"
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </button>

                  {isRenamingThis && renaming ? (
                    <input
                      type="text"
                      value={renaming.to}
                      ref={(el) => {
                        el?.focus();
                      }}
                      onChange={(e) =>
                        setRenaming({
                          from: renaming.from,
                          to: e.target.value.slice(0, MAX_TAG_LENGTH),
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          confirmRename();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setRenaming(null);
                        }
                      }}
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-primary-300 dark:border-primary-700 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                      {tag.name}
                    </span>
                  )}

                  {/* 资源计数 */}
                  <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-gray-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-0.5">
                      <Network size={11} />
                      {tag.counts.graphs}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <FileText size={11} />
                      {tag.counts.notes}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <ListTodo size={11} />
                      {tag.counts.tasks}
                    </span>
                  </div>

                  {/* 行内操作 */}
                  {isRenamingThis && renaming ? (
                    <button
                      onClick={confirmRename}
                      disabled={renameMutation.isPending}
                      className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50 transition-colors"
                      aria-label={t("tags.manager.confirm")}
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => startRename(tag)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
                      aria-label={t("tags.manager.rename")}
                      title={t("tags.manager.rename")}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleting(tag)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                    aria-label={t("tags.manager.delete")}
                    title={t("tags.manager.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 删除确认 */}
      <ConfirmationModal
        isOpen={deleting !== null}
        title={t("tags.manager.deleteConfirmTitle")}
        message={t("tags.manager.deleteConfirmMessage", {
          name: deleting?.name ?? "",
          count: deleting ? totalRefs(deleting) : 0,
        })}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};
