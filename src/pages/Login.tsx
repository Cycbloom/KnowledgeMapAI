import React, { useState, useEffect, useCallback, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiClient } from "../services/api/createApiClient";
import {
  updateSupabaseConfig,
  isSupabaseConfigured,
  authConfig,
} from "../config/authConfig";
import { getSupabaseClient, resetSupabaseClient } from "../utils/supabase";
import { useStore } from "../store/useStore";
import { useTheme, useFormDraft } from "../hooks";
import { useKeyboardHandler } from "../hooks/gesture/useKeyboardHandler";
import { ConfirmationModal } from "../components/common/ConfirmationModal";
import { isElectron } from "../config/electronConfig";
import { logger } from "../utils/logger";
import type { AIProviderType } from "@shared/types/ai";
import {
  Database,
  Bot,
  Sun,
  Moon,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronDown,
  Zap,
  Settings,
  Key,
  Building2,
  Globe,
  Lock,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface MigrationResult {
  name: string;
  status: "success" | "failed" | "running" | "pending";
  message?: string;
}

interface ConfiguredProvider {
  provider: AIProviderType;
  label: string;
}

const AI_PROVIDERS: {
  value: AIProviderType;
  label: string;
  defaultBaseURL: string;
  defaultModel: string;
}[] = [
  {
    value: "deepseek",
    label: "DeepSeek",
    defaultBaseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    value: "volcengine",
    label: "Volcengine",
    defaultBaseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-pro-32k",
  },
  {
    value: "aliyun",
    label: "Aliyun",
    defaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-turbo",
  },
  {
    value: "openai",
    label: "OpenAI",
    defaultBaseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    value: "zhipu",
    label: "Zhipu",
    defaultBaseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
  },
  {
    value: "moonshot",
    label: "Moonshot",
    defaultBaseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
  },
];

const generatePassword = () => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  return Array.from(
    { length: 16 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
};

const openExternal = (url: string) => {
  if (isElectron() && window.electronAPI?.shell) {
    window.electronAPI.shell.openExternal(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

export const Login = () => {
  useKeyboardHandler();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useStore((state) => state.setUser);
  const { isDark, toggleTheme } = useTheme();

  const {
    value: draft,
    setValue: setDraft,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<{
    email: string;
    step: number;
    activeTab: "quick" | "manual";
  }>({
    key: "login_draft",
    initialValue: { email: "", step: 1, activeTab: "quick" },
    storage: "sessionStorage",
  });
  const [pat, setPat] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [patVerifying, setPatVerifying] = useState(false);
  const [patError, setPatError] = useState("");
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string; slug: string }>
  >([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [projectName, setProjectName] = useState("KnowledgeMap");
  const [dbPassword, setDbPassword] = useState("");
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [regions, setRegions] = useState<
    Array<{ code: string; name: string; location: string }>
  >([]);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [createError, setCreateError] = useState("");
  const [createdProject, setCreatedProject] = useState<{
    ref: string;
    url: string;
  } | null>(null);

  const [dbForm, setDbForm] = useState({
    url: "",
    anonKey: "",
    serviceRoleKey: "",
    databaseUrl: "",
  });
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceRoleKey, setShowServiceRoleKey] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbError, setDbError] = useState("");
  const [dbStatus, setDbStatus] = useState<
    "empty" | "partial" | "ready" | "unknown" | "loading"
  >("loading");
  const [dbInitializing, setDbInitializing] = useState(false);
  const [migrations, setMigrations] = useState<MigrationResult[]>([]);

  const [aiProvider, setAiProvider] = useState<AIProviderType>("deepseek");
  const [aiApiKey, setAiApiKey] = useState("");
  const [showAiApiKey, setShowAiApiKey] = useState(false);
  const [aiBaseURL, setAiBaseURL] = useState("https://api.deepseek.com/v1");
  const [aiModel, setAiModel] = useState("deepseek-chat");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<"success" | "error" | null>(
    null,
  );
  const [aiTestMessage, setAiTestMessage] = useState("");
  const [configuredProviders, setConfiguredProviders] = useState<
    ConfiguredProvider[]
  >([]);

  const [password, setPassword] = useState("");
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };
  const validatePassword = (value: string): boolean => {
    return value.trim().length > 0;
  };

  // A11y: 生成唯一 id 用于 label/input/error 关联，避免硬编码 id 冲突
  const patErrorId = useId();
  const quickEmailInputId = useId();
  const quickEmailErrorId = useId();
  const quickPasswordInputId = useId();
  const quickPasswordErrorId = useId();
  const quickAuthErrorId = useId();
  const manualEmailInputId = useId();
  const manualEmailErrorId = useId();
  const manualPasswordInputId = useId();
  const manualPasswordErrorId = useId();
  const manualAuthErrorId = useId();
  const projectNameInputId = useId();
  const dbPasswordInputId = useId();
  const regionInputId = useId();
  const supabaseUrlInputId = useId();
  const databaseUrlInputId = useId();
  const providerInputId = useId();
  const baseUrlInputId = useId();
  const modelInputId = useId();

  // Tab pattern a11y
  const tablistId = useId();
  const tabIdPrefix = `${tablistId}-tab`;
  const panelIdPrefix = `${tablistId}-panel`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // 公共路由 main 地标 ref，路由切换时 focus 便于键盘/SR 导航
  const mainRef = useRef<HTMLElement>(null);
  const loginTabs: { id: "quick" | "manual"; label: string }[] = [
    { id: "quick", label: t("quickSetup.quickSetup") },
    { id: "manual", label: t("quickSetup.manualSetup") },
  ];

  const handleTabKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % loginTabs.length;
        setDraft((prev) => ({ ...prev, activeTab: loginTabs[nextIndex].id }));
        tabRefs.current[nextIndex]?.focus();
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + loginTabs.length) % loginTabs.length;
        setDraft((prev) => ({ ...prev, activeTab: loginTabs[prevIndex].id }));
        tabRefs.current[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        e.preventDefault();
        setDraft((prev) => ({ ...prev, activeTab: loginTabs[0].id }));
        tabRefs.current[0]?.focus();
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastIndex = loginTabs.length - 1;
        setDraft((prev) => ({ ...prev, activeTab: loginTabs[lastIndex].id }));
        tabRefs.current[lastIndex]?.focus();
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    loadSavedConfig();
  }, []);

  // 路由切换时自动 focus 公共 main 地标，便于键盘导航与屏幕阅读器
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const provider = AI_PROVIDERS.find((p) => p.value === aiProvider);
    if (provider) {
      setAiBaseURL(provider.defaultBaseURL);
      setAiModel(provider.defaultModel);
    }
  }, [aiProvider]);

  const loadSavedConfig = async () => {
    const savedUrl = authConfig.supabase.url;
    const savedAnonKey = authConfig.supabase.anonKey;
    if (savedUrl) {
      setDbForm((prev) => ({ ...prev, url: savedUrl }));
    }
    if (savedAnonKey) {
      setDbForm((prev) => ({ ...prev, anonKey: savedAnonKey }));
    }

    if (window.electronAPI?.config) {
      try {
        const electronConfig =
          (await window.electronAPI.config.read()) as Record<string, unknown>;
        const db = electronConfig?.database as
          | Record<string, string>
          | undefined;
        if (db) {
          setDbForm((prev) => ({
            ...prev,
            url: db.url || prev.url,
            anonKey: db.anonKey || prev.anonKey,
            serviceRoleKey: db.serviceRoleKey || prev.serviceRoleKey,
            databaseUrl: db.databaseUrl || prev.databaseUrl,
          }));
        }
      } catch (error) {
        logger.warn("Login step failed", {
          step: "loadElectronConfig",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      const response = (await apiClient.get("/ai/config/database")) as Record<
        string,
        string
      >;
      if (response) {
        setDbForm((prev) => ({
          ...prev,
          url: response.url || prev.url,
          anonKey: response.anonKey || prev.anonKey,
          serviceRoleKey: response.serviceRoleKey || prev.serviceRoleKey,
          databaseUrl: response.databaseUrl || prev.databaseUrl,
        }));
      }
    } catch (error) {
      logger.warn("Login step failed", {
        step: "loadDatabaseConfig",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (isSupabaseConfigured()) {
      checkDatabaseStatus();
      setDbConnected(true);
    } else {
      setDbStatus("unknown");
    }

    loadConfiguredProviders();
  };

  const loadConfiguredProviders = async () => {
    try {
      const response = (await apiClient.get("/ai/config/providers")) as Record<
        string,
        Record<string, string>
      >;
      const providers: ConfiguredProvider[] = [];
      if (response && typeof response === "object") {
        for (const [key, value] of Object.entries(response)) {
          if (value?.apiKey) {
            const providerInfo = AI_PROVIDERS.find((p) => p.value === key);
            providers.push({
              provider: key as AIProviderType,
              label: providerInfo?.label || key,
            });
          }
        }
      }
      setConfiguredProviders(providers);
    } catch (error) {
      logger.warn("Login step failed", {
        step: "loadConfiguredProviders",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const checkDatabaseStatus = async () => {
    setDbStatus("loading");
    try {
      const response = (await apiClient.get("/database/status")) as {
        status: string;
      };
      setDbStatus(response.status as "empty" | "partial" | "ready");
    } catch (error) {
      logger.warn("Login step failed", {
        step: "checkDatabaseStatus",
        error: error instanceof Error ? error.message : String(error),
      });
      setDbStatus("unknown");
    }
  };

  const handleTestConnection = async () => {
    if (!dbForm.url.trim() || !dbForm.anonKey.trim()) {
      setDbError(t("configPage.urlAndAnonKeyRequired"));
      return;
    }

    setDbTesting(true);
    setDbError("");
    setDbConnected(false);

    try {
      if (window.electronAPI?.config) {
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

      setDbConnected(true);
      checkDatabaseStatus();
      attemptAutoAuth().catch(() => {
        setAuthError(t("configPage.authSkipped"));
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setDbError(message || t("configPage.connectionFailed"));
    } finally {
      setDbTesting(false);
    }
  };

  const attemptAutoAuth = async () => {
    setAuthenticating(true);
    setAuthError("");

    try {
      const client = getSupabaseClient();
      if (!client) {
        setAuthenticating(false);
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session) {
        setUser(
          sessionData.session.user as unknown as Parameters<typeof setUser>[0],
          sessionData.session.access_token,
          sessionData.session.refresh_token,
        );
        clearDraft();
        navigate("/");
        return;
      }

      const { data: anonData, error: anonError } =
        await client.auth.signInAnonymously();
      if (!anonError && anonData.session) {
        setUser(
          anonData.session.user as unknown as Parameters<typeof setUser>[0],
          anonData.session.access_token,
          anonData.session.refresh_token,
        );
        clearDraft();
        navigate("/");
        return;
      }

      setShowAuthForm(true);
    } catch (error) {
      logger.warn("Login step failed", {
        step: "anonymousAuth",
        error: error instanceof Error ? error.message : String(error),
      });
      setShowAuthForm(true);
    } finally {
      setAuthenticating(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!draft.email.trim() || !password.trim()) return;

    setAuthenticating(true);
    setAuthError("");

    try {
      const client = getSupabaseClient();
      if (!client) {
        setAuthError(t("configPage.noSupabaseClient"));
        return;
      }

      const { data, error } = await client.auth.signUp({
        email: draft.email,
        password,
      });

      if (error) {
        const { data: signInData, error: signInError } =
          await client.auth.signInWithPassword({
            email: draft.email,
            password,
          });
        if (signInError) {
          setAuthError(signInError.message);
          return;
        }
        if (signInData.session) {
          setUser(
            signInData.session.user as unknown as Parameters<typeof setUser>[0],
            signInData.session.access_token,
            signInData.session.refresh_token,
          );
          clearDraft();
          navigate("/");
        }
        return;
      }

      if (data.session) {
        setUser(
          data.session.user as unknown as Parameters<typeof setUser>[0],
          data.session.access_token,
          data.session.refresh_token,
        );
        clearDraft();
        navigate("/");
      } else {
        setAuthError(t("configPage.confirmEmail"));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthError(message);
    } finally {
      setAuthenticating(false);
    }
  };

  const handleInitializeDatabase = async () => {
    setDbInitializing(true);
    setMigrations([]);

    try {
      const response = (await apiClient.post("/database/migrate")) as {
        migrations?: Array<{ name: string; status: string; message?: string }>;
        results?: Array<{ name: string; status: string; message?: string }>;
      };

      const rawMigrations = response.migrations || response.results || [];
      const mapped: MigrationResult[] = rawMigrations.map((m) => ({
        name: m.name,
        status:
          m.status === "success" || m.status === "applied"
            ? "success"
            : m.status === "failed"
              ? "failed"
              : "success",
        message: m.message,
      }));

      setMigrations(mapped);

      const allSuccess = mapped.every((m) => m.status === "success");
      if (allSuccess && mapped.length > 0) {
        setDbStatus("ready");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setMigrations((prev) => [
        ...prev,
        { name: t("configPage.migrationError"), status: "failed", message },
      ]);
    } finally {
      setDbInitializing(false);
    }
  };

  const handleSaveAIConfig = async () => {
    if (!aiApiKey.trim()) {
      setAiTestResult("error");
      setAiTestMessage(t("configPage.apiKeyRequired"));
      return;
    }

    setAiSaving(true);
    try {
      const updateData: Record<
        string,
        { apiKey?: string; baseURL?: string; model?: string }
      > = {};
      updateData[aiProvider] = {
        apiKey: aiApiKey,
        baseURL: aiBaseURL,
        model: aiModel,
      };
      await apiClient.put("/ai/config/providers", { providers: updateData });
      setAiTestResult("success");
      setAiTestMessage(t("configPage.aiConfigSaved"));
      loadConfiguredProviders();
    } catch (error) {
      logger.warn("Login step failed", {
        step: "saveAIConfig",
        error: error instanceof Error ? error.message : String(error),
      });
      setAiTestResult("error");
      setAiTestMessage(t("configPage.aiConfigSaveFailed"));
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAIConfig = async () => {
    if (!aiApiKey.trim()) {
      setAiTestResult("error");
      setAiTestMessage(t("configPage.apiKeyRequired"));
      return;
    }

    setAiTesting(true);
    setAiTestResult(null);
    try {
      const response = (await apiClient.post("/ai/config/providers/test", {
        provider: aiProvider,
        apiKey: aiApiKey,
        baseURL: aiBaseURL,
        model: aiModel,
      })) as { success: boolean; message: string };
      if (response.success) {
        setAiTestResult("success");
        setAiTestMessage(t("configPage.aiTestSuccess"));
      } else {
        setAiTestResult("error");
        setAiTestMessage(response.message || t("configPage.aiTestFailed"));
      }
    } catch (error) {
      logger.warn("Login step failed", {
        step: "testAIConfig",
        error: error instanceof Error ? error.message : String(error),
      });
      setAiTestResult("error");
      setAiTestMessage(t("configPage.aiTestFailed"));
    } finally {
      setAiTesting(false);
    }
  };

  const handleVerifyPat = async () => {
    if (!pat.trim()) return;

    setPatVerifying(true);
    setPatError("");

    try {
      const response = (await apiClient.get(
        `/api/supabase/organizations?accessToken=${encodeURIComponent(pat)}`,
      )) as Array<{ id: string; name: string; slug: string }>;
      if (Array.isArray(response) && response.length > 0) {
        setOrganizations(response);
        setDraft((prev) => ({ ...prev, step: 2 }));
      } else {
        setPatError(t("quickSetup.patInvalid"));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPatError(message || t("quickSetup.patInvalid"));
    } finally {
      setPatVerifying(false);
    }
  };

  const loadRegions = useCallback(async () => {
    try {
      const response = (await apiClient.get(
        `/api/supabase/regions?accessToken=${encodeURIComponent(pat)}`,
      )) as Array<{ code: string; name: string; location: string }>;
      if (Array.isArray(response)) {
        setRegions(response);
      }
    } catch (error) {
      logger.warn("Login step failed", {
        step: "loadRegions",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [pat]);

  useEffect(() => {
    if (draft.step === 3 && regions.length === 0) {
      loadRegions();
    }
  }, [draft.step, regions.length, loadRegions]);

  const handleCreateProject = async () => {
    if (!selectedOrg || !dbPassword || !selectedRegion) return;

    setCreating(true);
    setCreateError("");
    setCreateProgress(0);

    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setCreateProgress(1), 0));
    timers.push(setTimeout(() => setCreateProgress(2), 5000));
    timers.push(setTimeout(() => setCreateProgress(3), 15000));

    try {
      const response = (await apiClient.post("/supabase/quick-setup", {
        accessToken: pat,
        organizationId: selectedOrg,
        projectName,
        databasePassword: dbPassword,
        region: selectedRegion,
      })) as {
        ref: string;
        url: string;
        anonKey?: string;
        serviceRoleKey?: string;
        databaseUrl?: string;
      };

      setCreatedProject({ ref: response.ref, url: response.url });

      if (response.url && response.anonKey) {
        setDbForm((prev) => ({
          ...prev,
          url: response.url ?? prev.url,
          anonKey: response.anonKey ?? prev.anonKey,
          serviceRoleKey: response.serviceRoleKey ?? prev.serviceRoleKey,
          databaseUrl: response.databaseUrl ?? prev.databaseUrl,
        }));

        if (window.electronAPI?.config) {
          await window.electronAPI.config.write({
            database: {
              url: response.url,
              anonKey: response.anonKey,
              serviceRoleKey: response.serviceRoleKey ?? "",
              databaseUrl: response.databaseUrl ?? "",
            },
          });
        }

        await apiClient.put("/ai/config/database", {
          url: response.url,
          anonKey: response.anonKey,
          serviceRoleKey: response.serviceRoleKey ?? "",
          databaseUrl: response.databaseUrl ?? "",
        });

        updateSupabaseConfig(response.url, response.anonKey);
        resetSupabaseClient();
      }

      setCreateProgress(4);
      timers.forEach(clearTimeout);

      setTimeout(() => {
        setDraft((prev) => ({ ...prev, step: 5 }));
        setCreating(false);
      }, 500);
    } catch (err: unknown) {
      timers.forEach(clearTimeout);
      const message = err instanceof Error ? err.message : String(err);
      setCreateError(message);
      setCreating(false);
    }
  };

  const handleQuickSetupComplete = async () => {
    setAuthenticating(true);
    setAuthError("");

    try {
      const client = getSupabaseClient();
      if (!client) {
        setShowAuthForm(true);
        setAuthenticating(false);
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session) {
        setUser(
          sessionData.session.user as unknown as Parameters<typeof setUser>[0],
          sessionData.session.access_token,
          sessionData.session.refresh_token,
        );
        clearDraft();
        navigate("/");
        return;
      }

      const { data: anonData, error: anonError } =
        await client.auth.signInAnonymously();
      if (!anonError && anonData.session) {
        setUser(
          anonData.session.user as unknown as Parameters<typeof setUser>[0],
          anonData.session.access_token,
          anonData.session.refresh_token,
        );
        clearDraft();
        navigate("/");
        return;
      }

      setShowAuthForm(true);
    } catch (error) {
      logger.warn("Login step failed", {
        step: "quickSetupComplete",
        error: error instanceof Error ? error.message : String(error),
      });
      setShowAuthForm(true);
    } finally {
      setAuthenticating(false);
    }
  };

  const renderPasswordField = (
    value: string,
    onChange: (val: string) => void,
    show: boolean,
    onToggle: () => void,
    placeholder: string,
    id: string,
    error?: string,
    errorId?: string,
  ) => {
    const hasError = Boolean(error);
    return (
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError && errorId ? errorId : undefined}
          className="w-full input-mobile pr-10 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono transition-all"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? t('common.aria.hidePassword') : t('common.aria.showPassword')}
          className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        {hasError && errorId && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    );
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {[1, 2, 3, 4, 5].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 ${
              step === draft.step
                ? "bg-primary-500 text-white scale-110 shadow-lg shadow-primary-500/30"
                : step < draft.step
                  ? "bg-primary-500/20 text-primary-600 dark:text-primary-400"
                  : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            {step < draft.step ? <Check className="w-3.5 h-3.5" /> : step}
          </div>
          {step < 5 && (
            <div
              className={`w-4 h-0.5 mx-0.5 transition-colors duration-300 ${
                step < draft.step
                  ? "bg-primary-500"
                  : "bg-gray-200 dark:bg-slate-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderQuickStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
          <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("quickSetup.step1Title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("quickSetup.step1Desc")}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          openExternal("https://supabase.com/dashboard/account/tokens")
        }
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        {t("quickSetup.getPat")}
      </button>

      <div>
        <label htmlFor="pat" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Personal Access Token
          <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
        </label>
        {renderPasswordField(
          pat,
          setPat,
          showPat,
          () => setShowPat(!showPat),
          t("quickSetup.patPlaceholder"),
          "pat",
          patError || undefined,
          patErrorId,
        )}
      </div>

      <button
        onClick={handleVerifyPat}
        disabled={patVerifying || !pat.trim()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {patVerifying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("quickSetup.verifying")}
          </>
        ) : (
          t("quickSetup.verify")
        )}
      </button>
    </div>
  );

  const renderQuickStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("quickSetup.step2Title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("quickSetup.step2Desc")}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {organizations.map((org) => (
          <label
            key={org.id}
            htmlFor={`org-${org.id}`}
            aria-label={org.name}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedOrg === org.id
                ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20"
                : "border-gray-200 dark:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700/50"
            }`}
          >
            <input
              id={`org-${org.id}`}
              type="radio"
              name="organization"
              value={org.id}
              checked={selectedOrg === org.id}
              onChange={() => setSelectedOrg(org.id)}
              className="text-primary-600 focus:ring-primary-500"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {org.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {org.slug}
              </p>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={() => setDraft((prev) => ({ ...prev, step: 3 }))}
        disabled={!selectedOrg}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  );

  const renderQuickStep3 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("quickSetup.step3Title")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("quickSetup.step3Desc")}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor={projectNameInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {t("quickSetup.projectName")}
          <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
        </label>
        <input
          id={projectNameInputId}
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
          className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
        />
      </div>

      <div>
        <label htmlFor={dbPasswordInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {t("quickSetup.dbPassword")}
          <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              id={dbPasswordInputId}
              type={showDbPassword ? "text" : "password"}
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              placeholder={t("quickSetup.dbPasswordPlaceholder")}
              required
              className="w-full input-mobile pr-10 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono transition-all"
            />
            <button
              type="button"
              onClick={() => setShowDbPassword(!showDbPassword)}
              aria-label={showDbPassword ? t('common.aria.hidePassword') : t('common.aria.showPassword')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showDbPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDbPassword(generatePassword())}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Lock className="w-4 h-4" />
            {t("quickSetup.generate")}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor={regionInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          {t("quickSetup.region")}
          <span aria-hidden="true" className="text-red-500 ml-0.5">*</span>
        </label>
        <div className="relative">
          <select
            id={regionInputId}
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            required
            className="w-full select-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none transition-all"
          >
            <option value="">{t("quickSetup.selectRegion")}</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} ({r.location})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <button
        onClick={handleCreateProject}
        disabled={
          creating ||
          !projectName.trim() ||
          !dbPassword.trim() ||
          !selectedRegion
        }
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("quickSetup.createAndConfigure")}
          </>
        ) : (
          t("quickSetup.createAndConfigure")
        )}
      </button>
    </div>
  );

  const renderQuickStep4 = () => {
    const steps = [
      { label: t("quickSetup.creatingProject"), progress: 1 },
      { label: t("quickSetup.waitingForProject"), progress: 2 },
      { label: t("quickSetup.gettingCredentials"), progress: 3 },
      { label: t("quickSetup.initializingDb"), progress: 4 },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
            <Loader2 className="w-5 h-5 text-cyan-600 dark:text-cyan-400 animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t("quickSetup.step4Title")}
          </h3>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {createProgress > step.progress - 1 ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
              ) : createProgress === step.progress - 1 ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary-100 dark:bg-primary-900/30">
                  <Loader2 className="w-4 h-4 text-primary-600 dark:text-primary-400 animate-spin" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />
              )}
              <span
                className={`text-sm ${
                  createProgress >= step.progress - 1
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {createError && (
          <div className="space-y-3">
            <div role="alert" className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <X className="w-4 h-4" />
              {createError}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCreateProject}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t("quickSetup.retry")}
              </button>
              <button
                onClick={() => setDraft((prev) => ({ ...prev, activeTab: "manual" }))}
                className="text-sm text-primary-600 dark:text-primary-400 underline"
              >
                {t("quickSetup.switchToManual")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderQuickStep5 = () => {
    const emailError = touched.email
      ? !draft.email.trim()
        ? t("configPage.validation.emailRequired")
        : !validateEmail(draft.email)
          ? t("configPage.validation.emailInvalid")
          : ""
      : "";
    const passwordError =
      touched.password && !validatePassword(password)
        ? t("configPage.validation.passwordRequired")
        : "";
    return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("quickSetup.step5Title")}
        </h3>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-slate-500 overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-500">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t("quickSetup.projectSummary")}
          </span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          <div className="px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("quickSetup.projectName")}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {projectName}
            </span>
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("quickSetup.supabaseUrl")}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono truncate max-w-[200px]">
              {createdProject?.url || dbForm.url || "—"}
            </span>
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("quickSetup.regionLabel")}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedRegion || "—"}
            </span>
          </div>
        </div>
      </div>

      {showAuthForm && (
        <div className="pt-3 border-t border-gray-100 dark:border-slate-500">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {t("configPage.signInRequired")}
          </p>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <input
              id={quickEmailInputId}
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, email: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              placeholder={t("configPage.email")}
              aria-label={t("configPage.email")}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? quickEmailErrorId : undefined}
              className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
            {emailError && (
              <p
                id={quickEmailErrorId}
                role="alert"
                className="mt-1 text-xs text-red-600 dark:text-red-400"
              >
                {emailError}
              </p>
            )}
            <input
              id={quickPasswordInputId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              placeholder={t("configPage.password")}
              aria-label={t("configPage.password")}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? quickPasswordErrorId : undefined}
              className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
            {passwordError && (
              <p
                id={quickPasswordErrorId}
                role="alert"
                className="mt-1 text-xs text-red-600 dark:text-red-400"
              >
                {passwordError}
              </p>
            )}
            {authError && (
              <p
                id={quickAuthErrorId}
                role="alert"
                className="text-xs text-red-500"
              >
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={authenticating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("configPage.signingIn")}
                </>
              ) : (
                t("configPage.signIn")
              )}
            </button>
          </form>
        </div>
      )}

      {authenticating && !showAuthForm && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("configPage.authenticating")}
        </div>
      )}

      {!showAuthForm && !authenticating && (
        <button
          onClick={handleQuickSetupComplete}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors"
        >
          {t("quickSetup.startUsing")}
        </button>
      )}
    </div>
    );
  };

  const renderQuickSetup = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-6 transition-colors">
      <h2 className="sr-only">{t("quickSetup.quickSetup")}</h2>
      {renderStepIndicator()}

      {draft.step === 1 && renderQuickStep1()}
      {draft.step === 2 && renderQuickStep2()}
      {draft.step === 3 && renderQuickStep3()}
      {draft.step === 4 && renderQuickStep4()}
      {draft.step === 5 && renderQuickStep5()}
    </div>
  );

  const renderSupabaseCard = () => {
    const emailError = touched.email
      ? !draft.email.trim()
        ? t("configPage.validation.emailRequired")
        : !validateEmail(draft.email)
          ? t("configPage.validation.emailInvalid")
          : ""
      : "";
    const passwordError =
      touched.password && !validatePassword(password)
        ? t("configPage.validation.passwordRequired")
        : "";
    return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-6 transition-colors">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Database className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("configPage.connectSupabase")}
        </h2>
        {dbConnected ? (
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <Check className="w-3 h-3" />
            {t("configPage.connected")}
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
            {t("configPage.notConnected")}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor={supabaseUrlInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.supabaseUrl")}
          </label>
          <input
            id={supabaseUrlInputId}
            type="text"
            value={dbForm.url}
            onChange={(e) =>
              setDbForm((prev) => ({ ...prev, url: e.target.value }))
            }
            placeholder="https://xxx.supabase.co"
            className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono transition-all"
          />
        </div>

        <div>
          <label htmlFor="anon-key" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.anonKey")}
          </label>
          {renderPasswordField(
            dbForm.anonKey,
            (val) => setDbForm((prev) => ({ ...prev, anonKey: val })),
            showAnonKey,
            () => setShowAnonKey(!showAnonKey),
            "eyJhbGciOi...",
            "anon-key",
          )}
        </div>

        <div>
          <label htmlFor="service-role-key" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.serviceRoleKey")}
          </label>
          {renderPasswordField(
            dbForm.serviceRoleKey,
            (val) => setDbForm((prev) => ({ ...prev, serviceRoleKey: val })),
            showServiceRoleKey,
            () => setShowServiceRoleKey(!showServiceRoleKey),
            "eyJhbGciOi...",
            "service-role-key",
          )}
        </div>

        <div>
          <label htmlFor={databaseUrlInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.databaseUrl")}
          </label>
          <input
            id={databaseUrlInputId}
            type="text"
            value={dbForm.databaseUrl}
            onChange={(e) =>
              setDbForm((prev) => ({ ...prev, databaseUrl: e.target.value }))
            }
            placeholder="postgresql://postgres:...@db.xxx.supabase.co:5432/postgres"
            className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono transition-all"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t("configPage.databaseUrlHelp")}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleTestConnection}
          disabled={dbTesting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dbTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("configPage.testing")}
            </>
          ) : (
            t("configPage.testConnection")
          )}
        </button>

        {dbError && (
          <div role="alert" className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
            <X className="w-4 h-4" />
            {dbError}
          </div>
        )}
      </div>

      {dbConnected &&
        dbStatus !== "ready" &&
        dbStatus !== "loading" &&
        dbStatus !== "unknown" && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-amber-600 dark:text-amber-400">
                {dbStatus === "empty"
                  ? t("configPage.schemaEmpty")
                  : t("configPage.schemaPartial")}
              </span>
            </div>
            <button
              onClick={handleInitializeDatabase}
              disabled={dbInitializing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dbInitializing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("configPage.initializing")}
                </>
              ) : (
                t("configPage.initializeDatabase")
              )}
            </button>
          </div>
        )}

      {dbConnected && dbStatus === "ready" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check className="w-4 h-4" />
          {t("configPage.schemaReady")}
        </div>
      )}

      {migrations.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-slate-500 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-500">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {t("configPage.migrationProgress")}
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
            {migrations.map((migration, index) => (
              <div key={index} className="px-3 py-2 flex items-center gap-2">
                {migration.status === "success" && (
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}
                {migration.status === "failed" && (
                  <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                )}
                {migration.status === "running" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500 shrink-0" />
                )}
                {migration.status === "pending" && (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                    {migration.name}
                  </p>
                  {migration.message && (
                    <p
                      className={`text-xs mt-0.5 ${migration.status === "failed" ? "text-red-500" : "text-gray-400"}`}
                    >
                      {migration.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAuthForm && (
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-500">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {t("configPage.signInRequired")}
          </p>
          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <input
              id={manualEmailInputId}
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, email: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              placeholder={t("configPage.email")}
              aria-label={t("configPage.email")}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? manualEmailErrorId : undefined}
              className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
            {emailError && (
              <p
                id={manualEmailErrorId}
                role="alert"
                className="mt-1 text-xs text-red-600 dark:text-red-400"
              >
                {emailError}
              </p>
            )}
            <input
              id={manualPasswordInputId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              placeholder={t("configPage.password")}
              aria-label={t("configPage.password")}
              aria-invalid={passwordError ? true : undefined}
              aria-describedby={passwordError ? manualPasswordErrorId : undefined}
              className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            />
            {passwordError && (
              <p
                id={manualPasswordErrorId}
                role="alert"
                className="mt-1 text-xs text-red-600 dark:text-red-400"
              >
                {passwordError}
              </p>
            )}
            {authError && (
              <p
                id={manualAuthErrorId}
                role="alert"
                className="text-xs text-red-500"
              >
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={authenticating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {authenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("configPage.signingIn")}
                </>
              ) : (
                t("configPage.signIn")
              )}
            </button>
          </form>
        </div>
      )}

      {dbConnected && authenticating && !showAuthForm && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("configPage.authenticating")}
        </div>
      )}
    </div>
    );
  };

  const renderAICard = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-6 transition-colors">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t("configPage.configureAI")}
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor={providerInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.provider")}
          </label>
          <div className="relative">
            <select
              id={providerInputId}
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AIProviderType)}
              className="w-full select-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none transition-all"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <label htmlFor="ai-api-key" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.apiKey")}
          </label>
          {renderPasswordField(
            aiApiKey,
            setAiApiKey,
            showAiApiKey,
            () => setShowAiApiKey(!showAiApiKey),
            t("configPage.apiKeyPlaceholder"),
            "ai-api-key",
          )}
        </div>

        <div>
          <label htmlFor={baseUrlInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.baseUrl")}
          </label>
          <input
            id={baseUrlInputId}
            type="text"
            value={aiBaseURL}
            onChange={(e) => setAiBaseURL(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono transition-all"
          />
        </div>

        <div>
          <label htmlFor={modelInputId} className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("configPage.model")}
          </label>
          <input
            id={modelInputId}
            type="text"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="model-name"
            className="w-full input-mobile rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono transition-all"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSaveAIConfig}
          disabled={aiSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("configPage.saving")}
            </>
          ) : (
            t("configPage.save")
          )}
        </button>
        <button
          onClick={handleTestAIConfig}
          disabled={aiTesting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("configPage.testing")}
            </>
          ) : (
            t("configPage.test")
          )}
        </button>
        {aiTestResult && (
          <div
            className={`flex items-center gap-1.5 text-sm ${aiTestResult === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {aiTestResult === "success" ? (
              <Check className="w-4 h-4" />
            ) : (
              <X className="w-4 h-4" />
            )}
            {aiTestMessage}
          </div>
        )}
      </div>

      {configuredProviders.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-500">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            {t("configPage.configuredProviders")}
          </p>
          <div className="flex flex-wrap gap-2">
            {configuredProviders.map((p) => (
              <span
                key={p.provider}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              >
                <Check className="w-3 h-3" />
                {p.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <main
      id="public-main"
      ref={mainRef}
      tabIndex={-1}
      className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col focus:outline-none"
    >
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-4xl">
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-6">
            KnowledgeMap
          </h1>

          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 p-1" role="tablist" aria-label={t("quickSetup.quickSetup")}>
              {loginTabs.map((tab, index) => {
                const isActive = draft.activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[index] = el; }}
                    role="tab"
                    id={`${tabIdPrefix}-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`${panelIdPrefix}-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setDraft((prev) => ({ ...prev, activeTab: tab.id }))}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    {tab.id === "quick" ? <Zap className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {draft.activeTab === "quick" && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-quick`}
              aria-labelledby={`${tabIdPrefix}-quick`}
              tabIndex={0}
            >
              {renderQuickSetup()}
              <div className="mt-6">{renderAICard()}</div>
            </div>
          )}

          {draft.activeTab === "manual" && (
            <div
              role="tabpanel"
              id={`${panelIdPrefix}-manual`}
              aria-labelledby={`${tabIdPrefix}-manual`}
              tabIndex={0}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {renderSupabaseCard()}
              {renderAICard()}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-300"
        title={
          isDark
            ? t("configPage.switchToLightMode")
            : t("configPage.switchToDarkMode")
        }
        aria-label={isDark ? t('register.switchToLight') : t('register.switchToDark')}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <ConfirmationModal
        isOpen={showRestorePrompt}
        onClose={onDiscard}
        onConfirm={onRestore}
        title={t("common.restoreDraftTitle")}
        message={t("common.restoreDraftMessage")}
        confirmText={t("common.restore")}
        cancelText={t("common.discard")}
      />
    </main>
  );
};
