import React, { useState, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { isCapacitorMobile } from "../../config/mobileApiConfig";
import { mobileAIService } from "../../services/mobile/aiService";
import type { MobileAIUserConfig } from "../../services/mobile/aiService";
import type { AIProviderType } from "@shared/types";
import { AvailableModels } from "../../types";
import {
  Smartphone,
  Save,
  Trash2,
} from "lucide-react";
import { message } from "../../utils/messageHelper";

interface MobileAISettingsProps {
  availableModels: AvailableModels;
}

export const MobileAISettings = React.memo(function MobileAISettings({
  availableModels,
}: MobileAISettingsProps) {
  const { t } = useTranslation();
  const isMobile = isCapacitorMobile();

  const [mobileAIConfig, setMobileAIConfig] =
    useState<MobileAIUserConfig | null>(null);
  const [mobileApiKey, setMobileApiKey] = useState("");
  const [mobileProvider, setMobileProvider] =
    useState<AIProviderType>("deepseek");
  const [mobileModel, setMobileModel] = useState("deepseek-chat");
  const [showMobileApiKey, setShowMobileApiKey] = useState(false);

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

  if (!isMobile) return null;

  const handleSaveMobileAIConfig = () => {
    if (!mobileApiKey.trim()) {
      message.warning(t("settings.enterApiKey"));
      return;
    }

    const config: MobileAIUserConfig = {
      provider: mobileProvider,
      model: mobileModel,
      apiKey: mobileApiKey.trim(),
    };

    mobileAIService.setConfig(config);
    setMobileAIConfig(config);
    message.success(t("settings.mobileConfigSaved"));
  };

  const handleClearMobileAIConfig = () => {
    mobileAIService.clearConfig();
    setMobileAIConfig(null);
    setMobileApiKey("");
    message.success(t("settings.mobileConfigCleared"));
  };

  return (
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
            className="w-full select-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
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
            className="w-full select-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
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
              className="w-full input-mobile pr-20 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
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
  );
});
