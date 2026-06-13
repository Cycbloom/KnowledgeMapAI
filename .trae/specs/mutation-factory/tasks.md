# Tasks

- [x] Task 1: 创建 `mutationFactory.ts` 核心工厂函数文件
  - [x] 实现 `createSimpleMutation(mutationFn)` — 纯 mutation 包装
  - [x] 实现 `createInvalidationMutation(mutationFn, queryKeys)` — 成功后自动失效缓存
  - [x] 实现 `createEventPublishMutation(mutationFn, eventConfig)` — 成功后自动发布事件
  - [x] 实现 `createOptimisticMutation(config)` — 完整的乐观更新（onMutate 乐观修改 + onError 回滚 + onSettled 失效/事件）
  - [x] 导出所有工厂函数和类型定义

- [x] Task 2: 重构 `useGraphMutations.ts` 使用工厂函数
  - [x] 将 `useCreateNodeMutation`、`useUpdateNodeOptimisticMutation`、`useDeleteNodeMutation`、`useBatchDeleteNodesMutation`、`useCreateEdgeMutation`、`useToggleFavoriteMutation` 替换为 `createOptimisticMutation`
  - [x] 将 `useCreateGraphMutation`、`useDeleteGraphMutation`、`useRestoreGraphMutation`、`usePermanentDeleteGraphMutation`、`useImportGraphMutation`、`useCreateGraphFromTemplateMutation`、`useBatchRestoreGraphsMutation`、`useBatchPermanentDeleteGraphsMutation`、`useBatchDeleteGraphsMutation` 替换为 `createEventPublishMutation`
  - [x] 将 `useAIGenerateMutation`、`useAIExpandMutation`、`useAIGenerateCardsMutation`、`useDocumentToGraphMutation`、`useImageToGraphMutation`、`useRecommendConnectionsMutation`、`useExportGraphMutation` 替换为 `createSimpleMutation`
  - [x] 验证所有原有功能不变，类型检查通过

- [x] Task 3: 重构 `useStudyMutations.ts` 使用工厂函数
  - [x] 将全部 5 个 mutation 替换为 `createInvalidationMutation`
  - [x] 验证类型检查通过

- [x] Task 4: 重构 `useTaskMutations.ts` 使用工厂函数
  - [x] 将 `useRetryTaskMutation`、`useDeleteTaskMutation` 替换为 `createInvalidationMutation`
  - [x] `useCreateTaskMutation` 替换为 `createSimpleMutation`
  - [x] 验证类型检查通过

- [x] Task 5: 重构 `useTemplateMutations.ts` 使用工厂函数
  - [x] 将 `useCreateTemplateMutation`、`useDeleteTemplateMutation` 替换为 `createInvalidationMutation`
  - [x] 将 `useUpdateTemplateMutation` 替换为 `createInvalidationMutation`（支持多 queryKey 失效）
  - [x] 验证类型检查通过

- [x] Task 6: 重构 `useLearningPathMutations.ts` 使用工厂函数
  - [x] 将所有 `onSuccess` 仅做 invalidateQueries 的 mutation 替换为 `createInvalidationMutation`
  - [x] 验证类型检查通过

- [x] Task 7: 运行类型检查和 lint
  - [x] 运行 `npm run check` 确保无类型错误（exit 0）
  - [x] 运行 `npm run lint` 确保无新增 lint 错误（仅 1 个预先存在的 ActiveTaskPanel.tsx 错误）

# Task Dependencies

- Task 2-6 全部依赖 Task 1
- Task 2-6 之间无依赖，可并行执行
- Task 7 依赖 Task 2-6 全部完成