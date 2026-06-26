# P0 关键问题修复 Spec

## Why

系统优化分析识别出三个 P0 级别问题，均属于真实存在的功能性 bug 或数据一致性问题，影响跨端体验与可观测性：

1. **移动端 FSRS 算法简化导致跨端数据漂移**：移动端 `updateProgress` 使用 `2^reviewCount` 简化指数退避，与桌面端 `ts-fsrs` 完整算法不一致；且移动端复习后**未更新** `fsrs_state/fsrs_stability/fsrs_difficulty/fsrs_retrievability` 等字段，导致同一用户跨端学习时 FSRS 模型被污染，调度精度下降。
2. **`mobileGraphsApi.getTags` 查询不存在的列**：移动端直接 `select("tags").from("knowledge_graphs")`，但 [02_knowledge_graph.sql](file:///d:/KnowledgeMap/supabase/migrations/02_knowledge_graph.sql) 中 `knowledge_graphs` 表无 `tags` 列；桌面端通过 `get_user_graph_tags` RPC + `graph_nodes.knowledge_points.properties` fallback 正常工作，移动端调用必失败并被 `console.error` 静默吞掉返回 `[]`，导致移动端标签功能完全失效。
3. **`errorReporter.getUserId` 读取错误的 localStorage key**：[errorReporter.ts:40](file:///d:/KnowledgeMap/src/utils/errorReporter.ts#L40) 读 key `user`，但 Zustand persist 的 name 是 `knowledge-map-auth`（[useStore.ts:36](file:///d:/KnowledgeMap/src/store/useStore.ts#L36)）；`setUserContext` 写 `errorContext` key，`getUserId` 又读 `user` key，三者全不匹配，导致错误上报永远无 userId 上下文。

## What Changes

### 修复 1：移动端 FSRS 算法统一（A3.1）
- 移动端 `mobileStudyApi.updateProgress` 引入 `ts-fsrs` 库，复用与桌面端一致的算法实现
- 移动端 `updateProgress` 写回完整 FSRS 字段：`fsrs_state/fsrs_stability/fsrs_difficulty/fsrs_elapsed_days/fsrs_scheduled_days/fsrs_last_review/last_rating`
- 在 `src/services/mobile/study/` 下新增 `fsrsEngine.ts`，封装 FSRS 参数加载、`dbCardToFSRS`、`mapQualityToRating`、`getFSRSForUser` 等共享逻辑（参考桌面端 [studyService.ts:50-155](file:///d:/KnowledgeMap/api/services/study/studyService.ts#L50-L155)）
- 移动端 `updateProgress` 复用 `masteryCalculationService` 触发知识点 mastery_level 重算（通过 Supabase RPC 或直接调用聚合逻辑）
- 移除 [learning.ts:230-239](file:///d:/KnowledgeMap/src/services/mobile/study/learning.ts#L230-L239) 的简化指数退避逻辑

### 修复 2：移动端 getTags schema 不一致（A3.3）
- 移动端 `mobileGraphsApi.getTags` 改为复用桌面端的查询逻辑：优先调用 `get_user_graph_tags` RPC，失败时 fallback 到 `graph_nodes.knowledge_points.properties` 中的 tags 聚合
- 不在 `knowledge_graphs` 表新增 `tags` 列（避免无数据来源的空列）；tags 实际来源于知识点的 `properties.tags` 字段
- 移除 [shared/types/database.ts:12](file:///d:/KnowledgeMap/shared/types/database.ts#L12) `KnowledgeGraphRow.tags` 字段（类型定义与 schema 不一致，是误导性定义）
- **BREAKING**：`KnowledgeGraphRow.tags` 类型字段移除，调用方需改用知识点 properties 中的 tags

### 修复 3：errorReporter userId 修复（A4.2）
- `getUserId` 改为从 Zustand store 读取：`useStore.getState().user?.id`（避免 localStorage key 不匹配问题）
- `setUserContext` 写入的 `errorContext` key 也由 `getUserId` 优先读取（作为 store 不可用时的 fallback）
- 登录/登出时由调用方显式调用 `setUserContext`/`clearUserContext`，确保 errorContext 与当前会话同步
- 在 [src/main.tsx](file:///d:/KnowledgeMap/src/main.tsx) 或 auth 状态变化处订阅 store 变化，自动同步 `setUserContext`

## Impact

- **Affected specs**: study 模块（移动端学习算法）、graph 模块（移动端标签查询）、错误监控
- **Affected code**:
  - `src/services/mobile/study/learning.ts` — 重写 `updateProgress`，移除简化算法
  - `src/services/mobile/study/fsrsEngine.ts` — **新增**，封装 FSRS 共享逻辑
  - `src/services/mobile/graphs.ts` — 重写 `getTags`，复用桌面端查询逻辑
  - `src/services/mobile/study/masterySync.ts` — **可能新增**，移动端触发 mastery 重算
  - `src/utils/errorReporter.ts` — 修复 `getUserId` 读取源
  - `src/store/useStore.ts` — 订阅用户状态变化同步 errorContext
  - `src/main.tsx` 或 `src/App.tsx` — 注册 auth 状态变化订阅
  - `shared/types/database.ts` — 移除 `KnowledgeGraphRow.tags` 字段
  - `package.json` — 确认 `ts-fsrs` 已是依赖（桌面端已用，移动端共享）

## ADDED Requirements

### Requirement: 移动端 FSRS 引擎共享模块

系统 SHALL 在 `src/services/mobile/study/fsrsEngine.ts` 中提供与桌面端 `studyService` 一致的 FSRS 算法封装。

#### Scenario: 移动端加载用户个性化 FSRS 参数
- **WHEN** 移动端调用 `getFSRSForUser(userId, supabase)`
- **THEN** 从 `users.settings` 读取 `request_retention/maximum_interval/fsrs_parameters`，通过 `migrateParameters` 自动迁移旧版参数，调用 `fsrs(params)` 返回 FSRS 实例
- **AND** 若读取失败，回退到 `fsrs()` 默认参数

#### Scenario: 移动端 DB 卡片转 FSRS Card
- **WHEN** 移动端调用 `dbCardToFSRS(dbCard)`
- **THEN** 返回包含 `due/stability/difficulty/elapsed_days/scheduled_days/reps/state/last_review` 的完整 FSRS Card 对象

#### Scenario: 移动端 quality 映射 Rating
- **WHEN** 移动端调用 `mapQualityToRating(quality)`
- **THEN** quality ≤ 1 → Again, 2 → Hard, 3 → Good, ≥ 4 → Easy（与桌面端 [studyService.ts:67-72](file:///d:/KnowledgeMap/api/services/study/studyService.ts#L67-L72) 一致）

### Requirement: 移动端 updateProgress 完整 FSRS 字段写回

系统 SHALL 在移动端 `updateProgress` 中写回完整 FSRS 调度字段，与桌面端保持一致。

#### Scenario: 移动端复习后写回 FSRS 字段
- **WHEN** 用户在移动端完成一次 study_card 复习并提交 quality
- **THEN** `study_cards` 表更新以下字段：`last_reviewed/next_review/review_count/fsrs_state/fsrs_stability/fsrs_difficulty/fsrs_elapsed_days/fsrs_scheduled_days/fsrs_last_review/last_rating`
- **AND** 调度算法由 `ts-fsrs` 的 `f.repeat(card, now)` 计算，而非简化指数退避

#### Scenario: 移动端复习后触发 mastery 重算
- **WHEN** 移动端 `updateProgress` 完成 FSRS 字段写回
- **THEN** 异步触发关联知识点的 `mastery_level` 重算（基于 FSRS retrievability 聚合）
- **AND** 重算失败不影响主流程，仅记录 warn 日志

#### Scenario: 跨端 FSRS 状态一致性
- **WHEN** 用户在移动端复习后切换到桌面端
- **THEN** 桌面端读取同一 study_card 的 `fsrs_state/stability/difficulty` 应与移动端写入值一致
- **AND** 桌面端 `f.repeat()` 基于这些值继续调度，不出现状态漂移

### Requirement: 移动端 getTags 复用桌面端查询逻辑

系统 SHALL 让移动端 `mobileGraphsApi.getTags` 使用与桌面端 `graphCrudService.getTags` 一致的数据来源。

#### Scenario: 移动端通过 RPC 获取标签
- **WHEN** 移动端调用 `getTags()` 且 `get_user_graph_tags` RPC 可用
- **THEN** 调用 RPC `get_user_graph_tags({ p_user_id: userId })` 返回 `Array<{ name: string; count: number }>`

#### Scenario: 移动端 RPC 失败时 fallback
- **WHEN** RPC 调用失败或返回错误
- **THEN** fallback 到查询 `graph_nodes.knowledge_points.properties` 中的 tags 字段聚合
- **AND** 返回 `Array<{ name: string; count: number }>` 格式与 RPC 一致

#### Scenario: 移动端无图谱时返回空数组
- **WHEN** 用户无任何图谱
- **THEN** `getTags()` 返回 `{ tags: [] }` 而非抛错

### Requirement: 错误上报携带正确用户上下文

系统 SHALL 确保错误上报的 `userId` 字段能正确反映当前登录用户。

#### Scenario: 错误上报从 Zustand store 读取 userId
- **WHEN** 错误发生时 `getUserId()` 被调用
- **THEN** 优先从 `useStore.getState().user?.id` 读取当前用户 ID
- **AND** 若 store 中无用户，回退到 localStorage 的 `errorContext` key

#### Scenario: 登录后自动同步 errorContext
- **WHEN** 用户登录成功，`useStore.user` 变为非 null
- **THEN** 自动调用 `setUserContext(userId, email)` 同步 `errorContext` localStorage
- **AND** 后续错误上报的 `userId` 字段携带该用户 ID

#### Scenario: 登出后自动清除 errorContext
- **WHEN** 用户登出，`useStore.user` 变为 null
- **THEN** 自动调用 `clearUserContext()` 清除 `errorContext` localStorage
- **AND** 后续错误上报的 `userId` 字段为 undefined

## MODIFIED Requirements

### Requirement: 移动端 updateProgress 算法实现

**原**：使用简化指数退避 `nextReviewDays = Math.min(2^reviewCount, 365)`（quality≥4）/ `reviewCount*2`（quality=3）/ `1`（quality=2）/ `0`（quality<2），仅更新 `last_reviewed/next_review/review_count`。

**新**：使用 `ts-fsrs` 的 `f.repeat(card, now)` 计算调度，写回完整 FSRS 字段（`fsrs_state/stability/difficulty/elapsed_days/scheduled_days/last_review/last_rating`），异步触发 mastery 重算。

### Requirement: mobileGraphsApi.getTags 数据来源

**原**：直接 `select("tags").from("knowledge_graphs")`，查询不存在的列，失败时静默返回 `[]`。

**新**：优先调用 `get_user_graph_tags` RPC，失败时 fallback 到 `graph_nodes.knowledge_points.properties` 聚合，返回 `Array<{ name: string; count: number }>`。

### Requirement: errorReporter.getUserId 数据源

**原**：从 localStorage 读 key `user`，与 Zustand persist name `knowledge-map-auth` 不匹配，永远返回 undefined。

**新**：优先从 `useStore.getState().user?.id` 读取，回退到 localStorage `errorContext` key（由 `setUserContext` 写入）。

## REMOVED Requirements

### Requirement: 移动端简化指数退避算法
**Reason**：被 `ts-fsrs` 完整算法替代，简化算法导致跨端数据漂移
**Migration**：
- [learning.ts:230-239](file:///d:/KnowledgeMap/src/services/mobile/study/learning.ts#L230-L239) 的 `if (quality >= 4) nextReviewDays = Math.min(2 ** reviewCount, 365)...` 逻辑移除
- 改为调用 `fsrsEngine.getFSRSForUser()` + `f.repeat()` + `fsrsEngine.dbCardToFSRS()`

### Requirement: KnowledgeGraphRow.tags 类型字段
**Reason**：数据库 schema 中 `knowledge_graphs` 表无 `tags` 列，类型定义是误导性的，tags 实际来源于 `knowledge_points.properties.tags`
**Migration**：
- [shared/types/database.ts:12](file:///d:/KnowledgeMap/shared/types/database.ts#L12) 移除 `tags?: string[] | null` 字段
- 移动端 `getTags` 内部的 `Pick<KnowledgeGraphRow, "tags">` 类型断言改为从 `knowledge_points.properties` 读取
- 桌面端代码不受影响（已通过 RPC + fallback 工作）
