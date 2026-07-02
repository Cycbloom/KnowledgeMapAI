import React from 'react';
import { WIKI_LINK_REGEX } from '@shared/utils/wikiLink';

/**
 * 预处理 markdown 内容，将 [[节点标题]] 转换为 [节点标题](wiki://节点标题)
 * 在传给 ReactMarkdown 之前调用
 * 跳过代码块和行内代码中的 [[]]
 */
export const preprocessWikiLinks = (content: string): string => {
  if (!content) return '';

  // 简化方案：先按代码块分割，只处理非代码块部分
  // 代码块用 ``` 分隔，行内代码用 ` 包裹
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return parts
    .map((part, index) => {
      // 奇数索引（正则捕获组）是代码块/行内代码，跳过
      if (index % 2 === 1) return part;
      // 偶数索引是普通文本，转换 [[]]
      return part.replace(WIKI_LINK_REGEX, (_, title) => {
        const trimmedTitle = (title as string).trim();
        return `[${trimmedTitle}](wiki://${trimmedTitle})`;
      });
    })
    .join('');
};

/**
 * 判断链接是否为 wiki 协议
 */
export const isWikiLink = (url: string): boolean => {
  return url.startsWith('wiki://');
};

/**
 * 从 wiki:// 链接中提取节点标题
 */
export const extractWikiLinkTitle = (url: string): string => {
  return url.replace(/^wiki:\/\//, '');
};

export interface WikiLinkRendererProps {
  href?: string;
  children?: React.ReactNode;
  onWikiLinkClick?: (title: string) => void;
}

/**
 * Wiki 链接渲染组件
 * 在 ReactMarkdown 的 components.a 中使用
 */
export const WikiLinkRenderer: React.FC<WikiLinkRendererProps> = ({
  href,
  children,
  onWikiLinkClick,
}) => {
  if (href && isWikiLink(href)) {
    const title = extractWikiLinkTitle(href);
    return (
      <span
        className="wiki-link cursor-pointer text-primary-600 dark:text-primary-400 underline hover:text-primary-700 dark:hover:text-primary-300"
        role="link"
        tabIndex={0}
        onClick={() => onWikiLinkClick?.(title)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onWikiLinkClick?.(title);
          }
        }}
      >
        {children ?? title}
      </span>
    );
  }
  // 非 wiki 链接，返回默认 a 标签
  return (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};
