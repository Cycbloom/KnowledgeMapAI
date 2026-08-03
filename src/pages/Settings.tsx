import {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
  type MouseEvent,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "../hooks/queries";
import { useStore } from "../store/useStore";
import { useLearningSettingsStore } from "../store/useLearningSettingsStore";
import { cn } from "../utils/utils";
import { isElectron } from "../config/electronConfig";
import { AvailableModels } from "../types";
import {
  ArrowLeft,
  AlertTriangle,
  Puzzle,
  Globe,
  Monitor,
} from "lucide-react";
const PluginMarketplace = lazy(() =>
  import("../components/PluginMarketplace/PluginMarketplace").then((module) => ({
    default: module.PluginMarketplace,
  })),
);
import { PromptSettingsPanel } from "../components/GraphEditor/panels/PromptSettingsPanel";
import { AIActionSettingsPanel } from "../components/GraphEditor/panels/AIActionSettingsPanel";

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
  ShortcutSettings,
  NotificationSettings,
} from "../components/Settings";
import { DEFAULT_AVAILABLE_MODES, type DatabaseConfig } from "../components/Settings/settingsConstants";
import { PwaInstallButton } from "../components/PwaInstallButton";
import { PwaDiagnostics } from "../components/PwaDiagnostics";

export const Settings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { token } = useStore();

  const { data: userData } = useUser(!!token);

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

  const { aiLanguage, setAILanguage } = useLearningSettingsStore();
  const dbSectionRef = useRef<HTMLDivElement>(null);

  const sections = [
    { id: "appearance", label: t("settings.sections.appearance") },
    { id: "focusMode", label: t("settings.sections.focusMode") },
    { id: "aiProvider", label: t("settings.sections.aiProvider") },
    { id: "aiStatus", label: t("settings.sections.aiStatus") },
    { id: "prompts", label: t("settings.sections.prompts") },
    { id: "voice", label: t("settings.sections.voice") },
    { id: "database", label: t("settings.sections.database") },
    { id: "mobileAI", label: t("settings.sections.mobileAI") },
    { id: "studyStrategy", label: t("settings.sections.studyStrategy") },
    { id: "studyAlgorithm", label: t("settings.sections.studyAlgorithm") },
    { id: "graphEditor", label: t("settings.sections.graphEditor") },
    { id: "shortcuts", label: t("settings.sections.shortcuts") },
    { id: "notifications", label: t("settings.sections.notifications") },
    { id: "plugins", label: t("settings.sections.plugins") },
  ];

  const [activeSection, setActiveSection] = useState<string>(
    sections[0]?.id ?? "",
  );
  const sectionRefs = useRef<Record<string, HTMLElement>>({});
  const location = useLocation();

  // 兼容旧的 ?tab=xxx 导航方式
  const tabToSection: Record<string, string> = {
    ai: "prompts",
    notifications: "notifications",
  };

  const scrollToSection = useCallback((sectionId: string, behavior: ScrollBehavior = "smooth") => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior, block: "start" });
      setActiveSection(sectionId);
    }
  }, []);

  const handleAnchorClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
      e.preventDefault();
      scrollToSection(sectionId);
    },
    [scrollToSection],
  );

  useEffect(() => {
    // Delay observer setup so a deep-link scroll (e.g. arriving at
    // /settings#prompts from another route) can complete first. Without this,
    // the observer fires immediately on mount with the first visible section
    // (e.g. "appearance") and overwrites the deep-link's active section.
    let observer: IntersectionObserver | null = null;
    const timer = setTimeout(() => {
      observer = new IntersectionObserver(
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
        if (el) observer?.observe(el);
      });
    }, 100);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  // Deep-link activation: when the URL targets a section (e.g. #prompts),
  // scroll to it and mark it active. Supports both hash (#prompts) and
  // legacy query-param (?tab=ai) navigation styles.
  useEffect(() => {
    // 优先使用 hash，其次使用 search params
    let targetSection = location.hash.replace("#", "");
    if (!targetSection) {
      const params = new URLSearchParams(location.search);
      const tab = params.get("tab");
      if (tab && tab in tabToSection) {
        targetSection = tabToSection[tab];
      }
    }
    if (targetSection) {
      const timer = setTimeout(() => {
        const el = sectionRefs.current[targetSection];
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "start" });
          setActiveSection(targetSection);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.hash, location.search]);

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
            onClick={() => {
              // Return to the previous page when there is history; otherwise
              // fall back to the personal center so the button always works
              // (e.g. when the page is opened directly / refreshed).
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/profile");
              }
            }}
            className="p-3 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors min-h-[44px] min-w-[44px]"
            aria-label={t("settings.back")}
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
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* 左侧锚点导航 - 桌面端 */}
          <nav className="hidden md:block w-56 flex-shrink-0" aria-label={t('settings.navDesktop')}>
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
          <nav className="md:hidden -mx-4 px-4 overflow-x-auto" aria-label={t('settings.navMobile')}>
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
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {t("settings.ai.aiOutputLanguage")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setAILanguage("auto")}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                      aiLanguage === "auto"
                        ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                        : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Monitor className="w-5 h-5 mb-1" />
                    <span className="font-medium text-sm">
                      {t("settings.ai.languageAuto")}
                    </span>
                  </button>

                  <button
                    onClick={() => setAILanguage("zh-CN")}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                      aiLanguage === "zh-CN"
                        ? "bg-red-50 border-red-200 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300"
                        : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="text-xl mb-1">中</span>
                    <span className="font-medium text-sm">
                      {t("settings.ai.languageChinese")}
                    </span>
                  </button>

                  <button
                    onClick={() => setAILanguage("en-US")}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                      aiLanguage === "en-US"
                        ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                        : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-500 dark:text-gray-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="text-xl mb-1">A</span>
                    <span className="font-medium text-sm">
                      {t("settings.ai.languageEnglish")}
                    </span>
                  </button>
                </div>
              </div>
              <div className="mt-6">
                <AIProviderConfigSection />
              </div>
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
              id="prompts"
              ref={(el) => {
                if (el) sectionRefs.current.prompts = el;
              }}
            >
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors space-y-6">
                <PromptSettingsPanel scope="user" />
                <AIActionSettingsPanel scope="user" />
              </div>
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
                settings={settings}
                availableModels={availableModels}
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
              id="shortcuts"
              ref={(el) => {
                if (el) sectionRefs.current.shortcuts = el;
              }}
            >
              <ShortcutSettings />
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
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors"
            >
              <div className="flex items-center gap-2 mb-4">
                <Puzzle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  插件市场
                </h2>
              </div>
              <Suspense fallback={<div className="h-48 flex items-center justify-center text-gray-400">{t('common.loading')}</div>}>
                <PluginMarketplace />
              </Suspense>
            </section>

            {/* 仅 Web 端显示 PWA 区块 */}
            {!isElectron() && (
              <section
                data-testid="settings-pwa-section"
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors"
              >
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    PWA
                  </h2>
                </div>
                <div className="space-y-4">
                  <PwaInstallButton />
                  <PwaDiagnostics />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
