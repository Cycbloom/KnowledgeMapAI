/**
 * BlockRefPopover —— P3 块引用补全浮层。
 *
 * 当用户在编辑器输入 `((`(块引用)或 `!((`(块嵌入)时,由 BlockEditor 唤起本浮层。
 * 浮层内含输入框,用户输入查询文本后调用 useBlockSearch 拉取候选块(防抖 300ms),
 * 上下键导航 + Enter 选中 + Esc 关闭。选中后由父组件 BlockEditor 决定插入
 * BlockReference(ref 模式)还是 BlockEmbed(embed 模式)。
 *
 * 风格对齐 WikiLinkPopover / WritingAssistPopover:
 * - position: fixed + top/left = anchorRect.bottom/left
 * - 暗色模式 + z-50 + rounded-lg border shadow-lg
 * - 滚动/缩放时关闭(锚点坐标失效)
 *
 * 与 WikiLinkPopover 的差异:本浮层自带输入框(查询在浮层内输入,而非取自编辑器文本),
 * 故键盘导航在输入框的 onKeyDown 内自处理,不依赖父组件拦截。
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, FileText } from "lucide-react";
import { useBlockSearch } from "@/hooks/queries/useNoteQueries";
import type { BlockRefTarget } from "@shared/types/note";

export interface BlockRefPopoverProps {
  /** 锚点坐标(光标处),由 editor.view.coordsAtPos 计算。 */
  anchorRect: DOMRect;
  /** 选中某个块后回调,参数为目标 blockId 与源笔记 ID。 */
  onSelect: (blockId: string, noteId: string) => void;
  /** 关闭浮层回调(Esc / 失焦 / 滚动 / 缩放)。 */
  onClose: () => void;
}

/** 块引用补全防抖时长(ms)。 */
const BLOCK_REF_SEARCH_DEBOUNCE_MS = 300;

/** 浮层内最多展示的候选块数量。 */
const MAX_RESULTS = 8;

export const BlockRefPopover: React.FC<BlockRefPopoverProps> = ({
  anchorRect,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 防抖:输入变化后 300ms 同步到 debouncedQuery 触发搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, BLOCK_REF_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const enabled = debouncedQuery.trim().length > 0;
  const { data: results, isFetching } = useBlockSearch(
    debouncedQuery,
    enabled,
  );

  // 截取前 MAX_RESULTS 项展示
  const items: BlockRefTarget[] = useMemo(() => {
    const list = results ?? [];
    return list.slice(0, MAX_RESULTS);
  }, [results]);

  // 结果变化时重置选中索引到首项
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery, items.length]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 滚动/缩放时关闭(锚点坐标已失效,对齐 WritingAssistPopover 父组件逻辑)
  useEffect(() => {
    const handleClose = () => onClose();
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [onClose]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const key = event.key;
    if (key === "ArrowDown") {
      event.preventDefault();
      if (items.length > 0) {
        setSelectedIndex((i) => (i + 1) % items.length);
      }
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      if (items.length > 0) {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
      }
      return;
    }
    if (key === "Enter") {
      event.preventDefault();
      const item = items[selectedIndex];
      if (item) {
        onSelect(item.blockId, item.noteId);
      }
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  const showSearching = isFetching && enabled;
  const showEmpty = !showSearching && enabled && items.length === 0;

  return (
    <div
      role="dialog"
      aria-label={t("notes.editor.blockRef.placeholder")}
      className="fixed z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg shadow-black/5 dark:shadow-black/30 overflow-hidden"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
    >
      {/* 输入框 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-slate-700">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("notes.editor.blockRef.placeholder")}
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none"
        />
        {showSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 dark:text-slate-500" />}
      </div>

      {/* 结果列表 */}
      <div className="max-h-[280px] overflow-y-auto">
        {showEmpty ? (
          <div className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500">
            {t("notes.editor.blockRef.noMatch")}
          </div>
        ) : (
          items.map((item, index) => {
            const isActive = index === selectedIndex;
            return (
              <button
                key={`${item.noteId}-${item.blockId}`}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => onSelect(item.blockId, item.noteId)}
                className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                  isActive
                    ? "bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60"
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-80" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">
                    {item.noteTitle}
                  </div>
                  <div className="truncate text-xs text-gray-400 dark:text-slate-500">
                    {item.blockSummary}
                  </div>
                </div>
                <span className="font-mono text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">
                  {item.blockId}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
