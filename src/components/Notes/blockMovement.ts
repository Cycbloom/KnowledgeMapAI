/**
 * 块上下移动工具（SubTask 7.6 降级方案）。
 *
 * 拖拽手柄（@tiptap/extension-drag-handle）为 TipTap Pro 付费扩展，
 * 故采用"工具栏上移/下移块按钮"代替拖拽：交换当前选区所在顶层节点
 * 与其相邻顶层节点的位置，并尽量保持选区落在移动后的块内。
 */
import type { Editor } from "@tiptap/core";
import { TextSelection } from "prosemirror-state";

interface BlockLocation {
  index: number;
  start: number;
}

/** 查找当前选区所在顶层节点（depth=1）的索引与起始位置。 */
const findCurrentTopBlock = (editor: Editor): BlockLocation | null => {
  const { state } = editor;
  const $pos = state.selection.$from;
  if ($pos.depth < 1) return null;
  const currentStart = $pos.before(1);
  let cursor = 0;
  let foundIndex = -1;
  state.doc.forEach((child, _offset, index) => {
    if (cursor === currentStart && foundIndex < 0) foundIndex = index;
    cursor += child.nodeSize;
  });
  if (foundIndex < 0) return null;
  return { index: foundIndex, start: currentStart };
};

/** 当前块是否可上移/下移。 */
export const canMoveBlock = (
  editor: Editor,
): { up: boolean; down: boolean } => {
  const loc = findCurrentTopBlock(editor);
  if (!loc) return { up: false, down: false };
  const last = editor.state.doc.childCount - 1;
  return { up: loc.index > 0, down: loc.index < last };
};

/**
 * 移动当前顶层块。direction 为 "up" 时与前一个块交换，"down" 时与后一个块交换。
 * 返回 true 表示移动成功并已 dispatch。
 */
export const moveBlock = (editor: Editor, direction: "up" | "down"): boolean => {
  const { state, view } = editor;
  const loc = findCurrentTopBlock(editor);
  if (!loc) return false;

  const { index: currentIndex, start: currentStart } = loc;
  const doc = state.doc;
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= doc.childCount) return false;

  const currentChild = doc.child(currentIndex);
  const targetChild = doc.child(targetIndex);
  const currentBlockSize = currentChild.nodeSize;

  // 选区在当前块内的相对偏移（用于移动后恢复光标）
  const relOffset = state.selection.$from.pos - currentStart;

  // 构建交换后的子节点序列
  const newChildren: typeof currentChild[] = [];
  doc.forEach((child, _offset, index) => {
    if (index === currentIndex) {
      newChildren.push(direction === "up" ? currentChild : targetChild);
    } else if (index === targetIndex) {
      newChildren.push(direction === "up" ? targetChild : currentChild);
    } else {
      newChildren.push(child);
    }
  });

  // 移动后，当前块落在 targetIndex 位置（与上一/下一块交换）
  let newBlockStart = 0;
  for (let i = 0; i < targetIndex; i++) {
    newBlockStart += newChildren[i].nodeSize;
  }
  const newPos = newBlockStart + Math.max(1, Math.min(relOffset, currentBlockSize - 1));

  const tr = state.tr;
  tr.replaceWith(0, doc.content.size, newChildren);
  const resolved = tr.doc.resolve(newPos);
  tr.setSelection(TextSelection.near(resolved));
  view.dispatch(tr);
  editor.commands.focus();
  return true;
};
