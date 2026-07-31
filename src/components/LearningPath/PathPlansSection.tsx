import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronDown, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDate as formatDateUtil } from "../../utils/formatters";
import type { LearningPathPlan } from "./types";

interface PathPlansSectionProps {
  plans: LearningPathPlan[];
  expandedSections: Set<string>;
  onToggleSection: (section: string) => void;
}

const PathPlansSection: React.FC<PathPlansSectionProps> = ({
  plans,
  expandedSections,
  onToggleSection,
}) => {
  const { t } = useTranslation();
  if (plans.length === 0) return null;

  const formatDate = (dateStr: string) => formatDateUtil(dateStr);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => onToggleSection("plans")}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50"
      >
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary-500" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {t('learningPath.plansSection.title')}
          </span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.has("plans") ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expandedSections.has("plans") && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4 space-y-2 max-h-80 overflow-y-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-3 rounded-lg border dark:border-slate-500 ${
                    plan.completed
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "bg-gray-50 dark:bg-slate-700/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(plan.date)}
                    </span>
                    {plan.completed && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('learningPath.plansSection.planNodesCount', { count: plan.planned_nodes.length })}
                    {plan.estimated_minutes &&
                      ` · ${t('learningPath.plansSection.minutesSuffix', { count: plan.estimated_minutes })}`}
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

export default PathPlansSection;
