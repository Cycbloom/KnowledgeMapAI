/**
 * Wiki 链接补全浮层：输入 `[[` 时唤起图节点（知识点）补全。
 *
 * 数据源：api.knowledgePoints.list()，拉取用户全部知识点标题并缓存（react-query），
 * 在前端按 `[[` 后输入的查询文本做大小写不敏感的模糊匹配。
 * 选中后由父组件插入 `[节点名](wiki://节点名)` 形式的 Link 节点，
 * 落盘时由 markdownSerializer 还原为 `[[节点名]]`。
 *
 * 本组件为纯展示组件；键盘导航（上下/Enter/Esc）由父组件拦截后更新 selectedIndex。
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/services/api";
import { Loader2 } from "lucide-react";

export interface WikiLinkNodeItem {
  id: string;
  title: string;
}

export interface WikiLinkPopoverProps {
  open: boolean;
  items: WikiLinkNodeItem[];
  selectedIndex: number;
  loading: boolean;
  /** 浮层左上角坐标（相对视口，px）。 */
  position: { top: number; left: number };
  onHoverIndex: (index: number) => void;
  onSelect: (item: WikiLinkNodeItem) => void;
}

export const WikiLinkPopover: React.FC<WikiLinkPopoverProps> = ({
  open,
  items,
  selectedIndex,
  loading,
  position,
  onHoverIndex,
  onSelect,
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      role="listbox"
      aria-label={t("notes.wikiLinkPopover.title")}
      className="fixed z-50 min-w-[240px] max-w-[360px] py-1 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 shadow-lg shadow-black/5 dark:shadow-black/30 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-500 flex items-center gap-1.5">
        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        <span>{t("notes.wikiLinkPopover.placeholder")}</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {items.length === 0 && !loading ? (
          <div className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500">
            {t("notes.wikiLinkPopover.noMatch")}
          </div>
        ) : (
          items.map((item, index) => {
            const isActive = index === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => onHoverIndex(index)}
                onClick={() => onSelect(item)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  isActive
                    ? "bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300"
                    : "text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60"
                }`}
              >
                <span className="text-gray-400 dark:text-slate-500 font-mono text-xs">[[</span>
                <span className="truncate flex-1">{item.title}</span>
                <span className="text-gray-400 dark:text-slate-500 font-mono text-xs">]]</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

/** react-query 查询键：知识点标题列表（用于 wiki 链接补全）。 */
export const NODE_TITLES_QUERY_KEY = ["knowledgePoints", "titles"] as const;

/**
 * 拉取并缓存用户全部知识点（id + title），供 wiki 链接补全前端模糊匹配。
 * 仅在 popover 首次打开时触发请求；staleTime 设为 5 分钟避免频繁拉取。
 */
export const useNodeTitles = () => {
  return useQuery({
    queryKey: NODE_TITLES_QUERY_KEY,
    queryFn: async (): Promise<WikiLinkNodeItem[]> => {
      const list = await api.knowledgePoints.list();
      return list.map((kp) => ({ id: kp.id, title: kp.title }));
    },
    staleTime: 5 * 60 * 1000,
    enabled: false, // 懒加载：由父组件在首次打开 popover 时手动触发
  });
};

/**
 * 在前端按查询文本模糊匹配节点标题（不区分大小写，匹配标题子串）。
 * 返回前 limit 条结果，并优先返回以 query 开头的标题。
 */
export const filterNodeTitles = (
  nodes: WikiLinkNodeItem[],
  query: string,
  limit = 8,
): WikiLinkNodeItem[] => {
  const q = query.trim().toLowerCase();
  if (!q) return nodes.slice(0, limit);
  const matched = nodes.filter((n) => n.title.toLowerCase().includes(q));
  // 以 query 开头的优先
  matched.sort((a, b) => {
    const aStarts = a.title.toLowerCase().startsWith(q) ? 0 : 1;
    const bStarts = b.title.toLowerCase().startsWith(q) ? 0 : 1;
    return aStarts - bStarts;
  });
  return matched.slice(0, limit);
};
