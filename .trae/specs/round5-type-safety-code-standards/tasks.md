# Tasks

- [x] Task 1: P2-05 + P2-06 联合改造（AuthRequest/AuthedRequest 类型 + errorHandler err:unknown + 中间件 as any 清理）
  - [x] SubTask 1.1: 修改 `api/middleware/auth.ts`：将 `AuthRequest.user` 类型从 `any` 改为 `User | undefined`（导入 `@supabase/supabase-js` 的 `User` 类型）；新增 `AuthedRequest` 接口（`user: User` + `supabase: SupabaseClient` 均非空）；`requireAuth` 中间件内部在 `req.user = user` / `req.supabase = createClientWithToken(token)` 处使用 `(req as AuthedRequest)` 赋值；`optionalAuth` 保持 `AuthRequest`（可选语义）
  - [x] SubTask 1.2: 修改 `api/middleware/errorHandler.ts`：将 `errorHandler` 签名从 `(err: any, ...)` 改为 `(err: unknown, ...)`；内部字段访问改为 `(err as { code?: string; statusCode?: number; message?: string; stack?: string; details?: unknown })?.xxx` 形式；保留 `instanceof AppError` 分支（已自带类型守卫）；同步将第 203 行 `(req as any).user?.id` 改为 `req.user?.id`（依赖 SubTask 1.1 的全局类型扩展）
  - [x] SubTask 1.3: 修改 `api/middleware/requestLogger.ts`：将第 54 行与第 141 行的 `(req as any).user?.id` 改为 `req.user?.id`
  - [x] SubTask 1.4: 修改 `api/middleware/rateLimiter.ts`：将第 52 行的 `(req as any).user?.id` 改为 `req.user?.id`
  - [x] SubTask 1.5: 批量清理 `api/routes/**/*.ts` 中 289 处 `req.supabase!`：将受 `requireAuth` 保护的 handler 签名从 `(req: AuthRequest, ...)` 改为 `(req: AuthedRequest, ...)`，删除 `req.supabase!` 中的 `!`；保留 `optionalAuth` 路由的 `req.supabase?` 语义不变

- [x] Task 2: P2-04 路由错误处理风格统一（最小集：3 文件示范）
  - [x] SubTask 2.1: 修改 `api/routes/auth.ts`：移除 `register` 路由的 try/catch + throw AppError 模式，业务错误直接 `throw new AppError(...)`；移除 `login`/`refresh`/`logout`/`user`/`profile` 路由的 try/catch + `next(error)` 模式，改为直接 throw（`express-async-errors` 已在 `api/app.ts:6` 启用）
  - [x] SubTask 2.2: 修改 `api/routes/knowledgePoints.ts`：移除 `list` 等路由的 try/catch 包装
  - [x] SubTask 2.3: 修改 `api/routes/graphs/crud.ts`：移除 `intelligent-suggestions`、`module-gaps`、`module-overlap` 路由的 try/catch 包装

- [x] Task 3: P2-03 zod schema 集中（最小集：knowledgePoints + graphs/crud）
  - [x] SubTask 3.1: 修改 `api/schemas/index.ts`：在合适业务域分组下追加 `createKnowledgePointSchema`、`updateKnowledgePointSchema`、`searchSimilarSchema`、`submitPublicSchema`、`rejectSuggestionSchema`（5 个，从 `knowledgePoints.ts` 行 20-77 迁移）和 `checkTopicSchema`、`batchOperationSchema`（2 个，从 `graphs/crud.ts` 行 27-34 迁移）
  - [x] SubTask 3.2: 修改 `api/routes/knowledgePoints.ts`：移除内联的 5 个 zod schema 定义；从 `../schemas/index` 导入；移除 `import { z } from "zod"`（若文件无其他 zod 使用）
  - [x] SubTask 3.3: 修改 `api/routes/graphs/crud.ts`：移除内联的 2 个 zod schema 定义；从 `../../schemas/index` 导入

- [x] Task 4: P2-07 后端生产代码 any 清理（最小集：top 5 生产文件）
  - [x] SubTask 4.1: 修改 `api/services/ai/aiActionService.ts`（13 处 `: any`）：行 33 `data?: any` 改为联合类型或泛型 `T`；行 137 `const node: any` 改为 `Partial<GraphNode>`；行 146 `const context: any` 定义 `AiActionContext` 接口；行 162/170/187/195/212/223/224/236 的 map 回调参数改为 `Edge` / `GraphNode` / `string`；行 333 `let parsed: any` 改为 `unknown` + 类型守卫；行 343 `const kpUpdates: any` 定义接口
  - [x] SubTask 4.2: 修改 `api/services/ai/searchService.ts`（6 处 `: any`）：逐个替换为具体类型
  - [x] SubTask 4.3: 修改 `api/services/graph/graphVersionService.ts`（6 处）、`api/services/scheduler/taskAnalyticsService.ts`（6 处）、`api/utils/markdownParser.ts`（6 处）：逐个替换为具体类型
  - [x] SubTask 4.4: 测试文件（`autoGraphService.test.ts` 等）本次不修改，仅在 spec 中记录后续清理项

- [x] Task 5: P2-16 前端 global.d.ts + 配置文件清理
  - [x] SubTask 5.1: 新建 `src/types/global.d.ts`：声明 `Window` 接口扩展，含 `Capacitor?: { isNativePlatform(): boolean; ... }` 与 `electronAPI?: { api?: { getPort(): Promise<number>; }; ... }`（按 `mobileApiConfig.ts` 与 `electronConfig.ts` 实际访问的字段）
  - [x] SubTask 5.2: 修改 `src/config/mobileApiConfig.ts`：将行 5 `(window as any).Capacitor` 与行 30 `(window as any).electronAPI || (window as any).electron` 共 3 处 `as any` 移除（依赖 global.d.ts 类型声明）
  - [x] SubTask 5.3: 修改 `src/config/electronConfig.ts`：将行 2、23、25 共 3 处 `(window as any).electronAPI` 移除

- [x] Task 6: P2-16 前端高频生产文件清理
  - [x] SubTask 6.1: 修改 `src/services/api/createApiClient.ts`：行 73 `Promise<any>` 改为 `Promise<AxiosResponse>` 或 `Promise<unknown>`；行 221 `data: error.response?.data as any` 改为定义 `ApiErrorResponse` 接口
  - [x] SubTask 6.2: 修改 `src/components/Layout/Layout.tsx`：行 431 `(user.user_metadata as any)?.name` 改为定义 `UserMetadata` 接口（含 `name?: string`、`avatar_url?: string` 等），或扩展 Supabase `User` 类型；移除 `as any`
  - [x] SubTask 6.3: 修改 `src/three/PlanetView.tsx`：行 25、247 `nodeStatus?: Record<string, any>` 改为定义 `NodeStatus` 接口；行 252 `useRef<any>(null)` 改为 `useRef<OrbitControls | null>(null)`
  - [x] SubTask 6.4: 排查 `src/services/api/contracts/ISchedulerApi.ts`（102 处 any 异常值）：确认是否自动生成；若是生成产物则不在本次范围；若是手写则记录后续清理项

- [x] Task 7: P2-18 前端错误三套机制合并
  - [x] SubTask 7.1: 修改 `src/utils/errors.ts`：移除 4 个 0-调用死代码函数（`handleApiError` 行 360、`createApiErrorHandler`、`withErrorHandling` 行 422、`assertNever`）；仅保留 `AppError` 及子类、`isXxx` 谓词、`wrapUnknownError`、`getUserFriendlyMessage`、`createErrorFromResponse`、`getErrorMessage`、`getErrorCode`、`FrontendErrorCodes` 常量
  - [x] SubTask 7.2: 修改 `src/hooks/common/useError.ts`：移除 `withErrorHandling`（与 `handleAsync` 完全等价，重复）；保留 `handleError`、`handleSilent`、`handleAsync`、`handleAsyncWithFallback`、`parseError`；评估 `ErrorHandlerService` / `useErrorHandlerService` 必要性，若仅测试用则保留
  - [x] SubTask 7.3: 修改 `src/utils/asyncHandler.ts`：保持 `createAsyncHandler` 与 `useAsyncOperation` 不变；内部 `console.error` + `isNetworkError` 判断改为委托 `errors.ts` 的 `wrapUnknownError` + `getUserFriendlyMessage`
  - [x] SubTask 7.4: 修改 `src/__tests__/utils/errors.test.ts`：移除对 4 个已删除函数的测试用例

- [x] Task 8: P2-19 errorReporter PROD 守卫
  - [x] SubTask 8.1: 修改 `src/utils/errorReporter.ts`：将第 107-128 行的 `console.error` override 段用 `if (import.meta.env.PROD)` 包裹；保留 `window.onerror` / `window.onunhandledrejection` 全环境生效
  - [x] SubTask 8.2: 修改 `src/main.tsx`：将第 67-70 行 `if (isElectron) { initErrorReporter(); ... }` 改为 `if (isElectron && import.meta.env.PROD) { ... }`

- [x] Task 9: P2-08 requireAuth 本地 JWT 验证 + 缓存
  - [x] SubTask 9.1: 新增 `SUPABASE_JWT_SECRET` 环境变量到 `.env.example` 与 `.env.development`（开发环境使用 Supabase CLI 默认值 `super-secret-jwt-token-with-at-least-32-characters-long`）
  - [x] SubTask 9.2: 修改 `api/services/auth/jwtService.ts`：新增 `verifySupabaseToken(token: string): { sub: string } | null` 方法，使用 `process.env.SUPABASE_JWT_SECRET` 验证 Supabase 下发的 JWT（区别于 `verifyToken` 用 `JWT_SECRET` 验证 app 自有 JWT）
  - [x] SubTask 9.3: 修改 `api/middleware/auth.ts` 的 `requireAuth`（行 53-86）与 `optionalAuth`（行 88-123）：先用 `jwtService.verifySupabaseToken(token)` 本地验证；命中缓存（key `auth:user:${sub}`，TTL 300s）直接复用 user；未命中或过期则 `getSupabaseAdmin().auth.getUser(token)` 远程验证并写缓存

- [x] Task 10: P2-26 tsconfig.electron 开启 strict
  - [x] SubTask 10.1: 先运行 `npm run check:electron` 确认 baseline 错误（memory 记录有 4 个预存非 strict 错误）；如存在先修复
  - [x] SubTask 10.2: 修改 `tsconfig.electron.json`：将行 11 `"strict": false` 改为 `"strict": true`；删除行 12 `"noImplicitAny": false`（被 strict 包含）
  - [x] SubTask 10.3: 运行 `npm run check:electron`，逐个修复 strict 引发的类型错误（预估主要来自 strictNullChecks，与 Task 1 完成的 `req.supabase!` 清理配合，剩余主要是 `maybeSingle()` 返回值、类字段初始化、函数签名收窄）
  - [x] SubTask 10.4: 修复 `electron/main.ts` 行 104-105 `apiApp: any` / `apiKernel: any`（改为 `import type { Application } from "express"` + 具体类型）与 `electron/preload.ts` 行 22-23、63-64（定义 `UpdateInfo` 接口或使用 `electron-updater` 类型）

# Task Dependencies

- Task 1 必须先完成（提供 AuthedRequest + AuthRequest.user: User 类型基础，否则 Task 2/3 路由签名无法对齐）
- Task 2 与 Task 3 共改 `knowledgePoints.ts` 与 `graphs/crud.ts`，必须顺序执行或合并到同一子代理（建议 Task 2 → Task 3）
- Task 4 与 Task 1 都改 `api/services/ai/aiActionService.ts`（如适用），需顺序执行（Task 1 先完成路由层扩散，Task 4 再改 service 内部类型）
- Task 5 与 Task 6 互相独立（5 改配置文件，6 改业务文件），可并行
- Task 7 修改 `src/utils/errors.ts` + `useError.ts` + `asyncHandler.ts` + 测试文件，与 Task 5/6 互相独立，可并行
- Task 8 仅改 `errorReporter.ts` 与 `main.tsx`，独立可并行
- Task 9 与 Task 1 共改 `api/middleware/auth.ts`，必须在 Task 1 之后执行（Task 1 完成 AuthedRequest 后，Task 9 在 requireAuth 内部加缓存逻辑）
- Task 10 必须在 Task 1 + Task 4 + Task 9 全部完成后执行（strict 模式开启会暴露所有类型不安全点，需先清理完毕）
- 推荐并行批次：[Task 1] → [Task 2, Task 4] + [Task 5, Task 6, Task 7, Task 8] 并行 → [Task 3] → [Task 9] → [Task 10]
- 注：Task 10 是高工作量任务（预估 500-1500 个 strict 错误），如一次推进困难可分阶段（先 noImplicitAny，再 strictNullChecks，最后 strict: true）
