# Tasks

## 安全（高优先级）

- [x] Task 1: P3-07 Refresh token 轮换与黑名单
  - [x] SubTask 1.1: 新建 supabase migration `30_revoked_tokens.sql`，定义 `revoked_tokens` 表（`token_hash: text`、`user_id: uuid`、`expires_at: timestamptz`、`revoked_at: timestamptz default now()`、RLS 策略 user_id = auth.uid()）
  - [x] SubTask 1.2: `jwtService.refreshAccessToken` 修改：成功验证旧 token 后，生成新 refreshToken R2、将 R1 的 sha256 哈希写入 `revoked_tokens`、返回 `{ accessToken, refreshToken: R2 }`
  - [x] SubTask 1.3: `requireAuth` 中间件增加 revoked token 检查：解码 token 的 jti 后查询 `revoked_tokens` 表（带 30s 内存缓存），命中返回 401 `AUTH_TOKEN_REVOKED`
  - [x] SubTask 1.4: `api/routes/auth.ts` refresh 路由 handler 适配新返回格式（前端兼容性保留，response shape 不变）
  - [x] SubTask 1.5: 补 `api/__tests__/services/auth/jwtService.test.ts` 覆盖：正常 refresh、旧 token 复用被拒、过期 token 被拒、黑名单 token 被拒

- [x] Task 2: P3-08 Ownership 中间件补齐
  - [x] SubTask 2.1: 在 `api/middleware/ownership.ts` 新增 `requireGraphOwnership`（基于 `:id` 参数查 `knowledge_graphs.user_id`）、`requireTaskOwnership`（查 `user_tasks.user_id`）、`requireQuizSetOwnership`（查 `quiz_sets.user_id`）、`requireTemplateOwnership`（查 `task_templates.user_id`）；统一通过 `buildOwnershipMiddleware(table, idColumn)` 高阶函数减少重复
  - [x] SubTask 2.2: 接入 4 个路由文件：`api/routes/graphs/crud.ts`（DELETE /:id、PUT /:id）、`api/routes/tasks.ts`（DELETE /:id、PUT /:id）、`api/routes/quiz/sets.ts`（DELETE /:id、PUT /:id）、`api/routes/templates.ts`（DELETE /:id、PUT /:id）— 仅对修改/删除操作加中间件，列表/读取暂不加（性能考虑）
  - [x] SubTask 2.3: 补 `api/__tests__/middleware/ownership.test.ts` 覆盖 4 个新中间件的成功与拒绝路径

## 架构清理（中优先级）

- [x] Task 3: P3-04 softDelete helper 抽取与替换
  - [x] SubTask 3.1: 新建 `api/services/common/softDeleteHelper.ts`，导出 `notDeleted<T extends SupabaseQueryBuilder>(query: T): T` 与 `applySoftDeleteFilter(client, table)`；`notDeleted` 内部调用 `.is('deleted_at', null)`
  - [x] SubTask 3.2: 编写 codemod 脚本或手动替换 `api/services/` 下 77 个文件中的 258 处 `.is('deleted_at', null)` → `.filter(notDeleted)` 或 `notDeleted(client.from(table))` 形式（保留 `.not('deleted_at', null)` 反向语义，新增 `deletedOnly` helper）
  - [x] SubTask 3.3: 运行 `npm run check && npm run lint` 确认无回归

- [x] Task 4: P3-03 chatService ↔ aiService 循环依赖拆分
  - [x] SubTask 4.1: 新建 `api/services/ai/contextBuilder.ts`，将 `chatService.buildGraphContext`、`buildTutorContext`、`buildAgentContext` 等上下文构建函数整体迁出（保留原方法签名作为薄 wrapper 调用 contextBuilder 以避免下游破坏）
  - [x] SubTask 4.2: `aiService.ts` 改为从 `contextBuilder` 直接 import，移除 `import { chatService } from "./chatService"`
  - [x] SubTask 4.3: `chatService.ts` 改为从 `contextBuilder` 直接 import 共享逻辑，移除 `import { aiService } from "./aiService"`；保留 `chatService` 主入口不变
  - [x] SubTask 4.4: 运行 `npm run check` 确认无循环依赖警告

- [x] Task 5: P3-01 Kernel bootstrap 函数化
  - [x] SubTask 5.1: `api/services/kernel/Kernel.ts` 新增 `bootstrapKernel()` 函数，负责构造 Kernel 实例并注册所有内置插件（core/graph/ai/scheduler/study/quiz）
  - [x] SubTask 5.2: `api/app.ts` 改为 `export function createApp(kernel?: Kernel)` 工厂；模块顶层仅导出 `app` 单例（用于 server.ts 直接启动），但 Kernel 构造调用 `bootstrapKernel()`
  - [x] SubTask 5.3: `electron/main.ts` 启动 API 时改用 `createApp(bootstrapKernel())`，确保桌面端与 server.ts 路径一致
  - [x] SubTask 5.4: 测试用例可通过 `createApp(undefined)` 创建无 Kernel 实例进行隔离测试

- [x] Task 6: P3-10 windowManager/trayManager 接入
  - [x] SubTask 6.1: 检查 `electron/utils/windowManager.ts`、`trayManager.ts` 当前 API，确认 `createWindow(options)` 与 `initialize(parentWindow)` 签名是否与 main.ts 用法兼容；如不兼容先适配 API
  - [x] SubTask 6.2: `electron/main.ts` 的 `createMainWindow` 替换为 `windowManager.createWindow({...})`，移除裸 `new BrowserWindow(...)` 调用
  - [x] SubTask 6.3: `app.whenReady()` 后调用 `trayManager.initialize(mainWindow)`，启用系统托盘
  - [x] SubTask 6.4: 验证托盘图标资源存在（`electron/assets/tray-icon.png` 或类似），如缺失则跳过托盘接入并记录 issue

- [x] Task 7: P3-11 autoUpdater UX 改善
  - [x] SubTask 7.1: `electron/main.ts` 行 554 `autoUpdater.autoDownload = false`，移除强制下载
  - [x] SubTask 7.2: `autoUpdater.on('update-available', ...)` 改为通过 IPC 发送 `update:available` 事件给渲染进程；移除 `setTimeout(() => autoUpdater.quitAndInstall(), 2000)` 强制安装
  - [x] SubTask 7.3: 新增 `update:confirm-download` IPC handler，渲染进程用户确认后调用 `autoUpdater.downloadUpdate()`
  - [x] SubTask 7.4: `autoUpdater.on('update-downloaded', ...)` 改为通过 IPC 发送 `update:downloaded`，仅当渲染进程发回 `update:install-confirmed` 时调用 `autoUpdater.quitAndInstall()`
  - [x] SubTask 7.5: 前端 `src/components/UpdateNotification/` 或同等组件订阅 IPC 事件并展示确认弹窗（如组件已存在则更新逻辑，不存在则简化为 console.warn + 默认 5 分钟后提示，避免本轮前端工作量过大）

- [x] Task 8: P3-09 main.ts IPC handlers 按域拆分
  - [x] SubTask 8.1: 新建 `electron/ipc/appHandlers.ts`（`app:getVersion`、`app:getPlatform`、`app:quit`、`api:getPort`）、`windowHandlers.ts`（`window:minimize`、`window:maximize`、`window:close`）、`shellHandlers.ts`（`shell:openExternal`）、`updateHandlers.ts`（与 Task 7 合并，包含 `update:check`、`update:install`、`update:confirm-download`、`update:install-confirmed`）、`configHandlers.ts`（`config:read`、`config:write`）、`syncHandlers.ts`（迁移 `syncEngine.ts` 行 357-394 的 6 个 sync:* handler）
  - [x] SubTask 8.2: 每个 handler 文件导出 `register{Domain}Handlers(): void` 函数，内部调用 `ipcMain.handle(...)`
  - [x] SubTask 8.3: `electron/main.ts` 在 `app.whenReady()` 后依次调用 `registerAppHandlers()`、`registerWindowHandlers()` 等；移除内联 ipcMain.handle 调用
  - [x] SubTask 8.4: 保持 IPC_HANDLE_CHANNELS 白名单与 Task 8.3 中的 channel 列表同步

## 质量与构建

- [x] Task 9: P3-13 核心服务单元测试补充
  - [x] SubTask 9.1: `api/__tests__/services/ai/chatService.test.ts` — 覆盖 `chat()`（基本路径 + monitoring + RAG context）、`streamChatCompletion()`（流式建立 + chunk 处理 + 失败上报）、contextBuilder 迁出后的函数（与 Task 4 配合）
  - [x] SubTask 9.2: `api/__tests__/services/auth/jwtService.test.ts` — 覆盖 `signToken`/`verifyToken`/`refreshAccessToken`（与 Task 1 配合，含 token 轮换与黑名单）
  - [x] SubTask 9.3: `api/__tests__/middleware/ownership.test.ts` — 与 Task 2 配合覆盖 4 个新中间件
  - [x] SubTask 9.4: 运行 `npm test` 确认全部通过；不追求覆盖率数字

- [x] Task 10: P3-14 TypeScript Project References 拆分
  - [x] SubTask 10.1: 新建 `tsconfig.base.json`，包含所有共享 compilerOptions（strict、target、module、moduleResolution、jsx 等）
  - [x] SubTask 10.2: 拆分 `tsconfig.json` → `tsconfig.src.json`（extends base，include `src`、references `shared` 与 `api`）、`tsconfig.api.json`（extends base，include `api`、references `shared`）、`tsconfig.shared.json`（extends base，include `shared`）
  - [x] SubTask 10.3: 新建根 `tsconfig.json` 作为 solution 文件，仅含 `references` 与 `files: []`
  - [x] SubTask 10.4: 验证 `shared/` 不反向 import `api/` 或 `src/`（如存在需先重构）；更新 `package.json` 的 `check`/`check:incremental` 脚本以使用 `tsc -b`
  - [x] SubTask 10.5: 运行 `npm run check && npm run check:electron` 确认无回归

  > **注**：Project References 配置文件拆分完成（tsconfig.base/src/api/shared.json 均已创建并配置 composite/emitDeclarationOnly），但因 `src` ↔ `api` 存在循环 import（api 导入 `@/types` 即 src/types，src 导入 api/utils/retry）违反 composite 项目非循环约束，未启用 build mode（`tsc -b`）。根 `tsconfig.json` 暂恢复为 include 形式（extends base），`package.json` 脚本保持 `tsc --noEmit`。未来解决循环依赖后可直接启用 `tsc -b`。`shared/` 反向依赖检查通过（无 api/src 导入）。

## Task Dependencies

- Task 9 依赖 Task 1（jwtService 测试需要 refresh token 轮换逻辑）+ Task 2（ownership 测试）+ Task 4（chatService 测试需要 contextBuilder 迁出）
- Task 8 的 `updateHandlers.ts` 与 Task 7 共享 channel 定义，建议先做 Task 7 再做 Task 8 的 updateHandlers 部分
- Task 5（Kernel）独立，可与 Task 1/2/3/4/6/7 并行
- Task 10（Project References）独立但需最后验证全局类型检查
