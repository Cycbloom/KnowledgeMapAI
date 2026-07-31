import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import {
  getServiceWorkerStatus,
  unregisterServiceWorker,
  type ServiceWorkerStatus,
} from "@/utils/serviceWorker";
import { Button } from "@/components/common/Button";

interface StorageEstimateData {
  usage: number;
  quota: number;
}

const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "unknown";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[i] ?? "B"}`;
}

function getStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

interface DiagRowProps {
  label: string;
  children: ReactNode;
}

function DiagRow({ label, children }: DiagRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-gray-800 dark:text-gray-200 font-mono text-xs text-right">
        {children}
      </span>
    </div>
  );
}

/**
 * PWA 诊断面板
 *
 * 折叠面板，展开后显示 SW 注册状态、应用版本、standalone 模式、
 * 可安装/已安装状态以及 IndexedDB 缓存占用，并提供"清除缓存并重新加载"按钮。
 *
 * 仅在浏览器端有意义；Electron 端调用时相关 API 会返回安全默认值。
 */
export function PwaDiagnostics() {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus | null>(null);
  const [storageEstimate, setStorageEstimate] =
    useState<StorageEstimateData | null>(null);
  const [clearing, setClearing] = useState(false);
  const { canInstall, installed } = usePwaInstall();
  const { t } = useTranslation();

  const renderBool = (value: boolean): string =>
    value
      ? t("pwaDiagnostics.diagnostics.boolYes")
      : t("pwaDiagnostics.diagnostics.boolNo");

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;

    async function loadDiagnostics() {
      const status = await getServiceWorkerStatus();
      if (cancelled) return;
      setSwStatus(status);
      if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (cancelled) return;
          setStorageEstimate({
            usage: estimate.usage ?? 0,
            quota: estimate.quota ?? 0,
          });
        } catch (error) {
          if (!cancelled) {
            console.error("[PwaDiagnostics] storage.estimate failed:", error);
          }
        }
      }
    }

    void loadDiagnostics();

    return () => {
      cancelled = true;
    };
  }, [expanded]);

  async function handleClearCache() {
    if (typeof window === "undefined") return;
    if (!window.confirm(t("pwaDiagnostics.diagnostics.clearCacheConfirm"))) {
      return;
    }
    setClearing(true);
    try {
      await unregisterServiceWorker();
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      window.location.reload();
    } finally {
      setClearing(false);
    }
  }

  const standaloneMode = getStandaloneMode();

  return (
    <div className="border border-gray-200 dark:border-slate-500 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        aria-expanded={expanded}
        aria-controls={contentId}
        data-testid="pwa-diagnostics-toggle"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {t("pwaDiagnostics.diagnostics.title")}
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {expanded && (
        <div id={contentId} className="px-4 py-3 space-y-2 text-sm">
          <DiagRow label={t("pwaDiagnostics.diagnostics.swRegistrationLabel")}>
            {swStatus ? (
              <span>
                {t("pwaDiagnostics.diagnostics.swRegistered")}{" "}
                {swStatus.registered ? "✓" : "✗"} ·{" "}
                {t("pwaDiagnostics.diagnostics.swActive")}{" "}
                {swStatus.active ? "✓" : "✗"} ·{" "}
                {t("pwaDiagnostics.diagnostics.swWaiting")}{" "}
                {swStatus.waiting ? "✓" : "✗"} ·{" "}
                {t("pwaDiagnostics.diagnostics.swController")}{" "}
                {swStatus.controller ? "✓" : "✗"}
              </span>
            ) : (
              <span>{t("pwaDiagnostics.diagnostics.loading")}</span>
            )}
          </DiagRow>

          <DiagRow label={t("pwaDiagnostics.diagnostics.swVersionLabel")}>{APP_VERSION}</DiagRow>

          <DiagRow label={t("pwaDiagnostics.diagnostics.standaloneLabel")}>
            {renderBool(standaloneMode)}
          </DiagRow>

          <DiagRow label={t("pwaDiagnostics.diagnostics.installableLabel")}>{renderBool(canInstall)}</DiagRow>

          <DiagRow label={t("pwaDiagnostics.diagnostics.installedLabel")}>{renderBool(installed)}</DiagRow>

          <DiagRow label={t("pwaDiagnostics.diagnostics.cacheSizeLabel")}>
            {storageEstimate ? (
              <span>
                {t("pwaDiagnostics.diagnostics.cacheUsed")}{" "}
                {formatBytes(storageEstimate.usage)} /{" "}
                {t("pwaDiagnostics.diagnostics.cacheQuota")}{" "}
                {formatBytes(storageEstimate.quota)}
              </span>
            ) : (
              <span>{t("pwaDiagnostics.diagnostics.loading")}</span>
            )}
          </DiagRow>

          <div className="pt-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={clearing}
              onClick={handleClearCache}
              data-testid="pwa-clear-cache-button"
            >
              {clearing
                ? t("pwaDiagnostics.diagnostics.clearing")
                : t("pwaDiagnostics.diagnostics.clearCacheAndReload")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
