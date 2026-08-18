import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Tag, X, Plus } from "lucide-react";
import type { Graph } from "@shared/types";
import { useUpdateGraphMutation } from "../../hooks/mutations/useGraphMutations";
import { queryKeys } from "../../hooks/queries/config";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";
import { message } from "../../utils/messageHelper";

/** 单个标签最大长度 */
const MAX_TAG_LENGTH = 20;
/** 单个图谱最大标签数 */
const MAX_TAGS = 20;

interface GraphTagsEditorProps {
  graph: Graph | null;
  onClose: () => void;
}

/**
 * 图谱标签编辑对话框。
 *
 * - chips 可删除；输入框 Enter/逗号确认添加（自动 trim、去重、限长）
 * - 保存调用 graphs.update({ tags })，乐观更新图谱列表；
 *   成功后额外失效 ["tags"] 聚合缓存，保证标签云计数同步
 */
export const GraphTagsEditor: React.FC<GraphTagsEditorProps> = ({
  graph,
  onClose,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const updateGraphMutation = useUpdateGraphMutation();
  const panelRef = useFocusTrap<HTMLDivElement>({ enabled: graph !== null });
  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (graph) {
      setTags(graph.tags ?? []);
      setInput("");
    }
  }, [graph]);

  useEscapeKey(onClose, graph !== null);

  const titleId = useMemo(() => "graph-tags-editor-title", []);

  if (!graph) return null;

  const addTag = (raw: string) => {
    const name = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (!name) return;
    if (tags.includes(name)) {
      setInput("");
      return;
    }
    if (tags.length >= MAX_TAGS) {
      message.warning(t("dashboard.tagsEditor.limitReached", { count: MAX_TAGS }));
      return;
    }
    setTags([...tags, name]);
    setInput("");
  };

  const removeTag = (name: string) => {
    setTags(tags.filter((tag) => tag !== name));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 逗号触发立即添加
    if (value.includes(",")) {
      for (const part of value.split(",")) {
        addTag(part);
      }
    } else {
      setInput(value.slice(0, MAX_TAG_LENGTH));
    }
  };

  const handleSave = async () => {
    try {
      await updateGraphMutation.mutateAsync({
        id: graph.id,
        data: { tags },
      });
      // 图谱 tags 变化会影响跨资源标签聚合
      queryClient.invalidateQueries({ queryKey: queryKeys.tags });
      message.success(t("dashboard.tagsEditor.saveSuccess"));
      onClose();
    } catch {
      message.error(t("dashboard.tagsEditor.saveError"));
    }
  };

  const isDirty =
    JSON.stringify(tags) !== JSON.stringify(graph.tags ?? []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-gray-100 dark:border-slate-700 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
            <Tag size={20} />
          </div>
          <div className="min-w-0">
            <h3
              id={titleId}
              className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate"
            >
              {t("dashboard.tagsEditor.title")}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
              {graph.title}
            </p>
          </div>
        </div>

        {/* 现有标签 chips */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-medium bg-primary-500 text-white"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="hover:bg-primary-600 rounded-full p-0.5 transition-colors"
                  aria-label={t("dashboard.tagsEditor.removeTag", { tag })}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 输入框 */}
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(input);
            }
          }}
          placeholder={t("dashboard.tagsEditor.inputPlaceholder")}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
          aria-label={t("dashboard.tagsEditor.inputPlaceholder")}
        />

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || updateGraphMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            {updateGraphMutation.isPending
              ? t("dashboard.tagsEditor.saving")
              : t("dashboard.tagsEditor.save")}
          </button>
        </div>
      </div>
    </div>
  );
};
