# Round 1 P0 安全与校验修复 Spec（顺序 8-14）

## Why

`optimization-roadmap.md` 第一轮 P0 剩余 7 项仍未修复，其中 5 项涉及安全漏洞（document_chunks 无 RLS、Electron/Capacitor 配置宽松、硬编码 anon key、路由层绕 RLS、aiActions 跳过 zod 校验），2 项涉及正确性/一致性（流式 retry 重复内容、validate.ts 响应格式不一致）。这些问题在生产部署后会暴露为安全越权、用户隐私泄露、前端体验异常等故障。

## What Changes

- **P0-08**: 为 `document_chunks` 表启用 RLS，策略参照 `knowledge_points`（owner/visibility 双轨）
- **P0-13**: Electron `sandbox: true`；Capacitor `cleartext/allowMixedContent/webContentsDebuggingEnabled` 仅在 dev 开启
- **P0-14**: 移除 `authConfig.ts` 硬编码 anon key，改读 `VITE_SUPABASE_ANON_KEY`；dev fallback 仅在 env 缺失时提示
- **P0-03**: `validate.ts` 失败时抛 `AppError(VALIDATION_ERROR, { details })`，统一走 errorHandler
- **P0-04**: `aiActions.ts` 4 处 `(req as any).user.id` 改用 `AuthRequest`；为 4 个路由（list/create/update/delete/execute）添加 zod schema 校验
- **P0-01**: `streamChatCompletion` 不再用 `withTimeoutAndRetry` 包裹整个流式调用；改为仅对"建立流连接"做 timeout，开始接收 chunks 后不可重试
- **P0-02**: 10 个路由文件将 `getSupabaseAdmin()` 替换为 `req.supabase`；仅 `auth.refresh`、`database.reset`、admin 接口保留 admin client

## Impact

- **Affected specs**:
  - 数据库安全：document_chunks RLS
  - 前端安全：Electron sandbox、Capacitor 配置、authConfig
  - API 校验：validate.ts、aiActions.ts
  - AI 流式：chatService.streamChatCompletion
  - 路由层安全：10 个路由文件的 supabase client 替换
- **Affected code**:
  - `supabase/migrations/13_rls_policies.sql`（追加 document_chunks 策略）
  - `supabase/migrations/26_document_chunks.sql`（启用 RLS）
  - `electron/main.ts`（sandbox: true）
  - `capacitor.config.ts`（条件化 cleartext/mixedContent/debugging）
  - `src/config/authConfig.ts`（移除硬编码 key）
  - `api/middleware/validate.ts`（改用 AppError）
  - `api/routes/aiActions.ts`（AuthRequest + zod schemas）
  - `api/schemas/`（新增 aiAction 相关 schema）
  - `api/services/ai/chatService.ts`（流式 retry 逻辑重构）
  - 10 个路由文件（admin client 替换为 req.supabase）

## ADDED Requirements

### Requirement: document_chunks 行级安全策略

`document_chunks` 表 SHALL 启用 RLS，SELECT 策略参照 `knowledge_points`：
- 所属 knowledge_point 的 owner_id = auth.uid() 可读
- 所属 knowledge_point 的 visibility = 'public' 可读
- public graph 内的 knowledge_point 关联分块可读
- INSERT/UPDATE/DELETE 限 owner

#### Scenario: 用户读取自己的文档分块
- **WHEN** 用户 A 查询与自己 knowledge_point 关联的 document_chunks
- **THEN** 返回分块数据

#### Scenario: 用户读取他人私有分块
- **WHEN** 用户 A 查询与用户 B 私有 knowledge_point 关联的 document_chunks
- **THEN** 返回空集合

### Requirement: Capacitor 安全配置按环境区分

`capacitor.config.ts` SHALL 根据 `NODE_ENV`/`MODE` 切换：
- dev: `cleartext: true`, `allowMixedContent: true`, `webContentsDebuggingEnabled: true`
- production: 全部 false

#### Scenario: 生产构建
- **WHEN** 执行 `npm run build` (NODE_ENV=production)
- **THEN** cleartext/allowMixedContent/webContentsDebuggingEnabled 均为 false

### Requirement: aiActions 路由 zod schema 校验

`aiActions.ts` 的 4 个写路由 SHALL 通过 `validate({ body: ... })` 校验：
- POST `/` - createActionSchema
- PUT `/:id` - updateActionSchema
- POST `/execute` - executeActionSchema

#### Scenario: 创建 action 时 scope 缺失
- **WHEN** POST `/ai-actions` body 中 `scope` 字段缺失
- **THEN** 返回 400 + VALIDATION_ERROR + details 字段说明缺失字段

### Requirement: 流式响应不可重试

`streamChatCompletion` SHALL 只对"建立流连接"做 timeout；一旦开始接收 chunks 不可重试，避免重复内容。

#### Scenario: 流式连接建立失败
- **WHEN** 首次 `chat.completions.create({ stream: true })` 抛错
- **THEN** 可重试至 maxRetries 次

#### Scenario: 流式接收中途中断
- **WHEN** 已接收部分 chunks 后流断开
- **THEN** 不重试，向上抛错，由前端处理重连

## MODIFIED Requirements

### Requirement: validate.ts 错误响应格式

`validate.ts` 校验失败时 SHALL 抛 `new AppError(ErrorCodes.VALIDATION_ERROR, { details: errorMessages })`，由 errorHandler 统一返回 `{ success, code, message, requestId, timestamp, details }`。

### Requirement: authConfig.ts 不硬编码 anon key

`authConfig.ts` SHALL 移除 `LOCAL_SUPABASE_ANON_KEY` 硬编码常量，dev fallback 改为读取 `.env.development` 的 `VITE_SUPABASE_ANON_KEY`，env 缺失时抛错或返回空字符串并打印警告。

### Requirement: 路由层使用 req.supabase

所有非 admin 接口的路由 SHALL 使用 `req.supabase`（用户上下文 client）执行用户级 CRUD，仅以下场景使用 `getSupabaseAdmin()`：
- `auth.refresh`：refresh token 验证需查 users 表
- `database.reset`：本地数据库重置
- 显式标注的 admin 接口（如 systemMonitor、admin 路由）

### Requirement: Electron sandbox 启用

`electron/main.ts` 的 BrowserWindow 配置 SHALL 设置 `sandbox: true`；preload 只通过 `ipcRenderer` 与主进程通信。

## REMOVED Requirements

### Requirement: aiActions.ts 中 `(req as any).user.id` 的使用

**Reason**: 违反项目规则（禁用 `any`），且 `req.user` 在 `AuthRequest` 中已类型化。
**Migration**: 改用 `AuthRequest` 类型断言，直接 `req.user.id`。
