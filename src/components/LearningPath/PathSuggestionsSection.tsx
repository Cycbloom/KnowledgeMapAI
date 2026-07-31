import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUGGESTION_ICONS, type LearningPathSuggestion } from "./types";

interface PathSuggestionsSectionProps {
  suggestions: LearningPathSuggestion[];
  expandedSections: Set<string>;
  onToggleSection: (section: string) => void;
}

const PathSuggestionsSection: React.FC<PathSuggestionsSectionProps> = ({
  suggestions,
  expandedSections,
  onToggleSection,
}) => {
  const { t } = useTranslation();
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => onToggleSection("suggestions")}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {t('learningPath.suggestionsSection.title')}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has("suggestions") ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expandedSections.has("suggestions") && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4 space-y-2">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border dark:border-slate-500 ${
                    suggestion.priority === "high"
                      ? "bg-red-50 dark:bg-red-900/20"
                      : suggestion.priority === "medium"
                        ? "bg-yellow-50 dark:bg-yellow-900/20"
                        : "bg-gray-50 dark:bg-slate-700/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 ${
                        suggestion.priority === "high"
                          ? "text-red-500"
                          : suggestion.priority === "medium"
                            ? "text-yellow-500"
                            : "text-gray-400"
                      }`}
                    >
                      {SUGGESTION_ICONS[suggestion.type] || (
                        <AlertCircle className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {suggestion.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {suggestion.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PathSuggestionsSection;
