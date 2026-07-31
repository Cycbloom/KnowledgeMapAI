import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useId,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  Command,
  FileText,
  Network,
  Sun,
  Moon,
  Settings,
  Trash2,
  Plus,
  BookOpen,
  Clock,
} from "lucide-react";
import { useTheme, useFocusTrap } from "../../hooks";
import { useCombobox } from "../../hooks/common/useCombobox";
import { frontendKernel } from "../../App";
import { iconMap } from "../../utils/iconMap";
import {
  useRecentGraphs,
  type RecentGraphEntry,
} from "../../hooks/queries/useRecentGraphs";
import { useRecentNodes } from "../../hooks/queries/useRecentNodes";
import { useRecentNotes } from "../../hooks/queries/useRecentNotes";

export interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type CommandCategory = "navigation" | "recent" | "action";
type RecentSubGroup = "graph" | "node" | "note";

interface CommandItem {
  id: string;
  label: string;
  category: CommandCategory;
  recentSubGroup?: RecentSubGroup;
  keywords?: string;
  icon?: React.ReactNode;
  action: () => void;
}

const ORDERED_CATEGORIES: CommandCategory[] = [
  "navigation",
  "recent",
  "action",
];

const ORDERED_RECENT_SUBGROUPS: RecentSubGroup[] = ["graph", "node", "note"];

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({
  isOpen,
  onClose,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

  // ARIA id 生成：baseId 派生 titleId / listboxId / option id
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const listboxId = `${baseId}-listbox`;
  const getOptionId = useCallback(
    (index: number) => `${baseId}-option-${index}`,
    [baseId],
  );

  const categoryLabels: Record<CommandCategory, string> = {
    navigation: t("common.globalCommandPalette.categoryNavigation"),
    recent: t("common.globalCommandPalette.categoryRecent"),
    action: t("common.globalCommandPalette.categoryAction"),
  };

  const recentSubGroupLabels: Record<RecentSubGroup, string> = {
    graph: t("common.globalCommandPalette.recentGraph"),
    node: t("common.globalCommandPalette.recentNode"),
    note: t("common.globalCommandPalette.recentNote"),
  };

  const { getRecentGraphs } = useRecentGraphs();
  const { recentNodes } = useRecentNodes();
  const { recentNotes } = useRecentNotes();

  const handleClose = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  // 聚合所有命令项：导航（来自 kernel）+ 最近项（图谱/节点/笔记）+ 快速操作
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // navigation：从 frontendKernel.getNavItems() 动态获取
    const navItems = frontendKernel
      .getNavItems()
      .filter(
        (item) => item.category === "main" || item.category === "more",
      );
    navItems.forEach((item) => {
      const Icon =
        (item.icon ? iconMap[item.icon] : undefined) ?? BookOpen;
      items.push({
        id: `nav-${item.path}`,
        label: t(item.label),
        category: "navigation",
        icon: <Icon size={16} />,
        keywords: item.path,
        action: () => navigate(item.path),
      });
    });

    // recent - 最近图谱
    const recentGraphs: RecentGraphEntry[] = getRecentGraphs();
    recentGraphs.forEach((graph) => {
      items.push({
        id: `recent-graph-${graph.id}`,
        label: graph.topic || t("common.globalCommandPalette.untitledGraph"),
        category: "recent",
        recentSubGroup: "graph",
        icon: <Network size={16} />,
        keywords: graph.id,
        action: () => navigate(`/graph/${graph.id}`),
      });
    });

    // recent - 最近节点
    recentNodes.forEach((node) => {
      items.push({
        id: `recent-node-${node.id}`,
        label: node.title || t("common.globalCommandPalette.untitledNode"),
        category: "recent",
        recentSubGroup: "node",
        icon: <FileText size={16} />,
        keywords: `${node.graphTopic ?? ""} ${node.graphId ?? ""}`,
        action: () =>
          navigate(`/graph/${node.graphId}?node_id=${node.id}`),
      });
    });

    // recent - 最近笔记
    recentNotes.forEach((note) => {
      items.push({
        id: `recent-note-${note.id}`,
        label: note.title || t("common.globalCommandPalette.untitledNote"),
        category: "recent",
        recentSubGroup: "note",
        icon: <FileText size={16} />,
        keywords: note.id,
        action: () => navigate(`/notes/${note.id}`),
      });
    });

    // action - 快速操作
    items.push({
      id: "action-new-graph",
      label: t("common.globalCommandPalette.actionNewGraph"),
      category: "action",
      icon: <Plus size={16} />,
      keywords: t("common.globalCommandPalette.actionNewGraphKeywords"),
      action: () => navigate("/"),
    });
    items.push({
      id: "action-toggle-theme",
      label: t("common.globalCommandPalette.actionToggleTheme"),
      category: "action",
      icon: isDark ? <Sun size={16} /> : <Moon size={16} />,
      keywords: t("common.globalCommandPalette.actionToggleThemeKeywords"),
      action: () => toggleTheme(),
    });
    items.push({
      id: "action-settings",
      label: t("common.globalCommandPalette.actionSettings"),
      category: "action",
      icon: <Settings size={16} />,
      keywords: t("common.globalCommandPalette.actionSettingsKeywords"),
      action: () => navigate("/settings"),
    });
    items.push({
      id: "action-trash",
      label: t("common.globalCommandPalette.actionTrash"),
      category: "action",
      icon: <Trash2 size={16} />,
      keywords: t("common.globalCommandPalette.actionTrashKeywords"),
      action: () => navigate("/trash"),
    });

    return items;
  }, [
    t,
    navigate,
    getRecentGraphs,
    recentNodes,
    recentNotes,
    isDark,
    toggleTheme,
    isOpen,
  ]);

  // 过滤：大小写不敏感匹配 label 和 keywords
  const filteredCommands = useMemo<CommandItem[]>(() => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return commands;
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        (cmd.keywords?.toLowerCase().includes(lowerQuery) ?? false),
    );
  }, [commands, query]);

  // 接入 useCombobox hook：管理活动项索引与键盘导航
  const {
    activeIndex,
    setActiveIndex,
    activeId,
    handleKeyDown,
    resetActive,
  } = useCombobox<CommandItem>({
    options: filteredCommands,
    isOpen: true, // 下拉在面板打开期间始终展开
    setIsOpen: () => {}, // 面板开关由父组件控制，hook 无需操作
    onSelect: (cmd) => {
      cmd.action();
      handleClose();
    },
    getOptionId,
    getOptionLabel: (cmd) => cmd.label,
    enabled: isOpen,
  });

  // 默认活动项：保留"首项预选中"的既有 UX
  const safeActiveIndex = activeIndex ?? 0;

  // 查询变化或打开时，定位首项（保留"首项预选中"的既有 UX）
  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(filteredCommands.length > 0 ? 0 : null);
  }, [isOpen, query, setActiveIndex, filteredCommands.length]);

  // 打开时自动聚焦输入框；关闭时重置活动项
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    resetActive();
  }, [isOpen, resetActive]);

  // 选中项滚动到可视区域
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-cmd-index="${safeActiveIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [safeActiveIndex]);

  // Escape 需关闭整个面板（hook 仅关闭 listbox），单独拦截后委托给 hook
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
      return;
    }
    handleKeyDown(e.nativeEvent);
  };

  if (!isOpen) return null;

  const renderCommandButton = (cmd: CommandItem, globalIndex: number) => {
    const isSelected = globalIndex === safeActiveIndex;
    return (
      <button
        key={cmd.id}
        data-cmd-index={globalIndex}
        role="option"
        id={getOptionId(globalIndex)}
        aria-selected={isSelected}
        onClick={() => {
          cmd.action();
          handleClose();
        }}
        onMouseEnter={() => setActiveIndex(globalIndex)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          isSelected
            ? isDark
              ? "bg-primary-600 text-white"
              : "bg-primary-500 text-white"
            : isDark
              ? "text-slate-300 hover:bg-slate-800"
              : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="shrink-0">{cmd.icon ?? <Command size={16} />}</span>
        <span className="truncate text-left">{cmd.label}</span>
      </button>
    );
  };

  // 按 category 分组渲染，recent 内部再按 subGroup 分组
  // runningIndex 与 filteredCommands 的全局索引对齐（顺序一致）
  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={t("common.globalCommandPalette.ariaLabel")}
        className={`relative w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col transform transition-all duration-200 scale-100 opacity-100 ${
          isDark
            ? "bg-slate-900 border border-slate-700 text-white"
            : "bg-white border border-gray-200 text-gray-900"
        }`}
      >
        {/* 对话框标题（仅供 aria-labelledby 引用，视觉隐藏） */}
        <h2 id={titleId} className="sr-only">
          {t("common.globalCommandPalette.ariaLabel")}
        </h2>

        {/* Search Input */}
        <div
          className={`flex items-center px-4 py-3 border-b ${
            isDark ? "border-slate-800" : "border-gray-100"
          }`}
        >
          <Search
            className={`w-5 h-5 mr-3 ${isDark ? "text-slate-400" : "text-gray-400"}`}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={t('common.aria.search')}
            aria-autocomplete="list"
            aria-expanded={true}
            aria-controls={listboxId}
            aria-activedescendant={activeId}
            className="flex-1 bg-transparent text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder={t("common.globalCommandPalette.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          <kbd
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${
              isDark
                ? "bg-slate-800 border-slate-700 text-slate-400"
                : "bg-gray-100 border-gray-200 text-gray-500"
            }`}
          >
            <span className="text-xs">Esc</span>
          </kbd>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          role="listbox"
          id={listboxId}
          aria-labelledby={titleId}
          className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-gray-500 dark:text-slate-400">
              <p>{t("common.globalCommandPalette.noMatch")}</p>
            </div>
          ) : (
            ORDERED_CATEGORIES.map((category) => {
              const categoryItems = filteredCommands.filter(
                (c) => c.category === category,
              );
              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="mb-2 last:mb-0">
                  <div
                    className={`px-2 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                      isDark ? "text-slate-500" : "text-gray-400"
                    }`}
                  >
                    {categoryLabels[category]}
                  </div>

                  {category === "recent" ? (
                    ORDERED_RECENT_SUBGROUPS.map((subGroup) => {
                      const subItems = categoryItems.filter(
                        (c) => c.recentSubGroup === subGroup,
                      );
                      if (subItems.length === 0) return null;
                      return (
                        <div key={`recent-${subGroup}`} className="mb-1">
                          <div
                            className={`flex items-center gap-1 px-2 py-1 text-[11px] ${
                              isDark ? "text-slate-500" : "text-gray-400"
                            }`}
                          >
                            <Clock size={10} aria-hidden="true" />
                            <span>
                              {recentSubGroupLabels[subGroup]}
                            </span>
                          </div>
                          {subItems.map((cmd) => {
                            const idx = runningIndex++;
                            return renderCommandButton(cmd, idx);
                          })}
                        </div>
                      );
                    })
                  ) : (
                    categoryItems.map((cmd) => {
                      const idx = runningIndex++;
                      return renderCommandButton(cmd, idx);
                    })
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-4 py-2 border-t text-[10px] flex justify-between ${
            isDark
              ? "bg-slate-800/50 border-slate-800 text-slate-500"
              : "bg-gray-50 border-gray-100 text-gray-400"
          }`}
        >
          <div className="flex gap-3">
            <span>{t("common.globalCommandPalette.footerNavigate")}</span>
            <span>{t("common.globalCommandPalette.footerSelect")}</span>
            <span>{t("common.globalCommandPalette.footerClose")}</span>
          </div>
          <div>{t("common.globalCommandPalette.footerTitle")}</div>
        </div>
      </div>
    </div>
  );
};
