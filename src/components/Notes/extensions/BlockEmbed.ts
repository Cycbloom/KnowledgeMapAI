/**
 * BlockEmbed —— P3 块嵌入 TipTap v3 自研 block Node + ReactNodeView。
 *
 * 承载 `!((block-id))` 块嵌入语法。作为 block 级 atom 节点,由 ReactNodeViewRenderer
 * 渲染 BlockEmbedNodeView(完整 NodeView,Task 9 接入块内容拉取与 SSE 实时刷新)。
 *
 * Markdown 双向转换由 markdownSerializer.ts 处理:落盘为 `!((id))`,加载时还原为 div 节点。
 * 注意:noteId 属性不参与 Markdown 序列化(格式仍为 `!((blockId))`),仅在插入时
 * 记录源笔记 ID 供 NodeView 拉取块内容。页面重新加载后 noteId 为 null,NodeView
 * 回退到 editor.storage.blockEmbed.currentNoteId(当前编辑笔记)。
 *
 * 命令:insertBlockEmbed(blockId, noteId?) 在当前选区插入一个 blockEmbed 节点。
 * storage.currentNoteId: 由 BlockEditor 设置,供 NodeView 在 noteId 为 null 时回退。
 */
import {
  Node,
  mergeAttributes,
  type Command,
  type CommandProps,
  type DOMNode,
} from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BlockEmbedNodeView } from './BlockEmbedNodeView';

export interface BlockEmbedOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockEmbed: {
      /** 在当前选区插入一个块嵌入节点(blockId 为目标块的 10 位 id,noteId 为源笔记 ID) */
      insertBlockEmbed: (blockId: string, noteId?: string) => ReturnType;
    };
  }
}

export const BlockEmbed = Node.create<
  BlockEmbedOptions,
  { currentNoteId: string | undefined }
>({
  name: 'blockEmbed',
  inline: false,
  group: 'block',
  atom: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addStorage() {
    return { currentNoteId: undefined };
  },

  addAttributes() {
    return {
      blockId: { default: null },
      // 源笔记 ID(插入时记录,不参与 Markdown 序列化)
      noteId: {
        default: null,
        parseHTML: (el: DOMNode) =>
          el instanceof Element
            ? el.getAttribute('data-block-note')
            : null,
        renderHTML: (attrs: { noteId?: string | null }) =>
          attrs.noteId ? { 'data-block-note': attrs.noteId } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-block-embed]',
        getAttrs: (el: DOMNode) => ({
          blockId:
            el instanceof Element
              ? el.getAttribute('data-block-embed')
              : null,
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-block-embed': node.attrs.blockId as string | null,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockEmbedNodeView);
  },

  addCommands() {
    return {
      insertBlockEmbed:
        (blockId: string, noteId?: string): Command =>
        ({ commands }: CommandProps) =>
          commands.insertContent({
            type: 'blockEmbed',
            attrs: { blockId, noteId: noteId ?? null },
          }),
    };
  },
});
