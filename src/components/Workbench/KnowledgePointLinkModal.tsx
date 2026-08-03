import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, BookOpen } from "lucide-react";
import type { KnowledgePoint } from "@shared/types";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";

interface KnowledgePointLinkModalProps {
  linkingTaskId: string | null;
  knowledgePointSearch: string;
  searchResults: KnowledgePoint[];
  onSearchChange: (value: string) => void;
  onLink: (taskId: string, knowledgePointId: string) => void;
  onClose: () => void;
}

export const KnowledgePointLinkModal: React.FC<KnowledgePointLinkModalProps> = ({
  linkingTaskId,
  knowledgePointSearch,
  searchResults,
  onSearchChange,
  onLink,
  onClose,
}) => {
  const { t } = useTranslation();

  const isOpen = !!linkingTaskId;
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);
  const titleId = useId();

  return (
    <AnimatePresence>
      {linkingTaskId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 size={18} className="text-primary-500 dark:text-primary-400" aria-hidden="true" />
                  <h3 id={titleId} className="font-bold text-slate-900 dark:text-white">{t("unifiedWorkbench.actions.linkKnowledgePoint")}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label={t("common.aria.close")}
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="relative">
                <input
                  type="text"
                  value={knowledgePointSearch}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t("unifiedWorkbench.tips.searchKnowledgePlaceholder")}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                <BookOpen size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              </div>

              <div className="mt-4 max-h-64 overflow-y-auto custom-scrollbar space-y-2">
                {searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                    <BookOpen size={24} className="mb-2 opacity-50" aria-hidden="true" />
                    <p className="text-sm">{t("unifiedWorkbench.tips.searchKnowledgeHint")}</p>
                  </div>
                ) : (
                  searchResults.map((kp) => (
                    <button
                      key={kp.id}
                      onClick={() => onLink(linkingTaskId, kp.id)}
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-500 hover:border-primary-300 dark:hover:border-primary-500/50 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all text-left"
                    >
                      <h4 className="font-medium text-slate-900 dark:text-white">{kp.title}</h4>
                      {kp.content && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {kp.content}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
