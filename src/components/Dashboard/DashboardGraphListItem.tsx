import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Network,
  Star,
  Trash2,
  Check,
  Calendar,
  Clock,
  Tag,
} from "lucide-react";
import type { Graph } from "@shared/types";
import { formatDate } from "@/utils/formatters";

/** 行内最多展示的标签数，超出折叠为 +N */
const MAX_VISIBLE_TAGS = 3;

const TEMPLATE_TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  topic_research: {
    icon: () => null,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  knowledge_tree: {
    icon: () => null,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  learning_path: {
    icon: () => null,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  concept_network: {
    icon: () => null,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  skill_map: {
    icon: () => null,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  project_lifecycle: {
    icon: () => null,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
  },
};

const getTemplateTypeConfig = (templateType?: string) => {
  if (!templateType) return null;
  return TEMPLATE_TYPE_CONFIG[templateType] || null;
};

interface DashboardGraphListItemProps {
  graph: Graph;
  isDark: boolean;
  isMobile: boolean;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onNavigate: (graphId: string) => void;
  onDelete: (id: string, title: string) => void;
  onToggleFavorite: (id: string, currentFavorite: boolean) => void;
  onPrefetch: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, graph: Graph) => void;
  variant: "desktop" | "mobile";
  /** 点击标签 chip 切换该标签筛选 */
  onTagClick: (tag: string) => void;
  /** 打开标签编辑对话框 */
  onEditTags: (graph: Graph) => void;
}

export const DashboardGraphListItem: React.FC<DashboardGraphListItemProps> = ({
  graph,
  isDark,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onNavigate,
  onDelete,
  onToggleFavorite,
  onPrefetch,
  onContextMenu,
  variant,
  onTagClick,
  onEditTags,
}) => {
  const { t } = useTranslation();

  const templateTypeLabels = useMemo<Record<string, string>>(
    () => ({
      topic_research: t("dashboard.graphTypeLabels.topicResearch"),
      knowledge_tree: t("dashboard.graphTypeLabels.knowledgeTree"),
      learning_path: t("dashboard.graphTypeLabels.learningPath"),
      concept_network: t("dashboard.graphTypeLabels.conceptNetwork"),
      skill_map: t("dashboard.graphTypeLabels.skillMap"),
      project_lifecycle: t("dashboard.graphTypeLabels.projectLifecycle"),
    }),
    [t],
  );

  if (variant === "mobile") {
    return (
      <div
        onContextMenu={(e) => onContextMenu(e, graph)}
        className={`p-3 sm:p-4 transition-colors ${
          isSelectMode && isSelected
            ? isDark
              ? "bg-primary-900/20"
              : "bg-primary-50"
            : ""
        }`}
        onClick={() => {
          if (isSelectMode) {
            onToggleSelect(graph.id);
          } else {
            onNavigate(graph.id);
          }
        }}
      >
        <div className="flex items-start gap-3">
          {isSelectMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(graph.id);
              }}
              className={`flex items-center justify-center w-6 h-6 rounded mt-1 ${
                isSelected
                  ? "bg-primary-500 text-white"
                  : isDark
                    ? "border border-slate-600"
                    : "border border-gray-300"
              }`}
            >
              {isSelected && <Check size={14} />}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`font-medium text-sm sm:text-base ${isDark ? "text-slate-100" : "text-gray-900"}`}
              >
                {graph.title}
              </span>
              {graph.template_type &&
                getTemplateTypeConfig(graph.template_type) &&
                (() => {
                  const config = getTemplateTypeConfig(graph.template_type);
                  if (!config) return null;
                  const Icon = config.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${config.bgColor} ${config.color}`}
                    >
                      <Icon size={10} />
                      <span>{templateTypeLabels[graph.template_type ?? ""]}</span>
                    </span>
                  );
                })()}
              {graph.is_favorite && (
                <Star
                  size={14}
                  className="text-yellow-500 flex-shrink-0"
                  fill="currentColor"
                />
              )}
            </div>
            <p
              className={`text-xs sm:text-sm mb-2 line-clamp-2 ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {graph.description || t("dashboard.card.noDescription")}
            </p>
            {(graph.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {graph.tags?.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick(tag);
                    }}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      isDark
                        ? "bg-slate-700 text-primary-300"
                        : "bg-primary-50 text-primary-600"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {(graph.tags?.length ?? 0) > MAX_VISIBLE_TAGS && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTags(graph);
                    }}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      isDark
                        ? "bg-slate-700 text-slate-400"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    +{(graph.tags?.length ?? 0) - MAX_VISIBLE_TAGS}
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 text-xs">
              <div
                className={`flex items-center gap-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}
              >
                <Network size={12} />
                <span>
                  {graph.nodes_count || 0} {t("dashboard.card.nodes")}
                </span>
              </div>
              <div
                className={`flex items-center gap-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}
              >
                <Calendar size={12} />
                <span>
                  {graph.created_at
                    ? formatDate(graph.created_at, 'short')
                    : "-"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTags(graph);
              }}
              className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isDark
                  ? "text-slate-400 hover:bg-primary-900/30"
                  : "text-gray-400 hover:bg-primary-50"
              }`}
              aria-label={t("dashboard.tagsEditor.title")}
            >
              <Tag size={18} aria-hidden="true" />
            </button>
            <Link
              to={`/graph/${graph.id}`}
              onClick={(e) => e.stopPropagation()}
              className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isDark
                  ? "text-slate-400 hover:bg-primary-900/30"
                  : "text-gray-400 hover:bg-primary-50"
              }`}
              aria-label={t("dashboard.card.openMindMap")}
            >
              <Network size={18} aria-hidden="true" />
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(graph.id, graph.title);
              }}
              className={`p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center ${
                isDark
                  ? "text-slate-400 hover:bg-red-900/30"
                  : "text-gray-400 hover:bg-red-50"
              }`}
              aria-label={t("dashboard.card.delete")}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop table row
  return (
    <tr
      onMouseEnter={() => onPrefetch(graph.id)}
      onContextMenu={(e) => onContextMenu(e, graph)}
      className={`border-b transition-colors cursor-pointer ${
        isDark
          ? "border-slate-700 hover:bg-slate-700/50"
          : "border-gray-100 hover:bg-gray-50"
      } ${
        isSelectMode && isSelected
          ? isDark
            ? "bg-primary-900/20"
            : "bg-primary-50"
          : ""
      }`}
      onClick={() => {
        if (isSelectMode) {
          onToggleSelect(graph.id);
        } else {
          onNavigate(graph.id);
        }
      }}
    >
      {isSelectMode && (
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleSelect(graph.id)}
            className={`flex items-center justify-center w-5 h-5 rounded ${
              isSelected
                ? "bg-primary-500 text-white"
                : isDark
                  ? "border border-slate-600 hover:border-primary-500"
                  : "border border-gray-300 hover:border-primary-500"
            }`}
          >
            {isSelected && <Check size={14} />}
          </button>
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg flex-shrink-0 ${
              graph.template_type && getTemplateTypeConfig(graph.template_type)
                ? `${getTemplateTypeConfig(graph.template_type)?.bgColor} ${getTemplateTypeConfig(graph.template_type)?.color}`
                : isDark
                  ? "bg-primary-900/30 text-primary-400"
                  : "bg-primary-50 text-primary-600"
            }`}
          >
            {graph.template_type && getTemplateTypeConfig(graph.template_type) ? (
              (() => {
                const config = getTemplateTypeConfig(graph.template_type);
                if (!config) return <BookOpen size={16} />;
                const Icon = config.icon;
                return <Icon size={16} />;
              })()
            ) : (
              <BookOpen size={16} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-medium truncate ${isDark ? "text-slate-100" : "text-gray-900"}`}
              >
                {graph.title}
              </span>
              {graph.template_type &&
                getTemplateTypeConfig(graph.template_type) &&
                (() => {
                  const config = getTemplateTypeConfig(graph.template_type);
                  if (!config) return null;
                  const Icon = config.icon;
                  return (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${config.bgColor} ${config.color}`}
                    >
                      <Icon size={10} />
                      <span>{templateTypeLabels[graph.template_type ?? ""]}</span>
                    </span>
                  );
                })()}
              {graph.is_favorite && (
                <Star
                  size={14}
                  className="text-yellow-500 flex-shrink-0"
                  fill="currentColor"
                />
              )}
            </div>
          </div>
        </div>
      </td>
      <td
        className={`px-4 py-3 hidden lg:table-cell ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        <span className="line-clamp-1 text-sm block">
          {graph.description || t("dashboard.card.noDescription")}
        </span>
        {(graph.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {graph.tags?.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(tag);
                }}
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  isDark
                    ? "bg-slate-700 text-primary-300"
                    : "bg-primary-50 text-primary-600"
                }`}
              >
                {tag}
              </button>
            ))}
            {(graph.tags?.length ?? 0) > MAX_VISIBLE_TAGS && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  isDark
                    ? "bg-slate-700 text-slate-400"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                +{(graph.tags?.length ?? 0) - MAX_VISIBLE_TAGS}
              </span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <div
          className={`flex items-center justify-center gap-1 text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
        >
          <Network size={14} />
          <span>{graph.nodes_count || 0}</span>
        </div>
      </td>
      <td
        className={`px-4 py-3 hidden md:table-cell ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        <div className="flex items-center gap-1.5 text-sm">
          <Calendar size={14} />
          <span>
            {graph.created_at
              ? formatDate(graph.created_at, 'short')
              : "-"}
          </span>
        </div>
      </td>
      <td
        className={`px-4 py-3 hidden xl:table-cell ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        <div className="flex items-center gap-1.5 text-sm">
          <Clock size={14} />
          <span>
            {graph.updated_at
              ? formatDate(graph.updated_at, 'short')
              : "-"}
          </span>
        </div>
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEditTags(graph);
            }}
            className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isDark
                ? "text-slate-400 hover:bg-primary-900/30 hover:text-primary-400"
                : "text-gray-400 hover:bg-primary-50 hover:text-primary-600"
            }`}
            title={t("dashboard.tagsEditor.title")}
            aria-label={t("dashboard.tagsEditor.title")}
          >
            <Tag size={18} aria-hidden="true" />
          </button>
          <Link
            to={`/graph/${graph.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isDark
                ? "text-slate-400 hover:bg-primary-900/30 hover:text-primary-400"
                : "text-gray-400 hover:bg-primary-50 hover:text-primary-600"
            }`}
            title={t("dashboard.card.openMindMap")}
            aria-label={t("dashboard.card.openMindMap")}
          >
            <Network size={18} aria-hidden="true" />
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(graph.id, graph.is_favorite || false);
            }}
            className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              graph.is_favorite
                ? "text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
                : isDark
                  ? "text-slate-400 hover:bg-yellow-900/30 hover:text-yellow-400"
                  : "text-gray-400 hover:bg-yellow-50 hover:text-yellow-500"
            }`}
            title={
              graph.is_favorite
                ? t("dashboard.card.unfavorite")
                : t("dashboard.card.favorite")
            }
            aria-label={
              graph.is_favorite
                ? t("dashboard.card.unfavorite")
                : t("dashboard.card.favorite")
            }
          >
            <Star
              size={16}
              fill={graph.is_favorite ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(graph.id, graph.title);
            }}
            className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isDark
                ? "text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                : "text-gray-400 hover:bg-red-50 hover:text-red-500"
            }`}
            title={t("dashboard.card.delete")}
            aria-label={t("dashboard.card.delete")}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
};
