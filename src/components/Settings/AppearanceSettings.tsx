import React from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks";
import { useLearningSettingsStore } from "../../store/useLearningSettingsStore";
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  SwatchBook,
  Globe,
} from "lucide-react";

export const AppearanceSettings = React.memo(function AppearanceSettings() {
  const { t, i18n } = useTranslation();
  const { themeMode, setTheme, themePreset, setThemePreset, availablePresets } =
    useTheme();
  const { aiLanguage, setAILanguage } = useLearningSettingsStore();

  return (
    <>
      {/* 外观设置 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.appearance")}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setTheme("light")}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
              themeMode === "light"
                ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
            }`}
          >
            <Sun className="w-6 h-6 mb-2" />
            <span className="font-medium text-sm">
              {t("settings.lightMode")}
            </span>
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
              themeMode === "dark"
                ? "bg-slate-800 border-slate-700 text-white ring-1 ring-slate-600 dark:bg-primary-600 dark:border-primary-500"
                : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
            }`}
          >
            <Moon className="w-6 h-6 mb-2" />
            <span className="font-medium text-sm">
              {t("settings.darkMode")}
            </span>
          </button>

          <button
            onClick={() => setTheme("system")}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
              themeMode === "system"
                ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
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
              onClick={() => setThemePreset(preset.key)}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[80px] ${
                themePreset === preset.key
                  ? "border-2 bg-primary-50 dark:bg-primary-900/30"
                  : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
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

      {/* 语言设置 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
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
                onClick={() => i18n.changeLanguage("zh-CN")}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                  i18n.language === "zh-CN" || i18n.language.startsWith("zh")
                    ? "bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-2xl mb-2">中</span>
                <span className="font-medium text-sm">
                  {t("settings.chinese")}
                </span>
              </button>

              <button
                onClick={() => i18n.changeLanguage("en-US")}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                  i18n.language === "en-US" || i18n.language.startsWith("en")
                    ? "bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-2xl mb-2">A</span>
                <span className="font-medium text-sm">
                  {t("settings.english")}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {t("settings.aiOutputLanguage")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setAILanguage("auto")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                  aiLanguage === "auto"
                    ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <Monitor className="w-5 h-5 mb-1" />
                <span className="font-medium text-sm">
                  {t("settings.languageAuto")}
                </span>
              </button>

              <button
                onClick={() => setAILanguage("zh-CN")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                  aiLanguage === "zh-CN"
                    ? "bg-red-50 border-red-200 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-xl mb-1">中</span>
                <span className="font-medium text-sm">
                  {t("settings.languageChinese")}
                </span>
              </button>

              <button
                onClick={() => setAILanguage("en-US")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                  aiLanguage === "en-US"
                    ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <span className="text-xl mb-1">A</span>
                <span className="font-medium text-sm">
                  {t("settings.languageEnglish")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});
