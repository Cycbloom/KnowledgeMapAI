import React, { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Sparkles, Upload } from "lucide-react";
import { useMenuNavigation } from "../../hooks";

interface DashboardMobileFABProps {
  isDark: boolean;
  showFABMenu: boolean;
  onToggleFABMenu: () => void;
  onOpenAIGenerator: () => void;
  onImportClick: () => void;
  isImporting: boolean;
  fabMenuRef: React.RefObject<HTMLDivElement>;
}

const FAB_MENU_ITEM_COUNT = 2;

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
  const menuId = useId();

  const handleSelect = (index: number) => {
    const item = document.getElementById(`${menuId}-item-${index}`);
    item?.click();
    onToggleFABMenu();
  };

  const { activeIndex, setActiveIndex } = useMenuNavigation({
    itemCount: FAB_MENU_ITEM_COUNT,
    enabled: showFABMenu,
    onSelect: handleSelect,
    onClose: onToggleFABMenu,
  });

  // 补充 Home/End 导航（hook 仅处理 ArrowUp/ArrowDown/Enter/Escape）
  useEffect(() => {
    if (!showFABMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(FAB_MENU_ITEM_COUNT - 1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showFABMenu, setActiveIndex]);

  const activeRing = (idx: number) =>
    showFABMenu && activeIndex === idx
      ? isDark
        ? "ring-2 ring-primary-400"
        : "ring-2 ring-primary-500"
      : "";

  return (
    <div className="fixed bottom-20 right-6 z-40" ref={fabMenuRef}>
      {showFABMenu && (
        <div
          id={menuId}
          className="absolute bottom-20 right-0 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
          role="menu"
          aria-activedescendant={`${menuId}-item-${activeIndex}`}
        >
          <button
            id={`${menuId}-item-0`}
            onClick={onOpenAIGenerator}
            className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl shadow-lg whitespace-nowrap ${activeRing(0)} ${
              isDark ? "bg-slate-700 text-white" : "bg-white text-gray-900"
            }`}
            role="menuitem"
            tabIndex={-1}
            aria-label={t("dashboard.actions.aiGenerate")}
          >
            <div
              className="p-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-500 text-white"
              aria-hidden="true"
            >
              <Sparkles size={16} />
            </div>
            <span className="text-sm font-medium">{t('dashboard.mobileFAB.aiGenerate')}</span>
          </button>

          <button
            id={`${menuId}-item-1`}
            onClick={onImportClick}
            disabled={isImporting}
            className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl shadow-lg whitespace-nowrap ${activeRing(1)} ${
              isDark
                ? "bg-slate-700 text-white"
                : "bg-white text-gray-900"
            } disabled:opacity-50`}
            role="menuitem"
            tabIndex={-1}
            aria-label={t("dashboard.actions.import")}
          >
            <div
              className="p-1.5 rounded-lg bg-green-500 text-white"
              aria-hidden="true"
            >
              <Upload size={16} />
            </div>
            <span className="text-sm font-medium">
              {isImporting ? t('dashboard.mobileFAB.importing') : t('dashboard.mobileFAB.import')}
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
        aria-controls={menuId}
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </div>
  );
};
