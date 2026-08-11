import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Users, Link as LinkIcon, UserPlus } from "lucide-react";
import {
  CollaboratorList,
  InviteCollaboratorDialog,
  ShareLink,
} from "@/components/collaborators";
import { asyncConfirm } from "@/utils/asyncConfirm";
import { ModalShell } from '../common';
import { useCollaborators } from "../../hooks";
import type { CollaboratorRole } from "@shared/types";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  graphId: string;
  currentUserId: string;
  isOwner: boolean;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  onClose,
  graphId,
  currentUserId,
  isOwner,
}) => {
  const { t } = useTranslation();
  const [showInvite, setShowInvite] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const {
    collaborators,
    loading,
    fetchCollaborators,
    inviteCollaborator,
    updateRole,
    removeCollaborator,
    generateShareLink,
  } = useCollaborators();

  useEffect(() => {
    if (isOpen && graphId) {
      fetchCollaborators(graphId);
    }
  }, [isOpen, graphId, fetchCollaborators]);

  const handleInvite = async (email: string, role: CollaboratorRole) => {
    await inviteCollaborator(graphId, email, role);
  };

  const handleUpdateRole = async (userId: string, role: CollaboratorRole) => {
    await updateRole(graphId, userId, role);
  };

  const handleRemove = async (userId: string) => {
    if (await asyncConfirm({ title: t('common.confirm.removeCollaboratorTitle'), message: t('common.confirm.removeCollaboratorMessage'), isDangerous: true })) {
      await removeCollaborator(graphId, userId);
    }
  };

  const handleGenerateShareLink = async () => {
    const result = await generateShareLink(graphId);
    if (result) {
      setShareToken(result.invitationToken);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        titleId="share-dialog-title"
        className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        overlayClassName="p-2 sm:p-4 backdrop-blur-sm"
      >
          <div className="flex items-center justify-between p-4 border-b dark:border-slate-500">
            <h2
              id="share-dialog-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"
            >
              <Users className="w-5 h-5" aria-hidden="true" />
              {t('collaborators.shareDialog.title')}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 touch-target flex items-center justify-center"
              aria-label={t('common.close')}
            >
              <X aria-hidden="true" className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-gray-500">{t('common.loading')}</div>
            ) : (
              <CollaboratorList
                collaborators={collaborators}
                currentUserId={currentUserId}
                isOwner={isOwner}
                onUpdateRole={handleUpdateRole}
                onRemove={handleRemove}
              />
            )}

            {isOwner && (
              <div className="pt-4 border-t dark:border-slate-500 space-y-3">
                <button
                  onClick={() => setShowInvite(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  {t('collaborators.shareDialog.inviteCollaborator')}
                </button>

                <button
                  onClick={handleGenerateShareLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-slate-500 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                >
                  <LinkIcon className="w-4 h-4" aria-hidden="true" />
                  {t('collaborators.shareDialog.generateLink')}
                </button>

                {shareToken && (
                  <ShareLink invitationToken={shareToken} graphId={graphId} />
                )}
              </div>
            )}
          </div>
      </ModalShell>

      <InviteCollaboratorDialog
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
      />
    </>
  );
};
