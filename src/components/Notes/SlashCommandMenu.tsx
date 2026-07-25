/**
 * 斜杠命令浮层：在空行输入 `/` 时唤起的块类型选择菜单。
 *
 * 本组件为纯展示组件，由父组件（BlockEditor）通过 useSlashCommand hook
 * 控制开关、过滤后的选项、选中索引与位置。键盘上下/Enter/Esc 由父组件
 * 拦截并更新 selectedIndex（避免与编辑器自身快捷键冲突）。
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { filterBlockTypes, type BlockType } from "./blockTypes";

export { filterBlockTypes };

export interface SlashCommandMenuProps {
  open: boolean;
  items: readonly BlockType[];
  selectedIndex: number;
  /** 浮层左上角坐标（相对视口，px）。 */
  position: { top: number; left: number };
  /** 选中项变更（鼠标 hover 或键盘移动）。 */
  onHoverIndex: (index: number) => void;
  /** 确认选择某项。 */
  onSelect: (item: BlockType) => void;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  open,
  items,
  selectedIndex,
  position,
  onHoverIndex,
  onSelect,
}) => {
  const { t } = useTranslation();
  if (!open || items.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="block menu"
      className="fixed z-50 min-w-[240px] max-w-[320px] py-1 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 shadow-lg shadow-black/5 dark:shadow-black/30 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-500">
        {t("notes.editor.blockMenu.title")}
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={isActive}
              onMouseEnter={() => onHoverIndex(index)}
              onClick={() => onSelect(item)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
                isActive
                  ? "bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300"
                  : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 opacity-80" />
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
