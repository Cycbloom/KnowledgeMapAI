# Checklist

## 第 1 组：API 返回类型不匹配
- [x] HeaderGreeting.tsx - 不再报 `metrics` 不存在于 `{}`
- [x] useGraphAIOperations.ts - 不再报 `{}` 不匹配 `RelatedNode[]`
- [x] useExplorationPath.ts - 不再报 `map` 不存在于 `{}`
- [x] LearningStatsCenter.tsx - 不再报 distribution/metrics/heatmap/forecast/growth 不存在于 `{}`
- [x] Statistics.tsx - 同上
- [x] QuizGenerationModal.tsx - 不再报 `stages` 不存在于 `unknown[]`

## 第 2 组：隐式 any 类型
- [x] RAGChat/index.tsx - `chunk`/`s` 参数有类型注解
- [x] GraphMap.tsx - `n` 参数有类型注解

## 第 3 组：属性缺失
- [x] Dashboard.tsx - `tags` 可访问、`unknown` 可渲染
- [x] GraphMap.tsx - `domains` 可访问
- [x] RecycleBin.tsx - `deleted_at` 可访问

## 第 4 组：类型断言错误
- [x] console/commands/ai.ts - 断言通过 `unknown` 中间类型
- [x] console/commands/graph.ts - 断言通过 `unknown` 中间类型
- [x] RelatedGraphsPanel.tsx - GraphRelation 类型断言通过
- [x] LearningPathWizard.tsx - `created` 属性可访问

## 第 5 组：属性类型不匹配
- [x] GraphEditor.tsx - createTaskMutation 类型匹配 GraphAIMutations
- [x] GraphEditor.tsx - TemplateLayout 类型匹配
- [x] GraphEditor.tsx - NodeStatus 类型匹配

## 最终验证
- [x] `npm run check` 零错误退出