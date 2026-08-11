import React, { useState, useCallback, useId } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  X,
  GitBranch,
  Eye,
  GitMerge,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../../utils/utils";
import { formatDate } from "../../../utils/formatters";
import { asyncConfirm } from "../../../utils/asyncConfirm";
import { useBranches, useGraphDiff, useMergePreview } from "../../../hooks/queries/useGraphVersionQueries";
import { useMergeBranch, useDeleteBranch } from "../../../hooks/mutations/useGraphVersionMutations";
import { useFocusTrap } from "../../../hooks/common";
import type { MergeConflict } from "@shared/types/graphVersion";
import { EmptyState } from "../../common/EmptyState";

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

function formatRelativeTime(dateStr: string, t: TFunction): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('graphEditor.branchManage.justNow');
  if (diffMins < 60) return t('graphEditor.branchManage.minutesAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('graphEditor.branchManage.hoursAgo', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return t('graphEditor.branchManage.daysAgo', { count: diffDays });
  return formatDate(date, "short");
}

export const BranchManagePanel = React.memo(function BranchManagePanel({
  graphId,
  onClose,
  hideHeader,
}: BranchManagePanelProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const mergeTitleId = useId();
  const deleteTitleId = useId();
  const { data: branches, isLoading } = useBranches(graphId);
  const mergeBranchMutation = useMergeBranch(graphId);
  const deleteBranchMutation = useDeleteBranch(graphId);

  const [mergeTarget, setMergeTarget] = useState<BranchInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BranchInfo | null>(null);
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

  const openDeleteDialog = useCallback((branch: BranchInfo) => {
    setDeleteTarget(branch);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const branchName = deleteTarget.title || deleteTarget.branch_name;
    const confirmed = await asyncConfirm({
      title: t('graphEditor.confirmDeleteBranchTitle'),
      message: t('graphEditor.confirmDeleteBranchMessage', { name: branchName }),
      isDangerous: true,
    });
    if (!confirmed) return;
    deleteBranchMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        closeDeleteDialog();
      },
    });
  }, [deleteTarget, deleteBranchMutation, closeDeleteDialog, t]);

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
              {t('graphEditor.versionHistory.branchManageTitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.aria.close')}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-target flex items-center justify-center"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" aria-busy={isLoading}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
          </div>
        ) : branchList.length === 0 ? (
          <EmptyState
            icon={<GitBranch size={32} />}
            title={t('graphEditor.empty.branches')}
          />
        ) : (
          <div className="p-3 space-y-2">
            {branchList.map((branch) => (
              <BranchItem
                key={branch.id}
                branch={branch}
                onMerge={() => openMergeDialog(branch)}
                onView={() => handleViewBranch(branch.id)}
                onDelete={() => openDeleteDialog(branch)}
              />
            ))}
          </div>
        )}
      </div>

      {mergeTarget && (
        <MergeDialogOverlay onClose={closeMergeDialog} titleId={mergeTitleId}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-500">
              <GitMerge size={18} className="text-primary-500" />
              <h3 id={mergeTitleId} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t('graphEditor.branchManage.mergeBranch')}
              </h3>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('graphEditor.branchManage.branchName')}
                </p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {mergeTarget.title || mergeTarget.branch_name}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {t('graphEditor.branchManage.createdAt', { time: formatRelativeTime(mergeTarget.created_at, t) })}
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

            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-500">
              <button
                onClick={closeMergeDialog}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleMerge}
                disabled={mergeBranchMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mergeBranchMutation.isPending ? t('graphEditor.branchManage.merging') : t('graphEditor.branchManage.confirmMerge')}
              </button>
            </div>
          </div>
        </MergeDialogOverlay>
      )}
      {deleteTarget && (
        <MergeDialogOverlay onClose={closeDeleteDialog} titleId={deleteTitleId}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-500">
              <Trash2 size={18} className="text-red-500" />
              <h3 id={deleteTitleId} className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {t('graphEditor.confirmDeleteBranchTitle')}
              </h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {t('graphEditor.branchManage.confirmDeleteMessage', { name: deleteTarget.title || deleteTarget.branch_name })}
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-500">
              <button
                onClick={closeDeleteDialog}
                className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBranchMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteBranchMutation.isPending ? t('graphEditor.branchManage.deleting') : t('graphEditor.branchManage.confirmDelete')}
              </button>
            </div>
          </div>
        </MergeDialogOverlay>
      )}
    </div>
  );
});

interface BranchItemProps {
  branch: BranchInfo;
  onMerge: () => void;
  onView: () => void;
  onDelete: () => void;
}

const BranchItem: React.FC<BranchItemProps> = ({ branch, onMerge, onView, onDelete }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-500 group">
      <div className="flex items-center gap-3 min-w-0">
        <GitBranch size={16} className="text-slate-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
            {branch.title || branch.branch_name}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {formatRelativeTime(branch.created_at, t)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onView}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
        >
          <Eye size={12} />
          {t('common.view')}
        </button>
        <button
          onClick={onMerge}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
        >
          <GitMerge size={12} />
          {t('graphEditor.branchManage.merge')}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        >
          <Trash2 size={12} />
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
};

interface MergeDialogOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  titleId?: string;
}

const MergeDialogOverlay: React.FC<MergeDialogOverlayProps> = ({
  onClose,
  children,
  titleId,
}) => {
  // 真模态:有 bg-black/50 全屏遮罩 + 阻止背景交互 + aria-modal="true"。
  // 组件由父组件挂载/卸载控制可见性:挂载时捕获触发元素,卸载时恢复焦点。
  const dialogRef = useFocusTrap<HTMLDivElement>();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>{children}</div>
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
  const { t } = useTranslation();
  const { data: diffResult, isLoading } = useGraphDiff(
    graphId,
    branchGraphId,
  );

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
          {t('graphEditor.branchManage.loadingDiff')}
        </span>
      </div>
    );
  }

  if (!diffResult) return null;

  const s = diffResult.summary;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {t('graphEditor.branchManage.diffOverview')}
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <DiffStatCard
          label={t('graphEditor.diffDetail.changeType.added')}
          count={s.nodesAdded + s.edgesAdded}
          color="text-green-600 dark:text-green-400"
          bgColor="bg-green-50 dark:bg-green-900/20"
        />
        <DiffStatCard
          label={t('graphEditor.diffDetail.changeType.removed')}
          count={s.nodesRemoved + s.edgesRemoved}
          color="text-red-600 dark:text-red-400"
          bgColor="bg-red-50 dark:bg-red-900/20"
        />
        <DiffStatCard
          label={t('graphEditor.diffDetail.changeType.modified')}
          count={s.nodesModified + s.edgesModified}
          color="text-yellow-600 dark:text-yellow-400"
          bgColor="bg-yellow-50 dark:bg-yellow-900/20"
        />
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {t('graphEditor.branchManage.diffSummary', {
          nodes: s.nodesAdded + s.nodesRemoved + s.nodesModified,
          edges: s.edgesAdded + s.edgesRemoved + s.edgesModified,
        })}
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

const MergeConflictList: React.FC<MergeConflictListProps> = ({
  graphId,
  branchGraphId,
  conflictResolutions,
  expandedConflicts,
  onToggleExpand,
  onResolutionChange,
}) => {
  const { t } = useTranslation();
  const { data: mergeResult, isLoading } = useMergePreview(graphId, branchGraphId);
  const conflicts = mergeResult?.conflicts ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-yellow-500" />
        <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t('graphEditor.branchManage.conflictDetection')}
        </h4>
      </div>
      {isLoading ? (
        <div role="status" aria-live="polite" className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500" />
          <span className="ml-2 text-xs text-slate-500">{t('graphEditor.branchManage.detectingConflicts')}</span>
        </div>
      ) : conflicts.length === 0 ? (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/50">
          <p className="text-xs text-green-700 dark:text-green-300">
            {t('graphEditor.branchManage.noConflicts')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              {t('graphEditor.branchManage.conflictsDetected', { count: conflicts.length })}
            </p>
          </div>
          {conflicts.map((conflict) => (
            <ConflictItem
              key={conflict.entityId}
              conflict={conflict}
              resolution={conflictResolutions[conflict.entityId]}
              isExpanded={expandedConflicts.has(conflict.entityId)}
              onToggleExpand={() => onToggleExpand(conflict.entityId)}
              onResolutionChange={(resolution) => onResolutionChange(conflict.entityId, resolution)}
            />
          ))}
        </div>
      )}
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
  const { t } = useTranslation();
  const isNodeConflict = conflict.entityType === "node";
  const mainAfter = conflict.mainChange.after;
  const branchAfter = conflict.branchChange.after;

  return (
    <div className="rounded-lg border border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20 transition-colors"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
        )}
        <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
        <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
          {isNodeConflict ? t('graphEditor.branchManage.conflict.nodeType') : t('graphEditor.branchManage.conflict.edgeType')}{t('graphEditor.branchManage.conflict.conflictLabel')}{conflict.knowledgePointId ? ` · ${conflict.knowledgePointId}` : ""}
        </span>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-yellow-200 dark:border-yellow-800/50 pt-2">
          {/* 变更字段展示 */}
          <div className="space-y-1">
            {conflict.mainChange.changedFields.length > 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                {t('graphEditor.branchManage.changedFields', { fields: conflict.mainChange.changedFields.join(", ") })}
              </div>
            )}
            {isNodeConflict && conflict.mainChange.changedFields.includes("content") && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-medium">{t('graphEditor.branchManage.contentChange')}</span>
                <div className="grid grid-cols-2 gap-1">
                  <div className="p-1 bg-blue-50 dark:bg-blue-900/10 rounded text-[10px] text-blue-700 dark:text-blue-300 whitespace-pre-wrap break-words max-h-16 overflow-y-auto">
                    {(mainAfter && "content" in mainAfter ? String(mainAfter.content) : "") || t('graphEditor.diffDetail.emptyValue')}
                  </div>
                  <div className="p-1 bg-purple-50 dark:bg-purple-900/10 rounded text-[10px] text-purple-700 dark:text-purple-300 whitespace-pre-wrap break-words max-h-16 overflow-y-auto">
                    {(branchAfter && "content" in branchAfter ? String(branchAfter.content) : "") || t('graphEditor.diffDetail.emptyValue')}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                  <span className="text-center">{t('graphEditor.branchManage.mainline')}</span>
                  <span className="text-center">{t('graphEditor.branchManage.branch')}</span>
                </div>
              </div>
            )}
          </div>
          {/* 冲突解决选项 */}
          <fieldset className="space-y-2">
            <legend className="sr-only">{t('graphMap.branch.conflictLegend')}</legend>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={`conflict-${conflict.entityId}`}
                checked={resolution === "main"}
                onChange={() => onResolutionChange("main")}
                className="text-primary-600 focus:ring-primary-500"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {t('graphEditor.branchManage.keepMainline')}
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
                {t('graphEditor.branchManage.keepBranch')}
              </span>
            </label>
          </fieldset>
        </div>
      )}
    </div>
  );
};

export { ConflictItem };
