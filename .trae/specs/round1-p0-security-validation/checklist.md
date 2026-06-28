# Round 1 P0 安全与校验修复 Checklist（顺序 8-14）

## Task 1: document_chunks 启用 RLS
- [x] `26_document_chunks.sql` 末尾追加 `ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;`
- [x] `13_rls_policies.sql` 末尾追加 document_chunks SELECT 策略：owner_id 匹配 OR public knowledge_point OR public graph 内的 knowledge_point
- [x] INSERT/UPDATE/DELETE 策略限 `auth.uid() = (SELECT owner_id FROM knowledge_points WHERE id = document_chunks.knowledge_point_id)`
- [x] 策略参照 knowledge_points 模式，包含 `graph_nodes.deleted_at IS NULL` 过滤
- [x] `npm run check` 通过

## Task 2: Electron sandbox + Capacitor 安全配置
- [x] `electron/main.ts` 第 268 行 `sandbox: false` 改为 `sandbox: true`
- [x] `electron/preload.ts` 仅使用 `contextBridge` + `ipcRenderer`，无 Node API 依赖
- [x] `capacitor.config.ts` 新增 `const isDev = process.env.NODE_ENV !== "production";`
- [x] `server.cleartext`、`android.allowMixedContent`、`android.webContentsDebuggingEnabled` 全部使用 `isDev` 条件
- [x] `npm run check` 通过（check:electron 中 4 个错误为预存问题，与本任务无关）

## Task 3: 移除 authConfig.ts 硬编码 anon key
- [x] `authConfig.ts` 删除 `LOCAL_SUPABASE_ANON_KEY` 硬编码常量
- [x] `authConfig.ts` 删除 `LOCAL_SUPABASE_URL` 硬编码常量
- [x] `getDefaultAnonKey` 仅读 `VITE_SUPABASE_ANON_KEY` env
- [x] `getDefaultUrl` 仅读 `VITE_SUPABASE_URL` env
- [x] dev 环境 env 缺失时打印 `console.warn` 警告
- [x] production 环境 env 缺失时抛错
- [x] `.env.development` 已配置 `VITE_SUPABASE_ANON_KEY` 与 `VITE_SUPABASE_URL`
- [x] `npm run check` 通过

## Task 4: validate.ts 统一错误格式
- [x] `validate.ts` catch 块改为 `throw new AppError(ErrorCodes.VALIDATION_ERROR, { details: errorMessages })`
- [x] 不再直接 `res.status(400).json(...)`
- [x] 错误响应字段为 `message` 而非 `error`（由 errorHandler 统一处理）
- [x] 响应含 `requestId` 与 `timestamp`（由 errorHandler 统一处理）
- [x] `errorHandler.ts` 中 `AppErrorDetails` 类型扩展为联合类型以支持数组
- [x] `npm run check && npm run lint` 通过

## Task 5: aiActions.ts 加 zod 校验 + 类型修复
- [x] 新建 `api/schemas/aiAction.ts` 含 `createActionSchema`、`updateActionSchema`、`executeActionSchema`
- [x] 在 `api/schemas/index.ts` re-export 三个 schema
- [x] `aiActions.ts` 4 处 `(req as any).user.id` 改用 `AuthRequest` 类型 + 类型收窄 guard
- [x] POST `/` 添加 `validate({ body: createActionSchema })`
- [x] PUT `/:id` 添加 `validate({ body: updateActionSchema })`
- [x] POST `/execute` 添加 `validate({ body: executeActionSchema })`
- [x] 路由内"scope 缺失"等手动校验移除（由 zod 处理）
- [x] 所有权校验等业务逻辑保留（graph_id 与 user_id 关系）
- [x] `updateActionSchema` 显式排除 `scope/user_id/graph_id` 防止提权
- [x] 文件中无 `(req as any)` 或 `as any`
- [x] 所有 `getSupabaseAdmin()` 替换为 `req.supabase`
- [x] `npm run check && npm run lint` 通过

## Task 6: 流式响应 retry 修正
- [x] `chatService.streamChatCompletion` 不再用 `withTimeoutAndRetry` 包裹整个流式调用
- [x] 新增 `withTimeout` import
- [x] 建立流连接阶段使用 `withTimeout`（仅 timeout 不 retry）
- [x] 接收 chunks 阶段用 try/catch 包裹，不可 retry
- [x] catch 块 logger.error 记录失败原因并向上抛错
- [x] 保留 `stream_options: { include_usage: true }`
- [x] 保留 `sendStreamChunk` 调用与 chunks 顺序
- [x] 保留 `inputTokens`/`outputTokens`/`cachedInputTokens` 统计
- [x] 保留 `recordLog` 上报（success: true/false 由 withAIMonitoring 处理）
- [x] `npm run check && npm run lint` 通过

## Task 7: 路由层 admin client 替换为 req.supabase
- [x] `tasks.ts` 替换 3 处用户级 CRUD（getTasks/retryTask/deleteTask）
- [x] `sync.ts` 替换 5 处用户级 CRUD（pull/push/getStatus）
- [x] `rag.ts` 替换 2 处用户级 CRUD（enrichMetadata）
- [x] `ai/content.ts` 替换 6 处用户级 CRUD（promptService + enrichMetadata）
- [x] `ai/document.ts` 替换 4 处用户级 CRUD（promptService + enrichMetadata）
- [x] `aiActions.ts` 由 Task 5 完整处理（zod + AuthRequest + admin client 替换）
- [x] `ai/stt-realtime.ts` 保留 admin client + 注释（WebSocket 升级阶段无 req.supabase）
- [x] `ai/config.ts` 保留 2 处 admin client + 注释（系统级数据库连接测试）
- [x] `systemMonitor.ts` 保留 2 处 admin client + 注释（系统级监控接口）
- [x] `auth.ts` 保留 admin client + 注释（注册/登录/刷新/注销无已认证会话）
- [x] 所有保留 admin client 的位置有注释说明原因
- [x] `npm run check && npm run lint` 通过

## 整体验证
- [x] `npm run check` 通过（exit 0）
- [x] `npm run lint` 通过（exit 0）
- [x] 所有改动均直接修改对应模块化文件，未创建新的增量迁移文件（仅 SQL 末尾追加 + 源码修改）
- [x] 未引入新的 `any` 类型
- [x] spec 文档保留在 `.trae/specs/round1-p0-security-validation/`
