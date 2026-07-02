import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "../hooks/queries";
import { useUpdateProfileMutation } from "../hooks/mutations";
import { useStore } from "../store/useStore";
import { message } from "../utils/messageHelper";
import { cn } from "../lib/utils";
import { AvailableModels } from "../types";
import {
  Save,
  ArrowLeft,
  AlertTriangle,
  Puzzle,
} from "lucide-react";
import { PluginMarketplace } from "../components/PluginMarketplace/PluginMarketplace";

import {
  AppearanceSettings,
  FocusModeSettings,
  AIProviderConfigSection,
  AIStatusSection,
  VoiceServiceSettings,
  DatabaseSettings,
  MobileAISettings,
  StudyStrategySettings,
  StudyAlgorithmSettings,
  GraphEditorSettings,
  NotificationSettings,
} from "../components/Settings";
import type { StudyStrategySettingsRef } from "../components/Settings";
import type { DatabaseConfig } from "../components/Settings/settingsConstants";
import { DEFAULT_AVAILABLE_MODES } from "../components/Settings/settingsConstants";

export const Settings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useStore();

  const { data: userData } = useUser(!!token);
  const updateProfileMutation = useUpdateProfileMutation();

  const profile = (userData as Record<string, unknown>)?.user &&
    typeof (userData as Record<string, unknown>).user === "object"
    ? ((userData as Record<string, unknown>).user as Record<string, unknown>).profile as
        | Record<string, unknown>
        | undefined
    : undefined;
  const settings = profile?.settings as Record<string, unknown> | undefined;

  const [availableModels, setAvailableModels] = useState<AvailableModels>(
    DEFAULT_AVAILABLE_MODES as unknown as AvailableModels,
  );
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig>({
    configured: false,
    url: "",
    mode: "cloud",
    connected: false,
  });
  const [dbLoaded, setDbLoaded] = useState(false);

  const studyStrategyRef = useRef<StudyStrategySettingsRef>(null);
  const dbSectionRef = useRef<HTMLDivElement>(null);

  const sections = [
    { id: "appearance", label: t("settings.sections.appearance") },
    { id: "focusMode", label: t("settings.sections.focusMode") },
    { id: "aiProvider", label: t("settings.sections.aiProvider") },
    { id: "aiStatus", label: t("settings.sections.aiStatus") },
    { id: "voice", label: t("settings.sections.voice") },
    { id: "database", label: t("settings.sections.database") },
    { id: "mobileAI", label: t("settings.sections.mobileAI") },
    { id: "studyStrategy", label: t("settings.sections.studyStrategy") },
    { id: "studyAlgorithm", label: t("settings.sections.studyAlgorithm") },
    { id: "graphEditor", label: t("settings.sections.graphEditor") },
    { id: "notifications", label: t("settings.sections.notifications") },
    { id: "plugins", label: t("settings.sections.plugins") },
  ];

  const [activeSection, setActiveSection] = useState<string>(
    sections[0]?.id ?? "",
  );
  const sectionRefs = useRef<Record<string, HTMLElement>>({});

  const handleAnchorClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      e.preventDefault();
      const el = sectionRefs.current[sectionId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(sectionId);
      }
    },
    [],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToDbSection = useCallback(() => {
    dbSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleDatabaseConfigChange = useCallback((config: DatabaseConfig) => {
    setDatabaseConfig(config);
    setDbLoaded(true);
  }, []);

  const handleAvailableModelsChange = useCallback((models: AvailableModels) => {
    setAvailableModels(models);
  }, []);

  const handleSaveAllSettings = async () => {
    try {
      const studyValues = studyStrategyRef.current?.getSettings(availableModels);
      if (!studyValues) {
        message.error(t("settings.saveFailed"));
        return;
      }

      await updateProfileMutation.mutateAsync({
        settings: {
          ...settings,
          request_retention: studyValues.request_retention,
          maximum_interval: studyValues.maximum_interval,
          defaultStudyMode: studyValues.defaultStudyMode,
          masteryThresholds: studyValues.masteryThresholds,
          schedulerWeights: studyValues.schedulerWeights,
          semantic_scheduling: studyValues.semantic_scheduling,
          available_models: studyValues.available_models,
        },
      });
      message.success(t("settings.saveSuccess"));
    } catch (e) {
      console.error(e);
      message.error(t("settings.saveFailed"));
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4 md:p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6">
        {!databaseConfig.connected && dbLoaded && (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div className="flex-1 text-sm">
              {t("settings.dbNotConfiguredWarning")}
            </div>
            <button
              onClick={scrollToDbSection}
              className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors min-h-[44px]"
            >
              {t("settings.goToDbConfig")}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-3 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t("settings.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">
              {t("settings.subtitle")}
            </p>
          </div>
          <div>
            <button
              onClick={handleSaveAllSettings}
              className="px-4 py-3 rounded-md bg-primary-600 text-white hover:bg-primary-700 flex items-center gap-2 transition-colors shadow-sm min-h-[44px]"
              disabled={updateProfileMutation.isPending}
            >
              <Save className="w-4 h-4" />
              <span className="hidden md:inline">
                {updateProfileMutation.isPending
                  ? t("settings.saving")
                  : t("settings.saveAll")}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* 左侧锚点导航 - 桌面端 */}
          <nav className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-6 space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => handleAnchorClick(e, section.id)}
                  className={cn(
                    "block px-3 py-2 rounded-lg text-sm transition-colors",
                    activeSection === section.id
                      ? "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 font-medium"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800",
                  )}
                >
                  {section.label}
                </a>
              ))}
            </div>
          </nav>

          {/* 移动端水平 chips */}
          <nav className="md:hidden -mx-4 px-4 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => handleAnchorClick(e, section.id)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors",
                    activeSection === section.id
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-400",
                  )}
                >
                  {section.label}
                </a>
              ))}
            </div>
          </nav>

          {/* 右侧内容区 */}
          <div className="flex-1 min-w-0 space-y-6">
            <section
              id="appearance"
              ref={(el) => {
                if (el) sectionRefs.current.appearance = el;
              }}
            >
              <AppearanceSettings />
            </section>
            <section
              id="focusMode"
              ref={(el) => {
                if (el) sectionRefs.current.focusMode = el;
              }}
            >
              <FocusModeSettings />
            </section>
            <section
              id="aiProvider"
              ref={(el) => {
                if (el) sectionRefs.current.aiProvider = el;
              }}
            >
              <AIProviderConfigSection />
            </section>
            <section
              id="aiStatus"
              ref={(el) => {
                if (el) sectionRefs.current.aiStatus = el;
              }}
            >
              <AIStatusSection
                token={token}
                availableModels={availableModels}
                onAvailableModelsChange={handleAvailableModelsChange}
              />
            </section>
            <section
              id="voice"
              ref={(el) => {
                if (el) sectionRefs.current.voice = el;
              }}
            >
              <VoiceServiceSettings />
            </section>
            <section
              id="database"
              ref={(el) => {
                if (el) sectionRefs.current.database = el;
              }}
            >
              <DatabaseSettings
                onConfigChange={handleDatabaseConfigChange}
                sectionRef={dbSectionRef}
              />
            </section>
            <section
              id="mobileAI"
              ref={(el) => {
                if (el) sectionRefs.current.mobileAI = el;
              }}
            >
              <MobileAISettings availableModels={availableModels} />
            </section>
            <section
              id="studyStrategy"
              ref={(el) => {
                if (el) sectionRefs.current.studyStrategy = el;
              }}
            >
              <StudyStrategySettings
                ref={studyStrategyRef}
                settings={settings}
              />
            </section>
            <section
              id="studyAlgorithm"
              ref={(el) => {
                if (el) sectionRefs.current.studyAlgorithm = el;
              }}
            >
              <StudyAlgorithmSettings />
            </section>
            <section
              id="graphEditor"
              ref={(el) => {
                if (el) sectionRefs.current.graphEditor = el;
              }}
            >
              <GraphEditorSettings />
            </section>
            <section
              id="notifications"
              ref={(el) => {
                if (el) sectionRefs.current.notifications = el;
              }}
            >
              <NotificationSettings />
            </section>

            <section
              id="plugins"
              ref={(el) => {
                if (el) sectionRefs.current.plugins = el;
              }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors"
            >
              <div className="flex items-center gap-2 mb-4">
                <Puzzle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  插件市场
                </h2>
              </div>
              <PluginMarketplace />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
