import React from "react";
import { useTranslation } from "react-i18next";
import { changeLanguage as changeAppLanguage } from "@/i18n";
import { useTheme } from "../../hooks";
import { useSaveFeedback } from "../../hooks/common";
import { usePreferencesStore } from "../../store/usePreferencesStore";
import { useThemeStore } from "../../store/useThemeStore";
import { UI_FONT_FAMILIES, resolveFontFamily, type UiFontFamilyId } from "@shared/constants/fonts";
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  SwatchBook,
  Globe,
  Sparkles,
  Wind,
  Type,
} from "lucide-react";

export const AppearanceSettings = React.memo(function AppearanceSettings() {
  const { t, i18n } = useTranslation();
  const { themeMode, setTheme, themePreset, setThemePreset, availablePresets } =
    useTheme();
  const uiFontFamily = useThemeStore((s) => s.uiFontFamily);
  const setUiFontFamily = useThemeStore((s) => s.setUiFontFamily);
  const celebrationEnabled = usePreferencesStore((s) => s.celebrationEnabled);
  const setCelebrationEnabled = usePreferencesStore(
    (s) => s.setCelebrationEnabled,
  );
  const reducedMotion = usePreferencesStore((s) => s.reducedMotion);
  const setReducedMotion = usePreferencesStore((s) => s.setReducedMotion);
  const { saved, notify } = useSaveFeedback();

  return (
    <div className="relative">
      {saved && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/60 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-300 shadow-sm"
        >
          {t("settings.saved")}
        </div>
      )}
      {/* 外观设置 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.appearance")}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => {
              setTheme("light");
              notify();
            }}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
              themeMode === "light"
                ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
            }`}
          >
            <Sun className="w-6 h-6 mb-2" />
            <span className="font-medium text-sm">
              {t("settings.lightMode")}
            </span>
          </button>

          <button
            onClick={() => {
              setTheme("dark");
              notify();
            }}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
              themeMode === "dark"
                ? "bg-slate-800 border-slate-700 text-white ring-1 ring-slate-600 dark:bg-primary-600 dark:border-primary-500"
                : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
            }`}
          >
            <Moon className="w-6 h-6 mb-2" />
            <span className="font-medium text-sm">
              {t("settings.darkMode")}
            </span>
          </button>

          <button
            onClick={() => {
              setTheme("system");
              notify();
            }}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
              themeMode === "system"
                ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
            }`}
          >
            <Monitor className="w-6 h-6 mb-2" />
            <span className="font-medium text-sm">
              {t("settings.followSystem")}
            </span>
          </button>
        </div>
      </div>

      {/* 主题预设 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <SwatchBook className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.themePreset")}
          </h2>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {availablePresets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => {
                setThemePreset(preset.key);
                notify();
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[80px] ${
                themePreset === preset.key
                  ? "border-2 bg-primary-50 dark:bg-primary-900/30"
                  : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
              }`}
              style={
                themePreset === preset.key
                  ? { borderColor: preset.previewColors[0] }
                  : undefined
              }
            >
              <div className="flex space-x-1 mb-2">
                {preset.previewColors.map((color, idx) => (
                  <div
                    key={idx}
                    className="w-4 h-4 rounded-full ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-800"
                    style={
                      {
                        backgroundColor: color,
                        "--tw-ring-color":
                          themePreset === preset.key ? color : "transparent",
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
              <span className="font-medium text-xs text-center">
                {t(`settings.themePresets.${preset.key}`)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 全局 UI 字体 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <Type className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.uiFonts.title")}
          </h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t("settings.uiFonts.description")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {UI_FONT_FAMILIES.map((entry) => {
            const active = uiFontFamily === entry.id;
            const nameKey = `settings.uiFonts.fonts.${entry.labelKey}.name` as const;
            const tagKey = `settings.uiFonts.fonts.${entry.labelKey}.tag` as const;
            const descKey = `settings.uiFonts.fonts.${entry.labelKey}.desc` as const;
            return (
              <button
                key={entry.id}
                onClick={() => {
                  setUiFontFamily(entry.id as UiFontFamilyId);
                  notify();
                }}
                aria-pressed={active}
                aria-label={t(nameKey as never)}
                title={t(descKey as never)}
                className={`group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all ${
                  active
                    ? "bg-violet-50 border-violet-200 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:border-violet-800 dark:ring-violet-700"
                    : "bg-gray-50 border-gray-100 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:hover:bg-slate-700"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                        active
                          ? "bg-violet-600 text-white dark:bg-violet-500"
                          : "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300"
                      }`}
                    >
                      {t(tagKey as never)}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        active
                          ? "text-violet-800 dark:text-violet-200"
                          : "text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {t(nameKey as never)}
                    </span>
                  </div>
                  {active ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white">
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden
                        className="w-3 h-3"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-8.25 8.3a1 1 0 0 1-1.42.006l-4.25-4.3a1 1 0 1 1 1.422-1.404l3.54 3.582 7.542-7.588a1 1 0 0 1 1.45 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  ) : null}
                </div>
                <div
                  className="w-full rounded-lg bg-white/70 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-600 px-3 py-2 text-[15px] text-gray-800 dark:text-gray-100 leading-relaxed"
                  style={{
                    fontFamily: resolveFontFamily(entry.id, "ui"),
                  }}
                >
                  {t("settings.uiFonts.previewLine" as never)}
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {t(descKey as never)}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 语言设置 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.language")}
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {t("settings.interfaceLanguage")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  void changeAppLanguage("zh-CN");
                  notify();
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                  i18n.language === "zh-CN" || i18n.language.startsWith("zh")
                    ? "bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-2xl mb-2">中</span>
                <span className="font-medium text-sm">
                  {t("settings.chinese")}
                </span>
              </button>

              <button
                onClick={() => {
                  void changeAppLanguage("en-US");
                  notify();
                }}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                  i18n.language === "en-US" || i18n.language.startsWith("en")
                    ? "bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-2xl mb-2">A</span>
                <span className="font-medium text-sm">
                  {t("settings.english")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 微反馈偏好 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("appearance.celebrationEnabled")}
          </h2>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("appearance.celebrationEnabled")}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t("appearance.celebrationEnabledDesc")}
            </p>
          </div>
          <div
            role="switch"
            aria-checked={celebrationEnabled}
            aria-label={t("appearance.celebrationEnabled")}
            tabIndex={0}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              celebrationEnabled
                ? "bg-primary-600"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
            onClick={() => {
              setCelebrationEnabled(!celebrationEnabled);
              notify();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCelebrationEnabled(!celebrationEnabled);
                notify();
              }
            }}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                celebrationEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </div>
      </div>

      {/* 减少动态效果偏好（无障碍） */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Wind className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("common.preferences.reducedMotion")}
          </h2>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("common.preferences.reducedMotion")}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t("common.preferences.reducedMotionDesc")}
            </p>
          </div>
          <div
            role="switch"
            aria-checked={reducedMotion}
            aria-label={t("common.preferences.reducedMotion")}
            tabIndex={0}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              reducedMotion
                ? "bg-primary-600"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
            onClick={() => {
              setReducedMotion(!reducedMotion);
              notify();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setReducedMotion(!reducedMotion);
                notify();
              }
            }}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                reducedMotion ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});