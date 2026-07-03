/**
 * BlockEditor 的 Markdown <-> TipTap 内容转换工具。
 *
 * 存储格式约定（与 PRD/spec 一致）：笔记正文以 Markdown 文本存储，
 * wiki 链接使用 Obsidian 风格 `[[节点名]]` 语法（与 shared/utils/wikiLink.ts
 * 的 WIKI_LINK_REGEX 及 src/utils/wikiLinkRemarkPlugin.tsx 保持一致）。
 * P3 块引用/块嵌入使用 `((block-id))` / `!((block-id))` 语法（blockId 为 10 位 [a-z0-9]）。
 *
 * TipTap 内部使用 Link 节点承载 wiki 链接（href 形如 `wiki://节点名`），
 * 通过本模块在两端做双向转换：
 *   - 写入编辑器前：`[[节点名]]` -> `[节点名](wiki://节点名)`
 *   - 从编辑器读出：`[节点名](wiki://节点名)` -> `[[节点名]]`
 * 这样保证落盘 Markdown 始终是 `[[节点名]]`，可被 wikiLinkRemarkPlugin 正确解析。
 *
 * P3 块引用/块嵌入通过 HTML 节点桥接（editorExtensions 的 Markdown 扩展已开启 html:true）：
 *   - 写入编辑器前：`((id))` -> `<span data-block-ref="id">`，`!((id))` -> `<div data-block-embed="id">`
 *   - 从编辑器读出：HTML span/div -> `((id))` / `!((id))`
 * 这样 TipTap 自研 BlockReference/BlockEmbed 节点的 parseHTML/renderHTML 与 Markdown 串双向打通。
 */
import { preprocessWikiLinks } from "@/utils/wikiLinkRemarkPlugin";
import {
  BLOCK_REF_REGEX,
  BLOCK_EMBED_REGEX,
} from "@shared/utils/blockRef";

/** wiki 链接在 TipTap 内部使用的伪协议前缀，配合 Link 扩展。 */
export const WIKI_LINK_PROTOCOL = "wiki://";

/**
 * 将存储中的 Markdown 转为 TipTap 可解析的 Markdown。
 * 链路：preprocessWikiLinks（`[[节点名]]` -> wiki 链接）-> preprocessBlockRefs（`((id))`/`!((id))` -> HTML）。
 * 两者均跳过代码块/行内代码，互不干扰；wiki 链接不会含 `((`，块引用不会含 `[[`。
 */
export const markdownToTiptap = (markdown: string): string => {
  if (!markdown) return "";
  return preprocessBlockRefs(preprocessWikiLinks(markdown));
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
 * 链路：tiptapToMarkdownBlockRefs（HTML span/div -> `((id))`/`!((id))`）-> wiki 链接还原。
 * 先块引用还原，再 wiki 链接还原（两者模式不重叠，互不干扰）。
 */
export const tiptapToMarkdown = (markdown: string): string => {
  if (!markdown) return "";
  const withBlockRefs = tiptapToMarkdownBlockRefs(markdown);
  return withBlockRefs.replace(
    WIKI_LINK_MD_REGEX,
    (_match, text: string, title: string) => {
      const trimmedTitle = (title as string).trim();
      const trimmedText = (text as string).trim();
      // 显示文本优先：[[文本]] 中"文本"即被 backlinks 解析为节点名。
      const label = trimmedText || trimmedTitle;
      return `[[${label}]]`;
    },
  );
};

/**
 * 将节点标题编码为 wiki:// URL（用于插入 TipTap Link 节点）。
 * 不做 encodeURI 以保持可读性，节点名不含 ) 字符即可。
 */
export const buildWikiLinkHref = (nodeTitle: string): string => {
  return `${WIKI_LINK_PROTOCOL}${nodeTitle}`;
};

// ============================================================
// P3: 块引用 / 块嵌入 Markdown 双向转换
// ============================================================

/**
 * 预处理块引用与块嵌入：把 `((id))` / `!((id))` 转为 ProseMirror 可识别的 HTML。
 *
 * - `!((id))` 优先替换为 `<div data-block-embed="id"></div>`（block 节点）
 * - 再把剩余 `((id))` 替换为 `<span data-block-ref="id"></span>`（inline 节点）
 *
 * 跳过代码块/行内代码（与 preprocessWikiLinks 一致，按 split 奇数索引跳过）。
 * embed 优先于 ref：避免 `!((id))` 中的 `((id))` 部分被 BLOCK_REF_REGEX 误匹配。
 */
export function preprocessBlockRefs(markdown: string): string {
  if (!markdown) return "";
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]+`)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part; // 代码块/行内代码，跳过
      return part
        .replace(
          BLOCK_EMBED_REGEX,
          (_m, id: string) => `<div data-block-embed="${id}"></div>`,
        )
        .replace(
          BLOCK_REF_REGEX,
          (_m, id: string) => `<span data-block-ref="${id}"></span>`,
        );
    })
    .join("");
}

/**
 * tiptap-markdown 输出后，把 span/div HTML 还原为 `((id))` / `!((id))`。
 *
 * BlockReference/BlockEmbed 节点无 markdownSpec，序列化时回退到 HTMLNode 输出
 * `<span ... data-block-ref="id" ...></span>` / `<div ... data-block-embed="id" ...></div>`。
 * 本函数捕获其中的 10 位 blockId 还原为存储语法（无空格）。
 *
 * 注意：替换字符串严格 `((id))` 与 `!((id))`，不能有空格。
 */
export function tiptapToMarkdownBlockRefs(html: string): string {
  return html
    .replace(
      /<div[^>]*data-block-embed="([a-z0-9]{10})"[^>]*><\/div>/g,
      (_m, id: string) => `!((${id}))`,
    )
    .replace(
      /<span[^>]*data-block-ref="([a-z0-9]{10})"[^>]*><\/span>/g,
      (_m, id: string) => `((${id}))`,
    );
}

