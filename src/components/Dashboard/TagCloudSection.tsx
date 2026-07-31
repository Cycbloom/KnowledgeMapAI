import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Tag, X } from "lucide-react";
import { api } from "../../services/api";

const TAG_COLORS = [
  "bg-primary-500",
  "bg-green-500",
  "bg-primary-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-primary-500",
  "bg-primary-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
];

const getTagColor = (tagName: string): string => {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

interface TagCloudSectionProps {
  isDark: boolean;
  isMobile: boolean;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export const TagCloudSection: React.FC<TagCloudSectionProps> = ({
  isDark,
  isMobile,
  selectedTags,
  onTagsChange,
}) => {
  const [showAll, setShowAll] = useState(false);
  const { t } = useTranslation();

  const { data: tagsData } = useQuery({
    queryKey: ["graphTags"],
    queryFn: async () => {
      const res = await api.graphs.getTags();
      return ((res as unknown) as { tags?: { name: string; count: number }[] })
        .tags || [];
    },
  });

  const allTags = useMemo(() => {
    return tagsData || [];
  }, [tagsData]);

  const maxCount = useMemo(() => {
    return Math.max(
      ...allTags.map((t: { name: string; count: number }) => t.count),
      1,
    );
  }, [allTags]);

  const defaultDisplayCount = isMobile ? 10 : 20;

  const displayedTags = useMemo(() => {
    return showAll ? allTags : allTags.slice(0, defaultDisplayCount);
  }, [allTags, showAll, defaultDisplayCount]);

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearSelection = () => {
    onTagsChange([]);
  };

  if (!allTags || allTags.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-6 ${
        isDark
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-gray-100 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className={`p-2 sm:p-2.5 rounded-xl ${isDark ? "bg-primary-900/30 text-primary-400" : "bg-primary-50 text-primary-600"}`}
          >
            <Tag size={isMobile ? 18 : 20} />
          </div>
          <div>
            <h3
              className={`text-base sm:text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}
            >
              {t('dashboard.tagCloud.title')}
            </h3>
            <p
              className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {t('dashboard.tagCloud.totalCount', { count: allTags.length })}
            </p>
          </div>
        </div>

        {selectedTags.length > 0 && (
          <button
            onClick={clearSelection}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
              isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <X size={14} />
            <span className="hidden sm:inline">{t('dashboard.tagCloud.clearFilter')}</span>
            <span className="sm:hidden">{t('dashboard.tagCloud.clearShort')}</span>
            <span>({selectedTags.length})</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {displayedTags.map((tag: { name: string; count: number }) => {
          const isSelected = selectedTags.includes(tag.name);
          const size = isMobile ? 0.75 : 0.75 + (tag.count / maxCount) * 0.5;

          return (
            <button
              key={tag.name}
              onClick={() => handleTagClick(tag.name)}
              className={`
                inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-full
                transition-all hover:scale-105 min-h-[44px] sm:min-h-0
                ${
                  isSelected
                    ? `${getTagColor(tag.name)} text-white shadow-lg ring-2 ring-white ring-opacity-50`
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
              style={{ fontSize: `${size}rem` }}
            >
              <span className="font-medium">{tag.name}</span>
              <span
                className={`text-xs ${isSelected ? "text-white/80" : isDark ? "text-slate-500" : "text-gray-400"}`}
              >
                {tag.count}
              </span>
            </button>
          );
        })}
      </div>

      {allTags.length > defaultDisplayCount && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`mt-3 sm:mt-4 w-full py-2 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors min-h-[44px] sm:min-h-0 ${
            isDark
              ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {showAll ? t('dashboard.tagCloud.collapse') : t('dashboard.tagCloud.viewAll', { count: allTags.length })}
        </button>
      )}
    </div>
  );
};
