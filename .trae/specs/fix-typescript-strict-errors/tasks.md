# Tasks

- [ ] Task 1: 修复 Scheduler 组件的类型错误
  - [ ] SubTask 1.1: 修复 DependencyGraph.tsx 未使用变量
  - [ ] SubTask 1.2: 修复 PomodoroSettings.tsx 未使用变量
  - [ ] SubTask 1.3: 修复 TemplateForm.tsx 未使用变量
  - [ ] SubTask 1.4: 修复 WeeklyReflection.tsx 未使用导入和 SchedulerStats 导入错误

- [ ] Task 2: 修复 hooks 文件的类型错误
  - [ ] SubTask 2.1: 修复 useCombinedGraphAIOperations.ts 类型不匹配
  - [ ] SubTask 2.2: 修复 useGlobalShortcuts.ts 未使用变量
  - [ ] SubTask 2.3: 修复 useGraphHistoryHandlers.ts 未使用变量
  - [ ] SubTask 2.4: 修复 useGraphNodeOperations.ts 隐式 any 类型
  - [ ] SubTask 2.5: 修复 useQueries.ts 多个类型错误
  - [ ] SubTask 2.6: 修复 useTextToSpeech.ts 未使用变量
  - [ ] SubTask 2.7: 修复 useTutorOperations.ts 未使用变量

- [ ] Task 3: 修复 pages 文件的类型错误
  - [ ] SubTask 3.1: 修复 GraphMap.tsx 未使用变量和隐式 any 类型
  - [ ] SubTask 3.2: 修复 SchedulerStats.tsx 类型不匹配和隐式 any 类型
  - [ ] SubTask 3.3: 修复 Tasks.tsx 未使用导入和类型错误

- [ ] Task 4: 修复工具文件的类型错误
  - [ ] SubTask 4.1: 修复 forceLayout3D.ts 未使用变量
  - [ ] SubTask 4.2: 修复 graphMapAdapter.ts 类型不匹配
  - [ ] SubTask 4.3: 修复 queryOptimizer.ts 未使用类型

- [ ] Task 5: 验证所有类型错误已修复
  - [ ] SubTask 5.1: 运行 npx tsc --noEmit 确认无错误

# Task Dependencies
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
