import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Star,
  Loader2,
  X,
  FileText,
  Variable,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useNoteTemplates } from "../../hooks/queries";
import {
  useCreateNoteTemplateMutation,
  useUpdateNoteTemplateMutation,
  useDeleteNoteTemplateMutation,
  useSetDefaultNoteTemplateMutation,
} from "../../hooks/mutations";
import { message } from "../../utils/messageHelper";
import { Skeleton, EmptyState } from "../../components/common";
import { asyncConfirm } from "../../utils/asyncConfirm";
import type { NoteTemplate } from "@shared/types/note";
import { useFocusTrap } from "@/hooks/common";

/**
 * 支持的变量占位列表(供编辑器提示)。
 * 实际替换由后端在生成 daily 时完成,此处仅用于文档展示。
 */
const TEMPLATE_VARIABLES = [
  "date",
  "today_reviewed_cards",
  "today_completed_tasks",
  "today_focus_time",
] as const;

/**
 * TemplatesPage —— 笔记模板管理页(Task 11)。
 *
 * 路由:`/notes/templates`(注册在 notesPlugin 中,位于 `/notes/:noteId` 之前
 * 以避免 React Router 把 "templates" 当作 noteId 参数匹配)。
 *
 * 职责:
 * - 展示模板列表(系统模板在前、自定义模板在后)
 * - 新建/编辑/删除自定义模板
 * - 设为默认 / 取消默认(系统模板也可设为默认)
 * - 编辑/新建用 Modal(textarea + 变量占位提示)
 * - 删除用 asyncConfirm
 * - 加载态 Skeleton、空态 EmptyState、暗色模式全覆盖
 */
const TemplatesPage = () => {
  const { t } = useTranslation();
  const { token } = useStore();
  const navigate = useNavigate();

  const { data: templates, isLoading, error, refetch } = useNoteTemplates({
    enabled: !!token,
  });

  const createMutation = useCreateNoteTemplateMutation();
  const updateMutation = useUpdateNoteTemplateMutation();
  const deleteMutation = useDeleteNoteTemplateMutation();
  const setDefaultMutation = useSetDefaultNoteTemplateMutation();

  // 编辑/新建 Modal 状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NoteTemplate | null>(
    null,
  );
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  // 操作中标志:记录正在变更的模板 id,用于禁用对应按钮 + spinner
  const [pendingId, setPendingId] = useState<string | null>(null);

  // 打开 Modal 时同步表单初始值
  useEffect(() => {
    if (!dialogOpen) return;
    if (editingTemplate) {
      setName(editingTemplate.name);
      setContent(editingTemplate.content);
    } else {
      setName("");
      setContent("");
    }
  }, [dialogOpen, editingTemplate]);

  const systemTemplates = useMemo(
    () => (templates ?? []).filter((tpl) => tpl.isSystem),
    [templates],
  );
  const customTemplates = useMemo(
    () => (templates ?? []).filter((tpl) => !tpl.isSystem),
    [templates],
  );

  const showMessage = (
    type: "success" | "error",
    content: string,
  ): void => {
    if (type === "success") {
      message.success(content);
    } else {
      message.error(content);
    }
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setDialogOpen(true);
  };

  const openEdit = (tpl: NoteTemplate) => {
    // 系统模板不应进入编辑流程;此为防御性兜底,按钮已禁用
    if (tpl.isSystem) {
      showMessage("error", t("notes.templates.messages.systemTemplateProtected"));
      return;
    }
    setEditingTemplate(tpl);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showMessage("error", t("notes.templates.fields.name"));
      return;
    }
    setPendingId("__dialog__");
    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          id: editingTemplate.id,
          data: { name: trimmedName, content },
        });
        showMessage("success", t("notes.templates.messages.updated"));
      } else {
        await createMutation.mutateAsync({
          name: trimmedName,
          content,
        });
        showMessage("success", t("notes.templates.messages.created"));
      }
      closeDialog();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : editingTemplate
            ? t("notes.templates.messages.updateFailed")
            : t("notes.templates.messages.createFailed");
      showMessage("error", message);
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (tpl: NoteTemplate) => {
    if (tpl.isSystem) {
      showMessage("error", t("notes.templates.messages.systemTemplateProtected"));
      return;
    }
    const confirmed = await asyncConfirm({
      title: t("notes.templates.dialog.deleteConfirmTitle"),
      message: t("notes.templates.dialog.deleteConfirmMessage"),
      confirmText: t("notes.templates.actions.delete"),
      cancelText: t("notes.templates.actions.cancel"),
      isDangerous: true,
    });
    if (!confirmed) return;

    setPendingId(tpl.id);
    try {
      await deleteMutation.mutateAsync(tpl.id);
      showMessage("success", t("notes.templates.messages.deleted"));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("notes.templates.messages.deleteFailed");
      showMessage("error", message);
    } finally {
      setPendingId(null);
    }
  };

  const handleToggleDefault = async (tpl: NoteTemplate) => {
    setPendingId(tpl.id);
    try {
      // 后端 setDefault 接口已支持"设为默认"。当前实现无独立"取消默认"端点,
      // 故 isDefault=true 时按钮 disabled(只允许切换到其他模板),不进入此分支。
      await setDefaultMutation.mutateAsync(tpl.id);
      showMessage("success", t("notes.templates.messages.setDefault"));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("notes.templates.messages.setDefaultFailed");
      showMessage("error", message);
    } finally {
      setPendingId(null);
    }
  };

  // 当前默认模板 id(用于在列表项上禁用其它"设为默认"按钮前的展示)
  const defaultTemplateId = useMemo(
    () => (templates ?? []).find((tpl) => tpl.isDefault)?.id ?? null,
    [templates],
  );

  const handleBack = () => {
    navigate("/notes");
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* 顶部:标题 + 操作区 */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="min-w-0 flex items-start gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="mt-1 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            aria-label={t("notes.templates.backToNotes")}
            title={t("notes.templates.backToNotes")}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {t("notes.templates.title")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
              {t("notes.templates.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={createMutation.isPending}
          className="bg-primary-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>{t("notes.templates.actions.new")}</span>
        </button>
      </div>

      {/* 内容区 */}
      {error ? (
        <div className="p-8 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
          <p>{t("notes.loadFailed")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 text-primary-600 dark:text-primary-400 hover:underline"
          >
            {t("notes.retry")}
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 系统模板组 */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              {t("notes.templates.list.system")}
            </h2>
            {isLoading ? (
              <TemplatesSkeleton />
            ) : systemTemplates.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">
                {t("notes.templates.list.empty")}
              </p>
            ) : (
              <div className="space-y-3">
                {systemTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    isDefaultId={defaultTemplateId}
                    pendingId={pendingId}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleDefault={handleToggleDefault}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 自定义模板组 */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              {t("notes.templates.list.custom")}
            </h2>
            {isLoading ? (
              <TemplatesSkeleton />
            ) : customTemplates.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-700">
                <EmptyState
                  icon={
                    <FileText className="w-12 h-12 text-gray-300 dark:text-slate-600" />
                  }
                  title={t("notes.templates.list.empty")}
                  description={t("notes.templates.list.emptyHint")}
                  action={{
                    label: t("notes.templates.actions.new"),
                    onClick: openCreate,
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {customTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    isDefaultId={defaultTemplateId}
                    pendingId={pendingId}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleDefault={handleToggleDefault}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 编辑/新建 Modal */}
      {dialogOpen && (
        <TemplateEditDialog
          isOpen={dialogOpen}
          editing={!!editingTemplate}
          name={name}
          content={content}
          onNameChange={setName}
          onContentChange={setContent}
          onClose={closeDialog}
          onSave={handleSave}
          saving={pendingId === "__dialog__"}
        />
      )}
    </div>
  );
};

/**
 * 模板卡片。系统模板隐藏编辑/删除按钮,仅保留"设为默认"。
 */
type TemplateCardProps = {
  template: NoteTemplate;
  isDefaultId: string | null;
  pendingId: string | null;
  onEdit: (tpl: NoteTemplate) => void;
  onDelete: (tpl: NoteTemplate) => void;
  onToggleDefault: (tpl: NoteTemplate) => void;
};

const TemplateCard = ({
  template,
  isDefaultId,
  pendingId,
  onEdit,
  onDelete,
  onToggleDefault,
}: TemplateCardProps) => {
  const { t } = useTranslation();
  const isBusy = pendingId === template.id;
  const isDefault = isDefaultId === template.id;
  // 已为默认时禁用"设为默认"按钮(无可取消默认的端点)
  const setDefaultDisabled = isDefault || isBusy;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5 shadow-sm transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                <Star size={11} className="fill-amber-500 text-amber-500" aria-hidden="true" />
                <span>{t("notes.templates.list.default")}</span>
              </span>
            )}
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {template.name}
            </h3>
          </div>
          {/* 模板正文预览(限制高度,monospace 风格) */}
          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/50 rounded-md p-3 max-h-32 overflow-auto whitespace-pre-wrap font-mono">
            {template.content || ""}
          </pre>
          {isDefault && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {t("notes.templates.list.defaultHint")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 设为默认:系统模板也可设为默认 */}
          <button
            type="button"
            onClick={() => onToggleDefault(template)}
            disabled={setDefaultDisabled}
            className={`p-2 rounded-md transition-colors disabled:opacity-50 ${
              isDefault
                ? "text-amber-500 cursor-default"
                : "text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            }`}
            title={
              isDefault
                ? t("notes.templates.list.default")
                : t("notes.templates.actions.setDefault")
            }
            aria-label={
              isDefault
                ? t("notes.templates.list.default")
                : t("notes.templates.actions.setDefault")
            }
          >
            {isBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Star
                size={16}
                className={isDefault ? "fill-amber-500 text-amber-500" : ""}
              />
            )}
          </button>
          {/* 编辑:系统模板禁用 */}
          {!template.isSystem && (
            <button
              type="button"
              onClick={() => onEdit(template)}
              disabled={isBusy}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50"
              title={t("notes.templates.actions.edit")}
              aria-label={t("notes.templates.actions.edit")}
            >
              <Pencil size={16} />
            </button>
          )}
          {/* 删除:系统模板禁用 */}
          {!template.isSystem && (
            <button
              type="button"
              onClick={() => onDelete(template)}
              disabled={isBusy}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              title={t("notes.templates.actions.delete")}
              aria-label={t("notes.templates.actions.delete")}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 模板编辑/新建对话框。
 *
 * 使用 fixed overlay,内部 textarea(monospace 字体)+ 右上角变量占位提示浮层。
 * - 关闭:点遮罩 / Esc / 右上角 X / 取消按钮
 * - 保存:回车(name)或点击保存按钮(content 不绑定回车,允许换行)
 */
type TemplateEditDialogProps = {
  isOpen: boolean;
  editing: boolean;
  name: string;
  content: string;
  onNameChange: (v: string) => void;
  onContentChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
};

const TemplateEditDialog = ({
  isOpen,
  editing,
  name,
  content,
  onNameChange,
  onContentChange,
  onClose,
  onSave,
  saving,
}: TemplateEditDialogProps) => {
  const { t } = useTranslation();

  const containerRef = useFocusTrap<HTMLDivElement>({ enabled: isOpen });

  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const titleId = "template-edit-dialog-title";
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleOverlayClick}
    >
      <div ref={containerRef} className="bg-white dark:bg-slate-800 rounded-lg sm:rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-700 max-h-[90dvh] flex flex-col">
        {/* 标题区 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b dark:border-slate-700">
          <h3
            id={titleId}
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {editing
              ? t("notes.templates.dialog.editTitle")
              : t("notes.templates.dialog.createTitle")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={t("notes.templates.actions.cancel")}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* 表单区 */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto">
          {/* 模板名称 */}
          <div className="mb-4">
            <label
              htmlFor="template-name-input"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              {t("notes.templates.fields.name")}
            </label>
            <input
              id="template-name-input"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("notes.templates.fields.namePlaceholder")}
              className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* 模板正文 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="template-content-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("notes.templates.fields.content")}
              </label>
              {/* 变量占位提示:右侧小标签 + 鼠标悬浮 popover */}
              <VariableHint />
            </div>
            <textarea
              id="template-content-input"
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={t("notes.templates.fields.contentPlaceholder")}
              rows={12}
              className="w-full bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm text-gray-800 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors font-mono resize-y min-h-[200px]"
            />
          </div>
        </div>

        {/* 底部操作区 */}
        <div className="bg-gray-50 dark:bg-slate-900/50 px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end border-t dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-700 rounded-lg sm:rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 min-h-[44px] font-medium"
          >
            {t("notes.templates.actions.cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !name.trim()}
            className="flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-2 bg-primary-600 text-white rounded-lg sm:rounded-md hover:bg-primary-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-slate-600 disabled:text-gray-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed min-h-[44px] font-medium flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {t("notes.templates.actions.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 变量 → i18n key 后缀映射,避免在 JSX 中嵌套三元运算符。
 */
const VARIABLE_LABEL_SUFFIX = {
  date: "varDate",
  today_reviewed_cards: "varReviewedCards",
  today_completed_tasks: "varCompletedTasks",
  today_focus_time: "varFocusTime",
} as const satisfies Record<(typeof TEMPLATE_VARIABLES)[number], string>;

/**
 * 变量占位提示:小标签 + 鼠标悬浮显示变量列表 popover。
 *
 * 使用纯 CSS group-hover 实现,避免引入额外 popover 库。
 */
const VariableHint = () => {
  const { t } = useTranslation();
  return (
    <div className="relative group">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label={t("notes.templates.hints.variables")}
      >
        <Variable size={12} aria-hidden="true" />
        <span>{t("notes.templates.hints.variables")}</span>
      </button>
      {/* 浮层:group-hover 时显示 */}
      <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-md shadow-lg p-3 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
        <ul className="space-y-1 text-xs">
          {TEMPLATE_VARIABLES.map((varName) => (
            <li
              key={varName}
              className="flex items-start gap-2 text-gray-600 dark:text-gray-300"
            >
              <code className="text-primary-600 dark:text-primary-400 font-mono">
                {`{{${varName}}}`}
              </code>
              <span>{t(`notes.templates.hints.${VARIABLE_LABEL_SUFFIX[varName]}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const TemplatesSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div
        key={i}
        className="bg-white dark:bg-slate-800 p-5 rounded-lg border border-gray-100 dark:border-slate-700"
      >
        <Skeleton className="h-4 w-1/3 mb-3" />
        <Skeleton className="h-20 w-full" />
      </div>
    ))}
  </div>
);

export default TemplatesPage;
