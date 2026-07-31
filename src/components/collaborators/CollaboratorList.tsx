import React from "react";
import { useTranslation } from "react-i18next";
import {
  CollaboratorRole,
  CollaboratorWithUser,
  COLLABORATOR_ROLE_LABELS,
  COLLABORATOR_ROLE_COLORS,
} from "@shared/types";

interface CollaboratorListProps {
  collaborators: CollaboratorWithUser[];
  currentUserId: string;
  isOwner: boolean;
  onUpdateRole?: (userId: string, role: CollaboratorRole) => void;
  onRemove?: (userId: string) => void;
}

export const CollaboratorList: React.FC<CollaboratorListProps> = ({
  collaborators,
  currentUserId: _currentUserId,
  isOwner,
  onUpdateRole,
  onRemove,
}) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {collaborators.map((collaborator) => (
        <div
          key={collaborator.id}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div className="flex items-center gap-3">
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
                className="p-1 text-red-500 hover:text-red-700"
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
