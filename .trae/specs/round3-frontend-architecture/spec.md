# 前端架构与渲染性能优化 Spec

## Why

第三轮优化路线图中的 P1-13 ~ P1-16 暴露了四个影响前端可维护性与渲染性能的结构性问题：

1. `src/pages/GraphEditor.tsx` 已膨胀至 1620+ 行，混合了叙事模式、学习路径、区域管理、键盘快捷键、上下文菜单、AI 操作等 8+ 关注点，难以维护与测试。
2. `useGraphEditorState` 在每次渲染时通过 spread 10 个子 hook 生成新对象引用，破坏下游 `useMemo` / `React.memo` 的引用稳定性。
3. `useAIPerformanceStore` 在 Zustand 中直接调用 `request()` 拉取/删除服务器数据，违反 "UI 状态用 Zustand、服务器状态用 TanStack Query" 的边界约定，导致缺少缓存、自动失效、请求去重等能力。
4. `useConsoleStore` 的 `partialize` 把瞬时性的 `output` 数组也持久化到 localStorage，导致存储增长无上限；`MAX_HISTORY_ITEMS = 100` 也偏大。

## What Changes

### P1-13 GraphEditor.tsx 拆分

- 抽出 `src/pages/GraphEditor/hooks/useLearningPathHandlers.ts` —— 封装学习路径选择、节点点击、叙事模式启停相关状态与回调（`selectedLearningPathId`、`learningPathNodeIds`、`learningPathOrderMap`、`handleSelectLearningPath`、`handleStartNarrative`、`handleExitNarrative`、`handleLearningPathNodeClick`）。
- 抽出 `src/pages/GraphEditor/hooks/useRegionHandlers.ts` —— 封装自定义区域相关状态与回调（`customRegions`、`originPosition`、`collapsedRegions`、`handleCreateRegion`、`handleRegionToggle`、`handleOriginMove`）。
- 抽出 `src/pages/GraphEditor/hooks/useConceptExtractionHandlers.ts` —— 封装文献提取结果处理（`handleLiteratureExtractComplete`、`handleConfirmConcepts`）。
- `GraphEditor.tsx` 改为通过这三个 hook 获取已封装的状态与回调，移除被抽离的本地 `useState` 与 `useCallback`。

### P1-14 useGraphEditorState 重渲染优化

- 在 `src/hooks/graphEditor/index.ts` 中用 `useMemo` 包裹 `useGraphEditorState` 的返回对象，依赖数组列出 10 个子 hook 返回值 + `graphRef`，使对象引用在子 hook 引用未变化时保持稳定。

### P1-15 useAIPerformanceStore 迁移到 TanStack Query

- 新增 `src/hooks/queries/useAiPerformanceQueries.ts`，导出：
  - `useAiPerformanceLogs(query)` —— `useQuery` 包装 `GET /ai/performance/logs`
  - `useAiPerformanceStats(query)` —— `useQuery` 包装 `GET /ai/performance/stats`
  - `useClearAiPerformanceLogs()` —— `useMutation` 包装 `DELETE /ai/performance/logs`，成功后失效相关 queryKey
- 在 `src/hooks/queries/config.ts` 的 `queryKeys` 中新增 `aiPerformanceLogs` 与 `aiPerformanceStats` 两个 key 工厂。
- 重写 `src/store/useAIPerformanceStore.ts`：移除 `fetchLogs` / `fetchStats` / `clearLogs` / `logs` / `stats` / `isLoading` / `error` / `setLogs` 等服务器状态字段；保留为薄包装（仅暴露 `useAiPerformanceQueries` 的引用）或直接删除并让 `PerformanceTab.tsx` 改用 query hooks。
- 更新 `src/components/Console/PerformanceTab.tsx`：用新的 `useAiPerformanceLogs` / `useAiPerformanceStats` / `useClearAiPerformanceLogs` 替代 store 解构；`isLoading` / `error` 来自 query 状态；`loadData` 改为依赖 queryKey 的自动失效或 `queryClient.invalidateQueries`。

### P1-16 useConsoleStore 持久化收窄

- `src/store/useConsoleStore.ts`：
  - `MAX_HISTORY_ITEMS` 从 100 调整为 50。
  - `partialize` 移除 `output` 字段（瞬时输出，不应持久化）。
  - `output` 与 `MAX_OUTPUT_ITEMS` 行为保持不变（运行时仍截断到 200 条）。

## Impact

- **Affected specs**: 无前序 spec 直接关联（前 4 个 spec 均为后端/数据库主题）。
- **Affected code**:
  - `src/pages/GraphEditor.tsx`（P1-13）
  - `src/pages/GraphEditor/hooks/useLearningPathHandlers.ts`、`useRegionHandlers.ts`、`useConceptExtractionHandlers.ts`（P1-13，新增）
  - `src/hooks/graphEditor/index.ts`（P1-14）
  - `src/store/useAIPerformanceStore.ts`（P1-15）
  - `src/hooks/queries/useAiPerformanceQueries.ts`（P1-15，新增）
  - `src/hooks/queries/config.ts`（P1-15）
  - `src/hooks/queries/index.ts`（P1-15，导出新 hook）
  - `src/components/Console/PerformanceTab.tsx`（P1-15）
  - `src/store/useConsoleStore.ts`（P1-16）

## ADDED Requirements

### Requirement: GraphEditor 子模块按关注点拆分

系统 SHALL 将 `GraphEditor.tsx` 中学习路径、自定义区域、文献概念提取三类逻辑分别封装到独立的自定义 hook 中，主组件仅负责组合与渲染。

#### Scenario: 学习路径逻辑被独立封装

- **WHEN** 开发者需要修改学习路径选择或叙事模式启停逻辑
- **THEN** 只需修改 `useLearningPathHandlers.ts`，无需触碰 `GraphEditor.tsx` 主体

#### Scenario: 自定义区域逻辑被独立封装

- **WHEN** 开发者需要修改区域创建、折叠、原点移动逻辑
- **THEN** 只需修改 `useRegionHandlers.ts`

#### Scenario: 文献概念提取逻辑被独立封装

- **WHEN** 开发者需要修改概念提取完成回调或概念确认逻辑
- **THEN** 只需修改 `useConceptExtractionHandlers.ts`

### Requirement: useGraphEditorState 返回对象引用稳定

系统 SHALL 通过 `useMemo` 包裹 `useGraphEditorState` 的返回对象，使其在子 hook 引用未变化时保持稳定的对象引用。

#### Scenario: 子 hook 引用未变化

- **WHEN** `useGraphEditorState` 被调用且所有 10 个子 hook 返回的对象引用均与上次相同
- **THEN** 返回的对象引用与上次相同（`Object.is` 相等）

### Requirement: AI 性能数据通过 TanStack Query 获取

系统 SHALL 通过 TanStack Query hooks（`useAiPerformanceLogs`、`useAiPerformanceStats`、`useClearAiPerformanceLogs`）管理 AI 性能日志与统计的服务器状态，Zustand store 不再直接调用 HTTP 请求。

#### Scenario: 获取性能日志

- **WHEN** `PerformanceTab` 挂载并触发 `useAiPerformanceLogs(query)`
- **THEN** TanStack Query 自动发起 `GET /ai/performance/logs` 请求，返回 `{ logs }` 数据并缓存到 `queryKeys.aiPerformanceLogs(query)` 键下

#### Scenario: 清除性能日志后自动失效缓存

- **WHEN** `useClearAiPerformanceLogs` 的 mutation 成功完成
- **THEN** `aiPerformanceLogs` 与 `aiPerformanceStats` 两个 queryKey 的缓存被失效，触发 `PerformanceTab` 自动重新拉取

### Requirement: useConsoleStore 持久化范围收窄

系统 SHALL 仅持久化控制台 UI 状态（`isOpen`、`isMinimized`、`history`）到 localStorage，不再持久化瞬时输出 `output`，并将 `MAX_HISTORY_ITEMS` 收紧到 50。

#### Scenario: output 不被写入 localStorage

- **WHEN** 用户在控制台执行命令产生新的 output 条目
- **THEN** localStorage 中的 `knowledgeMap-console` 键值不包含 `output` 字段，仅包含 `isOpen` / `isMinimized` / `history`

#### Scenario: 历史记录上限为 50

- **WHEN** 用户执行第 51 条不同的命令
- **THEN** `history` 数组长度保持为 50，最旧的条目被丢弃

## MODIFIED Requirements

### Requirement: PerformanceTab 数据加载

`PerformanceTab` SHALL 通过 TanStack Query hooks 而非 Zustand store 获取 `logs`、`stats`、`isLoading`、`error`，刷新与清除操作通过 `queryClient.invalidateQueries` 或 mutation 触发。

## REMOVED Requirements

### Requirement: useAIPerformanceStore 服务器状态字段

**Reason**: 服务器状态（`logs`、`stats`、`isLoading`、`error`、`fetchLogs`、`fetchStats`、`clearLogs`）已迁移至 TanStack Query，store 不再承担此职责。

**Migration**: `PerformanceTab.tsx` 改用 `useAiPerformanceLogs` / `useAiPerformanceStats` / `useClearAiPerformanceLogs`；其他模块（如 `services/api/contracts/IPerformanceApi.ts`、`services/api/performance.ts`）保留不变，因为它们是 API 客户端而非 store 消费者。
