import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  BookOpen,
  ExternalLink,
  FileText,
  Users,
  Calendar,
  Layers,
} from "lucide-react";
import { useError, useIsMobile } from "../../hooks";
import {
  BackboneModule,
  BACKBONE_MODULE_LABEL_I18N_KEYS,
  BACKBONE_MODULE_COLORS,
} from "@shared/types/graph";
import { graphsApi } from "../../services/api/graphs";
import { EmptyState } from "../common/EmptyState";

interface LiteratureItem {
  title: string;
  authors: string[];
  year: number;
  type: string;
  url: string;
  conceptCount: number;
  modules: string[];
}

interface LiteratureResponse {
  literature: LiteratureItem[];
  totalCount: number;
}

interface LiteratureLibraryPanelProps {
  graphId: string;
  onClose?: () => void;
  className?: string;
}

const ALL_MODULES = [
  BackboneModule.RESEARCH_BACKGROUND,
  BackboneModule.LITERATURE_REVIEW,
  BackboneModule.RESEARCH_METHODS,
  BackboneModule.CORE_CONCEPTS,
  BackboneModule.APPLICATION_DOMAINS,
  BackboneModule.FUTURE_DIRECTIONS,
];

const TYPE_LABEL_KEYS: Record<string, string> = {
  paper: "graphEditor.literatureLibrary.typeLabel.paper",
  book: "graphEditor.literatureLibrary.typeLabel.book",
  article: "graphEditor.literatureLibrary.typeLabel.article",
  report: "graphEditor.literatureLibrary.typeLabel.report",
  webpage: "graphEditor.literatureLibrary.typeLabel.webpage",
  document: "graphEditor.literatureLibrary.typeLabel.document",
};

const getTypeLabel = (type: string, t: TFunction): string => {
  const key = TYPE_LABEL_KEYS[type];
  return key ? t(key, { defaultValue: "" }) : type;
};

const getTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    paper: "var(--primary-500)",
    book: "var(--tertiary-500)",
    article: "#10B981",
    report: "#F59E0B",
    webpage: "#EC4899",
    document: "var(--secondary-500)",
  };
  return colors[type] || "var(--gray-500)";
};

export const LiteratureLibraryPanel: React.FC<LiteratureLibraryPanelProps> = ({
  graphId,
  onClose,
  className = "",
}) => {
  const { t } = useTranslation();
  const { isMobile } = useIsMobile();
  const { handleError } = useError();
  const [data, setData] = useState<LiteratureResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  const fetchLiterature = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await graphsApi.getLiterature(
        graphId,
        activeModule || undefined,
      );
      setData(result);
    } catch (error: unknown) {
      handleError(error, { context: "literature_library_fetch" });
    } finally {
      setIsLoading(false);
    }
  }, [graphId, activeModule, handleError]);

  useEffect(() => {
    fetchLiterature();
  }, [fetchLiterature]);

  const moduleOptions = [
    { value: null, label: t("literatureExtract.allModules") },
    ...ALL_MODULES.map((m) => ({
      value: m,
      label: t(BACKBONE_MODULE_LABEL_I18N_KEYS[m]),
    })),
  ];

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
            isMobile ? "max-w-lg" : "max-w-3xl"
          }`}
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <BookOpen
                  className="text-amber-600 dark:text-amber-400"
                  size={20}
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {t("graphEditor.literatureLibrary.title")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("graphEditor.literatureLibrary.subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isLoading && data && (
                <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                  {t("graphEditor.literatureLibrary.totalCount", {
                    count: data.totalCount,
                  })}
                </span>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-target flex items-center justify-center"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
          </div>

          <div className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-500/50">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {moduleOptions.map((option) => (
                <button
                  key={option.value || "all"}
                  onClick={() => setActiveModule(option.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    activeModule === option.value
                      ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
              </div>
            )}

            {!isLoading && (!data || data.literature.length === 0) && (
              <EmptyState
                icon={<BookOpen size={32} />}
                title={t('graphEditor.empty.literatureEmpty')}
              />
            )}

            {!isLoading && data && data.literature.length > 0 && (
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm"
                  aria-label={t("graphEditor.literatureLibrary.tableAriaLabel")}
                >
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-500">
                      <th scope="col" className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("graphEditor.literatureLibrary.colTitle")}
                      </th>
                      <th scope="col" className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                        {t("graphEditor.literatureLibrary.colAuthors")}
                      </th>
                      <th scope="col" className="text-center py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">
                        {t("graphEditor.literatureLibrary.colYear")}
                      </th>
                      <th scope="col" className="text-center py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell w-16">
                        {t("graphEditor.literatureLibrary.colType")}
                      </th>
                      <th scope="col" className="text-center py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">
                        {t("graphEditor.literatureLibrary.colConcepts")}
                      </th>
                      <th scope="col" className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                        {t("graphEditor.literatureLibrary.colModules")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {data.literature.map((item, index) => (
                      <tr
                        key={item.title + index}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <FileText
                              size={14}
                              className="text-slate-400 flex-shrink-0"
                            />
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 dark:text-primary-400 underline truncate max-w-[200px] md:max-w-[300px] flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="truncate">{item.title}</span>
                                <ExternalLink
                                  size={12}
                                  className="flex-shrink-0"
                                />
                              </a>
                            ) : (
                              <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px] md:max-w-[300px]">
                                {item.title}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Users
                              size={12}
                              className="text-slate-400 flex-shrink-0"
                            />
                            <span className="text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                              {item.authors.length > 0
                                ? item.authors.join(", ")
                                : "-"}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Calendar size={12} />
                            {item.year || "-"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                          <span
                            className="inline-flex px-2 py-0.5 text-xs rounded-full font-medium"
                            style={{
                              backgroundColor: `${getTypeColor(item.type)}20`,
                              color: getTypeColor(item.type),
                            }}
                          >
                            {getTypeLabel(item.type, t)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <Layers size={12} />
                            {item.conceptCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 hidden lg:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {item.modules.map((module) => (
                              <span
                                key={module}
                                className="inline-flex px-1.5 py-0.5 text-xs rounded-full font-medium"
                                style={{
                                  backgroundColor: `${
                                    BACKBONE_MODULE_COLORS[module as BackboneModule] || "var(--gray-500)"
                                  }20`,
                                  color:
                                    BACKBONE_MODULE_COLORS[module as BackboneModule] ||
                                    "var(--gray-500)",
                                }}
                              >
                                {t(BACKBONE_MODULE_LABEL_I18N_KEYS[module as BackboneModule]) ||
                                  module}
                              </span>
                            ))}
                            {item.modules.length === 0 && (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isLoading && data && data.totalCount > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-500 p-4 bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                <BookOpen size={14} className="mr-2" />
                {t("graphEditor.literatureLibrary.footer", {
                  count: data.totalCount,
                })}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};