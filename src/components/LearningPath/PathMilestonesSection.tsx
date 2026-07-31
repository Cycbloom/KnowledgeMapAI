import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, ChevronDown, Trophy } from "lucide-react";
import { formatDate as formatDateUtil } from "../../utils/formatters";
import { useTranslation } from "react-i18next";
import type { LearningPathMilestone } from "./types";

interface PathMilestonesSectionProps {
  milestones: LearningPathMilestone[];
  expandedSections: Set<string>;
  onToggleSection: (section: string) => void;
}

const PathMilestonesSection: React.FC<PathMilestonesSectionProps> = ({
  milestones,
  expandedSections,
  onToggleSection,
}) => {
  const { t } = useTranslation();
  if (milestones.length === 0) return null;

  const formatDate = (dateStr: string) => formatDateUtil(dateStr);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => onToggleSection("milestones")}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
      >
        <div className="flex items-center gap-3">
          <Flag className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {t('learningPath.milestonesSection.title')}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            (
            {milestones.filter((m) => m.is_completed).length}
            /{milestones.length})
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has("milestones") ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expandedSections.has("milestones") && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4 space-y-3">
              {milestones.map((milestone) => (
                <div
                  key={milestone.id}
                  className={`p-4 rounded-lg border dark:border-slate-500 ${
                    milestone.is_completed
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "bg-gray-50 dark:bg-slate-700/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 ${milestone.is_completed ? "text-green-500" : "text-gray-400"}`}
                      >
                        {milestone.is_completed ? (
                          <Trophy className="w-5 h-5" />
                        ) : (
                          <Flag className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {milestone.title}
                        </h3>
                        {milestone.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {milestone.description}
                          </p>
                        )}
                        {milestone.target_date && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {t('learningPath.milestonesSection.targetDateLabel')}
                            {formatDate(milestone.target_date)}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium ${milestone.is_completed ? "text-green-500" : "text-gray-500 dark:text-gray-400"}`}
                    >
                      {milestone.progress}%
                    </span>
                  </div>
                  <div className="mt-3">
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(milestone.progress)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t('common.aria.progress')}
                      className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden"
                    >
                      <div
                        className={`h-full transition-all ${milestone.is_completed ? "bg-green-500" : "bg-primary-500"}`}
                        style={{ width: `${milestone.progress}%` }}
                      />
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

export default PathMilestonesSection;
