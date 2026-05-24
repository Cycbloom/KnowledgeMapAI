import React from "react";
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
  return (
    <div className={`h-full ${className}`}>
      <MarkdownEditor
        value={notes || ""}
        onChange={onChange}
        onSave={onSave}
        placeholder="在这里记录任务笔记...&#10;&#10;支持 Markdown 语法：&#10;- **粗体** *斜体*&#10;- # 标题&#10;- 列表项&#10;- [链接](url)"
        className="h-full"
      />
    </div>
  );
};