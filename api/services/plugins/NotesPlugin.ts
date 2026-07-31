import type { Plugin, KernelAPI } from "../kernel/types";
import notesRoutes from "../../routes/knowledge/notes";

/**
 * Notes 插件:注册笔记模块相关路由(/api/v1/notes)。
 *
 * 包含:
 * - 笔记 CRUD(list / get / create / update / delete / restore)
 * - Daily Notes 自动创建(/today-daily)
 * - 模板查询与 CRUD(/templates,POST/PUT/DELETE/set-default)
 * - 节点关联笔记查询(/by-node/:nodeId)
 * - P1 AI 端点(/:id/summary、/:id/extract-concepts、/:id/create-nodes)
 * - P1 图片上传(/:id/upload-image)
 *
 * 限流:整体应用 general 限流(读写混合场景,与现有 backlinks/templates 路由一致)。
 * 其中 AI 端点在路由内部额外叠加 aiHeavy 限流(1 小时 1000 次),
 * 图片上传叠加 write 限流(1 分钟 30 次)。
 */
export const NotesPlugin: Plugin = {
  name: "notes",
  version: "1.0.0",
  description: "Notes services: notes CRUD, daily auto-create, templates CRUD, AI summary/extract/upload-image, node-linked notes",
  dependencies: ["core", "graph"],

  onInstall(kernel: KernelAPI): void {
    kernel.registerRoutes("/api/v1/notes", notesRoutes, { rateLimiter: "general" });
  },
};
