/**
 * BlockEditor —— 块编辑器核心组件（Task 7）。
 *
 * 基于 TipTap（ProseMirror）实现，覆盖 PRD M2 的 P0 能力：
 * - 10+ 块类型渲染与编辑（段落/H1-H3/无序/有序/待办/引用/代码块/分割线/图片/表格）
 * - 斜杠命令 `/` 唤起块菜单（SubTask 7.3）
 * - Markdown 快捷输入（行首 #/-/> 等，由 StarterKit inputRule 提供，SubTask 7.4）
 * - wiki 链接 `[[` 自动补全（SubTask 7.5）
 * - 块上下移动（SubTask 7.6 降级方案：替代拖拽）
 * - 自动保存（失焦 + 3 秒 debounce）与撤销/重做（SubTask 7.7）
 * - 暗色模式全覆盖（SubTask 7.8）
 * - wiki 链接 Markdown 序列化为 `[[节点名]]`，可被 wikiLinkRemarkPlugin 解析（SubTask 7.9）
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { EditorView } from "prosemirror-view";
import { TextSelection } from "prosemirror-state";
import { useTranslation } from "react-i18next";
import { useUpdateNoteMutation, useUploadNoteImageMutation } from "@/hooks/mutations";
import { message } from "@/utils/messageHelper";
import type { NoteType } from "@shared/types/note";
import { buildEditorExtensions } from "./editorExtensions";
import {
  markdownToTiptap,
  tiptapToMarkdown,
  buildWikiLinkHref,
} from "./markdownSerializer";
import {
  filterBlockTypes,
  type BlockType,
} from "./blockTypes";
import { SlashCommandMenu } from "./SlashCommandMenu";
import {
  WikiLinkPopover,
  useNodeTitles,
  filterNodeTitles,
  type WikiLinkNodeItem,
} from "./WikiLinkPopover";
import { BlockEditorToolbar } from "./BlockEditorToolbar";
import { canMoveBlock, moveBlock } from "./blockMovement";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface BlockEditorProps {
  /** 笔记 ID（自动保存时调用 notesApi.update） */
  noteId: string;
  /** 初始 Markdown 内容（仅在 noteId 变化时同步进编辑器，避免重置用户编辑） */
  initialContent: string;
  /** 笔记类型，工具栏据此显示"生成今日总结"按钮（仅 daily） */
  noteType: NoteType;
  /** 内容变更回调（仅用户编辑触发，程序化 setContent 不触发） */
  onUpdate?: (markdown: string) => void;
  /** wiki 链接点击跳转回调；不传则编辑器内点击不跳转 */
  onWikiLinkNavigate?: (nodeTitle: string) => void;
  /** 自动保存开关，默认开启 */
  autoSave?: boolean;
}

/** 从编辑器读取 Markdown 并将 wiki 链接还原为 `[[节点名]]`。 */
const readMarkdown = (editor: Editor | null): string => {
  if (!editor) return "";
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  const raw = storage.markdown?.getMarkdown?.() ?? "";
  return tiptapToMarkdown(raw);
};

interface SlashMenu {
  open: boolean;
  query: string;
  selectedIndex: number;
  position: { top: number; left: number };
}

interface WikiPopover {
  open: boolean;
  query: string;
  selectedIndex: number;
  position: { top: number; left: number };
}

/** 自动保存防抖时长（ms）。 */
const AUTOSAVE_DEBOUNCE_MS = 3000;

export const BlockEditor: React.FC<BlockEditorProps> = ({
  noteId,
  initialContent,
  noteType,
  onUpdate,
  onWikiLinkNavigate,
  autoSave = true,
}) => {
  const { t } = useTranslation();
  const updateMutation = useUpdateNoteMutation();
  const uploadImageMutation = useUploadNoteImageMutation();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [moveAvailability, setMoveAvailability] = useState({ up: false, down: false });
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // 斜杠命令菜单状态
  const [slashMenu, setSlashMenu] = useState<SlashMenu>({
    open: false,
    query: "",
    selectedIndex: 0,
    position: { top: 0, left: 0 },
  });

  // wiki 链接补全状态
  const [wikiPopover, setWikiPopover] = useState<WikiPopover>({
    open: false,
    query: "",
    selectedIndex: 0,
    position: { top: 0, left: 0 },
  });

  // 知识点标题列表（懒加载）
  const nodeTitlesQuery = useNodeTitles();

  // 用于 handleKeyDown 读取最新菜单状态（editorProps 在 editor 创建时绑定一次）
  const keydownHandlerRef = useRef<
    ((event: KeyboardEvent) => boolean) | null
  >(null);

  // 用于 handlePaste / handleDrop 读取最新上传逻辑（同样因 editorProps 一次性绑定）
  const pasteDropHandlerRef = useRef<
    | ((
        view: EditorView,
        kind: "paste" | "drop",
        event: ClipboardEvent | DragEvent,
      ) => boolean)
    | null
  >(null);

  // 标记程序化 setContent，避免触发 onUpdate / 自动保存
  const isSettingContentRef = useRef(false);
  // 上次成功保存的内容，用于跳过无变更保存
  const lastSavedContentRef = useRef<string>(initialContent);
  // 自动保存定时器
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 扩展配置（含占位文案）
  const extensions = useMemo(
    () => buildEditorExtensions(t("notes.editor.placeholder")),
    [t],
  );

  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate dark:prose-invert max-w-none min-h-[200px] px-4 py-3 focus:outline-none",
      },
      // 委托给 ref 以读取最新菜单状态
      handleKeyDown: (_view, event) =>
        keydownHandlerRef.current?.(event) ?? false,
      // wiki 链接点击跳转
      handleClick: (_view, _pos, event) => {
        if (!onWikiLinkNavigate) return false;
        const target = event.target as HTMLElement | null;
        const linkEl = target?.closest("a[data-wiki]") as HTMLAnchorElement | null;
        if (!linkEl) return false;
        const href = linkEl.getAttribute("href") ?? "";
        if (href.startsWith("wiki://")) {
          onWikiLinkNavigate(href.slice("wiki://".length));
          return true;
        }
        return false;
      },
      // 图片粘贴上传（Task 9.1）：委托给 ref 读取最新上传逻辑
      handlePaste: (view, event) =>
        pasteDropHandlerRef.current?.(view, "paste", event) ?? false,
      // 图片拖拽上传（Task 9.1）：drop 时先定位光标到落点，再走同一上传逻辑
      handleDrop: (view, event) =>
        pasteDropHandlerRef.current?.(view, "drop", event) ?? false,
    },
    // 初始内容（Markdown 串，由 tiptap-markdown 扩展解析）
    content: markdownToTiptap(initialContent),
  });

  // 同步 noteId 切换时的内容（不在每次 initialContent 变化时重置，避免覆盖用户编辑）
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    isSettingContentRef.current = true;
    editor.commands.setContent(markdownToTiptap(initialContent), {
      emitUpdate: false,
    });
    isSettingContentRef.current = false;
    lastSavedContentRef.current = initialContent;
    setSaveStatus("saved");
    // 仅依赖 noteId，不依赖 initialContent（避免父组件 re-render 重置内容）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);

  // —— 保存逻辑 ——
  const save = useCallback(
    async (markdown: string) => {
      if (!autoSave) return;
      if (markdown === lastSavedContentRef.current) return;
      setSaveStatus("saving");
      try {
        await updateMutation.mutateAsync({
          id: noteId,
          data: { content: markdown },
        });
        lastSavedContentRef.current = markdown;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [autoSave, noteId, updateMutation],
  );

  const scheduleSave = useCallback(
    (markdown: string) => {
      if (!autoSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void save(markdown);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [autoSave, save],
  );

  // —— 图片上传与插入（Task 9） ——
  // 上传文件并在当前光标处插入 image 节点；按钮/粘贴/拖拽共用此函数。
  const uploadAndInsertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      if (!file.type.startsWith("image/")) {
        message.error(t("notes.image.notImage"));
        return;
      }
      setIsUploadingImage(true);
      try {
        const res = await uploadImageMutation.mutateAsync({
          noteId,
          file,
        });
        editor.chain().focus().setImage({ src: res.url }).run();
        message.success(t("notes.image.uploadSuccess"));
      } catch {
        message.error(t("notes.image.uploadError"));
      } finally {
        setIsUploadingImage(false);
      }
    },
    [editor, noteId, t, uploadImageMutation],
  );

  // 同步 paste/drop 处理函数到 ref（editorProps 一次性绑定，需通过 ref 读取最新闭包）
  useEffect(() => {
    pasteDropHandlerRef.current = (
      view: EditorView,
      kind: "paste" | "drop",
      event: ClipboardEvent | DragEvent,
    ): boolean => {
      const files =
        kind === "paste"
          ? (event as ClipboardEvent).clipboardData?.files
          : (event as DragEvent).dataTransfer?.files;
      if (!files || files.length === 0) return false;
      const imageFile = Array.from(files).find(
        (f: File) => f.type.startsWith("image/"),
      );
      if (!imageFile) return false;
      event.preventDefault();
      // 拖拽时先把光标定位到落点，使插入位置与视觉一致
      if (kind === "drop") {
        const dragEvent = event as DragEvent;
        const dropPos = view.posAtCoords({
          left: dragEvent.clientX,
          top: dragEvent.clientY,
        });
        if (dropPos) {
          const tr = view.state.tr.setSelection(
            TextSelection.create(view.state.doc, dropPos.pos),
          );
          view.dispatch(tr);
        }
      }
      void uploadAndInsertImage(imageFile);
      return true;
    };
  }, [uploadAndInsertImage]);

  // 卸载时清定时器
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // —— 斜杠命令检测 ——
  const closeSlashMenu = useCallback(() => {
    setSlashMenu((s) => (s.open ? { ...s, open: false } : s));
  }, []);

  const detectSlashCommand = useCallback(
    (ed: Editor) => {
      const { selection } = ed.state;
      const $from = selection.$from;
      // 仅在顶层段落/标题中触发，避免代码块/列表项冲突
      const parentType = $from.parent.type.name;
      if ($from.depth !== 1 || (parentType !== "paragraph" && parentType !== "heading")) {
        closeSlashMenu();
        return;
      }
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      // 行首 / 后跟可选查询（无空格），且光标在末尾
      const match = textBefore.match(/^\/([^\s/]*)$/);
      if (match) {
        const coords = ed.view.coordsAtPos(selection.from);
        setSlashMenu({
          open: true,
          query: match[1],
          selectedIndex: 0,
          position: { top: coords.bottom + 4, left: coords.left },
        });
      } else {
        closeSlashMenu();
      }
    },
    [closeSlashMenu],
  );

  // —— wiki 链接补全检测 ——
  const closeWikiPopover = useCallback(() => {
    setWikiPopover((w) => (w.open ? { ...w, open: false } : w));
  }, []);

  const detectWikiLink = useCallback(
    (ed: Editor) => {
      const { selection } = ed.state;
      const $from = selection.$from;
      if (!$from.parent.isTextblock) {
        closeWikiPopover();
        return;
      }
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      // 未闭合的 [[query（不含 ] 与换行）
      const match = textBefore.match(/\[\[([^\]\n]*)$/);
      if (match) {
        const coords = ed.view.coordsAtPos(selection.from);
        setWikiPopover({
          open: true,
          query: match[1],
          selectedIndex: 0,
          position: { top: coords.bottom + 4, left: coords.left },
        });
        // 首次打开时拉取节点标题
        if (!nodeTitlesQuery.data && !nodeTitlesQuery.isLoading) {
          void nodeTitlesQuery.refetch();
        }
      } else {
        closeWikiPopover();
      }
    },
    [closeWikiPopover, nodeTitlesQuery],
  );

  // —— 应用块类型（斜杠菜单选中） ——
  const applyBlock = useCallback(
    (block: BlockType) => {
      if (!editor) return;
      const { selection } = editor.state;
      const $from = selection.$from;
      // 删除行首的 /query 文本（从段落到光标）
      const rangeStart = $from.start();
      editor
        .chain()
        .focus()
        .deleteRange({ from: rangeStart, to: selection.to })
        .run();
      block.apply(editor);
      closeSlashMenu();
    },
    [editor, closeSlashMenu],
  );

  // —— 插入 wiki 链接（popover 选中） ——
  const insertWikiLink = useCallback(
    (item: WikiLinkNodeItem) => {
      if (!editor) return;
      const { selection } = editor.state;
      const $from = selection.$from;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      const match = textBefore.match(/\[\[([^\]\n]*)$/);
      if (!match) {
        closeWikiPopover();
        return;
      }
      const bracketStart = $from.pos - match[0].length;
      const href = buildWikiLinkHref(item.title);
      editor
        .chain()
        .focus()
        .deleteRange({ from: bracketStart, to: selection.to })
        .insertContent([
          {
            type: "text",
            text: item.title,
            marks: [{ type: "link", attrs: { href } }],
          },
          { type: "text", text: " " },
        ])
        .run();
      closeWikiPopover();
    },
    [editor, closeWikiPopover],
  );

  // —— onUpdate：检测菜单 + 触发自动保存 ——
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (isSettingContentRef.current) return;
      const markdown = readMarkdown(editor);
      onUpdate?.(markdown);
      detectSlashCommand(editor);
      detectWikiLink(editor);
      scheduleSave(markdown);
      // 更新块移动可用性
      setMoveAvailability(canMoveBlock(editor));
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, onUpdate, detectSlashCommand, detectWikiLink, scheduleSave]);

  // —— 键盘导航（菜单打开时拦截 Arrow/Enter/Esc） ——
  // 斜杠菜单过滤后的项
  const slashItems = useMemo(
    () => filterBlockTypes(slashMenu.query, (key) => t(key)),
    [slashMenu.query, t],
  );

  // wiki 链接过滤后的项
  const wikiItems = useMemo(
    () =>
      filterNodeTitles(nodeTitlesQuery.data ?? [], wikiPopover.query),
    [nodeTitlesQuery.data, wikiPopover.query],
  );

  // 保持选中索引在范围内
  useEffect(() => {
    setSlashMenu((s) =>
      s.selectedIndex >= slashItems.length
        ? { ...s, selectedIndex: Math.max(0, slashItems.length - 1) }
        : s,
    );
  }, [slashItems.length]);

  useEffect(() => {
    setWikiPopover((w) =>
      w.selectedIndex >= wikiItems.length
        ? { ...w, selectedIndex: Math.max(0, wikiItems.length - 1) }
        : w,
    );
  }, [wikiItems.length]);

  // 键盘处理器（每次菜单状态变化更新）
  useEffect(() => {
    keydownHandlerRef.current = (event: KeyboardEvent): boolean => {
      const slashOpen = slashMenu.open && slashItems.length > 0;
      const wikiOpen = wikiPopover.open && wikiItems.length > 0;

      if (!slashOpen && !wikiOpen) return false;

      const key = event.key;
      if (key === "ArrowDown") {
        event.preventDefault();
        if (slashOpen) {
          setSlashMenu((s) => ({
            ...s,
            selectedIndex: (s.selectedIndex + 1) % slashItems.length,
          }));
        } else if (wikiOpen) {
          setWikiPopover((w) => ({
            ...w,
            selectedIndex: (w.selectedIndex + 1) % wikiItems.length,
          }));
        }
        return true;
      }
      if (key === "ArrowUp") {
        event.preventDefault();
        if (slashOpen) {
          setSlashMenu((s) => ({
            ...s,
            selectedIndex:
              (s.selectedIndex - 1 + slashItems.length) % slashItems.length,
          }));
        } else if (wikiOpen) {
          setWikiPopover((w) => ({
            ...w,
            selectedIndex:
              (w.selectedIndex - 1 + wikiItems.length) % wikiItems.length,
          }));
        }
        return true;
      }
      if (key === "Enter" || key === "Tab") {
        event.preventDefault();
        if (slashOpen) {
          const item = slashItems[slashMenu.selectedIndex];
          if (item) applyBlock(item);
        } else if (wikiOpen) {
          const item = wikiItems[wikiPopover.selectedIndex];
          if (item) insertWikiLink(item);
        }
        return true;
      }
      if (key === "Escape") {
        event.preventDefault();
        closeSlashMenu();
        closeWikiPopover();
        return true;
      }
      return false;
    };
  }, [
    slashMenu,
    wikiPopover,
    slashItems,
    wikiItems,
    applyBlock,
    insertWikiLink,
    closeSlashMenu,
    closeWikiPopover,
  ]);

  // —— 失焦立即保存 ——
  const handleBlur = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const markdown = readMarkdown(editor);
    void save(markdown);
  }, [editor, save]);

  // 监听编辑器失焦（focusout 冒泡，覆盖工具栏外的编辑区域）
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onFocusOut = () => handleBlur();
    dom.addEventListener("focusout", onFocusOut);
    return () => dom.removeEventListener("focusout", onFocusOut);
  }, [editor, handleBlur]);

  // —— 块移动 ——
  const handleMoveUp = useCallback(() => {
    if (editor) {
      moveBlock(editor, "up");
      setMoveAvailability(canMoveBlock(editor));
    }
  }, [editor]);

  const handleMoveDown = useCallback(() => {
    if (editor) {
      moveBlock(editor, "down");
      setMoveAvailability(canMoveBlock(editor));
    }
  }, [editor]);

  // —— 保存状态文案 ——
  const saveStatusText = (() => {
    switch (saveStatus) {
      case "saving":
        return t("notes.editor.saveStatus.saving");
      case "saved":
        return t("notes.editor.saveStatus.saved");
      case "error":
        return t("notes.editor.saveStatus.error");
      default:
        return t("notes.editor.saveStatus.idle");
    }
  })();

  const saveStatusColor =
    saveStatus === "error"
      ? "text-red-500 dark:text-red-400"
      : saveStatus === "saving"
        ? "text-amber-500 dark:text-amber-400"
        : saveStatus === "saved"
          ? "text-gray-400 dark:text-slate-500"
          : "text-gray-400 dark:text-slate-500";

  return (
    <div className="flex flex-col h-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <BlockEditorToolbar
        editor={editor}
        onMoveBlockUp={handleMoveUp}
        onMoveBlockDown={handleMoveDown}
        canMoveUp={moveAvailability.up}
        canMoveDown={moveAvailability.down}
        noteId={noteId}
        noteType={noteType}
        onInsertImage={uploadAndInsertImage}
        isUploadingImage={isUploadingImage}
      />

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-slate-700 text-xs">
        <span className="text-gray-400 dark:text-slate-500">
          {isUploadingImage ? (
            <span
              className="inline-flex items-center gap-1 text-amber-500 dark:text-amber-400"
              role="status"
              aria-live="polite"
            >
              <span
                className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
              {t("notes.image.uploading")}
            </span>
          ) : (
            t("notes.editor.slashHint")
          )}
        </span>
        <span className={saveStatusColor} role="status">
          {saveStatusText}
        </span>
      </div>

      <SlashCommandMenu
        open={slashMenu.open && slashItems.length > 0}
        items={slashItems}
        selectedIndex={slashMenu.selectedIndex}
        position={slashMenu.position}
        onHoverIndex={(index) =>
          setSlashMenu((s) => ({ ...s, selectedIndex: index }))
        }
        onSelect={applyBlock}
      />

      <WikiLinkPopover
        open={wikiPopover.open}
        items={wikiItems}
        selectedIndex={wikiPopover.selectedIndex}
        loading={nodeTitlesQuery.isLoading && wikiPopover.open}
        position={wikiPopover.position}
        onHoverIndex={(index) =>
          setWikiPopover((w) => ({ ...w, selectedIndex: index }))
        }
        onSelect={insertWikiLink}
      />
    </div>
  );
};
