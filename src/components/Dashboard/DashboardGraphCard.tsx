import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Network,
  ArrowRight,
  Star,
  Trash2,
  Check,
} from "lucide-react";
import type { Graph } from "@shared/types";

const TEMPLATE_TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  topic_research: {
    icon: () => null,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "专题研究",
  },
  knowledge_tree: {
    icon: () => null,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "知识树",
  },
  learning_path: {
    icon: () => null,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "学习路径",
  },
  concept_network: {
    icon: () => null,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "概念网络",
  },
  skill_map: {
    icon: () => null,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "技能图谱",
  },
  project_lifecycle: {
    icon: () => null,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    label: "项目生命周期",
  },
  story_creation: {
    icon: () => null,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    label: "小说/故事创作",
  },
};

const getTemplateTypeConfig = (templateType?: string) => {
  if (!templateType) return null;
  return TEMPLATE_TYPE_CONFIG[templateType] || null;
};

interface DashboardGraphCardProps {
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
}

export const DashboardGraphCard: React.FC<DashboardGraphCardProps> = ({
  graph,
  isDark,
  isMobile,
  isSelectMode,
  isSelected,
  onToggleSelect,
  onNavigate,
  onDelete,
  onToggleFavorite,
  onPrefetch,
}) => {
  const { t } = useTranslation();

  return (
    <div
      onMouseEnter={() => onPrefetch(graph.id)}
      className={`group relative rounded-2xl transition-all duration-300 ${
        isSelectMode
          ? isSelected
            ? isDark
              ? "bg-primary-900/20 border-2 border-primary-500"
              : "bg-primary-50 border-2 border-primary-400"
            : isDark
              ? "bg-slate-800 border border-slate-700 hover:border-slate-600"
              : "bg-white border border-gray-100 hover:border-gray-200"
          : "hover:-translate-y-1"
      } ${
        !isSelectMode &&
        (isDark
          ? "bg-slate-800 border border-slate-700 hover:border-slate-600 hover:shadow-xl hover:shadow-black/20"
          : "bg-white border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-xl hover:shadow-primary-500/5")
      }`}
    >
      {/* Selection Checkbox - Select Mode */}
      {isSelectMode && (
        <div
          className="absolute top-3 left-3 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(graph.id);
          }}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all ${
              isSelected
                ? "bg-primary-500 text-white"
                : isDark
                  ? "bg-slate-700 border border-slate-600 hover:border-primary-500"
                  : "bg-white border border-gray-300 hover:border-primary-500"
            }`}
          >
            {isSelected && <Check size={14} />}
          </div>
        </div>
      )}

      {/* Card Content */}
      <div
        onClick={() => {
          if (isSelectMode) {
            onToggleSelect(graph.id);
          } else {
            onNavigate(graph.id);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            if (isSelectMode) {
              onToggleSelect(graph.id);
            } else {
              onNavigate(graph.id);
            }
          }
        }}
        tabIndex={0}
        role="button"
        className="block p-4 sm:p-6 h-full flex flex-col cursor-pointer"
      >
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div
            className={`p-2.5 sm:p-3.5 rounded-xl transition-colors ${
              isSelectMode && isSelected
                ? "bg-primary-500 text-white"
                : graph.template_type &&
                    getTemplateTypeConfig(graph.template_type)
                  ? isDark
                    ? `${getTemplateTypeConfig(graph.template_type)?.bgColor} ${getTemplateTypeConfig(graph.template_type)?.color} group-hover:bg-primary-600 group-hover:text-white`
                    : `${getTemplateTypeConfig(graph.template_type)?.bgColor} ${getTemplateTypeConfig(graph.template_type)?.color} group-hover:bg-primary-600 group-hover:text-white`
                  : isDark
                    ? "bg-primary-900/30 text-primary-400 group-hover:bg-primary-600 group-hover:text-white"
                    : "bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white"
            }`}
          >
            {graph.template_type &&
            getTemplateTypeConfig(graph.template_type) ? (
              (() => {
                const config = getTemplateTypeConfig(graph.template_type);
                if (!config) return <BookOpen size={isMobile ? 20 : 24} />;
                const Icon = config.icon;
                return <Icon size={isMobile ? 20 : 24} />;
              })()
            ) : (
              <BookOpen size={isMobile ? 20 : 24} />
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {!isMobile && !isSelectMode && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
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
                  <Trash2 size={18} aria-hidden="true" />
                </button>
                {!graph.is_favorite && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleFavorite(graph.id, false);
                    }}
                    className={`p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                      isDark
                        ? "text-slate-400 hover:bg-yellow-900/30 hover:text-yellow-400"
                        : "text-gray-400 hover:bg-yellow-50 hover:text-yellow-500"
                    }`}
                    title={t("dashboard.card.favorite")}
                    aria-label={t("dashboard.card.favorite")}
                  >
                    <Star size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {isMobile && (
              <>
                <Link
                  to={`/graph/${graph.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
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
                    onDelete(graph.id, graph.title);
                  }}
                  className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    isDark
                      ? "text-slate-400 hover:bg-red-900/30 hover:text-red-400"
                      : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                  }`}
                  title={t("dashboard.card.delete")}
                  aria-label={t("dashboard.card.delete")}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </>
            )}

            {graph.is_favorite && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(graph.id, true);
                }}
                className={`p-2 rounded-lg text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors ${isMobile ? "min-h-[44px] min-w-[44px] flex items-center justify-center" : ""}`}
                title={t("dashboard.card.unfavorite")}
                aria-label={t("dashboard.card.unfavorite")}
              >
                <Star size={18} fill="currentColor" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <h3
          className={`text-base sm:text-xl font-bold mb-2 line-clamp-1 group-hover:text-primary-500 transition-colors ${
            isDark ? "text-slate-100" : "text-gray-900"
          }`}
        >
          {graph.title}
          {graph.template_type &&
            getTemplateTypeConfig(graph.template_type) &&
            (() => {
              const config = getTemplateTypeConfig(graph.template_type);
              if (!config) return null;
              const Icon = config.icon;
              return (
                <span
                  className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
                >
                  <Icon size={12} />
                  <span className="hidden sm:inline">
                    {config.label}
                  </span>
                </span>
              );
            })()}
        </h3>

        <p
          className={`text-xs sm:text-sm line-clamp-2 mb-4 sm:mb-6 flex-grow ${
            isDark ? "text-slate-400" : "text-gray-500"
          }`}
        >
          {graph.description || t("dashboard.card.noDescription")}
        </p>

        <div
          className={`pt-3 sm:pt-4 mt-auto border-t flex items-center justify-between ${
            isDark ? "border-slate-700" : "border-gray-50"
          }`}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${
                isDark ? "text-slate-400" : "text-gray-500"
              }`}
            >
              <Network size={14} />
              <span>
                {graph.nodes_count || 0} {t("dashboard.card.nodes")}
              </span>
            </div>
          </div>

          <div
            className={`flex items-center gap-1 text-xs font-bold transition-colors ${
              isDark
                ? "text-primary-400 group-hover:text-primary-300"
                : "text-primary-600 group-hover:text-primary-700"
            }`}
          >
            <span>{t("dashboard.card.enterOutline")}</span>
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
