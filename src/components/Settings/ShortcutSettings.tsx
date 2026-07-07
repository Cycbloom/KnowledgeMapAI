import React from "react";
import { ShortcutListContent } from "../common";

/**
 * 快捷键设置分段。
 *
 * 在 Settings 页面内嵌渲染 `ShortcutListContent`，不传 `onClose`（内嵌形态无需关闭按钮）。
 * 通过 className 限定最大高度并附加卡片样式，使内部列表可独立滚动。
 */
export const ShortcutSettings = React.memo(function ShortcutSettings() {
  return (
    <ShortcutListContent className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden max-h-[70vh]" />
  );
});
