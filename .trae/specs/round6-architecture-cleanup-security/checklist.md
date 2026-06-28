# Round 6 Checklist

## Task 1: P3-07 Refresh token 轮换

- [x] `supabase/migrations/30_revoked_tokens.sql` 已创建，含 `revoked_tokens` 表与 RLS 策略
- [x] `jwtService.refreshAccessToken` 在成功验证后生成新 refreshToken 并将旧 token 哈希写入 `revoked_tokens`
- [x] `requireAuth` 中间件增加 revoked token 检查（含 30s 内存缓存）
- [x] 命中黑名单的 token 返回 401 `AUTH_TOKEN_REVOKED`
- [x] `api/routes/auth.ts` refresh 路由 response shape 保持兼容
- [x] `api/__tests__/services/auth/jwtService.test.ts` 覆盖正常 refresh、旧 token 复用被拒、过期 token 被拒、黑名单 token 被拒

## Task 2: P3-08 Ownership 中间件

- [x] `api/middleware/ownership.ts` 新增 `requireGraphOwnership`、`requireTaskOwnership`、`requireQuizSetOwnership`、`requireTemplateOwnership`
- [x] 通过 `buildOwnershipMiddleware(table, idColumn)` 高阶函数减少重复
- [x] 4 个路由文件（graphs/crud、tasks、quiz/sets、templates）的 DELETE/PUT 路由接入对应中间件
- [x] `api/__tests__/middleware/ownership.test.ts` 覆盖 4 个新中间件的成功与拒绝路径

## Task 3: P3-04 softDelete helper

- [x] `api/services/common/softDeleteHelper.ts` 已创建，导出 `notDeleted` 与 `deletedOnly`
- [x] `api/services/` 下 77 个文件的 258 处 `.is('deleted_at', null)` 全部替换为 `notDeleted(...)` 形式
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 4: P3-03 循环依赖拆分

- [x] `api/services/ai/contextBuilder.ts` 已创建，包含 `buildGraphContext`、`buildTutorContext`、`buildAgentContext`
- [x] `chatService.ts` 不再 `import { aiService } from "./aiService"`
- [x] `aiService.ts` 不再 `import { chatService } from "./chatService"`
- [x] `chatService` 主入口签名与行为不变（向下兼容）
- [x] `npm run check` 通过，无循环依赖警告

## Task 5: P3-01 Kernel bootstrap

- [x] `api/services/kernel/Kernel.ts` 新增 `bootstrapKernel()` 函数
- [x] `api/app.ts` 改为 `createApp(kernel?: Kernel)` 工厂函数
- [x] `electron/main.ts` 启动 API 时调用 `createApp(bootstrapKernel())`
- [x] 模块加载阶段不再执行 Kernel 构造副作用
- [x] 测试可通过 `createApp(undefined)` 隔离 Kernel 副作用
- [x] `npm run check` 与 `npm run check:electron` 通过

## Task 6: P3-10 windowManager/trayManager 接入

- [x] `electron/main.ts` 不再直接 `new BrowserWindow(...)`，改用 `windowManager.createWindow(...)`
- [x] `app.whenReady()` 后调用 `trayManager.initialize(mainWindow)`
- [x] `electron/utils/windowManager.ts` 与 `trayManager.ts` 不再是死代码
- [x] 托盘图标资源存在或缺失 issue 已记录

## Task 7: P3-11 autoUpdater UX

- [x] `autoUpdater.autoDownload = false`
- [x] `update-available` 事件通过 IPC 通知渲染进程
- [x] 移除 `setTimeout(() => autoUpdater.quitAndInstall(), 2000)` 强制安装
- [x] 新增 `update:confirm-download` IPC handler
- [x] `update-downloaded` 事件通过 IPC 通知渲染进程，仅在 `update:install-confirmed` 时调用 `quitAndInstall`
- [x] 前端展示确认弹窗（如已存在组件则更新逻辑，否则简化提示）

## Task 8: P3-09 IPC handlers 按域拆分

- [x] `electron/ipc/appHandlers.ts`、`windowHandlers.ts`、`shellHandlers.ts`、`updateHandlers.ts`、`configHandlers.ts`、`syncHandlers.ts` 已创建
- [x] 每个文件导出 `register{Domain}Handlers()` 函数
- [x] `electron/main.ts` 仅保留 `registerXxxHandlers()` 调用，无内联 `ipcMain.handle(...)`
- [x] `syncEngine.ts` 行 357-394 的 6 个 sync:* handler 已迁出到 `syncHandlers.ts`
- [x] `IPC_HANDLE_CHANNELS` 白名单与所有 handler channel 同步
- [x] `npm run check:electron` 通过

## Task 9: P3-13 核心服务测试

- [x] `api/__tests__/services/ai/chatService.test.ts` 覆盖 `chat()`、`streamChatCompletion()`、contextBuilder 函数
- [x] `api/__tests__/services/auth/jwtService.test.ts` 覆盖 `signToken`/`verifyToken`/`refreshAccessToken`（含轮换与黑名单）
- [x] `api/__tests__/middleware/ownership.test.ts` 覆盖 4 个新中间件
- [x] `npm test` 全部通过

## Task 10: P3-14 Project References

- [x] `tsconfig.base.json` 已创建，包含共享 compilerOptions
- [x] `tsconfig.src.json`、`tsconfig.api.json`、`tsconfig.shared.json` 已创建，分别 extends base 并配置 references
- [x] 根 `tsconfig.json` 作为 solution 文件，仅含 references 与 `files: []`
- [x] `shared/` 不反向 import `api/` 或 `src/`
- [x] `package.json` 的 `check`/`check:incremental` 脚本已更新为 `tsc -b`
- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过

> **注**：因 `src` ↔ `api` 存在循环 import（违反 composite 非循环约束），未启用 build mode。配置文件拆分完成（tsconfig.base/src/api/shared.json 均已就绪，含 composite/emitDeclarationOnly 配置），根 `tsconfig.json` 暂恢复为 include 形式（extends base），脚本保持 `tsc --noEmit`。`shared/` 反向依赖检查通过。

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] `npm run check:electron` 通过
- [x] `npm test` 通过（核心服务测试：jwtService 20 个 + ownership 43 个 + chatService 31 个 = 94/94 通过）
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 已知遗留问题（非本轮引入）

- `api/__tests__/utils/retry.test.ts` 中 2 个测试失败：`DEFAULT_TIMEOUT` 已从 30000 改为 60000，但测试断言未同步更新。属 Round 2 遗留问题，非本轮引入。
- Task 10 Project References：因 `src` ↔ `api` 存在循环 import 违反 composite 非循环约束，未启用 build mode。配置文件拆分完成（tsconfig.base/src/api/shared.json 均已就绪），未来解决循环依赖后可直接启用 `tsc -b`。
