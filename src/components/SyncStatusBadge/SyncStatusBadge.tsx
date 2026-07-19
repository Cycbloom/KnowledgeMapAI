import { useEffect, useState, useRef } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { offlineMutationQueue, type QueuedMutation } from "@/utils/offlineMutations";
import { cn } from "@/lib/utils";

/**
 * 同步状态徽章组件
 *
 * 基于 offlineMutationQueue 显示 pending mutation 数量：
 * - pending = 0：不显示
 * - pending 1-10：黄色徽章 + 数字
 * - pending >10 或有失败项：红色徽章 + 数字
 *
 * 点击徽章弹出 popover 显示最近 5 项队列状态。
 */
export function SyncStatusBadge() {
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = offlineMutationQueue.subscribe((q) => {
      setQueue(q);
    });
    return unsubscribe;
  }, []);

  // 点击外部关闭 popover
  useEffect(() => {
    if (!showPopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);

  const pendingCount = queue.length;
  const failedCount = queue.filter((item) => item.lastError !== undefined).length;

  // 决定徽章颜色
  let badgeColor = "bg-green-500";
  if (pendingCount > 10 || failedCount > 0) {
    badgeColor = "bg-red-500";
  } else if (pendingCount > 0) {
    badgeColor = "bg-yellow-500";
  }

  if (pendingCount === 0) {
    return null; // 无 pending 时不显示
  }

  return (
    <div ref={containerRef} className="relative" data-testid="sync-status-badge">
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className={cn(
          "relative p-1.5 rounded-full text-white hover:opacity-80 transition-opacity",
          badgeColor,
        )}
        aria-label="同步状态"
      >
        <RefreshCw className="h-4 w-4" />
        {pendingCount > 0 && (
          <span
            data-testid="sync-status-badge-count"
            className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center"
          >
            {pendingCount}
          </span>
        )}
      </button>
      {showPopover && (
        <div
          data-testid="sync-status-badge-popover"
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto"
        >
          <div className="p-3 border-b border-gray-200 font-medium text-sm text-gray-800">
            待同步操作 ({pendingCount})
          </div>
          <div className="divide-y divide-gray-100">
            {queue.slice(0, 5).map((item) => (
              <div key={item.id} className="p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate text-gray-800">
                    {formatMutationKey(item.mutationKey)}
                  </span>
                  <span className="text-gray-500 shrink-0">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
                {item.lastError && (
                  <div className="text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span className="truncate">{item.lastError}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatMutationKey(key: unknown[]): string {
  if (!Array.isArray(key) || key.length === 0) return "未知操作";
  return key.map((k) => String(k)).join(" / ");
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
