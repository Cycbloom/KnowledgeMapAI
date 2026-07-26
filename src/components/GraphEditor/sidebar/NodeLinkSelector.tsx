import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { Loader2, Search, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backlinksApi } from "../../../services/api/backlinks";
import { useFocusTrap } from "@/hooks/common";
import type { KnowledgePointSearchHit } from "@shared/types";

export interface NodeLinkSelectorProps {
  /** 搜索查询的图谱 ID（优先显示该图谱的节点） */
  graphId?: string;
  /** 当前节点 ID（排除自身，避免自引用） */
  currentKnowledgePointId?: string;
  /** 选中节点时的回调，参数为节点标题（用于插入 [[标题]]） */
  onSelect: (title: string) => void;
  /** 关闭浮层回调 */
  onClose: () => void;
  /** 浮层定位（绝对定位的 top/left） */
  position: { top: number; left: number };
}

export const NodeLinkSelector: React.FC<NodeLinkSelectorProps> = ({
  graphId,
  currentKnowledgePointId,
  onSelect,
  onClose,
  position,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgePointSearchHit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const popoverRef = useFocusTrap<HTMLDivElement>();

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 防抖搜索（200ms）
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const hits = await backlinksApi.search(query, {
          graphId,
          limit: 10,
        });
        const filtered = currentKnowledgePointId
          ? hits.filter(
              (h: KnowledgePointSearchHit) => h.id !== currentKnowledgePointId,
            )
          : hits;
        setResults(filtered);
        setSelectedIndex(filtered.length > 0 ? 0 : -1);
      } catch {
        setResults([]);
        setSelectedIndex(-1);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, graphId, currentKnowledgePointId]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          onSelect(results[selectedIndex].title);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [results, selectedIndex, onSelect, onClose],
  );

  // 键盘导航（result item button, roving tabindex）
  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(index + 1, results.length - 1);
        setSelectedIndex(next);
        const nextEl = listRef.current?.children[next] as
          | HTMLElement
          | undefined;
        nextEl?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(index - 1, 0);
        setSelectedIndex(prev);
        const prevEl = listRef.current?.children[prev] as
          | HTMLElement
          | undefined;
        prevEl?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[index]) {
          onSelect(results[index].title);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [results, onSelect, onClose],
  );

  // 滚动到选中项
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as
        | HTMLElement
        | undefined;
      selectedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={t("graphEditor.nodeLinkSelector.dialogLabel")}
      className="fixed z-50 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      {/* 搜索框 */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div
          role="search"
          aria-label={t('common.aria.searchWithTarget', { target: t('graphEditor.backlinks.panelTitle') })}
          className="relative"
        >
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("graphEditor.backlinks.searchPlaceholder")}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          {loading && (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>
      </div>

      {/* 结果列表 */}
      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label={t("graphEditor.backlinks.panelTitle")}
        className="max-h-64 overflow-y-auto"
      >
        {!query.trim() && (
          <div className="p-3 text-sm text-gray-400 dark:text-gray-500 text-center">
            {t("graphEditor.backlinks.searchHint")}
          </div>
        )}
        {query.trim() && !loading && results.length === 0 && (
          <div className="p-3 text-sm text-gray-400 dark:text-gray-500 text-center">
            {t("graphEditor.backlinks.searchEmpty")}
          </div>
        )}
        {results.map((hit, index) => (
          <button
            key={hit.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onSelect(hit.title)}
            onKeyDown={(e) => handleItemKeyDown(e, index)}
            className={`w-full text-left px-3 py-2 cursor-pointer flex items-start gap-2 ${
              index === selectedIndex
                ? "bg-primary-50 dark:bg-primary-900/30"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
          >
            <FileText className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {hit.title}
              </div>
              {hit.graphTitles.length > 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {hit.inCurrentGraph
                    ? t("graphEditor.backlinks.inCurrentGraph")
                    : hit.graphTitles[0]}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
