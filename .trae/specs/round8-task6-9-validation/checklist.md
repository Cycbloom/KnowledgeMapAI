# Round 8 Task 6-9 Validation Checklist

## Task 1: P3-01 Kernel 启动顺序解耦（验证已在 Round 6 完成）

- [ ] `api/services/kernel/bootstrap.ts` 已有 `bootstrapKernel()` 函数
- [ ] `bootstrapKernel()` 注册 6 个内置插件（core / graph / ai / study / scheduler / agent）
- [ ] `api/app.ts` 已有 `createApp(kernel?: Kernel)` 工厂函数
- [ ] `createApp(undefined)` 时跳过插件路由挂载与后台任务启动
- [ ] `api/app.ts` 模块底部单例调用 `bootstrapKernel() + createApp(kernel)`
- [ ] `npm run check` 通过
- [ ] `npm run check:electron` 通过

## Task 2: P3-02 Repository 层抽取（重新评估为不必要）

- [ ] `api/services/common/softDeleteHelper.ts` 已存在（Round 6 Task 3 实现）
- [ ] `softDeleteHelper` 导出 `notDeleted()` / `deletedOnly()` 高阶 filter 函数
- [ ] `services/graph/` 已有约 27 个细拆文件（按聚合根拆分）
- [ ] `services/scheduler/` 已有约 40+ 个细拆文件（按职责拆分）
- [ ] 评估结论：P3-02 不必要（理由见 spec.md）
- [ ] 未实施任何代码修改

## Task 3: P3-03 服务循环依赖（验证已在 Round 6 完成）

- [ ] `api/services/ai/contextBuilder.ts` 已存在
- [ ] `contextBuilder.ts` 导出 `buildGraphContext` 与 `buildTutorContext` 纯函数
- [ ] `api/services/ai/chatService.ts` 不再 `import { aiService }` from aiService
- [ ] `api/services/ai/aiService.ts` 仅 `import type { ChatService }`（类型 import）
- [ ] `api/services/ai/factory.ts` 不反向 import promptService / chatService / aiService
- [ ] `promptService → factory` 是单向依赖（不构成循环）

## Task 4: P3-09 Electron IPC 按域拆分（验证已在 Round 6 完成）

- [ ] `electron/ipc/appHandlers.ts` 已存在并导出 `registerAppHandlers()`
- [ ] `electron/ipc/configHandlers.ts` 已存在并导出 `registerConfigHandlers()`
- [ ] `electron/ipc/dbHandlers.ts` 已存在并导出 `registerDbIpcHandlers()`
- [ ] `electron/ipc/shellHandlers.ts` 已存在并导出 `registerShellHandlers()`
- [ ] `electron/ipc/syncHandlers.ts` 已存在并导出 `registerSyncHandlers()`
- [ ] `electron/ipc/updateHandlers.ts` 已存在并导出 `registerUpdateHandlers()`
- [ ] `electron/ipc/windowHandlers.ts` 已存在并导出 `registerWindowHandlers()`
- [ ] `electron/main.ts` 调用全部 7 个 `registerXxxHandlers()` 函数
- [ ] `electron/main.ts` 无内联 `ipcMain.handle`（全部通过 register 函数注入）
- [ ] `npm run check:electron` 通过

## 全局验证

- [ ] `npm run check` 通过
- [ ] `npm run check:electron` 通过
- [ ] `npm run lint` 通过
- [ ] 无代码修改（全部为验证 + 评估任务）

## 已知遗留问题（非本轮范围）

- **P3-02 Repository 层**：本轮评估为不必要。未来若出现以下信号可重新评估：(1) 服务层出现明显的 N+1 查询重复模式；(2) 引入新的数据源（如 MongoDB / 外部 API）需要抽象数据访问层；(3) Web 多实例部署需要为缓存层提供更精细的失效控制。
- **promptService → factory 单向依赖**：当前是单向依赖不构成循环，但 promptService 直接 import factory 是架构偏好问题。未来若要彻底解耦可让 promptService 接收 `getAIProviderForTask` 作为参数注入，但当前不必要。
