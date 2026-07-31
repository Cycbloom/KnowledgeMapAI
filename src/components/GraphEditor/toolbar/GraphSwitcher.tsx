import React, { useState, useEffect, useRef, useMemo, useId } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, Star, Network } from "lucide-react";
import { useTheme, useMenuNavigation } from "../../../hooks";
import { useRecentGraphs, type RecentGraphEntry } from "../../../hooks/queries/useRecentGraphs";

interface GraphSwitcherProps {
  currentGraphId?: string;
  currentGraphTitle?: string;
}

export const GraphSwitcher: React.FC<GraphSwitcherProps> = ({
  currentGraphId,
  currentGraphTitle,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { getRecentGraphs } = useRecentGraphs();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const recentGraphs = useMemo(() => getRecentGraphs(), [getRecentGraphs]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (graphId: string) => {
    setIsOpen(false);
    if (graphId !== currentGraphId) {
      navigate(`/graph/${graphId}`);
    }
  };

  const otherGraphs = recentGraphs.filter((g) => g.id !== currentGraphId);

  const { activeIndex } = useMenuNavigation({
    itemCount: otherGraphs.length,
    enabled: isOpen,
    onSelect: (index: number) => {
      const graph = otherGraphs[index];
      if (graph) handleSelect(graph.id);
    },
    onClose: () => setIsOpen(false),
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all max-w-[220px] ${
          isOpen
            ? isDark
              ? "bg-slate-700 text-primary-400"
              : "bg-gray-100 text-primary-600"
            : isDark
              ? "text-gray-300 hover:bg-slate-700"
              : "text-gray-600 hover:bg-gray-100"
        }`}
        title={currentGraphTitle ?? t("graphEditor.switcher.placeholder")}
      >
        <Network size={16} className="flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          {currentGraphTitle ?? t("graphEditor.switcher.placeholder")}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          id={menuId}
          className={`absolute top-full left-0 mt-1 p-1.5 rounded-xl shadow-2xl border w-56 z-50 ${
            isDark
              ? "bg-slate-800 border-slate-700 text-gray-100"
              : "bg-white border-gray-200 text-gray-800"
          } animate-in fade-in zoom-in-95 duration-150`}
        >
          {otherGraphs.length === 0 ? (
            <div
              className={`px-3 py-4 text-center text-sm ${
                isDark ? "text-slate-500" : "text-gray-400"
              }`}
            >
              {t("graphEditor.switcher.noRecent")}
            </div>
          ) : (
            otherGraphs.map((graph: RecentGraphEntry, index: number) => (
              <button
                key={graph.id}
                onClick={() => handleSelect(graph.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  index === activeIndex
                    ? isDark
                      ? "bg-slate-700 text-primary-400"
                      : "bg-gray-100 text-primary-600"
                    : isDark
                      ? "hover:bg-slate-700 text-gray-300"
                      : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <Network size={14} className="flex-shrink-0 opacity-50" />
                <span className="flex-1 truncate text-left">{graph.topic}</span>
                {graph.is_favorite && (
                  <Star
                    size={12}
                    className="flex-shrink-0 text-amber-400 fill-amber-400"
                  />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
