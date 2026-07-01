import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Node as GraphNode, NodeLevel } from "../../../types";
import { getLevelColor, getLevelLabel } from "../../../lib/graphUtils";
import {
  X,
  ArrowLeft,
  Save,
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
} from "lucide-react";
import { useTheme } from "../../../hooks";
import { useIsMobile } from "../../../hooks";
import type { BackboneModule } from "@shared/types/graph";
import { BACKBONE_MODULE_LABELS } from "@shared/types/graph";
import { BackboneNodeIcon } from "../BackboneNodeIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { preprocessMarkdown } from "../../../utils/markdownPreprocessor";

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
  onSave: () => void;
  onClose: () => void;
  onBack: () => void;
  prevSidebarMode: "none" | "create" | "edit" | "outline" | "detail";
  loading: boolean;
  nodes: GraphNode[];
  currentNodeId?: string;
  isSelectingParent?: boolean;
  onStartSelectingParent?: () => void;
  onCancelSelectingParent?: () => void;
}

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
}) => {
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const [parentSearch, setParentSearch] = useState("");
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [contentViewMode, setContentViewMode] = useState<"edit" | "preview">("edit");
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isAutoSavingRef = useRef(false);
  const onSaveRef = useRef(onSave);
  const loadingRef = useRef(loading);
  useEffect(() => {
    onSaveRef.current = onSave;
    loadingRef.current = loading;
  }, [onSave, loading]);

  // Clear auto-save timer (used by manual save)
  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  // Auto-save on form change (3-second debounce)
  useEffect(() => {
    if (loadingRef.current) return;
    if (!nodeForm.title.trim()) return;
    if (mode === "create") return; // Don't auto-save for new nodes

    clearAutoSaveTimer();

    autoSaveTimerRef.current = setTimeout(() => {
      isAutoSavingRef.current = true;
      setAutoSaveStatus("saving");
      onSaveRef.current();
    }, 3000);

    return () => {
      clearAutoSaveTimer();
    };
  }, [nodeForm, mode, clearAutoSaveTimer]);

  // Watch loading to update auto-save status
  useEffect(() => {
    if (!loading && isAutoSavingRef.current) {
      isAutoSavingRef.current = false;
      setAutoSaveStatus("saved");
      if (autoSaveResetTimerRef.current) {
        clearTimeout(autoSaveResetTimerRef.current);
      }
      autoSaveResetTimerRef.current = setTimeout(() => {
        setAutoSaveStatus("idle");
      }, 1500);
    }
    return () => {
      if (autoSaveResetTimerRef.current) {
        clearTimeout(autoSaveResetTimerRef.current);
      }
    };
  }, [loading]);

  // Manual save: clear auto-save timer to avoid double-saving
  const handleManualSave = useCallback(() => {
    clearAutoSaveTimer();
    isAutoSavingRef.current = false;
    setAutoSaveStatus("idle");
    onSave();
  }, [clearAutoSaveTimer, onSave]);

  const currentNode = useMemo(() => {
    return currentNodeId ? nodes.find((n) => n.id === currentNodeId) : null;
  }, [nodes, currentNodeId]);

  const backboneModule = currentNode?.properties?.backboneModule as
    | BackboneModule
    | undefined;
  const isBackboneNode = !!backboneModule;

  const selectedParents = useMemo(() => {
    return nodes.filter((n) => nodeForm.parentNodeIds.includes(n.id));
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

  const handleBold = useCallback(() => wrapSelection("**", "**", "粗体文本"), [wrapSelection]);
  const handleItalic = useCallback(() => wrapSelection("*", "*", "斜体文本"), [wrapSelection]);
  const handleHeading = useCallback(() => insertAtLineStart("## "), [insertAtLineStart]);
  const handleLink = useCallback(
    () => wrapSelection("[", "](https://)", "链接文本"),
    [wrapSelection],
  );
  const handleCodeBlock = useCallback(
    () => wrapSelection("```\n", "\n```", "代码"),
    [wrapSelection],
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
              title="返回大纲"
            >
              <ArrowLeft size={isMobile ? 20 : 18} />
            </button>
          )}
          <div
            className={`w-3 h-3 rounded-full ${mode === "create" ? "bg-green-500" : "bg-primary-500"}`}
          ></div>
          <h3
            className={`font-bold text-gray-800 dark:text-gray-100 ${isMobile ? "text-base" : "text-lg"}`}
          >
            {mode === "create" ? "创建新节点" : "编辑节点"}
          </h3>
        </div>
        <button
          onClick={onClose}
          className={`text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg ${isMobile ? "p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center" : ""}`}
        >
          <X size={isMobile ? 22 : 20} />
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
                点击图谱选择父节点（可多选）
              </span>
            </div>
            <button
              onClick={onCancelSelectingParent}
              className={`bg-amber-100 dark:bg-amber-800 hover:bg-amber-200 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-200 rounded transition-colors ${isMobile ? "w-full py-2.5 min-h-[44px] text-sm font-medium" : "px-2 py-1 text-xs"}`}
            >
              完成
            </button>
          </div>
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto ${isMobile ? "space-y-5 px-1 pb-32" : "space-y-4 pr-1"}`}
      >
        <div>
          <label
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            标题
            {isBackboneNode && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                (骨干节点)
              </span>
            )}
          </label>
          {isBackboneNode && backboneModule && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <BackboneNodeIcon module={backboneModule} size="small" />
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                {BACKBONE_MODULE_LABELS[backboneModule]} - 标题不可修改
              </span>
            </div>
          )}
          <input
            type="text"
            value={nodeForm.title}
            onChange={(e) =>
              setNodeForm({ ...nodeForm, title: e.target.value })
            }
            readOnly={isBackboneNode}
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2"} ${isBackboneNode ? "cursor-not-allowed opacity-75" : ""}`}
            placeholder="输入节点标题"
          />
        </div>

        <div>
          <label
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            概览
            <span className="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">
              (20-30字短概述，用于图谱预览)
            </span>
          </label>
          <input
            type="text"
            value={nodeForm.summary}
            onChange={(e) =>
              setNodeForm({ ...nodeForm, summary: e.target.value })
            }
            maxLength={200}
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2 text-sm"}`}
            placeholder="简短概览，概括核心内容..."
          />
        </div>

        <div className="relative" ref={dropdownRef}>
          <label
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            父节点 (可多选)
          </label>

          <div className={`flex gap-2 ${isMobile ? "flex-col" : ""}`}>
            <div className={`relative ${isMobile ? "w-full" : "flex-1"}`}>
              <div
                className={`absolute text-gray-400 z-10 ${isMobile ? "left-4 top-1/2 -translate-y-1/2" : "left-3 top-1/2 -translate-y-1/2"}`}
              >
                <Search size={isMobile ? 18 : 16} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={parentSearch}
                onChange={handleParentInputChange}
                onFocus={handleParentInputFocus}
                onBlur={handleParentInputBlur}
                className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "pl-11 pr-10 py-3 min-h-[44px] text-base" : "pl-9 pr-8 py-2"}`}
                placeholder="搜索选择父节点..."
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 ${isMobile ? "right-3" : "right-2"}`}
              >
                {nodeForm.parentNodeIds.length > 0 && (
                  <button
                    onClick={clearAllParents}
                    className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${isMobile ? "p-1.5 min-h-[36px] min-w-[36px]" : "p-1"}`}
                    title="清除全部"
                  >
                    <X size={isMobile ? 16 : 14} />
                  </button>
                )}
                <button
                  onClick={() => setShowParentDropdown(!showParentDropdown)}
                  className={`text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${isMobile ? "p-1.5 min-h-[36px] min-w-[36px]" : "p-1"}`}
                >
                  <ChevronDown
                    size={isMobile ? 16 : 14}
                    className={`transition-transform ${showParentDropdown ? "rotate-180" : ""}`}
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
                      无父节点
                    </span>
                  </button>

                  {filteredNodes.length === 0 ? (
                    <div
                      className={`text-center text-gray-400 dark:text-gray-500 ${isMobile ? "px-4 py-5 text-base" : "px-3 py-4 text-sm"}`}
                    >
                      {parentSearch ? "没有匹配的节点" : "没有可选的节点"}
                    </div>
                  ) : (
                    filteredNodes.map((node) => {
                      const isSelected = nodeForm.parentNodeIds.includes(
                        node.id,
                      );
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
              title={isSelectingParent ? "完成选择" : "从图谱选择"}
            >
              <MousePointer2
                size={isMobile ? 18 : 16}
                className={isSelectingParent ? "animate-pulse" : ""}
              />
              {isMobile && (
                <span>{isSelectingParent ? "完成选择" : "从图谱选择"}</span>
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
                    onClick={() => removeParent(parent.id)}
                    className={`hover:bg-primary-100 dark:hover:bg-primary-800 rounded ${isMobile ? "p-1 min-h-[32px] min-w-[32px]" : "p-0.5"}`}
                  >
                    <X size={isMobile ? 14 : 12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            标签 (逗号分隔)
          </label>
          <input
            type="text"
            value={nodeForm.tags.join(", ")}
            onChange={(e) => {
              const tags = e.target.value
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean);
              setNodeForm({ ...nodeForm, tags });
            }}
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2"}`}
            placeholder="例如: 重要, 待办, 概念"
          />
        </div>

        <div>
          <label
            className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base mb-2" : "text-sm mb-1"}`}
          >
            层级
          </label>
          <select
            value={nodeForm.level}
            onChange={(e) =>
              setNodeForm({ ...nodeForm, level: e.target.value as any })
            }
            className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "px-4 py-3 min-h-[44px] text-base" : "px-3 py-2 text-sm"}`}
          >
            <option value="root">根节点</option>
            <option value="core">核心节点</option>
            <option value="sub">次级节点</option>
            <option value="normal">普通节点</option>
            <option value="leaf">叶子节点</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              className={`block font-medium text-gray-700 dark:text-gray-300 ${isMobile ? "text-base" : "text-sm"}`}
            >
              内容
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
                title="编辑模式"
              >
                <Pencil size={12} />
                编辑
              </button>
              <button
                type="button"
                onClick={() => setContentViewMode("preview")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  contentViewMode === "preview"
                    ? "bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                title="预览模式"
              >
                <Eye size={12} />
                预览
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
                  title="加粗"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleItalic}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="斜体"
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleHeading}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="标题"
                >
                  <Heading size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleLink}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="链接"
                >
                  <LinkIcon size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleCodeBlock}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  title="代码块"
                >
                  <Code size={14} />
                </button>
              </div>
              <textarea
                ref={contentTextareaRef}
                value={nodeForm.content}
                onChange={(e) =>
                  setNodeForm({ ...nodeForm, content: e.target.value })
                }
                className={`w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isMobile ? "h-48 px-4 py-3 text-base" : "h-64 px-3 py-2 text-sm"}`}
                placeholder="支持 Markdown 格式..."
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
                  >
                    {preprocessMarkdown(nodeForm.content)}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm italic">
                  暂无内容，请先在编辑模式输入...
                </p>
              )}
            </div>
          )}
        </div>
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
          >
            {autoSaveStatus === "saving" ? (
              <span className="flex items-center justify-center gap-1">
                <Loader2 className="animate-spin" size={12} />
                自动保存中...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1">
                <Check size={12} />
                已自动保存
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
              取消
            </button>
            <button
              onClick={handleManualSave}
              disabled={loading || !nodeForm.title.trim()}
              className={`flex-1 py-3 rounded-xl flex items-center justify-center font-bold text-white shadow-lg transition-all min-h-[48px] ${
                loading || !nodeForm.title.trim()
                  ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-primary-600 to-primary-600 hover:shadow-primary-200 dark:hover:shadow-primary-900/30 active:scale-[0.99]"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2" size={18} />
                  保存
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={handleManualSave}
            disabled={loading || !nodeForm.title.trim()}
            className={`w-full py-3 rounded-xl flex items-center justify-center font-bold text-white shadow-lg transition-all ${
              loading || !nodeForm.title.trim()
                ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                : "bg-gradient-to-r from-primary-600 to-primary-600 hover:shadow-primary-200 dark:hover:shadow-primary-900/30 active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2" size={18} />
                保存节点
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
