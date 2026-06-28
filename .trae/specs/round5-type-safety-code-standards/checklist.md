# Checklist

## Task 1: P2-05 + P2-06 类型基础改造

- [x] `api/middleware/auth.ts` 中 `AuthRequest.user` 类型为 `User | undefined`（非 `any`）
- [x] `api/middleware/auth.ts` 新增 `AuthedRequest` 接口（`user: User` + `supabase: SupabaseClient` 双非空）
- [x] `api/middleware/auth.ts` 新增 `OptionalAuthRequest` 类型（`user?: User` + `supabase?: SupabaseClient` 双可选，反映 optionalAuth 路由真实运行时状态）
- [x] `requireAuth` 中间件将 `req` 赋值为 `AuthedRequest` 类型
- [x] `optionalAuth` 中间件保持 `AuthRequest`（可选语义不变）
- [x] 受 `optionalAuth` 保护的 4 个路由文件（`graphs/crud.ts`、`graphs/analysis.ts`、`templates.ts`、`collaborators.ts`）handler 签名改用 `OptionalAuthRequest`，TypeScript 强制 `req.user?.id` / `req.supabase!` 防御性访问
- [x] `api/middleware/errorHandler.ts` 中 `errorHandler` 签名 `err` 类型为 `unknown`（非 `any`）
- [x] `errorHandler` 内部字段访问使用类型守卫或 `as { code?: string; ... }` 形式
- [x] `errorHandler.ts:203` 的 `(req as any).user?.id` 改为 `req.user?.id`
- [x] `requestLogger.ts:54` 与 `:141` 的 `(req as any).user?.id` 改为 `req.user?.id`
- [x] `rateLimiter.ts:52` 的 `(req as any).user?.id` 改为 `req.user?.id`
- [x] `api/routes/**/*.ts` 中 `req.supabase!` 出现次数从 289 降至 0（受 `requireAuth` 保护的路由全部改用 `AuthedRequest`）
- [x] `optionalAuth` 路由保留 `req.supabase?` 可选语义

## Task 2: P2-04 路由错误处理风格统一

- [x] `api/routes/auth.ts` 中 `register` 路由无 try/catch 包装
- [x] `api/routes/auth.ts` 中 `login`/`refresh`/`logout`/`user`/`profile` 路由无 `next(error)` 模式
- [x] `api/routes/knowledgePoints.ts` 中 `list` 路由无 try/catch 包装
- [x] `api/routes/graphs/crud.ts` 中 `intelligent-suggestions`/`module-gaps`/`module-overlap` 路由无 try/catch 包装
- [x] 业务错误统一为 `throw new AppError(...)` 形式

## Task 3: P2-03 zod schema 集中

- [x] `api/schemas/index.ts` 包含 `createKnowledgePointSchema` 等 5 个迁移自 `knowledgePoints.ts` 的 schema
- [x] `api/schemas/index.ts` 包含 `checkTopicSchema`/`batchOperationSchema` 迁移自 `graphs/crud.ts` 的 schema
- [x] `api/routes/knowledgePoints.ts` 从 `../schemas/index` 导入 5 个 schema
- [x] `api/routes/knowledgePoints.ts` 不再包含内联 `z.object({...})` 定义
- [x] `api/routes/graphs/crud.ts` 从 `../../schemas/index` 导入 2 个 schema
- [x] `api/routes/graphs/crud.ts` 不再包含内联 `z.object({...})` 定义

## Task 4: P2-07 后端生产代码 any 清理（top 5 文件）

- [x] `api/services/ai/aiActionService.ts` 中 13 处 `: any` 全部替换为具体类型
- [x] `api/services/ai/aiActionService.ts` 新增 `AiActionContext` 接口（替换行 146 `context: any`）
- [x] `api/services/ai/aiActionService.ts` 行 333 `let parsed: any` 改为 `unknown` + 类型守卫
- [x] `api/services/ai/searchService.ts` 中 6 处 `: any` 全部替换为具体类型
- [x] `api/services/graph/graphVersionService.ts` 中 6 处 `: any` 全部替换为具体类型
- [x] `api/services/scheduler/taskAnalyticsService.ts` 中 6 处 `: any` 全部替换为具体类型
- [x] `api/utils/markdownParser.ts` 中 6 处 `: any` 全部替换为具体类型
- [x] 测试文件（`autoGraphService.test.ts` 等）本次不修改

## Task 5: P2-16 前端配置文件清理

- [x] `src/types/global.d.ts` 文件存在并声明 `Window` 接口扩展
- [x] `src/types/global.d.ts` 包含 `Capacitor?` 与 `electronAPI?` 字段类型声明
- [x] `src/config/mobileApiConfig.ts` 中 3 处 `(window as any)` 全部移除
- [x] `src/config/electronConfig.ts` 中 3 处 `(window as any).electronAPI` 全部移除

## Task 6: P2-16 前端高频生产文件清理

- [x] `src/services/api/createApiClient.ts:73` 的 `Promise<any>` 改为 `Promise<AxiosResponse>` 或 `Promise<unknown>`
- [x] `src/services/api/createApiClient.ts:221` 的 `as any` 改为定义 `ApiErrorResponse` 接口
- [x] `src/components/Layout/Layout.tsx:431` 的 `(user.user_metadata as any)?.name` 改为定义 `UserMetadata` 接口
- [x] `src/three/PlanetView.tsx:25,247` 的 `Record<string, any>` 改为定义 `NodeStatus` 接口
- [x] `src/three/PlanetView.tsx:252` 的 `useRef<any>(null)` 改为 `useRef<OrbitControls | null>(null)`
- [x] `src/services/api/contracts/ISchedulerApi.ts` 是否自动生成已确认（若是生成产物则不在本次范围）

## Task 7: P2-18 前端错误三套机制合并

- [x] `src/utils/errors.ts` 不再导出 `handleApiError` 函数
- [x] `src/utils/errors.ts` 不再导出 `createApiErrorHandler` 函数
- [x] `src/utils/errors.ts` 不再导出 `withErrorHandling` 函数
- [x] `src/utils/errors.ts` 不再导出 `assertNever` 函数
- [x] `src/utils/errors.ts` 仍保留 `AppError` 及子类、`isXxx` 谓词、`wrapUnknownError`、`getUserFriendlyMessage`、`createErrorFromResponse`、`getErrorMessage`、`getErrorCode`、`FrontendErrorCodes` 常量
- [x] `src/hooks/common/useError.ts` 不再导出 `withErrorHandling`（与 `handleAsync` 重复）
- [x] `src/hooks/common/useError.ts` 仍导出 `handleError`/`handleSilent`/`handleAsync`/`handleAsyncWithFallback`/`parseError`
- [x] `src/utils/asyncHandler.ts` 内部委托 `errors.ts` 的 `wrapUnknownError` + `getUserFriendlyMessage`
- [x] `src/__tests__/utils/errors.test.ts` 移除对 4 个已删除函数的测试用例
- [x] 11 个 `useError` 业务调用方文件不受影响（API 形状不变）

## Task 8: P2-19 errorReporter PROD 守卫

- [x] `src/utils/errorReporter.ts` 中 `console.error` override 段被 `if (import.meta.env.PROD)` 包裹
- [x] `src/utils/errorReporter.ts` 中 `window.onerror` / `window.onunhandledrejection` 保留全环境生效
- [x] `src/main.tsx:67-70` 的 `if (isElectron)` 改为 `if (isElectron && import.meta.env.PROD)`
- [x] Dev 环境 `console.error` 不被 override（验证：dev 启动后 `console.error === originalConsoleError`）

## Task 9: P2-08 requireAuth 本地 JWT 验证 + 缓存

- [x] `.env.example` 与 `.env.development` 包含 `SUPABASE_JWT_SECRET` 变量
- [x] `api/services/auth/jwtService.ts` 新增 `verifySupabaseToken(token): { sub: string } | null` 方法
- [x] `api/middleware/auth.ts` 的 `requireAuth` 先调 `jwtService.verifySupabaseToken` 本地验证
- [x] `requireAuth` 命中缓存（key `auth:user:${sub}`，TTL 300s）时跳过远程调用
- [x] `requireAuth` 缓存未命中或过期时调 `getSupabaseAdmin().auth.getUser(token)` 并写缓存
- [x] `optionalAuth` 同步应用本地验证 + 缓存逻辑
- [x] 已存在的 `api/__tests__/middleware/auth.test.ts` 通过（如适用）

## Task 10: P2-26 tsconfig.electron strict

- [x] `npm run check:electron` baseline 错误已清理（memory 记录的 4 个预存错误）
- [x] `tsconfig.electron.json:11` 改为 `"strict": true`
- [x] `tsconfig.electron.json:12` `noImplicitAny` 行已删除（被 strict 包含）
- [x] `npm run check:electron` 通过（exit code 0）
- [x] `electron/main.ts:104-105` 的 `apiApp: any` / `apiKernel: any` 改为 `Application` 等具体类型
- [x] `electron/preload.ts:22-23,63-64` 的 `info: any` 改为 `UpdateInfo` 或具体接口
- [x] `electron/` 目录 `: any` 与 `as any` 出现次数从 11 降至 0
- [x] `npm run check` 通过（api/ 同样被 tsconfig.electron 覆盖）

## 类型与代码规范（全局）

- [x] `npm run check` 通过（无新增 TypeScript 错误）
- [x] `npm run lint` 通过（无新增 ESLint 错误）
- [x] `npm run check:electron` 通过（strict 开启后）
- [x] `npm run lint:full` 通过（全量 ESLint 检查）
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 前端无新增 `console.log` / `console.info`
- [x] 后端无新增 `console.*`（使用 logger）
- [x] `api/routes/**/*.ts` 中 `req.supabase!` 出现次数为 0
- [x] `api/middleware/` 中 `(req as any).user` 出现次数为 0
- [x] `src/config/` 中 `(window as any)` 出现次数为 0
