import React from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import {
  useNodeDisplayLanguageStore,
  NODE_CONTENT_LANGUAGES,
} from "../../store/useNodeDisplayLanguageStore";

/**
 * 节点内容显示语言切换器（紧凑胶囊样式）。
 * 切换后触发全局显示语言变更，节点 title/content/summary 按新语言重新解析。
 */
export const NodeLanguageSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const displayLanguage = useNodeDisplayLanguageStore(
    (s) => s.displayLanguage,
  );
  const setDisplayLanguage = useNodeDisplayLanguageStore(
    (s) => s.setDisplayLanguage,
  );

  return (
    <div
      className="flex items-center gap-1 px-1 py-1 rounded-lg bg-slate-100 dark:bg-slate-800"
      role="group"
      aria-label={t("graphEditor.nodeLanguageSwitcher.label")}
    >
      <Languages
        size={14}
        className="text-slate-400 dark:text-slate-500 ml-1"
      />
      {NODE_CONTENT_LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setDisplayLanguage(lang.code)}
          aria-pressed={displayLanguage === lang.code}
          title={lang.label}
          className={`px-1.5 py-0.5 rounded-md text-xs font-medium transition-colors ${
            displayLanguage === lang.code
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