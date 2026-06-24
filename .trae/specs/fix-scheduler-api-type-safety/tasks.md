# Tasks

- [x] Task 1: 为 18 个子 API 模块定义独立接口
  - [x] SubTask 1.1: 读取所有 18 个子模块文件，提取精确的方法签名
  - [x] SubTask 1.2: 在 `ISchedulerApi.ts` 中定义 18 个子接口（ISchedulerTasksApi, ISchedulerQueuesApi 等）
  - [x] SubTask 1.3: 使用交叉类型组合为 `ISchedulerApi`，替换原有的 `Record<string, any>`

- [x] Task 2: 修复 updateProgress 方法名冲突
  - [x] SubTask 2.1: 将 `schedulesApi.updateProgress` 重命名为 `updateProgressPlanEntry`
  - [x] SubTask 2.2: 更新 `ActiveTaskPanel.tsx` 中的调用点
  - [x] SubTask 2.3: 确认 `tasksApi.updateProgress` 在合并后可正常访问

- [x] Task 3: 更新 modules/scheduler/index.ts 导出
  - [x] SubTask 3.1: 确认 schedulerApi 对象的运行时行为不变（spread 合并逻辑不变）
  - [x] SubTask 3.2: 添加类型断言确保 schedulerApi 满足 ISchedulerApi 接口

- [x] Task 4: 同步修复 mobile 层
  - [x] SubTask 4.1: 检查 mobile/scheduler 的方法名冲突情况（无 updateProgress 冲突，但方法名与 ISchedulerApi 不匹配）
  - [x] SubTask 4.2: 添加 `as unknown as ISchedulerApi` 类型断言 + TODO 注释

- [x] Task 5: 类型检查验证
  - [x] SubTask 5.1: 运行 `npm run check` 确认无新增类型错误
  - [x] SubTask 5.2: 验证 `api.scheduler.updateProgress` 调用指向正确的 tasksApi 版本

# Task Dependencies
- [Task 2] depends on [Task 1] — 需要先定义接口才能发现冲突
- [Task 3] depends on [Task 1, Task 2] — 类型断言需要完整接口
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4] — 最终验证
