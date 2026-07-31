/**
 * useBlockSSE —— P3 块嵌入实时同步 SSE 订阅 hook(Task 9.1)。
 *
 * 复用 useTaskEvents 已建立的 EventSource 连接:useTaskEvents 把所有
 * `/tasks/events` 消息通过 `frontendEventBus.publish("sse_message", data)` 广播,
 * 本 hook 订阅 `sse_message` 并过滤 `block_updated` / `block_removed` 事件,
 * 无需新建第二条 SSE 连接。
 *
 * 事件载荷(后端 notesService.update / delete 推送):
 * - block_updated: { type, blockId, noteId, newContent }
 * - block_removed: { type, noteId }
 *
 * 处理:
 * - block_updated: invalidate queryKeys.noteBlock(noteId, blockId) 触发重新拉取,
 *   并回调 onBlockUpdated(blockId, noteId, newContent)
 * - block_removed: invalidate inbound/outbound block-refs 查询,
 *   并回调 onBlockRemoved(noteId)
 *
 * 可选传入 currentNoteId 用于回调内做笔记维度过滤(回调本身可选)。
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { queryKeys } from "../queries/config";

interface BlockUpdatedPayload {
  type: "block_updated";
  blockId: string;
  noteId: string;
  newContent: string;
}

interface BlockRemovedPayload {
  type: "block_removed";
  noteId: string;
}

type BlockSSEPayload = BlockUpdatedPayload | BlockRemovedPayload;

function isBlockUpdated(
  payload: unknown,
): payload is BlockUpdatedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { type?: string }).type === "block_updated" &&
    typeof (payload as { blockId?: unknown }).blockId === "string" &&
    typeof (payload as { noteId?: unknown }).noteId === "string"
  );
}

function isBlockRemoved(
  payload: unknown,
): payload is BlockRemovedPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as { type?: string }).type === "block_removed" &&
    typeof (payload as { noteId?: unknown }).noteId === "string"
  );
}

export function useBlockSSE(
  currentNoteId: string | undefined,
  onBlockUpdated?: (
    blockId: string,
    noteId: string,
    newContent: string,
  ) => void,
  onBlockRemoved?: (noteId: string) => void,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (data: BlockSSEPayload | unknown) => {
      if (isBlockUpdated(data)) {
        const { blockId, noteId, newContent } = data;
        // 失效单块缓存,触发 useBlockContent 重新拉取
        queryClient.invalidateQueries({
          queryKey: queryKeys.noteBlock(noteId, blockId),
        });
        onBlockUpdated?.(blockId, noteId, newContent);
        return;
      }
      if (isBlockRemoved(data)) {
        const { noteId } = data;
        // 笔记被删除:失效该笔记的 inbound/outbound block-refs 查询
        queryClient.invalidateQueries({
          queryKey: queryKeys.noteInboundBlockRefs(noteId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.noteOutboundBlockRefs(noteId),
        });
        onBlockRemoved?.(noteId);
      }
    };

    const unsubscribe = frontendEventBus.subscribe("sse_message", handler);
    return () => {
      unsubscribe();
    };
  }, [queryClient, currentNoteId, onBlockUpdated, onBlockRemoved]);
}