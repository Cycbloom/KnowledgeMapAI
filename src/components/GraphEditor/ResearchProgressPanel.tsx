import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  AlertTriangle,
  FileText,
  BarChart3,
  BookOpen,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { useError, useIsMobile } from "../../hooks";
import { graphsApi } from "../../services/api/graphs";

interface ModuleStat {
  module_type: string;
  title: string;
  icon: string;
  color: string;
  nodeCount: number;
  literatureCount: number;
}

interface ResearchProgressData {
  modules: ModuleStat[];
  totalNodes: number;
  totalLiterature: number;
}

interface ResearchProgressPanelProps {
  graphId: string;
  onClose?: () => void;
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  Search: Layers,
  BookOpen,
  FlaskConical: Layers,
  Beaker: Layers,
  Microscope: Layers,
  Lightbulb: Layers,
  Compass: Layers,
};

const getIconComponent = (iconName: string): LucideIcon => {
  return iconMap[iconName] || Layers;
};

export const ResearchProgressPanel: React.FC<ResearchProgressPanelProps> = ({
  graphId,
  onClose,
  className = "",
}) => {
  const { t } = useTranslation();
  const { isMobile } = useIsMobile();
  const { handleError } = useError();
  const [data, setData] = useState<ResearchProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await graphsApi.getResearchProgress(graphId);
      setData(result);
    } catch (error: unknown) {
      handleError(error, { context: "research_progress_fetch" });
    } finally {
      setIsLoading(false);
    }
  }, [graphId, handleError]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const maxNodeCount =
    data && data.modules.length > 0
      ? Math.max(...data.modules.map((m) => m.nodeCount), 1)
      : 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm ${className}`}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-h-[85vh] overflow-hidden flex flex-col ${
            isMobile ? "max-w-lg" : "max-w-xl"
          }`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <BarChart3 className="text-primary-600 dark:text-primary-400" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {t("graphEditor.researchProgress.title")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("graphEditor.researchProgress.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            )}

            {!isLoading && (!data || data.modules.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                <BookOpen size={48} className="mb-3 opacity-50" />
                <p className="text-sm">
                  {t("graphEditor.researchProgress.noModules")}
                </p>
              </div>
            )}

            {!isLoading && data && data.modules.length > 0 && (
              <div className="space-y-4">
                {data.modules.map((module) => {
                  const IconComp = getIconComponent(module.icon);
                  const isEmpty = module.nodeCount === 0;
                  const barWidth = Math.max(
                    (module.nodeCount / maxNodeCount) * 100,
                    isEmpty ? 0 : 4,
                  );

                  return (
                    <div
                      key={module.module_type}
                      className={`rounded-lg border p-4 transition-colors ${
                        isEmpty
                          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                          : "border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{
                            backgroundColor: isEmpty
                              ? "transparent"
                              : `${module.color}20`,
                            border: isEmpty
                              ? "2px dashed var(--amber-500)"
                              : "none",
                          }}
                        >
                          <IconComp
                            size={18}
                            color={isEmpty ? "var(--amber-500)" : module.color}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {module.title}
                            </h3>
                            {isEmpty && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 rounded-full">
                                <AlertTriangle size={10} />
                                {t("graphEditor.researchProgress.researchGap")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            {t("graphEditor.researchProgress.nodes")}
                          </span>
                          <span
                            className={`font-semibold ${
                              isEmpty
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {module.nodeCount}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: isEmpty
                                ? "var(--amber-500)"
                                : module.color,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">
                            {t("graphEditor.researchProgress.literature")}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <FileText size={12} />
                            {module.literatureCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!isLoading && data && data.totalNodes > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-500 p-5 bg-slate-50 dark:bg-slate-800/80">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {data.totalNodes}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t("graphEditor.researchProgress.totalNodes")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {data.totalLiterature}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t("graphEditor.researchProgress.totalLiterature")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};