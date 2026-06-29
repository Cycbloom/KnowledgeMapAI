# Round 8 Task 3-5 Checklist

## Task 1: P2-11 EventBusBackend 抽象 + MemoryEventBusBackend

- [x] `api/services/core/eventBusBackend.ts` 已创建，导出 `EventBusBackend` 接口
- [x] `EventBusBackend` 包含方法：subscribe / unsubscribe / publish
- [x] `MemoryEventBusBackend implements EventBusBackend` 已实现，封装现有 Map + Set 进程内逻辑
- [x] `createEventBusBackend(): EventBusBackend` 工厂函数已导出，根据 `EVENT_BUS_BACKEND` 返回实例
- [x] `EVENT_BUS_BACKEND=redis` 时抛出未实现错误
- [x] `eventBus.ts` 不再直接持有 `handlers: Map<string, Set<AppEventHandler>>`
- [x] `AppEventBus` 的 `subscribe` / `unsubscribe` / `publish` 委托给注入的 backend
- [x] `executeHandlerWithRetry` 与死信队列逻辑保留在 `AppEventBus`（不依赖 backend）
- [x] 公开 API 签名与行为完全不变（向后兼容）
- [x] `api/__tests__/services/core/memoryEventBusBackend.test.ts` 覆盖 subscribe/publish、多 handler、unsubscribe、handler 失败隔离、工厂分支
- [x] `.env.example` 新增 `EVENT_BUS_BACKEND=memory`
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 2: P3-07 Refresh token 轮换（验证已在 Round 6 完成）

- [x] `api/services/auth/jwtService.ts` 已有 `computeTokenHash` 方法（SHA-256 哈希）— L146-148
- [x] `api/services/auth/jwtService.ts` 已有 `isTokenRevoked` 方法（查询 revoked_tokens 表）— L158-173
- [x] `api/services/auth/jwtService.ts` 已有 `refreshAccessToken` 方法（5 步流程：验证 → 黑名单检查 → 生成新 token → 旧 token 入黑名单 → 返回新对）— L189-247
- [x] `refreshAccessToken` 含 23505 竞态处理（duplicate key 时返回 AUTH_TOKEN_REVOKED）— L234-236
- [x] `refreshAccessToken` 中新 refreshToken 含 `jti: crypto.randomUUID()` — L220
- [x] `api/__tests__/services/auth/jwtService.test.ts` 已有相关测试覆盖
- [x] `npx vitest run api/__tests__/services/auth/jwtService.test.ts` 通过（20/20）

## Task 3: P3-08 Ownership 中间件（验证已在 Round 6 完成）

- [x] `api/middleware/ownership.ts` 已有 `buildOwnershipMiddleware(table, ownerColumn)` 高阶函数 — L24-61
- [x] `ownership.ts` 已导出 5 个中间件：requireKnowledgePointOwnership / requireGraphOwnership / requireTaskOwnership / requireQuizSetOwnership / requireTemplateOwnership — L68/74/82/85/93
- [x] 4 个路由文件已接入对应中间件：graphs/crud.ts (6 处)、tasks.ts (1 处)、quizSets.ts (3 处)、templates.ts (2 处)
- [x] `api/__tests__/middleware/ownership.test.ts` 已有相关测试覆盖
- [x] `npx vitest run api/__tests__/middleware/ownership.test.ts` 通过（43/43）

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过
- [x] `npm run lint` 通过
- [x] `npx vitest run api/__tests__/services/core/memoryEventBusBackend.test.ts` 通过（23/23）
- [x] `npx vitest run api/__tests__/services/core/eventBus.test.ts` 通过（既有 17 个测试无回归）
- [x] 4 个测试文件协同验证通过（memoryEventBusBackend 23 + eventBus 17 + jwtService 20 + ownership 43 = 103/103）
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 已知遗留问题（非本轮范围）

- Redis Pub/Sub 后端实现：本轮仅抽象接口，未实现 Redis 后端。未来 Web 多实例部署时需新建 `RedisEventBusBackend implements EventBusBackend`，并在工厂中切换。
- SSE 跨实例广播：本轮仅抽象 eventBus 后端。sseService 本身仍是进程内 Map，未来 Web 多实例部署时需让 sseService 订阅 eventBus（通过 eventBus.subscribe 接收跨实例事件并写入本地 SSE 连接）。这属于独立优化项，不在本轮 spec 范围内。
