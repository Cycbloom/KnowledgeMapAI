/**
 * BlockEditor 的 Markdown <-> TipTap 内容转换工具。
 *
 * 存储格式约定（与 PRD/spec 一致）：笔记正文以 Markdown 文本存储，
 * wiki 链接使用 Obsidian 风格 `[[节点名]]` 语法（与 shared/utils/wikiLink.ts
 * 的 WIKI_LINK_REGEX 及 src/utils/wikiLinkRemarkPlugin.tsx 保持一致）。
 *
 * TipTap 内部使用 Link 节点承载 wiki 链接（href 形如 `wiki://节点名`），
 * 通过本模块在两端做双向转换：
 *   - 写入编辑器前：`[[节点名]]` -> `[节点名](wiki://节点名)`
 *   - 从编辑器读出：`[节点名](wiki://节点名)` -> `[[节点名]]`
 * 这样保证落盘 Markdown 始终是 `[[节点名]]`，可被 wikiLinkRemarkPlugin 正确解析。
 */
import { preprocessWikiLinks } from "@/utils/wikiLinkRemarkPlugin";

/** wiki 链接在 TipTap 内部使用的伪协议前缀，配合 Link 扩展。 */
export const WIKI_LINK_PROTOCOL = "wiki://";

/**
 * 将存储中的 Markdown 转为 TipTap 可解析的 Markdown。
 * 复用现有 preprocessWikiLinks：把 `[[节点名]]` 转为 `[节点名](wiki://节点名)`。
 * 跳过代码块/行内代码（preprocessWikiLinks 已处理）。
 */
export const markdownToTiptap = (markdown: string): string => {
  if (!markdown) return "";
  return preprocessWikiLinks(markdown);
};

/**
 * 匹配 TipTap 序列化后产生的 `[文本](wiki://节点名)` 形式。
 * - 捕获组 1：链接文本（通常与节点名相同）
 * - 捕获组 2：wiki:// 后的节点名
 * 注意节点名中可能含空格/中文，但不含 ] 和 )。
 */
const WIKI_LINK_MD_REGEX = /\[([^\]]+)\]\(wiki:\/\/([^)]+)\)/g;

/**
 * 将 TipTap 输出的 Markdown 还原为存储格式。
 * 把 `[节点名](wiki://节点名)` 转回 `[[节点名]]`。
 * 若文本与节点名一致，使用节点名；否则使用文本作为显示标题（仍以 [[文本]] 形式存储，
 * 与 backlinks 同步机制基于节点名匹配的语义保持兼容——后者取 [[]] 内文本作为节点名）。
 */
export const tiptapToMarkdown = (markdown: string): string => {
  if (!markdown) return "";
  return markdown.replace(WIKI_LINK_MD_REGEX, (_match, text: string, title: string) => {
    const trimmedTitle = (title as string).trim();
    const trimmedText = (text as string).trim();
    // 显示文本优先：[[文本]] 中"文本"即被 backlinks 解析为节点名。
    const label = trimmedText || trimmedTitle;
    return `[[${label}]]`;
  });
};

/**
 * 将节点标题编码为 wiki:// URL（用于插入 TipTap Link 节点）。
 * 不做 encodeURI 以保持可读性，节点名不含 ) 字符即可。
 */
export const buildWikiLinkHref = (nodeTitle: string): string => {
  return `${WIKI_LINK_PROTOCOL}${nodeTitle}`;
};
