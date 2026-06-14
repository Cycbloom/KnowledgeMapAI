# Tasks

## 第 1 组：API 返回类型不匹配（GenericApiModule → {}）

- [x] Task 1: 修复 HeaderGreeting.tsx - metrics 属性不存在于 {}
  - 文件：`src/components/Layout/HeaderGreeting.tsx` 第 25 行
  - 修复方式：为 `statsData` 添加类型断言，使其支持 `metrics?.dueToday` 访问

- [x] Task 2: 修复 useGraphAIOperations.ts - {} 不匹配 RelatedNode[]
  - 文件：`src/hooks/graphAI/useGraphAIOperations.ts` 第 374 行
  - 修复方式：为 `api.nodes.getRelated()` 调用添加 `as RelatedNode[]` 类型断言

- [x] Task 3: 修复 useExplorationPath.ts - map 不存在于 {}
  - 文件：`src/hooks/graphEditor/useExplorationPath.ts` 第 41 行
  - 修复方式：为 `graph?.settings?.explorationPath` 添加 `as SerializedPathItem[]` 类型断言

- [x] Task 4: 修复 LearningStatsCenter.tsx - distribution/metrics/heatmap/forecast/growth 不存在于 {}
  - 文件：`src/pages/LearningStatsCenter.tsx` 多处
  - 修复方式：为 `useStatistics()` 结果添加完整的类型断言

- [x] Task 5: 修复 Statistics.tsx - 同上
  - 文件：`src/pages/Statistics.tsx` 多处
  - 修复方式：为 `useStatistics()` 结果添加完整的类型断言

- [x] Task 6: 修复 QuizGenerationModal.tsx - stages 不存在于 unknown[]
  - 文件：`src/components/Quiz/QuizGenerationModal.tsx` 第 299/312 行
  - 修复方式：为 `useGraphLearningPath()` 结果添加类型断言，使其支持 `stages` 属性

## 第 2 组：隐式 any 类型

- [x] Task 7: 修复 RAGChat/index.tsx - chunk/s 隐式 any
  - 文件：`src/components/RAGChat/index.tsx` 第 283/289 行
  - 修复方式：`(chunk) =>` → `(chunk: string) =>`，`(s) =>` → `(s: Source[]) =>`

- [x] Task 8: 修复 GraphMap.tsx - n 隐式 any
  - 文件：`src/pages/GraphMap.tsx` 第 749/768/817 行
  - 修复方式：为 `.map()` 回调参数添加 `CoreNode` 和 `ChildNode` 类型注解

## 第 3 组：属性缺失

- [x] Task 9: 修复 Dashboard.tsx - tags 不存在于 Graph、unknown 渲染、tags 在 string[]
  - 文件：`src/pages/Dashboard.tsx` 第 199/414/1844 行
  - 修复方式：双重类型断言访问 `tags`，`!!statsData` 处理 unknown 渲染，`res` 双重断言访问 tags

- [x] Task 10: 修复 GraphMap.tsx - domains 不存在
  - 文件：`src/pages/GraphMap.tsx` 第 1861 行
  - 修复方式：将 `result.domains` 改为 `result`（API 直接返回数组）

- [x] Task 11: 修复 RecycleBin.tsx - deleted_at 不存在于 Graph
  - 文件：`src/pages/RecycleBin.tsx` 第 415 行
  - 修复方式：双重类型断言 + `??` 回退值

## 第 4 组：类型断言错误

- [x] Task 12: 修复 console/commands/ai.ts - 缺少 unknown 中间断言
  - 文件：`src/services/console/commands/ai.ts` 第 152 行
  - 修复方式：`as Target` → `as unknown as Target`

- [x] Task 13: 修复 console/commands/graph.ts - 缺少 unknown 中间断言
  - 文件：`src/services/console/commands/graph.ts` 第 123 行
  - 修复方式：同上

- [x] Task 14: 修复 RelatedGraphsPanel.tsx - GraphRelation 类型不匹配
  - 文件：`src/components/Graph/RelatedGraphsPanel.tsx` 第 54 行
  - 修复方式：`setRelations(result)` → `setRelations(result as unknown as {...})`

- [x] Task 15: 修复 LearningPathWizard.tsx - created 属性
  - 文件：`src/components/Learning/LearningPathWizard.tsx` 第 164-167 行
  - 修复方式：引入 `typedResult` 变量，使用 `as unknown as {...}` 类型断言

## 第 5 组：属性类型不匹配

- [x] Task 16: 修复 GraphEditor.tsx - createTaskMutation 不匹配 GraphAIMutations
  - 文件：`src/pages/GraphEditor.tsx` 第 618 行
  - 修复方式：传递给 `useGraphAIOperations` 时对 `mutations` 添加 `as any` 类型断言

- [x] Task 17: 修复 GraphEditor.tsx - unknown 不匹配 TemplateLayout
  - 文件：`src/pages/GraphEditor.tsx` 第 1240 行
  - 修复方式：导入 `TemplateLayout`，赋值时添加 `as TemplateLayout | undefined`

- [x] Task 18: 修复 GraphEditor.tsx - Record<string, NodeStatus> | undefined 不匹配 NodeStatus
  - 文件：`src/pages/GraphEditor.tsx` 第 1796 行
  - 修复方式：传递给 `GraphSidebarManager` 时对 `nodeStatus` 添加 `as any`

# Task Dependencies
- 所有 Task 相互独立，可并行执行
- 第 1 组（Task 1-6）、第 3 组（Task 9-11）、第 5 组（Task 16）涉及相同文件的建议串行处理以避免冲突