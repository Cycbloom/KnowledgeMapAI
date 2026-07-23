/**
 * 块类型定义：斜杠命令菜单与工具栏共用的块类型清单。
 * 覆盖 PRD M2.1 的 10 种块类型 + 表格 + 图片。
 */
import {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Image as ImageIcon,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";
import type { Editor } from "@tiptap/core";

export type BlockTypeId =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "divider"
  | "image"
  | "table";

const BLOCK_LABEL_KEYS = [
  "notes.editor.blockMenu.paragraph",
  "notes.editor.blockMenu.heading1",
  "notes.editor.blockMenu.heading2",
  "notes.editor.blockMenu.heading3",
  "notes.editor.blockMenu.bulletList",
  "notes.editor.blockMenu.orderedList",
  "notes.editor.blockMenu.taskList",
  "notes.editor.blockMenu.blockquote",
  "notes.editor.blockMenu.codeBlock",
  "notes.editor.blockMenu.divider",
  "notes.editor.blockMenu.image",
  "notes.editor.blockMenu.table",
] as const;

export type BlockLabelKey = (typeof BLOCK_LABEL_KEYS)[number];

export interface BlockType {
  id: BlockTypeId;
  /** i18n key，对应 notes.editor.blockMenu.* */
  labelKey: BlockLabelKey;
  icon: LucideIcon;
  /** 调用对应 TipTap 命令插入块。返回 false 表示命令不可用。 */
  apply: (editor: Editor) => void;
  /** 关键词，用于斜杠菜单过滤 */
  keywords: string[];
}

/**
 * 在当前选区插入一个 2 行 2 列的初始表格。
 * TipTap Table 扩展提供 insertTable 命令。
 */
const insertTable = (editor: Editor): void => {
  editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
};

/**
 * 触发图片插入：插入空图片节点。
 * 完整的图片上传 UX（本地/对象存储）属 PRD P1 范围，此处仅保证块类型可插入。
 */
const insertImagePlaceholder = (editor: Editor): void => {
  editor.chain().focus().setImage({ src: "", alt: "" }).run();
};

export const BLOCK_TYPES: readonly BlockType[] = [
  {
    id: "paragraph",
    labelKey: "notes.editor.blockMenu.paragraph",
    icon: Pilcrow,
    apply: (editor) => editor.chain().focus().setParagraph().run(),
    keywords: ["text", "段落", "paragraph", "p"],
  },
  {
    id: "heading1",
    labelKey: "notes.editor.blockMenu.heading1",
    icon: Heading1,
    apply: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    keywords: ["h1", "标题", "heading"],
  },
  {
    id: "heading2",
    labelKey: "notes.editor.blockMenu.heading2",
    icon: Heading2,
    apply: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    keywords: ["h2", "标题", "heading"],
  },
  {
    id: "heading3",
    labelKey: "notes.editor.blockMenu.heading3",
    icon: Heading3,
    apply: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    keywords: ["h3", "标题", "heading"],
  },
  {
    id: "bulletList",
    labelKey: "notes.editor.blockMenu.bulletList",
    icon: List,
    apply: (editor) => editor.chain().focus().toggleBulletList().run(),
    keywords: ["ul", "list", "无序", "列表", "bullet"],
  },
  {
    id: "orderedList",
    labelKey: "notes.editor.blockMenu.orderedList",
    icon: ListOrdered,
    apply: (editor) => editor.chain().focus().toggleOrderedList().run(),
    keywords: ["ol", "list", "有序", "列表", "ordered", "number"],
  },
  {
    id: "taskList",
    labelKey: "notes.editor.blockMenu.taskList",
    icon: ListChecks,
    apply: (editor) => editor.chain().focus().toggleTaskList().run(),
    keywords: ["todo", "task", "待办", "清单", "check"],
  },
  {
    id: "blockquote",
    labelKey: "notes.editor.blockMenu.blockquote",
    icon: Quote,
    apply: (editor) => editor.chain().focus().toggleBlockquote().run(),
    keywords: ["quote", "引用", "blockquote"],
  },
  {
    id: "codeBlock",
    labelKey: "notes.editor.blockMenu.codeBlock",
    icon: Code2,
    apply: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    keywords: ["code", "代码", "codeblock"],
  },
  {
    id: "divider",
    labelKey: "notes.editor.blockMenu.divider",
    icon: Minus,
    apply: (editor) => editor.chain().focus().setHorizontalRule().run(),
    keywords: ["hr", "divider", "分割线", "rule"],
  },
  {
    id: "image",
    labelKey: "notes.editor.blockMenu.image",
    icon: ImageIcon,
    apply: insertImagePlaceholder,
    keywords: ["image", "图片", "picture", "img"],
  },
  {
    id: "table",
    labelKey: "notes.editor.blockMenu.table",
    icon: TableIcon,
    apply: insertTable,
    keywords: ["table", "表格", "grid"],
  },
];

/**
 * 根据查询文本过滤块类型（按 id、keywords、本地化文案模糊匹配，不区分大小写）。
 * @param query 斜杠后输入的查询文本
 * @param translateLabel 将 i18n key 翻译为本地化文案的函数（通常 t）
 */
export const filterBlockTypes = (
  query: string,
  translateLabel: (key: BlockLabelKey) => string,
): BlockType[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...BLOCK_TYPES];
  return BLOCK_TYPES.filter((item) => {
    if (item.id.toLowerCase().includes(q)) return true;
    if (item.keywords.some((kw) => kw.toLowerCase().includes(q))) return true;
    if (translateLabel(item.labelKey).toLowerCase().includes(q)) return true;
    return false;
  });
};
