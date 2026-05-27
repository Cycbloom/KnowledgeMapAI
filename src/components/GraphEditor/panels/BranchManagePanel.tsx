import React, { useState, useCallback } from "react";
import {
  X,
  GitBranch,
  Eye,
  GitMerge,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../../lib/utils";
import { useBranches, useGraphDiff } from "../../../hooks/queries/useGraphVersionQueries";
import { useMergeBranch } from "../../../hooks/mutations/useGraphVersionMutations";
import type { MergeConflict } from "@shared/types/graphVersion";

interface BranchManagePanelProps {
  graphId: string;
  onClose: () => void;
  hideHeader?: boolean;
}

interface BranchInfo {
  id: string;
  title: string;
  branch_name: string;
  created_at: string;
}

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
  return date.toLocaleDateString("zh-CN");
}

export const BranchManagePanel: React.FC<BranchManagePanelProps> = ({
  graphId,
  onClose,
  hideHeader,
}) => {
  const navigate = useNavigate();
  const { data: branches, isLoading } = useBranches(graphId);
  const mergeBranchMutation = useMergeBranch(graphId);

  const [mergeTarget, setMergeTarget] = useState<BranchInfo | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<
    Record<string, "main" | "branch">
  >({});
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(
    new Set(),
  );

  const branchList = (branches ?? []) as BranchInfo[];

  const openMergeDialog = useCallback((branch: BranchInfo) => {
    setMergeTarget(branch);
    setConflictResolutions({});
    setExpandedConflicts(new Set());
  }, []);

  const closeMergeDialog = useCallback(() => {
    setMergeTarget(null);
    setConflictResolutions({});
    setExpandedConflicts(new Set());
  }, []);

  const handleMerge = useCallback(() => {
    if (!mergeTarget) return;
    mergeBranchMutation.mutate(
      {
        branchGraphId: mergeTarget.id,
        conflictResolutions:
          Object.keys(conflictResolutions).length > 0
            ? conflictResolutions
            : undefined,
      },
      {
        onSuccess: () => {
          closeMergeDialog();
        },
      },
    );
  }, [mergeTarget, conflictResolutions, mergeBranchMutation, closeMergeDialog]);

  const handleViewBranch = useCallback(
    (branchId: string) => {
      navigate(`/graph/${branchId}`);
    },
    [navigate],
  );

  const toggleConflictExpand = (entityId: string) => {
    setExpandedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const handleConflictResolution = (
    entityId: string,
    resolution: "main" | "branch",
  ) => {
    setConflictResolutions((prev) => ({
      ...prev,
      [entityId]: resolution,
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {!hideHeader && (
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <GitBranch className="text-primary-500" size={18} />
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              分支管理
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : branchList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 dark:text-slate-500">
            <GitBranch size={40} className="mb-3 opacity-50" />
            <p className="text-sm">暂无分支</p>
            <p className="text-xs mt-1">从版本历史创建分支以开始</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {branchList.map((branch) => (
              <BranchItem
                key={branch.id}
                branch={branch}
                onMerge={() => openMergeDialog(branch)}
                onView={() => handleViewBranch(branch.id)}
              />
            ))}
          </div>
        )}
      </div>

      {mergeTarget && (
        <MergeDialogOverlay onClose={closeMergeDialog}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-700">
              <GitMerge size={18} className="text-primary-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                合并分支
              </h3>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  分支名称
                </p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {mergeTarget.title || mergeTarget.branch_name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  创建于 {formatRelativeTime(mergeTarget.created_at)}
                </p>
              </div>

              <MergeDiffPreview
                graphId={graphId}
                branchGraphId={mergeTarget.id}
              />

              <MergeConflictList
                graphId={graphId}
                branchGraphId={mergeTarget.id}
                conflictResolutions={conflictResolutions}
                expandedConflicts={expandedConflicts}
                onToggleExpand={toggleConflictExpand}
                onResolutionChange={handleConflictResolution}
              />
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={closeMergeDialog}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleMerge}
                disabled={mergeBranchMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mergeBranchMutation.isPending ? "合并中..." : "确认合并"}
              </button>
            </div>
          </div>
        </MergeDialogOverlay>
      )}
    </div>
  );
};

interface BranchItemProps {
  branch: BranchInfo;
  onMerge: () => void;
  onView: () => void;
}

const BranchItem: React.FC<BranchItemProps> = ({ branch, onMerge, onView }) => {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 group">
      <div className="flex items-center gap-3 min-w-0">
        <GitBranch size={16} className="text-slate-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
            {branch.title || branch.branch_name}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {formatRelativeTime(branch.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onView}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
        >
          <Eye size={12} />
          查看
        </button>
        <button
          onClick={onMerge}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
        >
          <GitMerge size={12} />
          合并
        </button>
      </div>
    </div>
  );
};

interface MergeDialogOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
}

const MergeDialogOverlay: React.FC<MergeDialogOverlayProps> = ({
  onClose,
  children,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
};

interface MergeDiffPreviewProps {
  graphId: string;
  branchGraphId: string;
}

const MergeDiffPreview: React.FC<MergeDiffPreviewProps> = ({
  graphId,
  branchGraphId,
}) => {
  const { data: diffResult, isLoading } = useGraphDiff(
    graphId,
    branchGraphId,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
          加载变更对比...
        </span>
      </div>
    );
  }

  if (!diffResult) return null;

  const s = diffResult.summary;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        变更概览
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <DiffStatCard
          label="新增"
          count={s.nodesAdded + s.edgesAdded}
          color="text-green-600 dark:text-green-400"
          bgColor="bg-green-50 dark:bg-green-900/20"
        />
        <DiffStatCard
          label="删除"
          count={s.nodesRemoved + s.edgesRemoved}
          color="text-red-600 dark:text-red-400"
          bgColor="bg-red-50 dark:bg-red-900/20"
        />
        <DiffStatCard
          label="修改"
          count={s.nodesModified + s.edgesModified}
          color="text-yellow-600 dark:text-yellow-400"
          bgColor="bg-yellow-50 dark:bg-yellow-900/20"
        />
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        节点: {s.nodesAdded + s.nodesRemoved + s.nodesModified} 处变更 · 边:{" "}
        {s.edgesAdded + s.edgesRemoved + s.edgesModified} 处变更
      </p>
    </div>
  );
};

interface DiffStatCardProps {
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

const DiffStatCard: React.FC<DiffStatCardProps> = ({
  label,
  count,
  color,
  bgColor,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center py-2 px-3 rounded-lg",
        bgColor,
      )}
    >
      <span className={cn("text-lg font-semibold", color)}>{count}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  );
};

interface MergeConflictListProps {
  graphId: string;
  branchGraphId: string;
  conflictResolutions: Record<string, "main" | "branch">;
  expandedConflicts: Set<string>;
  onToggleExpand: (entityId: string) => void;
  onResolutionChange: (entityId: string, resolution: "main" | "branch") => void;
}

const MergeConflictList: React.FC<MergeConflictListProps> = () => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-yellow-500" />
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          冲突检测
        </h4>
      </div>
      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          合并时将自动检测冲突。如有冲突，请在下方选择保留方式。
        </p>
      </div>
    </div>
  );
};

interface ConflictItemProps {
  conflict: MergeConflict;
  resolution: "main" | "branch" | undefined;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onResolutionChange: (resolution: "main" | "branch") => void;
}

const ConflictItem: React.FC<ConflictItemProps> = ({
  conflict,
  resolution,
  isExpanded,
  onToggleExpand,
  onResolutionChange,
}) => {
  return (
    <div className="rounded-lg border border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20 transition-colors"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
        )}
        <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
        <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
          {conflict.entityType === "node" ? "节点" : "边"}冲突
          {conflict.knowledgePointId ? ` · ${conflict.knowledgePointId}` : ""}
        </span>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-yellow-200 dark:border-yellow-800/50 pt-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`conflict-${conflict.entityId}`}
                checked={resolution === "main"}
                onChange={() => onResolutionChange("main")}
                className="text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                保留主线
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`conflict-${conflict.entityId}`}
                checked={resolution === "branch"}
                onChange={() => onResolutionChange("branch")}
                className="text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                保留分支
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export { ConflictItem };
