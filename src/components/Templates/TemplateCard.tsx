import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { Template, TemplateCategory } from "../../types";
import { GraduationCap, Briefcase, Search, Layers } from "lucide-react";
import { useTheme, useIsMobile } from "../../hooks";

interface TemplateCardProps {
  template: Template;
  isSelected?: boolean;
  onClick: () => void;
}

const categoryIcons: Record<TemplateCategory, React.ReactNode> = {
  knowledge: <GraduationCap size={20} />,
  project: <Briefcase size={20} />,
  analysis: <Search size={20} />,
  architecture: <Layers size={20} />,
};

const getCategoryColors = (
  isDark: boolean,
): Record<TemplateCategory, string> => {
  if (isDark) {
    return {
      knowledge: "bg-primary-900/50 text-primary-400 border-primary-800",
      project: "bg-green-900/50 text-green-400 border-green-800",
      analysis: "bg-amber-900/50 text-amber-400 border-amber-800",
      architecture: "bg-primary-900/50 text-primary-400 border-primary-800",
    };
  }
  return {
    knowledge: "bg-primary-50 text-primary-600 border-primary-200",
    project: "bg-green-50 text-green-600 border-green-200",
    analysis: "bg-amber-50 text-amber-600 border-amber-200",
    architecture: "bg-primary-50 text-primary-600 border-primary-200",
  };
};

const TemplateCardComponent: React.FC<TemplateCardProps> = ({
  template,
  isSelected = false,
  onClick,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const categoryColors = getCategoryColors(isDark);

  return (
    <div
      onClick={onClick}
      className={`relative ${isMobile ? "p-3" : "p-5"} rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
        isSelected
          ? isDark
            ? "border-primary-500 bg-primary-900/30 shadow-lg shadow-primary-500/20"
            : "border-primary-500 bg-primary-50/50 shadow-lg shadow-primary-500/20"
          : isDark
            ? "border-slate-700 bg-slate-800 hover:border-slate-600 hover:shadow-md"
            : "border-gray-200 bg-white hover:border-primary-300 hover:shadow-md"
      }`}
    >
      {template.is_system && (
        <div
          className={`absolute ${isMobile ? "top-2 right-2" : "top-3 right-3"}`}
        >
          <span
            className={`font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 ${isMobile ? "text-[10px]" : "text-xs"}`}
          >
            {t("templates.system")}
          </span>
        </div>
      )}

      <div
        className={`flex items-start gap-2 md:gap-3 ${isMobile ? "mb-2" : "mb-3"}`}
      >
        <div
          className={`${isMobile ? "p-2" : "p-2.5"} rounded-xl ${categoryColors[template.category]}`}
        >
          {categoryIcons[template.category]}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={`font-bold truncate ${isMobile ? "text-sm" : ""} ${isDark ? "text-white" : "text-gray-900"}`}
          >
            {template.name}
          </h3>
          <span
            className={`${isMobile ? "text-[10px]" : "text-xs"} ${isDark ? "text-slate-500" : "text-gray-500"}`}
          >
            {t(`templates.category.${template.category}`)}
            {t("templates.template")}
          </span>
        </div>
      </div>

      <p
        className={`${isMobile ? "text-xs line-clamp-1" : "text-sm line-clamp-2"} ${isMobile ? "" : "mb-3"} ${isDark ? "text-slate-400" : "text-gray-600"}`}
      >
        {template.description || t("common.noData")}
      </p>

      <div
        className={`flex items-center justify-between ${isMobile ? "text-[10px]" : "text-xs"} ${isDark ? "text-slate-500" : "text-gray-500"}`}
      >
        <span>
          {t("templates.nodeCount", { count: template.nodes?.length ?? 0 })}
        </span>
        {template.layout && (
          <span
            className={`px-2 py-1 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-100"}`}
          >
            {template.layout.type}
          </span>
        )}
      </div>
    </div>
  );
};

export const TemplateCard = memo(TemplateCardComponent);
