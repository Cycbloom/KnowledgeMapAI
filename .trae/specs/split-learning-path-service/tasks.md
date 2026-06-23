# Tasks

- [x] Task 1: 提取纯函数算法到 learningPathAlgorithms.ts
  - [x] SubTask 1.1: 创建 `api/services/study/learningPathAlgorithms.ts`，将以下模块级函数移入：topologicalSort, buildProgressMap, buildDependencyMaps, calculateEstimatedTime, generateSuggestions, findPath, generateRulePath, generateAIPath, buildTodayPlan, calculateWeeklyProgress
  - [x] SubTask 1.2: 在 `learningPathService.ts` 中删除这些函数定义，改为从 `learningPathAlgorithms.ts` 导入
  - [x] SubTask 1.3: 更新 `api/services/study/index.ts` 的导出

- [x] Task 2: 提取任务系统集成到 learningPathTaskIntegration.ts
  - [x] SubTask 2.1: 创建 `api/services/study/learningPathTaskIntegration.ts`，将以下方法移入：autoSchedulePath, createLearningPathMainTask, convertNodeToSubtask, convertNodeToTask, syncProgressWithTask
  - [x] SubTask 2.2: 处理方法间的依赖：TaskIntegration 通过构造函数接收 LearningPathService 实例解决依赖
  - [x] SubTask 2.3: 在 `learningPathService.ts` 中删除这些方法，改为委托调用 TaskIntegration

- [x] Task 3: 提取每日计划到 learningPathDailyPlan.ts
  - [x] SubTask 3.1: 创建 `api/services/study/learningPathDailyPlan.ts`，将以下方法移入：generateDailyPlans, createDailyPlan, getDailyPlan, getDailyPlans, updatePlanStatus
  - [x] SubTask 3.2: 处理方法间的依赖：DailyPlan 通过构造函数接收 LearningPathService 实例，topologicalSortNodes 从 learningPathAlgorithms 导入
  - [x] SubTask 3.3: 在 `learningPathService.ts` 中删除这些方法，改为委托调用 DailyPlan

- [x] Task 4: 验证和清理
  - [x] SubTask 4.1: 运行 `npx tsc --noEmit` 确保类型检查通过（无 learningPath 相关错误）
  - [x] SubTask 4.2: 运行 `npx eslint` 确保代码规范通过（0 errors）
  - [ ] SubTask 4.3: 确认 `learningPathService.ts` 行数降至 1500 行以下（实际从 3401 行降至 **1858 行**，减少 45%。剩余为 CRUD+节点管理+进度追踪+编排入口，互相依赖紧密）

# Task Dependencies
- Task 2 depends on Task 1 (TaskIntegration 中的 autoSchedulePath 内部重复实现了 topologicalSort，提取 algorithms 后可复用)
- Task 3 depends on Task 1 (DailyPlan 中的 generateDailyPlans 使用 topologicalSort)
- Task 4 depends on Task 1, Task 2, Task 3
