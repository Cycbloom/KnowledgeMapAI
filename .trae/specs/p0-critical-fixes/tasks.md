# Tasks

> 三个 P0 修复相互独立，可并行执行。Task 1 / Task 2 是小修复，Task 3 涉及移动端算法迁移工程量较大。

- [x] Task 1: 修复 errorReporter.getUserId 读取源（A4.2）
  - [x] SubTask 1.1: 修改 [src/utils/errorReporter.ts](file:///d:/KnowledgeMap/src/utils/errorReporter.ts) 的 `getUserId` 函数，优先从 `useStore.getState().user?.id` 读取，回退到 localStorage `errorContext` key
  - [x] SubTask 1.2: 在 [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 中订阅 `useStore` 用户状态变化，登录时调用 `setUserContext(userId, email)`，登出时调用 `clearUserContext()`
  - [x] SubTask 1.3: 验证 `setUserContext` 写入的 `errorContext` localStorage 结构与 `getUserId` fallback 读取结构一致（`{ userId, email }` → 读 `userId` 字段）
  - [x] SubTask 1.4: 运行 `npm run check` 与 `npm run lint` 确保无类型错误（注：`check:incremental` 因预存在脚本路径 bug 失败，全量 check 通过）

- [x] Task 2: 修复 mobileGraphsApi.getTags schema 不一致（A3.3）
  - [x] SubTask 2.1: 重写 [src/services/mobile/graphs.ts](file:///d:/KnowledgeMap/src/services/mobile/graphs.ts) `getTags` 方法，改为优先调用 `get_user_graph_tags` RPC，失败时 fallback 到 `graph_nodes.knowledge_points.properties` 聚合（参考桌面端 [api/services/graph/graphCrudService.ts:77-145](file:///d:/KnowledgeMap/api/services/graph/graphCrudService.ts#L77-L145)）
  - [x] SubTask 2.2: 移除 [shared/types/database.ts](file:///d:/KnowledgeMap/shared/types/database.ts) `KnowledgeGraphRow.tags?: string[] | null` 字段
  - [x] SubTask 2.3: 全局搜索 `KnowledgeGraphRow` 引用，确认无其他代码依赖被移除的 `tags` 字段（仅 mobile/graphs.ts:388 一处，已随重写移除）
  - [x] SubTask 2.4: 同步更新 [src/services/api/contracts/IGraphsApi.ts](file:///d:/KnowledgeMap/src/services/api/contracts/IGraphsApi.ts) 契约返回类型为 `Promise<{ tags: Array<{ name: string; count: number }> }>`（原 `Promise<string[]>` 与桌面端运行时不一致）
  - [x] SubTask 2.5: 运行 `npm run check` 与 `npm run lint` 确保无类型错误

- [x] Task 3: 移动端引入 ts-fsrs 统一 FSRS 算法（A3.1）
  - [x] SubTask 3.1: 创建 `src/services/mobile/study/fsrsEngine.ts`，封装以下函数（参考桌面端 [api/services/study/studyService.ts:50-155](file:///d:/KnowledgeMap/api/services/study/studyService.ts#L50-L155)）：
    - `dbCardToFSRS(dbCard: StudyCard): Card` — DB 卡片转 FSRS Card
    - `mapQualityToRating(quality: number): Rating` — quality 映射 Rating
    - `getFSRSForUser(userId: string, supabase: SupabaseClient): Promise<FSRS>` — 加载用户个性化参数并返回 FSRS 实例
  - [x] SubTask 3.2: 确认 `ts-fsrs: ^5.2.3`（实际 5.3.1）已在 [package.json](file:///d:/KnowledgeMap/package.json) dependencies 中，无需升级
  - [x] SubTask 3.3: 重写 [src/services/mobile/study/learning.ts](file:///d:/KnowledgeMap/src/services/mobile/study/learning.ts) `updateProgress` 方法：
    - 读取 card → `dbCardToFSRS` → `getFSRSForUser` → `f.repeat(card, now)` → 取 rating 对应的 `scheduledCard`
    - 写回完整 FSRS 字段：`last_reviewed/next_review/review_count/fsrs_state/fsrs_stability/fsrs_difficulty/fsrs_elapsed_days/fsrs_scheduled_days/fsrs_last_review/last_rating`
    - 移除简化指数退避逻辑
    - 通过 `client.auth.getUser()` 获取 userId（保持契约签名 `(id, quality)` 不变）
  - [x] SubTask 3.4: mastery 重算策略选择**方案 C（降级）**：Grep 确认无 `update_knowledge_point_mastery` RPC，移动端仅更新 FSRS 字段，mastery 重算由桌面端下次登录时通过 `masteryCalculationService` 批量触发，`console.warn` 提示
  - [x] SubTask 3.5: 验证移动端 `updateProgress` 返回值 `{ success: true, card: StudyCard }` 与 `IStudyApi.updateProgress` 契约 `Promise<unknown>` 兼容
  - [x] SubTask 3.6: 编写单元测试 [src/__tests__/services/mobile/study/fsrsEngine.test.ts](file:///d:/KnowledgeMap/src/__tests__/services/mobile/study/fsrsEngine.test.ts)，14 用例覆盖 dbCardToFSRS/mapQualityToRating/getFSRSForUser 关键路径，全部通过
  - [x] SubTask 3.7: 运行 `npm run check` 与 `npm run lint` 确保无类型错误

# Task Dependencies

- [Task 1], [Task 2], [Task 3] 之间无依赖，可并行执行
- [Task 1] 是最小修复（约 30 行代码改动），建议优先完成以验证 spec 流程
- [Task 2] 涉及全局类型字段移除，需谨慎检查引用
- [Task 3] 工程量最大，涉及新文件创建 + 算法迁移 + mastery 触发策略决策

# Validation

每个 Task 完成后：
1. 运行 `npm run check:incremental` 通过类型检查
2. 运行 `npm run lint` 通过代码规范检查
3. 在 Tasks 文件中勾选对应 checkbox
全部完成后：
4. 运行 `npm run check` 全量类型检查
5. 运行 `npx playwright test --grep="移动端"` 验证移动端 E2E 测试不被破坏
