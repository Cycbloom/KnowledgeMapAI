import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles, Upload } from "lucide-react";

interface DashboardMobileFABProps {
  isDark: boolean;
  showFABMenu: boolean;
  onToggleFABMenu: () => void;
  onOpenAIGenerator: () => void;
  onImportClick: () => void;
  isImporting: boolean;
  fabMenuRef: React.RefObject<HTMLDivElement>;
}

export const DashboardMobileFAB: React.FC<DashboardMobileFABProps> = ({
  isDark,
  showFABMenu,
  onToggleFABMenu,
  onOpenAIGenerator,
  onImportClick,
  isImporting,
  fabMenuRef,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-20 right-6 z-40" ref={fabMenuRef}>
      {showFABMenu && (
        <div
          className="absolute bottom-20 right-0 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="menu"
        >
          <button
            onClick={onOpenAIGenerator}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg whitespace-nowrap ${
              isDark ? "bg-slate-700 text-white" : "bg-white text-gray-900"
            }`}
            role="menuitem"
            aria-label={t("dashboard.actions.aiGenerate")}
          >
            <div
              className="p-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-500 text-white"
              aria-hidden="true"
            >
              <Sparkles size={16} />
            </div>
            <span className="text-sm font-medium">AI 生成</span>
          </button>

          <button
            onClick={onImportClick}
            disabled={isImporting}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg whitespace-nowrap ${
              isDark
                ? "bg-slate-700 text-white"
                : "bg-white text-gray-900"
            } disabled:opacity-50`}
            role="menuitem"
            aria-label={t("dashboard.actions.import")}
          >
            <div
              className="p-1.5 rounded-lg bg-green-500 text-white"
              aria-hidden="true"
            >
              <Upload size={16} />
            </div>
            <span className="text-sm font-medium">
              {isImporting ? "导入中..." : "导入"}
            </span>
          </button>
        </div>
      )}

      <button
        onClick={onToggleFABMenu}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          showFABMenu
            ? "rotate-45 bg-red-500 text-white"
            : "bg-gradient-to-r from-primary-500 to-primary-500 text-white"
        }`}
        aria-label={
          showFABMenu
            ? t("common.close")
            : t("dashboard.actions.createGraph")
        }
        aria-expanded={showFABMenu}
        aria-haspopup="menu"
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </div>
  );
};
