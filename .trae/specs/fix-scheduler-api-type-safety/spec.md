# 修复 schedulerApi 类型安全漏洞 Spec

## Why

`ISchedulerApi` 被定义为 `Record<string, (...args: any[]) => Promise<any>>`，18 个子 API 模块通过展开运算符合并为 `schedulerApi`，导致 93 个方法完全丧失类型安全。更严重的是，已确认存在方法名冲突：`tasksApi.updateProgress` 被 `schedulesApi.updateProgress` 静默覆盖，调用方无法访问任务进度更新功能。

## What Changes

- 为每个子 API 模块定义独立的 TypeScript 接口（如 `ISchedulerTasksApi`, `ISchedulerFocusApi` 等）
- 使用交叉类型（intersection type）组合为完整的 `ISchedulerApi` 接口
- 修复 `updateProgress` 方法名冲突：将 `schedulesApi.updateProgress` 重命名为 `updateProgressPlanEntry`
- 更新 `IApi` 中 `scheduler` 字段的类型引用
- 更新所有消费 `api.scheduler` 的调用点以适配重命名

## Impact

- Affected specs: api-contract-layer, api-contract-type-completion
- Affected code:
  - `src/services/api/contracts/ISchedulerApi.ts` — 完全重写
  - `src/services/api/modules/scheduler/index.ts` — 添加类型组合
  - `src/services/api/modules/scheduler/schedules.ts` — 重命名 `updateProgress`
  - `src/services/api/contracts/IApi.ts` — 更新 import
  - `src/components/Scheduler/ActiveTaskPanel.tsx` — 适配重命名
  - `src/services/mobile/scheduler/index.ts` — 同步修复

## ADDED Requirements

### Requirement: SchedulerApi 类型安全接口

系统 SHALL 为 scheduler 的每个子 API 模块定义独立的 TypeScript 接口，确保所有方法签名在编译期可检查。

#### Scenario: 类型检查通过
- **WHEN** 开发者调用 `api.scheduler.create(data)` 时传入了错误类型的参数
- **THEN** TypeScript 编译器 SHALL 报告类型错误

#### Scenario: 方法名冲突检测
- **WHEN** 两个子模块定义了相同的方法名
- **THEN** TypeScript 编译器 SHALL 报告交叉类型冲突错误

### Requirement: 消除 updateProgress 方法名冲突

系统 SHALL 确保 `schedulerApi` 中不存在方法名冲突。

#### Scenario: tasksApi.updateProgress 可正常调用
- **WHEN** 调用 `api.scheduler.updateProgress(taskId, { progress_percentage: 50 })`
- **THEN** 请求 SHALL 发送到 `PATCH /scheduler/tasks/:id/progress`

#### Scenario: schedulesApi 进度计划条目更新可正常调用
- **WHEN** 调用 `api.scheduler.updateProgressPlanEntry(taskId, { date: "2024-01-01", percentage: 50 })`
- **THEN** 请求 SHALL 发送到 `POST /scheduler/tasks/:id/progress`

## MODIFIED Requirements

### Requirement: ISchedulerApi 接口定义

`ISchedulerApi` SHALL 由以下子接口通过交叉类型组合而成：

```typescript
export type ISchedulerApi = ISchedulerTasksApi &
  ISchedulerQueuesApi &
  ISchedulerExecutionsApi &
  ISchedulerDependenciesApi &
  ISchedulerFocusApi &
  ISchedulerSchedulesApi &
  ISchedulerSettingsApi &
  ISchedulerSubtasksApi &
  ISchedulerLinksApi &
  ISchedulerKnowledgePointsApi &
  ISchedulerAnalyticsApi &
  ISchedulerAchievementsApi &
  ISchedulerStudyReviewApi &
  ISchedulerProgressSyncApi &
  ISchedulerPathTasksApi &
  ISchedulerActivitiesApi &
  ISchedulerOrchestratorApi &
  ISchedulerSystemTasksApi;
```

每个子接口 SHALL 精确定义其方法签名，包括参数类型和返回类型。

## REMOVED Requirements

### Requirement: ISchedulerApi 为 Record<string, any> 类型
**Reason**: 完全丧失类型安全，无法在编译期检测方法名冲突和参数类型错误
**Migration**: 替换为上述交叉类型组合
