# Tasks

- [x] Task 1: P2-11 EventBusBackend 抽象 + MemoryEventBusBackend
  - [x] SubTask 1.1: 新建 `d:\KnowledgeMap\api\services\core\eventBusBackend.ts`，定义 `EventBusBackend` 接口，包含方法：`subscribe(eventType: AppEventType, handler: AppEventHandler): void`, `unsubscribe(eventType: AppEventType, handler: AppEventHandler): void`, `publish(event: AppEvent): void`（仅负责将事件分发给所有订阅者；handler 执行与重试仍由 `AppEventBus` 编排）
  - [x] SubTask 1.2: 在 `eventBusBackend.ts` 中实现 `MemoryEventBusBackend implements EventBusBackend`，将 `eventBus.ts` 中现有的 `handlers: Map<string, Set<AppEventHandler>>` 逻辑迁移到此类（保留 Set 自动去重、unsubscribe 后清理空 Set 等行为）
  - [x] SubTask 1.3: 在 `eventBusBackend.ts` 中导出 `createEventBusBackend(): EventBusBackend` 工厂函数，根据 `process.env.EVENT_BUS_BACKEND`（默认 `memory`）返回实例；`redis` 值时抛 `Error('Redis event bus backend not yet implemented. Set EVENT_BUS_BACKEND=memory')`
  - [x] SubTask 1.4: 修改 `d:\KnowledgeMap\api\services\core\eventBus.ts`：移除 `private handlers: Map<string, Set<AppEventHandler>> = new Map()`，改为 `private backend: EventBusBackend = createEventBusBackend()`；将 `subscribe` / `unsubscribe` / `publish` 委托给 backend；`executeHandlerWithRetry` 与死信队列逻辑保留在 `AppEventBus` 类中（不依赖 backend）；公开 API 签名与行为完全不变
  - [x] SubTask 1.5: 新增 `d:\KnowledgeMap\api\__tests__\services\core\memoryEventBusBackend.test.ts`，覆盖：subscribe + publish 单 handler 触发、多 handler 并发分发、unsubscribe 后不再触发、unsubscribe 清理空 Set、handler 失败不影响其他 handler、工厂函数分支（memory 默认 / redis 抛错）
  - [x] SubTask 1.6: 在 `d:\KnowledgeMap\.env.example` 新增 `EVENT_BUS_BACKEND=memory`（注释说明未来可切 redis）

- [x] Task 2: 验证 P3-07 Refresh token 轮换已在 Round 6 完成（不重复实施）
  - [x] SubTask 2.1: 核对 `d:\KnowledgeMap\api\services\auth\jwtService.ts` 已有 `computeTokenHash` / `isTokenRevoked` / `refreshAccessToken` 方法（含 SHA-256 哈希 + revoked_tokens 表查询 + 23505 竞态处理 + jti 轮换）
  - [x] SubTask 2.2: 核对 `d:\KnowledgeMap\api\__tests__\services\auth\jwtService.test.ts` 已有相关测试覆盖（约 20 个测试，包括正常 refresh、旧 token 复用被拒、过期 token 被拒、黑名单 token 被拒）
  - [x] SubTask 2.3: 运行 `npx vitest run api/__tests__/services/auth/jwtService.test.ts` 确认测试通过（20/20）

- [x] Task 3: 验证 P3-08 Ownership 中间件已在 Round 6 完成（不重复实施）
  - [x] SubTask 3.1: 核对 `d:\KnowledgeMap\api\middleware\ownership.ts` 已有 `buildOwnershipMiddleware` 高阶函数 + 5 个导出（requireKnowledgePointOwnership / requireGraphOwnership / requireTaskOwnership / requireQuizSetOwnership / requireTemplateOwnership）
  - [x] SubTask 3.2: 核对 `d:\KnowledgeMap\api\__tests__\middleware\ownership.test.ts` 已有相关测试覆盖（43 个测试）
  - [x] SubTask 3.3: 运行 `npx vitest run api/__tests__/middleware/ownership.test.ts` 确认测试通过（43/43）

# Task Dependencies

- Task 1 / 2 / 3 互相独立，可并行
- Task 2 与 Task 3 仅做现状验证（不修改代码），最快完成
- Task 1 完成后统一运行全局验证（check + check:electron + lint + 相关测试）
