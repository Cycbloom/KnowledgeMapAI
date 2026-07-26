import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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

function renderBool(value: boolean): string {
  return value ? "是 ✓" : "否 ✗";
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
    if (
      !window.confirm(
        "确定要清除所有缓存并重新加载吗？这将注销 Service Worker 并删除所有缓存。",
      )
    ) {
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
          PWA 诊断
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {expanded && (
        <div id={contentId} className="px-4 py-3 space-y-2 text-sm">
          <DiagRow label="SW 注册状态">
            {swStatus ? (
              <span>
                已注册 {swStatus.registered ? "✓" : "✗"} · 活动{" "}
                {swStatus.active ? "✓" : "✗"} · 等待{" "}
                {swStatus.waiting ? "✓" : "✗"} · 控制器{" "}
                {swStatus.controller ? "✓" : "✗"}
              </span>
            ) : (
              <span>加载中...</span>
            )}
          </DiagRow>

          <DiagRow label="SW 当前版本">{APP_VERSION}</DiagRow>

          <DiagRow label="Standalone 模式">
            {renderBool(standaloneMode)}
          </DiagRow>

          <DiagRow label="可安装状态">{renderBool(canInstall)}</DiagRow>

          <DiagRow label="已安装状态">{renderBool(installed)}</DiagRow>

          <DiagRow label="缓存大小">
            {storageEstimate ? (
              <span>
                已用 {formatBytes(storageEstimate.usage)} / 配额{" "}
                {formatBytes(storageEstimate.quota)}
              </span>
            ) : (
              <span>加载中...</span>
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
              {clearing ? "清除中..." : "清除缓存并重新加载"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
