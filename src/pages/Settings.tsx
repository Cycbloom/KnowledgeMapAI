import {
  useState,
  useLayoutEffect,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAIStatus, useUser } from "../hooks/queries";
import { useUpdateProfileMutation } from "../hooks/mutations";
import { useStore } from "../store/useStore";
import { useLearningSettingsStore } from "../store/useLearningSettingsStore";
import { useFocusStore, DEFAULT_SETTINGS } from "../store/useFocusStore";
import { message } from "../utils/messageHelper";
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
  Puzzle,
  SwatchBook,
  Database,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Info,
  Timer,
  Clock,
  Coffee,
  RefreshCw,
  Bell,
  Volume2,
} from "lucide-react";
import { AvailableModels } from "../types";
import type { AIProviderType } from "@shared/types";
import { isCapacitorMobile } from "../config/mobileApiConfig";
import { mobileAIService } from "../services/mobile/aiService";
import type { MobileAIUserConfig } from "../services/mobile/aiService";
import { PluginMarketplace } from "../components/PluginMarketplace/PluginMarketplace";
import { apiClient } from "../services/api/createApiClient";
import { studyApi } from "../services/api/study";
import { isElectron } from "../config/electronConfig";
import { updateSupabaseConfig } from "../config/authConfig";
import { resetSupabaseClient } from "../lib/supabase";

interface ProviderConfig {
  configured: boolean;
  apiKey: string;
  baseURL: string;
  model: string;
  source: "user" | "env" | "none";
}

interface ProviderFormData {
  apiKey: string;
  baseURL: string;
  model: string;
}

interface DatabaseConfig {
  configured: boolean;
  url: string;
  mode: "cloud" | "local";
  connected: boolean;
}

const PROVIDER_DEFAULTS: Record<
  string,
  {
    name: string;
    baseURL: string;
    model: string;
    embeddingModel?: string;
    supportsEmbedding?: boolean;
  }
> = {
  deepseek: {
    name: "Deepseek",
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    embeddingModel: undefined,
    supportsEmbedding: false,
  },
  volcengine: {
    name: "火山引擎 (Volcengine)",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-pro-4k",
    embeddingModel: "doubao-embedding-vision-251215",
    supportsEmbedding: true,
  },
  aliyun: {
    name: "阿里云 (Aliyun)",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-max",
    embeddingModel: "text-embedding-v3",
    supportsEmbedding: true,
  },
  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    embeddingModel: "text-embedding-3-small",
    supportsEmbedding: true,
  },
  zhipu: {
    name: "智谱 AI (Zhipu)",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    embeddingModel: "embedding-3",
    supportsEmbedding: true,
  },
  moonshot: {
    name: "月之暗面 (Moonshot)",
    baseURL: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    embeddingModel: undefined,
    supportsEmbedding: false,
  },
};

const STUDY_MODE_OPTIONS = [
  { value: "drill", label: "刷题模式", description: "跳过学习材料，直接测验，短间隔高频" },
  { value: "deep", label: "深度学习", description: "完整工作流，标准FSRS参数" },
  { value: "preview", label: "快速浏览", description: "仅阅读材料，不生成复习卡片" },
  { value: "review", label: "间隔复习", description: "到期复习节点，标准调度" },
  { value: "quiz", label: "测验模式", description: "直接测验已学节点" },
  { value: "mixed", label: "混合模式", description: "自动按节点状态选择策略" },
] as const;

const STUDY_MODE_PRESETS: Record<string, { requestRetention: number; maximumInterval: number }> = {
  drill: { requestRetention: 0.85, maximumInterval: 30 },
  deep: { requestRetention: 0.9, maximumInterval: 36500 },
  preview: { requestRetention: 0.7, maximumInterval: 7 },
  review: { requestRetention: 0.9, maximumInterval: 36500 },
  quiz: { requestRetention: 0.85, maximumInterval: 180 },
  mixed: { requestRetention: 0.9, maximumInterval: 36500 },
};

const DEFAULT_MASTERY_THRESHOLDS = {
  learningReview: 0.3,
  reviewPractice: 0.5,
  practiceQuiz: 0.7,
};

const DEFAULT_SCHEDULER_WEIGHTS = {
  timeSlot: 0.1,
  mastery: 0.2,
  dependency: 0.15,
  typeMatch: 0.1,
  priority: 0.15,
  urgency: 0.2,
  availability: 0.1,
};

const STUDY_STRATEGY_DEFAULTS = {
  defaultStudyMode: "mixed",
  requestRetention: 0.9,
  maximumInterval: 36500,
  masteryThresholds: DEFAULT_MASTERY_THRESHOLDS,
  schedulerWeights: DEFAULT_SCHEDULER_WEIGHTS,
};

export const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { token } = useStore();
  const { themeMode, setTheme, themePreset, setThemePreset, availablePresets } =
    useTheme();
  const { aiLanguage, setAILanguage } = useLearningSettingsStore();
  const {
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    longBreakInterval,
    autoStartBreak,
    autoStartPomodoro,
    soundEnabled,
    notificationEnabled,
    updateSettings: updateFocusSettings,
  } = useFocusStore();

  const { data: userData } = useUser(!!token);
  const { data: aiStatus } = useAIStatus(!!token);
  const updateProfileMutation = useUpdateProfileMutation();

  const profile = (userData as any)?.user?.profile;
  const settings = profile?.settings;

  const [retention, setRetention] = useState(0.9);
  const [maxInterval, setMaxInterval] = useState(36500);
  const [defaultStudyMode, setDefaultStudyMode] = useState("mixed");
  const [masteryThresholds, setMasteryThresholds] = useState(DEFAULT_MASTERY_THRESHOLDS);
  const [schedulerWeights, setSchedulerWeights] = useState(DEFAULT_SCHEDULER_WEIGHTS);
  const [semanticScheduling, setSemanticScheduling] = useState(true);

  const [fsrsParams, setFsrsParams] = useState<{
    source: "default" | "custom" | "optimized";
    w: number[];
    request_retention: number;
    maximum_interval: number;
    last_optimized_at: string | null;
  } | null>(null);
  const [fsrsLoading, setFsrsLoading] = useState(false);
  const [fsrsOptimizing, setFsrsOptimizing] = useState(false);
  const [fsrsOptimizeResult, setFsrsOptimizeResult] = useState<{
    success: boolean;
    improvement: number;
    reviewCount: number;
    message: string;
  } | null>(null);

  const [mainAiConfig, setMainAiConfig] = useState({
    provider: "deepseek",
    model: "deepseek-chat",
  });
  const [mainAiStatus, setMainAiStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [embeddingAiConfig, setEmbeddingAiConfig] = useState<{
    provider: string;
    model: string;
    baseURL: string;
    apiKey: string;
    enabled: boolean;
    loaded: boolean;
    isDefault: boolean; // 标记是否为默认值（未从数据库加载）
  }>({
    provider: "volcengine",
    model: "doubao-embedding-vision-251215",
    baseURL: "",
    apiKey: "",
    enabled: true,
    loaded: false,
    isDefault: true, // 初始是默认值
  });
  const [embeddingAiStatus, setEmbeddingAiStatus] = useState<{
    configured: boolean;
    source: string;
  } | null>(null);
  const [testingMainAi, setTestingMainAi] = useState(false);
  const [testingEmbedding, setTestingEmbedding] = useState(false);

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

  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig>({
    configured: false,
    url: "",
    mode: "cloud",
    connected: false,
  });
  const [dbForm, setDbForm] = useState({
    url: "",
    anonKey: "",
    serviceRoleKey: "",
    databaseUrl: "",
  });
  const [dbExpanded, setDbExpanded] = useState(false);
  const [showDbAnonKey, setShowDbAnonKey] = useState(false);
  const [showDbServiceRoleKey, setShowDbServiceRoleKey] = useState(false);
  const [dbSaving, setDbSaving] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [schemaStatus, setSchemaStatus] = useState<{
    status: string;
    executedCount: number;
    totalMigrations: number;
    missingVersions: string[];
  } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [reinitializing, setReinitializing] = useState(false);
  const [reinitConfirm, setReinitConfirm] = useState(false);

  const dbSectionRef = useRef<HTMLDivElement>(null);

  const loadFsrsParameters = useCallback(async () => {
    setFsrsLoading(true);
    try {
      const data = await studyApi.getFsrsParameters();
      setFsrsParams(data as typeof fsrsParams);
    } catch {
      // 静默处理
    } finally {
      setFsrsLoading(false);
    }
  }, []);

  const handleOptimizeFsrs = useCallback(async () => {
    setFsrsOptimizing(true);
    setFsrsOptimizeResult(null);
    try {
      const result = await studyApi.optimizeFsrsParameters();
      setFsrsOptimizeResult(result as typeof fsrsOptimizeResult);
      if ((result as { success?: boolean }).success) {
        await loadFsrsParameters();
      }
    } catch {
      setFsrsOptimizeResult({ success: false, improvement: 0, reviewCount: 0, message: "优化失败，请稍后重试" });
    } finally {
      setFsrsOptimizing(false);
    }
  }, [loadFsrsParameters]);

  const handleResetFsrs = useCallback(async () => {
    try {
      await studyApi.resetFsrsParameters();
      await loadFsrsParameters();
      setFsrsOptimizeResult(null);
    } catch {
      // 静默处理
    }
  }, [loadFsrsParameters]);

  const scrollToDbSection = useCallback(() => {
    dbSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  useLayoutEffect(() => {
    if (settings) {
      if (settings.request_retention)
        setRetention(Number(settings.request_retention));
      if (settings.maximum_interval)
        setMaxInterval(Number(settings.maximum_interval));
      if (settings.defaultStudyMode)
        setDefaultStudyMode(settings.defaultStudyMode);
      if (settings.masteryThresholds)
        setMasteryThresholds(settings.masteryThresholds);
      if (settings.schedulerWeights)
        setSchedulerWeights(settings.schedulerWeights);
      if (settings.semantic_scheduling !== undefined)
        setSemanticScheduling(settings.semantic_scheduling);

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

  useLayoutEffect(() => {
    if (token) {
      fetchProviderConfigs();
      fetchDatabaseConfig();
      fetchSchemaStatus();
    }
  }, [token]);

  useEffect(() => {
    loadFsrsParameters();
  }, [loadFsrsParameters]);

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

        // 修复：正确处理 embedding 配置加载
        const embProvider = embRes.provider as string;
        if (embProvider) {
          // 数据库中有配置 → 使用数据库的值
          setEmbeddingAiConfig({
            provider: embProvider,
            model: (embRes.model as string) || "",
            baseURL: (embRes.baseURL as string) || "",
            apiKey: "",
            enabled: true,
            loaded: true,
            isDefault: false, // 从数据库加载，不是默认值
          });
          setEmbeddingAiStatus({
            configured: embRes.configured as boolean,
            source: embRes.source as string,
          });
        } else {
          // 数据库中没有 embedding 配置 → 自动保存默认值到数据库
          try {
            await apiClient.put("/ai/config/embedding", {
              provider: "volcengine",
              model: "doubao-embedding-vision-251215",
            });

            setEmbeddingAiConfig({
              provider: "volcengine",
              model: "doubao-embedding-vision-251215",
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
        // 不再静默失败 - 标记加载完成但保持未配置状态
        setEmbeddingAiConfig((prev) => ({
          ...prev,
          enabled: false,
          loaded: true,
        }));
        message.warning(
          t("settings.loadConfigFailed") || "Failed to load AI configuration",
        );
      }
    };
    if (token) {
      loadAiConfigs();
    }
  }, [token]);

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
    } catch {
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

  const fetchDatabaseConfig = async () => {
    setDbLoading(true);
    try {
      const response = (await apiClient.get(
        "/ai/config/database",
      )) as DatabaseConfig;
      setDatabaseConfig(response);
    } catch {
      setDatabaseConfig({
        configured: false,
        url: "",
        mode: "cloud",
        connected: false,
      });
    } finally {
      setDbLoading(false);
    }
  };

  const fetchSchemaStatus = async () => {
    try {
      const response = (await apiClient.get("/database/status")) as {
        status: string;
        executedCount: number;
        totalMigrations: number;
        missingVersions: string[];
      };
      setSchemaStatus(response);
    } catch {
      setSchemaStatus(null);
    }
  };

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
        provider: PROVIDER_DEFAULTS[provider]?.name || provider,
      }));
      await fetchProviderConfigs();
    } catch {
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
          provider: PROVIDER_DEFAULTS[provider]?.name || provider,
        }));
      } else {
        message.error(
          response.message ||
            t("settings.providerTestFailed", {
              provider: PROVIDER_DEFAULTS[provider]?.name || provider,
            }),
        );
      }
    } catch {
      message.error(t("settings.providerTestFailed", {
        provider: PROVIDER_DEFAULTS[provider]?.name || provider,
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
        provider: PROVIDER_DEFAULTS[provider]?.name || provider,
      }));
      await fetchProviderConfigs();
    } catch {
      message.error(t("settings.providerConfigSaveFailed"));
    }
  };

  const handleSaveDatabaseConfig = async () => {
    if (!dbForm.url.trim() || !dbForm.anonKey.trim()) {
      message.warning(t("settings.dbUrlAndAnonKeyRequired"));
      return;
    }

    setDbSaving(true);
    try {
      if (isElectron() && window.electronAPI?.config) {
        await window.electronAPI.config.write({
          database: {
            url: dbForm.url,
            anonKey: dbForm.anonKey,
            serviceRoleKey: dbForm.serviceRoleKey,
            databaseUrl: dbForm.databaseUrl,
          },
        });
      }

      await apiClient.put("/ai/config/database", {
        url: dbForm.url,
        anonKey: dbForm.anonKey,
        serviceRoleKey: dbForm.serviceRoleKey,
        databaseUrl: dbForm.databaseUrl,
      });

      updateSupabaseConfig(dbForm.url, dbForm.anonKey);
      resetSupabaseClient();

      message.success(t("settings.dbConfigSaved"));
      await fetchDatabaseConfig();
    } catch {
      message.error(t("settings.dbConfigSaveFailed"));
    } finally {
      setDbSaving(false);
    }
  };

  const handleTestDatabaseConnection = async () => {
    setDbTesting(true);
    try {
      await fetchDatabaseConfig();
      if (databaseConfig.connected) {
        message.success(t("settings.dbConnected"));
      } else {
        message.error(t("settings.dbNotConnected"));
      }
    } catch {
      message.error(t("settings.dbTestFailed"));
    } finally {
      setDbTesting(false);
    }
  };

  const handleSaveAllSettings = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        settings: {
          ...settings,
          request_retention: Number(retention),
          maximum_interval: Number(maxInterval),
          defaultStudyMode,
          masteryThresholds,
          schedulerWeights,
          semantic_scheduling: semanticScheduling,
          available_models: availableModels,
        },
      });
      message.success(t("settings.saveSuccess"));
    } catch (e) {
      console.error(e);
      message.error(t("settings.saveFailed"));
    }
  };

  const handleStudyModeChange = (mode: string) => {
    setDefaultStudyMode(mode);
    const preset = STUDY_MODE_PRESETS[mode];
    if (preset) {
      setRetention(preset.requestRetention);
      setMaxInterval(preset.maximumInterval);
    }
  };

  const handleResetStudyStrategyDefaults = () => {
    setDefaultStudyMode(STUDY_STRATEGY_DEFAULTS.defaultStudyMode);
    setRetention(STUDY_STRATEGY_DEFAULTS.requestRetention);
    setMaxInterval(STUDY_STRATEGY_DEFAULTS.maximumInterval);
    setMasteryThresholds({ ...DEFAULT_MASTERY_THRESHOLDS });
    setSchedulerWeights({ ...DEFAULT_SCHEDULER_WEIGHTS });
  };

  const handleResetFocusDefaults = () => {
    updateFocusSettings({
      focusDuration: DEFAULT_SETTINGS.focusDuration,
      shortBreakDuration: DEFAULT_SETTINGS.shortBreakDuration,
      longBreakDuration: DEFAULT_SETTINGS.longBreakDuration,
      longBreakInterval: DEFAULT_SETTINGS.longBreakInterval,
      autoStartBreak: DEFAULT_SETTINGS.autoStartBreak,
      autoStartPomodoro: DEFAULT_SETTINGS.autoStartPomodoro,
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      notificationEnabled: DEFAULT_SETTINGS.notificationEnabled,
    });
  };

  const handleAddModel = () => {
    if (!newModelName.trim()) return;
    const provider = selectedProviderForAdd;
    const currentModels = availableModels[provider] || [];

    if (currentModels.includes(newModelName.trim())) {
      message.warning(t("settings.modelExists"));
      return;
    }

    setAvailableModels((prev) => ({
      ...prev,
      [provider]: [...(prev[provider] || []), newModelName.trim()],
    }));
    setNewModelName("");
    message.success(`${t("settings.modelAdded")}: ${newModelName}`);
  };

  const handleDeleteModel = (provider: string, model: string) => {
    setAvailableModels((prev) => ({
      ...prev,
      [provider]: prev[provider].filter((m) => m !== model),
    }));
  };

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
            PROVIDER_DEFAULTS[mainAiConfig.provider]?.name ||
            mainAiConfig.provider,
        }));
      } else {
        message.error(
          response.message ||
            t("settings.providerTestFailed", {
              provider:
                PROVIDER_DEFAULTS[mainAiConfig.provider]?.name ||
                mainAiConfig.provider,
            }),
        );
      }
    } catch {
      message.error(t("settings.providerTestFailed", {
        provider:
          PROVIDER_DEFAULTS[mainAiConfig.provider]?.name ||
          mainAiConfig.provider,
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
            PROVIDER_DEFAULTS[embeddingAiConfig.provider]?.name ||
            embeddingAiConfig.provider,
        }));
      } else {
        message.error(
          response.message ||
            t("settings.providerTestFailed", {
              provider:
                PROVIDER_DEFAULTS[embeddingAiConfig.provider]?.name ||
                embeddingAiConfig.provider,
            }),
        );
      }
    } catch {
      message.error(t("settings.providerTestFailed", {
        provider:
          PROVIDER_DEFAULTS[embeddingAiConfig.provider]?.name ||
          embeddingAiConfig.provider,
      }));
    } finally {
      setTestingEmbedding(false);
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
    <div className="h-full overflow-y-auto px-4 py-4 md:p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-6">
        {!databaseConfig.connected && !dbLoading && (
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
                  ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
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
                  ? "bg-slate-800 border-slate-700 text-white ring-1 ring-slate-600 dark:bg-primary-600 dark:border-primary-500"
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
                  ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
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
            <SwatchBook className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t("settings.themePreset")}
            </h2>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {availablePresets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => setThemePreset(preset.key)}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[80px] ${
                  themePreset === preset.key
                    ? "border-2 bg-primary-50 dark:bg-primary-900/30"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
                style={
                  themePreset === preset.key
                    ? { borderColor: preset.previewColors[0] }
                    : undefined
                }
              >
                <div className="flex space-x-1 mb-2">
                  {preset.previewColors.map((color, idx) => (
                    <div
                      key={idx}
                      className="w-4 h-4 rounded-full ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-800"
                      style={
                        {
                          backgroundColor: color,
                          "--tw-ring-color":
                            themePreset === preset.key ? color : "transparent",
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
                <span className="font-medium text-xs text-center">
                  {t(`settings.themePresets.${preset.key}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-orange-500 dark:text-orange-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("settings.focusMode")}
              </h2>
            </div>
            <button
              onClick={handleResetFocusDefaults}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t("settings.resetFocusDefaults")}
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                {t("settings.timeDurations")}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Clock className="w-4 h-4 text-primary-500" />
                      {t("settings.focusDuration")}
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {focusDuration} {t("settings.minutes")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={focusDuration}
                    onChange={(e) => updateFocusSettings({ focusDuration: Number(e.target.value) })}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>5 {t("settings.minutes")}</span>
                    <span>60 {t("settings.minutes")}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Coffee className="w-4 h-4 text-emerald-500" />
                      {t("settings.shortBreakDuration")}
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {shortBreakDuration} {t("settings.minutes")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={1}
                    value={shortBreakDuration}
                    onChange={(e) => updateFocusSettings({ shortBreakDuration: Number(e.target.value) })}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 {t("settings.minutes")}</span>
                    <span>15 {t("settings.minutes")}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Coffee className="w-4 h-4 text-purple-500" />
                      {t("settings.longBreakDuration")}
                    </span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {longBreakDuration} {t("settings.minutes")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={30}
                    step={5}
                    value={longBreakDuration}
                    onChange={(e) => updateFocusSettings({ longBreakDuration: Number(e.target.value) })}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>10 {t("settings.minutes")}</span>
                    <span>30 {t("settings.minutes")}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <RefreshCw className="w-4 h-4 text-amber-500" />
                      {t("settings.longBreakInterval")}
                    </span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {longBreakInterval} {t("settings.pomodoros")}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={6}
                    step={1}
                    value={longBreakInterval}
                    onChange={(e) => updateFocusSettings({ longBreakInterval: Number(e.target.value) })}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>2 {t("settings.pomodoros")}</span>
                    <span>6 {t("settings.pomodoros")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                {t("settings.automationOptions")}
              </h3>

              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.autoStartBreak")}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {t("settings.autoStartBreakDesc")}
                    </p>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      autoStartBreak ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                    onClick={() => updateFocusSettings({ autoStartBreak: !autoStartBreak })}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        autoStartBreak ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  <div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.autoStartPomodoro")}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {t("settings.autoStartPomodoroDesc")}
                    </p>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      autoStartPomodoro ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                    onClick={() => updateFocusSettings({ autoStartPomodoro: !autoStartPomodoro })}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        autoStartPomodoro ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  <div>
                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Volume2 className="w-4 h-4 text-gray-400" />
                      {t("settings.soundEnabled")}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {t("settings.soundEnabledDesc")}
                    </p>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      soundEnabled ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                    onClick={() => updateFocusSettings({ soundEnabled: !soundEnabled })}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        soundEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                  <div>
                    <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Bell className="w-4 h-4 text-gray-400" />
                      {t("settings.notificationEnabled")}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {t("settings.notificationEnabledDesc")}
                    </p>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                      notificationEnabled ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                    onClick={() => updateFocusSettings({ notificationEnabled: !notificationEnabled })}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        notificationEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t("settings.language")}
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                {t("settings.interfaceLanguage")}
              </label>
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

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                {t("settings.aiOutputLanguage")}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setAILanguage("auto")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                    aiLanguage === "auto"
                      ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                      : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                  }`}
                >
                  <Monitor className="w-5 h-5 mb-1" />
                  <span className="font-medium text-sm">
                    {t("settings.languageAuto")}
                  </span>
                </button>

                <button
                  onClick={() => setAILanguage("zh-CN")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                    aiLanguage === "zh-CN"
                      ? "bg-red-50 border-red-200 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300"
                      : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="text-xl mb-1">中</span>
                  <span className="font-medium text-sm">
                    {t("settings.languageChinese")}
                  </span>
                </button>

                <button
                  onClick={() => setAILanguage("en-US")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all min-h-[72px] ${
                    aiLanguage === "en-US"
                      ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                      : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="text-xl mb-1">A</span>
                  <span className="font-medium text-sm">
                    {t("settings.languageEnglish")}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
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
                    className="rounded-lg border border-gray-100 dark:border-slate-700 overflow-hidden"
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
                          {defaults.name}
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
                      <div className="p-4 pt-0 space-y-3 border-t border-gray-100 dark:border-slate-700">
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
                              provider: defaults.name,
                            })}
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            API Key
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKey ? "text" : "password"}
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
                              className="w-full input-mobile pr-20 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Base URL
                          </label>
                          <input
                            type="text"
                            value={form.baseURL}
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
                            className="w-full input-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {t("settings.defaultModel")}
                          </label>
                          <input
                            type="text"
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
                            className="w-full input-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
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

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("settings.aiStatus")}
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
                className="select-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              >
                {Object.entries(PROVIDER_DEFAULTS).map(([key, defaults]) => (
                  <option key={key} value={key}>
                    {defaults.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder={t("settings.inputModelName")}
                  className="flex-1 input-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
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
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
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
                <span>API Key 请在上方「AI 服务密钥配置」中为此提供商设置</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("settings.provider")}
                  </label>
                  <select
                    value={mainAiConfig.provider}
                    onChange={(e) => handleMainAiProviderChange(e.target.value)}
                    className="w-full select-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  >
                    {Object.entries(PROVIDER_DEFAULTS).map(
                      ([key, defaults]) => (
                        <option key={key} value={key}>
                          {defaults.name}
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
                    className="w-full input-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
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

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
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
                      API Key 请在上方「AI 服务密钥配置」中为此提供商设置
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t("settings.provider")}
                    </label>
                    <select
                      value={embeddingAiConfig.provider}
                      onChange={(e) =>
                        handleEmbeddingProviderChange(e.target.value)
                      }
                      className="w-full select-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    >
                      {Object.entries(PROVIDER_DEFAULTS)
                        .filter(([, defaults]) => defaults.supportsEmbedding)
                        .map(([key, defaults]) => (
                          <option key={key} value={key}>
                            {defaults.name}
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
                      className="w-full input-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
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

        <div
          ref={dbSectionRef}
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("settings.databaseConfig")}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            {dbLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("common.loading")}
              </div>
            ) : (
              <>
                {databaseConfig.connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("settings.dbConnected")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <XCircle className="w-3.5 h-3.5" />
                    {t("settings.dbDisconnected")}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  {databaseConfig.mode === "local"
                    ? t("settings.dbModeLocal")
                    : t("settings.dbModeCloud")}
                </span>
                {databaseConfig.url && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {databaseConfig.url}
                  </span>
                )}
              </>
            )}
          </div>

          {schemaStatus && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {schemaStatus.status === "ready" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("settings.schemaReady", {
                    executed: schemaStatus.executedCount,
                    total: schemaStatus.totalMigrations,
                  })}
                </span>
              )}
              {schemaStatus.status === "empty" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <XCircle className="w-3.5 h-3.5" />
                  {t("settings.schemaEmpty")}
                </span>
              )}
              {schemaStatus.status === "partial" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("settings.schemaPartial", {
                    executed: schemaStatus.executedCount,
                    total: schemaStatus.totalMigrations,
                  })}
                </span>
              )}
              {schemaStatus.status === "needs_upgrade" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("settings.schemaNeedsUpgrade", {
                    executed: schemaStatus.executedCount,
                    total: schemaStatus.totalMigrations,
                  })}
                </span>
              )}
              {schemaStatus.status === "not_configured" && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <XCircle className="w-3.5 h-3.5" />
                  {t("settings.schemaNotConfigured")}
                </span>
              )}
            </div>
          )}

          <div className="rounded-lg border border-gray-100 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setDbExpanded(!dbExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors min-h-[44px]"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("settings.dbConfigForm")}
              </span>
              {dbExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {dbExpanded && (
              <div className="p-4 pt-0 space-y-3 border-t border-gray-100 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Supabase URL
                  </label>
                  <input
                    type="text"
                    value={dbForm.url}
                    onChange={(e) =>
                      setDbForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://xxx.supabase.co"
                    className="w-full input-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Anon Key
                  </label>
                  <div className="relative">
                    <input
                      type={showDbAnonKey ? "text" : "password"}
                      value={dbForm.anonKey}
                      onChange={(e) =>
                        setDbForm((prev) => ({
                          ...prev,
                          anonKey: e.target.value,
                        }))
                      }
                      placeholder="eyJhbGciOi..."
                      className="w-full input-mobile pr-20 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbAnonKey(!showDbAnonKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showDbAnonKey ? t("settings.hide") : t("settings.show")}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Service Role Key
                  </label>
                  <div className="relative">
                    <input
                      type={showDbServiceRoleKey ? "text" : "password"}
                      value={dbForm.serviceRoleKey}
                      onChange={(e) =>
                        setDbForm((prev) => ({
                          ...prev,
                          serviceRoleKey: e.target.value,
                        }))
                      }
                      placeholder="eyJhbGciOi..."
                      className="w-full input-mobile pr-20 rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowDbServiceRoleKey(!showDbServiceRoleKey)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showDbServiceRoleKey
                        ? t("settings.hide")
                        : t("settings.show")}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("settings.databaseUrl")}
                    </label>
                    <div className="group relative">
                      <Info className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                        {t("settings.databaseUrlTooltip")}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={dbForm.databaseUrl}
                    onChange={(e) =>
                      setDbForm((prev) => ({
                        ...prev,
                        databaseUrl: e.target.value,
                      }))
                    }
                    placeholder={t("settings.databaseUrlPlaceholder")}
                    className="w-full input-mobile rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleSaveDatabaseConfig}
                    disabled={dbSaving}
                    className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
                  >
                    {dbSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t("settings.saveAndReconnect")}
                  </button>
                  <button
                    onClick={handleTestDatabaseConnection}
                    disabled={dbTesting}
                    className="px-3 py-2 rounded-md border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
                  >
                    {dbTesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {t("settings.testConnection")}
                  </button>
                  {schemaStatus && schemaStatus.status !== "ready" && (
                    <button
                      onClick={async () => {
                        setMigrating(true);
                        try {
                          await apiClient.post("/database/migrate");
                          message.success(t("settings.migrationsSuccess"));
                          await fetchSchemaStatus();
                        } catch {
                          message.error(t("settings.migrationsFailed"));
                        } finally {
                          setMigrating(false);
                        }
                      }}
                      disabled={migrating}
                      className="px-3 py-2 rounded-md border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
                    >
                      {migrating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      {t("settings.runMigrations")}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!reinitConfirm) {
                        setReinitConfirm(true);
                        setTimeout(() => setReinitConfirm(false), 3000);
                        return;
                      }
                      setReinitializing(true);
                      setReinitConfirm(false);
                      try {
                        await apiClient.post("/database/reinitialize", {
                          confirm: true,
                        });
                        message.success(t("settings.reinitializeSuccess"));
                        await fetchSchemaStatus();
                      } catch {
                        message.error(t("settings.reinitializeFailed"));
                      } finally {
                        setReinitializing(false);
                      }
                    }}
                    disabled={reinitializing}
                    className={`px-3 py-2 rounded-md border text-sm transition-colors flex items-center gap-1.5 min-h-[44px] disabled:opacity-50 ${
                      reinitConfirm
                        ? "border-red-500 dark:border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                        : "border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    }`}
                  >
                    {reinitializing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    {reinitConfirm
                      ? t("settings.reinitializeConfirm")
                      : t("settings.reinitializeDatabase")}
                  </button>
                </div>
              </div>
            )}
          </div>
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
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                学习策略
              </h2>
            </div>
            <button
              onClick={handleResetStudyStrategyDefaults}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              恢复默认设置
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                默认学习模式
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STUDY_MODE_OPTIONS.map((mode) => (
                  <div
                    key={mode.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      defaultStudyMode === mode.value
                        ? "border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20"
                        : "border-gray-200 dark:border-slate-600 hover:border-primary-200 dark:hover:border-primary-800"
                    }`}
                    onClick={() => handleStudyModeChange(mode.value)}
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{mode.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                间隔重复参数
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.requestRetention")}
                    </span>
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
                      className="w-20 input-mobile text-right text-primary-600 dark:text-primary-400 font-bold bg-transparent border-b border-primary-200 dark:border-primary-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                  <input
                    type="range"
                    min="0.70"
                    max="0.99"
                    step="0.01"
                    value={retention}
                    onChange={(e) => setRetention(Number(e.target.value))}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t("settings.requestRetentionDesc")}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.maxReviewInterval")}
                    </span>
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
                      className="w-24 input-mobile text-right text-primary-600 dark:text-primary-400 font-bold bg-transparent border-b border-primary-200 dark:border-primary-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="36500"
                    step="10"
                    value={maxInterval}
                    onChange={(e) => setMaxInterval(Number(e.target.value))}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t("settings.maxIntervalDesc")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                掌握度阈值
              </label>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Learning / Review 分界值
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.learningReview.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.5"
                    step="0.05"
                    value={masteryThresholds.learningReview}
                    onChange={(e) =>
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        learningReview: Number(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    低于此值视为学习阶段，高于此值进入复习阶段
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Review / Practice 分界值
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.reviewPractice.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.7"
                    step="0.05"
                    value={masteryThresholds.reviewPractice}
                    onChange={(e) =>
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        reviewPractice: Number(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    低于此值需要复习巩固，高于此值进入练习阶段
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Practice / Quiz 分界值
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.practiceQuiz.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.9"
                    step="0.05"
                    value={masteryThresholds.practiceQuiz}
                    onChange={(e) =>
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        practiceQuiz: Number(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    低于此值需要练习强化，高于此值可以进入测验
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                调度权重
              </label>
              <div className="space-y-4">
                {[
                  { key: "timeSlot" as const, label: "时间段适配", desc: "根据当前时间段推荐适合的学习内容" },
                  { key: "mastery" as const, label: "掌握度优先", desc: "优先推荐掌握度较低的节点进行学习" },
                  { key: "dependency" as const, label: "依赖关系", desc: "优先学习前置依赖节点" },
                  { key: "typeMatch" as const, label: "类型匹配", desc: "匹配当前学习模式的内容类型" },
                  { key: "priority" as const, label: "优先级", desc: "按节点优先级排序" },
                  { key: "urgency" as const, label: "紧急程度", desc: "临近截止日期的节点优先" },
                  { key: "availability" as const, label: "可用性", desc: "考虑当前可用的学习资源" },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {item.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400 ml-4 shrink-0">
                        {schedulerWeights[item.key].toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.05"
                      value={schedulerWeights[item.key]}
                      onChange={(e) =>
                        setSchedulerWeights((prev) => ({
                          ...prev,
                          [item.key]: Number(e.target.value),
                        }))
                      }
                      className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary-500" />
                {t("settings.semanticScheduling")}
              </h3>

              <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t("settings.semanticScheduling")}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t("settings.semanticSchedulingDesc")}
                  </p>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    semanticScheduling ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                  onClick={() => setSemanticScheduling(!semanticScheduling)}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      semanticScheduling ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                学习算法
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  参数来源
                </span>
                <span className={`text-sm font-bold ${
                  fsrsParams?.source === "default" ? "text-gray-500 dark:text-gray-400" :
                  fsrsParams?.source === "optimized" ? "text-green-600 dark:text-green-400" :
                  "text-primary-600 dark:text-primary-400"
                }`}>
                  {fsrsLoading ? "加载中..." :
                   fsrsParams?.source === "default" ? "默认参数" :
                   fsrsParams?.source === "optimized" ? "已优化" :
                   fsrsParams?.source === "custom" ? "自定义" : "加载中..."}
                </span>
              </div>
              {fsrsParams?.last_optimized_at && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  上次优化: {new Date(fsrsParams.last_optimized_at).toLocaleString()}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                FSRS-6 算法使用 21 个参数（w[0]-w[20]）控制遗忘曲线和复习间隔。默认参数适合大多数用户，优化后可更贴合个人记忆特征。
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleOptimizeFsrs}
                disabled={fsrsOptimizing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {fsrsOptimizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    优化中...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    优化参数
                  </>
                )}
              </button>

              <button
                onClick={handleResetFsrs}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重置为默认
              </button>
            </div>

            {fsrsOptimizeResult && (
              <div className={`p-3 rounded-lg text-sm ${
                fsrsOptimizeResult.success
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              }`}>
                <div className="flex items-center gap-2">
                  {fsrsOptimizeResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 shrink-0" />
                  )}
                  <span>{fsrsOptimizeResult.message}</span>
                </div>
                {fsrsOptimizeResult.success && fsrsOptimizeResult.reviewCount > 0 && (
                  <p className="text-xs mt-1 opacity-80">
                    基于 {fsrsOptimizeResult.reviewCount} 条复习记录优化
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

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
