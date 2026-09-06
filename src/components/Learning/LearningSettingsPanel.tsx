import React, { useId, useState } from "react";
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
  Settings,
  Zap,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Coffee,
  Languages,
  MonitorSmartphone,
  ScrollText,
} from "lucide-react";
import { useLearningSettingsStore } from "../../store/useLearningSettingsStore";
import {
  useNodeDisplayLanguageStore,
  NODE_CONTENT_LANGUAGES,
} from "../../store/useNodeDisplayLanguageStore";
import { useShallow } from "zustand/react/shallow";
import { useIsMobile, useFocusTrap, useEscapeKey } from "../../hooks";
import { READING_FONT_FAMILIES, resolveFontFamily, type ReadingFontFamilyId } from "@shared/constants/fonts";

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
    fontFamily,
    lineHeight,
    readingMode,
    contentWidthMode,
    paginationMode,
    setFontSize,
    setFontFamily,
    setLineHeight,
    setReadingMode,
    setContentWidthMode,
    setPaginationMode,
    resetSettings,
  } = useLearningSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      lineHeight: s.lineHeight,
      readingMode: s.readingMode,
      contentWidthMode: s.contentWidthMode,
      paginationMode: s.paginationMode,
      setFontSize: s.setFontSize,
      setFontFamily: s.setFontFamily,
      setLineHeight: s.setLineHeight,
      setReadingMode: s.setReadingMode,
      setContentWidthMode: s.setContentWidthMode,
      setPaginationMode: s.setPaginationMode,
      resetSettings: s.resetSettings,
    })),
  );

  const { t, i18n } = useTranslation();
  const { isMobile } = useIsMobile();
  const navigate = useNavigate();
  const titleId = useId();
  // 设置分组 Tab：常用 / 排版 / 更多
  const [settingsTab, setSettingsTab] = useState<"common" | "typography" | "more">("common");
  const modalRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(onClose, isOpen);

  // 节点内容显示语言（共享 store，与图编辑器联动）
  const nodeDisplayLang = useNodeDisplayLanguageStore((s) => s.displayLanguage);
  const manuallySet = useNodeDisplayLanguageStore((s) => s.manuallySet);
  const setNodeDisplayLang = useNodeDisplayLanguageStore(
    (s) => s.setDisplayLanguage,
  );
  const nodeFollowSystem = useNodeDisplayLanguageStore((s) => s.followSystem);

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

      {/* 设置分组 Tab：常用 / 排版 / 更多 */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-3 border-b border-slate-200 dark:border-slate-500 bg-slate-50 dark:bg-slate-700/50 shrink-0">
        {(
          [
            { id: "common" as const, label: t("learning.settings.tabCommon") },
            { id: "typography" as const, label: t("learning.settings.tabTypography") },
            { id: "more" as const, label: t("learning.settings.tabMore") },
          ]
        ).map((tab) => {
          const isActive = settingsTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSettingsTab(tab.id)}
              aria-pressed={isActive}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-slate-600"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-6 space-y-6">
          {settingsTab === "common" && (
          <>
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
                max="28"
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
                <span>28px</span>
              </div>
            </div>
          </div>
          </>
          )}
          {settingsTab === "typography" && (
          <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Type
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("learning.settings.fontFamily")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("learning.settings.fontFamily")}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
            >
              {READING_FONT_FAMILIES.map((entry) => {
                const id = entry.id as ReadingFontFamilyId;
                const isSelected = fontFamily === id;
                let label: string;
                let tag: string | null = null;
                if (id === "sans") {
                  label = t("learning.settings.fontSans");
                } else if (id === "serif") {
                  label = t("learning.settings.fontSerif");
                } else if (id === "mono") {
                  label = t("learning.settings.fontMono");
                } else if (id === "jetbrains-mono") {
                  label = t(
                    "settings.readingFonts.fonts.jetbrainsMono.name" as never,
                  );
                  tag = t(
                    "settings.readingFonts.fonts.jetbrainsMono.tag" as never,
                  );
                } else {
                  label = t(
                    `settings.uiFonts.fonts.${entry.labelKey}.name` as never,
                  );
                  tag = t(
                    `settings.uiFonts.fonts.${entry.labelKey}.tag` as never,
                  );
                }
                return (
                  <motion.button
                    key={id}
                    onClick={() => setFontFamily(id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    title={tag ?? label}
                    className={`flex flex-col items-start gap-1.5 p-2.5 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                        : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <div className="w-full flex items-center justify-between gap-1">
                      {tag ? (
                        <span
                          className={`text-[9px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${
                            isSelected
                              ? "bg-primary-600 text-white"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {tag}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className="w-full text-[13px] leading-snug rounded-md bg-white/80 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-700 px-2 py-1 text-slate-800 dark:text-slate-100 line-clamp-2"
                      style={{
                        fontFamily: resolveFontFamily(id, "reading"),
                      }}
                    >
                      字：机器学习基础 ML DL NLP
                    </span>
                    <span
                      className={`text-[11px] font-medium truncate w-full ${
                        isSelected
                          ? "text-primary-700 dark:text-primary-300"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("learning.settings.lineHeight")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("learning.settings.lineHeight")}
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  {
                    id: "compact",
                    label: t("learning.settings.lineCompact"),
                    color:
                      "from-slate-100 to-white dark:from-slate-700 dark:to-slate-800",
                  },
                  {
                    id: "normal",
                    label: t("learning.settings.lineNormal"),
                    color:
                      "from-violet-50 to-primary-50 dark:from-violet-900/20 dark:to-primary-900/20",
                  },
                  {
                    id: "relaxed",
                    label: t("learning.settings.lineRelaxed"),
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
                        ? `border-primary-500 bg-gradient-to-br ${  mode.color}`
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
          </>
          )}
          {settingsTab === "common" && (
          <>
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
              className="grid grid-cols-3 gap-2"
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
                  {
                    id: "sepia",
                    label: t("learning.settings.modeSepia"),
                    icon: Coffee,
                    color:
                      "from-amber-50 to-orange-100 dark:from-amber-900/30 dark:to-orange-800/30",
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
              <GripHorizontal
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
                    icon: GripHorizontal,
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

          {isMobile && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ScrollText
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
              className="grid grid-cols-2 gap-2"
            >
              {(
                [
                  {
                    id: "scroll" as const,
                    label: t("learning.settings.scroll"),
                    icon: ScrollText,
                    color:
                      "from-slate-100 to-white dark:from-slate-700 dark:to-slate-800",
                  },
                  {
                    id: "pagination" as const,
                    label: t("learning.settings.page"),
                    icon: BookOpen,
                    color:
                      "from-primary-50 to-violet-50 dark:from-primary-900/20 dark:to-violet-900/20",
                  },
                ]
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
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? `border-primary-500 bg-gradient-to-br ${mode.color}`
                        : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <mode.icon
                      size={20}
                      className={
                        isSelected
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-slate-400 dark:text-slate-500"
                      }
                    />
                    <span
                      className={`text-xs font-medium ${
                        isSelected
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
          )}
          </>
          )}
          {settingsTab === "typography" && (
          <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Languages
                size={16}
                className="text-slate-500 dark:text-slate-400"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t("learning.settings.nodeLanguage")}
              </span>
            </div>
            <div
              role="radiogroup"
              aria-label={t("learning.settings.nodeLanguage")}
              className="grid grid-cols-3 gap-2"
            >
              <motion.button
                onClick={() => nodeFollowSystem(i18n.language)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                role="radio"
                aria-checked={!manuallySet}
                tabIndex={!manuallySet ? 0 : -1}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  !manuallySet
                    ? "border-primary-500 bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20"
                    : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                }`}
              >
                <MonitorSmartphone
                  size={20}
                  className={
                    !manuallySet
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-slate-400 dark:text-slate-500"
                  }
                />
                <span
                  className={`text-xs font-medium ${
                    !manuallySet
                      ? "text-primary-700 dark:text-primary-300"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {t("learning.settings.followSystem")}
                </span>
              </motion.button>
              {NODE_CONTENT_LANGUAGES.map((lang) => {
                const isSelected = manuallySet && nodeDisplayLang === lang.code;
                return (
                  <motion.button
                    key={lang.code}
                    onClick={() => setNodeDisplayLang(lang.code)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    title={lang.label}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary-500 bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20"
                        : "border-slate-200 dark:border-slate-500 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${
                        isSelected
                          ? "text-primary-700 dark:text-primary-300"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {lang.short}
                    </span>
                    <span
                      className={`text-[11px] font-medium leading-tight text-center ${
                        isSelected
                          ? "text-primary-700 dark:text-primary-300"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {lang.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
          </>
          )}
          {settingsTab === "more" && (
          <>
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
          </>
          )}
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
              className="fixed inset-x-0 bottom-0 z-fullscreen-content flex flex-col"
            >
              <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-500 overflow-hidden flex flex-col max-h-[90dvh]"
              >
                <div className="flex items-center justify-center py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
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
