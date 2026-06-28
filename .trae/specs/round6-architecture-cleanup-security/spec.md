# Round 6 — 架构清理与安全增强 Spec

## Why

P3 长周期优化项共 14 个，其中 10 个对当前 Electron 桌面应用（含 Web 辅助端）的真实价值与必要性已经核实：

- **安全缺口**：refresh token 不轮换（P3-07）、4 个核心资源缺 ownership 中间件（P3-08）— 即使桌面应用为主，Web 辅助端暴露后风险显著。
- **架构债**：Kernel 在模块加载阶段构造（P3-01）、chatService ↔ aiService 循环依赖（P3-03）、258 处 `.is('deleted_at', null)` 重复（P3-04）、main.ts 内联 10+ IPC handler（P3-09）、windowManager/trayManager 死代码（P3-10）、autoUpdater 强制下载+2 秒强制重启（P3-11）— 影响可测试性、可维护性、用户体验。
- **质量基础**：核心服务（auth/jwtService/chatService）零测试（P3-13）、缺少 Project References 导致增量编译无法按子项目隔离（P3-14）。

剩余 4 个 P3 项（P3-02 Repository 层、P3-05 cacheService 多实例、P3-06 Rate limiter 多实例、P3-12 双 schema 同步）主要面向多实例 Web 部署场景，与当前桌面应用定位不匹配，本轮暂缓。

## What Changes

### 安全
- **P3-07 Refresh token 轮换**：`jwtService.refreshAccessToken` 改为签发新 refreshToken 并将旧 token 加入 `revoked_tokens` 黑名单（DB 表 + 中间件校验）
- **P3-08 Ownership 中间件补齐**：新增 `requireGraphOwnership`、`requireTaskOwnership`、`requireQuizSetOwnership`、`requireTemplateOwnership`，并接入对应路由

### 架构清理
- **P3-01 Kernel bootstrap 函数化**：`api/app.ts` 改为 `createApp(kernel?)` 工厂，Kernel 构造与插件注册移入 `bootstrapKernel()` 显式函数
- **P3-03 服务循环依赖拆分**：抽取 `services/ai/contextBuilder.ts`，将 `buildGraphContext`/`buildTutorContext` 从 chatService 迁出，打破 chatService ↔ aiService 双向 import
- **P3-04 softDelete helper**：新增 `api/services/common/softDeleteHelper.ts`，提供 `notDeleted(query)` 与 `applySoftDeleteFilter(client, table)`，替换 258 处重复条件
- **P3-09 main.ts IPC 拆分**：建立 `electron/ipc/{appHandlers,windowHandlers,shellHandlers,updateHandlers,configHandlers,syncHandlers}.ts`，main.ts 仅保留注册入口
- **P3-10 windowManager/trayManager 接入**：main.ts 改用 `windowManager.createWindow(...)`；`app.whenReady()` 后调用 `trayManager.initialize(mainWindow)`
- **P3-11 autoUpdater UX 改善**：`autoDownload = false`，监听 `update-available` 时通过 IPC 通知渲染进程弹窗询问；下载完成后仅在用户主动点击时安装

### 质量与构建
- **P3-13 核心服务测试**：优先补 `auth/jwtService`、`auth/refreshToken` 轮换、`chatService` 单元测试（不追求覆盖率数字，聚焦安全/核心路径）
- **P3-14 TypeScript Project References**：拆分 `tsconfig.base.json` + `tsconfig.src.json` / `tsconfig.api.json` / `tsconfig.shared.json`，用 `references` 关联

## Impact

- **Affected specs**: round1-p0-security-validation (auth)、round4-crossplatform-sync-architecture (kernel)、round5-type-safety-code-standards (tsconfig)
- **Affected code**:
  - `api/services/auth/jwtService.ts`、`api/middleware/auth.ts`（P3-07）
  - `api/middleware/ownership.ts`、4 个路由文件（P3-08）
  - `api/app.ts`、`api/services/kernel/Kernel.ts`（P3-01）
  - `api/services/ai/chatService.ts`、`aiService.ts`、新建 `contextBuilder.ts`（P3-03）
  - 77 个服务文件（P3-04，批量替换）
  - `electron/main.ts`、新建 6 个 IPC handler 文件（P3-09）
  - `electron/main.ts`、`electron/utils/{windowManager,trayManager}.ts`（P3-10）
  - `electron/main.ts` autoUpdater 段（P3-11）
  - 新建测试文件 `api/__tests__/services/auth/jwtService.test.ts`、`chatService.test.ts`（P3-13）
  - `tsconfig.json` 拆分（P3-14）

## ADDED Requirements

### Requirement: Refresh Token 轮换
The system SHALL issue a new refresh token on every `refreshAccessToken` call and revoke the old token.

#### Scenario: Refresh 成功后旧 token 失效
- **WHEN** client calls refresh endpoint with valid refreshToken R1
- **THEN** response returns new accessToken A2 and new refreshToken R2
- **AND** R1 is added to `revoked_tokens` table
- **AND** subsequent refresh with R1 returns 401 UNAUTHORIZED

#### Scenario: 已撤销 token 被拒绝
- **WHEN** client calls refresh with token R1 that has been revoked
- **THEN** middleware returns 401 with code `AUTH_TOKEN_REVOKED`

### Requirement: Ownership 中间件全资源覆盖
The system SHALL enforce ownership check for graph, task, quizSet, template resources via dedicated middleware.

#### Scenario: 非所有者访问他人图谱
- **WHEN** user U1 calls `DELETE /graphs/:id` where graph belongs to U2
- **THEN** middleware `requireGraphOwnership` returns 403 FORBIDDEN

### Requirement: Kernel 启动可控
The system SHALL provide explicit `bootstrapKernel()` function for Kernel construction and plugin registration, instead of executing at module load time.

#### Scenario: 测试隔离
- **WHEN** test imports `api/app.ts`
- **THEN** no Kernel side effects occur until `bootstrapKernel()` is called explicitly

### Requirement: softDelete 统一过滤
The system SHALL provide `notDeleted(query)` helper for soft-delete filtering, replacing all 258 inline `.is('deleted_at', null)` occurrences.

#### Scenario: 服务调用统一过滤
- **WHEN** service queries user_tasks
- **THEN** query is built via `notDeleted(client.from('user_tasks'))` instead of inline `.is('deleted_at', null)`

### Requirement: IPC handlers 按域拆分
The system SHALL register IPC handlers via dedicated per-domain modules under `electron/ipc/`.

#### Scenario: main.ts 仅保留注册入口
- **WHEN** reviewing `electron/main.ts`
- **THEN** no inline `ipcMain.handle(...)` for app/window/shell/update/config/sync domains
- **AND** each domain has its own `electron/ipc/{domain}Handlers.ts` file

### Requirement: windowManager/trayManager 复用
The system SHALL use `windowManager.createWindow(...)` and `trayManager.initialize(...)` instead of inline `new BrowserWindow(...)` in main.ts.

### Requirement: autoUpdater 用户确认
The system SHALL NOT auto-download or auto-install updates without user consent.

#### Scenario: 检测到更新
- **WHEN** autoUpdater emits `update-available`
- **THEN** main.ts sends `update:available` IPC event to renderer
- **AND** renderer displays confirmation dialog
- **AND** download starts only when user confirms

### Requirement: 核心服务单元测试
The system SHALL provide unit tests for `jwtService` (including refresh token rotation) and `chatService` (including context building).

### Requirement: TypeScript Project References
The system SHALL split `tsconfig.json` into `tsconfig.base.json` + per-domain configs with `references`, enabling per-project incremental builds.

## MODIFIED Requirements

### Requirement: app.ts 导出
`api/app.ts` 改为 `createApp(kernel?: Kernel)` 工厂函数；保留默认导出供 server.ts 与 main.ts 使用，但 Kernel 构造延迟到 `bootstrapKernel()`。

## REMOVED Requirements

### Requirement: 模块加载阶段 Kernel 构造
**Reason**: 导致测试隔离困难、启动顺序耦合
**Migration**: 改为显式 `bootstrapKernel()` 调用

### Requirement: autoUpdater 强制下载与 2 秒重启
**Reason**: 用户可能正在编辑，强制重启导致数据丢失
**Migration**: 改为用户确认式更新流程
