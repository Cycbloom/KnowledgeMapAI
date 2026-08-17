import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { RefreshCw } from "lucide-react";
import { cn } from "@/utils/utils";
import { useDataFreshness } from "../../hooks/common/useDataFreshness";
import { useNetworkStatus } from "../../hooks/common/useNetworkStatus";
import type { QueryKey } from "@tanstack/react-query";

export interface DataFreshnessIndicatorProps {
  /** 可选查询键前缀；省略时聚合当前活跃查询 */
  scope?: QueryKey;
  className?: string;
}

function formatRefreshTime(lastUpdatedAt: number, t: TFunction): string {
  const diffMs = Date.now() - lastUpdatedAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return t("common.timeAgo.justNow");
  if (diffMins < 60) return t("common.timeAgo.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("common.timeAgo.hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("common.timeAgo.daysAgo", { count: diffDays });
  return t("common.date.shortDate", {
    month: new Date(lastUpdatedAt).getMonth() + 1,
    day: new Date(lastUpdatedAt).getDate(),
  });
}

export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  scope,
  className,
}) => {
  const { t } = useTranslation();
  const { lastUpdatedAt, isFetching, refresh } = useDataFreshness(scope);
  const { isOnline } = useNetworkStatus();

  const handleRefresh = useCallback(() => {
    if (!isOnline) return;
    refresh();
  }, [isOnline, refresh]);

  // 尚无数据时无需展示时间，但保留按钮入口以便触发查询加载
  const timeLabel =
    lastUpdatedAt !== null
      ? t("common.dataFreshness.updated", {
          time: formatRefreshTime(lastUpdatedAt, t),
        })
      : t("common.dataFreshness.never");

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
        "text-gray-400 dark:text-slate-400",
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
      title={timeLabel}
    >
      <button
        type="button"
        onClick={handleRefresh}
        disabled={!isOnline || isFetching}
        className={cn(
          "flex items-center gap-1 rounded-full transition-colors min-w-[28px] min-h-[28px] px-1 justify-center",
          "hover:text-primary-600 hover:bg-primary-50 dark:hover:text-primary-400 dark:hover:bg-slate-800",
          isOnline ? "cursor-pointer" : "cursor-not-allowed opacity-50",
        )}
        aria-label={t("common.dataFreshness.refreshAria")}
        title={t("common.refresh")}
      >
        <RefreshCw
          size={14}
          aria-hidden="true"
          className={cn(isFetching && "animate-spin")}
        />
      </button>
      <span className="sr-only sm:not-sr-only sm:inline">{timeLabel}</span>
    </div>
  );
};