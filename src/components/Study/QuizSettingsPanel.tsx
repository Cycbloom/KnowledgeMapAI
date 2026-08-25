import React, { useId } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Type,
  BookOpen,
  RefreshCcw,
  Settings,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Timer,
  Shuffle,
} from "lucide-react";
import { useQuizSettingsStore } from "../../store/useQuizSettingsStore";
import { useShallow } from "zustand/react/shallow";
import { useIsMobile, useFocusTrap, useEscapeKey } from "../../hooks";

interface QuizSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * QuizSettingsPanel
 * 学习中心答题模式（闪卡 / 专注）设置面板，风格与学习资料设置面板对齐：
 * - 字号：12~28px 滑杆，实时预览
 * - 行距：紧凑 / 标准 / 宽松
 * - 内容宽度：全宽 / 舒适 / 窄
 * - 一键恢复默认
 */
export const QuizSettingsPanel: React.FC<QuizSettingsPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    fontSize,
    lineHeight,
    contentWidthMode,
    timerSeconds,
    optionShuffle,
    wrongRequeue,
    setFontSize,
    setLineHeight,
    setContentWidthMode,
    setTimerSeconds,
    setOptionShuffle,
    setWrongRequeue,
    resetSettings,
  } = useQuizSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      contentWidthMode: s.contentWidthMode,
      timerSeconds: s.timerSeconds,
      optionShuffle: s.optionShuffle,
      wrongRequeue: s.wrongRequeue,
      setFontSize: s.setFontSize,
      setLineHeight: s.setLineHeight,
      setContentWidthMode: s.setContentWidthMode,
      setTimerSeconds: s.setTimerSeconds,
      setOptionShuffle: s.setOptionShuffle,
      setWrongRequeue: s.setWrongRequeue,
      resetSettings: s.resetSettings,
    })),
  );

  const { t } = useTranslation();
  const { isMobile } = useIsMobile();
  const titleId = useId();
  const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
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
            {t("study.settings.title")}
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
                {t("study.settings.fontSize")}
              </span>
              <span className="ml-auto text-sm font-mono text-primary-600 dark:text-primary-400">
                {fontSize}px
              </span>
            </div>
            <div className="space-y-2">
              <input
                type="range"
                min="12"
                max="28"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                aria-label={t("study.settings.fontSize")}
                aria-valuetext={`${fontSize}px`}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>12px</span>
                <span>16px</span>
                <span>20px</span>
                <span>24px</span>
                <span>28px</span>
              </div>
              {/* 实时预览：以所选字号渲染示例题干 */}
              <div
                className={`mt-2 p-3 rounded-xl border ${
                  fontSize >= 12 && fontSize <= 28
                    ? "border-primary-200 dark:border-primary-500/30 bg-primary-50/50 dark:bg-primary-500/5"
                    : "border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800"
                }`}
              >
                <div
                  className="font-semibold text-slate-800 dark:text-slate-100"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  {t("study.settings.previewQuestion")}
                </div>
                <div
                  className="text-slate-500 dark:text-slate-400 mt-1"
                  style={{ fontSize: `${Math.max(11, Math.round(fontSize * 0.875))}px` }}
                >
                  {t("study.settings.previewOption")}
                </div>
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
                {t("study.settings.lineHeight")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("study.settings.lineHeight")}
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  {
                    id: "compact",
                    label: t("study.settings.lineCompact"),
                    color:
                      "from-slate-100 to-white dark:from-slate-700 dark:to-slate-800",
                  },
                  {
                    id: "normal",
                    label: t("study.settings.lineNormal"),
                    color:
                      "from-violet-50 to-primary-50 dark:from-violet-900/20 dark:to-primary-900/20",
                  },
                  {
                    id: "relaxed",
                    label: t("study.settings.lineRelaxed"),
                    color:
                      "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
                  },
                ] as const
              ).map((mode) => {
                const isSelected = lineHeight === mode.id;
                return (
                  <motion.button
                    key={mode.id}
                    onClick={() => setLineHeight(mode.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `border-primary-500 bg-gradient-to-br ${mode.color}`
                        : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <span aria-hidden="true" className="text-sm leading-none">
                      <span className={`block ${mode.id === "compact" ? "h-2" : mode.id === "relaxed" ? "h-6" : "h-4"}`}>
                        <span className="block w-6 h-0.5 bg-current rounded-full mt-0.5" />
                        <span className="block w-6 h-0.5 bg-current rounded-full mt-1" />
                        <span className="block w-6 h-0.5 bg-current rounded-full mt-1" />
                      </span>
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        lineHeight === mode.id
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
              <GripHorizontal
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("study.settings.contentWidth")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("study.settings.contentWidth")}
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  {
                    id: "full",
                    label: t("study.settings.widthFull"),
                    icon: Maximize2,
                    color:
                      "from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20",
                  },
                  {
                    id: "comfortable",
                    label: t("study.settings.widthComfortable"),
                    icon: GripHorizontal,
                    color:
                      "from-violet-50 to-primary-50 dark:from-violet-900/20 dark:to-primary-900/20",
                  },
                  {
                    id: "narrow",
                    label: t("study.settings.widthNarrow"),
                    icon: Minimize2,
                    color:
                      "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
                  },
                ] as const
              ).map((mode) => {
                const isSelected = contentWidthMode === mode.id;
                const Icon = mode.icon;
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
                        ? `border-primary-500 bg-gradient-to-br ${mode.color}`
                        : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <Icon
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

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shuffle
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("study.settings.quizFeatures")}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t("study.settings.optionShuffle")}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("study.settings.optionShuffleHint")}
                </p>
              </div>
              <div
                role="switch"
                aria-checked={optionShuffle}
                aria-label={t("study.settings.optionShuffle")}
                tabIndex={0}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  optionShuffle
                    ? "bg-primary-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
                onClick={() => setOptionShuffle(!optionShuffle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOptionShuffle(!optionShuffle);
                  }
                }}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    optionShuffle ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t("study.settings.wrongRequeue")}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("study.settings.wrongRequeueHint")}
                </p>
              </div>
              <div
                role="switch"
                aria-checked={wrongRequeue}
                aria-label={t("study.settings.wrongRequeue")}
                tabIndex={0}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  wrongRequeue
                    ? "bg-primary-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
                onClick={() => setWrongRequeue(!wrongRequeue)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setWrongRequeue(!wrongRequeue);
                  }
                }}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    wrongRequeue ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Timer
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("study.settings.timerSeconds")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("study.settings.timerSeconds")}
              className="grid grid-cols-4 gap-2"
            >
              {(
                [
                  { value: 0, label: t("study.settings.timerOff") },
                  { value: 10, label: t("study.settings.timer10") },
                  { value: 30, label: t("study.settings.timer30") },
                  { value: 60, label: t("study.settings.timer60") },
                ] as const
              ).map((opt) => {
                const isSelected = timerSeconds === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => setTimerSeconds(opt.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      isSelected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                        : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {opt.label}
                  </motion.button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {t("study.settings.timerHint")}
            </p>
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
                {t("study.settings.resetSettings")}
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
            <div className="w-full max-w-lg h-[80vh] pointer-events-auto">
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
