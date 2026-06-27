# Tasks

> 5 类 P0 修复按依赖关系分组。Task 1（安全）与 Task 4（内存泄漏）相互独立可并行；Task 2（同步）依赖 Task 1.4（CSRF）完成；Task 3（性能）独立；Task 5（测试）依赖前 4 类修复完成以测试最终行为。

- [x] Task 1: 安全漏洞集群修复（P0-1）
  - [x] SubTask 1.1: 修改 [api/supabase.ts:12-13](file:///d:/KnowledgeMap/api/supabase.ts#L12-L13)，移除硬编码 service_role token，改为 `process.env.SUPABASE_SERVICE_ROLE_KEY` 读取，开发环境缺失时 warn 回退到 demo key，生产环境缺失抛错
  - [x] SubTask 1.2: 修改 [api/app.ts:108-114](file:///d:/KnowledgeMap/api/app.ts#L108-L114) CORS 配置，将 `*.vercel.app` 通配符改为白名单正则 `^https://knowledgemap-[a-z0-9]+\.vercel\.app$`，保留 `http://localhost:*`
  - [x] SubTask 1.3: 修改 [api/middleware/csrf.ts:84](file:///d:/KnowledgeMap/api/middleware/csrf.ts#L84) token 比较，`!==` 改为 `crypto.timingSafeEqual`，处理长度不一致情况（长度不同直接返回 false，避免 Buffer 比较异常）
  - [x] SubTask 1.4: 修改 [api/middleware/csrf.ts:30-32](file:///d:/KnowledgeMap/api/middleware/csrf.ts#L30-L32) localhost 跳过逻辑，添加 `NODE_ENV !== 'production'` 条件
  - [x] SubTask 1.5: 在 [.gitignore](file:///d:/KnowledgeMap/.gitignore#L54-L58) 新增 `.env.production` 与 `.env.*.local` 忽略规则
  - [x] SubTask 1.6: 修改 [supabase/migrations/16_grants.sql:6](file:///d:/KnowledgeMap/supabase/migrations/16_grants.sql#L6)，移除 `GRANT SELECT ON users TO anon`，业务表 anon SELECT 授权改为仅 `authenticated`（保留 RLS 策略）
  - [x] SubTask 1.7: 修改 [supabase/migrations/13_rls_policies.sql:211](file:///d:/KnowledgeMap/supabase/migrations/13_rls_policies.sql#L211) app_settings 策略，authenticated 仅可读，admin role 可写（需先确认 admin role 判定逻辑）
  - [x] SubTask 1.8: 运行 `npm run check` 与 `npm run lint` 确保无类型错误

- [x] Task 2: 同步引擎可靠性修复（P0-2）
  - [x] SubTask 2.1: 修改 [electron/sync/syncEngine.ts:176-186](file:///d:/KnowledgeMap/electron/sync/syncEngine.ts#L176-L186) Pull 逻辑，upsert 前调用 `dbManager.findById` 检查本地记录 `sync_status`，若为 `pending_push` 则调用 `dbManager.addSyncConflict` 记录冲突并跳过 upsert
  - [x] SubTask 2.2: 在 `syncEngine.ts` 实现 `retryWithBackoff(fn, maxRetries, initialDelay)` 工具函数，exponential backoff（1000ms → 2000ms → 4000ms），仅对网络错误（超时、5xx）重试，4xx 立即失败
  - [x] SubTask 2.3: 用 `retryWithBackoff` 包裹 `pullFromCloud`（第 155-162 行）和 `pushToCloud`（第 244-255 行）的 fetch 调用
  - [x] SubTask 2.4: 修改 [syncEngine.ts:279-292](file:///d:/KnowledgeMap/electron/sync/syncEngine.ts#L279-L292) Push 冲突处理，冲突时通过 `eventBus` 或 IPC 通知前端（Electron 场景），保留 Cloud Wins 默认策略
  - [x] SubTask 2.5: 修改 [supabase/migrations/14_functions.sql:69-71](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql#L69-L71) `create_knowledge_point_version` 触发器，`SELECT MAX(version_number)+1` 改为使用 PostgreSQL SEQUENCE（`CREATE SEQUENCE IF NOT EXISTS knowledge_point_version_seq`，`nextval()`）
  - [x] SubTask 2.6: 修改 [supabase/migrations/14_functions.sql:542-565](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql#L542-L565) `check_duplicate_graph_topic`，补全实现：查询 `SELECT 1 FROM knowledge_graphs WHERE user_id = NEW.user_id AND topic = NEW.topic AND deleted_at IS NULL AND id != NEW.id LIMIT 1`，存在则 `is_duplicate = TRUE`
  - [x] SubTask 2.7: 运行 `npm run check` 与 `npm run lint` 确保无类型错误

- [x] Task 3: 图谱计算性能优化（P0-3）
  - [x] SubTask 3.1: 在 [src/workers/graphCalculator.worker.ts:69-118](file:///d:/KnowledgeMap/src/workers/graphCalculator.worker.ts#L69-L118) `calculateForceDirectedLayout` 中引入 `d3-quadtree`（已是依赖），将排斥力计算从 O(n²) 双层循环改为 O(n·log n) 四叉树查询
  - [x] SubTask 3.2: 在 `graphCalculator.worker.ts` 新增 `calculate3DForceLayout` 函数（从 [src/three/layout/forceLayout3D.ts](file:///d:/KnowledgeMap/src/three/layout/forceLayout3D.ts) 迁移），通过 comlink 暴露
  - [x] SubTask 3.3: 修改 [src/three/PlanetView.tsx:752-758](file:///d:/KnowledgeMap/src/three/PlanetView.tsx#L752-L758) 改为通过 worker 调用 `calculate3DForceLayout`，移除主线程同步计算
  - [x] SubTask 3.4: 在 [src/three/layout/forceLayout3D.ts:123-146](file:///d:/KnowledgeMap/src/three/layout/forceLayout3D.ts#L123-L146) 引入网格分桶或八叉树优化碰撞检测（若 3.2 已迁移到 worker 则此优化在 worker 内进行）
  - [x] SubTask 3.5: 在 [src/workers/graphCalculator.worker.ts:155-172](file:///d:/KnowledgeMap/src/workers/graphCalculator.worker.ts#L155-L172) `calculateNodeImportance` 改为接受预计算的 PageRank 向量，或新增 `calculatePageRank(graph)` 一次性计算后供多次查询
  - [x] SubTask 3.6: 运行 `npm run check` 与 `npm run lint` 确保无类型错误

- [x] Task 4: 内存泄漏集群修复（P0-4）
  - [x] SubTask 4.1: 修改 [src/utils/errorReporter.ts:37,100-120](file:///d:/KnowledgeMap/src/utils/errorReporter.ts#L37) 暴露 `destroyErrorReporter()` 函数，清理 `setInterval(flushErrors)` 与恢复 `console.error` patch；保留 `originalConsoleError` 在模块级，仅 patch 一次（用 `if (console.error === originalConsoleError)` 守卫）
  - [x] SubTask 4.2: 在 [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 注册 HMR 卸载钩子（`if (import.meta.hot) import.meta.hot.dispose(() => destroyErrorReporter())`）
  - [x] SubTask 4.3: 修改 [api/middleware/rateLimiter.ts:27](file:///d:/KnowledgeMap/api/middleware/rateLimiter.ts#L27) 暴露 `destroyRateLimiter()` 清理 `setInterval(cleanupLocalStore)`
  - [x] SubTask 4.4: 重构 [src/utils/audioSynthesis.ts](file:///d:/KnowledgeMap/src/utils/audioSynthesis.ts) 18 处递归 setTimeout，集中管理 timer ID 到模块级 `Set<number>`，暴露 `stopAllAudioSynthesis()` 统一清理
  - [x] SubTask 4.5: 在使用 audioSynthesis 的组件卸载时调用 `stopAllAudioSynthesis()`（需 Grep 找到所有调用方）
  - [x] SubTask 4.6: 运行 `npm run check` 与 `npm run lint` 确保无类型错误

- [x] Task 5: 关键测试覆盖与 CI 严格化（P0-5）
  - [x] SubTask 5.1: 新建 `api/__tests__/middleware/auth.test.ts`，覆盖 `requireAuth`（无 token/无效 token/有效 token）、`optionalAuth`（无 token 通过/有 token 验证）、`requireAdmin`（管理员/非管理员）
  - [x] SubTask 5.2: 新建 `api/__tests__/middleware/csrf.test.ts`，覆盖 token 校验（有效/无效/长度不同）、skip 路由白名单、生产环境不跳过 localhost
  - [x] SubTask 5.3: 新建 `api/__tests__/middleware/rateLimiter.test.ts`，覆盖限流计数、窗口过期、不同 key 隔离
  - [x] SubTask 5.4: 新建 `api/__tests__/middleware/validate.test.ts`，覆盖 zod body/query/params 校验、错误响应格式
  - [x] SubTask 5.5: 新建 `api/__tests__/middleware/errorHandler.test.ts`，覆盖 AppError、DB 错误码（23505/23503）、敏感信息过滤、dev stack 泄露防护
  - [x] SubTask 5.6: 新建 `src/__tests__/workers/graphCalculator.test.ts`，覆盖 force-directed（小图收敛性）、mindmap（层级正确）、semantic（UMAP 降维）、importance（PageRank 排序）关键路径
  - [x] SubTask 5.7: 新建 `src/__tests__/three/forceLayout3D.test.ts`，覆盖 3D 布局收敛性与空间分区优化
  - [x] SubTask 5.8: 修改 [.github/workflows/ci.yml:36](file:///d:/KnowledgeMap/.github/workflows/ci.yml#L36) `continue-on-error: true` 改为 `false`，新增 audit 漏洞白名单过滤步骤（已知非关键漏洞可 ignore）
  - [x] SubTask 5.9: 运行 `npx vitest run api/__tests__/middleware/ src/__tests__/workers/ src/__tests__/three/` 确保新测试通过

# Task Dependencies

- [Task 1]（安全）与 [Task 4]（内存泄漏）相互独立，可完全并行执行
- [Task 2]（同步）的 2.4 冲突通知依赖 [Task 1.4]（CSRF）完成后的中间件稳定性，但 2.1-2.3/2.5-2.6 可并行
- [Task 3]（性能）完全独立，可与 Task 1/2/4 并行
- [Task 5]（测试）依赖前 4 类修复完成以测试最终行为：
  - 5.1 auth.test.ts 依赖 Task 1.4（CSRF）完成
  - 5.2 csrf.test.ts 依赖 Task 1.3/1.4 完成
  - 5.6 graphCalculator.test.ts 依赖 Task 3.1/3.5 完成（测试优化后的算法）
  - 5.7 forceLayout3D.test.ts 依赖 Task 3.2/3.4 完成
- 推荐执行顺序：Task 1 + Task 3 + Task 4 并行 → Task 2 → Task 5

# Validation

每个 Task 完成后：
1. 运行 `npm run check` 通过类型检查
2. 运行 `npm run lint` 通过代码规范检查
3. 在 Tasks 文件中勾选对应 checkbox

全部完成后：
4. 运行 `npm run check` 全量类型检查
5. 运行 `npm run lint` 全量代码规范检查
6. 运行 `npx vitest run api/__tests__/middleware/` 验证中间件测试
7. 运行 `npx vitest run src/__tests__/workers/ src/__tests__/three/` 验证算法测试
8. 手动验证：启动应用，切换 3D 视图确认不冻结，打开大图（>500 节点）确认流畅
9. 验证 `.env.production` 已被 .gitignore 忽略（`git check-ignore .env.production` 返回该路径）
10. 验证 errorReporter 清理：HMR 触发后无多个 setInterval 累积
