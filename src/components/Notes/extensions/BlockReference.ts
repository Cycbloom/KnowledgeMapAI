/**
 * BlockReference —— P3 块引用 TipTap v3 自研 inline Node。
 *
 * 承载 `((block-id))` inline 引用语法。渲染为带 data-block-ref 属性的 span,
 * NodeView/样式层负责显示块摘要(Task 9 完善);本扩展仅保证 schema 与命令可用。
 *
 * Markdown 双向转换由 markdownSerializer.ts 的 preprocessBlockRefs /
 * tiptapToMarkdownBlockRefs 处理:落盘为 `((id))`,加载时还原为 span 节点。
 *
 * 命令:insertBlockReference(blockId) 在当前选区插入一个 blockReference 节点。
 */
import {
  Node,
  mergeAttributes,
  type Command,
  type CommandProps,
  type DOMNode,
} from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BlockReferenceNodeView } from './BlockReferenceNodeView';

export interface BlockReferenceOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockReference: {
      /** 在当前选区插入一个块引用节点(blockId 为目标块的 10 位 id) */
      insertBlockReference: (blockId: string) => ReturnType;
    };
  }
}

export const BlockReference = Node.create<BlockReferenceOptions>({
  name: 'blockReference',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      blockId: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-block-ref]',
        getAttrs: (el: DOMNode) => ({
          blockId:
            el instanceof Element
              ? el.getAttribute('data-block-ref')
              : null,
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-block-ref': node.attrs.blockId as string | null,
        class: 'block-ref',
      }),
    ];
  },

  addCommands() {
    return {
      insertBlockReference:
        (blockId: string): Command =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: 'blockReference',
            attrs: { blockId },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockReferenceNodeView);
  },
});
