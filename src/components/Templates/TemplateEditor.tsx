import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Template,
  TemplateNode,
  TemplateEdge,
  TemplateCategory,
  NodeLevel,
} from "../../types";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { useTheme, useIsMobile, useFormDraft } from "../../hooks";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";
import { ConfirmationModal } from "../common/ConfirmationModal";

interface TemplateEditorProps {
  template: Template;
  onSave: (template: Template) => void;
  onCancel: () => void;
}

const generateId = () =>
  `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getNodeLevelColor = (level: NodeLevel, isDark: boolean) => {
  if (isDark) {
    switch (level) {
      case "root":
        return "bg-primary-600 text-white";
      case "core":
        return "bg-primary-600 text-white";
      case "sub":
        return "bg-primary-600 text-white";
      case "normal":
        return "bg-slate-600 text-white";
      case "leaf":
        return "bg-emerald-600 text-white";
      default:
        return "bg-slate-700 text-slate-300";
    }
  }
  switch (level) {
    case "root":
      return "bg-primary-500 text-white";
    case "core":
      return "bg-primary-500 text-white";
    case "sub":
      return "bg-primary-500 text-white";
    case "normal":
      return "bg-gray-500 text-white";
    case "leaf":
      return "bg-emerald-500 text-white";
    default:
      return "bg-gray-200 text-gray-700";
  }
};

const TreeNodeItem: React.FC<{
  node: TemplateNode;
  allNodes: TemplateNode[];
  depth: number;
  isDark: boolean;
  t: TFunction;
  onUpdate: (id: string, updates: Partial<TemplateNode>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
}> = ({ node, allNodes, depth, isDark, t, onUpdate, onDelete, onAddChild }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const children = useMemo(
    () => allNodes.filter((n) => n.parentId === node.id),
    [allNodes, node.id],
  );
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-start gap-2 py-2 px-3 rounded-lg transition-all ${
          isDark ? "hover:bg-slate-700/50" : "hover:bg-gray-50"
        }`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-1 flex-shrink-0 pt-1">
          {hasChildren ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-0.5 rounded ${
                isDark
                  ? "hover:bg-slate-600 text-slate-400"
                  : "hover:bg-gray-200 text-gray-500"
              }`}
            >
              {isExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}
          <GripVertical
            size={14}
            className={`${isDark ? "text-slate-500" : "text-gray-400"} cursor-grab`}
          />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={node.title}
              onChange={(e) => onUpdate(node.id, { title: e.target.value })}
              placeholder={t("templates.node.title")}
              className={`flex-1 px-2 py-1 text-sm rounded border outline-none transition-all ${
                isDark
                  ? "bg-slate-800 border-slate-600 text-white focus:border-primary-500"
                  : "bg-white border-gray-200 text-gray-900 focus:border-primary-500 dark:bg-slate-700 dark:border-slate-500 dark:text-white"
              }`}
            />
            <select
              value={node.level}
              onChange={(e) =>
                onUpdate(node.id, { level: e.target.value as NodeLevel })
              }
              className={`px-2 py-1 text-xs rounded border outline-none ${
                isDark
                  ? "bg-slate-800 border-slate-600 text-white"
                  : "bg-white border-gray-200 text-gray-900 dark:bg-slate-700 dark:border-slate-500 dark:text-white"
              }`}
            >
              <option value="root">{t("templates.node.root")}</option>
              <option value="core">{t("templates.node.core")}</option>
              <option value="sub">{t("templates.node.sub")}</option>
              <option value="normal">{t("templates.node.normal")}</option>
              <option value="leaf">{t("templates.node.leaf")}</option>
            </select>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${getNodeLevelColor(
                node.level,
                isDark,
              )}`}
            >
              {node.level}
            </span>
          </div>

          <textarea
            value={node.description || ""}
            onChange={(e) => onUpdate(node.id, { description: e.target.value })}
            placeholder={t("templates.node.contentDescription")}
            rows={2}
            className={`w-full px-2 py-1 text-xs rounded border outline-none transition-all resize-none ${
              isDark
                ? "bg-slate-800 border-slate-600 text-slate-300 placeholder-slate-500 focus:border-primary-500"
                : "bg-white border-gray-200 text-gray-600 placeholder-gray-400 focus:border-primary-500 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-300 dark:placeholder-slate-500"
            }`}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddChild(node.id)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                isDark
                  ? "text-primary-400 hover:bg-primary-900/30"
                  : "text-primary-600 hover:bg-primary-50"
              }`}
            >
              <Plus size={12} />
              {t("templates.node.addChild")}
            </button>
            <button
              onClick={() => onDelete(node.id)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                isDark
                  ? "text-red-400 hover:bg-red-900/30"
                  : "text-red-600 hover:bg-red-50"
              }`}
            >
              <Trash2 size={12} />
              {t("templates.button.delete")}
            </button>
          </div>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              allNodes={allNodes}
              depth={depth + 1}
              isDark={isDark}
              t={t}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EdgeItem: React.FC<{
  edge: TemplateEdge;
  edgeIndex: number;
  nodes: TemplateNode[];
  isDark: boolean;
  t: TFunction;
  onUpdate: (updates: Partial<TemplateEdge>) => void;
  onDelete: () => void;
}> = ({ edge, nodes, isDark, t, onUpdate, onDelete }) => {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg ${
        isDark ? "bg-slate-700/50" : "bg-gray-50"
      }`}
    >
      <select
        value={edge.source}
        onChange={(e) => onUpdate({ source: e.target.value })}
        className={`flex-1 px-2 py-1 text-sm rounded border outline-none ${
          isDark
            ? "bg-slate-800 border-slate-600 text-white"
            : "bg-white border-gray-200 text-gray-900 dark:bg-slate-700 dark:border-slate-500 dark:text-white"
        }`}
      >
        <option value="">{t("templates.edge.sourceNode")}</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}
          </option>
        ))}
      </select>

      <span
        className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        →
      </span>

      <select
        value={edge.target}
        onChange={(e) => onUpdate({ target: e.target.value })}
        className={`flex-1 px-2 py-1 text-sm rounded border outline-none ${
          isDark
            ? "bg-slate-800 border-slate-600 text-white"
            : "bg-white border-gray-200 text-gray-900 dark:bg-slate-700 dark:border-slate-500 dark:text-white"
        }`}
      >
        <option value="">{t("templates.edge.targetNode")}</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.title}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={edge.relationship_type || ""}
        onChange={(e) => onUpdate({ relationship_type: e.target.value })}
        placeholder={t("templates.edge.relationshipType")}
        className={`w-24 px-2 py-1 text-sm rounded border outline-none ${
          isDark
            ? "bg-slate-800 border-slate-600 text-white placeholder-slate-500"
            : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 dark:bg-slate-700 dark:border-slate-500 dark:text-white dark:placeholder-slate-500"
        }`}
      />

      <button
        onClick={onDelete}
        className={`p-1 rounded transition-colors ${
          isDark
            ? "text-red-400 hover:bg-red-900/30"
            : "text-red-600 hover:bg-red-50"
        }`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();

  const {
    value: formData,
    setValue: setFormData,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<{
    name: string;
    description: string;
    category: TemplateCategory;
    nodes: TemplateNode[];
    edges: TemplateEdge[];
  }>({
    key: "template_editor_draft",
    initialValue: {
      name: template.name,
      description: template.description || "",
      category: template.category,
      nodes: template.nodes || [],
      edges: template.edges || [],
    },
  });

  const { name, description, category, nodes, edges } = formData;

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: true });
  useEscapeKey(() => onCancel(), true);

  const rootNodes = useMemo(() => nodes.filter((n) => !n.parentId), [nodes]);

  const handleUpdateNode = useCallback(
    (id: string, updates: Partial<TemplateNode>) => {
      setFormData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      }));
    },
    [setFormData],
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setFormData((prev) => {
        const idsToDelete = new Set<string>();
        const collectChildren = (parentId: string) => {
          idsToDelete.add(parentId);
          prev.nodes
            .filter((n) => n.parentId === parentId)
            .forEach((n) => collectChildren(n.id));
        };
        collectChildren(id);
        return {
          ...prev,
          nodes: prev.nodes.filter((n) => !idsToDelete.has(n.id)),
          edges: prev.edges.filter(
            (e) => e.source !== id && e.target !== id,
          ),
        };
      });
    },
    [setFormData],
  );

  const handleAddNode = useCallback(
    (parentId?: string) => {
      const newNode: TemplateNode = {
        id: generateId(),
        title: "",
        description: "",
        level: parentId ? "sub" : "core",
        parentId,
      };
      setFormData((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    },
    [setFormData],
  );

  const handleAddChildNode = useCallback(
    (parentId: string) => {
      const newNode: TemplateNode = {
        id: generateId(),
        title: "",
        description: "",
        level: "sub",
        parentId,
      };
      setFormData((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    },
    [setFormData],
  );

  const handleUpdateEdge = useCallback(
    (index: number, updates: Partial<TemplateEdge>) => {
      setFormData((prev) => ({
        ...prev,
        edges: prev.edges.map((e, i) =>
          i === index ? { ...e, ...updates } : e,
        ),
      }));
    },
    [setFormData],
  );

  const handleDeleteEdge = useCallback(
    (index: number) => {
      setFormData((prev) => ({
        ...prev,
        edges: prev.edges.filter((_, i) => i !== index),
      }));
    },
    [setFormData],
  );

  const handleAddEdge = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      edges: [...prev.edges, { source: "", target: "", relationship_type: "" }],
    }));
  }, [setFormData]);

  const handleSave = useCallback(() => {
    const updatedTemplate: Template = {
      ...template,
      name,
      description,
      category,
      nodes,
      edges,
    };
    onSave(updatedTemplate);
    clearDraft();
  }, [template, name, description, category, nodes, edges, onSave, clearDraft]);

  const isValid = useMemo(() => {
    return (
      name.trim().length > 0 &&
      nodes.length > 0 &&
      nodes.every((n) => n.title.trim().length > 0) &&
      edges.every((e) => e.source && e.target)
    );
  }, [name, nodes, edges]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm`}
    >
      <div
        ref={containerRef}
        className={`w-full ${
          isMobile ? "h-full rounded-none" : "max-w-4xl rounded-2xl"
        } shadow-2xl ${isMobile ? "max-h-full" : "max-h-[90vh]"} flex flex-col ${
          isDark ? "bg-slate-800 border border-slate-700" : "bg-white"
        }`}
      >
        <div
          className={`p-4 md:p-6 border-b ${
            isDark ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2
              className={`text-lg md:text-xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {t("templates.button.edit")}
            </h2>
            <button
              onClick={onCancel}
              className={`p-2 rounded-full transition-colors ${
                isDark
                  ? "hover:bg-slate-700 text-slate-400"
                  : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <X size={isMobile ? 20 : 24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={`p-4 md:p-6 space-y-6`}>
            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-slate-900 border-slate-700"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <h3
                className={`text-sm font-semibold mb-4 ${
                  isDark ? "text-slate-300" : "text-gray-700"
                }`}
              >
                {t("templates.basicInfo")}
              </h3>
              <div className="space-y-4">
                <div>
                  <label
                    className={`block text-xs font-medium mb-1 ${
                      isDark ? "text-slate-400" : "text-gray-600"
                    }`}
                  >
                    {t("templates.form.name")}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={t("templates.form.name")}
                    className={`w-full px-3 py-2 rounded-lg border outline-none transition-all ${
                      isDark
                        ? "bg-slate-800 border-slate-600 text-white focus:border-primary-500"
                        : "bg-white border-gray-200 text-gray-900 focus:border-primary-500 dark:bg-slate-700 dark:border-slate-500 dark:text-white"
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-xs font-medium mb-1 ${
                      isDark ? "text-slate-400" : "text-gray-600"
                    }`}
                  >
                    {t("templates.form.description")}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder={t("templates.form.description")}
                    rows={2}
                    className={`w-full px-3 py-2 rounded-lg border outline-none transition-all resize-none ${
                      isDark
                        ? "bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-primary-500"
                        : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary-500 dark:bg-slate-700 dark:border-slate-500 dark:text-white dark:placeholder-slate-500"
                    }`}
                  />
                </div>
                <div>
                  <label
                    className={`block text-xs font-medium mb-1 ${
                      isDark ? "text-slate-400" : "text-gray-600"
                    }`}
                  >
                    {t("templates.form.category")}
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as TemplateCategory,
                      })
                    }
                    className={`w-full px-3 py-2 rounded-lg border outline-none ${
                      isDark
                        ? "bg-slate-800 border-slate-600 text-white"
                        : "bg-white border-gray-200 text-gray-900 dark:bg-slate-700 dark:border-slate-500 dark:text-white"
                    }`}
                  >
                    <option value="knowledge">
                      {t("templates.category.knowledge")}
                    </option>
                    <option value="project">
                      {t("templates.category.project")}
                    </option>
                    <option value="analysis">
                      {t("templates.category.analysis")}
                    </option>
                    <option value="architecture">
                      {t("templates.category.architecture")}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-slate-900 border-slate-700"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className={`text-sm font-semibold ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.nodeList", { count: nodes.length })}
                </h3>
                <button
                  onClick={() => handleAddNode()}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    isDark
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "bg-primary-500 text-white hover:bg-primary-600"
                  }`}
                >
                  <Plus size={14} />
                  {t("templates.node.addChild")}
                </button>
              </div>

              {nodes.length === 0 ? (
                <div
                  className={`text-center py-8 ${
                    isDark ? "text-slate-500" : "text-gray-500"
                  }`}
                >
                  {t("templates.noNodesClickToAdd")}
                </div>
              ) : (
                <div
                  className={`space-y-1 p-3 rounded-lg border max-h-80 overflow-y-auto ${
                    isDark
                      ? "bg-slate-800 border-slate-700"
                      : "bg-white border-gray-200"
                  }`}
                >
                  {rootNodes.map((node) => (
                    <TreeNodeItem
                      key={node.id}
                      node={node}
                      allNodes={nodes}
                      depth={0}
                      isDark={isDark}
                      t={t}
                      onUpdate={handleUpdateNode}
                      onDelete={handleDeleteNode}
                      onAddChild={handleAddChildNode}
                    />
                  ))}
                </div>
              )}
            </div>

            <div
              className={`p-4 rounded-xl border ${
                isDark
                  ? "bg-slate-900 border-slate-700"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className={`text-sm font-semibold ${
                    isDark ? "text-slate-300" : "text-gray-700"
                  }`}
                >
                  {t("templates.edgeList", { count: edges.length })}
                </h3>
                <button
                  onClick={handleAddEdge}
                  disabled={nodes.length < 2}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDark
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "bg-primary-500 text-white hover:bg-primary-600"
                  }`}
                >
                  <Plus size={14} />
                  {t("templates.edge.addEdge")}
                </button>
              </div>

              {edges.length === 0 ? (
                <div
                  className={`text-center py-4 ${
                    isDark ? "text-slate-500" : "text-gray-500"
                  }`}
                >
                  {t("templates.empty.noEdges")}
                </div>
              ) : (
                <div className="space-y-2">
                  {edges.map((edge, index) => (
                    <EdgeItem
                      key={index}
                      edge={edge}
                      edgeIndex={index}
                      nodes={nodes}
                      isDark={isDark}
                      t={t}
                      onUpdate={(updates) => handleUpdateEdge(index, updates)}
                      onDelete={() => handleDeleteEdge(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={`p-4 md:p-6 border-t flex ${
            isMobile ? "flex-col gap-2" : "justify-end gap-3"
          } ${isDark ? "border-slate-700" : "border-gray-200"}`}
        >
          <button
            onClick={onCancel}
            className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-medium transition-colors ${
              isMobile ? "w-full text-center" : ""
            } ${
              isDark
                ? "text-slate-300 hover:bg-slate-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {t("templates.button.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className={`px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              isMobile ? "w-full shadow-lg shadow-primary-600/20" : ""
            }`}
          >
            {t("templates.button.save")}
          </button>
        </div>
      </div>
      <ConfirmationModal
        isOpen={showRestorePrompt}
        onClose={onDiscard}
        onConfirm={onRestore}
        title={t("common.restoreDraftTitle")}
        message={t("common.restoreDraftMessage")}
        isDangerous={false}
      />
    </div>
  );
};
