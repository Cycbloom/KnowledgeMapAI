# Round 5: 类型安全与代码规范 Spec

## Why

第 1-4 轮已清空 P0 + P1（共 41 项）。第 5 轮聚焦 P2 子集：消除 `any` 与非空断言、统一错误处理。当前 `api/` 与 `src/` 共有 145+127=**272 处类型不安全点**（不含 ISchedulerApi.ts 异常值）；`tsconfig.electron.json` 关闭 `strict` 违反项目规则；前端错误处理三套机制重叠且含死代码；`errorReporter` 无环境判断 override `console.error`。这些与项目规则"禁止 any / 非空断言" 直接冲突，且阻碍后续 strict 开启。

## What Changes

- 新增 `AuthedRequest` 类型（`user: User` + `supabase: SupabaseClient` 双非空），让 `requireAuth` 路由的 handler 不再需要 `!`
- `errorHandler` 与 `AuthRequest` 的 `any` 改为 `unknown` + 类型守卫 / `User`
- 路由层移除冗余 try/catch（`express-async-errors` 已启用）
- `knowledgePoints.ts` + `graphs/crud.ts` 的内联 zod schema 迁移到 `api/schemas/index.ts`
- 后端 `aiActionService.ts` 等 top 5 生产文件清理 `any`
- 前端新建 `src/types/global.d.ts` 声明 `window.Capacitor` / `window.electronAPI`，消除配置文件 6 处 `as any`
- `createApiClient.ts` / `Layout.tsx` / `PlanetView.tsx` 等高频文件清理 `as any`
- `errors.ts` 仅保留错误类与谓词，移除死代码 `handleApiError` / `createApiErrorHandler` / `withErrorHandling`
- `errorReporter` 的 `console.error` override 加 `import.meta.env.PROD` 守卫
- `requireAuth` 改为本地 JWT 验证 + 5 分钟 Supabase 回查缓存
- `tsconfig.electron.json` 开启 `strict: true`，移除 `noImplicitAny` 行（被 strict 包含）

## Impact

- Affected specs: 无（首个第 5 轮 spec）
- Affected code:
  - 后端：`api/middleware/auth.ts`、`api/middleware/errorHandler.ts`、`api/middleware/requestLogger.ts`、`api/middleware/rateLimiter.ts`、`api/routes/auth.ts`、`api/routes/knowledgePoints.ts`、`api/routes/graphs/crud.ts`、`api/schemas/index.ts`、`api/services/ai/aiActionService.ts`、`api/services/auth/jwtService.ts`、约 46 个路由文件（机械删除 `!`）
  - 前端：`src/types/global.d.ts`（新建）、`src/config/mobileApiConfig.ts`、`src/config/electronConfig.ts`、`src/services/api/createApiClient.ts`、`src/components/Layout/Layout.tsx`、`src/three/PlanetView.tsx`、`src/utils/errors.ts`、`src/utils/asyncHandler.ts`、`src/hooks/common/useError.ts`、`src/utils/errorReporter.ts`、`src/main.tsx`
  - 配置：`tsconfig.electron.json`、`.env.example`、`.env.development`

## ADDED Requirements

### Requirement: AuthedRequest 类型与中间件泛型化

The system SHALL provide `AuthedRequest` interface extending Express `Request` with `user: User` and `supabase: SupabaseClient` (both non-optional). `requireAuth` middleware SHALL cast the request to `AuthedRequest` after successful authentication, allowing downstream handlers to access `req.supabase` and `req.user` without non-null assertions.

#### Scenario: Authed handler accesses req.supabase without `!`
- **WHEN** a route handler is registered with `requireAuth` and typed as `(req: AuthedRequest, res: Response) => ...`
- **THEN** `req.supabase` is typed as `SupabaseClient` (non-optional) and no `!` is needed

#### Scenario: Optional auth path remains optional
- **WHEN** a route uses `optionalAuth`
- **THEN** the handler still receives `AuthRequest` (with optional `user?` / `supabase?`) to preserve existing null-check semantics

### Requirement: 全局 Window 类型扩展

The system SHALL declare ambient types for `window.Capacitor` and `window.electronAPI` in `src/types/global.d.ts`, allowing configuration files to access these injected globals without `as any` casts.

#### Scenario: Config file reads electronAPI
- **WHEN** `electronConfig.ts` accesses `window.electronAPI`
- **THEN** TypeScript infers the typed interface and no `as any` is needed

### Requirement: requireAuth 本地 JWT 验证 + 5 分钟回查缓存

The system SHALL validate Bearer tokens locally using `jwt.verify(token, SUPABASE_JWT_SECRET)` and cache the resulting Supabase `User` object for 5 minutes via `cacheService`. Cache miss or expired entries SHALL trigger a remote `supabase.auth.getUser(token)` call to verify the user still exists.

#### Scenario: Cached user hit
- **WHEN** a request arrives with a token whose `sub` is in cache and was verified < 5 minutes ago
- **THEN** `requireAuth` skips the remote call and uses the cached user

#### Scenario: Cache miss or expired
- **WHEN** the cache entry is missing or older than 5 minutes
- **THEN** `requireAuth` calls `supabase.auth.getUser(token)` and updates the cache

### Requirement: errorReporter PROD-only console.error override

The system SHALL only override `console.error` in production environment. `window.onerror` and `window.onunhandledrejection` handlers remain active in all environments.

#### Scenario: Dev environment preserves native console.error
- **WHEN** `import.meta.env.DEV` is true
- **THEN** `console.error` is not overridden and `errorReporter` does not intercept dev-time error logging

## MODIFIED Requirements

### Requirement: errorHandler 错误处理签名

`errorHandler` middleware signature SHALL change from `(err: any, ...)` to `(err: unknown, ...)`. Internal field access SHALL use type guards or `as { code?: string; statusCode?: number; ... }` narrowing instead of direct `err.xxx` access.

### Requirement: AuthRequest.user 类型

`AuthRequest.user` SHALL be typed as `User | undefined` (Supabase `User` type) instead of `any`.

### Requirement: 路由层错误处理风格

All route handlers SHALL use `throw new AppError(...)` for business errors and rely on `express-async-errors` + `errorHandler` for unknown errors. `try { ... } catch (error) { next(error); }` patterns SHALL be removed.

### Requirement: zod schema 集中管理

`knowledgePoints.ts` (5 schemas) and `graphs/crud.ts` (2 schemas) inline zod schemas SHALL be migrated to `api/schemas/index.ts`. Route files SHALL import from `../schemas/index` instead of inlining.

### Requirement: 前端错误处理单一入口

- `src/utils/errors.ts` SHALL only export error classes (`AppError` and subclasses), predicates (`isXxx`), and pure utilities (`wrapUnknownError`, `getUserFriendlyMessage`, `createErrorFromResponse`, `getErrorMessage`, `getErrorCode`, `FrontendErrorCodes` constants). Dead code `handleApiError`, `createApiErrorHandler`, `withErrorHandling`, `assertNever` SHALL be removed.
- `src/hooks/common/useError.ts` SHALL be the only React hook entry, exporting `handleError`, `handleSilent`, `handleAsync`, `handleAsyncWithFallback`, `parseError`. Duplicate `withErrorHandling` SHALL be removed.
- `src/utils/asyncHandler.ts` SHALL remain the non-React factory, internally delegating to `errors.ts` utilities.

### Requirement: tsconfig.electron strict 模式

`tsconfig.electron.json` SHALL set `"strict": true`. The redundant `"noImplicitAny": true` line SHALL be removed (already implied by `strict`).

## REMOVED Requirements

### Requirement: errorHandler / requestLogger / rateLimiter 中 `(req as any).user` 转型
**Reason**: After `AuthRequest.user` is typed as `User`, these middleware files can access `req.user` directly via type narrowing without `as any`.
**Migration**: Replace `(req as any).user?.id` with `req.user?.id` (4 occurrences across 3 files).

### Requirement: errors.ts 中 0-调用死代码
**Reason**: `handleApiError`, `createApiErrorHandler`, `withErrorHandling`, `assertNever` have zero business call sites (only self-references and test files).
**Migration**: Remove functions and their tests in `src/__tests__/utils/errors.test.ts`.
