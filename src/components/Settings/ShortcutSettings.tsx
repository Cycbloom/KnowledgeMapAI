import React from "react";
import { useTranslation } from "react-i18next";
import { ShortcutListContent } from "../common";
import { usePreferencesStore } from "../../store/usePreferencesStore";
import { Keyboard } from "lucide-react";

/**
 * 快捷键设置分段。
 *
 * 在 Settings 页面内嵌渲染 `ShortcutListContent`，不传 `onClose`（内嵌形态无需关闭按钮）。
 * 通过 className 限定最大高度并附加卡片样式，使内部列表可独立滚动。
 */
export const ShortcutSettings = React.memo(function ShortcutSettings() {
  const { t } = useTranslation();
  const shortcutHintEnabled = usePreferencesStore(
    (s) => s.shortcutHintEnabled,
  );
  const setShortcutHintEnabled = usePreferencesStore(
    (s) => s.setShortcutHintEnabled,
  );

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("shortcuts.hintEnabled")}
          </h2>
        </div>

        <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("shortcuts.hintEnabled")}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t("shortcuts.hintEnabledDesc")}
            </p>
          </div>
          <div
            role="switch"
            aria-checked={shortcutHintEnabled}
            aria-label={t("shortcuts.hintEnabled")}
            tabIndex={0}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              shortcutHintEnabled
                ? "bg-primary-600"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
            onClick={() => setShortcutHintEnabled(!shortcutHintEnabled)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShortcutHintEnabled(!shortcutHintEnabled);
              }
            }}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                shortcutHintEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </label>
      </div>

      <ShortcutListContent className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 overflow-hidden max-h-[70vh]" />
    </>
  );
});
