# 修复预存 TypeScript 类型错误 Spec

## Why
API 契约层引入后，类型系统变得更严格，暴露了 49 个预先存在的 TypeScript 类型错误。这些错误之前被 `any` 类型或宽松的类型推断所掩盖。修复它们可以提升代码的类型安全性。

## What Changes
- 修复所有 49 个预存 TypeScript 类型错误，分布在 19 个文件中
- 不改变运行时行为，仅添加缺失的类型注解、修正类型断言
- 按错误类别分 5 组：API 返回类型不匹配、隐式 any、属性缺失、类型断言、属性不匹配

## Impact
- Affected specs: 无（预存问题修复）
- Affected code: 19 个文件（components/hooks/pages/services）

---

## 错误分类

### 第 1 组：API 返回类型不匹配（GenericApiModule 导致 {}）
涉及 `GenericApiModule`（`Record<string, any>`）返回 `any` 导致消费者推断为 `{}`：
- `HeaderGreeting.tsx(25)`: `metrics` 属性不存在于 `{}`
- `useGraphAIOperations.ts(374)`: `{}` 不匹配 `RelatedNode[]`
- `useExplorationPath.ts(41)`: `map` 不存在于 `{}`
- `LearningStatsCenter.tsx(308-392)`: `distribution/metrics/heatmap/forecast/growth` 不存在于 `{}`
- `Statistics.tsx(211-309)`: 同上
- `QuizGenerationModal.tsx(299,312)`: `stages` 不存在于 `unknown[]`

### 第 2 组：隐式 any 类型
- `RAGChat/index.tsx(283,289)`: 回调参数 `chunk`、`s` 缺少类型注解
- `GraphMap.tsx(749,768,817)`: 回调参数 `n` 缺少类型注解

### 第 3 组：属性缺失
- `Dashboard.tsx(199)`: `tags` 不存在于 `Graph`
- `Dashboard.tsx(414)`: `unknown` 不能渲染
- `Dashboard.tsx(1844)`: `tags` 不存在于 `string[]`
- `GraphMap.tsx(1861)`: `domains` 不存在于 `{ name: string; count: number }[]`
- `RecycleBin.tsx(415)`: `deleted_at` 不存在于 `Graph`

### 第 4 组：类型断言错误
- `console/commands/ai.ts(152)`: 缺少 `unknown` 中间断言
- `console/commands/graph.ts(123)`: 缺少 `unknown` 中间断言
- `RelatedGraphsPanel.tsx(54)`: GraphRelation 类型不匹配
- `LearningPathWizard.tsx(164-167)`: `created` 属性不存在于返回值

### 第 5 组：属性类型不匹配
- `GraphEditor.tsx(618)`: `createTaskMutation` 变量类型不匹配 GraphAIMutations
- `GraphEditor.tsx(1240)`: `unknown` 不匹配 `TemplateLayout`
- `GraphEditor.tsx(1796)`: `Record<string, NodeStatus> | undefined` 不匹配 `NodeStatus`

---

## ADDED Requirements

### Requirement: 修复 API 返回类型不匹配
系统 SHALL 对 `GenericApiModule` 模块的 API 调用添加显式类型断言，使消费者能正确推断返回类型。

#### Scenario: 统计页面正常类型检查
- **WHEN** 调用 `api.statistics.getMetrics()` 等 GenericApiModule 方法
- **THEN** 返回值应有正确的类型推断，不再报 `{}` 类型错误

### Requirement: 修复隐式 any 类型
系统 SHALL 为所有回调参数添加显式类型注解，消除 implicit any 警告。

#### Scenario: 回调参数有类型
- **WHEN** 使用 `.map()` 等高阶函数
- **THEN** 回调参数应有明确的类型注解

### Requirement: 修复属性缺失错误
系统 SHALL 确保消费代码访问的属性存在于对应类型定义中，通过类型断言或类型修正解决。

#### Scenario: Graph 类型属性可访问
- **WHEN** 访问 `Graph` 对象的 `tags` 属性
- **THEN** Graph 类型应包含该属性，或使用类型断言

### Requirement: 修复类型断言错误
系统 SHALL 对不兼容的类型转换使用 `unknown` 作为中间类型。

#### Scenario: 类型断言通过检查
- **WHEN** 执行跨类型的类型断言
- **THEN** 应通过 `as unknown as TargetType` 方式