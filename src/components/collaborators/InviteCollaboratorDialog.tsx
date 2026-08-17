import React, { useState, useId, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { CollaboratorRole, COLLABORATOR_ROLE_LABELS } from "@shared/types";
import { useFocusTrap, useEscapeKey, useFormDraft, useAutofocus } from "@/hooks/common";
import { focusFirstError } from "@/utils/form/focusFirstError";
import { FormErrorSummary, type FormErrorSummaryItem } from "../common/FormErrorSummary";
import { ConfirmationModal } from "../common/ConfirmationModal";
import { SaveButton } from "../common/SaveButton";

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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });
  const emailInputRef = useAutofocus<HTMLInputElement>();
  useEscapeKey(() => onClose(), isOpen);

  useEffect(() => {
    if (submitAttempted) {
      focusFirstError(formRef.current);
    }
  }, [submitAttempted, draft.email]);

  if (!isOpen) return null;

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const performInvite = async () => {
    setTouched(true);
    if (!validateEmail(draft.email)) {
      setSubmitAttempted(true);
      throw new Error(t("collaborators.invite.validation.emailInvalid"));
    }
    await onInvite(draft.email, draft.role);
    clearDraft();
    setTouched(false);
    setSubmitAttempted(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performInvite();
  };

  const emailInvalid = touched && !validateEmail(draft.email);
  const errorItems: FormErrorSummaryItem[] =
    submitAttempted && emailInvalid
      ? [{ field: "email", message: t("collaborators.invite.validation.emailInvalid") }]
      : [];

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
        <form onSubmit={handleSubmit} ref={formRef}>
          <FormErrorSummary
            errors={errorItems}
            onFocusField={(field) => {
              if (field === "email") {
                emailInputRef.current?.focus();
                emailInputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
              }
            }}
          />
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('collaborators.invite.dialog.emailLabel')}
              </label>
              <input
                id="invite-email"
                type="email"
                autoComplete="email"
                ref={emailInputRef}
                value={draft.email}
                onChange={(e) => setDraft(prev => ({ ...prev, email: e.target.value }))}
                onBlur={() => setTouched(true)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="user@example.com"
                required
                aria-invalid={touched && !validateEmail(draft.email) ? true : undefined}
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
            <SaveButton
              type="button"
              variant="primary"
              size="md"
              onSave={performInvite}
              idleLabel={t("collaborators.invite.invite")}
              savingLabel={t("collaborators.invite.inviting")}
              savedLabel={t("collaborators.invite.invite")}
            />
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
