import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import type { KnowledgePoint } from "@shared/types";

export interface KnowledgePointWithStatus extends KnowledgePoint {
  lastStudiedAt?: string;
  studyCount?: number;
  masteryLevel?: number;
}

interface KnowledgePointCardProps {
  kp: KnowledgePointWithStatus;
  onClick: (id: string) => void;
}

export const KnowledgePointCard: React.FC<KnowledgePointCardProps> = ({ kp, onClick }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all cursor-pointer"
      onClick={() => onClick(kp.id)}
    >
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
          <BookOpen size={14} className="text-primary-500 dark:text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {kp.title}
          </h4>
          {kp.content && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
              {kp.content}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span>{t("unifiedWorkbench.labels.recentStudy")}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
