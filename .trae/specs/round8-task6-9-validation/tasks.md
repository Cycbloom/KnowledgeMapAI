# Tasks

- [ ] Task 1: 验证 P3-01 Kernel 启动顺序解耦已在 Round 6 完成
  - [ ] SubTask 1.1: 核对 `d:\KnowledgeMap\api\services\kernel\bootstrap.ts` 已有 `bootstrapKernel()` 函数，注册 6 个内置插件（corePlugin / graphPlugin / aiPlugin / studyPlugin / schedulerPlugin / agentPlugin）
  - [ ] SubTask 1.2: 核对 `d:\KnowledgeMap\api\app.ts` 已有 `createApp(kernel?: Kernel)` 工厂函数，`kernel` 为 undefined 时不挂载插件路由、不启动后台任务
  - [ ] SubTask 1.3: 核对 `d:\KnowledgeMap\api\app.ts` 模块底部单例调用 `bootstrapKernel()` + `createApp(kernel)`
  - [ ] SubTask 1.4: 运行 `npm run check` 与 `npm run check:electron` 确认无类型错误

- [ ] Task 2: 重新评估 P3-02 Repository 层抽取的必要性
  - [ ] SubTask 2.1: 核对 `d:\KnowledgeMap\api\services\common\softDeleteHelper.ts` 已存在 `notDeleted()` / `deletedOnly()` 高阶 filter 函数（Round 6 Task 3 已实现，解决 P3-04 主要重复模式）
  - [ ] SubTask 2.2: 核对 `services/graph/` 已有约 27 个细拆文件、`services/scheduler/` 已有约 40+ 个细拆文件（服务层已按聚合根/职责拆分，无"巨型服务"问题）
  - [ ] SubTask 2.3: 评估结论：P3-02 判定为不必要（理由详见 spec.md「关于 P3-02 的评估备忘」）。不实施任何代码修改。

- [ ] Task 3: 验证 P3-03 服务循环依赖已在 Round 6 完成
  - [ ] SubTask 3.1: 核对 `d:\KnowledgeMap\api\services\ai\contextBuilder.ts` 已存在，包含 `buildGraphContext` 与 `buildTutorContext` 纯函数
  - [ ] SubTask 3.2: 核对 `d:\KnowledgeMap\api\services\ai\chatService.ts` 不再 `import { aiService }` from aiService（已通过 contextBuilder 解耦）
  - [ ] SubTask 3.3: 核对 `d:\KnowledgeMap\api\services\ai\aiService.ts` 仅 `import type { ChatService }`（类型 import，运行时无循环）
  - [ ] SubTask 3.4: 核对 `factory.ts` 不反向 import promptService / chatService / aiService（确认 promptService → factory 是单向依赖，不构成循环）

- [ ] Task 4: 验证 P3-09 Electron IPC 按域拆分已在 Round 6 完成
  - [ ] SubTask 4.1: 核对 `d:\KnowledgeMap\electron\ipc\` 下有 7 个 handler 文件：appHandlers / configHandlers / dbHandlers / shellHandlers / syncHandlers / updateHandlers / windowHandlers
  - [ ] SubTask 4.2: 核对每个 handler 文件导出 `register{Domain}Handlers()` 函数
  - [ ] SubTask 4.3: 核对 `d:\KnowledgeMap\electron\main.ts` 在 `app.whenReady()` 中调用全部 7 个 `registerXxxHandlers()` 函数，无内联 `ipcMain.handle`
  - [ ] SubTask 4.4: 运行 `npm run check:electron` 确认无类型错误

# Task Dependencies

- Task 1 / 2 / 3 / 4 互相独立，可并行
- 全部为验证 + 评估任务，不修改任何代码
- 完成后统一运行全局验证（check + check:electron + lint）
