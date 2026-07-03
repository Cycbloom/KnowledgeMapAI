/**
 * B1 双向链接解析工具
 * 提取和解析 Obsidian 风格的 [[节点标题]] 双链语法
 * 供前后端复用（后端 syncBacklinks 同步逻辑、前端 remark 插件）
 */

/**
 * 匹配 [[节点标题]] 的正则表达式
 * - 全局匹配（g 标志）
 * - 捕获组 1 为节点标题（不含 [[ ]]）
 * - 不匹配跨行
 */
export const WIKI_LINK_REGEX = /\[\[([^\]\n]+)\]\]/g;

/**
 * 从内容中提取所有 [[节点标题]] 双链
 * @param content 知识点内容
 * @returns 去重后的节点标题数组（保留首次出现顺序）
 */
export const extractWikiLinks = (content: string): string[] => {
  if (!content) return [];
  const titles: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  // 重置 regex lastIndex（全局正则复用需要重置）
  WIKI_LINK_REGEX.lastIndex = 0;
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    const title = match[1].trim();
    if (title && !seen.has(title.toLowerCase())) {
      seen.add(title.toLowerCase());
      titles.push(title);
    }
  }
  return titles;
};

/**
 * 提取双链及其在内容中的位置信息
 * 用于反向链接面板显示引用上下文
 * @param content 知识点内容
 * @returns 数组，每项包含 title（节点标题）、start（[[ 位置）、end（]] 之后位置）
 */
export interface WikiLinkPosition {
  title: string;
  start: number;
  end: number;
}

export const extractWikiLinkPositions = (content: string): WikiLinkPosition[] => {
  if (!content) return [];
  const positions: WikiLinkPosition[] = [];
  WIKI_LINK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKI_LINK_REGEX.exec(content)) !== null) {
    positions.push({
      title: match[1].trim(),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return positions;
};

/**
 * 获取某双链周围的上下文文本（前后各 N 字符）
 * @param content 完整内容
 * @param linkStart 双链起始位置
 * @param linkEnd 双链结束位置
 * @param contextChars 前后字符数（默认 30）
 * @returns 上下文文本（包含双链本身）
 */
export const getWikiLinkContext = (
  content: string,
  linkStart: number,
  linkEnd: number,
  contextChars: number = 30,
): string => {
  const start = Math.max(0, linkStart - contextChars);
  const end = Math.min(content.length, linkEnd + contextChars);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < content.length ? '...' : '';
  return prefix + content.slice(start, end).replace(/\n/g, ' ') + suffix;
};

/**
 * 替换内容中的 wiki 链接（节点重命名同步用）
 * 将所有 [[oldName]] 精确替换为 [[newName]]（区分大小写）
 * 用于图节点重命名时，同步更新笔记/知识点正文中引用该节点的双链
 * @param content 笔记/知识点内容
 * @param oldName 旧节点名
 * @param newName 新节点名
 * @returns 替换后的内容
 */
export const replaceWikiLink = (
  content: string,
  oldName: string,
  newName: string,
): string => {
  if (!content || !oldName || oldName === newName) return content;
  // 转义正则特殊字符，避免 oldName 含 ( ) [ ] . 等导致正则错误或误匹配
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\[\\[${escaped}\\]\\]`, 'g');
  return content.replace(regex, `[[${newName}]]`);
};
