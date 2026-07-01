import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "../hooks/queries";
import { useUpdateProfileMutation } from "../hooks/mutations";
import { useStore } from "../store/useStore";
import { message } from "../utils/messageHelper";
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
      <div className="max-w-4xl mx-auto space-y-6">
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

        <AppearanceSettings />
        <FocusModeSettings />
        <AIProviderConfigSection />
        <AIStatusSection
          token={token}
          availableModels={availableModels}
          onAvailableModelsChange={handleAvailableModelsChange}
        />
        <VoiceServiceSettings />
        <DatabaseSettings
          onConfigChange={handleDatabaseConfigChange}
          sectionRef={dbSectionRef}
        />
        <MobileAISettings availableModels={availableModels} />
        <StudyStrategySettings
          ref={studyStrategyRef}
          settings={settings}
        />
        <StudyAlgorithmSettings />
        <GraphEditorSettings />
        <NotificationSettings />

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Puzzle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              插件市场
            </h2>
          </div>
          <PluginMarketplace />
        </div>
      </div>
    </div>
  );
};
