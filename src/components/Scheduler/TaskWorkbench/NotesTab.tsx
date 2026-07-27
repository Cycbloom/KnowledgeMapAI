import React from "react";
import { useTranslation } from "react-i18next";
import { MarkdownEditor } from "./MarkdownEditor";

interface NotesTabProps {
  notes: string;
  onChange: (notes: string) => void;
  onSave: (notes: string) => Promise<void>;
  className?: string;
}

export const NotesTab: React.FC<NotesTabProps> = ({
  notes,
  onChange,
  onSave,
  className = "",
}) => {
  const { t } = useTranslation();
  return (
    <div className={`h-full ${className}`}>
      <MarkdownEditor
        value={notes || ""}
        onChange={onChange}
        onSave={onSave}
        placeholder={t('scheduler.taskWorkbench.notesTab.notesPlaceholder')}
        className="h-full"
      />
    </div>
  );
};