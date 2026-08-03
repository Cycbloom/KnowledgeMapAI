import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../services/api/createApiClient";
import { message } from "../../utils/messageHelper";
import {
  KeyRound,
  Save,
  Zap,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from "lucide-react";
import { PROVIDER_DEFAULTS, getProviderDisplayName, type ProviderConfig, type ProviderFormData } from "./settingsConstants";
import { useStore } from "../../store/useStore";

export const AIProviderConfigSection = React.memo(function AIProviderConfigSection() {
  const { t } = useTranslation();
  const token = useStore((state) => state.token);

  const [providerConfigs, setProviderConfigs] = useState<
    Record<string, ProviderConfig>
  >({});
  const [providerForms, setProviderForms] = useState<
    Record<string, ProviderFormData>
  >({});
  const [expandedProviders, setExpandedProviders] = useState<
    Record<string, boolean>
  >({});
  const [showProviderApiKeys, setShowProviderApiKeys] = useState<
    Record<string, boolean>
  >({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [providerLoading, setProviderLoading] = useState(false);

  const fetchProviderConfigs = async () => {
    setProviderLoading(true);
    try {
      const response = (await apiClient.get("/ai/config/providers")) as {
        providers: Record<string, ProviderConfig>;
      };
      const providers = response.providers || {};
      setProviderConfigs(providers);
      const forms: Record<string, ProviderFormData> = {};
      const expanded: Record<string, boolean> = {};
      for (const [key, config] of Object.entries(providers)) {
        forms[key] = {
          apiKey: config.source === "user" ? config.apiKey : "",
          baseURL: config.baseURL || PROVIDER_DEFAULTS[key]?.baseURL || "",
          model: config.model || PROVIDER_DEFAULTS[key]?.model || "",
        };
        expanded[key] = false;
      }
      for (const key of Object.keys(PROVIDER_DEFAULTS)) {
        if (!forms[key]) {
          forms[key] = {
            apiKey: "",
            baseURL: PROVIDER_DEFAULTS[key].baseURL,
            model: PROVIDER_DEFAULTS[key].model,
          };
        }
      }
      setProviderForms(forms);
      setExpandedProviders(expanded);
    } catch (error) {
      console.error("Failed to load provider configs:", error);
      message.error(t("settings.providerConfigLoadFailed"));
      const forms: Record<string, ProviderFormData> = {};
      for (const [key, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
        forms[key] = {
          apiKey: "",
          baseURL: defaults.baseURL,
          model: defaults.model,
        };
      }
      setProviderForms(forms);
    } finally {
      setProviderLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchProviderConfigs();
  }, [token]);

  const handleSaveProviderConfig = async (provider: string) => {
    const form = providerForms[provider];
    if (!form) return;

    try {
      const updateData: Record<
        string,
        { apiKey?: string; baseURL?: string; model?: string }
      > = {};
      updateData[provider] = {
        apiKey: form.apiKey,
        baseURL: form.baseURL,
        model: form.model,
      };
      await apiClient.put("/ai/config/providers", { providers: updateData });
      message.success(t("settings.providerConfigSaved", {
        provider: getProviderDisplayName(provider, t),
      }));
      await fetchProviderConfigs();
    } catch (error) {
      console.error("Failed to save provider config:", error);
      message.error(t("settings.providerConfigSaveFailed"));
    }
  };

  const handleTestProviderConnection = async (provider: string) => {
    const form = providerForms[provider];
    if (!form) return;

    setTestingProvider(provider);
    try {
      const response = (await apiClient.post("/ai/config/providers/test", {
        provider,
        apiKey: form.apiKey,
        baseURL: form.baseURL,
        model: form.model,
      })) as { success: boolean; message: string };
      if (response.success) {
        message.success(t("settings.providerTestSuccess", {
          provider: getProviderDisplayName(provider, t),
        }));
      } else {
        message.error(
          response.message ||
            t("settings.providerTestFailed", {
              provider: getProviderDisplayName(provider, t),
            }),
        );
      }
    } catch (error) {
      console.error("Failed to test provider connection:", error);
      message.error(t("settings.providerTestFailed", {
        provider: getProviderDisplayName(provider, t),
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleClearProviderConfig = async (provider: string) => {
    try {
      const updateData: Record<
        string,
        { apiKey: string; baseURL: string; model: string }
      > = {};
      updateData[provider] = { apiKey: "", baseURL: "", model: "" };
      await apiClient.put("/ai/config/providers", { providers: updateData });
      setProviderForms((prev) => ({
        ...prev,
        [provider]: {
          apiKey: "",
          baseURL: PROVIDER_DEFAULTS[provider]?.baseURL || "",
          model: PROVIDER_DEFAULTS[provider]?.model || "",
        },
      }));
      message.success(t("settings.providerConfigCleared", {
        provider: getProviderDisplayName(provider, t),
      }));
      await fetchProviderConfigs();
    } catch (error) {
      console.error("Failed to clear provider config:", error);
      message.error(t("settings.providerConfigSaveFailed"));
    }
  };

  const renderProviderBadge = (config: ProviderConfig) => {
    if (config.source === "env") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {t("settings.sourceEnv")}
        </span>
      );
    }
    if (config.configured && config.source === "user") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
          {t("settings.configured")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        {t("settings.notConfigured")}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t("settings.aiProviderConfig")}
        </h2>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {t("settings.aiProviderConfigDesc")}
      </p>

      {providerLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("common.loading")}
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(PROVIDER_DEFAULTS).map(
          ([providerKey, defaults]) => {
            const config = providerConfigs[providerKey];
            const form = providerForms[providerKey];
            const isExpanded = expandedProviders[providerKey] ?? false;
            const showApiKey = showProviderApiKeys[providerKey] ?? false;
            const isEnvSource = config?.source === "env";

            return (
              <div
                key={providerKey}
                className="rounded-lg border border-gray-100 dark:border-slate-500 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedProviders((prev) => ({
                      ...prev,
                      [providerKey]: !prev[providerKey],
                    }))
                  }
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      {defaults.nameKey ? t(defaults.nameKey as never) : defaults.name}
                    </span>
                    {config && renderProviderBadge(config)}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {isExpanded && form && (
                  <div className="p-4 pt-0 space-y-3 border-t border-gray-100 dark:border-slate-500">
                    {isEnvSource && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        {t("settings.envConfigHint")}
                      </div>
                    )}

                    {config?.source === "none" && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        {t("settings.noApiKeyHint", {
                          provider: defaults.nameKey ? t(defaults.nameKey as never) : defaults.name,
                        })}
                      </div>
                    )}

                    <div>
                      <label htmlFor={`api-key-${providerKey}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          id={`api-key-${providerKey}`}
                          type={showApiKey ? "text" : "password"}
                          autoComplete="off"
                          value={isEnvSource ? "" : form.apiKey}
                          onChange={(e) =>
                            setProviderForms((prev) => ({
                              ...prev,
                              [providerKey]: {
                                ...prev[providerKey],
                                apiKey: e.target.value,
                              },
                            }))
                          }
                          placeholder={
                            isEnvSource
                              ? t("settings.envConfigPlaceholder")
                              : t("settings.enterApiKey")
                          }
                          disabled={isEnvSource}
                          className="w-full input-mobile pr-20 rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowProviderApiKeys((prev) => ({
                              ...prev,
                              [providerKey]: !prev[providerKey],
                            }))
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showApiKey
                            ? t("settings.hide")
                            : t("settings.show")}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`base-url-${providerKey}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Base URL
                      </label>
                      <input
                        id={`base-url-${providerKey}`}
                        onChange={(e) =>
                          setProviderForms((prev) => ({
                            ...prev,
                            [providerKey]: {
                              ...prev[providerKey],
                              baseURL: e.target.value,
                            },
                          }))
                        }
                        placeholder={defaults.baseURL}
                        className="w-full input-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {t("settings.defaultModel")}
                      </label>
                      <input
                        type="text"
                        autoComplete="off"
                        value={form.model}
                        onChange={(e) =>
                          setProviderForms((prev) => ({
                            ...prev,
                            [providerKey]: {
                              ...prev[providerKey],
                              model: e.target.value,
                            },
                          }))
                        }
                        placeholder={defaults.model}
                        className="w-full input-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() =>
                          handleTestProviderConnection(providerKey)
                        }
                        disabled={
                          testingProvider === providerKey || isEnvSource
                        }
                        className="px-3 py-2 rounded-md border border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
                      >
                        {testingProvider === providerKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                        {t("settings.testConnection")}
                      </button>
                      <button
                        onClick={() =>
                          handleSaveProviderConfig(providerKey)
                        }
                        disabled={isEnvSource}
                        className="px-3 py-2 rounded-md bg-primary-600 text-white text-sm hover:bg-primary-700 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {t("settings.saveConfig")}
                      </button>
                      {config?.configured && config.source === "user" && (
                        <button
                          onClick={() =>
                            handleClearProviderConfig(providerKey)
                          }
                          className="px-3 py-2 rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5 min-h-[44px]"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t("settings.clear")}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
});
