# P0 关键问题修复 Checklist

## Task 1: errorReporter userId 修复

- [x] `errorReporter.getUserId` 优先从 `useStore.getState().user?.id` 读取当前用户 ID
- [x] `errorReporter.getUserId` 在 store 无用户时回退到 localStorage `errorContext` key 读取（结构 `{ userId, email }` → 取 `userId` 字段）
- [x] 不再从 localStorage `user` key 读取（移除原有错误逻辑）
- [x] `useStore` 用户状态变化时自动同步 `errorContext`：登录→`setUserContext(userId, email)`，登出→`clearUserContext()`
- [x] `setUserContext` 写入的 localStorage 结构与 `getUserId` fallback 读取结构一致
- [x] `npm run check` 全量类型检查通过（`check:incremental` 因预存在脚本路径 bug 不可用，已用全量 check 替代）
- [x] `npm run lint` 通过

## Task 2: mobileGraphsApi.getTags 修复

- [x] `mobileGraphsApi.getTags` 优先调用 `get_user_graph_tags` RPC（参数 `{ p_user_id: userId }`）
- [x] RPC 失败时 fallback 到查询 `graph_nodes.knowledge_points.properties` 中的 tags 字段聚合
- [x] fallback 查询逻辑与桌面端 [graphCrudService.getTagsFallback](file:///d:/KnowledgeMap/api/services/graph/graphCrudService.ts#L102) 一致
- [x] 不再直接 `select("tags").from("knowledge_graphs")`（移除错误查询）
- [x] 返回值结构为 `{ tags: Array<{ name: string; count: number }> }`，与 `IGraphsApi.getTags` 契约一致
- [x] 无图谱时返回 `{ tags: [] }` 而非抛错
- [x] `shared/types/database.ts` 中 `KnowledgeGraphRow.tags` 字段已移除
- [x] 全局搜索确认无其他代码依赖 `KnowledgeGraphRow.tags`（仅 mobile/graphs.ts:388 一处，已随重写移除）
- [x] 桌面端 `graphCrudService.getTags` 未受影响（仍通过 RPC + fallback 工作）
- [x] 同步更新 `IGraphsApi.getTags` 契约返回类型（原 `Promise<string[]>` 与运行时不一致）
- [x] `npm run check` 全量类型检查通过
- [x] `npm run lint` 通过

## Task 3: 移动端 FSRS 算法统一

### fsrsEngine.ts 共享模块

- [x] 新建 `src/services/mobile/study/fsrsEngine.ts`
- [x] 实现 `dbCardToFSRS(dbCard: StudyCard): Card`，字段映射与桌面端 [studyService.ts:50-65](file:///d:/KnowledgeMap/api/services/study/studyService.ts#L50-L65) 一致
- [x] 实现 `mapQualityToRating(quality: number): Rating`，映射规则：≤1→Again, 2→Hard, 3→Good, ≥4→Easy
- [x] 实现 `getFSRSForUser(userId, supabase): Promise<FSRS>`，从 `users.settings` 读取 `request_retention/maximum_interval/fsrs_parameters`
- [x] `getFSRSForUser` 通过 `migrateParameters` 自动迁移旧版参数（17/19 → 21）
- [x] `getFSRSForUser` 读取失败时回退到 `fsrs()` 默认参数
- [x] `ts-fsrs: ^5.2.3`（实际 5.3.1）已在 `package.json` dependencies 中，无需升级

### learning.ts updateProgress 重写

- [x] 移除 [learning.ts:230-239](file:///d:/KnowledgeMap/src/services/mobile/study/learning.ts#L230-L239) 的简化指数退避逻辑
- [x] 改为调用 `fsrsEngine.dbCardToFSRS(card)` 转换 DB 卡片
- [x] 改为调用 `fsrsEngine.getFSRSForUser(userId, client)` 加载 FSRS 实例
- [x] 改为调用 `f.repeat(fsrsCard, now)` 计算调度
- [x] 改为通过 `fsrsEngine.mapQualityToRating(quality)` 映射 Rating
- [x] 写回完整 FSRS 字段：`fsrs_state/fsrs_stability/fsrs_difficulty/fsrs_elapsed_days/fsrs_scheduled_days/fsrs_last_review/last_rating`
- [x] 仍写回原有字段：`last_reviewed/next_review/review_count`
- [x] `fsrs_state` 写入 `State[scheduledCard.state]` 字符串形式（与桌面端一致）

### mastery 重算触发

- [x] 移动端 `updateProgress` 选择**方案 C**：仅更新 FSRS 字段，mastery 重算由桌面端下次登录时通过 `masteryCalculationService` 批量触发
- [x] `console.warn` 提示 mastery RPC 不可用，不影响主流程（不抛错）
- [x] 重算策略已明确选择（方案 C，因 Grep 确认无 `update_knowledge_point_mastery` RPC）

### 跨端一致性

- [x] 移动端写入的 `fsrs_state/stability/difficulty` 值与桌面端使用相同算法产生（同一 card + 同一 rating 应得相同调度结果，因复用 ts-fsrs 同一库版本）
- [x] 移动端 `updateProgress` 返回值 `{ success: true, card: StudyCard }` 与 `IStudyApi.updateProgress` 契约 `Promise<unknown>` 兼容
- [x] 桌面端 `studyService.updateProgress` 不受影响（无代码改动）

### 验证

- [x] 单元测试覆盖 `dbCardToFSRS` / `mapQualityToRating` / `getFSRSForUser` 关键路径（14 用例全部通过）
- [x] `npm run check` 全量类型检查通过
- [x] `npm run lint` 通过

## 全局验证

- [x] `npm run check` 全量类型检查通过（exit 0）
- [x] `npm run lint` 全量代码规范检查通过（exit 0）
- [x] `npx vitest run src/__tests__/services/mobile/study/fsrsEngine.test.ts` 14/14 通过
- [x] 三个修复的代码改动均未引入新的 `any` 类型或非空断言 `!`（符合项目规则）
- [x] 三个修复的代码改动均未在前端引入 `console.log/info`（符合项目规则，`warn/error` 允许）
- [x] 后端代码改动使用 `logger` 而非 `console`（本次无后端代码改动）

## 已知的环境限制（非本次改动引入）

- `npm run check:incremental` 失败：`scripts/incremental-check.mjs` 脚本路径解析 bug（临时 tsconfig 写入 `node_modules/.cache/` 但 `extends: './tsconfig.json'` 相对该目录解析失败），属预存在基础设施问题
- `npx playwright test --grep="移动端"` 26 passed / 69 failed：失败全部是 `browserType.launch: Executable doesn't exist`（webkit/Mobile Safari 浏览器未安装），属环境问题
- `npx vitest run` 408 passed / 79 failed：失败全部是 `ConsoleOutput.test.tsx` 等 i18n 文本匹配问题（测试期望中文文本但渲染的是 i18n key），属预存在测试环境配置问题
