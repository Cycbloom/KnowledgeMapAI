import React from "react";
import { useTranslation } from "react-i18next";
import { useFocusStore, DEFAULT_SETTINGS } from "../../store/useFocusStore";
import {
  Timer,
  Clock,
  Coffee,
  RefreshCw,
  Zap,
  Volume2,
  Bell,
} from "lucide-react";

export const FocusModeSettings = React.memo(function FocusModeSettings() {
  const { t } = useTranslation();
  const {
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    longBreakInterval,
    autoStartBreak,
    autoStartPomodoro,
    soundEnabled,
    notificationEnabled,
    updateSettings: updateFocusSettings,
  } = useFocusStore();

  const handleResetFocusDefaults = () => {
    updateFocusSettings({
      focusDuration: DEFAULT_SETTINGS.focusDuration,
      shortBreakDuration: DEFAULT_SETTINGS.shortBreakDuration,
      longBreakDuration: DEFAULT_SETTINGS.longBreakDuration,
      longBreakInterval: DEFAULT_SETTINGS.longBreakInterval,
      autoStartBreak: DEFAULT_SETTINGS.autoStartBreak,
      autoStartPomodoro: DEFAULT_SETTINGS.autoStartPomodoro,
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      notificationEnabled: DEFAULT_SETTINGS.notificationEnabled,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.focusMode")}
          </h2>
        </div>
        <button
          onClick={handleResetFocusDefaults}
          className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          {t("settings.resetFocusDefaults")}
        </button>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
            {t("settings.timeDurations")}
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Clock className="w-4 h-4 text-primary-500" />
                  {t("settings.focusDuration")}
                </span>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                  {focusDuration} {t("settings.minutes")}
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={focusDuration}
                onChange={(e) => updateFocusSettings({ focusDuration: Number(e.target.value) })}
                className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5 {t("settings.minutes")}</span>
                <span>60 {t("settings.minutes")}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Coffee className="w-4 h-4 text-emerald-500" />
                  {t("settings.shortBreakDuration")}
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {shortBreakDuration} {t("settings.minutes")}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={shortBreakDuration}
                onChange={(e) => updateFocusSettings({ shortBreakDuration: Number(e.target.value) })}
                className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 {t("settings.minutes")}</span>
                <span>15 {t("settings.minutes")}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Coffee className="w-4 h-4 text-purple-500" />
                  {t("settings.longBreakDuration")}
                </span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                  {longBreakDuration} {t("settings.minutes")}
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={30}
                step={5}
                value={longBreakDuration}
                onChange={(e) => updateFocusSettings({ longBreakDuration: Number(e.target.value) })}
                className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10 {t("settings.minutes")}</span>
                <span>30 {t("settings.minutes")}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <RefreshCw className="w-4 h-4 text-amber-500" />
                  {t("settings.longBreakInterval")}
                </span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {longBreakInterval} {t("settings.pomodoros")}
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={6}
                step={1}
                value={longBreakInterval}
                onChange={(e) => updateFocusSettings({ longBreakInterval: Number(e.target.value) })}
                className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>2 {t("settings.pomodoros")}</span>
                <span>6 {t("settings.pomodoros")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            {t("settings.automationOptions")}
          </h3>

          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t("settings.autoStartBreak")}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("settings.autoStartBreakDesc")}
                </p>
              </div>
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoStartBreak ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
                onClick={() => updateFocusSettings({ autoStartBreak: !autoStartBreak })}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    autoStartBreak ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t("settings.autoStartPomodoro")}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("settings.autoStartPomodoroDesc")}
                </p>
              </div>
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoStartPomodoro ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
                onClick={() => updateFocusSettings({ autoStartPomodoro: !autoStartPomodoro })}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    autoStartPomodoro ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <div>
                <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  {t("settings.soundEnabled")}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("settings.soundEnabledDesc")}
                </p>
              </div>
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  soundEnabled ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
                onClick={() => updateFocusSettings({ soundEnabled: !soundEnabled })}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    soundEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <div>
                <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Bell className="w-4 h-4 text-gray-400" />
                  {t("settings.notificationEnabled")}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {t("settings.notificationEnabledDesc")}
                </p>
              </div>
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  notificationEnabled ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
                onClick={() => updateFocusSettings({ notificationEnabled: !notificationEnabled })}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    notificationEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
});
