# P0 安全/同步/性能/泄漏修复 Spec

## Why

系统性架构优化分析识别出 5 类 P0 级别问题，均属于安全漏洞、数据丢失风险、主线程冻结或内存泄漏，影响生产可用性与用户体验。这些问题**未被** `p0-critical-fixes`（已完成：FSRS/getTags/errorReporter userId）和 `p0-architecture-cleanup`（已完成：db:batch 事务/study_cards 同步字段/is_branch 列/backupService N+1/AI 监控统一/chat.ts 下沉）覆盖：

1. **安全漏洞集群**：硬编码 Supabase service_role token、CORS 允许 `*.vercel.app` 任意子域、CSRF token 非 timing-safe 比较、CSRF 生产跳过 localhost、`.env.production` 已 commit、anon 角色可读 users 表、app_settings 允许任意 authenticated 用户 ALL 操作。
2. **同步引擎可靠性**：Pull 阶段静默覆盖本地未推送修改（数据丢失）、`maxRetries:3` 配置已定义但从未使用（无重试）、冲突一律 Cloud Wins 且无 UI 通知、knowledge_point_versions 触发器版本号竞态、`check_duplicate_graph_topic` 函数空实现。
3. **图谱计算性能瓶颈**：3D 力导向布局在主线程同步执行（冻结）、2D 力导向 O(n²) 嵌套循环、3D 碰撞检测 O(n²)、PageRank 每次调用重复全图迭代。
4. **内存泄漏集群**：errorReporter `setInterval` + `console.error` monkey-patch 无清理、rateLimiter `setInterval` 模块级无清理、audioSynthesis 18 处递归 setTimeout 无统一清理。
5. **关键测试覆盖缺失**：auth/csrf/rateLimiter/validate/errorHandler 中间件零测试、graphCalculator worker/forceLayout3D/PlanetView 零测试、CI `npm audit` 设置 `continue-on-error: true`。

## What Changes

### 修复 1：安全漏洞集群修复（P0-1）

#### 1.1 移除硬编码 Supabase service_role token
- [api/supabase.ts:12-13](file:///d:/KnowledgeMap/api/supabase.ts#L12-L13) 改为从 `process.env.SUPABASE_SERVICE_ROLE_KEY` 读取，缺失时仅在 `NODE_ENV=development` 输出 warn
- 生产环境必须通过环境变量注入，不写入源码

#### 1.2 收紧 CORS vercel.app 通配符
- [api/app.ts:108-114](file:///d:/KnowledgeMap/api/app.ts#L108-L114) 改为白名单正则匹配 `^https://knowledgemap-[a-z0-9]+\.vercel\.app$` 或具体域名列表
- 保留 `http://localhost:*` 用于开发

#### 1.3 CSRF token 改用 timing-safe 比较
- [api/middleware/csrf.ts:84](file:///d:/KnowledgeMap/api/middleware/csrf.ts#L84) 的 `!==` 比较改为 `crypto.timingSafeEqual`
- 处理长度不一致情况（先比较长度，长度不同直接返回 false）

#### 1.4 CSRF 生产环境不跳过 localhost
- [api/middleware/csrf.ts:30-32](file:///d:/KnowledgeMap/api/middleware/csrf.ts#L30-L32) 的 localhost 跳过逻辑改为仅 `NODE_ENV !== 'production'` 时生效

#### 1.5 `.env.production` 加入 `.gitignore`
- [.gitignore:54-58](file:///d:/KnowledgeMap/.gitignore#L54-L58) 新增 `.env.production` 与 `.env.*.local` 忽略规则
- 若文件已 commit，需 `git rm --cached .env.production`（但内容仅占位符，无需历史清理）

#### 1.6 收紧 anon 角色权限
- [supabase/migrations/16_grants.sql:6](file:///d:/KnowledgeMap/supabase/migrations/16_grants.sql#L6) 移除 `GRANT SELECT ON users TO anon`
- 同文件其他业务表 anon SELECT 授权改为仅 `authenticated`（保留 RLS 策略保护）

#### 1.7 收紧 app_settings RLS 策略
- [supabase/migrations/13_rls_policies.sql:211](file:///d:/KnowledgeMap/supabase/migrations/13_rls_policies.sql#L211) 的 "Allow all access for authenticated users" 策略改为仅 admin role 可写，authenticated 仅可读

### 修复 2：同步引擎可靠性（P0-2）

#### 2.1 Pull 阶段保护本地未推送修改
- [electron/sync/syncEngine.ts:176-186](file:///d:/KnowledgeMap/electron/sync/syncEngine.ts#L176-L186) upsert 前检查本地记录 `sync_status`，若为 `pending_push` 则触发冲突处理而非直接覆盖
- 冲突记录写入 `sync_conflicts` 表并通知 UI

#### 2.2 实现同步重试机制
- [electron/sync/syncEngine.ts:155-162,244-255](file:///d:/KnowledgeMap/electron/sync/syncEngine.ts#L155-L162) 实现 exponential backoff 重试，使用已定义的 `SyncConfig.maxRetries`（当前为 3）
- 仅对网络错误（超时、5xx）重试，4xx 错误立即失败

#### 2.3 Push 冲突处理增强
- [electron/sync/syncEngine.ts:279-292](file:///d:/KnowledgeMap/electron/sync/syncEngine.ts#L279-L292) 冲突时记录详细日志并通过 SSE/事件通知前端
- 保留 Cloud Wins 默认策略，但记录冲突供 UI 展示

#### 2.4 修复 knowledge_point_versions 版本号竞态
- [supabase/migrations/14_functions.sql:69-71](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql#L69-L71) 的 `SELECT COALESCE(MAX(version_number), 0) + 1` 改为使用 PostgreSQL SEQUENCE 或 `LOCK TABLE` 保护

#### 2.5 修复 check_duplicate_graph_topic 空实现
- [supabase/migrations/14_functions.sql:542-565](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql#L542-L565) 补全实现：查询同用户下 `deleted_at IS NULL` 且 `topic = NEW.topic` 的现有图谱
- 若功能已废弃，改为显式 `RAISE NOTICE` 并在调用方移除依赖

### 修复 3：图谱计算性能瓶颈（P0-3）

#### 3.1 2D 力导向引入四叉树优化
- [src/workers/graphCalculator.worker.ts:69-118](file:///d:/KnowledgeMap/src/workers/graphCalculator.worker.ts#L69-L118) 的 `calculateForceDirectedLayout` O(n²) 嵌套循环引入 `d3-quadtree` 空间分区
- 节点数 > 500 时性能提升 5-10×

#### 3.2 3D 力导向布局移入 Web Worker
- [src/three/PlanetView.tsx:752-758](file:///d:/KnowledgeMap/src/three/PlanetView.tsx#L752-L758) 的 `create3DForceLayout` 通过 comlink 暴露给 `graphCalculator.worker.ts`
- 消除主线程冻结

#### 3.3 3D 碰撞检测空间分区
- [src/three/layout/forceLayout3D.ts:123-146](file:///d:/KnowledgeMap/src/three/layout/forceLayout3D.ts#L123-L146) 的 O(n²) 碰撞检测引入网格分桶或八叉树

#### 3.4 PageRank 批量计算优化
- [src/workers/graphCalculator.worker.ts:155-172](file:///d:/KnowledgeMap/src/workers/graphCalculator.worker.ts#L155-L172) 的 `calculateNodeImportance` 改为外层一次性计算 PageRank 向量后查询
- 批量场景下速度提升 10×+

### 修复 4：内存泄漏集群（P0-4）

#### 4.1 errorReporter 提供清理机制
- [src/utils/errorReporter.ts:37,100-120](file:///d:/KnowledgeMap/src/utils/errorReporter.ts#L37) 暴露 `destroyErrorReporter()` 函数，清理 `setInterval` 与 `console.error` patch
- 保留 `originalConsoleError` 在模块级，仅 patch 一次
- [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 在模块卸载/HMR 时调用清理

#### 4.2 rateLimiter 提供清理函数
- [api/middleware/rateLimiter.ts:27](file:///d:/KnowledgeMap/api/middleware/rateLimiter.ts#L27) 的 `setInterval(cleanupLocalStore, 60000)` 暴露 `destroyRateLimiter()` 清理函数
- 测试场景可调用清理避免定时器累积

#### 4.3 audioSynthesis 统一定时器管理
- [src/utils/audioSynthesis.ts](file:///d:/KnowledgeMap/src/utils/audioSynthesis.ts) 18 处递归 setTimeout 集中管理 timer ID
- 暴露 `stopAllAudioSynthesis()` 统一清理，组件卸载时调用

### 修复 5：关键测试覆盖与 CI（P0-5）

#### 5.1 补齐中间件单元测试
- 新建 `api/__tests__/middleware/auth.test.ts` 覆盖 `requireAuth`/`optionalAuth`/`requireAdmin`
- 新建 `api/__tests__/middleware/csrf.test.ts` 覆盖 token 校验、skip 路由、timing-safe 比较
- 新建 `api/__tests__/middleware/rateLimiter.test.ts` 覆盖限流计数、窗口过期
- 新建 `api/__tests__/middleware/validate.test.ts` 覆盖 zod 校验、错误格式
- 新建 `api/__tests__/middleware/errorHandler.test.ts` 覆盖 AppError、DB 错误码、敏感信息过滤

#### 5.2 补齐图谱算法测试
- 新建 `src/__tests__/workers/graphCalculator.test.ts` 覆盖 force-directed/mindmap/semantic/importance
- 新建 `src/__tests__/three/forceLayout3D.test.ts` 覆盖 3D 布局
- 新建 `src/__tests__/three/PlanetView.test.tsx` 覆盖组件渲染

#### 5.3 CI npm audit 移除 continue-on-error
- [.github/workflows/ci.yml:36](file:///d:/KnowledgeMap/.github/workflows/ci.yml#L36) 的 `continue-on-error: true` 改为 `false`
- 对 audit 输出做白名单过滤（已知非关键漏洞可 ignore）

## Impact

- **Affected specs**:
  - `p0-critical-fixes` — 本 spec 是其后续 P0 修复（不同问题域）
  - `p0-architecture-cleanup` — 本 spec 是其后续 P0 修复（不同问题域）
  - `local-first-sqlite` — 同步引擎可靠性修复落实其同步要求
  - `unify-sync-framework` — 同步重试与冲突处理增强同步框架
  - `mindmap-layout-worker` — 2D 力导向四叉树优化与其性能目标一致
  - `planetview-gpu-instancing` — 3D 布局移入 worker 与其渲染优化互补
- **Affected code**:
  - `api/supabase.ts` — 移除硬编码 token
  - `api/app.ts` — CORS 白名单收紧
  - `api/middleware/csrf.ts` — timing-safe 比较 + localhost 跳过条件
  - `api/middleware/rateLimiter.ts` — 暴露清理函数
  - `.gitignore` — 新增 .env.production 忽略
  - `supabase/migrations/13_rls_policies.sql` — app_settings 策略收紧
  - `supabase/migrations/16_grants.sql` — anon 权限收紧
  - `supabase/migrations/14_functions.sql` — 版本号竞态修复 + check_duplicate_graph_topic 补全
  - `electron/sync/syncEngine.ts` — Pull 保护 + 重试 + 冲突通知
  - `src/workers/graphCalculator.worker.ts` — 四叉树优化 + PageRank 批量
  - `src/three/layout/forceLayout3D.ts` — 空间分区
  - `src/three/PlanetView.tsx` — 3D 布局移入 worker
  - `src/utils/errorReporter.ts` — 清理机制
  - `src/utils/audioSynthesis.ts` — 统一定时器管理
  - `src/main.tsx` — 调用 errorReporter 清理
  - `api/__tests__/middleware/*.test.ts` — **新增** 5 个测试文件
  - `src/__tests__/{workers,three}/*.test.ts` — **新增** 3 个测试文件
  - `.github/workflows/ci.yml` — npm audit 严格化

## ADDED Requirements

### Requirement: 安全配置零硬编码

系统 SHALL 不在源码中硬编码任何敏感凭证或允许过宽的跨域访问。

#### Scenario: Supabase service_role token 来源
- **WHEN** 应用启动并初始化 Supabase admin client
- **THEN** service_role token 从 `process.env.SUPABASE_SERVICE_ROLE_KEY` 读取
- **AND** 若环境变量缺失且 `NODE_ENV=development`，输出 warn 并回退到 demo key
- **AND** 若环境变量缺失且 `NODE_ENV=production`，抛出启动错误

#### Scenario: CORS vercel.app 子域限制
- **WHEN** 请求 Origin 为 `https://evil.vercel.app`
- **THEN** CORS 拒绝该请求
- **WHEN** 请求 Origin 为 `https://knowledgemap-abc123.vercel.app`
- **THEN** CORS 允许该请求

#### Scenario: CSRF token timing-safe 比较
- **WHEN** 攻击者发送 CSRF token 与服务端 token 仅首字节不同
- **THEN** 比较耗时与完全相同的情况无显著差异（防止时序攻击）

#### Scenario: 生产环境 CSRF 不跳过 localhost
- **WHEN** `NODE_ENV=production` 且请求来自 localhost
- **THEN** CSRF 校验照常执行

### Requirement: 同步引擎数据不丢失

系统 SHALL 确保同步引擎 Pull 阶段不覆盖本地未推送的修改。

#### Scenario: Pull 遇到本地 pending_push 记录
- **WHEN** 同步引擎 Pull 拉取到云端记录，本地同 id 记录 `sync_status === 'pending_push'`
- **THEN** 不直接 upsert 覆盖，而是触发冲突检测
- **AND** 冲突记录写入 `sync_conflicts` 表
- **AND** 通过事件通知前端展示冲突

#### Scenario: 网络错误重试
- **WHEN** Pull/Push 请求因网络错误（超时、5xx）失败
- **THEN** 按 exponential backoff 重试，最多 `maxRetries` 次（默认 3）
- **AND** 4xx 错误立即失败不重试

### Requirement: 图谱计算不阻塞主线程

系统 SHALL 将所有 O(n²) 复杂度的图谱计算放入 Web Worker。

#### Scenario: 2D 力导向大图渲染
- **WHEN** 用户打开包含 1000 节点的图谱并触发力导向布局
- **THEN** 布局计算在 Web Worker 中执行，使用四叉树优化
- **AND** 主线程不冻结，UI 保持响应

#### Scenario: 3D 力导向布局
- **WHEN** 用户切换到 3D PlanetView 视图
- **THEN** 3D 力导向布局在 Web Worker 中执行
- **AND** 主线程仅负责 Three.js 渲染

### Requirement: 内存泄漏可清理

系统 SHALL 为所有模块级定时器和 monkey-patch 提供清理机制。

#### Scenario: errorReporter 清理
- **WHEN** 调用 `destroyErrorReporter()`
- **THEN** `setInterval` 被清除，`console.error` 恢复原状
- **AND** 后续 `initErrorReporter()` 可重新初始化

#### Scenario: rateLimiter 清理
- **WHEN** 测试环境调用 `destroyRateLimiter()`
- **THEN** cleanup interval 被清除
- **AND** 不影响生产环境运行

### Requirement: 关键中间件测试覆盖

系统 SHALL 为所有安全相关中间件提供单元测试。

#### Scenario: auth 中间件测试
- **WHEN** 运行 `auth.test.ts`
- **THEN** 覆盖 `requireAuth` 无 token/无效 token/有效 token 三个分支
- **AND** 覆盖 `requireAdmin` 管理员/非管理员两个分支

## MODIFIED Requirements

### Requirement: Supabase admin client 初始化
**原**：硬编码 demo service_role token 到源码作为回退。
**新**：从环境变量读取，开发环境缺失时 warn 并回退，生产环境缺失时抛错。

### Requirement: CSRF 中间件
**原**：token 使用 `!==` 比较，生产环境跳过 localhost。
**新**：token 使用 `crypto.timingSafeEqual` 比较，仅非生产环境跳过 localhost。

### Requirement: 同步引擎 Pull
**原**：直接 upsert 远程数据，覆盖本地修改。
**新**：检查本地 `sync_status`，pending_push 记录触发冲突处理。

### Requirement: errorReporter 生命周期
**原**：模块级 setInterval + console.error patch 无清理机制。
**新**：提供 `destroyErrorReporter()` 清理函数，支持 HMR 与卸载场景。

## REMOVED Requirements

### Requirement: 硬编码 Supabase service_role token
**Reason**：安全风险，可能误用到生产环境。
**Migration**：改为环境变量读取，开发环境回退到 demo key 仅在 `NODE_ENV=development` 时生效。

### Requirement: CORS 允许任意 vercel.app 子域
**Reason**：攻击者可在任意子域部署页面发起跨域请求。
**Migration**：改为白名单正则匹配具体部署域名。

### Requirement: CI npm audit continue-on-error
**Reason**：安全漏洞不阻断 CI，违背安全实践。
**Migration**：改为 `continue-on-error: false`，对已知非关键漏洞做白名单过滤。
