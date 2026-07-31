import React, { useState, useId } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { CollaboratorRole, COLLABORATOR_ROLE_LABELS } from "@shared/types";
import { useFocusTrap, useEscapeKey, useFormDraft } from "@/hooks/common";
import { ConfirmationModal } from "../common/ConfirmationModal";

interface InviteCollaboratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: CollaboratorRole) => Promise<void>;
}

export const InviteCollaboratorDialog: React.FC<InviteCollaboratorDialogProps> = ({
  isOpen,
  onClose,
  onInvite,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const {
    value: draft,
    setValue: setDraft,
    clearDraft,
    showRestorePrompt,
    onRestore,
    onDiscard,
  } = useFormDraft<{ email: string; role: CollaboratorRole }>({
    key: "invite_collaborator_draft",
    initialValue: { email: "", role: "viewer" as CollaboratorRole },
    storage: "sessionStorage",
  });
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  useEscapeKey(() => onClose(), isOpen);

  if (!isOpen) return null;

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validateEmail(draft.email)) return;
    setSubmitting(true);
    try {
      await onInvite(draft.email, draft.role);
      clearDraft();
      setTouched(false);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
          <h2 id={titleId} className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {t('collaborators.invite.dialog.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.aria.close')}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('collaborators.invite.dialog.emailLabel')}
              </label>
              <input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={draft.email}
                onChange={(e) => setDraft(prev => ({ ...prev, email: e.target.value }))}
                onBlur={() => setTouched(true)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="user@example.com"
                required
              />
              {touched && !validateEmail(draft.email) && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {t("collaborators.invite.validation.emailInvalid")}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('collaborators.invite.dialog.roleLabel')}
              </label>
              <select
                id="invite-role"
                value={draft.role}
                onChange={(e) => setDraft(prev => ({ ...prev, role: e.target.value as CollaboratorRole }))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="editor">{t(COLLABORATOR_ROLE_LABELS.editor)}</option>
                <option value="viewer">{t(COLLABORATOR_ROLE_LABELS.viewer)}</option>
              </select>
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('collaborators.invite.dialog.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? t("collaborators.invite.inviting")
                : t("collaborators.invite.invite")}
            </button>
          </div>
        </form>
      </div>
      <ConfirmationModal
        isOpen={showRestorePrompt}
        onClose={onDiscard}
        onConfirm={onRestore}
        title={t("common.restoreDraftTitle")}
        message={t("common.restoreDraftMessage")}
        confirmText={t("common.restore")}
        cancelText={t("common.discard")}
      />
    </div>
  );
};
