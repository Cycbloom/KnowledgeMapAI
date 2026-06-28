# Tasks

- [x] Task 1: P1-13 抽出 useLearningPathHandlers hook
  - [x] SubTask 1.1: 创建 `src/pages/GraphEditor/hooks/useLearningPathHandlers.ts`，封装 `selectedLearningPathId`、`learningPathNodeIds`、`learningPathOrderMap` 三个 useState 与 `handleSelectLearningPath`、`handleStartNarrative`、`handleExitNarrative`、`handleLearningPathNodeClick` 四个 useCallback
  - [x] SubTask 1.2: hook 接收必要的依赖参数（`nodes`、`viewMode`、`setViewMode`、`graphRef`、`state` 中的 narrative 相关字段、`focusNodeWithNode`、`startNarrative`、`exitNarrative`、`state.savedTransform`、`state.isPresentationMode`、`state.setIsPresentationMode`、`state.setFocusedNodeId` 等），返回封装好的状态与回调
  - [x] SubTask 1.3: 在 `GraphEditor.tsx` 中用 `const { selectedLearningPathId, learningPathNodeIds, learningPathOrderMap, handleSelectLearningPath, handleStartNarrative, handleExitNarrative, handleLearningPathNodeClick } = useLearningPathHandlers({...})` 替换原有 useState 与 useCallback，删除被抽离的代码

- [x] Task 2: P1-13 抽出 useRegionHandlers hook
  - [x] SubTask 2.1: 创建 `src/pages/GraphEditor/hooks/useRegionHandlers.ts`，封装 `customRegions`、`originPosition`、`collapsedRegions` 三个 useState 与 `handleCreateRegion`、`handleRegionToggle`、`handleOriginMove` 三个 useCallback
  - [x] SubTask 2.2: hook 不需要外部依赖参数（所有依赖均来自内部 useState 与 `message`），返回 `{ customRegions, originPosition, collapsedRegions, handleCreateRegion, handleRegionToggle, handleOriginMove, setCustomRegions, setCollapsedRegions, setOriginPosition }`
  - [x] SubTask 2.3: 在 `GraphEditor.tsx` 中用解构替换原有 useState 与 useCallback，删除被抽离的代码

- [x] Task 3: P1-13 抽出 useConceptExtractionHandlers hook
  - [x] SubTask 3.1: 创建 `src/pages/GraphEditor/hooks/useConceptExtractionHandlers.ts`，封装 `handleLiteratureExtractComplete` 与 `handleConfirmConcepts` 两个 useCallback
  - [x] SubTask 3.2: hook 接收 `{ id, panelState, queryClient }` 参数，返回 `{ handleLiteratureExtractComplete, handleConfirmConcepts }`
  - [x] SubTask 3.3: 在 `GraphEditor.tsx` 中用解构替换原有 useCallback，删除被抽离的代码

- [x] Task 4: P1-14 useGraphEditorState 返回值 useMemo 包裹
  - [x] SubTask 4.1: 在 `src/hooks/graphEditor/index.ts` 中导入 `useMemo`，用 `useMemo(() => ({ graphRef, ...selection, ...sidebar, ...exploration, ...focus, ...modal, ...form, ...view, ...presentation, ...narrative, ...misc }), [graphRef, selection, sidebar, exploration, focus, modal, form, view, presentation, narrative, misc])` 包裹返回对象

- [x] Task 5: P1-15 在 queryKeys 中新增 aiPerformance 相关 key
  - [x] SubTask 5.1: 在 `src/hooks/queries/config.ts` 的 `queryKeys` 对象中新增 `aiPerformanceLogs: (query?: { limit?: number; offset?: number; operation?: string; provider?: string; success?: boolean; startTime?: number; endTime?: number }) => ["aiPerformanceLogs", query] as const`
  - [x] SubTask 5.2: 同样新增 `aiPerformanceStats: (query?: { startTime?: number; endTime?: number }) => ["aiPerformanceStats", query] as const`

- [x] Task 6: P1-15 创建 useAiPerformanceQueries hooks
  - [x] SubTask 6.1: 创建 `src/hooks/queries/useAiPerformanceQueries.ts`，导入 `useQuery`、`useMutation`、`useQueryClient`、`request`、`queryKeys`、`defaultQueryConfig`、类型定义
  - [x] SubTask 6.2: 实现 `useAiPerformanceLogs(query)` —— `useQuery({ queryKey: queryKeys.aiPerformanceLogs(query), queryFn: () => request<{ logs: AIPerformanceLog[] }>(url), ...defaultQueryConfig, enabled: ... })`，URL 构建逻辑参考原 store 的 fetchLogs
  - [x] SubTask 6.3: 实现 `useAiPerformanceStats(query)` —— 同上，URL 为 `/ai/performance/stats`
  - [x] SubTask 6.4: 实现 `useClearAiPerformanceLogs()` —— `useMutation` 包装 DELETE 请求，`onSuccess` 中 `queryClient.invalidateQueries({ queryKey: ["aiPerformanceLogs"] })` 与 `queryClient.invalidateQueries({ queryKey: ["aiPerformanceStats"] })`
  - [x] SubTask 6.5: 在 `src/hooks/queries/index.ts` 中导出 `useAiPerformanceLogs`、`useAiPerformanceStats`、`useClearAiPerformanceLogs`

- [x] Task 7: P1-15 重写 PerformanceTab.tsx 使用 query hooks
  - [x] SubTask 7.1: 在 `PerformanceTab.tsx` 中移除 `useAIPerformanceStore` 导入，改为 `import { useAiPerformanceLogs, useAiPerformanceStats, useClearAiPerformanceLogs } from "@/hooks/queries"`
  - [x] SubTask 7.2: 用 `useAiPerformanceLogs(query)` 替代 `logs` 与 `isLoading`，从 `data?.logs` 取 logs，从 `isPending` / `isLoading` 取加载状态，从 `error` 取错误
  - [x] SubTask 7.3: 用 `useAiPerformanceStats({ startTime })` 替代 `stats`，`stats` 来自 `data`
  - [x] SubTask 7.4: 用 `useClearAiPerformanceLogs()` 替代 `clearLogs`，`mutate()` 触发删除
  - [x] SubTask 7.5: 将 `loadData` 改为通过 `queryClient.invalidateQueries({ queryKey: ["aiPerformanceLogs"] })` 与 `queryClient.invalidateQueries({ queryKey: ["aiPerformanceStats"] })` 触发刷新；或在依赖变化时通过 queryKey 变化让 TanStack Query 自动重新拉取

- [x] Task 8: P1-15 简化或删除 useAIPerformanceStore
  - [x] SubTask 8.1: 检查 `src/store/useAIPerformanceStore.ts` 是否还有其他消费者（Grep 结果显示仅 PerformanceTab.tsx 使用）
  - [x] SubTask 8.2: 由于仅 PerformanceTab.tsx 使用，直接删除 `src/store/useAIPerformanceStore.ts` 文件
  - [x] SubTask 8.3: 确认无其他文件引用 `useAIPerformanceStore`，Grep 验证

- [x] Task 9: P1-16 useConsoleStore 持久化收窄
  - [x] SubTask 9.1: 在 `src/store/useConsoleStore.ts` 中将 `MAX_HISTORY_ITEMS` 从 `100` 改为 `50`
  - [x] SubTask 9.2: 在 `partialize` 中移除 `output: state.output` 一行，仅保留 `isOpen`、`isMinimized`、`history` 三个字段
  - [x] SubTask 9.3: 验证 `MAX_OUTPUT_ITEMS` 与 `output` 数组运行时行为保持不变（不删除 `output` 字段本身，仅不持久化）

# Task Dependencies

- Task 1, 2, 3 可并行（互不依赖，均从 GraphEditor.tsx 抽出独立逻辑）
- Task 4 独立（修改 useGraphEditorState 的返回值包裹方式）
- Task 5 必须在 Task 6 之前完成（Task 6 依赖 Task 5 新增的 queryKeys）
- Task 6 必须在 Task 7 之前完成（Task 7 使用 Task 6 创建的 hooks）
- Task 7 必须在 Task 8 之前完成（Task 8 删除 store 前，所有消费者必须已迁移）
- Task 9 独立（修改 useConsoleStore，与其他任务无依赖）
- 推荐并行批次：[Task 1, 2, 3, 4, 5, 9] → [Task 6] → [Task 7] → [Task 8]
