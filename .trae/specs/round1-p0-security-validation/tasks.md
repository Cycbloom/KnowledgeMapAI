# Tasks

- [x] Task 1: P0-08 启用 `document_chunks` 表 RLS
  - [x] SubTask 1.1: 在 `supabase/migrations/26_document_chunks.sql` 末尾追加 `ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;`
  - [x] SubTask 1.2: 在 `supabase/migrations/13_rls_policies.sql` 末尾追加 document_chunks 的 SELECT/INSERT/UPDATE/DELETE 策略（参照 knowledge_points 的 owner/visibility 双轨模式 + public graph 关联）
  - [x] SubTask 1.3: 通过本地 Supabase 重置 + SQL 验证：用户 A 无法查询到用户 B 私有 knowledge_point 关联的 document_chunks

- [x] Task 2: P0-13 Electron sandbox + Capacitor 安全配置
  - [x] SubTask 2.1: 在 `electron/main.ts` 第 268 行将 `sandbox: false` 改为 `sandbox: true`
  - [x] SubTask 2.2: 检查 preload.ts 是否依赖 Node API；preload 仅用 ipcRenderer，无需桥接
  - [x] SubTask 2.3: 修改 `capacitor.config.ts`：新增 `isDev` 辅助函数，server.cleartext、android.allowMixedContent、android.webContentsDebuggingEnabled 全部使用 `isDev` 条件
  - [x] SubTask 2.4: 运行 `npm run check` 验证类型无误（check:electron 中的 4 个错误为预存问题，与本任务无关）

- [x] Task 3: P0-14 移除 `authConfig.ts` 硬编码 anon key
  - [x] SubTask 3.1: 删除 `src/config/authConfig.ts` 第 4-5 行的 `LOCAL_SUPABASE_ANON_KEY` 硬编码常量
  - [x] SubTask 3.2: 修改 `getDefaultAnonKey`：仅读 `VITE_SUPABASE_ANON_KEY` env；env 缺失时 dev 返回空字符串并 console.warn 警告，production 抛错
  - [x] SubTask 3.3: 同步修改 `LOCAL_SUPABASE_URL` 的处理（虽非敏感，但保持一致：production 必须从 env 读取）
  - [x] SubTask 3.4: 确认 `.env.development` 文件存在并已配置 `VITE_SUPABASE_ANON_KEY`（已存在）
  - [x] SubTask 3.5: 运行 `npm run check` 验证前端类型无误

- [x] Task 4: P0-03 `validate.ts` 改用 AppError 统一错误格式
  - [x] SubTask 4.1: 修改 `api/middleware/validate.ts`：catch 块改为 `throw new AppError(ErrorCodes.VALIDATION_ERROR, { details: errorMessages })`
  - [x] SubTask 4.2: 扩展 `errorHandler.ts` 中 `AppErrorDetails` 类型为联合类型以支持数组（原 interface 仅支持对象）
  - [x] SubTask 4.3: 运行 `npm run check` 验证类型无误
  - [x] SubTask 4.4: 响应字段为 `message` 而非 `error`，含 `requestId`/`timestamp`（由 errorHandler 统一处理）

- [x] Task 5: P0-04 `aiActions.ts` 加 zod 校验 + 类型修复 + admin client 替换
  - [x] SubTask 5.1: 新建 `api/schemas/aiAction.ts` 定义 `createActionSchema`、`updateActionSchema`、`executeActionSchema`（字段对齐 `aiActionService.ts` 实际接口）
  - [x] SubTask 5.2: 在 `api/schemas/index.ts` re-export 三个 schema
  - [x] SubTask 5.3: 修改 `api/routes/aiActions.ts`：4 处 `(req as any).user.id` 改用 `AuthRequest` 类型 + 类型收窄 guard
  - [x] SubTask 5.4: 为 POST `/`、PUT `/:id`、POST `/execute` 三个路由添加 `validate({ body: ... })` 中间件
  - [x] SubTask 5.5: 移除路由内的"scope 缺失"等手动校验，交由 zod 处理；保留所有权校验等业务逻辑
  - [x] SubTask 5.6: 所有 `getSupabaseAdmin()` 替换为 `req.supabase`，移除 admin client import
  - [x] SubTask 5.7: 运行 `npm run check && npm run lint` 验证无 any、无类型错误

- [x] Task 6: P0-01 流式响应 retry 修正
  - [x] SubTask 6.1: 在 `api/services/ai/chatService.ts` 重构 `streamChatCompletion`：将流式 create 从 `withTimeoutAndRetry` 拆出
  - [x] SubTask 6.2: 建立流连接阶段使用 `withTimeout`（仅 timeout 不 retry），新增 import
  - [x] SubTask 6.3: 接收 chunks 阶段用 try/catch 包裹，不可 retry，向上抛错
  - [x] SubTask 6.4: 保留流式阶段错误上报（success: false 由 withAIMonitoring 自动处理）
  - [x] SubTask 6.5: 保留 stream_options/sendStreamChunk/inputTokens/outputTokens/recordLog/sendStreamDone 全部原有功能
  - [x] SubTask 6.6: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 7: P0-02 路由层 admin client 替换为 req.supabase
  - [x] SubTask 7.1: 审计 9 个路由文件（aiActions.ts 由 Task 5 处理）
  - [x] SubTask 7.2: `tasks.ts` 替换 3 处用户级 CRUD（getTasks/retryTask/deleteTask）
  - [x] SubTask 7.3: `sync.ts` 替换 5 处用户级 CRUD（pull/push/getStatus）
  - [x] SubTask 7.4: `rag.ts` 替换 2 处用户级 CRUD（enrichMetadata）
  - [x] SubTask 7.5: `ai/content.ts` 替换 6 处用户级 CRUD（promptService + enrichMetadata）
  - [x] SubTask 7.6: `ai/document.ts` 替换 4 处用户级 CRUD（promptService + enrichMetadata）
  - [x] SubTask 7.7: `ai/stt-realtime.ts` 保留 admin client + 加注释（WebSocket 升级阶段无 req.supabase）
  - [x] SubTask 7.8: `ai/config.ts` 保留 2 处 admin client + 加注释（系统级数据库连接测试）
  - [x] SubTask 7.9: `systemMonitor.ts` 保留 2 处 admin client + 加注释（系统级监控接口）
  - [x] SubTask 7.10: `auth.ts` 保留 admin client + 加注释（注册/登录/刷新/注销均无已认证会话）
  - [x] SubTask 7.11: 运行 `npm run check && npm run lint` 验证无误

# Task Dependencies

- Task 5 与 Task 7 在 `aiActions.ts` 上有交叉：Task 5 已完整处理 aiActions.ts（含 zod + AuthRequest + admin client 替换），Task 7 处理其他 9 个文件
- Task 7 的 SubTask 7.6 依赖 7.1-7.5 全部完成
- 其他 Task 之间无强依赖，可并行执行
