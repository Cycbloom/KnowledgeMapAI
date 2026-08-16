/**
 * P3 块引用/块嵌入解析工具
 * 提取和解析块级引用语法（^block-id 标记 / ((id)) 引用 / !((id)) 嵌入）
 * 供前后端复用（后端 syncBlockRefs 同步逻辑、前端 remark 插件）
 *
 * 块引用语法:
 * - 块 ID 标记: `^block-id`（块尾，Obsidian 风格，blockId 为 10 位 [a-z0-9]）
 * - 块引用: `((block-id))` inline（Logseq/Roam 风格）
 * - 块嵌入: `!((block-id))` block（Live Transclusion）
 */
import type { BlockId, BlockRefType } from '../types/note';

/**
 * 块 ID 字符模式：10 位 [a-z0-9]
 * （非正则字面量，供拼接使用）
 */
export const BLOCK_ID_PATTERN = '[a-z0-9]{10}';

/**
 * 块尾 ^id 标记正则（无 g 标志，用于单块提取）
 * 捕获组 1 为 blockId（10 位 [a-z0-9]）
 */
export const BLOCK_ID_TRAILING_REGEX = /\^([a-z0-9]{10})$/;

/**
 * 块引用正则：`((block-id))` inline
 * - 全局匹配（g 标志）
 * - 捕获组 1 为 blockId
 * - 注意：会匹配 `!((id))` 中的 `((id))` 部分，需由调用方按位置过滤
 */
export const BLOCK_REF_REGEX = /\(\(([a-z0-9]{10})\)\)/g;

/**
 * 块嵌入正则：`!((block-id))`
 * - 全局匹配（g 标志）
 * - 捕获组 1 为 blockId
 */
export const BLOCK_EMBED_REGEX = /!\(\(([a-z0-9]{10})\)\)/g;

/**
 * 块 ID 字符表（a-z + 0-9，共 36 个）
 */
const BLOCK_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 代码块/行内代码分割正则（与 preprocessWikiLinks 一致）
 * - 围栏代码块 ```...```
 * - 行内代码 `...`
 * 捕获组为代码段，split 后奇数索引为代码（应跳过）
 */
const CODE_SPLIT_REGEX = /(```[\s\S]*?```|`[^`\n]+`)/g;

/**
 * 生成 10 位 [a-z0-9] 随机 blockId
 * 使用 crypto.getRandomValues（浏览器与 Node 20+ 均原生支持 Web Crypto API）
 */
export const generateBlockId = (): BlockId => {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += BLOCK_ID_CHARS[bytes[i] % BLOCK_ID_CHARS.length];
  }
  return result;
};

/**
 * 从单块 Markdown 中提取块自身的 blockId（块尾 ^id）
 * @param blockContent 单块内容（不含块间空行分隔符）
 * @returns blockId，无 id 返回 null
 */
export const extractBlockId = (blockContent: string): BlockId | null => {
  if (!blockContent) return null;
  const match = BLOCK_ID_TRAILING_REGEX.exec(blockContent);
  return match ? match[1] : null;
};

/**
 * 从笔记全文中提取所有块自身的 blockId
 * - 按空行分隔块
 * - 跳过代码块/行内代码内的 ^id
 * - 跳过无 ^id 的块
 * @param content 笔记全文
 * @returns blockId 数组（保留出现顺序，不去重）
 */
export const extractAllBlockIds = (content: string): BlockId[] => {
  if (!content) return [];
  const parts = content.split(CODE_SPLIT_REGEX);
  const ids: BlockId[] = [];
  for (let i = 0; i < parts.length; i++) {
    // 奇数索引为代码块/行内代码，跳过
    if (i % 2 === 1) continue;
    const nonCode = parts[i];
    if (!nonCode) continue;
    // 按空行分隔块
    const blocks = nonCode.split(/\n\s*\n/);
    for (const block of blocks) {
      const id = extractBlockId(block);
      if (id) ids.push(id);
    }
  }
  return ids;
};

/**
 * 判断 [start,end] 是否完全落在某个 embed 范围内。
 * embedRanges 按 start 升序且互不重叠，故只需二分查找 start 前最后一个
 * embed，命中即包含。
 */
const isInsideEmbedRange = (
  embedRanges: Array<[number, number]>,
  start: number,
  end: number,
): boolean => {
  let lo = 0;
  let hi = embedRanges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (embedRanges[mid][0] > start) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  if (hi < 0) return false;
  const range = embedRanges[hi];
  return start >= range[0] && end <= range[1];
};

/**
 * 解析笔记全文中的所有引用（包括 ref 与 embed）
 * - embed 优先匹配，避免 `!((id))` 被 `((id))` 误匹配
 * - 跳过代码块/行内代码内的引用
 * - 按文档出现顺序返回
 * @param content 笔记全文
 * @returns 引用列表（每项含 blockId 与 type），不去重
 */
export const extractBlockRefs = (
  content: string,
): Array<{ blockId: BlockId; type: BlockRefType }> => {
  if (!content) return [];
  const parts = content.split(CODE_SPLIT_REGEX);
  const results: Array<{ blockId: BlockId; type: BlockRefType }> = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) continue;
    const nonCode = parts[i];
    if (!nonCode) continue;

    // 先提取 embed，记录其匹配范围
    const embedRanges: Array<[number, number]> = [];
    const partResults: Array<{ blockId: BlockId; type: BlockRefType; index: number }> = [];

    BLOCK_EMBED_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLOCK_EMBED_REGEX.exec(nonCode)) !== null) {
      embedRanges.push([match.index, match.index + match[0].length]);
      partResults.push({ blockId: match[1], type: 'embed', index: match.index });
    }

    // 再提取 ref，跳过与 embed 范围重叠的（即 !((id)) 中的 ((id)) 部分）
    BLOCK_REF_REGEX.lastIndex = 0;
    while ((match = BLOCK_REF_REGEX.exec(nonCode)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      // embedRanges 已按 start 升序且互不重叠，用二分查找替代 some 线性扫描，
      // 内层判定从 O(embeds) 降为 O(log embeds)
      const isEmbed = isInsideEmbedRange(embedRanges, start, end);
      if (isEmbed) continue;
      partResults.push({ blockId: match[1], type: 'ref', index: start });
    }

    // 按出现位置排序后追加（保证文档顺序）
    partResults.sort((a, b) => a.index - b.index);
    for (const r of partResults) {
      results.push({ blockId: r.blockId, type: r.type });
    }
  }

  return results;
};

/**
 * 仅解析块引用（不含 embed）
 * - 跳过代码块/行内代码内的引用
 * - 去重（保留首次出现顺序）
 * @param content 笔记全文
 * @returns 去重后的 blockId 数组
 */
export const extractBlockRefIds = (content: string): BlockId[] => {
  const refs = extractBlockRefs(content);
  const seen = new Set<string>();
  const ids: BlockId[] = [];
  for (const r of refs) {
    if (r.type === 'ref' && !seen.has(r.blockId)) {
      seen.add(r.blockId);
      ids.push(r.blockId);
    }
  }
  return ids;
};

/**
 * 仅解析块嵌入
 * - 跳过代码块/行内代码内的嵌入
 * - 去重（保留首次出现顺序）
 * @param content 笔记全文
 * @returns 去重后的 blockId 数组
 */
export const extractBlockEmbedIds = (content: string): BlockId[] => {
  const refs = extractBlockRefs(content);
  const seen = new Set<string>();
  const ids: BlockId[] = [];
  for (const r of refs) {
    if (r.type === 'embed' && !seen.has(r.blockId)) {
      seen.add(r.blockId);
      ids.push(r.blockId);
    }
  }
  return ids;
};

/**
 * 若块尾无 ^id，生成并追加；否则返回原内容与已有 id
 * @param blockContent 单块内容
 * @returns content（可能追加了 ^id）与 blockId
 */
export const ensureBlockId = (
  blockContent: string,
): { content: string; blockId: BlockId } => {
  const existing = extractBlockId(blockContent);
  if (existing) {
    return { content: blockContent, blockId: existing };
  }
  const newId = generateBlockId();
  return { content: `${blockContent  }^${  newId}`, blockId: newId };
};

/**
 * 剥离块尾 ^id，用于显示
 * 同时移除 ^id 前后的空白
 * @param blockContent 单块内容
 * @returns 剥离 ^id 后的内容
 */
export const removeBlockId = (blockContent: string): string => {
  if (!blockContent) return '';
  return blockContent.replace(/\s*\^[a-z0-9]{10}\s*$/, '').trimEnd();
};

/**
 * 从笔记全文中按 blockId 查找对应块的内容
 * - 按空行分隔块
 * - 返回包含 ^id 的完整块文本
 * - 纯查询函数，不做代码块排除（代码块内的 ^id 也可被查找）
 * @param content 笔记全文
 * @param blockId 目标 blockId
 * @returns 块文本（含 ^id），未命中返回 null
 */
export const findBlockContent = (content: string, blockId: BlockId): string | null => {
  if (!content || !blockId) return null;
  const blocks = content.split(/\n\s*\n/);
  for (const block of blocks) {
    const id = extractBlockId(block);
    if (id === blockId) {
      return block;
    }
  }
  return null;
};
