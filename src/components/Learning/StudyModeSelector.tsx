import React from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StudyMode } from "@shared/types/scheduler";
import { STUDY_MODE_PRESETS } from "@shared/constants/studyModePresets";
import type { StudyModeIconType } from "../../hooks/study/useStudyModeLogic";

interface StudyModeSelectorProps {
  studyMode: StudyMode;
  isStudyModeDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onStudyModeChange: (mode: StudyMode) => void;
  getStudyModeIcon: (mode: StudyMode) => StudyModeIconType;
  isMobile: boolean;
}

export const StudyModeSelector = ({
  studyMode,
  isStudyModeDropdownOpen,
  onToggleDropdown,
  onStudyModeChange,
  getStudyModeIcon,
  isMobile,
}: StudyModeSelectorProps) => {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div
      className="relative"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={onToggleDropdown}
        className={`flex items-center ${isMobile ? "gap-1 px-2 py-1.5" : "gap-1.5 px-3 py-2"} rounded-full font-medium transition-all ${
          isStudyModeDropdownOpen
            ? isDark
              ? "bg-primary-900/40 text-primary-400 border border-primary-500/30"
              : "bg-primary-50 text-primary-600 border border-primary-200"
            : isDark
              ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200"
        }`}
        title={t("learning.header.studyModeSelect")}
      >
        {(() => {
          const ModeIcon = getStudyModeIcon(studyMode);
          return React.createElement(ModeIcon, { size: isMobile ? 14 : 16 });
        })()}
        <span
          className={`text-sm ${isMobile ? "hidden" : "hidden sm:inline"}`}
        >
          {t(`learning.studyMode.${studyMode}`)}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isStudyModeDropdownOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isStudyModeDropdownOpen && (
        <div
          className={`absolute top-full right-0 mt-2 p-2 rounded-xl shadow-2xl border w-64 z-50 flex flex-col gap-1 ${
            isDark
              ? "bg-slate-800 border-slate-700 text-gray-100"
              : "bg-white border-gray-200 text-gray-800"
          } animate-in fade-in zoom-in-95 duration-150`}
        >
          {(Object.keys(STUDY_MODE_PRESETS) as StudyMode[]).map((mode) => {
            const preset = STUDY_MODE_PRESETS[mode];
            const Icon = getStudyModeIcon(mode);
            const isActive = studyMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onStudyModeChange(mode)}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? isDark
                      ? "bg-primary-900/30 text-primary-400"
                      : "bg-primary-50 text-primary-600"
                    : isDark
                      ? "hover:bg-slate-700 text-slate-300"
                      : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <Icon size={18} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {t(preset.labelKey)}
                    </span>
                    {isActive && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isDark
                            ? "bg-primary-900/50 text-primary-400"
                            : "bg-primary-100 text-primary-600"
                        }`}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {t(preset.descriptionKey)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
