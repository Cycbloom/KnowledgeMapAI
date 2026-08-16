import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X,
  Type,
  BookOpen,
  RefreshCcw,
  Sun,
  Eye,
  Scroll,
  FileText,
  Settings,
  Zap,
  GripHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useLearningSettingsStore } from "../../store/useLearningSettingsStore";
import { useShallow } from "zustand/react/shallow";
import { useIsMobile, useFocusTrap, useEscapeKey } from "../../hooks";

interface LearningSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LearningSettingsPanel: React.FC<LearningSettingsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    fontSize,
    readingMode,
    paginationMode,
    contentWidthMode,
    setFontSize,
    setReadingMode,
    setPaginationMode,
    setContentWidthMode,
    resetSettings,
  } = useLearningSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      readingMode: s.readingMode,
      paginationMode: s.paginationMode,
      contentWidthMode: s.contentWidthMode,
      setFontSize: s.setFontSize,
      setReadingMode: s.setReadingMode,
      setPaginationMode: s.setPaginationMode,
      setContentWidthMode: s.setContentWidthMode,
      resetSettings: s.resetSettings,
    })),
  );

  const { t } = useTranslation();
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const titleId = useId();
  const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleManagePrompts = () => {
    onClose();
    navigate("/settings#prompts");
  };

  const renderContent = () => (
    <>
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-500 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-500/20">
            <Settings size={18} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h3
            id={titleId}
            className="text-lg font-semibold text-slate-800 dark:text-white"
          >
            {t("learning.settings.readingSettings")}
          </h3>
        </div>
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          aria-label={t('common.aria.close')}
          className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
        >
          <X size={20} />
        </motion.button>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="p-6 space-y-6 overflow-y-auto h-full">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Type
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("learning.settings.fontSize")}
              </span>
              <span className="ml-auto text-sm font-mono text-primary-600 dark:text-primary-400">
                {fontSize}px
              </span>
            </div>
            <div className="space-y-2">
              <input
                type="range"
                min="12"
                max="24"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                aria-label={t("learning.settings.fontSize")}
                aria-valuetext={`${fontSize}px`}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>12px</span>
                <span>16px</span>
                <span>20px</span>
                <span>24px</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("learning.settings.readingMode")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("learning.settings.readingMode")}
              className="grid grid-cols-2 gap-2"
            >
              {(
                [
                  {
                    id: "default",
                    label: t("learning.settings.modeDefault"),
                    icon: Sun,
                    color:
                      "from-slate-100 to-white dark:from-slate-700 dark:to-slate-800",
                  },
                  {
                    id: "eye-care",
                    label: t("learning.settings.modeEyeCare"),
                    icon: Eye,
                    color:
                      "from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30",
                  },
                ] as const
              ).map((mode) => {
                const isSelected = readingMode === mode.id;
                return (
                <motion.button
                  key={mode.id}
                  onClick={() => setReadingMode(mode.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? `border-primary-500 bg-gradient-to-br ${  mode.color}`
                      : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                  }`}
                >
                  <mode.icon
                    size={20}
                    className={
                      readingMode === mode.id
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-slate-400 dark:text-slate-500"
                    }
                  />
                  <span
                    className={`text-xs font-medium ${
                      readingMode === mode.id
                        ? "text-primary-700 dark:text-primary-300"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {mode.label}
                  </span>
                </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Scroll
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("learning.settings.pagination")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("learning.settings.pagination")}
              className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl"
            >
              {(
                [
                  {
                    id: "scroll",
                    label: t("learning.settings.scroll"),
                    icon: Scroll,
                  },
                  {
                    id: "pagination",
                    label: t("learning.settings.page"),
                    icon: FileText,
                  },
                ] as const
              ).map((mode) => {
                const isSelected = paginationMode === mode.id;
                return (
                <motion.button
                  key={mode.id}
                  onClick={() => setPaginationMode(mode.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <mode.icon size={16} />
                  {mode.label}
                </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("learning.settings.contentWidth")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("learning.settings.contentWidth")}
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  {
                    id: "full",
                    label: t("learning.settings.widthFull"),
                    icon: Maximize2,
                    color:
                      "from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20",
                  },
                  {
                    id: "comfortable",
                    label: t("learning.settings.widthComfortable"),
                    icon: FileText,
                    color:
                      "from-violet-50 to-primary-50 dark:from-violet-900/20 dark:to-primary-900/20",
                  },
                  {
                    id: "narrow",
                    label: t("learning.settings.widthNarrow"),
                    icon: Minimize2,
                    color:
                      "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
                  },
                ] as const
              ).map((mode) => {
                const isSelected = contentWidthMode === mode.id;
                return (
                <motion.button
                  key={mode.id}
                  onClick={() => setContentWidthMode(mode.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    isSelected
                      ? `border-primary-500 bg-gradient-to-br ${  mode.color}`
                      : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                  }`}
                >
                  <mode.icon
                    size={20}
                    className={
                      contentWidthMode === mode.id
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-slate-400 dark:text-slate-500"
                    }
                  />
                  <span
                    className={`text-xs font-medium ${
                      contentWidthMode === mode.id
                        ? "text-primary-700 dark:text-primary-300"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {mode.label}
                  </span>
                </motion.button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <motion.button
              onClick={resetSettings}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-500 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <RefreshCcw size={16} />
              <span className="text-sm font-medium">
                {t("learning.settings.resetSettings")}
              </span>
            </motion.button>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-500">
            <motion.button
              onClick={handleManagePrompts}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
            >
              <Zap size={16} />
              <span className="text-sm font-medium">
                {t("learning.settings.managePromptsLink")}
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleOverlayClick}
              className="fixed inset-0 z-fullscreen bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-fullscreen-content max-h-[90dvh] flex flex-col"
            >
              <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-500 overflow-hidden h-full flex flex-col"
              >
                <div className="flex items-center justify-center py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <GripHorizontal
                    className="text-gray-400 dark:text-gray-500"
                    size={24}
                  />
                </div>
                {renderContent()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleOverlayClick}
            className="fixed inset-0 z-fullscreen bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-fullscreen-content flex items-center justify-center pointer-events-none"
          >
            <div className="w-full max-w-2xl h-[80vh] pointer-events-auto">
              <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-500 overflow-hidden h-full flex flex-col"
              >
                {renderContent()}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
