import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  BookOpen,
  Theater,
  ListOrdered,
  FileText,
  Clapperboard,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StoryStructure } from "../../../services/api/storyCreation";

interface StructurePanelProps {
  structures: StoryStructure[];
  selectedId: string | null;
  onSelect: (node: StoryStructure) => void;
  onAddChild: (parentId: string, level: StoryStructure["structure_level"]) => void;
  onDelete: (id: string) => void;
  onInitializeTemplate: (templateCode: string) => void;
  initializing: boolean;
}

const LEVEL_ICONS: Record<StoryStructure["structure_level"], React.ReactNode> = {
  story: <BookOpen size={14} />,
  act: <Theater size={14} />,
  sequence: <ListOrdered size={14} />,
  chapter: <FileText size={14} />,
  scene: <Clapperboard size={14} />,
};

const NEXT_LEVEL_MAP: Record<StoryStructure["structure_level"], StoryStructure["structure_level"] | null> = {
  story: "act",
  act: "sequence",
  sequence: "chapter",
  chapter: "scene",
  scene: null, // scene is a leaf node, cannot add children
};

export const StructurePanel: React.FC<StructurePanelProps> = ({
  structures,
  selectedId,
  onSelect,
  onAddChild,
  onDelete,
  onInitializeTemplate,
  initializing,
}) => {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const toggleExpand = (nodeId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleAddChild = (e: React.MouseEvent, parentId: string, currentLevel: StoryStructure["structure_level"]) => {
    e.stopPropagation();
    const nextLevel = NEXT_LEVEL_MAP[currentLevel];
    if (!nextLevel) return; // scene is leaf node
    onAddChild(parentId, nextLevel);

    if (!expandedIds.has(parentId)) {
      toggleExpand(parentId);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(t("storyEditor.confirmDelete"))) {
      onDelete(id);
    }
  };

  const handleInitializeTemplate = async (templateCode: string) => {
    setShowTemplateSelector(false);
    await onInitializeTemplate(templateCode);
  };

  const renderNode = (node: StoryStructure, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors
            ${isSelected
              ? "bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500"
              : "hover:bg-gray-100 dark:hover:bg-slate-700"
            }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onSelect(node)}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(node.id);
            }}
            className={`w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors
              ${!hasChildren ? "invisible" : ""}`}
          >
            {isExpanded ? (
              <ChevronDown size={12} className="text-gray-500" />
            ) : (
              <ChevronRight size={12} className="text-gray-500" />
            )}
          </button>

          {/* Level Icon */}
          <span className={`flex-shrink-0 ${
            isSelected ? "text-primary-600 dark:text-primary-400" : "text-gray-500 dark:text-gray-400"
          }`}>
            {LEVEL_ICONS[node.structure_level]}
          </span>

          {/* Title */}
          <span className={`flex-1 text-sm truncate font-medium ${
            isSelected
              ? "text-primary-700 dark:text-primary-300"
              : "text-gray-700 dark:text-gray-300"
          }`}>
            {node.title}
          </span>

          {/* Action Buttons - Show on Hover */}
          <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={(e) => handleAddChild(e, node.id, node.structure_level)}
              className="w-5 h-5 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
              title={t("storyEditor.addChild")}
            >
              <Plus size={12} />
            </button>
            <button
              onClick={(e) => handleDelete(e, node.id)}
              className="w-5 h-5 flex items-center justify-center rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
              title={t("storyEditor.delete")}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children?.map((child: StoryStructure) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={14} />
            {t("storyEditor.structureTitle")}
          </h3>
          {structures.length > 0 && (
            <button
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              className="p-1 text-xs text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
              title={t("storyEditor.initializeTemplate")}
            >
              <Sparkles size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {structures.length === 0 ? (
          /* Empty State */
          <div className="px-3 py-8 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t("storyEditor.noStructures")}
            </p>
            {!showTemplateSelector ? (
              <button
                onClick={() => setShowTemplateSelector(true)}
                disabled={initializing}
                className="w-full px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {initializing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("storyEditor.initializing")}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    {t("storyEditor.initFromTemplate")}
                  </>
                )}
              </button>
            ) : null}
          </div>
        ) : (
          /* Tree View */
          <div className="space-y-0.5 px-1">
            {structures.map(node => renderNode(node))}
          </div>
        )}

        {/* Template Selector */}
        {showTemplateSelector && (
          <div className="mx-3 mt-3 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 rounded-lg border border-purple-200 dark:border-slate-600">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {t("storyEditor.selectTemplate")}
            </h4>
            <div className="space-y-2">
              <button
                onClick={() => handleInitializeTemplate("three_act")}
                disabled={initializing}
                className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-600 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50"
              >
                <div className="font-medium text-gray-900 dark:text-white">{t("storyEditor.templateThreeAct")}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t("storyEditor.templateThreeActDesc")}</div>
              </button>
            </div>
            <button
              onClick={() => setShowTemplateSelector(false)}
              className="w-full mt-3 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              {t("common.cancel")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StructurePanel;
