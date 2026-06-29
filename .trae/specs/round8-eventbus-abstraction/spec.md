# Round 8 Task 3-5: Validate Already-Done Items + Abstract EventBus Backend Spec

## Why

用户请求继续完成第 8 轮的 Task 3-5，并要求"验证这些优化是否必要，如果是，则完善这些优化"。经核查现状：
- **Task 4 (P3-07 Refresh token 轮换)** 已在 Round 6 Task 1 完成：`jwtService.ts` 完整实现 refresh token 轮换、SHA-256 哈希存储、`revoked_tokens` 表、竞态处理；20 个单元测试已通过。**无需重复实施**。
- **Task 5 (P3-08 Ownership 中间件补全)** 已在 Round 6 Task 2 完成：`ownership.ts` 通过 `buildOwnershipMiddleware` 高阶函数实现 `requireKnowledgePointOwnership` / `requireGraphOwnership` / `requireTaskOwnership` / `requireQuizSetOwnership` / `requireTemplateOwnership` 共 5 个中间件；4 个路由文件接入 + 43 个测试已通过。**无需重复实施**。
- **Task 3 (P2-11 SSE/eventBus Redis Pub/Sub)** 未实施：`eventBus.ts` 仍是进程内 Map，多实例部署时事件无法跨实例广播。**必要性成立**：roadmap 自评 P2 中优先级，备注"Web 部署会坏"；与 Round 8 Task 1-2 已完成的 `cacheService` / `rateLimiter` 抽象策略一致（接口 + Memory 实现 + 工厂未实现 Redis 分支）。

## What Changes

- 抽象 `EventBusBackend` 接口（`publish` / `subscribe` / `unsubscribe`），定义事件总线后端契约
- 实现 `MemoryEventBusBackend implements EventBusBackend`，将现有 `AppEventBus` 内 `handlers: Map<string, Set<AppEventHandler>>` 进程内逻辑迁移到此类
- 导出 `createEventBusBackend(): EventBusBackend` 工厂函数，根据 `process.env.EVENT_BUS_BACKEND`（默认 `memory`）返回实例；`redis` 值时抛 `Error('Redis event bus backend not yet implemented. Set EVENT_BUS_BACKEND=memory')`
- 重构 `AppEventBus` 类：移除内部 `handlers` Map，改为注入 `EventBusBackend` 实例；`publish` / `subscribe` / `unsubscribe` 委托给 backend；保留 `executeHandlerWithRetry` 重试 + 死信队列逻辑（这部分仍是进程内行为，因为重试本质是本地 handler 失败的容错，无需跨实例）
- 公开 API 签名与行为完全不变（向后兼容）
- 新增 `api/__tests__/services/core/memoryEventBusBackend.test.ts`，覆盖 publish/subscribe/unsubscribe、多 handler 并发、unsubscribe 后不再触发、handler 失败不影响其他 handler
- 在 `.env.example` 新增 `EVENT_BUS_BACKEND=memory` 配置段
- 验证 P3-07 和 P3-08 的现状（仅核对，不重复实施）

## Impact

- Affected specs: 无（与 Round 8 Task 1-2 cacheService/rateLimiter 抽象一致的策略延伸）
- Affected code:
  - `d:\KnowledgeMap\api\services\core\eventBus.ts`（重构为委托模式）
  - `d:\KnowledgeMap\api\services\core\eventBusBackend.ts`（新建：接口 + Memory 实现 + 工厂）
  - `d:\KnowledgeMap\api\__tests__\services\core\memoryEventBusBackend.test.ts`（新建）
  - `d:\KnowledgeMap\.env.example`（新增配置段）

## ADDED Requirements

### Requirement: EventBusBackend 接口契约

系统 SHALL 定义 `EventBusBackend` 接口作为事件总线存储后端的契约，包含以下方法：
- `subscribe(eventType: AppEventType, handler: AppEventHandler): void`
- `unsubscribe(eventType: AppEventType, handler: AppEventHandler): void`
- `publish(event: AppEvent): void`（注意：仅负责将事件分发给所有订阅者，handler 执行与重试仍由 `AppEventBus` 编排）

#### Scenario: 工厂根据环境变量返回后端
- **WHEN** 调用 `createEventBusBackend()`
- **AND** `process.env.EVENT_BUS_BACKEND` 为 `memory` 或未设置
- **THEN** 返回 `MemoryEventBusBackend` 实例
- **WHEN** `process.env.EVENT_BUS_BACKEND` 为 `redis`
- **THEN** 抛出 `Error('Redis event bus backend not yet implemented. Set EVENT_BUS_BACKEND=memory')`

### Requirement: MemoryEventBusBackend 实现

系统 SHALL 提供 `MemoryEventBusBackend implements EventBusBackend`，封装现有进程内 `Map<string, Set<AppEventHandler>>` 逻辑。

#### Scenario: 多 handler 并发分发
- **WHEN** 同一 `eventType` 已注册 handler A 与 handler B
- **AND** 调用 `publish(event)`
- **THEN** A 与 B 都被调用，且 A 失败不影响 B 触发

#### Scenario: unsubscribe 后不再触发
- **WHEN** handler A 已通过 `subscribe` 注册
- **AND** 调用 `unsubscribe(eventType, A)`
- **AND** 调用 `publish(event)`
- **THEN** A 不再被调用

## MODIFIED Requirements

### Requirement: AppEventBus 委托 backend

`AppEventBus` 类 SHALL 通过注入的 `EventBusBackend` 实例处理订阅与分发，移除内部 `handlers` Map。重试 + 死信队列逻辑保留在 `AppEventBus.executeHandlerWithRetry` 中（这是 handler 失败的本地容错，与后端存储无关）。

#### Scenario: 公开 API 行为不变
- **WHEN** 调用 `appEventBus.subscribe(eventType, handler)` / `unsubscribe` / `publish`
- **THEN** 行为与重构前完全一致（向后兼容）

#### Scenario: 死信队列仍由 AppEventBus 管理
- **WHEN** handler 重试 4 次全部失败
- **THEN** 事件进入 `AppEventBus.deadLetterQueue`，与 backend 实现无关

## REMOVED Requirements

### Requirement: 无移除项

本次修改不删除任何公开 API 或既有行为。
