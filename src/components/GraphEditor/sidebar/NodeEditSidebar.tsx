import React, { useState, useRef, useMemo, useEffect, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import { Node as GraphNode, NodeLevel } from "../../../types";
import { getLevelColor, getLevelLabel } from "../../../utils/graph/graphUtils";
import {
  X,
  ArrowLeft,
  Loader2,
  Search,
  ChevronDown,
  Circle,
  MousePointer2,
  Check,
  Bold,
  Italic,
  Heading,
  Link as LinkIcon,
  Code,
  Eye,
  Pencil,
  FileText,
} from "lucide-react";
import { useTheme, useIsMobile, useAutoSave, useBeforeUnload } from "../../../hooks";
import { BACKBONE_MODULE_LABEL_I18N_KEYS, type BackboneModule } from "@shared/types/graph";
import { BackboneNodeIcon } from "../BackboneNodeIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { preprocessMarkdown } from "../../../utils/markdownPreprocessor";
import { preprocessWikiLinks, WikiLinkRenderer } from "../../../utils/wikiLinkRemarkPlugin";
import { backlinksApi } from "../../../services/api/backlinks";
import { NodeLinkSelector } from "./NodeLinkSelector";
import { BacklinksPanel } from "./BacklinksPanel";
import { NotesPanel } from "../../Notes/NotesPanel";
import { NodeBlockRefsPanel } from "../../Notes/NodeBlockRefsPanel";
import { EmptyState, ErrorBoundary } from "../../common";
import { SaveButton } from "../../common/SaveButton";
import { asyncConfirm } from "@/utils/asyncConfirm";

interface NodeFormState {
  title: string;
  content: string;
  summary: string;
  parentNodeIds: string[];
  level: NodeLevel;
  tags: string[];
}

interface NodeEditSidebarProps {
  mode: "create" | "edit";
  nodeForm: NodeFormState;
  setNodeForm: (form: NodeFormState) => void;
  onSave: (options?: { exitToDetail?: boolean }) => void;
  onClose: () => void;
  onBack: () => void;
  prevSidebarMode: "none" | "create" | "edit" | "outline" | "detail";
  loading: boolean;
  nodes: GraphNode[];
  currentNodeId?: string;
  isSelectingParent?: boolean;
  onStartSelectingParent?: () => void;
  onCancelSelectingParent?: () => void;
  /** 当前图谱 ID（用于双链搜索与反向链接同图谱判断） */
  graphId?: string;
  /** 点击 wiki 链接或反向链接项时跳转节点 */
  onNavigateToNode?: (knowledgePointId: string, graphId?: string) => void;
}

/**
 * 通过 mirror div 技术计算 textarea 中指定位置光标的相对坐标。
 * 返回相对 textarea 内容区左上角的像素坐标（不含 padding 外的边框）。
 */
const CARET_COPY_STYLES = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

const getCaretCoordinates = (
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number } => {
  const div = document.createElement("div");
  const styles = window.getComputedStyle(textarea);
  const sourceStyle = styles as unknown as Record<string, string>;
  const targetStyle = div.style as unknown as Record<string, string>;
  CARET_COPY_STYLES.forEach((prop) => {
    targetStyle[prop] = sourceStyle[prop];
  });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";

  const textBefore = textarea.value.substring(0, position);
  div.textContent = textBefore;

  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position) || ".";
  div.appendChild(span);

  document.body.appendChild(div);

  // 计算滚动偏移
  const top = span.offsetTop - textarea.scrollTop;
  const left = span.offsetLeft - textarea.scrollLeft;

  document.body.removeChild(div);
  return { top, left };
};

/**
 * 判断光标前是否在代码块内（简单统计 ``` 出现次数，奇数即在内）
 */
const isInsideCodeBlock = (textBeforeCursor: string): boolean => {
  const codeFenceCount = (textBeforeCursor.match(/```/g) ?? []).length;
  return codeFenceCount % 2 === 1;
};

export const NodeEditSidebar: React.FC<NodeEditSidebarProps> = ({
  mode,
  nodeForm,
  setNodeForm,
  onSave,
  onClose,
  onBack,
  prevSidebarMode,
  loading,
  nodes,
  currentNodeId,
  isSelectingParent = false,
  onStartSelectingParent,
  onCancelSelectingParent,
  graphId,
  onNavigateToNode,
}) => {
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const { t } = useTranslation();
  // 表单字段可访问性：通过 useId 生成唯一 id，供 label htmlFor 关联控件
  const titleId = useId();
  const summaryId = useId();
  const parentSearchId = useId();
  const tagsId = useId();
  const levelId = useId();
  const contentId = useId();
  const [parentSearch, setParentSearch] = useState("");
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [contentViewMode, setContentViewMode] = useState<"edit" | "preview">("edit");
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  // 双链 [[ 触发器状态
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [linkSelectorPosition, setLinkSelectorPosition] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  // 内容 / 反向链接 / 关联笔记 Tab 切换
  const [contentTab, setContentTab] = useState<
    "content" | "backlinks" | "notes"
  >("content");

  // Auto-save: debounced save via useAutoSave hook.
  // onSave returns void, so we bridge the loading prop to track completion:
  // the promise resolves when loading transitions back to false.
  const loadingRef = useRef(loading);
  const pendingSaveResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadingRef.current = loading;
    if (!loading && pendingSaveResolveRef.current) {
      const resolve = pendingSaveResolveRef.current;
      pendingSaveResolveRef.current = null;
      resolve();
    }
  }, [loading]);

  // 清理父级选择器 blur 延迟定时器，避免卸载后 setState
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleAutoSave = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!loadingRef.current) {
        onSave({ exitToDetail: false });
      }
      pendingSaveResolveRef.current = resolve;
    });
  }, [onSave]);

  const { status: autoSaveStatus, reset: resetAutoSave } = useAutoSave<NodeFormState>({
    value: nodeForm,
    onSave: handleAutoSave,
    delay: 3000,
    enabled: !!nodeForm.title.trim() && mode === "edit",
  });

  // Reset status to idle after showing "saved" for 1500ms (preserve original UX)
  useEffect(() => {
    if (autoSaveStatus === "saved") {
      const timer = setTimeout(() => {
        resetAutoSave();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoSaveStatus, resetAutoSave]);

  // Warn user before leaving when there are unsaved changes (saving or save failed)
  useBeforeUnload(
    autoSaveStatus === "saving" || autoSaveStatus === "error",
    t("common.unsavedChanges"),
  );

  // Manual save: cancel pending auto-save and save with exitToDetail.
  // Returns a Promise<void> that resolves when loading transitions back to
  // false (via the loadingRef effect above), enabling SaveButton's success state.
  const handleManualSave = useCallback((): Promise<void> => {
    pendingSaveResolveRef.current = null;
    resetAutoSave();
    return new Promise<void>((resolve) => {
      onSave({ exitToDetail: true });
      pendingSaveResolveRef.current = resolve;
    });
  }, [onSave, resetAutoSave]);

  const currentNode = useMemo(() => {
    return currentNodeId ? nodes.find((n) => n.id === currentNodeId) : null;
  }, [nodes, currentNodeId]);

  const backboneModule = currentNode?.properties?.backboneModule as
    | BackboneModule
    | undefined;
  const isBackboneNode = !!backboneModule;

  const selectedParents = useMemo(() => {
    const parentIdSet = new Set(nodeForm.parentNodeIds);
    return nodes.filter((n) => parentIdSet.has(n.id));
  }, [nodes, nodeForm.parentNodeIds]);

  const filteredNodes = useMemo(() => {
    const search = parentSearch.toLowerCase();
    return nodes
      .filter((n) => {
        if (currentNodeId && n.id === currentNodeId) return false;
        if (!search) return true;
        return n.title.toLowerCase().includes(search);
      })
      .sort((a, b) => {
        const levelOrder = { root: 0, core: 1, sub: 2, normal: 3, leaf: 4 };
        const levelA = levelOrder[a.level || "normal"] ?? 3;
        const levelB = levelOrder[b.level || "normal"] ?? 3;
        return levelA - levelB;
      });
  }, [nodes, parentSearch, currentNodeId]);

  // 预构建父节点 id 集合，避免渲染列表时对每个节点线性 includes（原为 O(filteredNodes*parentNodeIds)）
  const parentNodeIdSet = useMemo(
    () => new Set(nodeForm.parentNodeIds),
    [nodeForm.parentNodeIds],
  );

  const toggleParent = (nodeId: string) => {
    const currentIds = nodeForm.parentNodeIds;
    if (currentIds.includes(nodeId)) {
      setNodeForm({
        ...nodeForm,
        parentNodeIds: currentIds.filter((id) => id !== nodeId),
      });
    } else {
      setNodeForm({ ...nodeForm, parentNodeIds: [...currentIds, nodeId] });
    }
    setParentSearch("");
    setShowParentDropdown(true);
  };

  const handleParentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParentSearch(e.target.value);
    setShowParentDropdown(true);
  };

  const handleParentInputFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setShowParentDropdown(true);
  };

  const handleParentInputBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setShowParentDropdown(false);
    }, 150);
  };

  const removeParent = (nodeId: string) => {
    setNodeForm({
      ...nodeForm,
      parentNodeIds: nodeForm.parentNodeIds.filter((id) => id !== nodeId),
    });
    setParentSearch("");
  };

  const handleRemoveParent = async (parentId: string) => {
    const confirmed = await asyncConfirm({
      title: t("graphEditor.nodeEditSidebar.confirmRemoveParentTitle"),
      message: t("graphEditor.nodeEditSidebar.confirmRemoveParentMessage"),
      isDangerous: true,
    });
    if (!confirmed) return;
    removeParent(parentId);
  };

  const clearAllParents = () => {
    setNodeForm({ ...nodeForm, parentNodeIds: [] });
    setParentSearch("");
    inputRef.current?.focus();
  };

  // Markdown formatting helpers: wrap selected text or insert at cursor.
  const wrapSelection = useCallback(
    (before: string, after: string, placeholder: string) => {
      const textarea = contentTextareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = nodeForm.content;
      const selected = value.slice(start, end) || placeholder;
      const newValue =
        value.slice(0, start) + before + selected + after + value.slice(end);
      setNodeForm({ ...nodeForm, content: newValue });
      requestAnimationFrame(() => {
        textarea.focus();
        const selStart = start + before.length;
        textarea.setSelectionRange(selStart, selStart + selected.length);
      });
    },
    [nodeForm, setNodeForm],
  );

  const insertAtLineStart = useCallback(
    (prefix: string) => {
      const textarea = contentTextareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = nodeForm.content;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      setNodeForm({ ...nodeForm, content: newValue });
      requestAnimationFrame(() => {
        textarea.focus();
        const offset = prefix.length;
        textarea.setSelectionRange(start + offset, end + offset);
      });
    },
    [nodeForm, setNodeForm],
  );

  const handleBold = useCallback(
    () => wrapSelection("**", "**", t("graphEditor.nodeEditSidebar.placeholder.bold")),
    [wrapSelection, t],
  );
  const handleItalic = useCallback(
    () => wrapSelection("*", "*", t("graphEditor.nodeEditSidebar.placeholder.italic")),
    [wrapSelection, t],
  );
  const handleHeading = useCallback(() => insertAtLineStart("## "), [insertAtLineStart]);
  const handleLink = useCallback(
    () =>
      wrapSelection("[", "](https://)", t("graphEditor.nodeEditSidebar.placeholder.link")),
    [wrapSelection, t],
  );
  const handleCodeBlock = useCallback(
    () => wrapSelection("```\n", "\n```", t("graphEditor.nodeEditSidebar.placeholder.code")),
    [wrapSelection, t],
  );

  // 双链 [[ 触发检测 + 内容变更处理
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setNodeForm({ ...nodeForm, content: newValue });

      const textarea = e.target;
      const cursorPos = textarea.selectionStart;
      const beforeCursor = newValue.slice(0, cursorPos);
      const lastTwo = beforeCursor.slice(-2);

      if (lastTwo === "[[" && !isInsideCodeBlock(beforeCursor.slice(0, -2))) {
        // 检测到 [[ 且不在代码块内，计算光标坐标并弹出选择器
        const caretCoords = getCaretCoordinates(textarea, cursorPos);
        const rect = textarea.getBoundingClientRect();
        setLinkSelectorPosition({
          top: rect.top + caretCoords.top + 20,
          left: Math.min(
            rect.left + caretCoords.left,
            window.innerWidth - 340,
          ),
        });
        setShowLinkSelector(true);
      } else {
        setShowLinkSelector(false);
      }
    },
    [nodeForm, setNodeForm],
  );

  // 选中节点标题后，将 [[ 替换为 [[title]] 并移动光标到 ]] 之后
  const handleLinkSelect = useCallback(
    (title: string) => {
      const textarea = contentTextareaRef.current;
      if (!textarea) {
        setShowLinkSelector(false);
        return;
      }
      const cursorPos = textarea.selectionStart;
      const value = nodeForm.content;
      const bracketPos = value.lastIndexOf("[[", cursorPos);
      if (bracketPos === -1) {
        setShowLinkSelector(false);
        return;
      }
      const replacement = `[[${title}]]`;
      const newValue =
        value.slice(0, bracketPos) + replacement + value.slice(cursorPos);
      setNodeForm({ ...nodeForm, content: newValue });
      setShowLinkSelector(false);
      requestAnimationFrame(() => {
        textarea.focus();
        const newCursorPos = bracketPos + replacement.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [nodeForm, setNodeForm],
  );

  // 预览模式下点击 wiki 链接：搜索节点并跳转
  const handleWikiLinkClick = useCallback(
    async (title: string) => {
      try {
        const hits = await backlinksApi.search(title, {
          graphId,
          limit: 1,
        });
        const hit = hits[0];
        if (hit) {
          onNavigateToNode?.(hit.id, hit.graphIds[0]);
        } else {
          console.warn(t("graphEditor.backlinks.notFound"), title);
        }
      } catch {
        console.warn(t("graphEditor.backlinks.notFound"), title);
      }
    },
    [graphId, onNavigateToNode, t],
  );

  const getLevelBadgeStyle = (level: NodeLevel, isDark: boolean = false) => {
    const styles = {
      root: isDark
        ? "bg-primary-900/50 text-primary-300 border-primary-700"
        : "bg-primary-100 text-primary-700 border-primary-200",
      core: isDark
        ? "bg-red-900/50 text-red-300 border-red-700"
        : "bg-red-100 text-red-700 border-red-200",
      sub: isDark
        ? "bg-orange-900/50 text-orange-300 border-orange-700"
        : "bg-orange-100 text-orange-700 border-orange-200",
      normal: isDark
        ? "bg-primary-900/50 text-primary-300 border-primary-700"
        : "bg-primary-100 text-primary-700 border-primary-200",
      leaf: isDark
        ? "bg-green-900/50 text-green-300 border-green-700"
        : "bg-green-100 text-green-700 border-green-200",
    };
    return styles[level] || styles.normal;
  };

  return (
    <div
      className={`h-full flex flex-col ${isMobile ? "pb-[env(safe-area-inset-bottom)]" : ""}`}
    >
      <div
        className={`flex justify-between items-center ${isMobile ? "mb-4 px-1" : "mb-6"}`}
      >
        <div className="flex items-center space-x-2">
          {prevSidebarMode === "outline" && (
            <button
              onClick={onBack}
              className={`text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-all ${isMobile ? "mr-2 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center" : "mr-1 p-1.5"}`}
              title={t("graphEditor.nodeEditSidebar.backToOutline")}
              aria-label={t("graphEditor.nodeEditSidebar.backToOutline")}
            >
              <ArrowLeft size={isMobile ? 20 : 18} aria-hidden="true" />
            </button>
          )}
          <div
            className={`w-3 h-3 rounded-full ${mode === "create" ? "bg-green-500" : "bg-primary-500"}`}
          ></div>
          <h3
            className="font-bold text-gray-800 dark:text-gray-100 text-base sm:text-lg md:text-xl"
          >
            {mode === "create"
              ? t("graphEditor.nodeEditSidebar.headerCreate")
              : t("graphEditor.nodeEditSidebar.headerEdit")}
          </h3>
        </div>
        <button
          onClick={onClose}
          className={`text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg ${isMobile ? "p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center" : ""}`}
          aria-label={t("common.aria.close")}
        >
          <X size={isMobile ? 22 : 20} aria-hidden="true" />
        </button>
      </div>

      {isSelectingParent && (
        <div
          className={`mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg ${isMobile ? "mx-1" : ""}`}
        >
          <div
            className={`flex items-center ${isMobile ? "flex-col gap-2" : "justify-between"}`}
          >
            <div className="flex items-center gap-2">
              <MousePointer2
                size={16}
                className="text-amber-600 dark:text-amber-400 animate-pulse"
              />
              <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                {t("graphEditor.nodeEditSidebar.selectParentHint")}
              </span>
            </div>
            <button
              onClick={onCancelSelectingParent}
              className={`bg-amber-100 dark:bg-amber-800 hover:bg-amber-200 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-200 rounded transition-colors ${isMobile ? "w-full py-2.5 min-h-[44px] text-sm font-medium" : "px-2 py-1 text-xs"}`}
            >
              {t("graphEditor.nodeEditSidebar.selectParentDone")}
            </button>
          </div>
        </div>
      )}

      {/* 内容 / 反向链接 / 关联笔记 Tab 切换器（仅编辑模式显示） */}
      {mode === "edit" && (
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 mb-4">
          <button
            type="button"
            onClick={() => setContentTab("content")}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              contentTab === "content"
                ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t("graphEditor.nodeEditSidebar.tabContent")}
          </button>
          <button
            type="button"
            onClick={() => setContentTab("backlinks")}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              contentTab === "backlinks"
                ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t("graphEditor.nodeEditSidebar.tabBacklinks")}
          </button>
          <button
            type="button"
            onClick={() => setContentTab("notes")}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              contentTab === "notes"
                ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t("graphEditor.nodeEditSidebar.tabNotes")}
          </button>
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto ${isMobile ? "space-y-5 px-1 pb-32" : "space-y-4 pr-1"}`}
      >
        {mode === "edit" && contentTab === "backlinks" ? (
          <ErrorBoundary variant="panel">
            <BacklinksPanel
              knowledgePointId={currentNodeId}
              currentGraphId={graphId}
              onNavigateToNode={onNavigateToNode}
            />
          </ErrorBoundary>
        ) : mode === "edit" && contentTab === "notes" ? (
          <div className="space-y-4">
            <ErrorBoundary variant="panel">
              <NotesPanel nodeId={currentNodeId} graphId={graphId} />
            </ErrorBoundary>
            {/* P3 Task 10.1: 引用此节点的块(块级反向链接) */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {t("notes.blockRefsPanel.nodeTitle")}
              </h4>
              <ErrorBoundary variant="panel">
                <NodeBlockRefsPanel nodeId={currentNodeId} />
              </ErrorBoundary>
            </div>
          </div>
        ) : (
          <>
        <div>
          <label
            htmlFor={titleId}
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            {t("graphEditor.nodeEditSidebar.field.title")}
            {isBackboneNode && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                {t("graphEditor.nodeEditSidebar.backboneBadge")}
              </span>
            )}
          </label>
          {isBackboneNode && backboneModule && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <BackboneNodeIcon module={backboneModule} size="small" />
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                {t("graphEditor.nodeEditSidebar.backboneImmutable", {
                  module: t(BACKBONE_MODULE_LABEL_I18N_KEYS[backboneModule]),
                })}
              </span>
            </div>
          )}
          <input
            id={titleId}
            type="text"
            autoComplete="off"
            value={nodeForm.title}
            onChange={(e) =>
              setNodeForm({ ...nodeForm, title: e.target.value })
            }
            readOnly={isBackboneNode}
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2"} ${isBackboneNode ? "cursor-not-allowed opacity-75" : ""}`}
            placeholder={t("graphEditor.nodeEditSidebar.field.titlePlaceholder")}
          />
        </div>

        <div>
          <label
            htmlFor={summaryId}
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            {t("graphEditor.nodeEditSidebar.field.summary")}
            <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">
              {t("graphEditor.nodeEditSidebar.field.summaryHint")}
            </span>
          </label>
          <input
            id={summaryId}
            type="text"
            autoComplete="off"
            value={nodeForm.summary}
            onChange={(e) =>
              setNodeForm({ ...nodeForm, summary: e.target.value })
            }
            maxLength={200}
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2 text-sm"}`}
            placeholder={t("graphEditor.nodeEditSidebar.field.summaryPlaceholder")}
          />
        </div>

        <div className="relative" ref={dropdownRef}>
          <label
            htmlFor={parentSearchId}
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            {t("graphEditor.nodeEditSidebar.field.parent")}
          </label>

          <div className={`flex gap-2 ${isMobile ? "flex-col" : ""}`}>
            <div
              role="search"
              aria-label={t('common.aria.searchWithTarget', { target: t('graphEditor.nodeEditSidebar.field.parent') })}
              className={`relative ${isMobile ? "w-full" : "flex-1"}`}
            >
              <div
                className={`absolute text-gray-400 z-10 ${isMobile ? "left-4 top-1/2 -translate-y-1/2" : "left-3 top-1/2 -translate-y-1/2"}`}
              >
                <Search size={isMobile ? 18 : 16} />
              </div>
              <input
                id={parentSearchId}
                ref={inputRef}
                type="text"
                autoComplete="off"
                value={parentSearch}
                onChange={handleParentInputChange}
                onFocus={handleParentInputFocus}
                onBlur={handleParentInputBlur}
                className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "pl-11 pr-10 py-3 min-h-[44px] text-base" : "pl-9 pr-8 py-2"}`}
                placeholder={t("graphEditor.nodeEditSidebar.field.parentPlaceholder")}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${isMobile ? "right-3" : "right-2"}`}
              >
                {nodeForm.parentNodeIds.length > 0 && (
                  <button
                    onClick={clearAllParents}
                    className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${isMobile ? "p-1.5 min-h-[36px] min-w-[36px]" : "p-1"}`}
                    title={t("graphEditor.nodeEditSidebar.field.clearAll")}
                    aria-label={t("graphEditor.nodeEditSidebar.field.clearAll")}
                  >
                    <X size={isMobile ? 16 : 14} aria-hidden="true" />
                  </button>
                )}
                <button
                  onClick={() => setShowParentDropdown(!showParentDropdown)}
                  className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${isMobile ? "p-1.5 min-h-[36px] min-w-[36px]" : "p-1"}`}
                  aria-label={showParentDropdown ? t("common.aria.collapse") : t("common.aria.expand")}
                >
                  <ChevronDown
                    size={isMobile ? 16 : 14}
                    className={`transition-transform ${showParentDropdown ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>

              {showParentDropdown && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className={`absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-y-auto ${isMobile ? "max-h-[50vh]" : "max-h-60"}`}
                >
                  <button
                    onClick={clearAllParents}
                    className={`w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 ${
                      nodeForm.parentNodeIds.length === 0
                        ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                        : "text-gray-600 dark:text-gray-300"
                    } ${isMobile ? "px-4 py-3.5 min-h-[48px]" : "px-3 py-2.5"}`}
                  >
                    <Circle size={12} className="text-gray-400" />
                    <span className={`${isMobile ? "text-base" : "text-sm"}`}>
                      {t("graphEditor.nodeEditSidebar.field.noParent")}
                    </span>
                  </button>

                  {filteredNodes.length === 0 ? (
                    <div
                      className={`text-center text-gray-400 dark:text-gray-500 ${isMobile ? "px-4 py-5 text-base" : "px-3 py-4 text-sm"}`}
                    >
                      {parentSearch
                        ? t("graphEditor.nodeEditSidebar.field.noMatchingNodes")
                        : t("graphEditor.nodeEditSidebar.field.noAvailableNodes")}
                    </div>
                  ) : (
                    filteredNodes.map((node) => {
                      const isSelected = parentNodeIdSet.has(node.id);
                      return (
                        <button
                          key={node.id}
                          onClick={() => toggleParent(node.id)}
                          className={`w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${
                            isSelected
                              ? "bg-primary-50 dark:bg-primary-900/30"
                              : ""
                          } ${isMobile ? "px-4 py-3.5 min-h-[48px]" : "px-3 py-2.5"}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? "bg-primary-500 border-primary-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {isSelected && (
                                <Check size={10} className="text-white" />
                              )}
                            </div>
                            <div
                              className={`w-2 h-2 rounded-full ${getLevelColor(node.level || "normal")}`}
                            ></div>
                            <span
                              className={`truncate text-gray-800 dark:text-gray-200 ${isMobile ? "text-base" : "text-sm"}`}
                            >
                              {node.title}
                            </span>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded border flex-shrink-0 ${getLevelBadgeStyle(node.level || "normal", isDark)} text-xs`}
                          >
                            {getLevelLabel(node.level || "normal")}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={
                isSelectingParent
                  ? onCancelSelectingParent
                  : onStartSelectingParent
              }
              className={`rounded-lg border transition-all ${
                isSelectingParent
                  ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400"
                  : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-primary-500 hover:border-primary-300"
              } ${isMobile ? "w-full py-3 min-h-[48px] flex items-center justify-center gap-2 font-medium" : "p-2"}`}
              title={
                isSelectingParent
                  ? t("graphEditor.nodeEditSidebar.field.finishSelect")
                  : t("graphEditor.nodeEditSidebar.field.selectFromGraph")
              }
              aria-label={
                isSelectingParent
                  ? t("graphEditor.nodeEditSidebar.field.finishSelect")
                  : t("graphEditor.nodeEditSidebar.field.selectFromGraph")
              }
            >
              <MousePointer2
                size={isMobile ? 18 : 16}
                className={isSelectingParent ? "animate-pulse" : ""}
                aria-hidden="true"
              />
              {isMobile && (
                <span>
                  {isSelectingParent
                    ? t("graphEditor.nodeEditSidebar.field.finishSelect")
                    : t("graphEditor.nodeEditSidebar.field.selectFromGraph")}
                </span>
              )}
            </button>
          </div>

          {selectedParents.length > 0 && (
            <div
              className={`flex flex-wrap ${isMobile ? "mt-3 gap-2" : "mt-2 gap-1.5"}`}
            >
              {selectedParents.map((parent) => (
                <div
                  key={parent.id}
                  className={`inline-flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg ${isMobile ? "px-3 py-2 text-base" : "px-2 py-1 text-sm"}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${getLevelColor(parent.level || "normal")}`}
                  ></div>
                  <span
                    className={`truncate ${isMobile ? "max-w-[150px]" : "max-w-[120px]"}`}
                  >
                    {parent.title}
                  </span>
                  <button
                    onClick={() => handleRemoveParent(parent.id)}
                    className={`hover:bg-primary-100 dark:hover:bg-primary-800 rounded ${isMobile ? "p-1 min-h-[32px] min-w-[32px]" : "p-0.5"}`}
                    aria-label={t("common.aria.removeParent")}
                  >
                    <X size={isMobile ? 14 : 12} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor={tagsId}
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            {t("graphEditor.nodeEditSidebar.field.tags")}
          </label>
          <input
            id={tagsId}
            type="text"
            autoComplete="off"
            value={nodeForm.tags.join(", ")}
            onChange={(e) => {
              const tags = e.target.value
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean);
              setNodeForm({ ...nodeForm, tags });
            }}
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2"}`}
            placeholder={t("graphEditor.nodeEditSidebar.field.tagsPlaceholder")}
          />
        </div>

        <div>
          <label
            htmlFor={levelId}
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            {t("graphEditor.nodeEditSidebar.field.level")}
          </label>
          <select
            id={levelId}
            value={nodeForm.level}
            onChange={(e) =>
              setNodeForm({ ...nodeForm, level: e.target.value as NodeLevel })
            }
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2 text-sm"}`}
          >
            <option value="root">{t("graphEditor.nodeEditSidebar.field.levelRoot")}</option>
            <option value="core">{t("graphEditor.nodeEditSidebar.field.levelCore")}</option>
            <option value="sub">{t("graphEditor.nodeEditSidebar.field.levelSub")}</option>
            <option value="normal">{t("graphEditor.nodeEditSidebar.field.levelNormal")}</option>
            <option value="leaf">{t("graphEditor.nodeEditSidebar.field.levelLeaf")}</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor={contentId}
              className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base" : "text-sm"}`}
            >
              {t("graphEditor.nodeEditSidebar.field.content")}
            </label>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setContentViewMode("edit")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  contentViewMode === "edit"
                    ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                title={t("graphEditor.nodeEditSidebar.toolbar.editMode")}
              >
                <Pencil size={12} />
                {t("graphEditor.nodeEditSidebar.toolbar.edit")}
              </button>
              <button
                type="button"
                onClick={() => setContentViewMode("preview")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  contentViewMode === "preview"
                    ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                title={t("graphEditor.nodeEditSidebar.toolbar.previewMode")}
              >
                <Eye size={12} />
                {t("graphEditor.nodeEditSidebar.toolbar.preview")}
              </button>
            </div>
          </div>

          {contentViewMode === "edit" ? (
            <>
              {/* Formatting toolbar */}
              <div className="flex items-center gap-1 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleBold}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title={t("graphEditor.nodeEditSidebar.toolbar.bold")}
                  aria-label={t("common.aria.bold")}
                >
                  <Bold size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleItalic}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title={t("graphEditor.nodeEditSidebar.toolbar.italic")}
                  aria-label={t("common.aria.italic")}
                >
                  <Italic size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleHeading}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title={t("graphEditor.nodeEditSidebar.toolbar.heading")}
                  aria-label={t("graphEditor.nodeEditSidebar.toolbar.heading")}
                >
                  <Heading size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleLink}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[24px] min-w-[24px] flex items-center justify-center"
                  title={t("graphEditor.nodeEditSidebar.toolbar.link")}
                  aria-label={t("graphEditor.nodeEditSidebar.toolbar.link")}
                >
                  <LinkIcon size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleCodeBlock}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title={t("graphEditor.nodeEditSidebar.toolbar.codeBlock")}
                  aria-label={t("graphEditor.nodeEditSidebar.toolbar.codeBlock")}
                >
                  <Code size={14} aria-hidden="true" />
                </button>
              </div>
              <textarea
                id={contentId}
                ref={contentTextareaRef}
                autoComplete="off"
                value={nodeForm.content}
                onChange={handleContentChange}
                className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "h-48 px-4 py-3 text-base" : "h-64 px-3 py-2 text-sm"}`}
                placeholder={t("graphEditor.nodeEditSidebar.placeholder.content")}
              />
            </>
          ) : (
            <div
              className={`w-full border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 overflow-y-auto ${isMobile ? "h-48 p-4" : "h-64 p-3"}`}
            >
              {nodeForm.content.trim() ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    urlTransform={(url) => url}
                    components={{
                      a: ({ node: _node, ...props }) => (
                        <WikiLinkRenderer
                          {...props}
                          onWikiLinkClick={handleWikiLinkClick}
                        />
                      ),
                    }}
                  >
                    {preprocessWikiLinks(preprocessMarkdown(nodeForm.content))}
                  </ReactMarkdown>
                </div>
              ) : (
                <EmptyState
                  icon={<FileText size={32} />}
                  title={t('graphEditor.nodeEditSidebar.emptyContent')}
                />
              )}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <div
        className={`border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 z-10 ${isMobile ? "fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" : "mt-6 pt-4 sticky bottom-0"}`}
      >
        {/* Auto-save indicator */}
        {mode === "edit" && autoSaveStatus !== "idle" && (
          <div
            className={`text-center text-xs mb-2 transition-opacity duration-500 ${
              autoSaveStatus === "saved" ? "text-green-500 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
            }`}
            role="status"
            aria-live="polite"
          >
            {autoSaveStatus === "saving" ? (
              <span className="flex items-center justify-center gap-1">
                <Loader2 className="animate-spin" size={12} aria-hidden="true" />
                {t("graphEditor.nodeEditSidebar.autoSaveSaving")}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <Check size={12} aria-hidden="true" />
                {t("graphEditor.nodeEditSidebar.autoSaveSaved")}
              </span>
            )}
          </div>
        )}
        {isMobile ? (
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl flex items-center justify-center font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all min-h-[48px]"
            >
              {t("graphEditor.nodeEditSidebar.cancel")}
            </button>
            <SaveButton
              onSave={handleManualSave}
              variant="primary"
              size="md"
              disabled={!nodeForm.title.trim()}
              className="flex-1 min-h-[48px]"
              idleLabel={t("graphEditor.nodeEditSidebar.save")}
            />
          </div>
        ) : (
          <SaveButton
            onSave={handleManualSave}
            variant="primary"
            size="md"
            fullWidth
            disabled={!nodeForm.title.trim()}
            idleLabel={t("graphEditor.nodeEditSidebar.saveNode")}
          />
        )}
      </div>

      {/* 双链 [[ 节点选择浮层 */}
      {showLinkSelector && (
        <NodeLinkSelector
          graphId={graphId}
          currentKnowledgePointId={currentNodeId}
          onSelect={handleLinkSelect}
          onClose={() => setShowLinkSelector(false)}
          position={linkSelectorPosition}
        />
      )}
    </div>
  );
};
