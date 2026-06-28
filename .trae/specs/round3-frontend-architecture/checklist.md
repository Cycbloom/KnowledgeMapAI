# Checklist

## P1-13 GraphEditor.tsx 拆分

- [x] `src/pages/GraphEditor/hooks/useLearningPathHandlers.ts` 存在并导出 `useLearningPathHandlers`
- [x] `src/pages/GraphEditor/hooks/useRegionHandlers.ts` 存在并导出 `useRegionHandlers`
- [x] `src/pages/GraphEditor/hooks/useConceptExtractionHandlers.ts` 存在并导出 `useConceptExtractionHandlers`
- [x] `GraphEditor.tsx` 不再包含被抽离的 `useState`（`selectedLearningPathId`、`learningPathNodeIds`、`learningPathOrderMap`、`customRegions`、`originPosition`、`collapsedRegions`）
- [x] `GraphEditor.tsx` 不再包含被抽离的 `useCallback`（`handleSelectLearningPath`、`handleStartNarrative`、`handleExitNarrative`、`handleLearningPathNodeClick`、`handleCreateRegion`、`handleRegionToggle`、`handleOriginMove`、`handleLiteratureExtractComplete`、`handleConfirmConcepts`）
- [x] `GraphEditor.tsx` 通过解构三个新 hook 获取上述状态与回调
- [x] `GraphEditor.tsx` 行数明显减少（从 1620+ 行减少至约 1450 行，减少约 170 行）

## P1-14 useGraphEditorState 引用稳定

- [x] `src/hooks/graphEditor/index.ts` 中 `useGraphEditorState` 的返回对象被 `useMemo` 包裹
- [x] `useMemo` 依赖数组包含 `graphRef` 与 10 个子 hook 返回值
- [x] TypeScript 类型 `GraphEditorState` 保持不变（不破坏消费者解构）

## P1-15 useAIPerformanceStore 迁移

- [x] `src/hooks/queries/config.ts` 的 `queryKeys` 包含 `aiPerformanceLogs` 与 `aiPerformanceStats` 两个工厂函数
- [x] `src/hooks/queries/useAiPerformanceQueries.ts` 存在并导出 `useAiPerformanceLogs`、`useAiPerformanceStats`、`useClearAiPerformanceLogs`
- [x] `useAiPerformanceLogs` 使用 `queryKeys.aiPerformanceLogs(query)` 作为 queryKey
- [x] `useAiPerformanceStats` 使用 `queryKeys.aiPerformanceStats(query)` 作为 queryKey
- [x] `useClearAiPerformanceLogs` 的 `onSuccess` 失效 `aiPerformanceLogs` 与 `aiPerformanceStats` 两个 queryKey
- [x] `src/hooks/queries/index.ts` 重新导出三个新 hook
- [x] `PerformanceTab.tsx` 不再导入 `useAIPerformanceStore`
- [x] `PerformanceTab.tsx` 通过 `useAiPerformanceLogs` / `useAiPerformanceStats` / `useClearAiPerformanceLogs` 获取数据
- [x] `PerformanceTab.tsx` 的刷新按钮通过 `queryClient.invalidateQueries` 触发
- [x] `src/store/useAIPerformanceStore.ts` 已被删除
- [x] Grep `useAIPerformanceStore` 在 `src/` 下无匹配结果

## P1-16 useConsoleStore 持久化收窄

- [x] `src/store/useConsoleStore.ts` 中 `MAX_HISTORY_ITEMS = 50`
- [x] `partialize` 返回对象不包含 `output` 字段
- [x] `partialize` 返回对象包含 `isOpen`、`isMinimized`、`history`
- [x] `output`、`MAX_OUTPUT_ITEMS`、`addOutput`、`clearOutput`、`setOutput` 仍在 store 中（运行时行为不变）

## 类型与代码规范

- [x] `npm run check` 通过（无新增 TypeScript 错误）
- [x] `npm run lint` 通过（无新增 ESLint 错误）
- [x] 无新增 `any` 类型
- [x] 无新增非空断言（`!`）
- [x] 前端无新增 `console.log` / `console.info`（`console.error` / `console.warn` 允许）

## 附注：附带修复的预存 lint 错误

- [x] `src/pages/GraphEditor.tsx` 中 `embeddingsMap` useMemo 的 `[embeddingData?.nodes]` 依赖数组与 React Compiler 推断的 `embeddingData.nodes` 不匹配（`react-hooks/preserve-manual-memoization`）—— 此为预存问题，因 ESLint 缓存失效被暴露；通过提取 `embeddingNodes` 局部变量使依赖数组与函数体访问形式一致，消除该错误。
