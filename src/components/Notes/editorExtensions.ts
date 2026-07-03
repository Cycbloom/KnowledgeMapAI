/**
 * TipTap 扩展配置：组装 BlockEditor 所需的全部扩展。
 *
 * 包含的块类型（PRD M2.1）：
 * - 段落 / H1-H3 / 无序列表 / 有序列表 / 待办列表 / 引用 / 代码块 / 分割线
 *   （以上来自 StarterKit 与 TaskList/TaskItem）
 * - 图片 / 表格 / wiki 链接（Link 承载）
 *
 * Markdown 双向转换由 tiptap-markdown 的 Markdown 扩展负责；
 * wiki 链接的 `[[节点名]]` <-> `[节点名](wiki://节点名)` 转换在 markdownSerializer.ts 中处理。
 *
 * 撤销/重做由 StarterKit 内置的 UndoRedo 扩展提供（Ctrl+Z / Ctrl+Shift+Z）。
 */
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Markdown } from "tiptap-markdown";
import type { Extensions } from "@tiptap/core";
import { WIKI_LINK_PROTOCOL } from "./markdownSerializer";

/**
 * 构建 BlockEditor 的扩展列表。
 * @param placeholder 空内容占位提示文案
 */
export const buildEditorExtensions = (placeholder: string): Extensions => [
  // StarterKit 已含 Link，但我们需要自定义 Link（wiki 协议 + 不点击跳转），故关闭内置 Link
  StarterKit.configure({
    link: false,
    // 历史记录（撤销重做）保持开启
    undoRedo: {},
    heading: { levels: [1, 2, 3] },
  }),
  // wiki 链接：用 Link 节点承载 wiki:// 协议；编辑模式下不点击跳转，由外层处理导航
  Link.configure({
    openOnClick: false,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: {
      class: "wiki-link",
      // 标记 wiki 链接，便于点击事件识别
      "data-wiki": "true",
    },
    // 仅允许 wiki:// 协议与常规 http(s) 链接
    protocols: ["https", "http", WIKI_LINK_PROTOCOL.slice(0, -2)],
  }),
  Placeholder.configure({
    placeholder,
    emptyEditorClass: "is-editor-empty",
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Image.configure({ inline: false, allowBase64: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Markdown.configure({
    html: false,
    tightLists: true,
    linkify: false,
    breaks: false,
    transformPastedText: true,
    transformCopiedText: true,
  }),
];
