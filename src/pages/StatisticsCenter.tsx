import React, { useState, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, CheckSquare } from "lucide-react";
import { useTheme } from "../hooks";
import { useTranslation } from "react-i18next";
import { LearningStatsTab } from "../components/Statistics/LearningStatsTab";
import { TaskStatsTab } from "../components/Statistics/TaskStatsTab";

type StatsTab = "learning" | "tasks";

export const StatisticsCenter: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<StatsTab>("learning");

  const tabs: { id: StatsTab; label: string; icon: React.ReactNode; translationKey: "statistics.tabs.learning" | "statistics.tabs.tasks" }[] = [
    { id: "learning", label: t("statistics.studyStatistics"), icon: <BookOpen size={18} />, translationKey: "statistics.tabs.learning" },
    { id: "tasks", label: t("statistics.taskStatistics"), icon: <CheckSquare size={18} />, translationKey: "statistics.tabs.tasks" },
  ];

  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex].id);
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex].id);
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setActiveTab(tabs[0].id);
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = tabs.length - 1;
        setActiveTab(tabs[lastIndex].id);
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      className={`h-full overflow-y-auto ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1
            className={`text-2xl md:text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            {t('layout.statistics')}
          </h1>
          <p className={`mt-1 md:mt-2 text-sm md:text-base ${isDark ? "text-slate-400" : "text-gray-600"}`}>
            {t('statistics.subtitle')}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-2" role="tablist" aria-label={t('layout.statistics')}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[index] = el; }}
                role="tab"
                id={`${tabIdPrefix}-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`${panelIdPrefix}-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-3 md:py-2.5 rounded-xl text-sm md:text-base font-medium transition-all flex-shrink-0 min-h-[44px] ${
                  isActive
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                    : isDark
                      ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      : "bg-white text-gray-700 hover:bg-gray-100 shadow-sm"
                }`}
              >
                {tab.icon}
                <span>{t(tab.translationKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            role="tabpanel"
            id={`${panelIdPrefix}-${activeTab}`}
            aria-labelledby={`${tabIdPrefix}-${activeTab}`}
            tabIndex={0}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "learning" && <LearningStatsTab />}
            {activeTab === "tasks" && <TaskStatsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
