import React from "react";
import { useTranslation } from "react-i18next";
import { Languages, MonitorSmartphone } from "lucide-react";
import {
  useNodeDisplayLanguageStore,
  NODE_CONTENT_LANGUAGES,
} from "../../store/useNodeDisplayLanguageStore";

/**
 * 节点内容显示语言切换器（紧凑胶囊样式）。
 * 默认「跟随系统」：随界面语言自动切换；也可手动指定具体语言（之后保持手动选择）。
 */
export const NodeLanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();
  const displayLanguage = useNodeDisplayLanguageStore(
    (s) => s.displayLanguage,
  );
  const manuallySet = useNodeDisplayLanguageStore((s) => s.manuallySet);
  const setDisplayLanguage = useNodeDisplayLanguageStore(
    (s) => s.setDisplayLanguage,
  );
  const followSystem = useNodeDisplayLanguageStore((s) => s.followSystem);

  return (
    <div
      className="flex items-center gap-1 px-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
      role="group"
      aria-label={t("graphEditor.nodeLanguageSwitcher.label")}
    >
      <Languages
        size={14}
        className="text-slate-400 dark:text-slate-500 ml-1 shrink-0"
      />
      {/* 跟随系统（默认） */}
      <button
        key="system"
        type="button"
        onClick={() => followSystem(i18n.language)}
        aria-pressed={!manuallySet}
        title={t("graphEditor.nodeLanguageSwitcher.followSystem")}
        className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
          !manuallySet
            ? "bg-primary-500 text-white"
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        }`}
      >
        <MonitorSmartphone size={13} aria-hidden="true" />
      </button>
      {NODE_CONTENT_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setDisplayLanguage(lang.code)}
          aria-pressed={manuallySet && displayLanguage === lang.code}
          title={lang.label}
          className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            manuallySet && displayLanguage === lang.code
              ? "bg-primary-500 text-white"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          {lang.short}
        </button>
      ))}
    </div>
  );
};

export default NodeLanguageSwitcher;
