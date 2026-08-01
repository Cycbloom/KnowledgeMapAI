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
import {
  useUpdateNoteMutation,
  useUploadNoteImageMutation,
  useWritingAssistMutation,
  useRefreshDailyAggregationMutation,
} from "@/hooks/mutations";
import { useNoteWordCount, useAutoSave } from "@/hooks";
import { message } from "@/utils/messageHelper";
import type { NoteType, WritingAssistAction } from "@shared/types/note";
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
import { WritingAssistPopover } from "./WritingAssistPopover";
import { BlockRefPopover } from "./BlockRefPopover";
import { extractBlockId, generateBlockId } from "@shared/utils/blockRef";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

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
  const writingAssistMutation = useWritingAssistMutation();
  const refreshAggregationMutation = useRefreshDailyAggregationMutation();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  // 当前 Markdown 内容（由编辑器 onUpdate 同步），供 useAutoSave 监听变化
  const [editorMarkdown, setEditorMarkdown] = useState<string>(initialContent);
  const [moveAvailability, setMoveAvailability] = useState({ up: false, down: false });
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // —— 保存状态自动淡出：saved → idle（2 秒后） ——
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const timer = setTimeout(() => setSaveStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  // P2 Task 7:选区跟踪(仅 hasSelection,用于工具栏按钮启用/禁用)
  const [hasSelection, setHasSelection] = useState(false);

  // P2 Task 7:写作辅助浮层状态(action 用于采纳时决定插入/替换策略)
  const [writingAssistState, setWritingAssistState] = useState<{
    action: WritingAssistAction;
    suggestion: string;
    isLoading: boolean;
    error?: string;
    anchorRect: DOMRect;
  } | null>(null);

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

  // P3 Task 8.2: 块引用补全浮层状态(null 表示关闭)
  // mode: 'ref' 对应 ((, 'embed' 对应 !((
  const [blockRefPopover, setBlockRefPopover] = useState<{
    mode: "ref" | "embed";
    anchorRect: DOMRect;
  } | null>(null);

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

  // 扩展配置（含占位文案）
  const extensions = useMemo(
    () => buildEditorExtensions(t("notes.blockEditor.placeholder")),
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

  // 字数与阅读时长（Task 6：底部状态栏展示）
  const { wordCount, readingMinutes } = useNoteWordCount(editor);

  // 同步 noteId 切换时的内容（不在每次 initialContent 变化时重置，避免覆盖用户编辑）
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    isSettingContentRef.current = true;
    editor.commands.setContent(markdownToTiptap(initialContent), {
      emitUpdate: false,
    });
    isSettingContentRef.current = false;
    lastSavedContentRef.current = initialContent;
    setEditorMarkdown(initialContent);
    resetAutoSave();
    setSaveStatus("saved");
    // 仅依赖 noteId，不依赖 initialContent（避免父组件 re-render 重置内容）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, editor]);

  // P3 Task 9: 将当前 noteId 写入 BlockEmbed 扩展的 storage,
  // 供 BlockEmbedNodeView 在节点 noteId 属性为 null(页面重载后)时回退使用。
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const storage = editor.storage as unknown as {
      blockEmbed: { currentNoteId: string | undefined };
    };
    storage.blockEmbed.currentNoteId = noteId;
  }, [editor, noteId]);

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

  // 自动保存：useAutoSave 监听 editorMarkdown 变化，3 秒防抖后调用 save。
  // 立即保存（失焦/写作辅助/块引用）通过 resetAutoSave 取消挂起的防抖定时器，
  // 再直接调用 save(readMarkdown(editor)) 完成。
  const { reset: resetAutoSave } = useAutoSave<string>({
    value: editorMarkdown,
    onSave: save,
    delay: 3000,
    enabled: autoSave,
  });

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
        // viewport 边界 clamp：避免菜单溢出右侧/底部
        const MENU_WIDTH = 280;
        const MENU_HEIGHT = 320;
        const MARGIN = 8;
        const left = Math.max(
          MARGIN,
          Math.min(coords.left, window.innerWidth - MENU_WIDTH - MARGIN),
        );
        const top =
          coords.bottom + 4 + MENU_HEIGHT > window.innerHeight
            ? coords.top - MENU_HEIGHT - 4 // 翻转到上方
            : coords.bottom + 4;
        setSlashMenu({
          open: true,
          query: match[1],
          selectedIndex: 0,
          position: { top, left },
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

  // —— P3 Task 8.2: 块引用补全检测 ——
  // 检测光标前文本是否以 `((`(ref)或 `!((`(embed)结尾,唤起 BlockRefPopover。
  // BlockRefPopover 自带输入框(查询在浮层内输入,不依赖编辑器文本),
  // 故此处只检测触发字符,不捕获查询文本(与 WikiLinkPopover 不同)。
  const closeBlockRefPopover = useCallback(() => {
    setBlockRefPopover((prev) => (prev ? null : prev));
  }, []);

  const detectBlockRef = useCallback(
    (ed: Editor) => {
      const { selection } = ed.state;
      const $from = selection.$from;
      if (!$from.parent.isTextblock) {
        closeBlockRefPopover();
        return;
      }
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
      // Embed 模式: 文本以 `!((` 结尾
      if (/!\(\($/.test(textBefore)) {
        const coords = ed.view.coordsAtPos(selection.from);
        setBlockRefPopover({
          mode: "embed",
          anchorRect: new DOMRect(
            coords.left,
            coords.top,
            coords.right - coords.left,
            coords.bottom - coords.top,
          ),
        });
        return;
      }
      // Ref 模式: 文本以 `((` 结尾,且前一字符不是 `!`(否则为 embed 模式)
      if (textBefore.endsWith("((")) {
        const thirdToLast =
          textBefore.length >= 3 ? textBefore[textBefore.length - 3] : "";
        if (thirdToLast !== "!") {
          const coords = ed.view.coordsAtPos(selection.from);
          setBlockRefPopover({
            mode: "ref",
            anchorRect: new DOMRect(
              coords.left,
              coords.top,
              coords.right - coords.left,
              coords.bottom - coords.top,
            ),
          });
          return;
        }
      }
      closeBlockRefPopover();
    },
    [closeBlockRefPopover],
  );

  // —— P3 Task 8.2: 块引用/块嵌入插入(popover 选中后) ——
  // 删除触发字符 `((` / `!((`,插入 BlockReference / BlockEmbed 节点。
  // 重新检查触发字符(防止 popover 打开期间用户继续输入导致状态不一致)。
  // P3 Task 9: embed 模式同时传入源笔记 noteId,供 BlockEmbedNodeView 拉取块内容。
  const handleBlockRefSelect = useCallback(
    (blockId: string, noteId: string) => {
      if (!editor || !blockRefPopover) {
        closeBlockRefPopover();
        return;
      }
      const { selection } = editor.state;
      const $from = selection.$from;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      if (blockRefPopover.mode === "embed") {
        // Embed: 文本应以 `!((` 结尾
        if (!/!\(\($/.test(textBefore)) {
          closeBlockRefPopover();
          return;
        }
        const startPos = $from.pos - 3; // `!((` 为 3 字符
        editor
          .chain()
          .focus()
          .deleteRange({ from: startPos, to: selection.to })
          .insertBlockEmbed(blockId, noteId)
          .run();
      } else {
        // Ref: 文本应以 `((` 结尾,且前一字符不是 `!`
        if (!textBefore.endsWith("((")) {
          closeBlockRefPopover();
          return;
        }
        const thirdToLast =
          textBefore.length >= 3 ? textBefore[textBefore.length - 3] : "";
        if (thirdToLast === "!") {
          closeBlockRefPopover();
          return;
        }
        const startPos = $from.pos - 2; // `((` 为 2 字符
        editor
          .chain()
          .focus()
          .deleteRange({ from: startPos, to: selection.to })
          .insertBlockReference(blockId)
          .run();
      }
      closeBlockRefPopover();
    },
    [editor, blockRefPopover, closeBlockRefPopover],
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
      detectBlockRef(editor);
      setEditorMarkdown(markdown);
      // 更新块移动可用性
      setMoveAvailability(canMoveBlock(editor));
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor, onUpdate, detectSlashCommand, detectWikiLink, detectBlockRef, setEditorMarkdown]);

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
    resetAutoSave();
    const markdown = readMarkdown(editor);
    void save(markdown);
  }, [editor, save, resetAutoSave]);

  // 监听编辑器失焦（focusout 冒泡，覆盖工具栏外的编辑区域）
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onFocusOut = () => handleBlur();
    dom.addEventListener("focusout", onFocusOut);
    return () => dom.removeEventListener("focusout", onFocusOut);
  }, [editor, handleBlur]);

  // —— P2 Task 7:选区跟踪(仅 hasSelection,用于工具栏按钮启用/禁用) ——
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const next = !editor.state.selection.empty;
      setHasSelection((prev) => (prev === next ? prev : next));
    };
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  // —— P2 Task 7:写作辅助(续写/改写/扩写) ——
  // 计算 selection.to 处的锚点坐标,供 popover 定位。
  const computeAnchorRect = useCallback(
    (ed: Editor): DOMRect => {
      const sel = ed.state.selection;
      const coords = ed.view.coordsAtPos(sel.to);
      return new DOMRect(
        coords.left,
        coords.top,
        coords.right - coords.left,
        coords.bottom - coords.top,
      );
    },
    [],
  );

  // 触发写作辅助:从 editor.state 读取选区文本与上下文,调用 mutation,成功后显示 popover。
  const handleWritingAssist = useCallback(
    async (action: WritingAssistAction) => {
      if (!editor) return;
      const sel = editor.state.selection;
      if (sel.empty) return;

      const docSize = editor.state.doc.content.size;
      const selectedText = editor.state.doc.textBetween(
        sel.from,
        sel.to,
        "\n",
      );
      const contextBefore = editor.state.doc.textBetween(
        Math.max(0, sel.from - 200),
        sel.from,
        "\n",
      );
      const contextAfter = editor.state.doc.textBetween(
        sel.to,
        Math.min(docSize, sel.to + 200),
        "\n",
      );

      const anchorRect = computeAnchorRect(editor);
      setWritingAssistState({
        action,
        suggestion: "",
        isLoading: true,
        anchorRect,
      });

      try {
        const res = await writingAssistMutation.mutateAsync({
          noteId,
          data: {
            noteId,
            action,
            selectedText,
            contextBefore,
            contextAfter,
          },
        });
        // 重新计算坐标(防止 loading 期间滚动导致位置偏移)
        const newAnchorRect = computeAnchorRect(editor);
        setWritingAssistState({
          action,
          suggestion: res.suggestion,
          isLoading: false,
          anchorRect: newAnchorRect,
        });
      } catch {
        setWritingAssistState(null);
        message.error(t("notes.writingAssist.error"));
      }
    },
    [editor, noteId, t, writingAssistMutation, computeAnchorRect],
  );

  // 采纳建议:continue→选区后插入;rewrite/expand→替换选区;关闭 popover 并立即保存。
  const handleAcceptWritingAssist = useCallback(() => {
    if (!editor || !writingAssistState) return;
    const { action, suggestion } = writingAssistState;
    const { selection } = editor.state;
    // 用 markdownToTiptap 预处理 wiki 链接/块引用;insertContentAt 走 tiptap-markdown
    // 重写,会将 Markdown 字符串解析为 ProseMirror 节点(标题/列表/加粗等)。
    const content = markdownToTiptap(suggestion);

    if (action === "continue") {
      // 续写:光标定位到选区末尾后插入建议(insertContent 未被 tiptap-markdown 重写,故用 insertContentAt)
      editor
        .chain()
        .focus()
        .setTextSelection(selection.to)
        .insertContentAt(selection.to, content)
        .run();
    } else {
      // 改写/扩写:删除选区并插入建议(deleteSelection 后光标停在 selection.from)
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContentAt(selection.from, content)
        .run();
    }

    setWritingAssistState(null);

    // 采纳即落盘:取消防抖定时器并立即保存
    resetAutoSave();
    const markdown = readMarkdown(editor);
    void save(markdown);
  }, [editor, writingAssistState, save, resetAutoSave]);

  // 放弃建议:仅关闭 popover
  const handleRejectWritingAssist = useCallback(() => {
    setWritingAssistState(null);
  }, []);

  // P2 Task 7:popover 打开时,监听 scroll/resize 关闭浮层(锚点坐标已失效)
  const writingAssistOpen = writingAssistState !== null;
  useEffect(() => {
    if (!writingAssistOpen) return;
    const handleClose = () => setWritingAssistState(null);
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [writingAssistOpen]);

  // —— P2 Task 7:刷新今日数据聚合(daily) ——
  // 调用后端重新渲染"## 今日数据"段并落盘,用返回的 note.content 替换编辑器内容。
  const handleRefreshAggregation = useCallback(async () => {
    if (!editor) return;
    try {
      const res = await refreshAggregationMutation.mutateAsync(noteId);
      isSettingContentRef.current = true;
      editor.commands.setContent(markdownToTiptap(res.note.content), {
        emitUpdate: false,
      });
      isSettingContentRef.current = false;
      lastSavedContentRef.current = res.note.content;
      setEditorMarkdown(res.note.content);
      resetAutoSave();
      setSaveStatus("saved");
      message.success(t("notes.refreshAggregation.success"));
    } catch {
      message.error(t("notes.refreshAggregation.error"));
    }
  }, [editor, noteId, t, refreshAggregationMutation, resetAutoSave]);

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

  // —— P3 Task 8.3/8.4: 块引用操作辅助 ——
  // 确保当前选区所在顶层块有 ^blockId,若无则生成并追加到块尾。
  // 跳过代码块/分割线(这些块的 ^id 追加需特殊处理,不在 Task 8.3/8.4 范围)。
  // 返回 { blockId, isNew },失败返回 null。
  const ensureCurrentBlockId = useCallback(
    (ed: Editor): { blockId: string; isNew: boolean } | null => {
      const { state } = ed;
      const $pos = state.selection.$from;
      if ($pos.depth < 1) return null;
      const blockStart = $pos.before(1);
      const blockNode = state.doc.nodeAt(blockStart);
      if (!blockNode) return null;
      // 跳过代码块/分割线(^id 追加需特殊处理,不在本任务范围)
      const blockType = blockNode.type.name;
      if (blockType === "codeBlock" || blockType === "horizontalRule") {
        return null;
      }
      const blockText = blockNode.textContent;
      const existingId = extractBlockId(blockText);
      if (existingId) return { blockId: existingId, isNew: false };
      // 生成新 ID 并插入到块末尾(闭合标签前)
      // 使用 ProseMirror Transaction.insertText(insertText 在 ChainedCommands 类型上不存在)
      const newId = generateBlockId();
      const insertPos = blockStart + blockNode.nodeSize - 1;
      const tr = ed.state.tr.insertText(`^${newId}`, insertPos);
      ed.view.dispatch(tr);
      return { blockId: newId, isNew: true };
    },
    [],
  );

  // P3 Task 8.3: 复制块引用 —— 复制 ((blockId)) 到剪贴板
  const handleCopyBlockRef = useCallback(async () => {
    if (!editor) return;
    const result = ensureCurrentBlockId(editor);
    if (!result) {
      message.error(t("notes.blockEditor.blockRef.stale"));
      return;
    }
    const { blockId, isNew } = result;
    const refText = `((${blockId}))`;
    try {
      await navigator.clipboard.writeText(refText);
      message.success(t("notes.blockEditor.blockRef.copied"));
    } catch {
      message.error(t("notes.blockEditor.blockRef.stale"));
      return;
    }
    // 若新生成了 blockId,立即保存(取消防抖定时器)
    if (isNew) {
      resetAutoSave();
      const markdown = readMarkdown(editor);
      void save(markdown);
    }
  }, [editor, ensureCurrentBlockId, t, save, resetAutoSave]);

  // P3 Task 8.4: 嵌入此块 —— 在当前光标位置插入 !((blockId)) 块嵌入节点
  const handleEmbedBlock = useCallback(() => {
    if (!editor) return;
    const result = ensureCurrentBlockId(editor);
    if (!result) {
      message.error(t("notes.blockEditor.blockRef.stale"));
      return;
    }
    const { blockId, isNew } = result;
    editor.chain().focus().insertBlockEmbed(blockId).run();
    message.success(t("notes.blockEditor.blockRef.embedded"));
    // 若新生成了 blockId,立即保存
    if (isNew) {
      resetAutoSave();
      const markdown = readMarkdown(editor);
      void save(markdown);
    }
  }, [editor, ensureCurrentBlockId, t, save, resetAutoSave]);

  // —— 保存状态文案 ——
  const saveStatusText = (() => {
    switch (saveStatus) {
      case "saving":
        return t("notes.blockEditor.saveStatus.saving");
      case "saved":
        return t("notes.blockEditor.saveStatus.saved");
      case "error":
        return t("notes.blockEditor.saveStatus.error");
      default:
        return t("notes.blockEditor.saveStatus.idle");
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
    <div className="flex flex-col h-full rounded-xl border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-900 overflow-hidden">
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
        hasSelection={hasSelection}
        onWritingAssist={handleWritingAssist}
        isWritingAssistLoading={writingAssistMutation.isPending}
        onRefreshAggregation={handleRefreshAggregation}
        isRefreshingAggregation={refreshAggregationMutation.isPending}
        onCopyBlockRef={handleCopyBlockRef}
        onEmbedBlock={handleEmbedBlock}
      />

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-slate-500 text-xs">
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
          ) : wordCount > 0 ? (
            <span>
              {t("notes.blockEditor.footer.wordCount", { count: wordCount })}
              {" · "}
              {t("notes.blockEditor.footer.readingTime", { minutes: readingMinutes })}
            </span>
          ) : (
            t("notes.blockEditor.slashHint")
          )}
        </span>
        <span
          className={`${saveStatusColor} inline-flex items-center gap-1 ${saveStatus === "error" ? "cursor-pointer hover:opacity-80" : ""}`}
          role="status"
          aria-label={saveStatusText}
          onClick={saveStatus === "error" ? () => save(readMarkdown(editor)) : undefined}
          title={saveStatus === "error" ? t("notes.blockEditor.saveStatus.clickToRetry") : undefined}
        >
          {saveStatus === "saving" && <Loader2 size={14} className="animate-spin" />}
          {saveStatus === "saved" && <CheckCircle2 size={14} className="text-green-500" />}
          {saveStatus === "error" && <AlertCircle size={14} className="text-red-500" />}
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

      {/* P2 Task 7:写作辅助浮层(仅 writingAssistState 非空时渲染) */}
      {writingAssistState && (
        <WritingAssistPopover
          suggestion={writingAssistState.suggestion}
          isLoading={writingAssistState.isLoading}
          error={writingAssistState.error}
          anchorRect={writingAssistState.anchorRect}
          onAccept={handleAcceptWritingAssist}
          onReject={handleRejectWritingAssist}
        />
      )}

      {/* P3 Task 8.2:块引用补全浮层(仅 blockRefPopover 非空时渲染) */}
      {blockRefPopover && (
        <BlockRefPopover
          anchorRect={blockRefPopover.anchorRect}
          onSelect={handleBlockRefSelect}
          onClose={closeBlockRefPopover}
        />
      )}
    </div>
  );
};
