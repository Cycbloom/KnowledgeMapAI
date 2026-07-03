/**
 * ExtractConceptsDialog —— 反向建图候选确认对话框(Task 8)。
 *
 * 流程:
 * 1. 由 BlockEditorToolbar 在 useExtractConceptsMutation 成功后弹出,
 *    传入候选 concepts 列表 + noteId。
 * 2. 用户勾选要创建的知识点(默认全选) + 选择目标图谱(graphsApi.list)。
 * 3. 确认后调用 useCreateNodesFromConceptsMutation,成功后关闭对话框 +
 *    toast 提示创建数量 + 失效图谱/笔记查询缓存(mutation 内已处理)。
 *
 * 暗色模式全覆盖;复用 ModalShell / Button / Loading 现有组件。
 */
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Square, ChevronDown } from "lucide-react";
import { ModalShell, Button, Loading } from "@/components/common";
import { useGraphs } from "@/hooks/queries";
import { useCreateNodesFromConceptsMutation } from "@/hooks/mutations";
import { message } from "@/utils/messageHelper";
import type { NoteExtractedConcept } from "@shared/types/note";
import { cn } from "@/lib/utils";

export interface ExtractConceptsDialogProps {
  open: boolean;
  onClose: () => void;
  concepts: NoteExtractedConcept[];
  noteId: string;
}

export const ExtractConceptsDialog: React.FC<ExtractConceptsDialogProps> = ({
  open,
  onClose,
  concepts,
  noteId,
}) => {
  const { t } = useTranslation();
  const graphsQuery = useGraphs();
  const createNodesMutation = useCreateNodesFromConceptsMutation();

  // 默认全部勾选:用 index 集合记录选中项,概念列表变化时重置
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(concepts.map((_, idx) => idx)),
  );
  const [graphId, setGraphId] = useState<string>("");

  // concepts 变化(每次打开传入新列表)时重置为全选
  useEffect(() => {
    setSelectedIndices(new Set(concepts.map((_, idx) => idx)));
  }, [concepts]);

  // 首个可用图谱作为默认值
  useEffect(() => {
    if (!graphId && graphsQuery.data && graphsQuery.data.length > 0) {
      setGraphId(graphsQuery.data[0].id);
    }
  }, [graphsQuery.data, graphId]);

  const toggleIndex = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const selectedConcepts = useMemo(
    () =>
      concepts
        .map((c, idx) => ({ concept: c, idx }))
        .filter(({ idx }) => selectedIndices.has(idx))
        .map(({ concept }) => concept),
    [concepts, selectedIndices],
  );

  const canConfirm =
    selectedConcepts.length > 0 && !!graphId && !createNodesMutation.isPending;

  const handleConfirm = async () => {
    if (!graphId || selectedConcepts.length === 0) return;
    try {
      const result = await createNodesMutation.mutateAsync({
        noteId,
        data: { graphId, selectedConcepts },
      });
      const successCount = result.results.filter((r) => r.success).length;
      message.success(t("notes.ai.createNodes.success", { count: successCount }));
      onClose();
    } catch {
      message.error(t("notes.ai.createNodes.error"));
    }
  };

  const titleId = "extract-concepts-dialog-title";
  const graphs = graphsQuery.data ?? [];

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      titleId={titleId}
      closeOnOverlayClick={!createNodesMutation.isPending}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3
          id={titleId}
          className="text-base font-semibold text-gray-900 dark:text-gray-100"
        >
          {t("notes.ai.extractConcepts.dialog.title")}
        </h3>
      </div>

      {/* 描述 */}
      <div className="px-5 pt-3 pb-2">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("notes.ai.extractConcepts.dialog.description")}
        </p>
      </div>

      {/* 候选知识点列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-2">
        {concepts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">
            {t("notes.ai.extractConcepts.dialog.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {concepts.map((concept, idx) => {
              const isSelected = selectedIndices.has(idx);
              return (
                <li key={`${concept.name}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => toggleIndex(idx)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-primary-400",
                      isSelected
                        ? "border-primary-300 bg-primary-50/50 dark:border-primary-700 dark:bg-primary-900/20"
                        : "border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {isSelected ? (
                        <CheckSquare
                          className="w-4 h-4 mt-0.5 text-primary-600 dark:text-primary-400 flex-shrink-0"
                          aria-hidden
                        />
                      ) : (
                        <Square
                          className="w-4 h-4 mt-0.5 text-gray-400 dark:text-slate-500 flex-shrink-0"
                          aria-hidden
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {concept.name}
                        </p>
                        {concept.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">
                            {concept.description}
                          </p>
                        )}
                        {concept.related && concept.related.length > 0 && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 break-words">
                            {t("notes.ai.extractConcepts.dialog.related", {
                              related: concept.related.join(", "),
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 目标图谱选择器 */}
      <div className="px-5 py-3 border-t border-gray-200 dark:border-slate-700">
        <label
          htmlFor="extract-concepts-graph-select"
          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5"
        >
          {t("notes.ai.extractConcepts.dialog.targetGraph")}
        </label>
        <div className="relative">
          <select
            id="extract-concepts-graph-select"
            value={graphId}
            onChange={(e) => setGraphId(e.target.value)}
            disabled={createNodesMutation.isPending || graphsQuery.isLoading}
            className={cn(
              "w-full appearance-none px-3 py-2 pr-9 text-sm rounded-lg border",
              "bg-white dark:bg-slate-700",
              "border-gray-300 dark:border-slate-600",
              "text-gray-800 dark:text-slate-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-400",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {graphsQuery.isLoading ? (
              <option value="">
                {t("notes.ai.extractConcepts.dialog.selectGraph")}
              </option>
            ) : graphs.length === 0 ? (
              <option value="">
                {t("notes.ai.extractConcepts.dialog.selectGraph")}
              </option>
            ) : (
              graphs.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))
            )}
          </select>
          <ChevronDown
            className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none"
            aria-hidden
          />
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
        {createNodesMutation.isPending && (
          <Loading size="sm" text={t("notes.ai.extractConcepts.loading")} />
        )}
        <Button
          variant="ghost"
          size="md"
          onClick={onClose}
          disabled={createNodesMutation.isPending}
        >
          {t("notes.ai.extractConcepts.dialog.cancel")}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleConfirm}
          disabled={!canConfirm}
          loading={createNodesMutation.isPending}
        >
          {t("notes.ai.extractConcepts.dialog.confirm")}
        </Button>
      </div>
    </ModalShell>
  );
};
