# 学习路径服务层拆分 Spec

## Why
`learningPathService.ts` 有 3401 行、9 个独立职责，严重违反单一职责原则。其中纯函数算法层（~570行）和任务系统集成层（~717行）与核心 CRUD 层耦合在一起，导致维护困难、测试困难、单方法过长（`autoSchedulePath` 377行、`updateNodeStatus` 265行）。

## What Changes
- 将模块级纯函数算法（topologicalSort、buildProgressMap、buildDependencyMaps 等 10 个函数）提取到 `learningPathAlgorithms.ts`
- 将任务系统集成方法（autoSchedulePath、createLearningPathMainTask、convertNodeToSubtask 等）提取到 `learningPathTaskIntegration.ts`
- 将每日计划方法（generateDailyPlans、createDailyPlan 等）提取到 `learningPathDailyPlan.ts`
- `learningPathService.ts` 保留核心 CRUD + 节点管理 + 进度追踪 + 编排入口，通过组合调用拆分出的模块
- **不拆分** ragService.ts（RAG 流水线天然内聚，拆分破坏内聚性）
- **不拆分** MindMapCanvas.tsx（已有 hooks 拆分，SVG 渲染不适合组件级拆分）

## Impact
- Affected specs: 无
- Affected code:
  - `api/services/study/learningPathService.ts` — 主要重构对象
  - `api/services/study/index.ts` — 需要重新导出新模块
  - `api/routes/learningPaths.ts` — 可能需要调整导入路径

## ADDED Requirements

### Requirement: 学习路径算法独立模块
系统 SHALL 将学习路径的纯函数算法提取为独立模块 `learningPathAlgorithms.ts`，包含以下函数：
- topologicalSort, buildProgressMap, buildDependencyMaps
- calculateEstimatedTime, generateSuggestions, findPath
- generateRulePath, generateAIPath, buildTodayPlan, calculateWeeklyProgress

#### Scenario: 算法函数独立可测试
- **WHEN** 开发者需要测试拓扑排序或进度计算逻辑
- **THEN** 可以直接导入 `learningPathAlgorithms` 中的函数进行单元测试，无需实例化整个 LearningPathService

### Requirement: 任务系统集成独立模块
系统 SHALL 将学习路径与任务调度系统的集成逻辑提取为独立模块 `learningPathTaskIntegration.ts`，包含以下方法：
- autoSchedulePath, createLearningPathMainTask
- convertNodeToSubtask, convertNodeToTask
- syncProgressWithTask

#### Scenario: 任务集成独立维护
- **WHEN** 需要修改学习路径与任务系统的集成逻辑
- **THEN** 只需修改 `learningPathTaskIntegration.ts`，不影响核心路径 CRUD 逻辑

### Requirement: 每日计划独立模块
系统 SHALL 将每日计划相关逻辑提取为独立模块 `learningPathDailyPlan.ts`，包含以下方法：
- generateDailyPlans, createDailyPlan, getDailyPlan, getDailyPlans, updatePlanStatus

#### Scenario: 每日计划独立维护
- **WHEN** 需要修改每日计划的生成或管理逻辑
- **THEN** 只需修改 `learningPathDailyPlan.ts`，不影响核心路径逻辑

### Requirement: 原服务保持向后兼容
系统 SHALL 确保 `learningPathService.ts` 通过组合调用拆分出的模块，保持所有公开 API 不变。

#### Scenario: 调用方无感知
- **WHEN** 路由层或其他服务调用 `learningPathService` 的方法
- **THEN** 行为与拆分前完全一致，无需修改调用方代码

## MODIFIED Requirements
无

## REMOVED Requirements
无
