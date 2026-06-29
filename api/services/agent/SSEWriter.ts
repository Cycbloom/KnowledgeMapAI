import type { Response } from "express";
import type { AgentSSEEvent } from "./types";

/**
 * SSE 写入器：封装 Server-Sent Events 数据帧的写入逻辑。
 * 维持与原 AgentService.sendSSE 等价的写入格式：`data: <JSON>\n\n`
 */
export class SSEWriter {
  constructor(private res: Response) {}

  /**
   * 发送一个 SSE 事件。
   */
  send(event: AgentSSEEvent): void {
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  /**
   * 释放资源（当前实现为空，预留以便后续扩展）。
   */
  dispose(): void {
    // 预留：当前无需额外清理
  }
}
