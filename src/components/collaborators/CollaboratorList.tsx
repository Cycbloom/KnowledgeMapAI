import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Square } from "lucide-react";
import {
  CollaboratorRole,
  CollaboratorWithUser,
  COLLABORATOR_ROLE_LABELS,
  COLLABORATOR_ROLE_COLORS,
} from "@shared/types";
import { BatchActionsToolbar } from "../common";
import { useListSelection } from "../../hooks/common";
import { useTheme } from "../../hooks";

interface CollaboratorListProps {
  collaborators: CollaboratorWithUser[];
  currentUserId: string;
  isOwner: boolean;
  onUpdateRole?: (userId: string, role: CollaboratorRole) => void;
  onRemove?: (userId: string) => void;
  onBatchRemove?: (userIds: string[]) => void;
}

export const CollaboratorList: React.FC<CollaboratorListProps> = ({
  collaborators,
  currentUserId: _currentUserId,
  isOwner,
  onUpdateRole,
  onRemove,
  onBatchRemove,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const [selectMode, setSelectMode] = useState(false);

  const selectableIds = useMemo(
    () =>
      isOwner
        ? collaborators.filter((c) => c.role !== "owner").map((c) => c.user_id)
        : [],
    [collaborators, isOwner],
  );
  const { selectedIds, selectionState, toggleId, toggleSelectAll, clear, isSelected } =
    useListSelection(selectableIds);

  const canBatch = isOwner && onBatchRemove != null;

  const toggleSelectMode = () => {
    clear();
    setSelectMode((prev) => !prev);
  };

  return (
    <div className="space-y-2">
      {canBatch && (
        <button
          onClick={toggleSelectMode}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium border dark:border-slate-500 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
        >
          {selectMode ? t("collaborators.batch.exit") : t("collaborators.batch.manage")}
        </button>
      )}
      {selectMode && (
        <BatchActionsToolbar
          isDark={isDark}
          i18nPrefix="collaborators.batch"
          isAllSelected={selectionState.isAllSelected}
          isPartialSelected={selectionState.isPartialSelected}
          selectedCount={selectionState.selectedCount}
          isBatchDeleting={false}
          onToggleSelectAll={toggleSelectAll}
          onBatchAction={() => {
            if (onBatchRemove) onBatchRemove(Array.from(selectedIds));
          }}
          onClearSelection={clear}
        />
      )}
      {collaborators.map((collaborator) => (
        <div
          key={collaborator.id}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div className="flex items-center gap-3">
            {isOwner && selectMode && collaborator.role !== "owner" && (
              <button
                role="checkbox"
                aria-checked={isSelected(collaborator.user_id) ? "true" : "false"}
                onClick={() => toggleId(collaborator.user_id)}
                className="p-1 min-h-[44px] min-w-[44px] touch-target flex items-center justify-center"
                aria-label={t("collaborators.batch.selectAll")}
              >
                {isSelected(collaborator.user_id) ? (
                  <CheckSquare className="w-5 h-5 text-primary-500" aria-hidden="true" />
                ) : (
                  <Square className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
              {collaborator.user?.name?.[0] || collaborator.user?.email?.[0] || "?"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {collaborator.user?.name || collaborator.user?.email}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {collaborator.user?.email}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && collaborator.role !== "owner" ? (
              <select
                value={collaborator.role}
                onChange={(e) => onUpdateRole?.(collaborator.user_id, e.target.value as CollaboratorRole)}
                className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="editor">{t(COLLABORATOR_ROLE_LABELS.editor)}</option>
                <option value="viewer">{t(COLLABORATOR_ROLE_LABELS.viewer)}</option>
              </select>
            ) : (
              <span
                className="px-2 py-1 text-sm rounded"
                style={{ backgroundColor: `${COLLABORATOR_ROLE_COLORS[collaborator.role]  }20`, color: COLLABORATOR_ROLE_COLORS[collaborator.role] }}
              >
                {t(COLLABORATOR_ROLE_LABELS[collaborator.role])}
              </span>
            )}
            {isOwner && collaborator.role !== "owner" && (
              <button
                onClick={() => onRemove?.(collaborator.user_id)}
                className="p-1 text-red-500 hover:text-red-700 min-h-[44px] min-w-[44px] touch-target flex items-center justify-center"
                aria-label={t("common.aria.removeCollaborator")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
