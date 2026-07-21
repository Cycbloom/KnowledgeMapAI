/**
 * 块编辑器工具栏:行内格式化按钮 + 撤销/重做 + 块上/下移动(降级拖拽方案)
 * + P1 AI 按钮(生成今日总结 / 提取要点建图)。
 *
 * 块移动(SubTask 7.6)采用降级方案:在工具栏提供"上移块/下移块"按钮,
 * 交换当前选区所在顶层节点与其前/后顶层节点的位置。
 * 拖拽手柄(@tiptap/extension-drag-handle)为 Pro 付费扩展,故不引入。
 *
 * AI 按钮(Task 7):
 * - "生成今日总结"仅当 noteType === 'daily' 时显示,调用后端聚合今日数据
 *   生成结构化总结并插入"今日反思"标题后(若不存在则插入光标处)。
 * - "提取要点建图"对所有笔记显示,提取候选知识点后弹出 ExtractConceptsDialog
 *   供用户确认反向建图。
 */
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Undo2,
  Redo2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Network,
  Image as ImageIcon,
  Forward,
  Pencil,
  Maximize2,
  RefreshCw,
  Copy,
  FileText,
} from "lucide-react";
import type { Editor } from "@tiptap/core";
import { cn } from "@/lib/utils";
import {
  useGenerateDailySummaryMutation,
  useExtractConceptsMutation,
} from "@/hooks/mutations";
import { message } from "@/utils/messageHelper";
import { ShortcutHint } from "../common/ShortcutHint";
import { ExtractConceptsDialog } from "./ExtractConceptsDialog";
import { markdownToTiptap } from "./markdownSerializer";
import type { NoteType, NoteExtractedConcept, WritingAssistAction } from "@shared/types/note";

/** 工具栏分隔符(模块级组件,避免在 render 内创建导致状态重置)。 */
const ToolbarDivider: React.FC = () => (
  <span className="w-px h-5 bg-gray-200 dark:bg-slate-700 mx-1" aria-hidden />
);

interface ToolbarButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** 由 ShortcutHint 通过 cloneElement 注入,转发到 DOM 以满足 SR 可访问性 */
  "aria-keyshortcuts"?: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  isActive = false,
  disabled = false,
  loading = false,
  "aria-keyshortcuts": ariaKeyshortcuts,
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-keyshortcuts={ariaKeyshortcuts}
    onClick={onClick}
    disabled={disabled || loading}
    className={cn(
      "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
      "focus:outline-none focus:ring-2 focus:ring-primary-400",
      isActive
        ? "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-300"
        : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700",
      (disabled || loading) &&
        "opacity-40 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent",
    )}
  >
    <Icon className={cn("w-4 h-4", loading && "animate-spin")} />
  </button>
);

/** "今日反思"标题的关键词,用于在文档中定位插入位置。 */
const REFLECTION_KEYWORDS = ["今日反思", "Today's Reflection", "Reflection"];

/**
 * 在文档中查找"今日反思"二级/三级标题后的插入位置。
 * 返回该标题节点末尾的位置(即标题块之后);未找到返回 null。
 */
const findReflectionInsertPos = (editor: Editor): number | null => {
  let foundPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level as number | undefined;
      if (level === 2 || level === 3) {
        const text = node.textContent;
        if (REFLECTION_KEYWORDS.some((kw) => text.includes(kw))) {
          foundPos = pos + node.nodeSize;
          return false; // 命中后停止遍历
        }
      }
    }
    return true; // 继续遍历
  });
  return foundPos;
};

/**
 * 将 AI 生成的总结插入编辑器:
 * - 若文档中存在"今日反思"标题,在其后插入;
 * - 否则退化到光标处插入。
 *
 * 关键:必须以"字符串"形式传给 insertContentAt —— tiptap-markdown 的 Markdown 扩展
 * 重写了 insertContentAt,会调用 parser.parse(content) 将 Markdown 渲染为 HTML,再由
 * ProseMirror DOMParser 解析为对应节点(标题/列表/加粗等)。若传入 JSON 对象,
 * parser.parse 会原样返回,Markdown 语法(### /**等)会被当作纯文本不渲染。
 * 注意:insertContent(无 At 后缀)未被重写,不会解析 Markdown,故改用 insertContentAt
 * 配合光标当前位置实现等价插入。
 * 此外用 markdownToTiptap 预处理 wiki 链接 [[节点名]] 与块引用 ((id)) / !((id))。
 */
const insertSummary = (editor: Editor, summary: string) => {
  const content = markdownToTiptap(summary);
  const pos = findReflectionInsertPos(editor);
  if (pos !== null) {
    editor.chain().focus().insertContentAt(pos, content).run();
  } else {
    // insertContent 未被 tiptap-markdown 重写,故用 insertContentAt 配合当前光标位置
    const { from } = editor.state.selection;
    editor.chain().focus().insertContentAt(from, content).run();
  }
};

export interface BlockEditorToolbarProps {
  editor: Editor | null;
  onMoveBlockUp: () => void;
  onMoveBlockDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** 笔记 ID,用于调用 AI 端点 */
  noteId: string;
  /** 笔记类型,'daily' 时显示"生成今日总结"按钮 */
  noteType: NoteType;
  /** Task 9:插入图片回调(由 BlockEditor 提供共享上传逻辑) */
  onInsertImage?: (file: File) => Promise<void> | void;
  /** Task 9:图片上传中状态(同步按钮 loading) */
  isUploadingImage?: boolean;
  /** P2 Task 7:当前是否存在非空选区(决定写作辅助按钮是否启用) */
  hasSelection?: boolean;
  /** P2 Task 7:写作辅助回调(续写/改写/扩写),由 BlockEditor 处理 mutation 与 popover */
  onWritingAssist?: (action: WritingAssistAction) => void;
  /** P2 Task 7:写作辅助 loading 状态(禁止重复触发) */
  isWritingAssistLoading?: boolean;
  /** P2 Task 7:刷新今日数据回调(仅 daily),由 BlockEditor 处理 mutation 与 setContent */
  onRefreshAggregation?: () => void;
  /** P2 Task 7:刷新聚合 loading 状态 */
  isRefreshingAggregation?: boolean;
  /** P3 Task 8.3: 复制当前顶层块的 ((blockId)) 到剪贴板,由 BlockEditor 处理 ensureBlockId + clipboard */
  onCopyBlockRef?: () => void;
  /** P3 Task 8.4: 在当前光标位置插入 !((blockId)) 嵌入当前顶层块,由 BlockEditor 处理 ensureBlockId + insertBlockEmbed */
  onEmbedBlock?: () => void;
}

export const BlockEditorToolbar: React.FC<BlockEditorToolbarProps> = ({
  editor,
  onMoveBlockUp,
  onMoveBlockDown,
  canMoveUp,
  canMoveDown,
  noteId,
  noteType,
  onInsertImage,
  isUploadingImage = false,
  hasSelection = false,
  onWritingAssist,
  isWritingAssistLoading = false,
  onRefreshAggregation,
  isRefreshingAggregation = false,
  onCopyBlockRef,
  onEmbedBlock,
}) => {
  const { t } = useTranslation();
  const summaryMutation = useGenerateDailySummaryMutation();
  const extractMutation = useExtractConceptsMutation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogConcepts, setDialogConcepts] = useState<NoteExtractedConcept[]>(
    [],
  );

  // Task 9:隐藏的文件选择 input,通过 ref 触发 click
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!editor) return null;

  const isDaily = noteType === "daily";
  const aiLoading =
    summaryMutation.isPending ||
    extractMutation.isPending ||
    isWritingAssistLoading ||
    isRefreshingAggregation;

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // 重置 value 允许同一文件被再次选中触发 change
    event.target.value = "";
    if (!file) return;
    if (onInsertImage) {
      await onInsertImage(file);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      const res = await summaryMutation.mutateAsync(noteId);
      insertSummary(editor, res.summary);
      message.success(t("notes.ai.summary.success"));
    } catch {
      message.error(t("notes.ai.summary.error"));
    }
  };

  const handleExtractConcepts = async () => {
    try {
      const res = await extractMutation.mutateAsync(noteId);
      if (res.concepts.length === 0) {
        message.info(t("notes.ai.extractConcepts.dialog.empty"));
        return;
      }
      setDialogConcepts(res.concepts);
      setDialogOpen(true);
      message.success(
        t("notes.ai.extractConcepts.success", { count: res.concepts.length }),
      );
    } catch {
      message.error(t("notes.ai.extractConcepts.error"));
    }
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 dark:border-slate-700 flex-wrap">
      <ToolbarButton
        icon={Bold}
        label={t("notes.editor.toolbar.bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        disabled={!editor.can().toggleBold()}
      />
      <ToolbarButton
        icon={Italic}
        label={t("notes.editor.toolbar.italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        disabled={!editor.can().toggleItalic()}
      />
      <ToolbarButton
        icon={Strikethrough}
        label={t("notes.editor.toolbar.strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        disabled={!editor.can().toggleStrike()}
      />
      <ToolbarButton
        icon={Code}
        label={t("notes.editor.toolbar.code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        disabled={!editor.can().toggleCode()}
      />
      <ToolbarDivider />
      <ShortcutHint actionId="undo">
        <ToolbarButton
          icon={Undo2}
          label={t("notes.editor.toolbar.undo")}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        />
      </ShortcutHint>
      <ShortcutHint actionId="redo">
        <ToolbarButton
          icon={Redo2}
          label={t("notes.editor.toolbar.redo")}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        />
      </ShortcutHint>
      <ToolbarDivider />
      <ToolbarButton
        icon={ChevronUp}
        label={t("notes.editor.toolbar.moveUp")}
        onClick={onMoveBlockUp}
        disabled={!canMoveUp}
      />
      <ToolbarButton
        icon={ChevronDown}
        label={t("notes.editor.toolbar.moveDown")}
        onClick={onMoveBlockDown}
        disabled={!canMoveDown}
      />
      {/* P3 Task 8.3/8.4: 块引用操作(复制块引用 / 嵌入此块),由 BlockEditor 处理 ensureBlockId */}
      {(onCopyBlockRef || onEmbedBlock) && (
        <>
          <ToolbarDivider />
          {onCopyBlockRef && (
            <ToolbarButton
              icon={Copy}
              label={t("notes.editor.toolbar.copyBlockRef")}
              onClick={onCopyBlockRef}
              disabled={aiLoading}
            />
          )}
          {onEmbedBlock && (
            <ToolbarButton
              icon={FileText}
              label={t("notes.editor.toolbar.embedBlock")}
              onClick={onEmbedBlock}
              disabled={aiLoading}
            />
          )}
        </>
      )}
      <ToolbarDivider />
      {isDaily && (
        <ToolbarButton
          icon={Sparkles}
          label={t("notes.ai.summary.button")}
          onClick={handleGenerateSummary}
          loading={summaryMutation.isPending}
          disabled={aiLoading}
        />
      )}
      <ToolbarButton
        icon={Network}
        label={t("notes.ai.extractConcepts.button")}
        onClick={handleExtractConcepts}
        loading={extractMutation.isPending}
        disabled={aiLoading}
      />
      <ToolbarDivider />
      <ToolbarButton
        icon={ImageIcon}
        label={t("notes.image.insertButton")}
        onClick={handlePickImage}
        loading={isUploadingImage}
        disabled={!onInsertImage || isUploadingImage || aiLoading}
      />
      {/* Task 9:隐藏的文件选择 input,被"插入图片"按钮触发 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />
      {/* P2 Task 7:写作辅助按钮组(续写/改写/扩写),仅在选区非空时启用 */}
      {onWritingAssist && (
        <>
          <ToolbarDivider />
          <ToolbarButton
            icon={Forward}
            label={t("notes.writingAssist.button.continue")}
            onClick={() => onWritingAssist("continue")}
            loading={isWritingAssistLoading}
            disabled={!hasSelection || aiLoading}
          />
          <ToolbarButton
            icon={Pencil}
            label={t("notes.writingAssist.button.rewrite")}
            onClick={() => onWritingAssist("rewrite")}
            loading={isWritingAssistLoading}
            disabled={!hasSelection || aiLoading}
          />
          <ToolbarButton
            icon={Maximize2}
            label={t("notes.writingAssist.button.expand")}
            onClick={() => onWritingAssist("expand")}
            loading={isWritingAssistLoading}
            disabled={!hasSelection || aiLoading}
          />
        </>
      )}
      {/* P2 Task 7:刷新今日数据按钮(仅 daily) */}
      {isDaily && onRefreshAggregation && (
        <>
          <ToolbarDivider />
          <ToolbarButton
            icon={RefreshCw}
            label={t("notes.refreshAggregation.button")}
            onClick={onRefreshAggregation}
            loading={isRefreshingAggregation}
            disabled={aiLoading}
          />
        </>
      )}

      <ExtractConceptsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        concepts={dialogConcepts}
        noteId={noteId}
      />
    </div>
  );
};
