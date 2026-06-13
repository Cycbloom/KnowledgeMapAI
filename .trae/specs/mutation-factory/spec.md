# 乐观更新工厂模式 Spec

## Why

7 个 mutation 文件中存在大量重复的 `useMutation` 回调模式（乐观更新 onMutate/onError/onSettled、缓存失效 invalidateQueries、事件发布 frontendEventBus），累计约 40+ 处重复。提取为通用工厂函数可减少 50%+ 样板代码，降低不一致风险，统一错误回滚行为。

## What Changes

- 新增 `src/hooks/mutations/mutationFactory.ts`，提供 4 个工厂函数
- 重构 `src/hooks/mutations/useGraphMutations.ts`，用工厂函数替换乐观更新 pattern
- 重构 `src/hooks/mutations/useStudyMutations.ts`，用工厂函数替换缓存失效 pattern
- 重构 `src/hooks/mutations/useTaskMutations.ts`，用工厂函数替换缓存失效 pattern
- 重构 `src/hooks/mutations/useTemplateMutations.ts`，用工厂函数替换缓存失效 pattern
- 重构 `src/hooks/mutations/useLearningPathMutations.ts`，用工厂函数替换缓存失效 pattern
- 对 `useGraphMutations.ts` 中的简单 eventBus mutation 使用工厂函数

## Impact

- Affected specs: 无（纯重构，行为不变）
- Affected code: `src/hooks/mutations/` 下所有文件 + 新增 `mutationFactory.ts`

## ADDED Requirements

### Requirement: createSimpleMutation 工厂函数

系统 SHALL 提供 `createSimpleMutation(mutationFn)` 工厂函数，用于创建没有 onSuccess/onError 回调的纯 mutation。

#### Scenario: 创建简单 mutation

- **WHEN** 调用 `createSimpleMutation(api.tasks.create)`
- **THEN** 返回一个 `useMutation` hook，行为与直接写 `useMutation({ mutationFn: api.tasks.create })` 完全一致

### Requirement: createInvalidationMutation 工厂函数

系统 SHALL 提供 `createInvalidationMutation(mutationFn, queryKeys)` 工厂函数，用于创建成功后自动失效缓存的 mutation。

#### Scenario: 创建带缓存失效的 mutation

- **WHEN** 调用 `createInvalidationMutation(api.study.delete, [["studyCards"]])`
- **THEN** 返回一个 `useMutation` hook，onSuccess 时自动调用 `queryClient.invalidateQueries` 失效指定缓存

#### Scenario: 失效多个缓存 key

- **WHEN** 调用 `createInvalidationMutation(api.templates.update, [["templates"], queryKeys.template(variables.id)])`，其中 queryKeys 支持函数形式
- **THEN** 返回的 mutation 在 onSuccess 时失效所有指定缓存

### Requirement: createEventPublishMutation 工厂函数

系统 SHALL 提供 `createEventPublishMutation(mutationFn, eventConfig)` 工厂函数，用于创建成功后自动发布事件的 mutation。

#### Scenario: 创建带事件发布的 mutation

- **WHEN** 调用 `createEventPublishMutation(api.graphs.delete, { event: "graph_list_changed", getPayload: () => ({ changeType: "graph_deleted" }) })`
- **THEN** 返回一个 `useMutation` hook，onSuccess 时自动调用 `frontendEventBus.publish`

### Requirement: createOptimisticMutation 工厂函数

系统 SHALL 提供 `createOptimisticMutation(config)` 工厂函数，用于创建带乐观更新的 mutation。config 包含：mutationFn、queryKey、optimisticUpdater（乐观更新函数）、可选的 onSettled 回调。

#### Scenario: 创建乐观更新 mutation（列表项修改）

- **WHEN** 调用 `createOptimisticMutation({ mutationFn, queryKey, optimisticUpdater: (old, vars) => old.map(item => item.id === vars.id ? { ...item, ...vars.data } : item) })`
- **THEN** 返回的 mutation 在 onMutate 时执行乐观更新，onError 时自动回滚，onSettled 时失效缓存

#### Scenario: 创建乐观更新 mutation（列表项添加）

- **WHEN** 调用 `createOptimisticMutation({ mutationFn, queryKey, optimisticUpdater: (old, vars) => [...old, tempItem], onSettled: () => publishEvent })`
- **THEN** 返回的 mutation 正确执行添加、回滚、事件发布流程

#### Scenario: 创建乐观更新 mutation（列表项删除）

- **WHEN** 调用 `createOptimisticMutation({ mutationFn, queryKey, optimisticUpdater: (old, vars) => old.filter(item => !vars.ids.includes(item.id)) })`
- **THEN** 返回的 mutation 正确执行删除、回滚、失效流程

#### Scenario: 乐观更新失败回滚

- **WHEN** optimistic mutation 的 mutationFn 抛出错误
- **THEN** onError 自动将缓存回滚到 onMutate 之前的状态（previousData）

## MODIFIED Requirements

无。此为纯新增工厂函数，所有现有 mutation 行为保持不变。

## REMOVED Requirements

无。