import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { EmptyState } from "../common/EmptyState";

export interface WeakPoint {
  nodeId: string;
  nodeTitle: string;
  graphTitle: string;
  mastery: number;
  reviewCount: number;
  nextReview: string | null;
  priority: "high" | "medium" | "low";
  suggestion: string;
}

export interface Prediction {
  date: string;
  reviewCount: number;
  newCards: number;
  difficulty: "easy" | "medium" | "hard";
}

interface WeakPointAnalysisProps {
  isDark: boolean;
  weakPoints: WeakPoint[];
  predictions: Prediction[];
}

export const WeakPointAnalysis = ({
  isDark,
  weakPoints,
  predictions,
}: WeakPointAnalysisProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Weak Points */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-6 rounded-2xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
      >
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={20} />
          {t("study.weakPoints.title")}
        </h3>
        {weakPoints.length === 0 ? (
          <EmptyState
            variant="inline"
            title={t("study.weakPoint.empty.title")}
            description={t("study.weakPoint.empty.description")}
          />
        ) : (
          <div className="space-y-3">
            {weakPoints.slice(0, 5).map((point, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate flex-1">
                    {point.nodeTitle}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      point.priority === "high"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : point.priority === "medium"
                          ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    }`}
                  >
                    {point.priority === "high"
                      ? t("study.priority.high")
                      : point.priority === "medium"
                        ? t("study.priority.medium")
                        : t("study.priority.low")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(point.mastery)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('common.aria.progress')}
                    className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full"
                      style={{ width: `${point.mastery}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {point.mastery}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Predictions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`p-6 rounded-2xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
      >
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="text-primary-500" size={20} />
          {t("study.predictions.title")}
        </h3>
        {predictions.length === 0 ? (
          <p
            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            {t("study.predictions.empty")}
          </p>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {predictions.slice(0, 7).map((pred, idx) => {
              const date = new Date(pred.date);
              const dayName = [
                t("study.days.sun"),
                t("study.days.mon"),
                t("study.days.tue"),
                t("study.days.wed"),
                t("study.days.thu"),
                t("study.days.fri"),
                t("study.days.sat"),
              ][date.getDay()];
              const isToday =
                new Date().toDateString() === date.toDateString();

              return (
                <div
                  key={idx}
                  className={`text-center p-2 rounded-xl ${
                    isToday
                      ? isDark
                        ? "bg-primary-900/30 ring-2 ring-primary-500"
                        : "bg-primary-50 ring-2 ring-primary-300"
                      : isDark
                        ? "bg-slate-700/50"
                        : "bg-gray-50"
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${isToday ? "text-primary-500" : isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {dayName}
                  </p>
                  <p
                    className={`text-lg font-bold ${isToday ? "text-primary-500" : ""}`}
                  >
                    {pred.reviewCount}
                  </p>
                  <div
                    className={`w-2 h-2 rounded-full mx-auto mt-1 ${
                      pred.difficulty === "easy"
                        ? "bg-green-500"
                        : pred.difficulty === "medium"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};
