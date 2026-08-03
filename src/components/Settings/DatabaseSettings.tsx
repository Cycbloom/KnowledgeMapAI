import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../services/api/createApiClient";
import { message } from "../../utils/messageHelper";
import { isElectron } from "../../config/electronConfig";
import { updateSupabaseConfig } from "../../config/authConfig";
import { resetSupabaseClient } from "../../utils/supabase";
import { useStore } from "../../store/useStore";
import {
  Database,
  Save,
  Loader2,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { DatabaseConfig } from "./settingsConstants";

interface DatabaseSettingsProps {
  onConfigChange: (config: DatabaseConfig) => void;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}

export const DatabaseSettings = React.memo(function DatabaseSettings({
  onConfigChange,
  sectionRef,
}: DatabaseSettingsProps) {
  const { t } = useTranslation();
  const token = useStore((state) => state.token);

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

  const fetchDatabaseConfig = async () => {
    setDbLoading(true);
    try {
      const response = (await apiClient.get(
        "/ai/config/database",
      )) as DatabaseConfig;
      setDatabaseConfig(response);
      onConfigChange(response);
    } catch {
      const fallback: DatabaseConfig = {
        configured: false,
        url: "",
        mode: "cloud",
        connected: false,
      };
      setDatabaseConfig(fallback);
      onConfigChange(fallback);
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

  useEffect(() => {
    if (!token) return;
    fetchDatabaseConfig();
    fetchSchemaStatus();
  }, [token]);

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

  return (
    <div
      ref={(el) => { (sectionRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors"
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

      <div className="rounded-lg border border-gray-100 dark:border-slate-500 overflow-hidden">
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
          <div className="p-4 pt-0 space-y-3 border-t border-gray-100 dark:border-slate-500">
            <div>
              <label htmlFor="db-supabase-url" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Supabase URL
              </label>
              <input
                id="db-supabase-url"
                type="text"
                autoComplete="off"
                value={dbForm.url}
                onChange={(e) =>
                  setDbForm((prev) => ({ ...prev, url: e.target.value }))
                }
                placeholder="https://xxx.supabase.co"
                className="w-full input-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label htmlFor="db-anon-key" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Anon Key
              </label>
              <div className="relative">
                <input
                  id="db-anon-key"
                  type={showDbAnonKey ? "text" : "password"}
                  autoComplete="off"
                  value={dbForm.anonKey}
                  onChange={(e) =>
                    setDbForm((prev) => ({
                      ...prev,
                      anonKey: e.target.value,
                    }))
                  }
                  placeholder="eyJhbGciOi..."
                  className="w-full input-mobile pr-20 rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
              <label htmlFor="db-service-role-key" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Service Role Key
              </label>
              <div className="relative">
                <input
                  id="db-service-role-key"
                  type={showDbServiceRoleKey ? "text" : "password"}
                  autoComplete="off"
                  value={dbForm.serviceRoleKey}
                  onChange={(e) =>
                    setDbForm((prev) => ({
                      ...prev,
                      serviceRoleKey: e.target.value,
                    }))
                  }
                  placeholder="eyJhbGciOi..."
                  className="w-full input-mobile pr-20 rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
                autoComplete="off"
                value={dbForm.databaseUrl}
                onChange={(e) =>
                  setDbForm((prev) => ({
                    ...prev,
                    databaseUrl: e.target.value,
                  }))
                }
                placeholder={t("settings.databaseUrlPlaceholder")}
                className="w-full input-mobile rounded border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 text-sm dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
  );
});
