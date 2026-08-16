import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { studyApi } from "../../services/api/study";
import {
  Cpu,
  Loader2,
  Zap,
  RefreshCw,
  CheckCircle2,
  Info,
} from "lucide-react";
import type { FsrsParams, FsrsOptimizeResult } from "./settingsConstants";
import { formatDate } from "../../utils/formatters";

export const StudyAlgorithmSettings = React.memo(function StudyAlgorithmSettings() {
  const { t } = useTranslation();
  const [fsrsParams, setFsrsParams] = useState<FsrsParams | null>(null);
  const [fsrsLoading, setFsrsLoading] = useState(false);
  const [fsrsOptimizing, setFsrsOptimizing] = useState(false);
  const [fsrsOptimizeResult, setFsrsOptimizeResult] = useState<FsrsOptimizeResult | null>(null);

  const loadFsrsParameters = useCallback(async () => {
    setFsrsLoading(true);
    try {
      const data = await studyApi.getFsrsParameters();
      setFsrsParams(data as FsrsParams);
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
      setFsrsOptimizeResult(result as FsrsOptimizeResult);
      if ((result as { success?: boolean }).success) {
        await loadFsrsParameters();
      }
    } catch {
      setFsrsOptimizeResult({ success: false, improvement: 0, reviewCount: 0, message: t("settings.studyAlgorithm.optimizeFailed") });
    } finally {
      setFsrsOptimizing(false);
    }
  }, [loadFsrsParameters, t]);

  const handleResetFsrs = useCallback(async () => {
    try {
      await studyApi.resetFsrsParameters();
      await loadFsrsParameters();
      setFsrsOptimizeResult(null);
    } catch {
      // 静默处理
    }
  }, [loadFsrsParameters]);

  useEffect(() => {
    loadFsrsParameters();
  }, [loadFsrsParameters]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.studyAlgorithm.title")}
          </h2>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t("settings.studyAlgorithm.paramSource")}
            </span>
            <span className={`text-sm font-bold ${
              fsrsParams?.source === "default" ? "text-gray-500 dark:text-gray-400" :
              fsrsParams?.source === "optimized" ? "text-green-600 dark:text-green-400" :
              "text-primary-600 dark:text-primary-400"
            }`}>
              {fsrsLoading ? t("settings.loading") :
               fsrsParams?.source === "default" ? t("settings.studyAlgorithm.sourceDefault") :
               fsrsParams?.source === "optimized" ? t("settings.studyAlgorithm.sourceOptimized") :
               fsrsParams?.source === "custom" ? t("settings.studyAlgorithm.sourceCustom") : t("settings.loading")}
            </span>
          </div>
          {fsrsParams?.last_optimized_at && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("settings.studyAlgorithm.lastOptimized")}: {formatDate(fsrsParams.last_optimized_at, 'short-datetime')}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t("settings.studyAlgorithm.description")}
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
                {t("settings.studyAlgorithm.optimizing")}
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                {t("settings.studyAlgorithm.optimize")}
              </>
            )}
          </button>

          <button
            onClick={handleResetFsrs}
            className="flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t("settings.studyAlgorithm.resetToDefault")}
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
                {t("settings.studyAlgorithm.basedOnReviews", { count: fsrsOptimizeResult.reviewCount })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
