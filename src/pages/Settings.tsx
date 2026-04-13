import { useState, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAIStatus, useUser } from "../hooks/queries";
import { useUpdateProfileMutation } from "../hooks/mutations";
import { useStore } from "../store/useStore";
import { useMessageStore } from "../store/useMessageStore";
import { useTheme } from "../hooks";
import {
  Cpu,
  KeyRound,
  Brain,
  Save,
  Palette,
  Sun,
  Moon,
  Monitor,
  Plus,
  Trash2,
  ArrowLeft,
  Smartphone,
  Globe,
} from "lucide-react";
import { AvailableModels } from "../types";
import type { AIProviderType } from "@shared/types";
import { isCapacitorMobile } from "../config/mobileApiConfig";
import { mobileAIService } from "../services/mobile/aiService";
import type { MobileAIUserConfig } from "../services/mobile/aiService";

export const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { token } = useStore();
  const { themeMode, setTheme } = useTheme();
  const { addMessage } = useMessageStore();

  const { data: userData } = useUser(!!token);
  const { data: aiStatus } = useAIStatus(!!token);
  const updateProfileMutation = useUpdateProfileMutation();

  const profile = (userData as any)?.user?.profile;
  const settings = profile?.settings;

  const [retention, setRetention] = useState(0.9);
  const [maxInterval, setMaxInterval] = useState(36500);

  const [textConfig, setTextConfig] = useState({
    provider: "deepseek",
    model: "deepseek-chat",
  });
  const [embeddingConfig, setEmbeddingConfig] = useState({
    provider: "volcengine",
    model: "doubao-embedding-1.5",
  });
  const [reasoningConfig, setReasoningConfig] = useState({
    provider: "aliyun",
    model: "qwen-max",
  });

  const [availableModels, setAvailableModels] = useState<AvailableModels>({
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    volcengine: ["doubao-pro-4k", "doubao-pro-32k", "doubao-embedding-1.5"],
    aliyun: ["qwen-max", "qwen-plus", "qwen-turbo"],
  });
  const [newModelName, setNewModelName] = useState("");
  const [selectedProviderForAdd, setSelectedProviderForAdd] =
    useState("deepseek");

  const isMobile = isCapacitorMobile();
  const [mobileAIConfig, setMobileAIConfig] =
    useState<MobileAIUserConfig | null>(null);
  const [mobileApiKey, setMobileApiKey] = useState("");
  const [mobileProvider, setMobileProvider] =
    useState<AIProviderType>("deepseek");
  const [mobileModel, setMobileModel] = useState("deepseek-chat");
  const [showMobileApiKey, setShowMobileApiKey] = useState(false);

  useLayoutEffect(() => {
    if (settings) {
      if (settings.request_retention)
        setRetention(Number(settings.request_retention));
      if (settings.maximum_interval)
        setMaxInterval(Number(settings.maximum_interval));

      if (settings.ai_config) {
        if (settings.ai_config.text) setTextConfig(settings.ai_config.text);
        if (settings.ai_config.embedding)
          setEmbeddingConfig(settings.ai_config.embedding);
        if (settings.ai_config.reasoning)
          setReasoningConfig(settings.ai_config.reasoning);
      }

      if (settings.available_models) {
        setAvailableModels((prev) => ({
          ...prev,
          ...settings.available_models,
        }));
      }
    }
  }, [settings]);

  useLayoutEffect(() => {
    if (isMobile) {
      const config = mobileAIService.getConfig();
      setMobileAIConfig(config);
      if (config) {
        setMobileApiKey(config.apiKey);
        setMobileProvider(config.provider);
        setMobileModel(config.model || "deepseek-chat");
      }
    }
  }, [isMobile]);

  const handleSaveAllSettings = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        settings: {
          ...settings,
          request_retention: Number(retention),
          maximum_interval: Number(maxInterval),
          ai_config: {
            text: textConfig,
            embedding: embeddingConfig,
            reasoning: reasoningConfig,
          },
          available_models: availableModels,
        },
      });
      addMessage({ type: "success", content: t("settings.saveSuccess") });
    } catch (e) {
      console.error(e);
      addMessage({ type: "error", content: t("settings.saveFailed") });
    }
  };

  const handleAddModel = () => {
    if (!newModelName.trim()) return;
    const provider = selectedProviderForAdd;
    const currentModels = availableModels[provider] || [];

    if (currentModels.includes(newModelName.trim())) {
      addMessage({ type: "warning", content: t("settings.modelExists") });
      return;
    }

    setAvailableModels((prev) => ({
      ...prev,
      [provider]: [...(prev[provider] || []), newModelName.trim()],
    }));
    setNewModelName("");
    addMessage({
      type: "success",
      content: `${t("settings.modelAdded")}: ${newModelName}`,
    });
  };

  const handleDeleteModel = (provider: string, model: string) => {
    setAvailableModels((prev) => ({
      ...prev,
      [provider]: prev[provider].filter((m) => m !== model),
    }));
  };

  const handleSaveMobileAIConfig = () => {
    if (!mobileApiKey.trim()) {
      addMessage({ type: "warning", content: t("settings.enterApiKey") });
      return;
    }

    const config: MobileAIUserConfig = {
      provider: mobileProvider,
      model: mobileModel,
      apiKey: mobileApiKey.trim(),
    };

    mobileAIService.setConfig(config);
    setMobileAIConfig(config);
    addMessage({ type: "success", content: t("settings.mobileConfigSaved") });
  };

  const handleClearMobileAIConfig = () => {
    mobileAIService.clearConfig();
    setMobileAIConfig(null);
    setMobileApiKey("");
    addMessage({ type: "success", content: t("settings.mobileConfigCleared") });
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4 md:p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-6">
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
              className="px-4 py-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm min-h-[44px]"
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

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t("settings.appearance")}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setTheme("light")}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                themeMode === "light"
                  ? "bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300"
                  : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
              }`}
            >
              <Sun className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">
                {t("settings.lightMode")}
              </span>
            </button>

            <button
              onClick={() => setTheme("dark")}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                themeMode === "dark"
                  ? "bg-slate-800 border-slate-700 text-white ring-1 ring-slate-600 dark:bg-blue-600 dark:border-blue-500"
                  : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
              }`}
            >
              <Moon className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">
                {t("settings.darkMode")}
              </span>
            </button>

            <button
              onClick={() => setTheme("system")}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                themeMode === "system"
                  ? "bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300"
                  : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
              }`}
            >
              <Monitor className="w-6 h-6 mb-2" />
              <span className="font-medium text-sm">
                {t("settings.followSystem")}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t("settings.language")}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => i18n.changeLanguage("zh-CN")}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                i18n.language === "zh-CN" || i18n.language.startsWith("zh")
                  ? "bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300"
                  : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
              }`}
            >
              <span className="text-2xl mb-2">中</span>
              <span className="font-medium text-sm">
                {t("settings.chinese")}
              </span>
            </button>

            <button
              onClick={() => i18n.changeLanguage("en-US")}
              className={`flex flex-col items-center justify-center p-4 rounded-lg border transition-all min-h-[88px] ${
                i18n.language === "en-US" || i18n.language.startsWith("en")
                  ? "bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300"
                  : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
              }`}
            >
              <span className="text-2xl mb-2">A</span>
              <span className="font-medium text-sm">
                {t("settings.english")}
              </span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("settings.aiStatus")}
              </h2>
            </div>
          </div>

          <div className="mb-8 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
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
                className="p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              >
                <option value="deepseek">Deepseek</option>
                <option value="volcengine">火山引擎 (Volcengine)</option>
                <option value="aliyun">阿里云 (Aliyun)</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder={t("settings.inputModelName")}
                  className="flex-1 p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                />
                <button
                  onClick={handleAddModel}
                  disabled={!newModelName.trim()}
                  className="px-4 py-3 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 transition-colors whitespace-nowrap min-h-[44px]"
                >
                  <Plus className="w-4 h-4" /> {t("settings.addModel")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(availableModels).map(([provider, models]) => (
                <div
                  key={provider}
                  className="bg-white dark:bg-slate-900 p-3 rounded border border-gray-100 dark:border-slate-700"
                >
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2 border-b dark:border-slate-700 pb-1">
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
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-100 transition-opacity p-1 min-h-[32px] min-w-[32px]"
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
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-400">
                  <Brain className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {t("settings.textTask")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("settings.provider")}
                  </label>
                  <select
                    value={textConfig.provider}
                    onChange={(e) =>
                      setTextConfig({
                        ...textConfig,
                        provider: e.target.value,
                        model: availableModels[e.target.value]?.[0] || "",
                      })
                    }
                    className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                  >
                    <option value="deepseek">Deepseek</option>
                    <option value="volcengine">火山引擎 (Volcengine)</option>
                    <option value="aliyun">阿里云 (Aliyun)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("settings.modelName")}
                  </label>
                  <select
                    value={textConfig.model}
                    onChange={(e) =>
                      setTextConfig({ ...textConfig, model: e.target.value })
                    }
                    className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                  >
                    {availableModels[textConfig.provider]?.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {!availableModels[textConfig.provider]?.length && (
                      <option value="" disabled>
                        {t("settings.noProviderModels")}
                      </option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">
                  <Cpu className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {t("settings.embeddingTask")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("settings.provider")}
                  </label>
                  <select
                    value={embeddingConfig.provider}
                    onChange={(e) =>
                      setEmbeddingConfig({
                        ...embeddingConfig,
                        provider: e.target.value,
                        model: availableModels[e.target.value]?.[0] || "",
                      })
                    }
                    className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                  >
                    <option value="volcengine">火山引擎 (Volcengine)</option>
                    <option value="aliyun">阿里云 (Aliyun)</option>
                    <option value="deepseek">Deepseek</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("settings.modelName")}
                  </label>
                  <select
                    value={embeddingConfig.model}
                    onChange={(e) =>
                      setEmbeddingConfig({
                        ...embeddingConfig,
                        model: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                  >
                    {availableModels[embeddingConfig.provider]?.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {!availableModels[embeddingConfig.provider]?.length && (
                      <option value="" disabled>
                        {t("settings.noProviderModels")}
                      </option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded text-orange-700 dark:text-orange-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {t("settings.reasoningTask")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("settings.provider")}
                  </label>
                  <select
                    value={reasoningConfig.provider}
                    onChange={(e) =>
                      setReasoningConfig({
                        ...reasoningConfig,
                        provider: e.target.value,
                        model: availableModels[e.target.value]?.[0] || "",
                      })
                    }
                    className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                  >
                    <option value="aliyun">阿里云 (Aliyun)</option>
                    <option value="deepseek">Deepseek</option>
                    <option value="volcengine">火山引擎 (Volcengine)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("settings.modelName")}
                  </label>
                  <select
                    value={reasoningConfig.model}
                    onChange={(e) =>
                      setReasoningConfig({
                        ...reasoningConfig,
                        model: e.target.value,
                      })
                    }
                    className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[44px]"
                  >
                    {availableModels[reasoningConfig.provider]?.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {!availableModels[reasoningConfig.provider]?.length && (
                      <option value="" disabled>
                        {t("settings.noProviderModels")}
                      </option>
                    )}
                  </select>
                </div>
              </div>
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

        {isMobile && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("settings.mobileAIConfig")}
              </h2>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t("settings.mobileAIConfigDesc")}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t("settings.aiServiceProvider")}
                </label>
                <select
                  value={mobileProvider}
                  onChange={(e) => {
                    const provider = e.target.value as AIProviderType;
                    setMobileProvider(provider);
                    setMobileModel(availableModels[provider]?.[0] || "");
                  }}
                  className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
                >
                  <option value="deepseek">Deepseek</option>
                  <option value="volcengine">火山引擎 (Volcengine)</option>
                  <option value="aliyun">阿里云 (Aliyun)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t("settings.model")}
                </label>
                <select
                  value={mobileModel}
                  onChange={(e) => setMobileModel(e.target.value)}
                  className="w-full p-3 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
                >
                  {availableModels[mobileProvider]?.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t("settings.apiKey")}
                </label>
                <div className="relative">
                  <input
                    type={showMobileApiKey ? "text" : "password"}
                    value={mobileApiKey}
                    onChange={(e) => setMobileApiKey(e.target.value)}
                    placeholder={t("settings.enterApiKey")}
                    className="w-full p-3 pr-20 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMobileApiKey(!showMobileApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showMobileApiKey ? t("settings.hide") : t("settings.show")}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveMobileAIConfig}
                  className="flex-1 px-4 py-3 rounded-md bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2 transition-colors shadow-sm min-h-[44px]"
                >
                  <Save className="w-4 h-4" />
                  {t("settings.saveConfig")}
                </button>
                {mobileAIConfig && (
                  <button
                    onClick={handleClearMobileAIConfig}
                    className="px-4 py-3 rounded-md border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors min-h-[44px]"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("settings.clear")}
                  </button>
                )}
              </div>

              {mobileAIConfig && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm">
                  <div className="text-green-700 dark:text-green-300">
                    ✓ {t("settings.configured")}: {mobileAIConfig.provider} /{" "}
                    {mobileAIConfig.model}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("settings.fsrsConfig")}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                  {t("settings.requestRetention")}
                </label>
                <input
                  type="number"
                  min="0.70"
                  max="0.99"
                  step="0.01"
                  value={retention}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0.7 && val <= 0.99)
                      setRetention(val);
                  }}
                  className="w-20 p-2 text-right text-indigo-600 dark:text-indigo-400 font-bold bg-transparent border-b border-indigo-200 dark:border-indigo-800 focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>
              <input
                type="range"
                min="0.70"
                max="0.99"
                step="0.01"
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value))}
                className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t("settings.requestRetentionDesc")}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                  {t("settings.maxReviewInterval")}
                </label>
                <input
                  type="number"
                  min="1"
                  max="36500"
                  value={maxInterval}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1 && val <= 36500)
                      setMaxInterval(val);
                  }}
                  className="w-24 p-2 text-right text-indigo-600 dark:text-indigo-400 font-bold bg-transparent border-b border-indigo-200 dark:border-indigo-800 focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>
              <input
                type="range"
                min="1"
                max="36500"
                step="10"
                value={maxInterval}
                onChange={(e) => setMaxInterval(Number(e.target.value))}
                className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t("settings.maxIntervalDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
