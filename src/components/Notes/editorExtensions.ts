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
import { BlockReference } from "./extensions/BlockReference";
import { BlockEmbed } from "./extensions/BlockEmbed";

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
  // autolink:false —— wiki 链接通过 [[ 唤起 WikiLinkPopover 显式插入（marks 显式创建），
  // 不依赖 linkifyjs 自动识别；linkifyjs 对含中文的 wiki://节点名 URL 解析会抛
  // "incorrect scheme format" 错误，关闭后避免污染控制台与失效渲染。
  Link.configure({
    openOnClick: false,
    autolink: false,
    linkOnPaste: true,
    HTMLAttributes: {
      class: "wiki-link",
      // 标记 wiki 链接，便于点击事件识别
      "data-wiki": "true",
    },
    // 仅允许 wiki:// 协议与常规 http(s) 链接
    // 注意：linkifyjs 校验 scheme 不允许含冒号，须用 "wiki" 而非 "wiki:"
    protocols: ["https", "http", "wiki"],
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
    // P3: 块引用/块嵌入依赖 HTML 直通——preprocessBlockRefs 会把 ((id)) / !((id))
    // 转为 <span data-block-ref>/<div data-block-embed>,需 html:true 才能被 markdown-it
    // 原样保留并由 ProseMirror DOMParser 按节点 parseHTML 规则解析。
    // 序列化时 BlockReference/BlockEmbed 无 markdownSpec,回退到 HTMLNode 输出 HTML,
    // 再由 tiptapToMarkdownBlockRefs 还原为 ((id)) / !((id))。
    html: true,
    tightLists: true,
    linkify: false,
    breaks: false,
    transformPastedText: true,
    transformCopiedText: true,
  }),
  // P3: 块引用/块嵌入自研节点
  // - BlockReference: inline atom,承载 ((id)) 引用
  // - BlockEmbed: block atom + ReactNodeView,承载 !((id)) 嵌入
  // Markdown 双向转换由 markdownSerializer.ts 的 preprocessBlockRefs /
  // tiptapToMarkdownBlockRefs 在 Markdown 扩展前后处理
  BlockReference,
  BlockEmbed,
];
