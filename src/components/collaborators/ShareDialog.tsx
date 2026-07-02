import React, { useState, useEffect } from "react";
import { X, Users, Link as LinkIcon, UserPlus } from "lucide-react";
import {
  CollaboratorList,
  InviteCollaboratorDialog,
  ShareLink,
} from "@/components/collaborators";
import { asyncConfirm } from "@/utils/asyncConfirm";
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
    if (await asyncConfirm({ title: '移除协作者', message: '确定要移除此协作者吗？', isDangerous: true })) {
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Users className="w-5 h-5" />
              分享与协作
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-gray-500">加载中...</div>
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
              <div className="pt-4 border-t dark:border-slate-700 space-y-3">
                <button
                  onClick={() => setShowInvite(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                >
                  <UserPlus className="w-4 h-4" />
                  邀请协作者
                </button>

                <button
                  onClick={handleGenerateShareLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                >
                  <LinkIcon className="w-4 h-4" />
                  生成分享链接
                </button>

                {shareToken && (
                  <ShareLink invitationToken={shareToken} graphId={graphId} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <InviteCollaboratorDialog
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
      />
    </>
  );
};
