import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, ChevronDown, Check } from "lucide-react";

export type SortBy = "updatedAt" | "createdAt" | "title";

interface Props {
  value: SortBy;
  onChange: (v: SortBy) => void;
  isDark: boolean;
}

const SORT_OPTIONS: { value: SortBy; labelKey: string }[] = [
  { value: "updatedAt", labelKey: "notes.sort.updatedAt" },
  { value: "createdAt", labelKey: "notes.sort.createdAt" },
  { value: "title", labelKey: "notes.sort.title" },
];

/**
 * 笔记列表排序下拉。受控组件,由父组件管理 value 与 onChange。
 * 点击按钮展开菜单,选择后回调并关闭;点击外部自动关闭。
 */
export const NotesListSortDropdown: React.FC<Props> = ({
  value,
  onChange,
  isDark,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const currentLabel = String(
    t(
      (SORT_OPTIONS.find((opt) => opt.value === value)?.labelKey ??
        "notes.sort.updatedAt") as never,
    ),
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors border ${
          isDark
            ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("notes.sort.label")}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>{currentLabel}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-1 min-w-[160px] rounded-md border shadow-lg z-30 overflow-hidden ${
            isDark
              ? "bg-slate-800 border-slate-700"
              : "bg-white border-gray-200"
          }`}
          role="menu"
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 flex items-center justify-between text-sm transition-colors ${
                  active
                    ? isDark
                      ? "bg-primary-900/30 text-primary-300"
                      : "bg-primary-50 text-primary-700"
                    : isDark
                      ? "text-slate-300 hover:bg-slate-700"
                      : "text-gray-700 hover:bg-gray-50"
                }`}
                role="menuitem"
                aria-pressed={active}
              >
                <span>{t(opt.labelKey as never)}</span>
                {active && <Check size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotesListSortDropdown;
