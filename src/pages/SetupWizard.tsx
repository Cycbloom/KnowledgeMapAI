import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Brain,
  Database,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Server,
  KeyRound,
} from "lucide-react";
import { apiClient } from "../services/api/createApiClient";
import { updateSupabaseConfig } from "../config/authConfig";
import { resetSupabaseClient } from "../lib/supabase";
import { isElectron } from "../config/electronConfig";
import type { AIProviderType } from "@shared/types/ai";

interface MigrationResult {
  name: string;
  status: "success" | "failed" | "running" | "pending";
  message?: string;
}

const AI_PROVIDERS: { value: AIProviderType; label: string; defaultBaseURL: string; defaultModel: string }[] = [
  { value: "deepseek", label: "DeepSeek", defaultBaseURL: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  { value: "volcengine", label: "Volcengine", defaultBaseURL: "https://ark.cn-beijing.volces.com/api/v3", defaultModel: "doubao-pro-32k" },
  { value: "aliyun", label: "Aliyun", defaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-turbo" },
  { value: "openai", label: "OpenAI", defaultBaseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  { value: "zhipu", label: "Zhipu", defaultBaseURL: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4-flash" },
  { value: "moonshot", label: "Moonshot", defaultBaseURL: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k" },
];

const TOTAL_STEPS = 7;

export const SetupWizard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState(1);
  const [dbForm, setDbForm] = useState({
    url: "",
    anonKey: "",
    serviceRoleKey: "",
    databaseUrl: "",
  });
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceRoleKey, setShowServiceRoleKey] = useState(false);
  const [dbTesting, setDbTesting] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<"success" | "error" | null>(null);
  const [dbTestMessage, setDbTestMessage] = useState("");

  const [dbStatus, setDbStatus] = useState<"empty" | "partial" | "ready" | "unknown" | "loading">("loading");
  const [dbInitializing, setDbInitializing] = useState(false);
  const [migrations, setMigrations] = useState<MigrationResult[]>([]);

  const [aiProvider, setAiProvider] = useState<AIProviderType>("deepseek");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiBaseURL, setAiBaseURL] = useState("https://api.deepseek.com/v1");
  const [aiModel, setAiModel] = useState("deepseek-chat");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<"success" | "error" | null>(null);
  const [aiTestMessage, setAiTestMessage] = useState("");
  const [aiSaved, setAiSaved] = useState(false);

  useEffect(() => {
    if (currentStep === 5) {
      checkDatabaseStatus();
    }
  }, [currentStep]);

  useEffect(() => {
    const provider = AI_PROVIDERS.find((p) => p.value === aiProvider);
    if (provider) {
      setAiBaseURL(provider.defaultBaseURL);
      setAiModel(provider.defaultModel);
    }
  }, [aiProvider]);

  const checkDatabaseStatus = async () => {
    setDbStatus("loading");
    try {
      const response = await apiClient.get("/database/status") as { status: string };
      setDbStatus(response.status as "empty" | "partial" | "ready");
    } catch {
      setDbStatus("unknown");
    }
  };

  const handleTestConnection = async () => {
    if (!dbForm.url.trim() || !dbForm.anonKey.trim()) {
      setDbTestResult("error");
      setDbTestMessage(t("setup.dbUrlAndAnonKeyRequired"));
      return;
    }

    setDbTesting(true);
    setDbTestResult(null);
    setDbTestMessage("");

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

      setDbTestResult("success");
      setDbTestMessage(t("setup.dbConnectionSuccess"));
    } catch (err: unknown) {
      setDbTestResult("error");
      const message = err instanceof Error ? err.message : String(err);
      setDbTestMessage(message || t("setup.dbConnectionFailed"));
    } finally {
      setDbTesting(false);
    }
  };

  const handleInitializeDatabase = async () => {
    setDbInitializing(true);
    setMigrations([]);

    try {
      const response = await apiClient.post("/database/migrate") as {
        migrations?: Array<{ name: string; status: string; message?: string }>;
        results?: Array<{ name: string; status: string; message?: string }>;
      };

      const rawMigrations = response.migrations || response.results || [];
      const mapped: MigrationResult[] = rawMigrations.map((m) => ({
        name: m.name,
        status: m.status === "success" || m.status === "applied" ? "success" : m.status === "failed" ? "failed" : "success",
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
        { name: t("setup.migrationError"), status: "failed", message },
      ]);
    } finally {
      setDbInitializing(false);
    }
  };

  const handleSaveAIConfig = async () => {
    if (!aiApiKey.trim()) {
      setAiTestResult("error");
      setAiTestMessage(t("setup.aiApiKeyRequired"));
      return;
    }

    setAiSaving(true);
    try {
      const updateData: Record<string, { apiKey?: string; baseURL?: string; model?: string }> = {};
      updateData[aiProvider] = {
        apiKey: aiApiKey,
        baseURL: aiBaseURL,
        model: aiModel,
      };
      await apiClient.put("/ai/config/providers", { providers: updateData });
      setAiSaved(true);
      setAiTestResult("success");
      setAiTestMessage(t("setup.aiConfigSaved"));
    } catch {
      setAiTestResult("error");
      setAiTestMessage(t("setup.aiConfigSaveFailed"));
    } finally {
      setAiSaving(false);
    }
  };

  const handleTestAIConfig = async () => {
    if (!aiApiKey.trim()) {
      setAiTestResult("error");
      setAiTestMessage(t("setup.aiApiKeyRequired"));
      return;
    }

    setAiTesting(true);
    setAiTestResult(null);
    try {
      const response = await apiClient.post("/ai/config/providers/test", {
        provider: aiProvider,
        apiKey: aiApiKey,
        baseURL: aiBaseURL,
        model: aiModel,
      }) as { success: boolean; message: string };
      if (response.success) {
        setAiTestResult("success");
        setAiTestMessage(t("setup.aiTestSuccess"));
      } else {
        setAiTestResult("error");
        setAiTestMessage(response.message || t("setup.aiTestFailed"));
      }
    } catch {
      setAiTestResult("error");
      setAiTestMessage(t("setup.aiTestFailed"));
    } finally {
      setAiTesting(false);
    }
  };

  const openExternal = (url: string) => {
    if (isElectron() && window.electronAPI?.shell) {
      window.electronAPI.shell.openExternal(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return dbTestResult === "success";
      case 5:
        return dbStatus === "ready";
      case 6:
        return true;
      case 7:
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < TOTAL_STEPS && canGoNext()) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    navigate("/");
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
              step === currentStep
                ? "bg-primary-500 text-white scale-110 shadow-lg shadow-primary-500/30"
                : step < currentStep
                  ? "bg-primary-500/20 text-primary-600 dark:text-primary-400"
                  : "bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400"
            }`}
          >
            {step < currentStep ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              step
            )}
          </div>
          {step < TOTAL_STEPS && (
            <div
              className={`w-6 h-0.5 mx-1 transition-colors duration-300 ${
                step < currentStep
                  ? "bg-primary-500"
                  : "bg-gray-200 dark:bg-slate-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
          <Brain className="w-10 h-10 text-white" />
        </div>
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {t("setup.welcomeTitle")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">
          {t("setup.welcomeDescription")}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50">
          <Database className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
            {t("setup.featureDatabase")}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/50">
          <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-purple-900 dark:text-purple-200">
            {t("setup.featureAI")}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/50">
          <Brain className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-900 dark:text-green-200">
            {t("setup.featureKnowledge")}
          </p>
        </div>
      </div>
    </div>
  );

  const renderSupabaseRegistration = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <Server className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("setup.createSupabaseAccount")}
        </h2>
      </div>
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {t("setup.supabaseAccountExplanation")}
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
          <li>{t("setup.supabaseBenefit1")}</li>
          <li>{t("setup.supabaseBenefit2")}</li>
          <li>{t("setup.supabaseBenefit3")}</li>
        </ul>
      </div>
      <button
        onClick={() => openExternal("https://supabase.com/dashboard/sign-in")}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors min-h-[44px]"
      >
        <ExternalLink className="w-5 h-5" />
        {t("setup.openSupabaseSignUp")}
      </button>
    </div>
  );

  const renderCreateProject = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <Database className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("setup.createSupabaseProject")}
        </h2>
      </div>
      <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("setup.createProjectInstructions")}
        </p>
        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-3 list-decimal list-inside">
          <li>{t("setup.createProjectStep1")}</li>
          <li>{t("setup.createProjectStep2")}</li>
          <li>{t("setup.createProjectStep3")}</li>
          <li>{t("setup.createProjectStep4")}</li>
          <li>{t("setup.createProjectStep5")}</li>
        </ol>
      </div>
      <button
        onClick={() => openExternal("https://supabase.com/dashboard")}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors min-h-[44px]"
      >
        <ExternalLink className="w-5 h-5" />
        {t("setup.openSupabaseDashboard")}
      </button>
    </div>
  );

  const renderEnterCredentials = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
          <KeyRound className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("setup.connectSupabase")}
        </h2>
      </div>
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {t("setup.credentialsInstructions")}
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("setup.supabaseUrl")}
          </label>
          <input
            type="text"
            value={dbForm.url}
            onChange={(e) => setDbForm((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://xxx.supabase.co"
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("setup.anonKey")}
          </label>
          <div className="relative">
            <input
              type={showAnonKey ? "text" : "password"}
              value={dbForm.anonKey}
              onChange={(e) => setDbForm((prev) => ({ ...prev, anonKey: e.target.value }))}
              placeholder="eyJhbGciOi..."
              className="w-full p-3 pr-16 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] font-mono"
            />
            <button
              type="button"
              onClick={() => setShowAnonKey(!showAnonKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("setup.serviceRoleKey")}
          </label>
          <div className="relative">
            <input
              type={showServiceRoleKey ? "text" : "password"}
              value={dbForm.serviceRoleKey}
              onChange={(e) => setDbForm((prev) => ({ ...prev, serviceRoleKey: e.target.value }))}
              placeholder="eyJhbGciOi..."
              className="w-full p-3 pr-16 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] font-mono"
            />
            <button
              type="button"
              onClick={() => setShowServiceRoleKey(!showServiceRoleKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showServiceRoleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
              {t("setup.databaseUrl")}
            </label>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 text-xs text-white dark:text-gray-900 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                {t("setup.databaseUrlTooltip")}
              </div>
            </div>
          </div>
          <input
            type="text"
            value={dbForm.databaseUrl}
            onChange={(e) => setDbForm((prev) => ({ ...prev, databaseUrl: e.target.value }))}
            placeholder="postgresql://postgres:...@db.xxx.supabase.co:5432/postgres"
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] font-mono"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleTestConnection}
          disabled={dbTesting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {dbTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("setup.testing")}
            </>
          ) : (
            t("setup.testConnection")
          )}
        </button>
        {dbTestResult && (
          <div className={`flex items-center gap-1.5 text-sm ${dbTestResult === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {dbTestResult === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {dbTestMessage}
          </div>
        )}
      </div>
    </div>
  );

  const renderInitializeDatabase = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
          <Database className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("setup.initializeDatabase")}
        </h2>
      </div>

      {dbStatus === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("setup.checkingDatabaseStatus")}
        </div>
      )}

      {dbStatus === "ready" && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {t("setup.databaseReady")}
            </span>
          </div>
        </div>
      )}

      {(dbStatus === "empty" || dbStatus === "partial" || dbStatus === "unknown") && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {dbStatus === "empty"
                ? t("setup.databaseEmpty")
                : dbStatus === "partial"
                  ? t("setup.databasePartial")
                  : t("setup.databaseUnknown")}
            </p>
          </div>
          <button
            onClick={handleInitializeDatabase}
            disabled={dbInitializing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {dbInitializing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("setup.initializing")}
              </>
            ) : (
              t("setup.initializeDatabaseButton")
            )}
          </button>
        </div>
      )}

      {migrations.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-slate-500 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-500">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("setup.migrationProgress")}
            </h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-64 overflow-y-auto">
            {migrations.map((migration, index) => (
              <div key={index} className="px-4 py-2.5 flex items-center gap-3">
                {migration.status === "success" && (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                )}
                {migration.status === "failed" && (
                  <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                {migration.status === "running" && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary-500 shrink-0" />
                )}
                {migration.status === "pending" && (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {migration.name}
                  </p>
                  {migration.message && (
                    <p className={`text-xs mt-0.5 ${migration.status === "failed" ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}>
                      {migration.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderAIConfiguration = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t("setup.configureAI")}
        </h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t("setup.configureAIDescription")}
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("setup.aiProvider")}
          </label>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as AIProviderType)}
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            API Key
          </label>
          <input
            type="password"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder={t("setup.aiApiKeyPlaceholder")}
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Base URL
          </label>
          <input
            type="text"
            value={aiBaseURL}
            onChange={(e) => setAiBaseURL(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t("setup.aiModel")}
          </label>
          <input
            type="text"
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            placeholder="model-name"
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px] font-mono"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSaveAIConfig}
          disabled={aiSaving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {aiSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("setup.saving")}
            </>
          ) : (
            t("setup.saveAIConfig")
          )}
        </button>
        <button
          onClick={handleTestAIConfig}
          disabled={aiTesting || !aiSaved}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
        >
          {aiTesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("setup.testing")}
            </>
          ) : (
            t("setup.testAIConfig")
          )}
        </button>
        {aiTestResult && (
          <div className={`flex items-center gap-1.5 text-sm ${aiTestResult === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {aiTestResult === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {aiTestMessage}
          </div>
        )}
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {t("setup.complete")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          {t("setup.completeDescription")}
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-slate-500 overflow-hidden max-w-sm mx-auto">
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          <div className="px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("setup.completeDatabase")}
            </span>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            {aiSaved ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("setup.completeAI")}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={handleFinish}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors shadow-lg shadow-primary-500/30 min-h-[44px]"
      >
        {t("setup.startUsing")}
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderWelcome();
      case 2:
        return renderSupabaseRegistration();
      case 3:
        return renderCreateProject();
      case 4:
        return renderEnterCredentials();
      case 5:
        return renderInitializeDatabase();
      case 6:
        return renderAIConfiguration();
      case 7:
        return renderComplete();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          {renderStepIndicator()}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-6 md:p-8 transition-colors">
            <div className="min-h-[400px] flex flex-col">
              <div className="flex-1">{renderStepContent()}</div>

              {currentStep !== 7 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-slate-500">
                  <button
                    onClick={goPrev}
                    disabled={currentStep === 1}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t("setup.previous")}
                  </button>

                  <div className="flex items-center gap-3">
                    {currentStep === 6 && (
                      <button
                        onClick={goNext}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
                      >
                        {t("setup.skip")}
                      </button>
                    )}
                    {currentStep === 1 ? (
                      <button
                        onClick={goNext}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors min-h-[44px]"
                      >
                        {t("setup.getStarted")}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={goNext}
                        disabled={!canGoNext()}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        {t("setup.next")}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
            {t("setup.stepOf", { current: currentStep, total: TOTAL_STEPS })}
          </p>
        </div>
      </div>
    </div>
  );
};
