import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAIStatus } from "../../hooks/queries";
import { apiClient } from "../../services/api/createApiClient";
import { message } from "../../utils/messageHelper";
import { AvailableModels } from "../../types";
import {
  Cpu,
  Brain,
  Save,
  Plus,
  Trash2,
  Loader2,
  Zap,
  Info,
  KeyRound,
} from "lucide-react";
import { PROVIDER_DEFAULTS, getProviderDisplayName, type EmbeddingAiConfig } from "./settingsConstants";

interface AIStatusSectionProps {
  token: string | null;
  availableModels: AvailableModels;
  onAvailableModelsChange: (models: AvailableModels) => void;
}

export const AIStatusSection = React.memo(function AIStatusSection({
  token,
  availableModels,
  onAvailableModelsChange,
}: AIStatusSectionProps) {
  const { t } = useTranslation();
  const { data: aiStatus } = useAIStatus(!!token);

  const [mainAiConfig, setMainAiConfig] = useState({
    provider: "deepseek",
    model: "deepseek-chat",
  });
  const [mainAiStatus, setMainAiStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [embeddingAiConfig, setEmbeddingAiConfig] = useState<EmbeddingAiConfig>({
    provider: "volcengine",
    model: "doubao-embedding-vision-251215",
    baseURL: "",
    apiKey: "",
    enabled: true,
    loaded: false,
    isDefault: true,
  });
  const [embeddingAiStatus, setEmbeddingAiStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [testingMainAi, setTestingMainAi] = useState(false);
  const [testingEmbedding, setTestingEmbedding] = useState(false);

  const [newModelName, setNewModelName] = useState("");
  const [selectedProviderForAdd, setSelectedProviderForAdd] =
    useState("deepseek");

  useEffect(() => {
    const loadAiConfigs = async () => {
      try {
        const [mainRes, embRes] = await Promise.all([
          apiClient.get("/ai/config/main-ai") as Promise<
            Record<string, unknown>
          >,
          apiClient.get("/ai/config/embedding") as Promise<
            Record<string, unknown>
          >,
        ]);

        const mainProvider = mainRes.provider as string;
        if (mainProvider) {
          setMainAiConfig((prev) => ({
            ...prev,
            provider: mainProvider,
            model:
              (mainRes.model as string) ||
              PROVIDER_DEFAULTS[mainProvider]?.model ||
              "",
            baseURL:
              (mainRes.baseURL as string) ||
              PROVIDER_DEFAULTS[mainProvider]?.baseURL ||
              "",
            apiKey: "",
          }));
          setMainAiStatus({
            configured: mainRes.configured as boolean,
            source: mainRes.source as string,
          });
        }

        const embProvider = embRes.provider as string;
        if (embProvider) {
          setEmbeddingAiConfig({
            provider: embProvider,
            model: (embRes.model as string) || "",
            baseURL: (embRes.baseURL as string) || "",
            apiKey: "",
            enabled: true,
            loaded: true,
            isDefault: false,
          });
          setEmbeddingAiStatus({
            configured: embRes.configured as boolean,
            source: embRes.source as string,
          });
        } else {
          try {
            const defaultEmbeddingProvider = "volcengine";
            const defaultEmbeddingModel =
              PROVIDER_DEFAULTS[defaultEmbeddingProvider]?.embeddingModel || "";
            await apiClient.put("/ai/config/embedding", {
              provider: defaultEmbeddingProvider,
              ...(defaultEmbeddingModel
                ? { model: defaultEmbeddingModel }
                : {}),
            });

            setEmbeddingAiConfig({
              provider: defaultEmbeddingProvider,
              model: defaultEmbeddingModel,
              baseURL: "",
              apiKey: "",
              enabled: true,
              loaded: true,
              isDefault: false,
            });
            setEmbeddingAiStatus({ configured: true, source: "auto" });

            message.info(
              t("settings.embeddingAutoConfigured") ||
                "Embedding service auto-configured with default settings",
            );
          } catch (saveError) {
            console.error(
              "[Settings] Failed to save default embedding config:",
              saveError,
            );

            setEmbeddingAiConfig((prev) => ({
              ...prev,
              loaded: true,
              isDefault: true,
            }));
            setEmbeddingAiStatus({ configured: false, source: "none" });

            message.warning(
              t("settings.embeddingAutoConfigFailed") ||
                "Failed to auto-configure embedding service. Please configure manually.",
            );
          }
        }
      } catch (error) {
        console.error("Failed to load AI configs:", error);
        setEmbeddingAiConfig((prev) => ({
          ...prev,
          enabled: false,
          loaded: true,
        }));
        message.error(t("settings.loadConfigFailed"));
      }
    };
    if (token) {
      loadAiConfigs();
    }
  }, [token, t]);

  const handleAddModel = () => {
    if (!newModelName.trim()) return;
    const provider = selectedProviderForAdd;
    const currentModels = availableModels[provider] || [];

    if (currentModels.includes(newModelName.trim())) {
      message.warning(t("settings.modelExists"));
      return;
    }

    const updated = {
      ...availableModels,
      [provider]: [...(availableModels[provider] || []), newModelName.trim()],
    };
    onAvailableModelsChange(updated as AvailableModels);
    setNewModelName("");
    message.success(`${t("settings.modelAdded")}: ${newModelName}`);
  };

  const handleDeleteModel = (provider: string, model: string) => {
    const updated = {
      ...availableModels,
      [provider]: availableModels[provider]?.filter((m) => m !== model),
    };
    onAvailableModelsChange(updated as AvailableModels);
  };

  const handleMainAiProviderChange = (provider: string) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    setMainAiConfig((prev) => ({
      ...prev,
      provider,
      model: defaults?.model || "",
      baseURL: defaults?.baseURL || "",
    }));
  };

  const handleEmbeddingProviderChange = (provider: string) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    setEmbeddingAiConfig((prev) => ({
      ...prev,
      provider,
      model: defaults?.embeddingModel || "",
    }));
  };

  const handleSaveMainAi = async () => {
    try {
      await apiClient.put("/ai/config/main-ai", {
        provider: mainAiConfig.provider,
        model: mainAiConfig.model,
      });
      message.success(t("settings.mainAiSaved"));
      setMainAiStatus({ configured: true, source: "user" });
    } catch {
      message.error(t("settings.mainAiSaveFailed"));
    }
  };

  const handleSaveEmbedding = async () => {
    try {
      if (!embeddingAiConfig.enabled) {
        await apiClient.put("/ai/config/embedding", { enabled: false });
        setEmbeddingAiStatus({ configured: false, source: "none" });
        message.success(t("settings.embeddingDisabled"));
        return;
      }

      if (!embeddingAiConfig.provider) {
        message.error(t("settings.providerRequired") || "Please select a provider");
        return;
      }

      await apiClient.put("/ai/config/embedding", {
        provider: embeddingAiConfig.provider,
        model: embeddingAiConfig.model,
      });

      setEmbeddingAiConfig((prev) => ({ ...prev, loaded: true }));
      setEmbeddingAiStatus({ configured: true, source: "user" });
      message.success(t("settings.embeddingSaved"));
    } catch (error) {
      console.error("Failed to save embedding config:", error);
      message.error(t("settings.embeddingSaveFailed"));
    }
  };

  const handleTestMainAi = async () => {
    setTestingMainAi(true);
    try {
      const response = (await apiClient.post("/ai/config/providers/test", {
        provider: mainAiConfig.provider,
        model: mainAiConfig.model,
      })) as { success: boolean; message: string };
      if (response.success) {
        message.success(t("settings.providerTestSuccess", {
          provider:
            getProviderDisplayName(mainAiConfig.provider, t),
        }));
      } else {
        message.error(
          response.message ||
            t("settings.providerTestFailed", {
              provider:
                getProviderDisplayName(mainAiConfig.provider, t),
            }),
        );
      }
    } catch {
      message.error(t("settings.providerTestFailed", {
        provider:
          getProviderDisplayName(mainAiConfig.provider, t),
      }));
    } finally {
      setTestingMainAi(false);
    }
  };

  const handleTestEmbedding = async () => {
    setTestingEmbedding(true);
    try {
      const response = (await apiClient.post("/ai/config/providers/test", {
        provider: embeddingAiConfig.provider,
        model: embeddingAiConfig.model,
      })) as { success: boolean; message: string };
      if (response.success) {
        message.success(t("settings.providerTestSuccess", {
          provider:
            getProviderDisplayName(embeddingAiConfig.provider, t),
        }));
      } else {
        message.error(
          response.message ||
            t("settings.providerTestFailed", {
              provider:
                getProviderDisplayName(embeddingAiConfig.provider, t),
            }),
        );
      }
    } catch {
      message.error(t("settings.providerTestFailed", {
        provider:
          getProviderDisplayName(embeddingAiConfig.provider, t),
      }));
    } finally {
      setTestingEmbedding(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.aiStatus.title")}
          </h2>
        </div>
      </div>

      <div className="mb-8 p-4 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-primary-700 dark:text-primary-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t("settings.modelManagement")}
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t("settings.modelManagementDesc")}
        </p>

        <div className="flex flex-col gap-2 mb-4">
          <select
            value={selectedProviderForAdd}
            onChange={(e) => setSelectedProviderForAdd(e.target.value)}
            className="select-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
          >
            {Object.entries(PROVIDER_DEFAULTS).map(([key, defaults]) => (
              <option key={key} value={key}>
                {defaults.nameKey ? t(defaults.nameKey as never) : defaults.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder={t("settings.inputModelName")}
              className="flex-1 input-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
            <button
              onClick={handleAddModel}
              disabled={!newModelName.trim()}
              className="px-4 py-3 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1 transition-colors whitespace-nowrap min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> {t("settings.addModel")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(availableModels).map(([provider, models]) => (
            <div
              key={provider}
              className="bg-white dark:bg-slate-900 p-3 rounded border border-gray-100 dark:border-slate-500"
            >
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 border-b dark:border-slate-500 pb-1">
                {provider}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {models.map((model) => (
                  <div
                    key={model}
                    className="flex justify-between items-center text-sm group text-gray-700 dark:text-gray-300"
                  >
                    <span className="truncate" title={model}>
                      {model}
                    </span>
                    <button
                      onClick={() => handleDeleteModel(provider, model)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-100 transition-opacity p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {models.length === 0 && (
                  <div className="text-xs text-gray-300 dark:text-gray-600 italic">
                    {t("settings.noModels")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary-100 dark:bg-primary-900/30 rounded text-primary-700 dark:text-primary-400">
                <Brain className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {t("settings.mainAiConfig")}
              </h3>
            </div>
            {mainAiStatus && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  mainAiStatus.source === "env"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : mainAiStatus.configured
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {mainAiStatus.source === "env"
                  ? t("settings.sourceEnv")
                  : mainAiStatus.configured
                    ? t("settings.configured")
                    : t("settings.notConfigured")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {t("settings.mainAiConfigDesc")}
          </p>

          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2 mb-4">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{t('settings.aiStatus.apiKeyHint')}</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t("settings.providerColumnLabel")}
              </label>
              <select
                value={mainAiConfig.provider}
                onChange={(e) => handleMainAiProviderChange(e.target.value)}
                className="w-full select-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              >
                {Object.entries(PROVIDER_DEFAULTS).map(
                  ([key, defaults]) => (
                    <option key={key} value={key}>
                      {defaults.nameKey ? t(defaults.nameKey as never) : defaults.name}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t("settings.modelName")}
              </label>
              <input
                type="text"
                value={mainAiConfig.model}
                onChange={(e) =>
                  setMainAiConfig((prev) => ({
                    ...prev,
                    model: e.target.value,
                  }))
                }
                placeholder={
                  PROVIDER_DEFAULTS[mainAiConfig.provider]?.model || ""
                }
                className="w-full input-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleTestMainAi}
                disabled={testingMainAi}
                className="px-3 py-2 rounded-md border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
              >
                {testingMainAi ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {t("settings.testConnection")}
              </button>
              <button
                onClick={handleSaveMainAi}
                className="px-3 py-2 rounded-md bg-primary-600 text-white text-sm hover:bg-primary-700 transition-colors flex items-center gap-1.5 min-h-[44px]"
              >
                <Save className="w-4 h-4" />
                {t("settings.saveConfig")}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {t("settings.embeddingConfig")}
              </h3>
            </div>
            {embeddingAiStatus && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  embeddingAiStatus.source === "auto"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    : embeddingAiStatus.source === "env"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : embeddingAiStatus.configured
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {embeddingAiStatus.source === "auto"
                  ? t("settings.sourceAuto") || "Auto"
                  : embeddingAiStatus.source === "env"
                    ? t("settings.sourceEnv")
                    : embeddingAiStatus.configured
                      ? t("settings.embeddingEnabled")
                      : t("settings.embeddingDisabled")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {t("settings.embeddingConfigDesc")}
          </p>

          <div className="flex items-center gap-3 mb-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={embeddingAiConfig.enabled}
                onChange={(e) =>
                  setEmbeddingAiConfig((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                disabled={!embeddingAiConfig.loaded}
                className="sr-only peer"
              />
              <div
                className={`w-11 h-6 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 ${
                  embeddingAiConfig.loaded
                    ? "bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 peer-checked:bg-green-600"
                    : "bg-gray-100 cursor-not-allowed"
                }`}
              ></div>
              <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("settings.enableEmbedding")}
                {!embeddingAiConfig.loaded && (
                  <span className="ml-2 text-xs text-gray-400">
                    ({t("settings.loading") || "Loading..."})
                  </span>
                )}
              </span>
            </label>
          </div>

          {embeddingAiConfig.enabled && embeddingAiConfig.loaded ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2 mb-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {t('settings.aiStatus.apiKeyHint')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t("settings.providerColumnLabel")}
                </label>
                <select
                  value={embeddingAiConfig.provider}
                  onChange={(e) =>
                    handleEmbeddingProviderChange(e.target.value)
                  }
                  className="w-full select-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                >
                  {Object.entries(PROVIDER_DEFAULTS)
                    .filter(([, defaults]) => defaults.supportsEmbedding)
                    .map(([key, defaults]) => (
                      <option key={key} value={key}>
                        {defaults.nameKey ? t(defaults.nameKey as never) : defaults.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t("settings.modelName")}
                </label>
                <input
                  type="text"
                  value={embeddingAiConfig.model}
                  onChange={(e) =>
                    setEmbeddingAiConfig((prev) => ({
                      ...prev,
                      model: e.target.value,
                    }))
                  }
                  placeholder={
                    PROVIDER_DEFAULTS[embeddingAiConfig.provider]
                      ?.embeddingModel || ""
                  }
                  className="w-full input-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleTestEmbedding}
                  disabled={testingEmbedding}
                  className="px-3 py-2 rounded-md border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
                >
                  {testingEmbedding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {t("settings.testConnection")}
                </button>
                <button
                  onClick={handleSaveEmbedding}
                  className="px-3 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 transition-colors flex items-center gap-1.5 min-h-[44px]"
                >
                  <Save className="w-4 h-4" />
                  {t("settings.saveConfig")}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              {t("settings.embeddingNotConfigured")}
            </div>
          )}
        </div>
      </div>

      {!aiStatus?.enabled && (
        <div className="mt-5 p-4 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 text-sm">
          <div className="flex items-start gap-2">
            <KeyRound className="w-4 h-4 mt-0.5" />
            <div>
              <div className="font-semibold">
                {t("settings.configMethod")}
              </div>
              <div className="mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                {t("settings.configDesc")}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
