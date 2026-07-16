import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  History,
  Camera,
  GitBranch,
  RotateCcw,
  X,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatDate } from "../../../utils/formatters";
import { useSnapshots } from "../../../hooks/queries/useGraphVersionQueries";
import {
  useCreateSnapshot,
  useRollback,
  useCreateBranch,
} from "../../../hooks/mutations/useGraphVersionMutations";
import type { GraphSnapshot, GraphSnapshotType } from "@shared/types/graphVersion";
import { BranchManagePanel } from "./BranchManagePanel";
import { EmptyState } from "../../common/EmptyState";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";

interface VersionHistoryPanelProps {
  graphId: string;
  onClose: () => void;
  onDiffSelect?: (sourceSnapshotId: string, targetSnapshotId?: string) => void;
}

const SNAPSHOT_TYPE_CONFIG: Record<
  GraphSnapshotType,
  { label: string; color: string; bgColor: string }
> = {
  manual: {
    label: "手动",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  auto: {
    label: "自动",
    color: "text-slate-600 dark:text-slate-300",
    bgColor: "bg-slate-100 dark:bg-slate-700/50",
  },
  pre_ai_expand: {
    label: "AI扩展前",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  pre_batch_delete: {
    label: "批量删除前",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  pre_rollback: {
    label: "回滚前",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}天前`;
  return formatDate(date, "short");
}

type DialogType = "createSnapshot" | "rollback" | "createBranch" | null;

export const VersionHistoryPanel = React.memo(function VersionHistoryPanel({
  graphId,
  onClose,
  onDiffSelect,
}: VersionHistoryPanelProps) {
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<GraphSnapshot | null>(null);
  const [snapshotDescription, setSnapshotDescription] = useState("");
  const [branchName, setBranchName] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"snapshots" | "branches">("snapshots");

  const pageSize = 20;
  const { data, isLoading } = useSnapshots(graphId, page, pageSize);
  const createSnapshotMutation = useCreateSnapshot(graphId);
  const rollbackMutation = useRollback(graphId);
  const createBranchMutation = useCreateBranch(graphId);

  const snapshots = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasMore = snapshots.length < total;

  const handleCreateSnapshot = useCallback(() => {
    createSnapshotMutation.mutate(snapshotDescription || undefined, {
      onSuccess: () => {
        setDialog(null);
        setSnapshotDescription("");
      },
    });
  }, [createSnapshotMutation, snapshotDescription]);

  const handleRollback = useCallback(() => {
    if (!selectedSnapshot) return;
    rollbackMutation.mutate(selectedSnapshot.id, {
      onSuccess: () => {
        setDialog(null);
        setSelectedSnapshot(null);
      },
    });
  }, [rollbackMutation, selectedSnapshot]);

  const handleCreateBranch = useCallback(() => {
    if (!branchName.trim()) return;
    createBranchMutation.mutate(branchName.trim(), {
      onSuccess: () => {
        setDialog(null);
        setBranchName("");
      },
    });
  }, [createBranchMutation, branchName]);

  const openRollbackDialog = useCallback((snapshot: GraphSnapshot) => {
    setSelectedSnapshot(snapshot);
    setDialog("rollback");
  }, []);

  const openBranchDialog = useCallback((snapshot: GraphSnapshot) => {
    setSelectedSnapshot(snapshot);
    setDialog("createBranch");
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setSelectedSnapshot(null);
    setSnapshotDescription("");
    setBranchName("");
  }, []);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {activeTab === "snapshots" ? (
            <History className="text-primary-500" size={18} />
          ) : (
            <GitBranch className="text-primary-500" size={18} />
          )}
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {activeTab === "snapshots" ? "版本历史" : "分支管理"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => { setActiveTab("snapshots"); setDialog(null); }}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                activeTab === "snapshots"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              快照
            </button>
            <button
              onClick={() => { setActiveTab("branches"); setDialog(null); }}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                activeTab === "branches"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              分支
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>
      </div>

      {activeTab === "snapshots" ? (
        <>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
              </div>
            ) : snapshots.length === 0 ? (
              <EmptyState
                icon={<Camera size={32} />}
                title={t('graphEditor.empty.snapshots')}
                action={{ label: t('graphEditor.createSnapshot'), onClick: handleCreateSnapshot }}
              />
            ) : (
              <div className="py-2">
                {snapshots.map((snapshot: GraphSnapshot, index: number) => (
                  <SnapshotItem
                    key={snapshot.id}
                    snapshot={snapshot}
                    isLast={index === snapshots.length - 1}
                    isHovered={hoveredId === snapshot.id}
                    onHover={() => setHoveredId(snapshot.id)}
                    onLeave={() => setHoveredId(null)}
                    onDiffClick={() => onDiffSelect?.(snapshot.id)}
                    onRollbackClick={() => openRollbackDialog(snapshot)}
                    onBranchClick={() => openBranchDialog(snapshot)}
                  />
                ))}

                {hasMore && (
                  <div className="flex justify-center py-3">
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      加载更多
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setDialog("createSnapshot")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Camera size={16} />
              创建快照
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <BranchManagePanel graphId={graphId} onClose={onClose} hideHeader />
        </div>
      )}

      {dialog && (
        <DialogOverlay onClose={closeDialog}>
          {dialog === "createSnapshot" && (
            <DialogContent
              title="创建快照"
              icon={<Camera size={18} className="text-primary-500" />}
              onConfirm={handleCreateSnapshot}
              onCancel={closeDialog}
              confirmLabel="创建"
              loading={createSnapshotMutation.isPending}
            >
              <input
                type="text"
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                placeholder="输入快照描述（可选）"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </DialogContent>
          )}

          {dialog === "rollback" && selectedSnapshot && (
            <DialogContent
              title="回滚确认"
              icon={<RotateCcw size={18} className="text-red-500" />}
              onConfirm={handleRollback}
              onCancel={closeDialog}
              confirmLabel="确认回滚"
              loading={rollbackMutation.isPending}
              confirmDanger
            >
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  确定要回滚到此版本吗？当前状态将自动保存为快照。
                </p>
                <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    目标快照
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {selectedSnapshot.description ?? "无描述"} ·{" "}
                    {formatRelativeTime(selectedSnapshot.createdAt)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    {selectedSnapshot.nodeCount} 节点 ·{" "}
                    {selectedSnapshot.edgeCount} 边
                  </p>
                </div>
              </div>
            </DialogContent>
          )}

          {dialog === "createBranch" && selectedSnapshot && (
            <DialogContent
              title="创建分支"
              icon={<GitBranch size={18} className="text-green-500" />}
              onConfirm={handleCreateBranch}
              onCancel={closeDialog}
              confirmLabel="创建分支"
              loading={createBranchMutation.isPending}
              confirmDisabled={!branchName.trim()}
            >
              <div className="space-y-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    基于快照
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {selectedSnapshot.description ?? "无描述"} ·{" "}
                    {formatRelativeTime(selectedSnapshot.createdAt)}
                  </p>
                </div>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="输入分支名称"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
            </DialogContent>
          )}
        </DialogOverlay>
      )}
    </div>
  );
});

interface SnapshotItemProps {
  snapshot: GraphSnapshot;
  isLast: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onDiffClick: () => void;
  onRollbackClick: () => void;
  onBranchClick: () => void;
}

const SnapshotItem: React.FC<SnapshotItemProps> = ({
  snapshot,
  isLast,
  isHovered,
  onHover,
  onLeave,
  onDiffClick,
  onRollbackClick,
  onBranchClick,
}) => {
  const typeConfig = SNAPSHOT_TYPE_CONFIG[snapshot.snapshotType];

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "relative px-4 py-3 transition-colors",
        isHovered
          ? "bg-slate-50 dark:bg-slate-800/50"
          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center pt-1">
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900",
              snapshot.snapshotType === "manual"
                ? "bg-blue-500"
                : snapshot.snapshotType === "pre_rollback"
                  ? "bg-red-500"
                  : snapshot.snapshotType === "pre_ai_expand"
                    ? "bg-purple-500"
                    : snapshot.snapshotType === "pre_batch_delete"
                      ? "bg-orange-500"
                      : "bg-slate-400",
            )}
          />
          {!isLast && (
            <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 mt-1 min-h-[24px]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded",
                typeConfig.bgColor,
                typeConfig.color,
              )}
            >
              {typeConfig.label}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {formatRelativeTime(snapshot.createdAt)}
            </span>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
            {snapshot.description ?? "无描述"}
          </p>

          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {snapshot.nodeCount} 节点 · {snapshot.edgeCount} 边
          </p>

          {isHovered && (
            <div className="flex items-center gap-1 mt-2">
              <button
                onClick={onDiffClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
              >
                <ChevronRight size={12} />
                查看 Diff
              </button>
              <button
                onClick={onRollbackClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
              >
                <RotateCcw size={12} />
                回滚
              </button>
              <button
                onClick={onBranchClick}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
              >
                <GitBranch size={12} />
                创建分支
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface DialogOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
}

const DialogOverlay: React.FC<DialogOverlayProps> = ({ onClose, children }) => {
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: true });
  useEscapeKey(() => onClose(), true);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
};

interface DialogContentProps {
  title: string;
  icon: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  loading?: boolean;
  confirmDanger?: boolean;
  confirmDisabled?: boolean;
  children: React.ReactNode;
}

const DialogContent: React.FC<DialogContentProps> = ({
  title,
  icon,
  onConfirm,
  onCancel,
  confirmLabel,
  loading,
  confirmDanger,
  confirmDisabled,
  children,
}) => {
  return (
    <>
      <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-700">
        {icon}
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </h3>
      </div>

      <div className="p-4">{children}</div>

      <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || confirmDisabled}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            confirmDanger
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-primary-600 hover:bg-primary-700 text-white",
          )}
        >
          {loading ? "处理中..." : confirmLabel}
        </button>
      </div>
    </>
  );
};
