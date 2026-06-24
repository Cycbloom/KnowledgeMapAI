# Tasks

- [x] Task 1: 重命名 tasks.ts 中 14 个导出函数
  - [x] SubTask 1.1: `createTask` → `create`, `getTasks` → `list`, `getTask` → `get`, `getTaskDetail` → `getDetail`, `updateTask` → `update`, `deleteTask` 保留（`delete` 是保留关键字）
  - [x] SubTask 1.2: `startTask` → `start`, `pauseTask` → `pause`, `completeTask` → `complete`, `demoteTask` → `demote`, `moveTask` → `move`
  - [x] SubTask 1.3: `reorderTasks` → `reorder`, `generateTaskDetails` → `generateDetails`, `checkTaskDependencies` → `checkDependencies`

- [x] Task 2: 重命名 dependencies.ts 中 3 个导出函数并调整签名
  - [x] SubTask 2.1: `getDependencies` → `getTaskDependencies`（签名不变）
  - [x] SubTask 2.2: `createDependency` → `addTaskDependency`，签名改为 `(taskId, data)`
  - [x] SubTask 2.3: `deleteDependency` → `removeTaskDependency`，签名改为 `(_taskId, dependencyId)`

- [x] Task 3: 调整 subtasks.ts 中 3 个函数的参数签名
  - [x] SubTask 3.1: `createSubtask` 签名改为 `(taskId, data)`
  - [x] SubTask 3.2: `updateSubtask` 签名改为 `(_taskId, subtaskId, data)`
  - [x] SubTask 3.3: `deleteSubtask` 签名改为 `(_taskId, subtaskId)`

- [x] Task 4: 调整 analytics.ts 中 3 个函数的参数签名
  - [x] SubTask 4.1: `createSchedule` 签名改为内联类型
  - [x] SubTask 4.2: `createProgressPlan` 签名改为使用 `ProgressMode` 类型
  - [x] SubTask 4.3: `createTimeSlot` 签名改为内联类型

- [x] Task 5: 简化 index.ts，移除适配层
  - [x] SubTask 5.1: 所有方法改为直接引用（仅 `delete: tasks.deleteTask` 需映射）
  - [x] SubTask 5.2: 移除所有 `as never` 类型转换
  - [x] SubTask 5.3: `mobileSchedulerApi: ISchedulerApi` 类型标注有效

- [x] Task 6: 类型检查验证
  - [x] SubTask 6.1: `npx tsc --noEmit` 零错误通过
  - [x] SubTask 6.2: index.ts 中无 `as never` 或 `as unknown as` 类型转换

# Task Dependencies
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
- [Task 6] depends on [Task 5]
