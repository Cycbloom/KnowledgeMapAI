import React, { useState, useRef, useEffect, useId, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { useMenuNavigation } from "@/hooks";

export type SortBy = "updatedAt" | "createdAt" | "title";

interface Props {
  value: SortBy;
  onChange: (v: SortBy) => void;
  isDark: boolean;
}

const SORT_OPTIONS = [
  { value: "updatedAt", labelKey: "notes.sort.updatedAt" },
  { value: "createdAt", labelKey: "notes.sort.createdAt" },
  { value: "title", labelKey: "notes.sort.title" },
] as const satisfies readonly { value: SortBy; labelKey: string }[];

/**
 * 笔记列表排序下拉。受控组件,由父组件管理 value 与 onChange。
 * 点击按钮展开菜单,选择后回调并关闭;点击外部自动关闭。
 * 支持箭头键导航:ArrowUp/Down 循环、Home/End 首/末、Enter/Space 激活、Escape 关闭。
 */
export const NotesListSortDropdown: React.FC<Props> = ({
  value,
  onChange,
  isDark,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  // 初始激活项对齐当前选中项
  const initialIndex = Math.max(
    0,
    SORT_OPTIONS.findIndex((opt) => opt.value === value),
  );

  const handleSelect = useCallback(
    (index: number) => {
      const opt = SORT_OPTIONS[index];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    },
    [onChange],
  );

  const handleClose = useCallback(() => setOpen(false), []);

  const { activeIndex, setActiveIndex } = useMenuNavigation({
    itemCount: SORT_OPTIONS.length,
    enabled: open,
    onSelect: handleSelect,
    onClose: handleClose,
    initialIndex,
  });

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // 补充 Home/End/Space 导航（useMenuNavigation 仅支持 Arrow/Enter/Escape）
  useEffect(() => {
    if (!open) return;
    const handleExtraKeys = (e: KeyboardEvent) => {
      const optionCount = SORT_OPTIONS.length as number;
      if (optionCount === 0) return;
      switch (e.key) {
        case "Home":
          e.preventDefault();
          setActiveIndex(0);
          break;
        case "End":
          e.preventDefault();
          setActiveIndex(SORT_OPTIONS.length - 1);
          break;
        case " ":
        case "Spacebar":
          e.preventDefault();
          handleSelect(activeIndex);
          break;
      }
    };
    document.addEventListener("keydown", handleExtraKeys);
    return () => document.removeEventListener("keydown", handleExtraKeys);
  }, [open, activeIndex, setActiveIndex, handleSelect]);

  const currentLabel = String(
    t(
      SORT_OPTIONS.find((opt) => opt.value === value)?.labelKey ??
        "notes.sort.updatedAt",
    ),
  );

  const activeItemId = `${baseId}-item-${activeIndex}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        tabIndex={0}
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
          isDark
            ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={baseId}
        aria-label={t("notes.sort.label")}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>{currentLabel}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={baseId}
          className={`absolute right-0 top-full mt-1 min-w-[160px] rounded-md border shadow-lg z-30 overflow-hidden ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-gray-200"
          }`}
          role="menu"
          aria-activedescendant={activeItemId}
          tabIndex={-1}
        >
          {SORT_OPTIONS.map((opt, index) => {
            const selected = opt.value === value;
            const isKeyboardActive = index === activeIndex;
            const itemId = `${baseId}-item-${index}`;
            return (
              <button
                key={opt.value}
                id={itemId}
                type="button"
                tabIndex={-1}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-sm transition-colors ${
                  selected
                    ? isDark
                      ? "bg-primary-900/30 text-primary-300"
                      : "bg-primary-50 text-primary-700"
                    : isDark
                      ? "text-slate-300 hover:bg-slate-700"
                      : "text-gray-700 hover:bg-gray-50"
                } ${isKeyboardActive ? "ring-2 ring-inset ring-primary-500" : ""}`}
                role="menuitem"
                aria-current={selected ? "true" : undefined}
              >
                <span>{t(opt.labelKey)}</span>
                {selected && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotesListSortDropdown;
