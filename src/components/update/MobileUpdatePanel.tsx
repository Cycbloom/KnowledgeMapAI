import { useEffect, useCallback, useState } from "react";
import { RefreshCw, Download, CheckCircle2, Loader2 } from "lucide-react";
import {
  checkForUpdate,
  downloadAndInstall,
  type UpdateCheckResult,
} from "@/services/update/updateService";
import { message } from "@/utils/messageHelper";

/**
 * 移动端「检查更新」面板（设置页内）。
 * 挂载即自动检查一次；发现新版可一键下载并拉起系统安装器。
 * 仅移动端（Capacitor）渲染，由调用方用 isCapacitorMobile() 控制。
 */
export function MobileUpdatePanel() {
  const [state, setState] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const runCheck = useCallback(async (notify = false) => {
    setChecking(true);
    try {
      const result = await checkForUpdate();
      setState(result);
      // 进入设置页自动检查时不打扰；仅在用户主动点「检查更新」时提示
      if (!notify) return;
      if (result.hasUpdate && result.latest) {
        message.info(`发现新版本 v${result.latest.versionName}`);
      } else if (result.latest) {
        message.success("已是最新版本");
      }
    } finally {
      setChecking(false);
    }
  }, []);

  // 进入设置页时静默刷新，不在消息栏弹提示
  useEffect(() => {
    void runCheck(false);
  }, [runCheck]);

  const handleDownload = async () => {
    const url = state?.latest?.url;
    if (!url || downloading) return;
    setDownloading(true);
    try {
      await downloadAndInstall(url);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloading(false);
    }
  };

  const current = state?.current;
  const latest = state?.latest;

  return (
    <section
      id="update"
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors"
    >
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">检查更新</h2>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50">
          <span className="text-sm text-gray-600 dark:text-gray-300">当前版本</span>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {current ? `${current.versionName} (${current.versionCode})` : "—"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void runCheck(true)}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            检查更新
          </button>

          {state?.hasUpdate && latest && (
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              下载并更新 v{latest.versionName}
            </button>
          )}
        </div>

        {state && !state.hasUpdate && latest && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            已是最新版本
          </div>
        )}
      </div>
    </section>
  );
}